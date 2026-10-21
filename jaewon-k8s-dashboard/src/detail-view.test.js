'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { containersHtml } = require('../media/detail-view');
const { storageClassSummary, storageHtml } = require('../media/detail-view');

test('StorageClass summary handles defaults and details escape driver parameters', () => {
  const sc = { kind: 'StorageClass', metadata: { name: 'fast', annotations: { 'storageclass.kubernetes.io/is-default-class': 'true' } }, provisioner: 'example.csi', volumeBindingMode: 'WaitForFirstConsumer', reclaimPolicy: 'Retain', allowVolumeExpansion: true, parameters: { type: '<script>bad</script>' }, mountOptions: ['discard'] };
  assert.deepEqual(storageClassSummary(sc), { name: 'fast', status: 'Yes', provisioner: 'example.csi', bindingMode: 'WaitForFirstConsumer', reclaimPolicy: 'Retain', expansion: 'Allowed' });
  const html = storageHtml(sc); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/); assert.match(html, /discard/);
  assert.equal(storageClassSummary({}).reclaimPolicy, 'Delete');
  assert.match(storageHtml({ kind: 'PersistentVolumeClaim', spec: { storageClassName: 'fast' } }), /fast/);
});

test('container details distinguish current state from previous termination and escape cluster data', () => {
  const html = containersHtml({ kind: 'Pod', spec: { containers: [{ name: '<script>app</script>', image: 'web', resources: { limits: { memory: '128Mi' } } }], initContainers: [{ name: 'proxy', restartPolicy: 'Always' }], ephemeralContainers: [{ name: 'debug' }] }, status: { containerStatuses: [{ name: '<script>app</script>', ready: true, restartCount: 2, state: { running: { startedAt: 'now' } }, lastState: { terminated: { reason: 'OOMKilled', exitCode: 137 } } }], initContainerStatuses: [{ name: 'proxy', ready: true, state: { running: {} } }] } });
  assert.match(html, /&lt;script&gt;app&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  for (const value of ['Running', 'previousTermination', 'OOMKilled', '128Mi', 'Sidecar (restartable init)', 'Ephemeral container', 'Not created']) assert.ok(html.includes(value), value);
});

test('workload and CronJob templates expose container images and resources', () => {
  const spec = { containers: [{ name: 'worker', image: 'worker:v2' }] };
  for (const resource of [{ kind: 'Deployment', spec: { template: { spec } } }, { kind: 'CronJob', spec: { jobTemplate: { spec: { template: { spec } } } } }]) {
    const html = containersHtml(resource);
    assert.match(html, /worker:v2/);
    assert.match(html, /Pod template/);
  }
});
