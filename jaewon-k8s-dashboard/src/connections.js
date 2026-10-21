'use strict';
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);

function serverAddress(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return 'Enter an HTTPS API server address without credentials, query or fragment.';
  } catch (_) { return 'Enter a valid HTTPS API server address, e.g. https://cluster.example.com:6443'; }
}
function kubeconfig(id, server, credentials, ca) {
  const error = serverAddress(server); if (error) throw new Error(error);
  if (!credentials.token && !(credentials['client-certificate-data'] && credentials['client-key-data'])) throw new Error('A token or client certificate and private key are required.');
  return { apiVersion: 'v1', kind: 'Config', clusters: [{ name: id, cluster: { server, ...(ca ? { 'certificate-authority-data': ca } : {}) } }], users: [{ name: id, user: credentials }], contexts: [{ name: id, context: { cluster: id, user: id } }], 'current-context': id };
}

// Credentials persist only in VS Code SecretStorage. kubectl/Helm need a restricted
// session file; it is never placed in the workspace or the user's default config.
class Connections {
  constructor(context) {
    this.context = context; this.files = new Map(); this.profiles = [];
    const saved = context.globalState?.get('remoteConnections.v1', []);
    if (Array.isArray(saved)) this.profiles = saved;
    this.ready = this.restore();
    this.ready.catch(() => {}); // Surface failures through commands instead of an unhandled rejection.
    context.subscriptions.push({ dispose: () => { void this.dispose(); } });
  }
  async directory() {
    if (!this.dirPromise) this.dirPromise = (async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jaewon-k8s-auth-'));
      await fs.chmod(dir, 0o700);
      if (process.platform === 'win32') {
        const { stdout } = await execFile('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { windowsHide: true });
        const sid = stdout.match(/S-1-\d+(?:-\d+)+/)?.[0];
        if (!sid) throw new Error('Cannot determine Windows user for credential file permissions.');
        await execFile('icacls.exe', [dir, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true });
      }
      this.dir = dir;
      return dir;
    })();
    return this.dirPromise;
  }
  async materialize(id, text) {
    const file = path.join(await this.directory(), `${id}.json`);
    await fs.writeFile(file, text, { mode: 0o600, flag: 'wx' });
    this.files.set(id, file);
  }
  async restore() {
    for (const profile of this.profiles) {
      if (!/^remote-[a-f0-9-]+$/.test(profile.id)) continue;
      try {
        const text = await this.context.secrets?.get(`connection.${profile.id}`);
        if (text) await this.materialize(profile.id, text);
      } catch (_) { /* Keep local contexts usable when an individual remote secret is unavailable. */ }
    }
  }
  async add(name, server, credentials, ca) {
    await this.ready;
    const id = `remote-${randomUUID()}`, text = JSON.stringify(kubeconfig(id, server, credentials, ca));
    await this.context.secrets.store(`connection.${id}`, text);
    try {
      await this.materialize(id, text);
      const profile = { id, name, server };
      await this.context.globalState.update('remoteConnections.v1', [...this.profiles, profile]);
      this.profiles.push(profile);
      return id;
    } catch (error) {
      await this.context.secrets.delete(`connection.${id}`);
      const file = this.files.get(id); if (file) await fs.unlink(file).catch(() => {});
      this.files.delete(id); throw error;
    }
  }
  async remove(id) {
    await this.ready;
    await this.context.globalState.update('remoteConnections.v1', this.profiles.filter(p => p.id !== id));
    this.profiles = this.profiles.filter(p => p.id !== id);
    await this.context.secrets.delete(`connection.${id}`);
    const file = this.files.get(id); if (file) await fs.unlink(file).catch(() => {});
    this.files.delete(id);
  }
  file(id) {
    if (/^remote-[a-f0-9-]+$/.test(id || '') && !this.files.has(id)) throw new Error('Remote credentials unavailable. Remove and reconnect this profile.');
    return this.files.get(id);
  }
  async dispose() { await this.ready.catch(() => {}); if (this.dir) await fs.rm(this.dir, { recursive: true, force: true }); }
}
module.exports = { Connections, serverAddress, kubeconfig };
