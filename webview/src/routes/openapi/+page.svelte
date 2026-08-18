<script lang="ts">
  import { onMount } from "svelte";
  import type { OpenAPIUITreeNode, OpenAPIViewState } from "../../../../shared/openapi-view";
  import { getVsCodeApi, listenForOpenapiMessages, readInitialOpenapiPayload } from "$lib/vscode";

  let state = $state<OpenAPIViewState | undefined>(undefined);
  /** Collapsed node ids; root sections start collapsed except first level is collapsed by default like nvim. */
  let collapsed = $state<Set<string>>(new Set());
  let seeded = $state(false);

  function applyState(next: OpenAPIViewState) {
    state = next;
    if (!seeded && next.tree.length) {
      collapsed = collectCollapsibleIds(next.tree);
      seeded = true;
    }
  }

  function collectCollapsibleIds(nodes: OpenAPIUITreeNode[], into = new Set<string>()): Set<string> {
    for (const node of nodes) {
      if (node.children?.length) {
        into.add(node.id);
        collectCollapsibleIds(node.children, into);
      }
    }
    return into;
  }

  function toggle(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed = next;
  }

  function tryValue(operationKey: string | undefined, paramName: string | undefined): string {
    if (!operationKey || !paramName || !state) return "";
    return state.tryValues[operationKey]?.[paramName] ?? "";
  }

  function setTryValue(operationKey: string, paramName: string, value: string) {
    if (!state) return;
    const op = { ...state.tryValues[operationKey], [paramName]: value };
    state = {
      ...state,
      tryValues: { ...state.tryValues, [operationKey]: op },
    };
    getVsCodeApi()?.postMessage({ type: "setTryValue", operationKey, paramName, value });
  }

  function runOperation(operationKey: string) {
    getVsCodeApi()?.postMessage({ type: "runOperation", operationKey });
  }

  function copyAsHttp(operationKey: string) {
    getVsCodeApi()?.postMessage({ type: "copyAsHttp", operationKey });
  }

  function pickFile(operationKey: string, paramName: string) {
    getVsCodeApi()?.postMessage({ type: "pickFile", operationKey, paramName });
  }

  function isFilePickable(node: OpenAPIUITreeNode): boolean {
    return node.inputType !== "select" && node.inputType !== "multiSelect";
  }

  function multiSelected(value: string): string[] {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function onMultiChange(operationKey: string, paramName: string, selected: HTMLSelectElement) {
    const values = Array.from(selected.selectedOptions).map((o) => o.value);
    setTryValue(operationKey, paramName, values.join(","));
  }

  function methodClass(badge?: string): string {
    const m = (badge ?? "").toUpperCase();
    if (m === "GET") return "openapi-method-get";
    if (m === "POST") return "openapi-method-post";
    if (m === "PUT") return "openapi-method-put";
    if (m === "DELETE") return "openapi-method-delete";
    if (m === "PATCH") return "openapi-method-patch";
    return "";
  }

  onMount(() => {
    const initial = readInitialOpenapiPayload();
    if (initial) applyState(initial);
    return listenForOpenapiMessages(applyState);
  });
</script>

{#snippet treeNodes(nodes: OpenAPIUITreeNode[], depth: number)}
  {#each nodes as node (node.id)}
    {@const hasChildren = Boolean(node.children?.length)}
    {@const isCollapsed = collapsed.has(node.id)}
    {@const isTry = node.kind === "tryItOut"}
    {@const editable = Boolean(node.editable && node.operationKey && node.paramName)}
    <div class="openapi-node" style:--depth={depth}>
      <div class="openapi-row" class:openapi-row-try={isTry}>
        {#if hasChildren}
          <button
            type="button"
            class="openapi-fold"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
            onclick={() => toggle(node.id)}
          >
            {isCollapsed ? "▶" : "▼"}
          </button>
        {:else}
          <span class="openapi-fold-spacer"></span>
        {/if}

        {#if node.kind === "operation" && node.badge}
          <span class="openapi-badge {methodClass(node.badge)}">{node.badge}</span>
        {:else if node.badge}
          <span class="openapi-badge-muted">{node.badge}</span>
        {/if}

        <span class="openapi-title openapi-kind-{node.kind}">{node.title}</span>

        {#if node.kind === "operation" && node.operationKey}
          <button
            type="button"
            class="kulala-btn kulala-btn-sm kulala-btn-ghost"
            onclick={() => copyAsHttp(node.operationKey!)}
          >
            Copy as HTTP
          </button>
          <button
            type="button"
            class="kulala-btn kulala-btn-sm kulala-btn-primary openapi-run"
            onclick={() => runOperation(node.operationKey!)}
          >
            Run
          </button>
        {/if}
      </div>

      {#if node.description}
        <div class="openapi-desc">{node.description}</div>
      {/if}

      {#if editable && node.operationKey && node.paramName}
        <div class="openapi-try">
          {#if node.inputType === "multiSelect" && node.options?.length}
            <select
              class="kulala-input openapi-input"
              multiple
              size={Math.min(6, Math.max(3, node.options.length))}
              onchange={(ev) =>
                onMultiChange(node.operationKey!, node.paramName!, ev.currentTarget)}
            >
              {#each node.options as opt (opt)}
                <option
                  value={opt}
                  selected={multiSelected(tryValue(node.operationKey, node.paramName)).includes(opt)}
                >
                  {opt}
                </option>
              {/each}
            </select>
          {:else if node.inputType === "select" && node.options?.length}
            <select
              class="kulala-input openapi-input"
              value={tryValue(node.operationKey, node.paramName) || node.defaultValue || ""}
              onchange={(ev) =>
                setTryValue(node.operationKey!, node.paramName!, ev.currentTarget.value)}
            >
              {#each node.options as opt (opt)}
                <option value={opt}>{opt}</option>
              {/each}
            </select>
          {:else if node.paramName === "__body__"}
            <textarea
              class="kulala-input openapi-input openapi-textarea"
              rows="6"
              spellcheck="false"
              value={tryValue(node.operationKey, node.paramName)}
              oninput={(ev) =>
                setTryValue(node.operationKey!, node.paramName!, ev.currentTarget.value)}
              onkeydown={(ev) => {
                if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey) && node.operationKey) {
                  ev.preventDefault();
                  runOperation(node.operationKey);
                }
              }}
            ></textarea>
          {:else}
            <input
              class="kulala-input openapi-input"
              type="text"
              spellcheck="false"
              value={tryValue(node.operationKey, node.paramName)}
              oninput={(ev) =>
                setTryValue(node.operationKey!, node.paramName!, ev.currentTarget.value)}
              onkeydown={(ev) => {
                if (ev.key === "Enter" && node.operationKey) {
                  ev.preventDefault();
                  runOperation(node.operationKey);
                }
              }}
            />
          {/if}
          {#if isFilePickable(node)}
            <button
              type="button"
              class="kulala-btn kulala-btn-sm kulala-btn-ghost"
              onclick={() => pickFile(node.operationKey!, node.paramName!)}
            >
              From file
            </button>
          {/if}
          {#if node.operationKey}
            <button
              type="button"
              class="kulala-btn kulala-btn-sm kulala-btn-ghost"
              onclick={() => runOperation(node.operationKey!)}
            >
              Run
            </button>
          {/if}
        </div>
      {/if}

      {#if hasChildren && !isCollapsed}
        {@render treeNodes(node.children!, depth + 1)}
      {/if}
    </div>
  {/each}
{/snippet}

<div class="openapi-root" class:theme-light={state?.theme === "light"}>
  <header class="openapi-header">
    <div>
      <div class="openapi-heading">{state?.title ?? "OpenAPI"}</div>
      {#if state?.version}
        <div class="openapi-sub">v{state.version}</div>
      {/if}
    </div>
  </header>

  {#if !state?.tree?.length}
    <div class="kulala-empty-main">
      <p>No OpenAPI tree loaded</p>
      <p class="text-xs opacity-60">
        Run a <code># @kulala-openapi-explorer</code> request or use Open OpenAPI Explorer.
      </p>
    </div>
  {:else}
    <div class="openapi-tree">
      {@render treeNodes(state.tree, 0)}
    </div>
  {/if}
</div>

<style>
  .openapi-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .openapi-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--vscode-panel-border);
  }

  .openapi-heading {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .openapi-sub {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .openapi-tree {
    flex: 1;
    overflow: auto;
    padding: 0.5rem 0.75rem 1.5rem;
  }

  .openapi-node {
    margin-left: calc(var(--depth) * 0.85rem);
  }

  .openapi-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 1.6rem;
    padding: 0.1rem 0;
  }

  .openapi-fold,
  .openapi-fold-spacer {
    width: 1.1rem;
    flex-shrink: 0;
    text-align: center;
  }

  .openapi-fold {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0;
    opacity: 0.8;
    font-size: 0.65rem;
  }

  .openapi-title {
    flex: 1;
    min-width: 0;
    font-size: 0.85rem;
  }

  .openapi-kind-section {
    font-weight: 600;
  }

  .openapi-kind-operation {
    font-family: var(--vscode-editor-font-family, monospace);
  }

  .openapi-kind-text,
  .openapi-kind-schema {
    opacity: 0.9;
  }

  .openapi-desc {
    margin: 0 0 0.35rem 1.5rem;
    font-size: 0.75rem;
    opacity: 0.65;
    white-space: pre-wrap;
  }

  .openapi-badge {
    font-size: 0.65rem;
    font-weight: 700;
    font-family: var(--vscode-editor-font-family, monospace);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .openapi-badge-muted {
    font-size: 0.7rem;
    opacity: 0.65;
    flex-shrink: 0;
  }

  .openapi-method-get {
    color: #61affe;
  }
  .openapi-method-post {
    color: #49cc90;
  }
  .openapi-method-put {
    color: #fca130;
  }
  .openapi-method-delete {
    color: #f93e3e;
  }
  .openapi-method-patch {
    color: #50e3c2;
  }

  .openapi-try {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: flex-start;
    margin: 0.25rem 0 0.5rem 1.5rem;
  }

  .openapi-input {
    flex: 1;
    min-width: 12rem;
  }

  .openapi-textarea {
    width: 100%;
    min-height: 6rem;
    resize: vertical;
    font-family: var(--vscode-editor-font-family, monospace);
  }

  .openapi-run {
    flex-shrink: 0;
  }
</style>
