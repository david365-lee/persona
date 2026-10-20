'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const original = Module._load;
Module._load = function(name, ...args) { return name === 'vscode' ? {} : original.call(this, name, ...args); };
const { Forwards, portError } = require('./forwards');
Module._load = original;
function fixture() {
  const children = [];
  const backend = { config: () => false, spawn: () => { const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => {}; children.push(child); return child; } };
  const state = new Map();
  const forwards = new Forwards({ globalState: { get: () => [], update: async (k,v) => state.set(k,v) } }, backend);
  forwards.entries.set('id', { id: 'id', context: 'test', namespace: 'default', kind: 'pods', name: 'app', remotePort: 80, requestedLocalPort: 0, attempt: 0 });
  return { forwards, children, state };
}
test('port validation rejects shell syntax and out of range ports', () => {
  assert.equal(portError('8080'), null);
  for (const p of ['0', '-1', '65536', '80;whoami', 'abc']) assert.equal(typeof portError(p), 'string');
});
test('stale stopped child cannot clobber replacement forward', () => {
  const { forwards, children } = fixture();
  forwards.start('id'); forwards.stop('id'); forwards.start('id');
  children[0].emit('exit', 0); children[1].stdout.emit('data', 'Forwarding from 127.0.0.1:54321 -> 80');
  const entry = forwards.entries.get('id'); assert.equal(entry.process, children[1]); assert.equal(entry.status, 'running'); assert.equal(entry.localPort, 54321);
  forwards.dispose(); assert.equal(entry.wanted, false);
});
