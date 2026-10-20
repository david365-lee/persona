/* Documentation captures of the actual webview using synthetic, local-only fixtures.
 * Requires playwright-core and a Chromium executable; see docs/screenshot-provenance.md.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { chromium } = require(process.env.JAEWON_PLAYWRIGHT_PATH || 'playwright-core');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'media', 'screenshots');
const theme = `:root{--vscode-font-family:system-ui,sans-serif;--vscode-font-size:13px;--vscode-foreground:#dce4ef;--vscode-editor-background:#101720;--vscode-sideBar-background:#141e2a;--vscode-panel-border:#2a3a4c;--vscode-descriptionForeground:#98adc3;--vscode-button-background:#1674c7;--vscode-button-foreground:#fff;--vscode-button-secondaryBackground:#22354a;--vscode-button-secondaryForeground:#e8eff7;--vscode-button-secondaryHoverBackground:#2c4864;--vscode-widget-border:#2a3a4c;--vscode-input-background:#192635;--vscode-input-foreground:#e6eef8;--vscode-input-border:#3a5068;--vscode-focusBorder:#41a9ef;--vscode-list-activeSelectionBackground:#194a73;--vscode-list-activeSelectionForeground:#fff;--vscode-list-inactiveSelectionBackground:#1a3850;--vscode-list-hoverBackground:#1c2b3b;--vscode-badge-background:#245678;--vscode-badge-foreground:#e2f3ff;--vscode-textLink-foreground:#64c7ff;--vscode-textCodeBlock-background:#0a111b;--vscode-editor-font-family:Consolas,monospace;--vscode-editor-font-size:13px;--vscode-errorForeground:#ff8c85;--vscode-editorWarning-foreground:#f2c66d;--vscode-editorInfo-foreground:#72caff;--vscode-editor-findMatchHighlightBackground:#655b24;--vscode-charts-blue:#53baff}body{font-size:13px}`;
let origin;
const load = Module._load;
Module._load = function(name, ...args) {
  if (name === 'vscode') return { Uri: { joinPath: (_base, ...parts) => origin + '/' + parts.join('/') } };
  return load.call(this, name, ...args);
};
const { html } = require('../src/webview');
Module._load = load;
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/logs') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const logs = req.url === '/logs';
    res.end(html({ cspSource: "'self'", asWebviewUri: uri => uri }, '', logs ? 'logs.js' : 'dashboard.js', logs ? 'logs.css' : 'dashboard.css').replace('</head>', `<style>${theme}</style></head>`));
    return;
  }
  const file = path.join(root, decodeURIComponent(req.url));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/css');
  res.end(fs.readFileSync(file));
});
async function capture() {
  fs.mkdirSync(destination, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.JAEWON_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'Asia/Seoul' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const created = new Date(Date.now() - 3 * 86400000).toISOString();
      const pod = (name, options = {}) => ({ kind: 'Pod', metadata: { name, namespace: options.namespace || 'payments', uid: 'demo-' + name, creationTimestamp: created, labels: { app: name.split('-').slice(0, 2).join('-'), environment: 'demo' } }, spec: { nodeName: options.node || 'worker-01', containers: [{ name: 'app', image: 'example/' + name.split('-')[0] + ':1.4.2', ports: [{ containerPort: 8080, protocol: 'TCP' }], resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '500m', memory: '512Mi' } } }], ...(options.init ? { initContainers: [{ name: 'migrate', image: 'example/migrations:1.4.2' }] } : {}) }, status: { phase: options.pending ? 'Pending' : 'Running', podIP: options.pending ? undefined : '192.0.2.' + (10 + name.length), conditions: [{ type: 'Ready', status: options.crash || options.pending || options.init ? 'False' : 'True', reason: options.crash ? 'ContainersNotReady' : 'ContainersReady' }], containerStatuses: [{ name: 'app', ready: !options.crash && !options.pending && !options.init, restartCount: options.crash ? 6 : options.recovered ? 1 : 0, state: options.crash ? { waiting: { reason: 'CrashLoopBackOff', message: 'Back-off restarting failed container app' } } : options.pending || options.init ? { waiting: { reason: 'PodInitializing' } } : { running: { startedAt: new Date(Date.now() - 3600000).toISOString() } }, ...(options.recovered ? { lastState: { terminated: { reason: 'OOMKilled', exitCode: 137 } } } : {}) }], ...(options.init ? { initContainerStatuses: [{ name: 'migrate', restartCount: 0, state: { running: {} } }] } : {}) } });
      const pods = [pod('api-gateway-7f9c8d-k2m4x', { recovered: true }), pod('api-gateway-7f9c8d-r8n6p'), pod('billing-worker-6b8f9c-v3j7a'), pod('checkout-api-8497cd-m5h2q'), pod('inventory-sync-6d89b7-t9w4e', { crash: true }), pod('payment-web-59fc86-x7p3r'), pod('report-migration-8b65d2-z4c9v', { init: true }), pod('scheduled-worker-7b8f45-h6n2s', { pending: true })];
      const deployments = ['api-gateway', 'billing-worker', 'checkout-api', 'payment-web', 'inventory-sync'].map((name, index) => ({ kind: 'Deployment', metadata: { name, namespace: 'payments' }, spec: { replicas: 2 }, status: { readyReplicas: index === 4 ? 1 : 2 } }));
      const services = ['api-gateway', 'checkout-api', 'payment-web'].map(name => ({ metadata: { name }, spec: { type: name === 'api-gateway' ? 'LoadBalancer' : 'ClusterIP' } }));
      const nodes = ['worker-01', 'worker-02', 'control-plane-01'].map(name => ({ metadata: { name }, status: { conditions: [{ type: 'Ready', status: 'True' }] } }));
      const helm = [{ name: 'payments-stack', namespace: 'payments', status: 'deployed', chart: 'payments-2.6.0', app_version: '1.4.2', updated: '2026-10-20 18:30:00 +0900 KST' }, { name: 'ingress-nginx', namespace: 'ingress-system', status: 'deployed', chart: 'ingress-nginx-4.12.0', app_version: '1.12.0', updated: '2026-10-20 17:10:00 +0900 KST' }, { name: 'metrics-server', namespace: 'kube-system', status: 'deployed', chart: 'metrics-server-3.12.2', app_version: '0.7.2', updated: '2026-10-20 16:00:00 +0900 KST' }];
      const forwards = [{ id: 'demo-api', name: 'api-gateway', namespace: 'payments', status: 'running', localPort: 8080, remotePort: 8080, saved: true, context: 'demo-cluster' }, { id: 'demo-web', name: 'payment-web', namespace: 'payments', status: 'stopped', localPort: 3000, remotePort: 80, saved: false, context: 'demo-cluster' }];
      let state = { context: 'demo-cluster', namespace: '', kind: 'overview', auto: false };
      window.acquireVsCodeApi = () => ({ getState: () => state, setState: value => { state = { ...value }; }, postMessage: msg => {
        if (msg.command === 'ready') {
          const send = data => window.dispatchEvent(new MessageEvent('message', { data }));
          setTimeout(() => {
            send({ type: 'settings', maxLines: 50000, target: { context: 'demo-cluster', namespace: 'payments', kind: 'deployments', name: 'api-gateway' } });
            send({ type: 'sources', sources: [{ pod: pods[0].metadata.name, container: 'app' }, { pod: pods[1].metadata.name, container: 'app' }] });
            for (let i = 0; i < 2; i++) send({ type: 'lines', source: 'payments/' + pods[i].metadata.name + '/app', lines: ['2026-10-20T10:30:00.100Z INFO server listening on :8080', '2026-10-20T10:30:01.200Z INFO GET /healthz status=200 duration=2ms', '2026-10-20T10:30:02.300Z INFO POST /payments status=201 duration=41ms', '2026-10-20T10:30:03.400Z WARN upstream latency elevated service=billing duration=280ms', '2026-10-20T10:30:04.500Z INFO connection pool recovered active=8 idle=12', '2026-10-20T10:30:05.600Z ERROR request failed route=/demo-timeout status=504', '2026-10-20T10:30:06.700Z INFO retry completed route=/demo-timeout status=200'] });
          }, 30); return;
        }
        let result;
        if (msg.command === 'settings') result = { initialContext: 'demo-cluster', restored: true, visible: true, metrics: false, refreshSeconds: 5 };
        else if (msg.command === 'contexts') result = [{ name: 'demo-cluster', current: true }, { name: 'demo-staging' }];
        else if (msg.command === 'namespaces') result = ['payments', 'kube-system', 'ingress-system'];
        else if (msg.command === 'list') result = ({ pods, deployments, services, nodes, helm })[msg.args.kind] || [];
        else if (msg.command === 'forwards') result = forwards;
        else if (msg.command === 'detail') result = { resource: pods.find(p => p.metadata.name === msg.args.name), events: [{ reason: 'Scheduled', lastTimestamp: '2026-10-20T09:00:00Z', message: 'Successfully assigned payments/api-gateway to worker-01' }, { reason: 'Started', lastTimestamp: '2026-10-20T09:00:02Z', message: 'Started container app' }] };
        else result = true;
        setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: { id: msg.id, result } })), 0);
      } });
    });
    await page.goto(origin);
    await page.locator('.card').first().waitFor();
    await page.screenshot({ path: path.join(destination, 'overview.png') });
    await page.locator('nav [data-kind="pods"]').click();
    await page.getByRole('cell', { name: 'CrashLoopBackOff', exact: true }).waitFor();
    await page.screenshot({ path: path.join(destination, 'resources.png') });
    await page.getByRole('cell', { name: 'api-gateway-7f9c8d-k2m4x', exact: true }).click();
    await page.getByText('previousTermination', { exact: false }).waitFor();
    await page.screenshot({ path: path.join(destination, 'details.png') });
    await page.locator('#detail').evaluate(element => { element.scrollTop = 520; });
    await page.locator('#detail').screenshot({ path: path.join(destination, 'container-state.png') });
    await page.locator('[data-close]').click();
    await page.locator('nav [data-kind="helm"]').click();
    await page.getByRole('cell', { name: 'payments-stack', exact: true }).waitFor();
    await page.getByRole('cell', { name: 'payments-stack', exact: true }).click();
    await page.getByRole('button', { name: 'Roll back', exact: true }).waitFor();
    await page.screenshot({ path: path.join(destination, 'helm.png') });
    await page.locator('[data-close]').click();
    await page.locator('nav [data-kind="forwards"]').click();
    await page.getByRole('cell', { name: '8080 -> 8080', exact: true }).waitFor();
    await page.screenshot({ path: path.join(destination, 'port-forwards.png') });
    await page.goto(origin + '/logs');
    await page.getByText('Merged container logs', { exact: true }).waitFor();
    await page.locator('#output .severity-error').first().waitFor();
    await page.locator('details').evaluate(element => { element.open = true; });
    await page.screenshot({ path: path.join(destination, 'logs.png') });
    assert.deepEqual(errors, []);
    console.log('Captured seven actual webview screenshots using synthetic documentation data; no page errors.');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
capture().catch(error => { console.error(error); process.exitCode = 1; });
