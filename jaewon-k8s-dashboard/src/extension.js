'use strict';
const vscode = require('vscode');
const { Backend } = require('./backend');
const { Forwards } = require('./forwards');
const { Logs } = require('./logs');
const { html } = require('./webview');

function activate(context) {
  const backend = new Backend(context);
  const panels = new Set(); let current = { context: '', namespace: 'default' }; let forwardTree;
  const notify = () => { clusterTree.changed.fire(); forwardTree.changed.fire(); for (const p of panels) p.webview.postMessage({ event: 'refresh' }); };
  const forwards = new Forwards(context, backend, () => { forwardTree?.changed.fire(); for (const p of panels) p.webview.postMessage({ event: 'refresh' }); });
  const logs = new Logs(context, backend);
  const dashboardTree = new Tree(async () => [
    { label: 'Open Dashboard', iconPath: new vscode.ThemeIcon('dashboard'), command: { command: 'jaewonK8s.open', title: 'Open Dashboard' } },
    { label: 'Open Cluster in New Tab', iconPath: new vscode.ThemeIcon('split-horizontal'), command: { command: 'jaewonK8s.openNew', title: 'Open Cluster in New Tab' } },
    { label: 'Cluster Health Report', iconPath: new vscode.ThemeIcon('pulse'), command: { command: 'jaewonK8s.health', title: 'Cluster Health Report' } }
  ]);
  const clusterTree = new Tree(async () => (await backend.contexts()).map(c => ({ label: c.name, description: c.current ? 'current' : c.cluster, contextName: c.name, iconPath: new vscode.ThemeIcon('server-environment'), command: { command: 'jaewonK8s.open', title: 'Open Dashboard', arguments: [c.name] } })));
  forwardTree = new Tree(async () => forwards.list().map(f => ({ label: `${f.name} ${f.localPort || 'auto'} → ${f.remotePort}`, description: f.status, forwardId: f.id, tooltip: `${f.context} / ${f.namespace}${f.error ? '\n' + f.error : ''}`, iconPath: new vscode.ThemeIcon(f.status === 'running' ? 'plug' : 'debug-disconnect') })));
  async function pickContext(value) {
    if (typeof value === 'string' && value) return value;
    if (value?.contextName) return value.contextName;
    const contexts = await backend.contexts();
    return contexts.find(c => c.current)?.name || contexts[0]?.name;
  }
  async function health(value) {
    const selected = await pickContext(value || current.context); if (!selected) throw Error('No Kubernetes contexts found.');
    const report = `# Cluster Health: ${selected}\n\n${new Date().toISOString()}\n\n${await backend.health(selected)}`;
    await vscode.env.clipboard.writeText(report);
    await backend.showText('Cluster health report copied to clipboard', report, 'markdown');
    return { message: 'Health report opened and copied to clipboard.' };
  }
  async function open(value, forceNew = false) {
    const selected = await pickContext(value); if (!selected) throw Error('No Kubernetes contexts found. Configure kubectl first.');
    if (!forceNew) { for (const p of panels) if (p.clusterContext === selected) { p.reveal(); return; } }
    const panel = vscode.window.createWebviewPanel('jaewonK8s.dashboard', `K8s: ${selected}`, vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] });
    panel.clusterContext = selected; current.context = selected; panels.add(panel);
    panel.webview.html = html(panel.webview, context.extensionUri, 'dashboard.js');
    const receiver = panel.webview.onDidReceiveMessage(async msg => {
      if (!msg || !Number.isSafeInteger(msg.id) || typeof msg.command !== 'string') return;
      const a = msg.args || {}; let result;
      try {
        const cluster = a.context || panel.clusterContext;
        if (typeof cluster !== 'string') throw Error('Invalid context');
        switch (msg.command) {
          case 'settings': result = { refreshSeconds: backend.config('refreshSeconds', 5), metrics: backend.config('metrics', true), initialContext: panel.clusterContext }; break;
          case 'contexts': result = (await backend.contexts()).map(c => ({ ...c, current: c.name === panel.clusterContext })); break;
          case 'namespaces': result = await backend.namespaces(cluster); break;
          case 'list':
            panel.clusterContext = cluster; panel.title = `K8s: ${cluster}`; current = { context: cluster, namespace: a.namespace || 'default' };
            result = await backend.list(cluster, a.namespace, a.kind); break;
          case 'detail': result = await backend.detail(cluster, a.namespace, a.kind, a.name); break;
          case 'metrics': result = await backend.metrics(cluster, a.namespace, a.kind); break;
          case 'action': {
            let action = a.action;
            if (a.kind === 'helm') action = action.replace(/^helm/, '').replace(/^./, c => c.toLowerCase());
            if (action === 'logs') result = await logs.open({ ...a, context: cluster });
            else if (action === 'forward') result = await forwards.add({ ...a, context: cluster });
            else result = await backend.action(cluster, a.namespace, a.kind, a.name, action, a.payload || {});
            notify(); break;
          }
          case 'logs': result = await logs.open({ ...a, context: cluster }); break;
          case 'forward': result = await forwards.add({ ...a, context: cluster }); break;
          case 'forwards': result = forwards.list(); break;
          case 'forwardAction': result = await forwards.action(a.id, a.action); break;
          case 'health': result = await health(cluster); break;
          case 'newTab': await open(cluster, true); result = true; break;
          case 'apply': result = await backend.applyFile(undefined, cluster, a.namespace); break;
          case 'customResources': result = JSON.parse(await backend.run(cluster, ['get', 'customresourcedefinitions', '-o', 'json'])).items.map(crd => ({ name: crd.spec.names.plural + '.' + crd.spec.group, kind: crd.spec.names.kind, namespaced: crd.spec.scope === 'Namespaced' })); break;
          case 'copy': await vscode.env.clipboard.writeText(String(a.text || '')); result = true; break;
          default: throw Error('Unknown dashboard command.');
        }
        await panel.webview.postMessage({ id: msg.id, result: result ?? null });
      } catch (error) { await panel.webview.postMessage({ id: msg.id, error: error.message || String(error) }); }
    });
    panel.onDidDispose(() => { receiver.dispose(); panels.delete(panel); });
    panel.onDidChangeViewState(() => { if (panel.active) current.context = panel.clusterContext; });
  }
  const guard = fn => (...args) => Promise.resolve().then(() => fn(...args)).catch(e => vscode.window.showErrorMessage(`Jaewon K8s: ${e.message}`));
  const command = (name, fn) => context.subscriptions.push(vscode.commands.registerCommand(`jaewonK8s.${name}`, guard(fn)));
  command('open', value => open(value)); command('openNew', value => open(value, true)); command('refresh', notify); command('health', health);
  const showSidebar = () => vscode.commands.executeCommand('workbench.view.extension.jaewonK8s');
  command('showSidebar', showSidebar);
  context.subscriptions.push(vscode.window.registerUriHandler({ handleUri: guard(uri => uri.path === '/sidebar' ? showSidebar() : uri.path === '/open' ? open() : undefined) }));
  command('applyFile', async uri => {
    let selected = current.context || await pickContext();
    if (!selected) throw Error('No Kubernetes contexts found.');
    const result = await backend.applyFile(uri?.scheme ? uri : undefined, selected, current.namespace);
    if (typeof result === 'string') vscode.window.showInformationMessage(result.trim()); notify();
  });
  command('switchContext', async value => {
    const selected = value?.contextName || await vscode.window.showQuickPick((await backend.contexts()).map(c => c.name), { title: 'Switch kubectl default context' });
    if (selected) { await backend.run('', ['config', 'use-context', selected]); notify(); }
  });
  for (const action of ['Open', 'Start', 'Stop', 'Save', 'Forget']) command(`forward${action}`, item => forwards.action(item?.forwardId, action.toLowerCase()));
  context.subscriptions.push(vscode.window.registerTreeDataProvider('jaewonK8s.dashboard', dashboardTree), vscode.window.registerTreeDataProvider('jaewonK8s.clusters', clusterTree), vscode.window.registerTreeDataProvider('jaewonK8s.forwards', forwardTree), forwards, logs);
  if (!context.globalState.get('sidebarRegistered.v1')) {
    void showSidebar().then(() => context.globalState.update('sidebarRegistered.v1', true), () => {});
  }
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('jaewonK8s')) notify(); }));
  return { open, backend, forwards, logs, panels };
}
class Tree {
  constructor(load) { this.load = load; this.changed = new vscode.EventEmitter(); this.onDidChangeTreeData = this.changed.event; }
  getTreeItem(item) { return item; }
  async getChildren() { try { return await this.load(); } catch (e) { return [{ label: 'Connection unavailable', tooltip: e.message, description: 'Check kubectl / settings' }]; } }
}
exports.activate = activate;
exports.deactivate = () => {};
