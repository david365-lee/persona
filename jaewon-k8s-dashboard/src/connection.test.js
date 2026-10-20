'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function dashboard(failCommand) {
  const elements = new Map(), calls = [], listeners = {};
  let fail = true;
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, { value: '', innerHTML: '', dataset: {}, classList: { add() {}, remove() {}, toggle() {} } });
    return elements.get(selector);
  };
  const document = { hidden: false, body: { dataset: {} }, querySelector: element, querySelectorAll: () => [], addEventListener() {} };
  const sandbox = {
    document, window: { addEventListener: (event, fn) => { listeners[event] = fn; } },
    JaewonResourceModel: require('../media/resource-model'),
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    acquireVsCodeApi: () => ({ getState: () => ({ context: 'dev' }), setState() {}, postMessage(message) {
      calls.push(message);
      const error = fail && message.command === failCommand;
      const result = message.command === 'settings' ? { refreshSeconds: 5 } : message.command === 'contexts' ? [{ name: 'dev', current: true }] : message.command === 'namespaces' ? ['default', 'apps'] : [];
      queueMicrotask(() => listeners.message({ data: { id: message.id, ...(error ? { error: 'connection refused' } : { result }) } }));
    } })
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../media/dashboard.js'), 'utf8'), sandbox);
  return { calls, element, recover: () => { fail = false; }, flush: () => new Promise(resolve => setImmediate(resolve)) };
}

for (const command of ['settings', 'contexts', 'namespaces']) {
  test(`Refresh recovers after initial ${command} failure and reloads namespaces`, async () => {
    const ui = dashboard(command);
    await ui.flush();
    assert.equal(ui.calls.filter(c => c.command === 'list').length, 0);
    assert.match(ui.element('#message').textContent, /connection refused/);
    ui.recover();
    await ui.element('#refresh').onclick();
    await ui.flush();
    assert.ok(ui.calls.some(c => c.command === 'namespaces'));
    assert.ok(ui.calls.some(c => c.command === 'list' && c.args.context === 'dev'));
    assert.match(ui.element('#namespace').innerHTML, /apps/);
    assert.match(ui.element('#message').textContent, /Updated/);
  });
}
