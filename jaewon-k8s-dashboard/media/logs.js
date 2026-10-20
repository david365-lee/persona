/* global acquireVsCodeApi */
'use strict';
const vscode = acquireVsCodeApi();
const app = document.getElementById('app');
app.innerHTML = `<header><strong>Merged container logs</strong><button id="pause">Pause</button><button id="clear">Clear</button><button id="copy">Copy</button><button id="editor">Open editor</button><button id="save">Save</button></header><section class="controls"><input id="filter" placeholder="Filter logs" aria-label="Filter logs"><label><input type="checkbox" id="regex">Regex</label><label><input type="checkbox" id="case">Case sensitive</label><label><input type="checkbox" id="only" checked>Only matches</label><label><input type="checkbox" id="timestamps" checked>Timestamps</label><label><input type="checkbox" id="wrap" checked>Wrap</label><label><input type="checkbox" id="previous">Previous container</label><label>Max lines <input id="max" type="number" min="100" max="50000" value="5000"></label></section><details><summary>Pods and containers</summary><div id="sources"></div></details><div id="status" role="status"></div><pre id="output"></pre>`;
const $ = id => document.getElementById(id);
let lines = [], paused = false, sources = [], disabledPods = new Set(), disabledContainers = new Set();
let sequence = 0;
const stripAnsi = text => text.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
const maxLines = () => Math.max(100, Math.min(50000, Number($('max').value) || 5000));
function trim() { lines.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.sequence - b.sequence); lines = lines.slice(-maxLines()); }
function matcher() { const value = $('filter').value; if (!value) return null; try { return new RegExp($('regex').checked ? value : value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $('case').checked ? 'g' : 'gi'); } catch (error) { $('status').textContent = error.message; return null; } }
function visible() { const pattern = matcher(); return lines.filter(line => !disabledPods.has(line.source.split('/')[1]) && !disabledContainers.has(line.source.split('/')[2])).map(line => ({ ...line, text: $('timestamps').checked ? line.text : line.text.replace(/^\S+\s/, '') })).filter(line => { if (!pattern || !$('only').checked) return true; pattern.lastIndex = 0; return pattern.test(line.text); }); }
function content() { return visible().map(line => `[${line.source}] ${line.text}`).join('\n'); }
function render() {
  if (paused) return;
  const output = $('output'), atBottom = output.scrollHeight - output.scrollTop - output.clientHeight < 60;
  const fragment = document.createDocumentFragment(), pattern = matcher();
  for (const line of visible()) {
    const row = document.createElement('div'), prefix = document.createElement('span'); row.className = /\b(error|fatal|panic|critical)\b/i.test(line.text) ? 'severity-error' : /\b(warn|warning)\b/i.test(line.text) ? 'severity-warning' : /\b(debug|trace)\b/i.test(line.text) ? 'severity-debug' : /\binfo\b/i.test(line.text) ? 'severity-info' : ''; prefix.className = 'source'; prefix.textContent = `[${line.source}] `; row.append(prefix);
    let cursor = 0;
    if (pattern) { pattern.lastIndex = 0; for (const match of line.text.matchAll(pattern)) { row.append(document.createTextNode(line.text.slice(cursor, match.index))); const mark = document.createElement('mark'); mark.textContent = match[0]; row.append(mark); cursor = match.index + match[0].length; } }
    row.append(document.createTextNode(line.text.slice(cursor))); fragment.append(row);
  }
  output.replaceChildren(fragment); output.classList.toggle('nowrap', !$('wrap').checked); if (atBottom) output.scrollTop = output.scrollHeight;
}
function options() { vscode.postMessage({ command: 'options', previous: $('previous').checked, disabledPods: [...disabledPods], disabledContainers: [...disabledContainers] }); }
function sourceControls() {
  const root = $('sources'); root.replaceChildren();
  for (const [label, values, disabled] of [['Pod', [...new Set(sources.map(s => s.pod))], disabledPods], ['Container', [...new Set(sources.map(s => s.container))], disabledContainers]]) for (const value of values) { const item = document.createElement('label'), checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !disabled.has(value); checkbox.onchange = () => { checkbox.checked ? disabled.delete(value) : disabled.add(value); options(); render(); }; item.append(checkbox, document.createTextNode(`${label}: ${value}`)); root.append(item); }
}
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; render(); };
$('clear').onclick = () => { lines = []; render(); };
for (const command of ['copy', 'editor', 'save']) $(command).onclick = () => vscode.postMessage({ command, text: content() });
for (const id of ['filter', 'regex', 'case', 'only', 'timestamps', 'wrap']) $(id).addEventListener('input', render);
$('previous').onchange = () => { lines = []; options(); render(); };
$('max').onchange = () => { trim(); render(); };
window.addEventListener('message', event => {
  const m = event.data;
  if (m.type === 'lines') {
    lines.push(...m.lines.map(raw => { const text = stripAnsi(raw), timestamp = text.match(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z/)?.[0]; return { source: m.source, text, timestamp: timestamp ? timestamp.replace(/(?:\.(\d+))?Z$/, (_, fraction) => `.${(fraction || '').padEnd(9, '0')}Z`) : new Date().toISOString().replace(/\.(\d+)Z$/, (_, fraction) => `.${fraction.padEnd(9, '0')}Z`), sequence: sequence++ }; }));
    trim(); render();
  } else if (m.type === 'settings') { $('max').value = m.maxLines; $('status').textContent = `${m.target.context} · ${m.target.namespace} · ${m.target.kind}/${m.target.name}`; }
  else if (m.type === 'sources') { sources = m.sources; sourceControls(); }
  else $('status').textContent = `${m.source || ''} ${m.text || ''}`;
});
vscode.postMessage({ command: 'ready' });
