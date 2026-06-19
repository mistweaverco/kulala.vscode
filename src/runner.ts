import * as vscode from "vscode";
import type { KulalaCoreBridge } from "./core/bridge";
import type { KulalaRequestResult, KulalaRunLimit } from "./core/types";
import { getSelectedEnv } from "./config";
import type { DocumentContext } from "./document";
import { formatBodyDisplay } from "./response/body";
import { ResponsePanel } from "./response/panel";
import { WebSocketSession } from "./websocket/session";

const MAX_PROMPT_DEPTH = 7;

function isPrompt(item: KulalaRequestResult | undefined): boolean {
  if (!item) return false;
  if (item.prompt === true) return true;
  return Boolean(item.promptId && item.promptType);
}

function findFirstPrompt(data: KulalaRequestResult[]): KulalaRequestResult | undefined {
  return data.find((item) => isPrompt(item));
}

function completedBeforePrompt(data: KulalaRequestResult[]): KulalaRequestResult[] {
  const promptIndex = data.findIndex((item) => isPrompt(item));
  if (promptIndex <= 0) {
    return [];
  }
  return data.slice(0, promptIndex);
}

function promptBlockName(item: KulalaRequestResult): string | undefined {
  const name = item.blockName?.trim();
  return name || undefined;
}

async function collectPromptInputs(
  prompt: KulalaRequestResult,
): Promise<Array<{ id: string; value: string }> | undefined> {
  const specs = prompt.inputs ?? [];
  if (!specs.length) {
    void vscode.window.showWarningMessage("Kulala prompt has no inputs.");
    return undefined;
  }
  const out: Array<{ id: string; value: string }> = [];
  for (const inp of specs) {
    const id = inp.id;
    if (!id) return undefined;
    const label = inp.label ?? id;
    const isPassword = inp.type === "password";
    const value = await vscode.window.showInputBox({
      title: prompt.message ?? "Kulala",
      prompt: label,
      password: isPassword,
      ignoreFocusOut: true,
    });
    if (value === undefined) return undefined;
    if (inp.required && !value.trim()) {
      void vscode.window.showWarningMessage(`Required: ${label}`);
      return undefined;
    }
    out.push({ id, value });
  }
  return out;
}

export class RequestRunner {
  private running = false;
  private wsSession: WebSocketSession | undefined;
  private wsEntryId: string | undefined;
  private lastCtx: DocumentContext | undefined;

  constructor(
    private readonly bridge: KulalaCoreBridge,
    private readonly context: vscode.ExtensionContext,
    private readonly panel: ResponsePanel,
  ) {
    this.panel.setHandlers({
      onApplyJqFilter: (filter, entryId) => {
        void this.applyJqFilter(filter, entryId);
      },
      onSendWsMessage: (message, entryId) => {
        if (entryId !== this.wsEntryId || !this.wsSession) return;
        this.wsSession.send(message);
      },
      onCloseWebSocket: (entryId) => {
        if (entryId !== this.wsEntryId) return;
        this.closeWebSocket();
      },
    });
  }

  get isRunning(): boolean {
    return this.running;
  }

  async runAtCursor(ctx: DocumentContext): Promise<void> {
    const limit: KulalaRunLimit[] = [
      { filter: "cursorPosition", line: ctx.line, column: ctx.column },
    ];
    return this.run(ctx, limit);
  }

  async runAll(ctx: DocumentContext): Promise<void> {
    return this.run(ctx, undefined);
  }

  async applyJqFilter(filter: string, entryId?: string): Promise<void> {
    const active = this.panel.getActiveEntry();
    const targetId = entryId ?? active?.id;
    if (!targetId) return;

    if (this.wsSession && this.wsEntryId === targetId) {
      this.wsSession.setFilter(filter.trim() || undefined);
      return;
    }

    const entry = this.panel.getEntryById(targetId) ?? active;
    const rawBody = entry?.rawBody;
    if (!rawBody) {
      void vscode.window.showWarningMessage("No response body available to filter.");
      return;
    }

    const trimmed = filter.trim();
    const contentType = entry?.contentType ?? "application/json";
    const cwd = this.lastCtx?.cwd;

    if (!trimmed) {
      const { result } = await this.bridge.applyJqFilter(rawBody, ".", contentType, cwd);
      if (result?.filteredBody) {
        const display = formatBodyDisplay(result.filteredBody);
        this.panel.updateEntry(targetId, {
          ...displayFields(display),
          jqFilter: undefined,
        });
      }
      return;
    }

    const { result, err } = await this.bridge.applyJqFilter(rawBody, trimmed, contentType, cwd);
    if (!result?.filteredBody) {
      void vscode.window.showErrorMessage(err ?? "jq filter failed");
      return;
    }
    const display = formatBodyDisplay(result.filteredBody);
    this.panel.updateEntry(targetId, {
      ...displayFields(display),
      jqFilter: trimmed,
    });
  }

  async promptJqFilter(): Promise<void> {
    const entry = this.panel.getActiveEntry();
    if (!entry) {
      void vscode.window.showInformationMessage("No Kulala response to filter.");
      return;
    }
    const filter = await vscode.window.showInputBox({
      title: "Kulala JQ Filter",
      prompt: "Enter a jq expression (empty to clear)",
      value: entry.jqFilter ?? "",
      ignoreFocusOut: true,
    });
    if (filter === undefined) return;
    await this.applyJqFilter(filter, entry.id);
  }

  private async run(ctx: DocumentContext, limit: KulalaRunLimit[] | undefined): Promise<void> {
    if (this.running) {
      void vscode.window.showWarningMessage("A Kulala request is already running.");
      return;
    }
    this.running = true;
    this.lastCtx = ctx;
    await vscode.commands.executeCommand("setContext", "kulala.requestRunning", true);

    try {
      const folder = ctx.filepath
        ? vscode.workspace.getWorkspaceFolder(vscode.Uri.file(ctx.filepath))
        : undefined;
      const env = getSelectedEnv(this.context, folder ?? undefined);
      await this.runWithRetry(ctx, env, limit, 0);
    } finally {
      this.running = false;
      await vscode.commands.executeCommand("setContext", "kulala.requestRunning", false);
    }
  }

  private async runWithRetry(
    ctx: DocumentContext,
    env: string,
    limit: KulalaRunLimit[] | undefined,
    depth: number,
  ): Promise<void> {
    if (depth > MAX_PROMPT_DEPTH) {
      void vscode.window.showErrorMessage("Kulala: exceeded prompt / retry limit.");
      return;
    }

    const { wrapper, err } = await this.bridge.run(ctx.content, {
      filepath: ctx.filepath,
      env,
      limit,
      cwd: ctx.cwd,
    });

    if (err) {
      this.panel.show(ResponsePanel.fromBridgeError(err));
      return;
    }

    if (wrapper?.type === "error") {
      const msg = wrapper.data?.[0]?.error ?? "kulala-core error";
      this.panel.show(ResponsePanel.fromResult({ success: false, error: msg }));
      return;
    }

    const data = wrapper?.data ?? [];
    if (data.length === 0) {
      void vscode.window.showErrorMessage("Kulala: no result from kulala-core.");
      return;
    }

    const promptItem = findFirstPrompt(data);
    if (promptItem) {
      const completedBefore = completedBeforePrompt(data);
      for (const item of completedBefore) {
        await this.deliverItem(item, ctx);
      }

      const inputs = await collectPromptInputs(promptItem);
      if (!inputs || !promptItem.promptId) {
        void vscode.window.showWarningMessage("Prompt cancelled or incomplete.");
        return;
      }

      const cont = await this.bridge.continue(promptItem.promptId, inputs, ctx.cwd);
      if (cont.err) {
        this.panel.show(ResponsePanel.fromResult({ success: false, error: cont.err }));
        return;
      }

      const contFirst = cont.wrapper?.data?.[0];
      if (!contFirst?.success) {
        this.panel.show(
          ResponsePanel.fromResult({
            success: false,
            error: contFirst?.error ?? "continue did not succeed",
          }),
        );
        return;
      }

      const blockName = promptBlockName(promptItem);
      const retryLimit: KulalaRunLimit[] | undefined =
        completedBefore.length > 0 && blockName ? [{ filter: "name", name: blockName }] : limit;

      return this.runWithRetry(ctx, env, retryLimit, depth + 1);
    }

    for (const item of data) {
      await this.deliverItem(item, ctx);
    }
  }

  private async deliverItem(item: KulalaRequestResult, ctx: DocumentContext): Promise<void> {
    if (item.skipped && item.success) {
      return;
    }
    if (item.protocol === "websocket") {
      await this.startWebSocket(item, ctx);
      return;
    }
    this.panel.show(ResponsePanel.fromResult(item));
  }

  private async startWebSocket(item: KulalaRequestResult, ctx: DocumentContext): Promise<void> {
    this.closeWebSocket();

    const state = ResponsePanel.fromResult(item, undefined, {
      wsConnected: false,
      wsClosed: false,
      rawBody: "",
    });
    this.panel.show(state);
    this.wsEntryId = state.id;

    this.wsSession = new WebSocketSession(this.bridge, item, ctx.cwd, {
      onUpdate: (wsState) => {
        if (!this.wsEntryId) return;
        this.panel.updateEntry(this.wsEntryId, {
          ...displayFields(wsState.body),
          jqFilter: wsState.jqFilter,
          rawBody: this.wsSession?.getRawBody(),
          wsConnected: wsState.connected,
          wsClosed: wsState.closed,
          error: wsState.error,
        });
      },
    });

    await this.wsSession.connect();
  }

  closeWebSocket(): void {
    if (this.wsSession) {
      this.wsSession.close();
      this.wsSession = undefined;
    }
    if (this.wsEntryId) {
      this.panel.updateEntry(this.wsEntryId, { wsConnected: false, wsClosed: true });
      this.wsEntryId = undefined;
    }
  }

  cancel(): void {
    this.closeWebSocket();
    if (this.bridge.cancelActive()) {
      void vscode.window.showInformationMessage("Kulala request cancelled.");
    }
  }
}

function displayFields(
  display: ReturnType<typeof formatBodyDisplay>,
): Pick<
  import("./response/panel").ResponseViewState,
  "body" | "bodyKind" | "bodyHtml" | "bodyImageSrc" | "binaryNote"
> {
  return {
    body: display.text,
    bodyKind: display.kind,
    bodyHtml: display.html,
    bodyImageSrc: display.imageSrc,
    binaryNote: display.binaryNote,
  };
}
