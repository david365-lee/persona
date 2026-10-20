'use strict';
const vscode = require('vscode');
const { html } = require('./webview');
const { selectorFor } = require('./selectors');
class Logs {
  constructor(extensionContext, backend) { this.extensionContext = extensionContext; this.backend = backend; this.sessions = new Set(); }
  dispose() { for (const session of [...this.sessions]) session.panel.dispose(); }
  async open(target) {
    const panel = vscode.window.createWebviewPanel('jaewonK8s.logs', `Logs: ${target.context}/${target.namespace}/${target.name}`, vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionContext.extensionUri, 'media')] });
    const session = { panel, target, generation: 0, streams: new Map(), cursors: new Map(), boundaries: new Map(), completed: new Set(), previous: false, disabledPods: new Set(), disabledContainers: new Set(), closed: false, refreshing: false };
    this.sessions.add(session);
    panel.webview.html = html(panel.webview, this.extensionContext.extensionUri, 'logs.js', 'logs.css');
    panel.onDidDispose(() => { session.closed = true; clearInterval(session.timer); for (const child of session.streams.values()) child.kill(); this.sessions.delete(session); });
    panel.webview.onDidReceiveMessage(async message => {
      try {
        if (message.command === 'ready') { panel.webview.postMessage({ type: 'settings', maxLines: this.backend.config('logMaxLines', 5000), target }); await this.refresh(session); if (!session.closed && !session.timer) session.timer = setInterval(() => this.refresh(session), 5000); }
        if (message.command === 'options') {
          session.generation++;
          if (session.previous !== !!message.previous) { session.cursors.clear(); session.boundaries.clear(); session.completed.clear(); }
          session.previous = !!message.previous;
          session.disabledPods = new Set(message.disabledPods || []); session.disabledContainers = new Set(message.disabledContainers || []);
          for (const child of session.streams.values()) child.kill(); session.streams.clear(); await this.refresh(session);
        }
        if (message.command === 'copy') await vscode.env.clipboard.writeText(String(message.text || ''));
        if (message.command === 'editor') await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ content: String(message.text || ''), language: 'log' }));
        if (message.command === 'save') { const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(`${target.name}.log`), filters: { Logs: ['log', 'txt'] } }); if (uri) await vscode.workspace.fs.writeFile(uri, Buffer.from(String(message.text || ''))); }
      } catch (error) { panel.webview.postMessage({ type: 'error', text: error.message }); }
    });
    return { message: 'Logs opened' };
  }
  async refresh(session) {
    if (session.closed) return;
    if (session.refreshing) { session.refreshAgain = true; return; }
    session.refreshing = true;
    const generation = session.generation;
    const valid = () => !session.closed && generation === session.generation;
    const { target } = session;
    try {
      const scope = this.backend.scope(target.namespace);
      const resource = JSON.parse(await this.backend.run(target.context, ['get', target.kind, target.name, ...scope, '-o', 'json']));
      if (!valid()) return;
      let pods;
      if (resource.kind === 'Pod') pods = [resource];
      else if (resource.kind === 'CronJob') {
        const jobs = JSON.parse(await this.backend.run(target.context, ['get', 'jobs', ...scope, '-o', 'json'])).items || [];
        if (!valid()) return;
        const owned = new Set(jobs.filter(job => (job.metadata.ownerReferences || []).some(owner => owner.uid === resource.metadata.uid)).map(job => job.metadata.uid));
        const candidates = JSON.parse(await this.backend.run(target.context, ['get', 'pods', ...scope, '-o', 'json'])).items || [];
        pods = candidates.filter(pod => (pod.metadata.ownerReferences || []).some(owner => owned.has(owner.uid)));
      }
      else {
        const selector = selectorFor(resource);
        if (!selector) throw new Error('This resource has no pod selector. Open logs from a Pod or a workload with a selector.');
        pods = JSON.parse(await this.backend.run(target.context, ['get', 'pods', ...scope, '-l', selector, '-o', 'json'])).items || [];
      }
      if (!valid()) return;
      const available = [];
      const desired = new Set();
      for (const pod of pods) {
        const podName = pod.metadata.name, namespace = pod.metadata.namespace || target.namespace;
        for (const container of [...(pod.spec.initContainers || []), ...(pod.spec.containers || []), ...(pod.spec.ephemeralContainers || [])]) {
          const key = `${namespace}/${podName}/${container.name}`;
          available.push({ key, pod: podName, container: container.name });
          if (session.disabledPods.has(podName) || session.disabledContainers.has(container.name)) continue;
          desired.add(key);
          if (session.streams.has(key) || session.completed.has(key)) continue;
          const args = ['logs', podName, '-n', namespace, '-c', container.name, '--timestamps=true'];
          if (session.cursors.has(key) && !session.previous) args.push(`--since-time=${session.cursors.get(key)}`);
          else args.push(`--tail=${this.backend.config('logTailLines', 300)}`);
          if (session.previous) args.push('--previous'); else args.push('--follow');
          const child = this.backend.spawn(target.context, args);
          session.streams.set(key, child);
          let pending = '';
          const replay = new Map();
          if (!session.previous) for (const line of session.boundaries.get(key) || []) replay.set(line, (replay.get(line) || 0) + 1);
          const emit = lines => {
            if (!valid() || session.streams.get(key) !== child) return;
            const fresh = [];
            for (const line of lines) {
              if (replay.get(line)) { replay.set(line, replay.get(line) - 1); continue; }
              const timestamp = line.split(' ')[0];
              if (/^\d{4}-/.test(timestamp)) {
                if (session.cursors.get(key) !== timestamp) { session.cursors.set(key, timestamp); session.boundaries.set(key, []); }
                const boundary = session.boundaries.get(key) || []; boundary.push(line); session.boundaries.set(key, boundary.slice(-5000));
              }
              fresh.push(line);
            }
            if (fresh.length) session.panel.webview.postMessage({ type: 'lines', source: key, lines: fresh });
          };
          child.stdout.on('data', data => { pending += data.toString(); const lines = pending.split(/\r?\n/); pending = lines.pop(); emit(lines); });
          child.stderr.on('data', data => { if (valid()) session.panel.webview.postMessage({ type: 'status', source: key, text: data.toString() }); });
          child.on('error', error => { if (valid()) session.panel.webview.postMessage({ type: 'error', text: error.message }); if (session.streams.get(key) === child) session.streams.delete(key); });
          child.on('close', code => { if (pending) emit([pending]); if (session.streams.get(key) === child) { session.streams.delete(key); if (session.previous && code === 0 && valid()) session.completed.add(key); } });
        }
      }
      for (const [key, child] of session.streams) if (!desired.has(key)) { child.kill(); session.streams.delete(key); }
      session.panel.webview.postMessage({ type: 'sources', sources: available });
    } catch (error) { if (!session.closed) session.panel.webview.postMessage({ type: 'error', text: error.message }); }
    finally { session.refreshing = false; if (session.refreshAgain && !session.closed) { session.refreshAgain = false; void this.refresh(session); } }
  }
}
module.exports = { Logs, selectorFor };
