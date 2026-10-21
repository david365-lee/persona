'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let serializer, created = [];
const noop = () => ({ dispose() {} });
function panel() {
  const messages = [], listeners = {};
  return { visible: true, active: true, messages, listeners,
    webview: { postMessage: async value => { messages.push(value); }, onDidReceiveMessage: fn => { listeners.receive = fn; return noop(); } },
    onDidChangeViewState: fn => { listeners.visibility = fn; return noop(); },
    onDidDispose: fn => { (listeners.dispose ||= []).push(fn); return noop(); },
    dispose() { for (const fn of listeners.dispose || []) fn(); }, reveal() {} };
}
const vscode = {
  ThemeIcon: class {}, EventEmitter: class { event() {} fire() {} }, ViewColumn: { Active: 1 },
  Uri: { joinPath: (base, ...parts) => [base, ...parts].join('/') },
  window: { createWebviewPanel: () => { const value = panel(); created.push(value); return value; }, registerWebviewPanelSerializer: (type, value) => { assert.equal(type, 'jaewonK8s.dashboard'); serializer = value; return noop(); }, registerUriHandler: noop, registerTreeDataProvider: noop },
  commands: { registerCommand: noop, executeCommand: async () => {} }, workspace: { onDidChangeConfiguration: noop }
};
Module._load = function(name, ...args) {
  if (name === 'vscode') return vscode;
  if (name === './backend') return { Backend: class { config(key, value) { return value; } async connect() { return 'remote-abc'; } async contexts() { return [{ name: 'default', current: true }]; } } };
  if (name === './forwards') return { Forwards: class { list() { return []; } } };
  if (name === './logs') return { Logs: class {} };
  if (name === './webview') return { html: () => '<html></html>' };
  return originalLoad.call(this, name, ...args);
};
const { activate } = require('./extension');
Module._load = originalLoad;
const context = () => ({ extensionUri: '/extension', subscriptions: [], globalState: { get: () => true } });

test('restored dashboard reuses its saved context and namespace without creating a second panel', async () => {
  created = [];
  const api = activate(context()), restored = panel();
  await serializer.deserializeWebviewPanel(restored, { context: 'production', namespace: 'payments', kind: 'services' });
  assert.equal(created.length, 0);
  assert.equal(api.panels.size, 1);
  assert.equal(restored.clusterContext, 'production');
  assert.equal(restored.clusterNamespace, 'payments');
  assert.equal(restored.iconPath, '/extension/media/jaewon-icon-128.png');
  await restored.listeners.receive({ id: 1, command: 'settings' });
  assert.equal(restored.messages[0].result.initialContext, 'production');
  assert.equal(restored.messages[0].result.restored, true);
  restored.visible = false;
  restored.listeners.visibility();
  assert.deepEqual(restored.messages.at(-1), { event: 'visibility', visible: false });
  restored.dispose();
  assert.equal(api.panels.size, 0);
});

test('fresh panels advertise visibility and reuse an existing context tab', async () => {
  created = [];
  const api = activate(context());
  await api.open('dev');
  await api.open('dev');
  assert.equal(created.length, 1);
  await created[0].listeners.receive({ id: 2, command: 'settings' });
  assert.equal(created[0].messages[0].result.restored, false);
  assert.equal(created[0].messages[0].result.visible, true);
  await api.open('dev', true);
  assert.equal(created.length, 2);
});

test('connection selection updates panel settings before reinitialization without an obsolete refresh', async () => {
  created = []; const api = activate(context()); await api.open('dev'); const p = created[0];
  await p.listeners.receive({ id: 3, command: 'connect' });
  assert.equal(p.clusterContext, 'remote-abc');
  assert.ok(!p.messages.some(message => message.event === 'refresh'));
  await p.listeners.receive({ id: 4, command: 'settings' });
  assert.equal(p.messages.at(-1).result.initialContext, 'remote-abc');
});
