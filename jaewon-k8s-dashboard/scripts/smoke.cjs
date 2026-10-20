'use strict';
const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  const report = { timestamp: new Date().toISOString(), passed: [], failed: [] };
  try {
    const ext = vscode.extensions.getExtension('jaewon.jaewon-k8s-dashboard'); assert.ok(ext, 'extension discovered');
    const api = await ext.activate(); report.passed.push('Extension activates');
    const commands = await vscode.commands.getCommands(true); for (const id of ['open', 'openNew', 'applyFile', 'health', 'forwardStart']) assert.ok(commands.includes('jaewonK8s.' + id)); report.passed.push('Commands registered');
    const b = api.backend, contexts = await b.contexts(); assert.ok(contexts.some(c => c.name === 'local-rke2')); report.passed.push('Contexts loaded');
    const namespaces = await b.namespaces('local-rke2'); assert.ok(namespaces.includes('kube-system')); report.passed.push('Namespaces loaded');
    for (const kind of ['pods', 'deployments', 'services', 'nodes', 'namespaces', 'events', 'customresourcedefinitions']) { const rows = await b.list('local-rke2', '', kind); assert.ok(Array.isArray(rows)); report.passed.push(`Live ${kind}: ${rows.length}`); }
    const pods = await b.list('local-rke2', 'kube-system', 'pods'); const pod = pods.find(p => p.status.phase === 'Running'); assert.ok(pod);
    const detail = await b.detail('local-rke2', 'kube-system', 'pods', pod.metadata.name); assert.equal(detail.resource.metadata.name, pod.metadata.name); report.passed.push('Resource details and events');
    const metrics = await b.metrics('local-rke2', 'kube-system', 'pods'); assert.ok(metrics.includes(pod.metadata.name)); report.passed.push('Live pod CPU/memory');
    const releases = await b.list('local-rke2', '', 'helm'); assert.ok(Array.isArray(releases)); report.passed.push(`Helm releases: ${releases.length}`);
    const health = await b.health('local-rke2'); assert.ok(health.includes('Pods') && health.includes('Nodes')); report.passed.push('Health report generated');
    await api.open('local-rke2'); assert.equal(api.panels.size, 1); report.passed.push('Dashboard webview created');
    const dashboard = [...api.panels][0];
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { listener.dispose(); reject(Error('Dashboard renderer did not request resources.')); }, 20000);
      const listener = dashboard.webview.onDidReceiveMessage(message => { if (message.command === 'list') { clearTimeout(timeout); listener.dispose(); resolve(); } });
    }); report.passed.push('Dashboard renderer booted and requested live resources');
    await api.open('local-rke2', true); assert.equal(api.panels.size, 2); report.passed.push('Multiple cluster tabs');
    await api.logs.open({ context: 'local-rke2', namespace: 'kube-system', kind: 'pods', name: pod.metadata.name }); assert.equal(api.logs.sessions.size, 1);
    const session = [...api.logs.sessions][0]; await api.logs.refresh(session); assert.ok(session.streams.size > 0); report.passed.push(`Log streams: ${session.streams.size}`);
    const forward = { id: 'smoke', context: 'local-rke2', namespace: 'kube-system', kind: 'services', name: 'rke2-metrics-server', requestedLocalPort: 0, localPort: 0, remotePort: 443, status: 'stopped', wanted: false, attempt: 0 };
    api.forwards.entries.set(forward.id, forward); api.forwards.start(forward.id);
    const until = Date.now() + 15000; while (forward.status !== 'running' && Date.now() < until) await new Promise(r => setTimeout(r, 100));
    assert.equal(forward.status, 'running', forward.error); assert.ok(forward.localPort > 0); api.forwards.stop(forward.id); api.forwards.entries.delete(forward.id); report.passed.push('Live port forwarding starts/stops on auto port');
    api.logs.dispose(); for (const panel of api.panels) panel.dispose();
  } catch (e) { report.failed.push(e.stack || String(e)); }
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'smoke-result.json'), JSON.stringify(report, null, 2));
  if (report.failed.length) throw Error(report.failed.join('\n'));
}
exports.run = run;
