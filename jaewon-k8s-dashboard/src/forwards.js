'use strict';
const vscode = require('vscode');
const { randomUUID } = require('node:crypto');

class Forwards {
  constructor(context, backend, changed = () => {}) {
    this.context = context; this.backend = backend; this.changed = changed; this.entries = new Map(); this.closed = false;
    for (const saved of context.globalState.get('savedForwards', [])) {
      const entry = { ...saved, status: 'stopped', wanted: false, process: undefined, timer: undefined, attempt: 0 };
      this.entries.set(entry.id, entry);
      if (backend.config('autoStartPortForwards', true) && entry.autoStart) {
        if (backend.connections) {
          entry.wanted = true;
          void backend.connections.ready.then(() => { if (!this.closed && entry.wanted && this.entries.has(entry.id)) this.start(entry.id); }).catch(error => { entry.status = 'stopped'; entry.error = error.message; this.changed(); });
        }
        else this.start(entry.id);
      }
    }
  }
  list() { return [...this.entries.values()].map(({ process, timer, wanted, attempt, ...e }) => e); }
  persist() { return this.context.globalState.update('savedForwards', this.list().filter(e => e.saved)); }
  async add({ context, namespace, kind, name }) {
    if (!['pods', 'services', 'deployments', 'statefulsets', 'pod', 'service', 'deployment', 'statefulset'].includes(kind)) throw Error('Port forwarding supports Pods, Services, Deployments and StatefulSets.');
    const obj = JSON.parse(await this.backend.run(context, ['get', kind, name, '-n', namespace, '-o', 'json']));
    const spec = obj.spec || {};
    if (obj.kind === 'Service' && !Object.keys(spec.selector || {}).length) throw Error('This Service has no selector. Forward a selected Pod instead.');
    const ports = (spec.ports || spec.template?.spec?.containers?.flatMap(c => c.ports || []) || spec.containers?.flatMap(c => c.ports || []) || [])
      .filter(p => !p.protocol || p.protocol === 'TCP').map(p => String(p.port || p.containerPort));
    let remotePort = await vscode.window.showInputBox({ title: 'Remote TCP port', value: ports[0] || '8080', prompt: ports.length ? `Declared ports: ${ports.join(', ')}` : 'Enter the remote port', validateInput: portError });
    if (remotePort === undefined) return;
    const local = await vscode.window.showInputBox({ title: 'Local port', value: remotePort, prompt: 'Enter auto for an available port', validateInput: v => v === 'auto' ? null : portError(v) });
    if (local === undefined) return;
    const e = { id: randomUUID(), context, namespace, kind, name, localPort: local === 'auto' ? 0 : Number(local), requestedLocalPort: local === 'auto' ? 0 : Number(local), remotePort: Number(remotePort), status: 'stopped', saved: false, autoStart: false, wanted: false, attempt: 0 };
    this.entries.set(e.id, e); this.start(e.id); return this.list().find(f => f.id === e.id);
  }
  start(id) {
    const e = this.entries.get(id); if (!e || this.closed || e.process) return;
    clearTimeout(e.timer); e.wanted = true; e.status = 'connecting'; this.changed();
    let child;
    try { child = this.backend.spawn(e.context, ['port-forward', `${e.kind}/${e.name}`, `${e.requestedLocalPort || ''}:${e.remotePort}`, '-n', e.namespace, '--address=127.0.0.1']); }
    catch (error) { e.status = 'stopped'; e.wanted = false; e.error = error.message; this.changed(); return; }
    e.process = child; let output = ''; let finished = false;
    const data = chunk => {
      output = (output + String(chunk)).slice(-4000);
      const match = output.match(/Forwarding from 127\.0\.0\.1:(\d+)/);
      if (match) { e.localPort = Number(match[1]); e.status = 'running'; e.attempt = 0; e.error = ''; this.changed(); }
    };
    child.stdout?.on('data', data); child.stderr?.on('data', data);
    const end = err => {
      if (finished) return; finished = true; if (e.process !== child) return; e.process = undefined;
      if (!e.wanted || this.closed) { e.status = 'stopped'; this.changed(); return; }
      e.error = err?.message || output.trim(); e.status = 'reconnecting'; this.changed();
      e.timer = setTimeout(() => this.start(id), Math.min(30000, 1000 * 2 ** Math.min(e.attempt++, 5)));
    };
    child.once('error', end); child.once('exit', () => end());
  }
  stop(id) { const e = this.entries.get(id); if (!e) return; e.wanted = false; clearTimeout(e.timer); const child = e.process; e.process = undefined; child?.kill(); e.status = 'stopped'; this.changed(); }
  async action(id, action) {
    const e = this.entries.get(id); if (!e) throw Error('Forward no longer exists.');
    if (action === 'start') this.start(id);
    else if (action === 'stop') this.stop(id);
    else if (action === 'open') {
      if (e.status !== 'running') throw Error('Start the forward before opening it.');
      await vscode.env.openExternal(vscode.Uri.parse(`http://127.0.0.1:${e.localPort}`));
    } else if (action === 'save') {
      const choice = await vscode.window.showQuickPick(['Save with auto-start', 'Save without auto-start'], { title: 'Save port forward' });
      if (!choice) return; e.saved = true; e.autoStart = choice === 'Save with auto-start'; await this.persist(); this.changed();
    } else if (action === 'forget') { this.stop(id); this.entries.delete(id); await this.persist(); this.changed(); }
    else throw Error('Unknown forward action.');
    return this.list();
  }
  dispose() { this.closed = true; for (const id of this.entries.keys()) this.stop(id); }
}
function portError(value) { return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535 ? null : 'Enter a port between 1 and 65535.'; }
module.exports = { Forwards, portError };
