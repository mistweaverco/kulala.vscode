<script lang="ts">
  import { Tabs } from "melt/builders";
  import { onMount } from "svelte";
  import type { ResponseViewState, TabId, VerboseBodyView, WebviewPayload } from "../../../shared/response-view";
  import { getVsCodeApi, listenForExtensionMessages, readInitialPayload } from "$lib/vscode";

  const tabIds: TabId[] = ["body", "headers", "timings", "tests", "console", "verbose"];
  const tabLabels: Record<TabId, string> = {
    body: "Body",
    headers: "Headers",
    timings: "Timings",
    tests: "Tests",
    console: "Console",
    verbose: "Verbose",
  };

  let payload = $state<WebviewPayload | undefined>(undefined);
  let index = $state(0);
  let tab = $state<TabId>("body");
  let jqInput = $state("");
  let wsInput = $state("");

  const tabs = new Tabs<TabId>({
    value: () => tab,
    onValueChange: (value) => {
      tab = value;
      persistTab();
    },
  });

  const isEmpty = $derived(!payload || payload.entries.length === 0);
  const entry = $derived(
    payload && payload.entries.length > 0
      ? payload.entries[Math.max(0, Math.min(index, payload.entries.length - 1))]
      : undefined,
  );
  const showJqBar = $derived(Boolean(entry?.rawBody || entry?.isWebSocket));
  const showWsBar = $derived(Boolean(entry?.isWebSocket && entry.wsConnected && !entry.wsClosed));
  const timingMax = $derived(
    entry?.timingRows?.length ? Math.max(...entry.timingRows.map((r) => r.ms), 1) : 1,
  );

  function applyPayload(next: WebviewPayload) {
    payload = next;
    index = Math.max(0, Math.min(next.index, Math.max(0, next.entries.length - 1)));
    const saved = getVsCodeApi()?.getState();
    tab = saved?.tab ?? next.tab ?? "body";
  }

  function persistTab() {
    getVsCodeApi()?.setState({ tab });
  }

  function selectEntry(i: number) {
    index = i;
    getVsCodeApi()?.postMessage({ type: "select", index: i });
  }

  function historyLabel(e: ResponseViewState, i: number): string {
    return e.blockName || e.method || `Request ${i + 1}`;
  }

  function historySub(e: ResponseViewState): string {
    return `${e.method ? `${e.method} ` : ""}${String(e.status ?? "?")}${e.durationLabel ? ` · ${e.durationLabel}` : ""}`;
  }

  function applyJq() {
    if (!entry) return;
    getVsCodeApi()?.postMessage({ type: "applyJq", filter: jqInput, entryId: entry.id });
  }

  function sendWs() {
    if (!entry || !wsInput.trim()) return;
    getVsCodeApi()?.postMessage({ type: "wsSend", message: wsInput, entryId: entry.id });
    wsInput = "";
  }

  function closeWs() {
    if (!entry) return;
    getVsCodeApi()?.postMessage({ type: "wsClose", entryId: entry.id });
  }

  function clearHistory() {
    getVsCodeApi()?.postMessage({ type: "clearHistory" });
  }

  function bodyLabel(body: VerboseBodyView): string {
    return body.body || "(empty)";
  }

  onMount(() => {
    const initial = readInitialPayload();
    if (initial) applyPayload(initial);
    return listenForExtensionMessages(applyPayload);
  });

  let lastInputEntryId = $state("");

  $effect(() => {
    const id = entry?.id;
    if (!id || id === lastInputEntryId) return;
    lastInputEntryId = id;
    jqInput = entry?.jqFilter ?? "";
    wsInput = "";
  });
</script>

<div class="kulala-root">
  <aside class="kulala-sidebar">
    <div class="kulala-sidebar-head">
      <span>History</span>
      <button
        type="button"
        class="kulala-icon-btn"
        title="Clear history"
        aria-label="Clear history"
        disabled={isEmpty}
        onclick={clearHistory}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>
    </div>
    <ul class="m-0 flex-1 list-none overflow-y-auto p-2">
      {#each payload?.entries ?? [] as e, i (e.id)}
        <li>
          <button
            type="button"
            class="history-item"
            class:active={i === index}
            onclick={() => selectEntry(i)}
          >
            <span class="history-item-title">{historyLabel(e, i)}</span>
            <span class="history-item-sub">{historySub(e)}</span>
          </button>
        </li>
      {/each}
    </ul>
  </aside>

  <main class="kulala-main">
    {#if isEmpty}
      <div class="kulala-empty-main">
        <p>No response history</p>
        <p class="text-xs opacity-60">Send a request to see results here.</p>
      </div>
    {:else if entry}
      <div class="kulala-main-stack">
        <div class="kulala-toolbar">
          <button
            type="button"
            class="kulala-btn kulala-btn-sm kulala-btn-ghost"
            title="Previous response"
            disabled={index <= 0}
            onclick={() => selectEntry(index - 1)}
          >
            ←
          </button>
          <button
            type="button"
            class="kulala-btn kulala-btn-sm kulala-btn-ghost"
            title="Next response"
            disabled={index >= (payload?.entries.length ?? 1) - 1}
            onclick={() => selectEntry(index + 1)}
          >
            →
          </button>
          <span class="text-xs opacity-70">
            Request {index + 1} / {payload?.entries.length}
          </span>
          <div class="kulala-toolbar-grow">
            <div class="entry-title">{entry.blockName || entry.method || "Response"}</div>
            {#if entry.error}
              <div class="entry-meta text-error">{entry.error}</div>
            {:else}
              <div class="entry-meta" title={entry.url ?? ""}>
                {entry.url ? `${entry.method} ${entry.url}` : (entry.method ?? "")}
              </div>
            {/if}
          </div>
          <span class="kulala-badge kulala-badge-lg {entry.statusBadgeClass}">
            {entry.status ?? "?"}
          </span>
        </div>

        {#if showJqBar}
          <div class="kulala-action-bar">
            <label class="text-xs whitespace-nowrap opacity-70" for="jq-input">JQ filter</label>
            <input
              id="jq-input"
              class="kulala-input"
              type="text"
              placeholder=".field or .[-1]"
              spellcheck="false"
              bind:value={jqInput}
              onkeydown={(ev) => {
                if (ev.key === "Enter") {
                  ev.preventDefault();
                  applyJq();
                }
              }}
            />
            <button type="button" class="kulala-btn kulala-btn-sm kulala-btn-primary" onclick={applyJq}>
              Apply
            </button>
          </div>
        {/if}

        {#if showWsBar}
          <div class="kulala-action-bar">
            <input
              class="kulala-input"
              type="text"
              placeholder="Message to send…"
              spellcheck="false"
              bind:value={wsInput}
              onkeydown={(ev) => {
                if (ev.key === "Enter" && !ev.shiftKey) {
                  ev.preventDefault();
                  sendWs();
                }
              }}
            />
            <button type="button" class="kulala-btn kulala-btn-sm kulala-btn-primary" onclick={sendWs}>
              Send
            </button>
            <button type="button" class="kulala-btn kulala-btn-sm kulala-btn-ghost" onclick={closeWs}>
              Close
            </button>
          </div>
        {/if}

        <div class="kulala-tabs" {...tabs.triggerList}>
          {#each tabIds as tabId (tabId)}
            <button type="button" class="kulala-tab" {...tabs.getTrigger(tabId)}>
              {tabLabels[tabId]}
            </button>
          {/each}
        </div>

        <div class="kulala-panes">
          <div
            class="kulala-pane"
            class:kulala-pane-hidden={tab !== "body"}
            {...tabs.getContent("body")}
          >
            {#if entry.bodyKind === "image" && entry.bodyImageSrc}
              <div class="kulala-body-image">
                <img class="kulala-image-preview" alt="" src={entry.bodyImageSrc} />
              </div>
            {:else if entry.bodyKind === "binary" && entry.binaryNote}
              <div class="kulala-body-text p-4 opacity-70">{entry.binaryNote}</div>
            {:else if entry.bodyKind === "json" && entry.bodyHtml}
              <div class="kulala-body-json p-4">
                <code class="kulala-json">{@html entry.bodyHtml}</code>
              </div>
            {:else}
              <div class="kulala-body-text p-4">{entry.body || "(empty)"}</div>
            {/if}
          </div>

          <div
            class="kulala-pane"
            class:kulala-pane-hidden={tab !== "headers"}
            {...tabs.getContent("headers")}
          >
            {#if !entry.headersRows?.length}
              <p class="p-4 opacity-60">(no headers)</p>
            {:else}
              <table class="kulala-table">
                <thead>
                  <tr>
                    <th>Header</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {#each entry.headersRows as row (row.name)}
                    <tr>
                      <td class="font-mono whitespace-nowrap">{row.name}</td>
                      <td class="break-all font-mono">{row.value}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>

          <div
            class="kulala-pane"
            class:kulala-pane-hidden={tab !== "timings"}
            {...tabs.getContent("timings")}
          >
            {#if !entry.timingRows?.length}
              <p class="p-4 opacity-60">(no timings)</p>
            {:else}
              <div class="flex flex-col gap-3 p-4">
                {#each entry.timingRows as row (row.phase)}
                  <div class="flex flex-col gap-1">
                    <div class="flex justify-between text-sm">
                      <span>{row.phase}</span>
                      <span class="font-mono">{row.ms.toFixed(1)} ms</span>
                    </div>
                    <div class="kulala-progress">
                      <div style:width="{(row.ms / timingMax) * 100}%"></div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div
            class="kulala-pane"
            class:kulala-pane-hidden={tab !== "tests"}
            {...tabs.getContent("tests")}
          >
            {#if !entry.testGroups?.length}
              <p class="p-4 opacity-60">(no tests)</p>
            {:else}
              <div class="flex flex-col gap-3 p-4">
                {#each entry.testGroups as group (group.name)}
                  <div class="kulala-test-group">
                    <div class="kulala-test-head" class:text-success={group.pass} class:text-error={!group.pass}>
                      {group.pass ? "✓ " : "✗ "}{group.name}
                    </div>
                    {#each group.asserts as assert (assert.message)}
                      <div
                        class="kulala-test-assert"
                        class:text-success={assert.pass}
                        class:text-error={!assert.pass}
                      >
                        {assert.pass ? "  ✓ " : "  ✗ "}{assert.message}
                      </div>
                    {/each}
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div
            class="kulala-pane"
            class:kulala-pane-hidden={tab !== "console"}
            {...tabs.getContent("console")}
          >
            {#if !entry.consoleLines?.length}
              <p class="p-4 opacity-60">(no script output)</p>
            {:else}
              <pre class="break-words p-4 font-mono text-sm whitespace-pre-wrap">
                {#each entry.consoleLines as line, i (i)}
                  <span class={line.levelClass}>[{line.level}] {line.message}
</span>
                {/each}
              </pre>
            {/if}
          </div>

          <div
            class="kulala-pane"
            class:kulala-pane-hidden={tab !== "verbose"}
            {...tabs.getContent("verbose")}
          >
            {#if entry.verbose}
              <div class="kulala-verbose">
                <section class="kulala-verbose-section">
                  <h3 class="kulala-verbose-title">Request headers</h3>
                  {#if !entry.verbose.requestHeadersRows.length}
                    <p class="kulala-verbose-empty">(no request headers)</p>
                  {:else}
                    <table class="kulala-table">
                      <thead>
                        <tr>
                          <th>Header</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each entry.verbose.requestHeadersRows as row (row.name)}
                          <tr>
                            <td class="font-mono whitespace-nowrap">{row.name}</td>
                            <td class="break-all font-mono">{row.value}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  {/if}
                </section>

                <section class="kulala-verbose-section">
                  <h3 class="kulala-verbose-title">Request body</h3>
                  {#if entry.verbose.requestBody.bodyKind === "json" && entry.verbose.requestBody.bodyHtml}
                    <div class="kulala-body-json kulala-verbose-body">
                      <code class="kulala-json">{@html entry.verbose.requestBody.bodyHtml}</code>
                    </div>
                  {:else}
                    <div class="kulala-body-text kulala-verbose-body">{bodyLabel(entry.verbose.requestBody)}</div>
                  {/if}
                </section>

                <section class="kulala-verbose-section">
                  <h3 class="kulala-verbose-title">Response headers</h3>
                  {#if !entry.verbose.responseHeadersRows.length}
                    <p class="kulala-verbose-empty">(no response headers)</p>
                  {:else}
                    <table class="kulala-table">
                      <thead>
                        <tr>
                          <th>Header</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each entry.verbose.responseHeadersRows as row (row.name)}
                          <tr>
                            <td class="font-mono whitespace-nowrap">{row.name}</td>
                            <td class="break-all font-mono">{row.value}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  {/if}
                </section>

                <section class="kulala-verbose-section">
                  <h3 class="kulala-verbose-title">Response body</h3>
                  {#if entry.verbose.responseBody.bodyKind === "json" && entry.verbose.responseBody.bodyHtml}
                    <div class="kulala-body-json kulala-verbose-body">
                      <code class="kulala-json">{@html entry.verbose.responseBody.bodyHtml}</code>
                    </div>
                  {:else}
                    <div class="kulala-body-text kulala-verbose-body">{bodyLabel(entry.verbose.responseBody)}</div>
                  {/if}
                </section>
              </div>
            {:else}
              <p class="p-4 opacity-60">(no verbose data)</p>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>
