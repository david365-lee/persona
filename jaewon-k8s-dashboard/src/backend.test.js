'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
const settings = { kubeconfig: 'C:\\config with spaces\\kube', kubectlPath: 'kubectl' };
let confirmation;
Module._load = function (name, ...rest) {
  if (name === 'vscode') return {
    workspace: { getConfiguration: () => ({ get: (key, fallback) => settings[key] ?? fallback }) },
    window: { showWarningMessage: async () => confirmation }
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
