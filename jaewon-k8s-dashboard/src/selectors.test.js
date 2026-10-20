'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { selectorFor } = require('./selectors');
test('pod selectors combine labels with all supported set operators', () => {
  assert.equal(selectorFor({ spec: { selector: { matchLabels: { app: 'api' }, matchExpressions: [
    { key: 'tier', operator: 'In', values: ['web', 'worker'] },
    { key: 'stage', operator: 'NotIn', values: ['test'] },
    { key: 'managed', operator: 'Exists' },
    { key: 'disabled', operator: 'DoesNotExist' }
  ] } } }), 'app=api,tier in (web,worker),stage notin (test),managed,!disabled');
});
test('service, string and empty selectors remain supported', () => {
  assert.equal(selectorFor({ spec: { selector: { app: 'api' } } }), 'app=api');
  assert.equal(selectorFor({ spec: { selector: ' app=api ' } }), 'app=api');
  for (const resource of [{}, { spec: {} }, { spec: { selector: {} } }, { spec: { selector: { matchLabels: {}, matchExpressions: [] } } }]) assert.equal(selectorFor(resource), '');
});
test('unknown selector operators fail instead of widening pod selection', () => {
  assert.throws(() => selectorFor({ spec: { selector: { matchExpressions: [{ key: 'app', operator: 'FutureOperator' }] } } }), /Unsupported pod selector operator/);
});
