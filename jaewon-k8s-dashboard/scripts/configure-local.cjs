'use strict';
// Local installation helper: set only unset executable paths, preserving JSON text.
const fs = require('node:fs');
const [settingsPath, kubectlPath, helmPath] = process.argv.slice(2);
const text = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '') : '{}';
const parsed = JSON.parse(text); // Fail safely on JSONC instead of rewriting unfamiliar syntax.
const additions = Object.entries({ 'jaewonK8s.kubectlPath': kubectlPath, 'jaewonK8s.helmPath': helmPath }).filter(([key]) => !parsed[key]);
if (!additions.length) { console.log('Executable settings already configured.'); process.exit(0); }
for (const [, value] of additions) if (!fs.existsSync(value)) throw Error('Executable not found: ' + value);
const end = text.lastIndexOf('}');
if (end < 0) throw Error('Settings must be a JSON object.');
const prefix = text.slice(0, end).trimEnd();
const updated = prefix + (Object.keys(parsed).length ? ',' : '') + '\n' + additions.map(([key,value]) => '    ' + JSON.stringify(key) + ': ' + JSON.stringify(value)).join(',\n') + '\n' + text.slice(end);
JSON.parse(updated);
fs.writeFileSync(settingsPath, updated, 'utf8');
console.log('Configured ' + additions.map(([key]) => key).join(', '));
