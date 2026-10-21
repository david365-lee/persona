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
  function storageClassSummary(resource) {
    const annotations = resource.metadata?.annotations || {};
    return { name: resource.metadata?.name || '', status: annotations['storageclass.kubernetes.io/is-default-class'] === 'true' || annotations['storageclass.beta.kubernetes.io/is-default-class'] === 'true' ? 'Yes' : 'No', provisioner: resource.provisioner || '-', reclaimPolicy: resource.reclaimPolicy || 'Delete', bindingMode: resource.volumeBindingMode || 'Immediate', expansion: resource.allowVolumeExpansion === true ? 'Allowed' : 'Disabled' };
  }
  function storageHtml(resource) {
    if (resource.kind === 'StorageClass') {
      const summary = storageClassSummary(resource);
      return '<h3>StorageClass configuration</h3><dl>' + Object.entries(summary).filter(([key]) => key !== 'name').map(([key, value]) => `<dt>${escape(key)}</dt><dd>${escape(value)}</dd>`).join('') + '</dl><h3>Parameters / topology / mount options</h3><pre>' + escape(JSON.stringify({ parameters: resource.parameters || {}, allowedTopologies: resource.allowedTopologies || [], mountOptions: resource.mountOptions || [] }, null, 2)) + '</pre>';
    }
    if (['PersistentVolume', 'PersistentVolumeClaim'].includes(resource.kind)) return '<h3>Storage</h3><pre>' + escape(JSON.stringify({ storageClassName: resource.spec?.storageClassName ?? '(default)', capacity: resource.status?.capacity || resource.spec?.capacity, requested: resource.spec?.resources?.requests?.storage, accessModes: resource.spec?.accessModes, volumeName: resource.spec?.volumeName, claimRef: resource.spec?.claimRef, reclaimPolicy: resource.spec?.persistentVolumeReclaimPolicy, csi: resource.spec?.csi }, null, 2)) + '</pre>';
    return '';
  }
  return { containersHtml, storageClassSummary, storageHtml };
});
