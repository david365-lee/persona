'use strict';
const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { podStatus, podReady, podRestarts, podNeedsAttention } = require('../media/resource-model');
const { selectorFor } = require('./selectors');
const { Connections, serverAddress } = require('./connections');
const clusterKinds = new Set(['storageclasses', 'storageclass', 'sc', 'persistentvolumes', 'pv', 'nodes', 'node', 'namespaces', 'namespace', 'customresourcedefinitions']);

class Backend {
  constructor(extensionContext) {
    this.extensionContext = extensionContext;
    this.children = new Set();
    this.files = new Map();
    this.connections = new Connections(extensionContext);
    extensionContext.subscriptions.push({ dispose: () => { for (const child of this.children) child.kill(); } });
  }
  config(name, fallback) { return vscode.workspace.getConfiguration('jaewonK8s').get(name, fallback); }
  binary(tool) { return this.config(`${tool}Path`, tool); }
  kubeconfig(context) { return this.connections.file(context) || this.config('kubeconfig', ''); }
  args(context, args, tool) {
    const prefix = [];
    const kubeconfig = this.kubeconfig(context);
    if (kubeconfig && !kubeconfig.includes(path.delimiter)) prefix.push('--kubeconfig', kubeconfig);
    if (context) prefix.push(tool === 'helm' ? '--kube-context' : '--context', context);
    return [...prefix, ...args.map(String)];
  }
  spawn(context, args, tool = 'kubectl') {
    const kubeconfig = this.kubeconfig(context);
    const child = cp.spawn(this.binary(tool), this.args(context, args, tool), { windowsHide: true, shell: false, env: kubeconfig ? { ...process.env, KUBECONFIG: kubeconfig } : process.env });
    this.children.add(child);
    child.once('close', () => this.children.delete(child));
    child.once('error', () => this.children.delete(child));
    return child;
  }
  async run(context, args, input, tool = 'kubectl') {
    await this.connections.ready;
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
    await this.connections.ready;
    let config;
    try { config = JSON.parse(await this.run('', ['config', 'view', '-o', 'json'])); }
    catch (error) { if (!this.connections.profiles.length) throw error; config = {}; }
    return [...(config.contexts || []).map(c => ({ name: c.name, cluster: c.context.cluster, user: c.context.user, current: c.name === config['current-context'] })), ...this.connections.profiles.map(p => ({ name: p.id, label: `Remote: ${p.name}`, cluster: p.server, current: false }))];
  }
  async connect() {
    const mode = await vscode.window.showQuickPick(['Local / existing kubeconfig', 'Remote: API address + credentials', 'Remove saved remote connection'], { title: 'Kubernetes connection' });
    if (!mode) return;
    if (mode === 'Local / existing kubeconfig') {
      const contexts = (await this.contexts()).filter(c => !this.connections.profiles.some(p => p.id === c.name));
      if (!contexts.length) throw new Error('No local contexts. Set jaewonK8s.kubeconfig to your kubeconfig file first.');
      return vscode.window.showQuickPick(contexts.map(c => c.name), { title: 'Local / existing kubeconfig context (may also point to a remote cluster)' });
    }
    if (mode === 'Remove saved remote connection') {
      const profile = await vscode.window.showQuickPick(this.connections.profiles.map(p => ({ label: p.name, description: p.server, id: p.id })), { title: 'Remove remote connection' });
      if (profile && await this.confirm(`Remove saved credentials for “${profile.label}”? Stop its logs, shells and port forwards first.`)) await this.connections.remove(profile.id);
      return;
    }
    const name = await vscode.window.showInputBox({ title: 'Remote connection name', validateInput: v => v.trim() ? undefined : 'Enter a name' });
    if (!name) return;
    const server = await vscode.window.showInputBox({ title: 'Remote Kubernetes API server', placeHolder: 'https://cluster.example.com:6443', validateInput: serverAddress });
    if (!server) return;
    const auth = await vscode.window.showQuickPick(['Bearer token', 'Client certificate + private key (PEM)'], { title: 'Remote authentication (SSH keys are not Kubernetes API credentials)' });
    if (!auth) return;
    const pickFile = async title => (await vscode.window.showOpenDialog({ title, canSelectMany: false, canSelectFolders: false }))?.[0]?.fsPath;
    const caMode = await vscode.window.showQuickPick(['Cluster CA certificate (PEM)', 'System trusted certificate authorities'], { title: 'Verify API server TLS certificate' });
    if (!caMode) return;
    let ca;
    if (caMode.startsWith('Cluster')) { const file = await pickFile('Cluster CA certificate'); if (!file) return; ca = (await fs.readFile(file)).toString('base64'); }
    let credentials;
    if (auth === 'Bearer token') {
      const token = await vscode.window.showInputBox({ title: 'Kubernetes bearer token', password: true, ignoreFocusOut: true, validateInput: v => v.trim() && !/\s/.test(v.trim()) ? undefined : 'Enter a nonempty token without whitespace' });
      if (!token) return; credentials = { token: token.trim() };
    } else {
      const cert = await pickFile('Client certificate (PEM)'); if (!cert) return;
      const key = await pickFile('Client private key (PEM)'); if (!key) return;
      credentials = { 'client-certificate-data': (await fs.readFile(cert)).toString('base64'), 'client-key-data': (await fs.readFile(key)).toString('base64') };
    }
    const id = await this.connections.add(name.trim(), server.trim(), credentials, ca);
    try { await this.run(id, ['get', '--raw=/version']); }
    catch (_) { vscode.window.showWarningMessage('Connection saved, but the API connectivity test failed. Check address, TLS certificate, network/VPN, credentials and RBAC. You can retry from the dashboard.'); }
    return id;
  }
  resourceScope(kind, namespace, list = false) { return clusterKinds.has(kind) ? [] : list ? this.scope(namespace) : this.objectScope(namespace); }
  async namespaces(context) { return JSON.parse(await this.run(context, ['get', 'namespaces', '-o', 'json'])).items.map(n => n.metadata.name); }
  scope(namespace) { return namespace && namespace !== '*' && namespace !== 'all' ? ['--namespace', namespace] : ['--all-namespaces']; }
  objectScope(namespace) { return namespace && namespace !== '*' && namespace !== 'all' ? ['--namespace', namespace] : []; }
  async list(context, namespace, kind) {
    if (kind === 'helm') return JSON.parse(await this.run(context, ['list', ...this.scope(namespace), '-o', 'json'], undefined, 'helm'));
    const result = JSON.parse(await this.run(context, ['get', kind, ...this.resourceScope(kind, namespace, true), '-o', 'json']));
    return result.items || [result];
  }
  metrics(context, namespace, kind = 'pods') { return this.run(context, ['top', kind === 'nodes' ? 'nodes' : 'pods', ...(kind === 'nodes' ? [] : this.scope(namespace)), '--no-headers']); }
  async detail(context, namespace, kind, name) {
    const resource = JSON.parse(await this.run(context, ['get', kind, name, ...this.resourceScope(kind, namespace), '-o', 'json']));
    let events = [];
    try { events = JSON.parse(await this.run(context, ['get', 'events', ...this.scope(namespace), '--field-selector', `involvedObject.uid=${resource.metadata.uid}`, '-o', 'json'])).items || []; } catch (_) { /* RBAC may exclude events. */ }
    const eventTime = event => Date.parse(event.lastTimestamp || event.series?.lastObservedTime || event.eventTime || event.metadata?.creationTimestamp || '') || 0;
    events.sort((a, b) => eventTime(a) - eventTime(b));
    return { resource, events };
  }
  async showText(title, text, language = 'plaintext') {
    const document = await vscode.workspace.openTextDocument({ content: text, language });
    await vscode.window.showTextDocument(document, { preview: false });
    return { message: title };
  }
  async confirm(message) { return await vscode.window.showWarningMessage(message, { modal: true }, 'Confirm') === 'Confirm'; }
  async editYaml(context, namespace, kind, name) {
    const text = await this.run(context, ['get', kind, name, ...this.resourceScope(kind, namespace), '-o', 'yaml']);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jaewon-k8s-'));
    const file = path.join(dir, `${String(name).replace(/[^a-zA-Z0-9_.-]/g, '_')}.yaml`);
    await fs.writeFile(file, text, 'utf8');
    this.files.set(file, { context, namespace: clusterKinds.has(kind) ? '' : namespace });
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(file)), { preview: false });
    vscode.window.showInformationMessage('Edit the YAML, save it, then run “Jaewon K8s: Apply YAML File”.');
    return { message: 'YAML opened for editing' };
  }
  async applyFile(uri, context, namespace) {
    const document = uri ? await vscode.workspace.openTextDocument(uri) : vscode.window.activeTextEditor?.document;
    if (!document) throw new Error('Open a YAML file first.');
    const tracked = this.files.get(document.uri.fsPath);
    if (tracked?.storageClassTemplate && /replace-with-class-name|replace-with-csi-driver/.test(document.getText())) throw new Error('Replace the StorageClass name and CSI provisioner placeholders before applying.');
    const targetContext = tracked?.context || context;
    if (!targetContext) throw new Error('Select a Kubernetes context first.');
    if (!(await this.confirm(`Apply this YAML to context “${targetContext}”?`))) return { cancelled: true };
    await document.save();
    const targetNamespace = tracked ? tracked.namespace : namespace;
    return this.run(targetContext, ['apply', ...(targetNamespace ? this.objectScope(targetNamespace) : []), '-f', '-'], document.getText());
  }
  async createStorageClass(context) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jaewon-k8s-'));
    const file = path.join(dir, 'storageclass.yaml');
    await fs.writeFile(file, 'apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: replace-with-class-name\n  annotations:\n    storageclass.kubernetes.io/is-default-class: "false"\n# Replace with the provisioner installed in this cluster and its parameters.\nprovisioner: replace-with-csi-driver\nreclaimPolicy: Retain\nvolumeBindingMode: WaitForFirstConsumer\nallowVolumeExpansion: true\nparameters: {}\n');
    this.files.set(file, { context, namespace: '', storageClassTemplate: true });
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(file)), { preview: false });
    return { message: 'Set name, installed CSI provisioner and driver-specific parameters, save, then run Apply YAML to Cluster.' };
  }
  async action(context, namespace, kind, name, action, payload = {}) {
    const scope = this.resourceScope(kind, namespace);
    const target = `${kind}/${name}`;
    if (kind === 'helm') return this.helmAction(context, namespace, name, action, payload);
    if (clusterKinds.has(kind) && ['storageclasses', 'storageclass', 'sc'].includes(kind) && ['setDefault', 'unsetDefault'].includes(action)) {
      const classes = await this.list(context, '', 'storageclasses');
      const previous = classes.filter(c => c.metadata.name !== name && (c.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true' || c.metadata.annotations?.['storageclass.beta.kubernetes.io/is-default-class'] === 'true'));
      if (!(await this.confirm(`${action === 'setDefault' ? 'Set' : 'Unset'} default StorageClass “${name}” in “${context}”?${action === 'setDefault' && previous.length ? ` Existing defaults will be cleared: ${previous.map(c => c.metadata.name).join(', ')}.` : ''} This affects PVCs without an explicit storageClassName.`))) return { cancelled: true };
      const patch = (target, value) => this.run(context, ['patch', 'storageclass', target, '--type=merge', '-p', JSON.stringify({ metadata: { annotations: { 'storageclass.kubernetes.io/is-default-class': value, 'storageclass.beta.kubernetes.io/is-default-class': null } } })]);
      await patch(name, action === 'setDefault' ? 'true' : 'false');
      if (action === 'setDefault') for (const c of previous) {
        try { await patch(c.metadata.name, 'false'); }
        catch (_) { throw new Error(`“${name}” is now a default, but clearing “${c.metadata.name}” failed. Refresh StorageClasses and resolve multiple defaults.`); }
      }
      return { message: 'Default StorageClass updated.' };
    }
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
        const selector = selectorFor(resource);
        if (!selector) throw new Error('This resource has no pod selector.');
        const pods = JSON.parse(await this.run(context, ['get', 'pods', ...scope, '-l', selector, '-o', 'json'])).items || [];
        const running = pods.filter(p => p.status?.phase === 'Running' && !p.metadata?.deletionTimestamp);
        if (!running.length) throw new Error('No running pods are available for this resource.');
        const choice = await vscode.window.showQuickPick(running.map(p => p.metadata.name), { title: 'Pod to open shell in' });
        if (!choice) return { cancelled: true }; podName = choice;
      }
      const pod = JSON.parse(await this.run(context, ['get', 'pod', podName, ...scope, '-o', 'json']));
      if (pod.status?.phase !== 'Running' || pod.metadata?.deletionTimestamp) throw new Error('Shell requires a running pod that is not terminating.');
      let container = payload.container;
      if (!container) {
        const containers = (pod.spec?.containers || []).map(c => c.name);
        container = containers.length > 1 ? await vscode.window.showQuickPick(containers, { title: 'Container' }) : containers[0];
        if (!container) return { cancelled: true };
      }
      const args = ['exec', '-it', podName, ...scope];
      if (container) args.push('-c', container);
      args.push('--', payload.shell || '/bin/sh');
      const terminal = vscode.window.createTerminal({ name: `K8s: ${name}`, shellPath: this.binary('kubectl'), shellArgs: this.args(context, args, 'kubectl'), env: this.kubeconfig(context) ? { KUBECONFIG: this.kubeconfig(context) } : undefined });
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
          const restarts = podRestarts(item);
          if (podNeedsAttention(item) || restarts > 0) problems.push(`- ${id}: ${podStatus(item)}; ready=${podReady(item)}; restarts=${restarts}${!podNeedsAttention(item) && restarts > 0 ? ' (restart history; currently healthy)' : ''}`);
        } else if (i < 3 && (s.readyReplicas || 0) < (item.spec.replicas ?? 1)) problems.push(`- ${id}: ${s.readyReplicas || 0}/${item.spec.replicas ?? 1} ready`);
        else if (i === 3 && !s.conditions?.some(c => c.type === 'Ready' && c.status === 'True')) problems.push(`- ${id}: NotReady`);
      }
      return `## ${kind}\n\n${problems.length ? problems.join('\n') : `No problems found in ${items.length} resources.`}`;
    });
    return sections.join('\n\n');
  }
}
module.exports = { Backend };
