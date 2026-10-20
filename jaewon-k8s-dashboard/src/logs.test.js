'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const load = Module._load;
Module._load = function (name, ...rest) { if (name === 'vscode') return {}; return load.call(this, name, ...rest); };
const { Logs, selectorFor } = require('./logs');
Module._load = load;
test('workload selectors retain set expressions', () => {
  assert.equal(selectorFor({ spec: { selector: { matchLabels: { app: 'web' }, matchExpressions: [{ key: 'tier', operator: 'In', values: ['front', 'edge'] }, { key: 'retired', operator: 'DoesNotExist' }] } } }), 'app=web,tier in (front,edge),!retired');
});
test('service selectors and missing selectors', () => {
  assert.equal(selectorFor({ spec: { selector: { app: 'web' } } }), 'app=web');
  assert.equal(selectorFor({ spec: {} }), '');
});
test('closing a panel during lookup cannot start a stream', async () => {
  let resolve;
  const backend = { scope: () => [], run: () => new Promise(done => { resolve = done; }), spawn: () => { throw new Error('must not start'); } };
  const logs = new Logs({}, backend);
  const session = { target: { kind: 'pods', name: 'app' }, generation: 0, closed: false, refreshing: false };
  const pending = logs.refresh(session);
  session.closed = true;
  resolve(JSON.stringify({ kind: 'Pod' }));
  await pending;
  assert.equal(session.refreshing, false);
});
test('an obsolete option generation cannot create streams', async () => {
  let resolve;
  const backend = { scope: () => [], run: () => new Promise(done => { resolve = done; }), spawn: () => { throw new Error('must not start'); } };
  const logs = new Logs({}, backend);
  const session = { target: { kind: 'pods', name: 'app' }, generation: 0, closed: false, refreshing: false };
  const pending = logs.refresh(session);
  session.generation++;
  resolve(JSON.stringify({ kind: 'Pod' }));
  await pending;
  assert.equal(session.refreshing, false);
});
