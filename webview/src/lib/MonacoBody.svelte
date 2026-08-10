<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type * as Monaco from "monaco-editor";

  type Props = {
    value?: string;
    language?: string;
    theme?: "light" | "dark";
    class?: string;
  };

  let {
    value = "",
    language = "plaintext",
    theme = "dark",
    class: className = "",
  }: Props = $props();

  let host = $state<HTMLDivElement | undefined>(undefined);
  let ready = $state(false);
  let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
  let monaco: typeof Monaco | undefined;
  let resizeObserver: ResizeObserver | undefined;

  function monacoTheme(t: "light" | "dark"): string {
    return t === "light" ? "vs" : "vs-dark";
  }

  function syncModel(nextValue: string, nextLanguage: string) {
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    if (model.getValue() !== nextValue) {
      model.setValue(nextValue);
    }
    const currentLang = model.getLanguageId();
    if (currentLang !== nextLanguage) {
      monaco.editor.setModelLanguage(model, nextLanguage);
    }
  }

  onMount(() => {
    let cancelled = false;

    void (async () => {
      const [{ default: editorWorker }, { default: jsonWorker }, { default: htmlWorker }, monacoMod] =
        await Promise.all([
          import("monaco-editor/esm/vs/editor/editor.worker?worker"),
          import("monaco-editor/esm/vs/language/json/json.worker?worker"),
          import("monaco-editor/esm/vs/language/html/html.worker?worker"),
          import("monaco-editor"),
        ]);

      if (cancelled || !host) return;

      window.MonacoEnvironment = {
        getWorker(_moduleId: string, label: string) {
          if (label === "json") return new jsonWorker();
          if (label === "html" || label === "handlebars" || label === "razor") {
            return new htmlWorker();
          }
          return new editorWorker();
        },
      };

      monaco = monacoMod;
      editor = monaco.editor.create(host, {
        value: value ?? "",
        language: language || "plaintext",
        theme: monacoTheme(theme),
        readOnly: true,
        domReadOnly: true,
        wordWrap: "on",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontSize: 13,
        lineNumbers: "on",
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        folding: true,
        contextmenu: false,
        padding: { top: 8, bottom: 8 },
      });

      resizeObserver = new ResizeObserver(() => editor?.layout());
      resizeObserver.observe(host);
      ready = true;
    })();

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    // Read props first so history / jq updates stay tracked even before Monaco is ready.
    const nextValue = value ?? "";
    const nextLanguage = language || "plaintext";
    if (!ready) return;
    syncModel(nextValue, nextLanguage);
  });

  $effect(() => {
    if (!ready || !monaco) return;
    monaco.editor.setTheme(monacoTheme(theme));
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    editor?.dispose();
    editor = undefined;
    monaco = undefined;
    ready = false;
  });
</script>

<div class="monaco-host {className}" bind:this={host}></div>

<style>
  .monaco-host {
    width: 100%;
    height: 100%;
    min-height: 12rem;
  }

  .monaco-host :global(.monaco-editor),
  .monaco-host :global(.overflow-guard) {
    border-radius: 0;
  }
</style>
