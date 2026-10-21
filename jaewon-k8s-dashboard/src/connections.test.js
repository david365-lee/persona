'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { Connections, serverAddress, kubeconfig } = require('./connections');

test('remote configuration validates TLS address and supports token and certificate credentials', () => {
  for (const url of ['http://api:6443', 'https://user:password@api', 'https://api?token=secret', 'not a url']) assert.ok(serverAddress(url));
  assert.equal(serverAddress('https://api.example:6443'), undefined);
  const config = kubeconfig('remote-test', 'https://api:6443', { token: 'secret' }, 'ca-base64');
  assert.equal(config.clusters[0].cluster['certificate-authority-data'], 'ca-base64');
  assert.equal(config.clusters[0].cluster['insecure-skip-tls-verify'], undefined);
  assert.equal(config.users[0].user.token, 'secret');
  assert.equal(config['current-context'], 'remote-test');
  assert.throws(() => kubeconfig('id', 'https://api', {}), /required/);
  assert.ok(kubeconfig('id', 'https://api', { 'client-certificate-data': 'cert', 'client-key-data': 'key' }));
});

test('remote secrets are isolated from settings, restored, removed and session files cleaned', async () => {
  const secrets = new Map(), state = new Map();
  const context = () => ({ subscriptions: [], secrets: { get: async k => secrets.get(k), store: async (k, v) => secrets.set(k, v), delete: async k => secrets.delete(k) }, globalState: { get: (k, fallback) => state.get(k) ?? fallback, update: async (k, v) => state.set(k, v) } });
  const first = new Connections(context()); let second;
  try {
    const id = await first.add('Production', 'https://api.example:6443', { token: 'private-token' });
    assert.doesNotMatch(JSON.stringify([...state.values()]), /private-token/);
    assert.equal(JSON.parse(await fs.readFile(first.file(id), 'utf8')).users[0].user.token, 'private-token');
    second = new Connections(context()); await second.ready;
    assert.notEqual(second.file(id), first.file(id));
    await second.remove(id);
    assert.equal(secrets.size, 0);
    assert.throws(() => second.file(id), /unavailable/);
    const file = first.file(id); await first.dispose();
    await assert.rejects(fs.access(file));
  } finally { await first.dispose(); if (second) await second.dispose(); }
});
