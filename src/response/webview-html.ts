import * as fs from "node:fs";
import * as vscode from "vscode";
import type { WebviewPayload } from "../../shared/response-view";

export function webviewDistUri(extensionUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(extensionUri, "dist", "webview");
}

function webviewBaseHref(webview: vscode.Webview, base: vscode.Uri): string {
  const href = webview.asWebviewUri(base).toString();
  return href.endsWith("/") ? href : `${href}/`;
}

/** SvelteKit emits root-absolute /_app/ URLs; rewrite to webview-accessible URIs. */
function rewriteWebviewAssets(html: string, webview: vscode.Webview, base: vscode.Uri): string {
  const withAssets = html.replace(
    /(["'])\/_app\/([^"']+)/g,
    (_match, quote: string, path: string) => {
      const assetUri = vscode.Uri.joinPath(base, "_app", ...path.split("/"));
      return `${quote}${webview.asWebviewUri(assetUri)}`;
    },
  );
  return withAssets.replace(
    /base:\s*new URL\(['"]\.['"],\s*location\)\.pathname\.slice\(0,\s*-1\)/g,
    'base: ""',
  );
}

function injectHeadExtras(
  html: string,
  payload: WebviewPayload,
  webview: vscode.Webview,
  base: vscode.Uri,
  cspSource: string,
): string {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  const csp = [
    "default-src 'none'",
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src ${cspSource} 'unsafe-inline'`,
    `connect-src ${cspSource}`,
    "img-src data: https:",
  ].join("; ");
  const injection = [
    `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
    `<base href="${webviewBaseHref(webview, base)}" />`,
    `<script>if (!location.hash || location.hash === "#") location.hash = "#/";</script>`,
    `<script>window.__KULALA__=${json};</script>`,
  ].join("\n");
  return html.replace("<head>", `<head>\n${injection}`);
}

export function renderResponseWebview(
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
  payload: WebviewPayload,
): string {
  const base = webviewDistUri(extensionUri);
  const indexPath = vscode.Uri.joinPath(base, "index.html");
  let html = fs.readFileSync(indexPath.fsPath, "utf8");
  html = rewriteWebviewAssets(html, webview, base);
  html = injectHeadExtras(html, payload, webview, base, webview.cspSource);
  return html;
}

export function postWebviewState(webview: vscode.Webview, payload: WebviewPayload): void {
  void webview.postMessage({ type: "state", payload });
}
