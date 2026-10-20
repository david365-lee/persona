const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { podStatus, podRestarts, podReady, podNeedsAttention } = require('../media/resource-model');

function healthy() {
  return { spec: { containers: [{ name: 'app' }] }, status: { phase: 'Running', containerStatuses: [
    { name: 'app', ready: true, restartCount: 2, state: { running: {} }, lastState: { terminated: { reason: 'OOMKilled', exitCode: 137 } } }
  ] } };
}

test('recovered OOM remains Running while preserving restart history', () => {
  const pod = healthy();
  assert.equal(podStatus(pod), 'Running');
  assert.equal(podRestarts(pod), 2);
  assert.equal(podReady(pod), '1/1');
  assert.equal(podNeedsAttention(pod), false);
});

test('current failures are distinguished from historic failures', () => {
  const pod = healthy();
  pod.status.containerStatuses[0].state = { waiting: { reason: 'CrashLoopBackOff' } };
  assert.equal(podStatus(pod), 'CrashLoopBackOff');
  assert.equal(podNeedsAttention(pod), true);
  pod.status.containerStatuses[0].state = { terminated: { reason: 'OOMKilled', exitCode: 137 } };
  assert.equal(podStatus(pod), 'OOMKilled');
});

test('sequential init reports progress and failure', () => {
  const pod = healthy();
  pod.spec.initContainers = [{ name: 'first' }, { name: 'second' }];
  pod.status.initContainerStatuses = [{ name: 'first', state: { terminated: { exitCode: 0 } } }];
  assert.equal(podStatus(pod), 'Init:1/2');
  pod.status.initContainerStatuses.push({ name: 'second', restartCount: 3, state: { waiting: { reason: 'CrashLoopBackOff' } } });
  assert.equal(podStatus(pod), 'Init:CrashLoopBackOff');
  assert.equal(podRestarts(pod), 5);
});

test('started restartable init sidecar permits startup and participates in readiness', () => {
  const pod = healthy();
  pod.spec.initContainers = [{ name: 'proxy', restartPolicy: 'Always' }];
  pod.status.initContainerStatuses = [{ name: 'proxy', started: true, ready: false, restartCount: 4, state: { running: {} } }];
  assert.equal(podStatus(pod), 'Running');
  assert.equal(podReady(pod), '1/2');
  assert.equal(podNeedsAttention(pod), true);
  assert.equal(podRestarts(pod), 6);
  pod.status.initContainerStatuses[0].ready = true;
  assert.equal(podNeedsAttention(pod), false);
  pod.status.initContainerStatuses[0].state = { waiting: { reason: 'CrashLoopBackOff' } };
  assert.equal(podStatus(pod), 'CrashLoopBackOff');
});

test('restartable init sidecar must start before later init containers', () => {
  const pod = healthy();
  pod.spec.initContainers = [{ name: 'proxy', restartPolicy: 'Always' }, { name: 'migrate' }];
  pod.status.initContainerStatuses = [{ name: 'proxy', started: false, state: { running: {} } }];
  assert.equal(podStatus(pod), 'Init:0/2');
  pod.status.initContainerStatuses[0].started = true;
  assert.equal(podStatus(pod), 'Init:1/2');
  pod.status.initContainerStatuses.push({ name: 'migrate', state: { terminated: { exitCode: 0 } } });
  assert.equal(podStatus(pod), 'Running');
});

test('unnamed termination reasons retain exit code or signal evidence', () => {
  const pod = healthy();
  pod.status.containerStatuses[0].state = { terminated: { exitCode: 2 } };
  assert.equal(podStatus(pod), 'ExitCode:2');
  pod.status.containerStatuses[0].state = { terminated: { exitCode: 143, signal: 15 } };
  assert.equal(podStatus(pod), 'Signal:15');
});

test('missing regular status counts as unready and readiness gates are respected', () => {
  const pod = healthy();
  pod.spec.containers.push({ name: 'worker' });
  assert.equal(podReady(pod), '1/2');
  assert.equal(podNeedsAttention(pod), true);
  pod.spec.containers.pop();
  pod.status.conditions = [{ type: 'Ready', status: 'False' }];
  assert.equal(podNeedsAttention(pod), true);
});

test('completed jobs and deleting pods have appropriate terminal status', () => {
  const pod = healthy();
  pod.status.phase = 'Succeeded';
  assert.equal(podStatus(pod), 'Completed');
  assert.equal(podNeedsAttention(pod), false);
  pod.metadata = { deletionTimestamp: '2026-10-20T00:00:00Z' };
  assert.equal(podStatus(pod), 'Terminating');
  pod.status.reason = 'NodeLost';
  assert.equal(podStatus(pod), 'Unknown');
});

test('empty input is safe and browser entry exposes the same public functions', () => {
  assert.equal(podStatus(), 'Unknown');
  assert.equal(podReady(), '0/0');
  assert.equal(podRestarts(), 0);
  assert.equal(podNeedsAttention(), true);
  const context = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../media/resource-model'), 'utf8'), context);
  assert.equal(context.JaewonResourceModel.podStatus(healthy()), 'Running');
});
