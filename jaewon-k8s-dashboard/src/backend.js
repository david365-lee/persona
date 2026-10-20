'use strict';
const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

class Backend {
  constructor(extensionContext) {
    this.extensionContext = extensionContext;
    this.children = new Set();
    this.files = new Map();
    extensionContext.subscriptions.push({ dispose: () => { for (const child of this.children) child.kill(); } });
  }
  config(name, fallback) { return vscode.workspace.getConfiguration('jaewonK8s').get(name, fallback); }
  binary(tool) { return this.config(`${tool}Path`, tool); }
  args(context, args, tool) {
    const prefix = [];
    const kubeconfig = this.config('kubeconfig', '');
    if (kubeconfig && !kubeconfig.includes(path.delimiter)) prefix.push('--kubeconfig', kubeconfig);
    if (context) prefix.push(tool === 'helm' ? '--kube-context' : '--context', context);
    return [...prefix, ...args.map(String)];
  }
  spawn(context, args, tool = 'kubectl') {
    const kubeconfig = this.config('kubeconfig', '');
    const child = cp.spawn(this.binary(tool), this.args(context, args, tool), { windowsHide: true, shell: false, env: kubeconfig ? { ...process.env, KUBECONFIG: kubeconfig } : process.env });
    this.children.add(child);
    child.once('close', () => this.children.delete(child));
    child.once('error', () => this.children.delete(child));
    return child;
  }
  run(context, args, input, tool = 'kubectl') {
    return new Promise((resolve, reject) => {
      const child = this.spawn(context, args, tool);
      let stdout = '', stderr = '', settled = false;
      const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
      const timer = setTimeout(() => { child.kill(); finish(new Error(`${tool} timed out. Check cluster connectivity or increase jaewonK8s.commandTimeout.`)); }, Math.max(1000, this.config('commandTimeout', 30000)));
      child.stdout.on('data', data => { stdout += data; });
      child.stderr.on('data', data => { stderr += data; });
      child.on('error', error => finish(new Error(`Cannot run ${this.binary(tool)}: ${error.message}`)));
      child.on('close', code => finish(code === 0 ? null : new Error(stderr.trim() || stdout.trim() || `${tool} exited with code ${code}`), stdout));
      child.stdin.on('error', () => {});
      child.stdin.end(input === undefined ? undefined : String(input));
    });
  }
  async contexts() {
    const config = JSON.parse(await this.run('', ['config', 'view', '-o', 'json']));
    return (config.contexts || []).map(c => ({ name: c.name, cluster: c.context.cluster, user: c.context.user, current: c.name === config['current-context'] }));
  }
  async namespaces(context) { return JSON.parse(await this.run(context, ['get', 'namespaces', '-o', 'json'])).items.map(n => n.metadata.name); }
  scope(namespace) { return namespace && namespace !== '*' && namespace !== 'all' ? ['--namespace', namespace] : ['--all-namespaces']; }
  objectScope(namespace) { return namespace && namespace !== '*' && namespace !== 'all' ? ['--namespace', namespace] : []; }
  async list(context, namespace, kind) {
    if (kind === 'helm') return JSON.parse(await this.run(context, ['list', ...this.scope(namespace), '-o', 'json'], undefined, 'helm'));
    const result = JSON.parse(await this.run(context, ['get', kind, ...this.scope(namespace), '-o', 'json']));
    return result.items || [result];
  }
  metrics(context, namespace, kind = 'pods') { return this.run(context, ['top', kind === 'nodes' ? 'nodes' : 'pods', ...(kind === 'nodes' ? [] : this.scope(namespace)), '--no-headers']); }
  async detail(context, namespace, kind, name) {
    const resource = JSON.parse(await this.run(context, ['get', kind, name, ...this.objectScope(namespace), '-o', 'json']));
    let events = [];
    try { events = JSON.parse(await this.run(context, ['get', 'events', ...this.scope(namespace), '--field-selector', `involvedObject.uid=${resource.metadata.uid}`, '-o', 'json'])).items || []; } catch (_) { /* RBAC may exclude events. */ }
    return { resource, events };
  }
  async showText(title, text, language = 'plaintext') {
    const document = await vscode.workspace.openTextDocument({ content: text, language });
    await vscode.window.showTextDocument(document, { preview: false });
    return { message: title };
  }
  async confirm(message) { return await vscode.window.showWarningMessage(message, { modal: true }, 'Confirm') === 'Confirm'; }
  async editYaml(context, namespace, kind, name) {
    const text = await this.run(context, ['get', kind, name, ...this.objectScope(namespace), '-o', 'yaml']);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jaewon-k8s-'));
    const file = path.join(dir, `${String(name).replace(/[^a-zA-Z0-9_.-]/g, '_')}.yaml`);
    await fs.writeFile(file, text, 'utf8');
    this.files.set(file, { context, namespace });
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(file)), { preview: false });
    vscode.window.showInformationMessage('Edit the YAML, save it, then run “Jaewon K8s: Apply YAML File”.');
    return { message: 'YAML opened for editing' };
  }
  async applyFile(uri, context, namespace) {
    const document = uri ? await vscode.workspace.openTextDocument(uri) : vscode.window.activeTextEditor?.document;
    if (!document) throw new Error('Open a YAML file first.');
    const tracked = this.files.get(document.uri.fsPath);
    const targetContext = tracked?.context || context;
    if (!targetContext) throw new Error('Select a Kubernetes context first.');
    if (!(await this.confirm(`Apply this YAML to context “${targetContext}”?`))) return { cancelled: true };
    await document.save();
    return this.run(targetContext, ['apply', ...(tracked?.namespace || namespace ? this.scope(tracked?.namespace || namespace).filter(a => a !== '--all-namespaces') : []), '-f', '-'], document.getText());
  }
  async action(context, namespace, kind, name, action, payload = {}) {
    const scope = this.objectScope(namespace);
    const target = `${kind}/${name}`;
    if (kind === 'helm') return this.helmAction(context, namespace, name, action, payload);
    if (action === 'yaml' || action === 'edit') return this.editYaml(context, namespace, kind, name);
    if (action === 'describe') return this.showText(target, await this.run(context, ['describe', kind, name, ...scope]));
    if (action === 'logs') {
      const resource = JSON.parse(await this.run(context, ['get', kind, name, ...scope, '-o', 'json']));
      return { resource, containers: (resource.spec?.containers || resource.spec?.template?.spec?.containers || []).map(c => c.name) };
    }
    if (action === 'shell' || action === 'exec') {
      let podName = name;
      if (!['pods', 'pod'].includes(kind)) {
        const resource = JSON.parse(await this.run(context, ['get', kind, name, ...scope, '-o', 'json']));
        const selector = Object.entries(resource.spec?.selector?.matchLabels || resource.spec?.selector || {}).map(([k,v]) => `${k}=${v}`).join(',');
        if (!selector) throw new Error('This resource has no pod selector.');
        const pods = JSON.parse(await this.run(context, ['get', 'pods', ...scope, '-l', selector, '-o', 'json'])).items || [];
        const choice = await vscode.window.showQuickPick(pods.map(p => p.metadata.name), { title: 'Pod to open shell in' });
        if (!choice) return { cancelled: true }; podName = choice;
      }
      let container = payload.container;
      if (!container) {
        const pod = JSON.parse(await this.run(context, ['get', 'pod', podName, ...scope, '-o', 'json']));
        const containers = (pod.spec?.containers || []).map(c => c.name);
        container = containers.length > 1 ? await vscode.window.showQuickPick(containers, { title: 'Container' }) : containers[0];
        if (!container) return { cancelled: true };
      }
      const args = ['exec', '-it', podName, ...scope];
      if (container) args.push('-c', container);
      args.push('--', payload.shell || '/bin/sh');
      const terminal = vscode.window.createTerminal({ name: `K8s: ${name}`, shellPath: this.binary('kubectl'), shellArgs: this.args(context, args, 'kubectl'), env: this.config('kubeconfig', '') ? { KUBECONFIG: this.config('kubeconfig', '') } : undefined });
      terminal.show(); return { message: 'Terminal opened' };
    }
    if (action === 'restart') {
      if (['pod', 'pods'].includes(kind)) {
        if (!(await this.confirm(`Restart pod ${name} by deleting it? Its controller must recreate it.`))) return { cancelled: true };
        return this.run(context, ['delete', 'pod', name, ...scope]);
      }
      return this.run(context, ['rollout', 'restart', target, ...scope]);
    }
    if (action === 'scale') {
      const replicas = payload.replicas ?? await vscode.window.showInputBox({ prompt: 'Replica count', validateInput: value => /^\d+$/.test(value) ? undefined : 'Enter a nonnegative integer' });
      if (replicas === undefined) return { cancelled: true };
      if (!/^\d+$/.test(String(replicas))) throw new Error('Invalid replica count');
      return this.run(context, ['scale', target, ...scope, `--replicas=${replicas}`]);
    }
    if (action === 'delete') {
      if (!(await this.confirm(`Delete ${target} from context “${context}”?`))) return { cancelled: true };
      return this.run(context, ['delete', kind, name, ...scope]);
    }
    if (action === 'run' || action === 'runJob') return this.run(context, ['create', 'job', `${name.slice(0, 40)}-${Date.now()}`, `--from=cronjob/${name}`, ...scope]);
    if (action === 'suspend' || action === 'resume') return this.run(context, ['patch', kind, name, ...scope, '--type=merge', '-p', JSON.stringify({ spec: { suspend: action === 'suspend' } })]);
    if (action === 'cordon' || action === 'uncordon') return this.run(context, [action, name]);
    throw new Error(`Unsupported action: ${action}`);
  }
  async helmAction(context, namespace, name, action, payload = {}) {
    const scope = namespace && namespace !== '*' && namespace !== 'all' ? ['--namespace', namespace] : [];
    if (['values', 'manifest', 'notes'].includes(action)) return this.showText(`${name}: ${action}`, await this.run(context, ['get', action, name, ...scope], undefined, 'helm'), action === 'notes' ? 'plaintext' : 'yaml');
    if (action === 'history') return this.showText(`${name}: history`, await this.run(context, ['history', name, ...scope], undefined, 'helm'));
    if (action === 'uninstall') {
      if (!(await this.confirm(`Uninstall Helm release “${name}” from context “${context}”?`))) return { cancelled: true };
      return this.run(context, ['uninstall', name, ...scope], undefined, 'helm');
    }
    if (action === 'rollback') {
      const revision = payload.revision ?? await vscode.window.showInputBox({ prompt: 'Helm revision to restore', validateInput: value => /^[1-9]\d*$/.test(value) ? undefined : 'Enter a positive revision' });
      if (revision === undefined) return { cancelled: true };
      if (!/^[1-9]\d*$/.test(String(revision))) throw new Error('Invalid revision');
      if (!(await this.confirm(`Roll back “${name}” to revision ${revision}?`))) return { cancelled: true };
      return this.run(context, ['rollback', name, String(revision), ...scope], undefined, 'helm');
    }
    throw new Error(`Unsupported Helm action: ${action}`);
  }
  async health(context) {
    const results = await Promise.allSettled(['pods', 'deployments', 'statefulsets', 'nodes'].map(kind => this.run(context, ['get', kind, '-A', '-o', 'json'])));
    const sections = results.map((result, i) => {
      const kind = ['Pods', 'Deployments', 'StatefulSets', 'Nodes'][i];
      if (result.status !== 'fulfilled') return `## ${kind}\n\nUnavailable: ${result.reason.message}`;
      const items = JSON.parse(result.value).items || []; const problems = [];
      for (const item of items) {
        const id = `${item.metadata.namespace ? item.metadata.namespace + '/' : ''}${item.metadata.name}`; const s = item.status || {};
        if (i === 0) {
          const containers = [...(s.initContainerStatuses || []), ...(s.containerStatuses || [])];
          const reasons = containers.flatMap(c => [c.state?.waiting?.reason, c.state?.terminated?.reason, c.lastState?.terminated?.reason]).filter(Boolean);
          const restarts = containers.reduce((n,c) => n + (c.restartCount || 0),0);
          if (['Pending', 'Failed', 'Unknown'].includes(s.phase) || reasons.some(r => /BackOff|Error|OOMKilled/.test(r)) || restarts > 0) problems.push(`- ${id}: ${s.phase}; ${reasons.join(', ')}; restarts=${restarts}`);
        } else if (i < 3 && (s.readyReplicas || 0) < (item.spec.replicas ?? 1)) problems.push(`- ${id}: ${s.readyReplicas || 0}/${item.spec.replicas ?? 1} ready`);
        else if (i === 3 && !s.conditions?.some(c => c.type === 'Ready' && c.status === 'True')) problems.push(`- ${id}: NotReady`);
      }
      return `## ${kind}\n\n${problems.length ? problems.join('\n') : `No problems found in ${items.length} resources.`}`;
    });
    return sections.join('\n\n');
  }
}
module.exports = { Backend };
