(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.JaewonResourceModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const list = value => Array.isArray(value) ? value : [];
  const initSpecs = pod => list(pod?.spec?.initContainers);
  const initStatuses = pod => list(pod?.status?.initContainerStatuses);
  const containers = pod => list(pod?.status?.containerStatuses);
  const sidecars = pod => initStatuses(pod).filter(status =>
    initSpecs(pod).some(spec => spec.name === status.name && spec.restartPolicy === 'Always'));

  function stoppedReason(state) {
    if (state?.waiting) return state.waiting.reason || 'Waiting';
    if (state?.terminated) {
      const end = state.terminated;
      return end.reason || (end.signal ? `Signal:${end.signal}` : end.exitCode === 0 ? 'Completed' : `ExitCode:${end.exitCode}`);
    }
    return '';
  }

  function podStatus(pod) {
    const status = pod?.status || {};
    if (pod?.metadata?.deletionTimestamp) return status.reason === 'NodeLost' ? 'Unknown' : 'Terminating';
    const specs = initSpecs(pod);
    const states = initStatuses(pod);
    for (let index = 0; index < specs.length; index++) {
      const spec = specs[index];
      const current = states.find(entry => entry.name === spec.name);
      if (spec.restartPolicy === 'Always' && current?.started) continue;
      if (spec.restartPolicy !== 'Always' && current?.state?.terminated?.exitCode === 0) continue;
      const reason = stoppedReason(current?.state);
      if (reason && reason !== 'PodInitializing' && reason !== 'Completed') return `Init:${reason}`;
      return `Init:${index}/${specs.length}`;
    }
    if (status.phase === 'Succeeded') return 'Completed';
    const active = containers(pod).concat(sidecars(pod));
    const waiting = active.find(entry => entry.state?.waiting);
    if (waiting) return stoppedReason(waiting.state);
    const failed = active.find(entry => entry.state?.terminated && entry.state.terminated.exitCode !== 0);
    if (failed) return stoppedReason(failed.state);
    if (status.reason) return status.reason;
    if (active.length && active.every(entry => entry.state?.terminated?.exitCode === 0)) return 'Completed';
    return status.phase || 'Unknown';
  }

  function podRestarts(pod) {
    // Ordinary init containers can restart too; include each status exactly once.
    return containers(pod).concat(initStatuses(pod)).reduce((sum, entry) =>
      sum + (Number.isFinite(entry.restartCount) && entry.restartCount > 0 ? entry.restartCount : 0), 0);
  }

  function podReady(pod) {
    const specs = list(pod?.spec?.containers).concat(initSpecs(pod).filter(spec => spec.restartPolicy === 'Always'));
    const states = containers(pod).concat(sidecars(pod));
    const total = specs.length || states.length;
    const ready = specs.length ? specs.filter(spec => states.some(entry => entry.name === spec.name && entry.ready)).length : states.filter(entry => entry.ready).length;
    return `${ready}/${total}`;
  }

  function podNeedsAttention(pod) {
    const status = podStatus(pod);
    if (status === 'Completed') return false;
    if (status !== 'Running') return true;
    const ready = podReady(pod).split('/').map(Number);
    const condition = list(pod?.status?.conditions).find(entry => entry.type === 'Ready');
    return ready[1] === 0 || ready[0] !== ready[1] || Boolean(condition && condition.status !== 'True');
  }

  return { podStatus, podRestarts, podReady, podNeedsAttention };
});
