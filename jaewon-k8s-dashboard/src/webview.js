'use strict';
const vscode = require('vscode');
const crypto = require('node:crypto');
function html(webview, extensionUri, script, css = 'dashboard.css', title = 'Jaewon K8s Dashboard') {
  const nonce = crypto.randomBytes(18).toString('base64');
  const uri = name => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', name));
  return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;"><title>${title}</title><link rel="stylesheet" href="${uri(css)}"></head><body><div id="app"></div><script nonce="${nonce}" src="${uri(script)}"></script></body></html>`;
}
module.exports = { html };
