/* Independent resource detail rendering, shared by the webview and unit tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JaewonDetailView = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function containersHtml(resource) {
    const spec = resource.spec?.template?.spec || resource.spec?.jobTemplate?.spec?.template?.spec || resource.spec || {};
    const status = resource.status || {};
    const groups = [['Init container', spec.initContainers, status.initContainerStatuses], ['Container', spec.containers, status.containerStatuses], ['Ephemeral container', spec.ephemeralContainers, status.ephemeralContainerStatuses]];
    const sections = [];
    for (const [type, containers = [], statuses = []] of groups) {
      for (const container of containers) {
        const runtime = statuses.find(s => s.name === container.name);
        const state = runtime?.state || {};
        const fields = { name: container.name, image: container.image, type: container.restartPolicy === 'Always' && type === 'Init container' ? 'Sidecar (restartable init)' : type };
        if (runtime) {
          fields.ready = !!runtime.ready;
          fields.restarts = runtime.restartCount || 0;
          if (state.running) fields.state = { status: 'Running', ...state.running };
          else if (state.waiting) fields.state = { status: 'Waiting', ...state.waiting };
          else if (state.terminated) fields.state = { status: 'Terminated', ...state.terminated };
          else fields.state = { status: 'Unknown' };
          if (runtime.lastState?.terminated) fields.previousTermination = runtime.lastState.terminated;
        } else fields.state = { status: resource.kind === 'Pod' ? 'Not created' : 'Pod template' };
        if (container.ports?.length) fields.ports = container.ports;
        if (container.resources) fields.resources = container.resources;
        sections.push(`<pre>${escape(JSON.stringify(fields, null, 2))}</pre>`);
      }
    }
    return sections.length ? '<h3>Containers</h3>' + sections.join('') : '';
  }
  return { containersHtml };
});
