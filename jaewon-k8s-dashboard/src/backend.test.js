'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
const settings = { kubeconfig: 'C:\\config with spaces\\kube', kubectlPath: 'kubectl' };
let confirmation;
let picks = [], terminalOptions, pickResponses = [];
Module._load = function (name, ...rest) {
  if (name === 'vscode') return {
    workspace: { getConfiguration: () => ({ get: (key, fallback) => settings[key] ?? fallback }) },
    window: { showWarningMessage: async () => confirmation, showQuickPick: async items => { picks.push(items); return pickResponses.shift(); }, createTerminal: options => { terminalOptions = options; return { show() {} }; } }
  };
  return originalLoad.call(this, name, ...rest);
};
const { Backend } = require('./backend');
Module._load = originalLoad;
const backend = () => new Backend({ subscriptions: [] });

test('explicit context and kubeconfig stay separate arguments', () => {
  const b = backend();
  assert.deepEqual(b.args('prod ; echo unsafe', ['get', 'pods'], 'kubectl'), ['--kubeconfig', settings.kubeconfig, '--context', 'prod ; echo unsafe', 'get', 'pods']);
  assert.deepEqual(b.args('prod', ['list'], 'helm'), ['--kubeconfig', settings.kubeconfig, '--kube-context', 'prod', 'list']);
});
test('context inventory identifies current context', async () => {
  const b = backend();
  b.run = async () => JSON.stringify({ 'current-context': 'dev', contexts: [{ name: 'dev', context: { cluster: 'cluster1', user: 'user1' } }] });
  assert.deepEqual(await b.contexts(), [{ name: 'dev', cluster: 'cluster1', user: 'user1', current: true }]);
});
test('cancelled deletion never invokes kubectl', async () => {
  const b = backend();
  confirmation = undefined;
  b.run = async () => { throw new Error('must not execute'); };
  assert.deepEqual(await b.action('prod', 'default', 'pods', 'app', 'delete'), { cancelled: true });
});
test('scale rejects injected and invalid counts', async () => {
  const b = backend();
  b.run = async () => { throw new Error('must not execute'); };
  await assert.rejects(b.action('prod', 'default', 'deployment', 'app', 'scale', { replicas: '1; delete pods' }), /Invalid replica/);
});
test('resource details tolerate unavailable events', async () => {
  const b = backend();
  b.run = async (_, args) => {
    if (args[1] === 'events') throw new Error('Forbidden');
    return JSON.stringify({ metadata: { uid: 'u1' }, kind: 'Pod' });
  };
  assert.deepEqual(await b.detail('dev', 'default', 'pods', 'app'), { resource: { metadata: { uid: 'u1' }, kind: 'Pod' }, events: [] });
});

test('workload shells preserve expressions and only offer running non-terminating pods', async () => {
  const b = backend(); const calls = []; picks = []; terminalOptions = undefined; pickResponses = ['ready'];
  const running = { metadata: { name: 'ready' }, status: { phase: 'Running' }, spec: { containers: [{ name: 'app' }] } };
  b.run = async (_, args) => {
    calls.push(args);
    if (args[1] === 'deployment') return JSON.stringify({ spec: { selector: { matchExpressions: [{ key: 'tier', operator: 'In', values: ['api', 'worker'] }] } } });
    if (args[1] === 'pods') return JSON.stringify({ items: [running, { metadata: { name: 'pending' }, status: { phase: 'Pending' } }, { metadata: { name: 'deleting', deletionTimestamp: 'now' }, status: { phase: 'Running' } }] });
    return JSON.stringify(running);
  };
  assert.deepEqual(await b.action('dev', 'apps', 'deployment', 'api', 'shell'), { message: 'Terminal opened' });
  assert.deepEqual(picks, [['ready']]);
  assert.deepEqual(calls[1], ['get', 'pods', '--namespace', 'apps', '-l', 'tier in (api,worker)', '-o', 'json']);
  assert.ok(terminalOptions.shellArgs.includes('ready'));
  assert.ok(terminalOptions.shellArgs.includes('app'));
});
test('workload shells reject missing selectors without querying every pod', async () => {
  const b = backend(); let calls = 0;
  b.run = async () => { calls++; return JSON.stringify({ spec: {} }); };
  await assert.rejects(b.action('dev', 'apps', 'deployment', 'api', 'shell'), /no pod selector/);
  assert.equal(calls, 1);
});
test('shell explains when matching pods are not running', async () => {
  const b = backend();
  b.run = async (_, args) => JSON.stringify(args[1] === 'deployment' ? { spec: { selector: { app: 'api' } } } : { items: [{ metadata: { name: 'done' }, status: { phase: 'Succeeded' } }] });
  await assert.rejects(b.action('dev', 'apps', 'deployment', 'api', 'exec'), /No running pods/);
});
test('direct shell rejects terminating pods even with an explicit container', async () => {
  const b = backend();
  b.run = async () => JSON.stringify({ metadata: { deletionTimestamp: 'now' }, status: { phase: 'Running' } });
  await assert.rejects(b.action('dev', 'apps', 'pods', 'api', 'shell', { container: 'app' }), /not terminating/);
});

test('health report separates healthy restart history from current failures and catches unready pods', async () => {
  const b = backend();
  b.run = async (_, args) => JSON.stringify({ items: args[1] === 'pods' ? [
    { metadata: { name: 'recovered', namespace: 'apps' }, spec: { containers: [{ name: 'app' }] }, status: { phase: 'Running', containerStatuses: [{ name: 'app', ready: true, restartCount: 1, state: { running: {} }, lastState: { terminated: { reason: 'OOMKilled' } } }] } },
    { metadata: { name: 'unready' }, spec: { containers: [{ name: 'app' }] }, status: { phase: 'Running', containerStatuses: [{ name: 'app', ready: false, state: { running: {} } }] } }
  ] : [] });
  const report = await b.health('dev');
  assert.match(report, /recovered: Running; ready=1\/1; restarts=1 \(restart history; currently healthy\)/);
  assert.match(report, /unready: Running; ready=0\/1/);
  assert.doesNotMatch(report, /OOMKilled/);
});

test('resource events are ordered by timestamp rather than API response order', async () => {
  const b = backend();
  b.run = async (_, args) => JSON.stringify(args[1] === 'events' ? { items: [
    { reason: 'new', eventTime: '2026-10-20T12:02:00Z' },
    { reason: 'old', lastTimestamp: '2026-10-20T12:00:00Z' },
    { reason: 'middle', series: { lastObservedTime: '2026-10-20T12:01:00Z' } }
  ] } : { metadata: { uid: 'id' } });
  assert.deepEqual((await b.detail('dev', 'apps', 'pods', 'app')).events.map(e => e.reason), ['old', 'middle', 'new']);
});
