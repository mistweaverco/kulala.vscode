import type { ResponseViewState } from "./panel";

export type WebviewPayload = {
  theme: string;
  entries: ResponseViewState[];
  index: number;
  tab: TabId;
};

export type TabId = "body" | "headers" | "timings" | "tests" | "console";

export type RenderWebviewOptions = {
  payload: WebviewPayload;
  stylesheetHref: string;
  styleCspSource: string;
};

const CLIENT_SCRIPT = `
(function () {
  const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
  const saved = vscode ? vscode.getState() : null;
  const data = window.__KULALA__;
  if (!data || !data.entries || !data.entries.length) return;

  // The extension owns the active history index
  let index = typeof data.index === "number" ? data.index : 0;
  let tab = saved?.tab || data.tab || "body";
  index = Math.max(0, Math.min(index, data.entries.length - 1));

  const $ = (sel) => document.querySelector(sel);
  const entryList = $("#history-list");
  const titleEl = $("#entry-title");
  const metaEl = $("#entry-meta");
  const badgeEl = $("#status-badge");
  const counterEl = $("#entry-counter");
  const tabBody = $("#tab-body");
  const tabHeaders = $("#tab-headers");
  const tabTimings = $("#tab-timings");
  const tabTests = $("#tab-tests");
  const tabConsole = $("#tab-console");
  const paneBody = $("#pane-body");
  const paneHeaders = $("#pane-headers");
  const paneTimings = $("#pane-timings");
  const paneTests = $("#pane-tests");
  const paneConsole = $("#pane-console");
  const jqBar = $("#jq-bar");
  const jqInput = $("#jq-input");
  const wsBar = $("#ws-bar");
  const wsInput = $("#ws-input");

  function persist() {
    if (vscode) vscode.setState({ index, tab });
  }

  function currentEntry() {
    return data.entries[index];
  }

  function setTab(name) {
    tab = name;
    const tabs = { body: tabBody, headers: tabHeaders, timings: tabTimings, tests: tabTests, console: tabConsole };
    const panes = { body: paneBody, headers: paneHeaders, timings: paneTimings, tests: paneTests, console: paneConsole };
    for (const k of Object.keys(tabs)) {
      const active = k === tab;
      tabs[k].classList.toggle("tab-active", active);
      panes[k].classList.toggle("kulala-pane-hidden", !active);
    }
    persist();
  }

  function renderHistory() {
    entryList.innerHTML = "";
    data.entries.forEach((e, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-item" + (i === index ? " active" : "");
      btn.dataset.index = String(i);
      const top = document.createElement("span");
      top.className = "history-item-title";
      top.textContent = e.blockName || e.method || ("Request " + (i + 1));
      const sub = document.createElement("span");
      sub.className = "history-item-sub";
      sub.textContent = (e.method ? e.method + " " : "") + String(e.status ?? "?") +
        (e.durationLabel ? " · " + e.durationLabel : "");
      btn.appendChild(top);
      btn.appendChild(sub);
      btn.addEventListener("click", () => selectEntry(i));
      li.appendChild(btn);
      entryList.appendChild(li);
    });
  }

  function selectEntry(i) {
    index = i;
    render();
    if (vscode) vscode.postMessage({ type: "select", index });
  }

  function renderEntry() {
    const e = data.entries[index];
    counterEl.textContent = "Request " + (index + 1) + " / " + data.entries.length;
    titleEl.textContent = e.blockName || e.method || "Response";
    const urlLine = e.url ? e.method + " " + e.url : (e.method ? String(e.method) : "");
    metaEl.textContent = urlLine;
    metaEl.title = e.url || "";
    badgeEl.textContent = String(e.status ?? "?");
    badgeEl.className = "badge badge-lg " + (e.statusBadgeClass || "badge-ghost");
    if (e.error) {
      metaEl.innerHTML = '<span class="text-error">' + escapeHtml(e.error) + "</span>";
    }
    document.querySelectorAll(".history-item").forEach((el, i) => {
      el.classList.toggle("active", i === index);
    });
    renderJqBar(e);
    renderWsBar(e);
    renderBody(e);
    renderHeaders(e);
    renderTimings(e);
    renderTests(e);
    renderConsole(e);
    $("#btn-prev").disabled = index <= 0;
    $("#btn-next").disabled = index >= data.entries.length - 1;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderJqBar(e) {
    if (!jqBar || !jqInput) return;
    const show = Boolean(e.rawBody || e.isWebSocket);
    jqBar.classList.toggle("kulala-hidden", !show);
    jqInput.value = e.jqFilter || "";
    jqInput.dataset.entryId = e.id;
  }

  function renderWsBar(e) {
    if (!wsBar || !wsInput) return;
    const show = Boolean(e.isWebSocket && e.wsConnected && !e.wsClosed);
    wsBar.classList.toggle("kulala-hidden", !show);
    wsInput.value = "";
    wsInput.dataset.entryId = e.id;
  }

  function renderBody(e) {
    paneBody.className = "pane";
    if (e.bodyKind === "image" && e.bodyImageSrc) {
      paneBody.classList.add("kulala-body-image");
      paneBody.innerHTML =
        '<img class="kulala-image-preview" alt="Response image" src="' +
        escapeHtml(e.bodyImageSrc) + '" />';
      return;
    }
    if (e.bodyKind === "binary" && e.binaryNote) {
      paneBody.classList.add("kulala-body-text", "opacity-70");
      paneBody.textContent = e.binaryNote;
      return;
    }
    const empty = !e.body;
    if (e.bodyKind === "json" && e.bodyHtml) {
      paneBody.classList.add("kulala-body-json");
      paneBody.innerHTML =
        '<code class="kulala-json">' + e.bodyHtml + "</code>";
      return;
    }
    paneBody.classList.add("kulala-body-text");
    paneBody.textContent = empty ? "(empty)" : e.body;
  }

  function renderHeaders(e) {
    const rows = e.headersRows || [];
    if (!rows.length) {
      paneHeaders.innerHTML = '<p class="opacity-60 p-4">(no headers)</p>';
      return;
    }
    const table = document.createElement("table");
    table.className = "table table-zebra table-sm";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Header</th><th>Value</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="font-mono text-xs whitespace-nowrap">' + escapeHtml(r.name) +
        '</td><td class="font-mono text-xs break-all">' + escapeHtml(r.value) + "</td>";
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    paneHeaders.innerHTML = "";
    paneHeaders.appendChild(table);
  }

  function renderTimings(e) {
    const rows = e.timingRows || [];
    if (!rows.length) {
      paneTimings.innerHTML = '<p class="opacity-60 p-4">(no timings)</p>';
      return;
    }
    const max = Math.max(...rows.map((r) => r.ms), 1);
    const wrap = document.createElement("div");
    wrap.className = "flex flex-col gap-3 p-4";
    rows.forEach((r) => {
      const row = document.createElement("div");
      row.className = "flex flex-col gap-1";
      const label = document.createElement("div");
      label.className = "flex justify-between text-sm";
      label.innerHTML =
        "<span>" + escapeHtml(r.phase) + '</span><span class="font-mono">' +
        escapeHtml(r.ms.toFixed(1) + " ms") + "</span>";
      const bar = document.createElement("progress");
      bar.className = "progress progress-primary w-full";
      bar.max = max;
      bar.value = r.ms;
      row.appendChild(label);
      row.appendChild(bar);
      wrap.appendChild(row);
    });
    paneTimings.innerHTML = "";
    paneTimings.appendChild(wrap);
  }

  function renderTests(e) {
    const groups = e.testGroups || [];
    if (!groups.length) {
      paneTests.innerHTML = '<p class="opacity-60 p-4">(no tests)</p>';
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "flex flex-col gap-3 p-4";
    groups.forEach((g) => {
      const group = document.createElement("div");
      group.className = "kulala-test-group";
      const head = document.createElement("div");
      head.className = "kulala-test-head " + (g.pass ? "text-success" : "text-error");
      head.textContent = (g.pass ? "✓ " : "✗ ") + g.name;
      group.appendChild(head);
      g.asserts.forEach((a) => {
        const line = document.createElement("div");
        line.className = "kulala-test-assert " + (a.pass ? "text-success" : "text-error");
        line.textContent = (a.pass ? "  ✓ " : "  ✗ ") + a.message;
        group.appendChild(line);
      });
      wrap.appendChild(group);
    });
    paneTests.innerHTML = "";
    paneTests.appendChild(wrap);
  }

  function renderConsole(e) {
    const lines = e.consoleLines || [];
    if (!lines.length) {
      paneConsole.innerHTML = '<p class="opacity-60 p-4">(no script output)</p>';
      return;
    }
    const pre = document.createElement("pre");
    pre.className = "font-mono text-sm p-4 whitespace-pre-wrap break-words";
    lines.forEach((l) => {
      const span = document.createElement("span");
      span.className = l.levelClass || "";
      span.textContent = "[" + l.level + "] " + l.message + "\\n";
      pre.appendChild(span);
    });
    paneConsole.innerHTML = "";
    paneConsole.appendChild(pre);
  }

  function render() {
    renderHistory();
    renderEntry();
    setTab(tab);
    persist();
  }

  $("#btn-prev")?.addEventListener("click", () => { if (index > 0) selectEntry(index - 1); });
  $("#btn-next")?.addEventListener("click", () => {
    if (index < data.entries.length - 1) selectEntry(index + 1);
  });
  tabBody?.addEventListener("click", () => setTab("body"));
  tabHeaders?.addEventListener("click", () => setTab("headers"));
  tabTimings?.addEventListener("click", () => setTab("timings"));
  tabTests?.addEventListener("click", () => setTab("tests"));
  tabConsole?.addEventListener("click", () => setTab("console"));

  $("#btn-apply-jq")?.addEventListener("click", () => {
    const e = currentEntry();
    if (!e || !vscode) return;
    vscode.postMessage({ type: "applyJq", filter: jqInput.value, entryId: e.id });
  });
  jqInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      $("#btn-apply-jq")?.click();
    }
  });

  $("#btn-ws-send")?.addEventListener("click", () => {
    const e = currentEntry();
    if (!e || !vscode || !wsInput.value.trim()) return;
    vscode.postMessage({ type: "wsSend", message: wsInput.value, entryId: e.id });
    wsInput.value = "";
  });
  wsInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      $("#btn-ws-send")?.click();
    }
  });
  $("#btn-ws-close")?.addEventListener("click", () => {
    const e = currentEntry();
    if (!e || !vscode) return;
    vscode.postMessage({ type: "wsClose", entryId: e.id });
  });

  render();
})();
`;

const INLINE_STYLES = `
  html, body {
    height: 100%;
    margin: 0;
    background: var(--vscode-editor-background);
    color: var(--vscode-foreground);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
  }
  .kulala-root {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }
  .kulala-sidebar {
    width: 14rem;
    min-width: 14rem;
    border-right: 1px solid var(--vscode-panel-border);
    display: flex;
    flex-direction: column;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
  }
  .kulala-sidebar-head {
    padding: 0.75rem 1rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  #history-list {
    list-style: none;
    margin: 0;
    padding: 0.5rem;
    overflow-y: auto;
    flex: 1;
  }
  .history-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.65rem;
    border-radius: 0.375rem;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    margin-bottom: 2px;
  }
  .history-item:hover { background: var(--vscode-list-hoverBackground); }
  .history-item.active {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground, inherit);
  }
  .history-item-title {
    font-size: 0.8rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .history-item-sub {
    font-size: 0.7rem;
    opacity: 0.75;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .kulala-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }
  .kulala-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-wrap: wrap;
  }
  .kulala-toolbar .grow { flex: 1; min-width: 0; }
  #entry-title { font-weight: 600; font-size: 1rem; }
  #entry-meta {
    font-size: 0.8rem;
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kulala-action-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-wrap: wrap;
  }
  .kulala-action-bar.kulala-hidden { display: none; }
  .kulala-action-bar input {
    flex: 1;
    min-width: 8rem;
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    border-radius: 0.25rem;
    padding: 0.35rem 0.5rem;
  }
  #pane-body {
    margin: 0;
    padding: 1rem;
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
    line-height: 1.45;
    overflow: auto;
    flex: 1;
    min-height: 0;
  }
  #pane-body.kulala-body-text,
  #pane-body.kulala-body-json .kulala-json {
    white-space: pre;
    overflow-x: auto;
    tab-size: 2;
  }
  #pane-body.kulala-body-json .kulala-json {
    display: block;
  }
  #pane-body.kulala-body-image {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 1rem;
  }
  .kulala-image-preview {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 0.25rem;
  }
  #pane-body .json-key {
    color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe);
  }
  #pane-body .json-string {
    color: var(--vscode-debugTokenExpression-string, #ce9178);
  }
  #pane-body .json-number {
    color: var(--vscode-debugTokenExpression-number, #b5cea8);
  }
  #pane-body .json-literal {
    color: var(--vscode-debugTokenExpression-boolean, #569cd6);
  }
  #pane-body .json-punctuation {
    color: var(--vscode-editor-foreground);
    opacity: 0.85;
  }
  .kulala-panes {
    flex: 1;
    overflow: auto;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .kulala-panes > .pane.kulala-pane-hidden {
    display: none !important;
  }
  .kulala-test-group { margin-bottom: 0.5rem; }
  .kulala-test-head { font-weight: 600; font-size: 0.9rem; }
  .kulala-test-assert {
    font-family: var(--vscode-editor-font-family);
    font-size: 0.85rem;
    padding-left: 0.25rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .text-success { color: var(--vscode-testing-iconPassed, #73c991); }
  .text-error { color: var(--vscode-testing-iconFailed, #f48771); }
  .tab {
    color: var(--vscode-foreground);
    opacity: 0.75;
  }
  .tab.tab-active {
    opacity: 1;
    border-color: var(--vscode-focusBorder);
    color: var(--vscode-foreground);
  }
  .badge { font-variant-numeric: tabular-nums; }
`;

export function renderResponseWebview(options: RenderWebviewOptions): string {
  const { payload, stylesheetHref, styleCspSource } = options;
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  const csp = [
    "default-src 'none'",
    `style-src ${styleCspSource} 'unsafe-inline'`,
    "img-src data: https:",
    "script-src 'unsafe-inline'",
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en" data-theme="${payload.theme}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <link rel="stylesheet" href="${stylesheetHref}" />
  <style>${INLINE_STYLES}</style>
</head>
<body>
  <div class="kulala-root">
    <aside class="kulala-sidebar">
      <div class="kulala-sidebar-head">History</div>
      <ul id="history-list"></ul>
    </aside>
    <main class="kulala-main">
      <div class="kulala-toolbar">
        <button type="button" id="btn-prev" class="btn btn-sm btn-ghost" title="Previous response">←</button>
        <button type="button" id="btn-next" class="btn btn-sm btn-ghost" title="Next response">→</button>
        <span id="entry-counter" class="text-xs opacity-70"></span>
        <div class="grow min-w-0">
          <div id="entry-title"></div>
          <div id="entry-meta"></div>
        </div>
        <span id="status-badge" class="badge badge-lg"></span>
      </div>
      <div id="jq-bar" class="kulala-action-bar kulala-hidden">
        <label for="jq-input" class="text-xs opacity-70 whitespace-nowrap">JQ filter</label>
        <input type="text" id="jq-input" placeholder=".field or .[-1]" spellcheck="false" />
        <button type="button" id="btn-apply-jq" class="btn btn-sm btn-primary">Apply</button>
      </div>
      <div id="ws-bar" class="kulala-action-bar kulala-hidden">
        <input type="text" id="ws-input" placeholder="Message to send…" spellcheck="false" />
        <button type="button" id="btn-ws-send" class="btn btn-sm btn-primary">Send</button>
        <button type="button" id="btn-ws-close" class="btn btn-sm btn-ghost">Close</button>
      </div>
      <div role="tablist" class="tabs tabs-bordered px-4 bg-transparent">
        <button type="button" role="tab" id="tab-body" class="tab">Body</button>
        <button type="button" role="tab" id="tab-headers" class="tab">Headers</button>
        <button type="button" role="tab" id="tab-timings" class="tab">Timings</button>
        <button type="button" role="tab" id="tab-tests" class="tab">Tests</button>
        <button type="button" role="tab" id="tab-console" class="tab">Console</button>
      </div>
      <div class="kulala-panes">
        <div id="pane-body" class="pane"></div>
        <div id="pane-headers" class="pane kulala-pane-hidden"></div>
        <div id="pane-timings" class="pane kulala-pane-hidden"></div>
        <div id="pane-tests" class="pane kulala-pane-hidden"></div>
        <div id="pane-console" class="pane kulala-pane-hidden"></div>
      </div>
    </main>
  </div>
  <script>window.__KULALA__ = ${json};</script>
  <script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}
