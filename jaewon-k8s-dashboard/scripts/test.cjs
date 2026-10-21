'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'src')).filter(name => name.endsWith('.test.js')).map(name => path.join(root, 'src', name));
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', cwd: root });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
