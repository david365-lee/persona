'use strict';
const vscode = require('vscode');
const crypto = require('node:crypto');
function html(webview, extensionUri, script, css = 'dashboard.css', title = 'Jaewon K8s Dashboard') {
  const nonce = crypto.randomBytes(18).toString('base64');
  const uri = name => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', name));
  const model = script === 'dashboard.js' ? ['resource-model.js', 'detail-view.js'].map(name => `<script nonce="${nonce}" src="${uri(name)}"></script>`).join('') : '';
  return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;"><title>${title}</title><link rel="icon" href="${uri('jaewon-icon-128.png')}"><link rel="stylesheet" href="${uri(css)}"></head><body data-icon="${uri('jaewon-icon-128.png')}"><div id="app"></div>${model}<script nonce="${nonce}" src="${uri(script)}"></script></body></html>`;
}
module.exports = { html };
