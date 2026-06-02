import * as vscode from "vscode";
import { responseViewColumn } from "../config";
import type { KulalaRequestResult } from "../core/types";
import {
  formatBodyDisplay,
  formatTimings,
  headersText,
  preferredResponseBody,
  type BodyDisplay,
  type BodyKind,
} from "./body";
import {
  badgeClass,
  consoleLevelClass,
  consoleRows,
  headerRows,
  prettyMs,
  statusBadge,
  timingRows,
  totalDurationMs,
} from "./format";
import { renderResponseWebview, type TabId } from "./render";
import { testGroupViews, type TestGroupView } from "./tests";

const MAX_HISTORY = 100;

export type ResponseViewState = {
  id: string;
  at: number;
  title: string;
  blockName?: string;
  status: number | string;
  statusBadgeClass: string;
  url?: string;
  method?: string;
  durationMs?: number;
  durationLabel?: string;
  error?: string;
  body: string;
  bodyKind: BodyKind;
  bodyHtml?: string;
  bodyImageSrc?: string;
  binaryNote?: string;
  headers: string;
  headersRows: Array<{ name: string; value: string }>;
  stats: string;
  timingRows: Array<{ phase: string; ms: number }>;
  console: string;
  consoleLines: Array<{ level: string; message: string; levelClass: string }>;
  testGroups: TestGroupView[];
  jqFilter?: string;
  rawBody?: string;
  contentType?: string;
  isWebSocket?: boolean;
  wsConnected?: boolean;
  wsClosed?: boolean;
};

export type PanelHandlers = {
  onApplyJqFilter?: (filter: string, entryId: string) => void;
  onSendWsMessage?: (message: string, entryId: string) => void;
  onCloseWebSocket?: (entryId: string) => void;
};

/** Skip auto-generated names like `REQUEST_001` when there is no `###` title. */
function displayBlockName(blockName?: string): string | undefined {
  const name = blockName?.trim();
  if (!name || /^REQUEST_\d+$/i.test(name)) {
    return undefined;
  }
  return name;
}

function buildPanelTitle(item: KulalaRequestResult, error?: string): string {
  const method = item.request?.method ?? "?";
  const status = error
    ? "Error"
    : item.protocol === "websocket"
      ? "WebSocket"
      : String(item.status ?? (item.success ? "OK" : "Failed"));
  const summary = `${method} ${status}`;
  const name = displayBlockName(item.blockName);
  const prefix = "Kulala Result:";
  return name ? `${prefix} ${name} · ${summary}` : `${prefix} ${summary}`;
}

function panelIconPath(context: vscode.ExtensionContext): vscode.IconPath {
  const logo = vscode.Uri.joinPath(context.extensionUri, "images", "logo.png");
  return { light: logo, dark: logo };
}

function daisyTheme(): string {
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight
    ? "corporate"
    : "dim";
}

function newEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function bodyFieldsFromDisplay(
  display: BodyDisplay,
): Pick<ResponseViewState, "body" | "bodyKind" | "bodyHtml" | "bodyImageSrc" | "binaryNote"> {
  return {
    body: display.text,
    bodyKind: display.kind,
    bodyHtml: display.html,
    bodyImageSrc: display.imageSrc,
    binaryNote: display.binaryNote,
  };
}

function contentTypeFromBody(item: KulalaRequestResult): string | undefined {
  const body = preferredResponseBody(item) ?? item.body;
  if (!body) return undefined;
  if (body.type === "json") return "application/json";
  return body.mediaType ?? "text/plain";
}

export class ResponsePanel {
  private panel: vscode.WebviewPanel | undefined;
  private last: ResponseViewState | undefined;
  private history: ResponseViewState[] = [];
  private historyIndex = -1;
  private activeTab: TabId = "body";
  private handlers: PanelHandlers = {};

  constructor(private readonly context: vscode.ExtensionContext) {}

  setHandlers(handlers: PanelHandlers): void {
    this.handlers = handlers;
  }

  show(state: ResponseViewState): void {
    this.pushHistory(state);
    this.last = state;
    this.ensurePanel();
    this.updateWebview();
  }

  updateEntry(id: string, patch: Partial<ResponseViewState>): void {
    const idx = this.history.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const next = { ...this.history[idx], ...patch };
    this.history[idx] = next;
    if (this.historyIndex === idx) {
      this.last = next;
      this.panel!.title = next.title;
    }
    this.updateWebview();
  }

  updateBodyFromDisplay(
    id: string,
    display: BodyDisplay,
    extra?: Partial<ResponseViewState>,
  ): void {
    this.updateEntry(id, { ...bodyFieldsFromDisplay(display), ...extra });
  }

  getActiveEntry(): ResponseViewState | undefined {
    if (this.history.length === 0) return undefined;
    const index = Math.max(0, Math.min(this.historyIndex, this.history.length - 1));
    return this.history[index];
  }

  getEntryById(id: string): ResponseViewState | undefined {
    return this.history.find((e) => e.id === id);
  }

  revealLast(): void {
    if (this.history.length > 0) {
      this.ensurePanel();
      this.updateWebview();
      return;
    }
    if (this.last) {
      this.show(this.last);
      return;
    }
    void vscode.window.showInformationMessage("No Kulala response yet. Send a request first.");
  }

  clearHistory(): void {
    this.history = [];
    this.historyIndex = -1;
    if (this.panel) {
      this.updateWebview();
    }
  }

  static fromBridgeError(error: string): ResponseViewState {
    return {
      id: newEntryId(),
      at: Date.now(),
      title: "Kulala Result: Error",
      status: "Error",
      statusBadgeClass: badgeClass("error"),
      error,
      body: "",
      bodyKind: "text",
      headers: "",
      headersRows: [],
      stats: "",
      timingRows: [],
      console: "",
      consoleLines: [],
      testGroups: [],
    };
  }

  static fromResult(
    item: KulalaRequestResult,
    error?: string,
    overrides?: Partial<ResponseViewState>,
  ): ResponseViewState {
    const method = item.request?.method ?? "?";
    const status = error
      ? "Error"
      : item.protocol === "websocket"
        ? "WebSocket"
        : (item.status ?? (item.success ? "OK" : "Failed"));
    const blockName = displayBlockName(item.blockName);
    const badge = statusBadge(
      error
        ? "Error"
        : item.protocol === "websocket"
          ? "WebSocket"
          : typeof status === "number"
            ? status
            : undefined,
    );
    const durationMs = totalDurationMs(item.timings);
    const rows = consoleRows(item);
    const bodyDisplay = formatBodyDisplay(preferredResponseBody(item));
    const groups = testGroupViews(item.scriptConsole);

    return {
      id: newEntryId(),
      at: Date.now(),
      title: buildPanelTitle(item, error),
      blockName,
      status,
      statusBadgeClass: badgeClass(badge),
      url: item.url ?? item.request?.url,
      method,
      durationMs,
      durationLabel: prettyMs(durationMs),
      error: error ?? (item.success ? undefined : item.error),
      ...bodyFieldsFromDisplay(bodyDisplay),
      headers: headersText(item.headers),
      headersRows: headerRows(item.headers),
      stats: formatTimings(item),
      timingRows: timingRows(item.timings),
      console: rows.map((r) => `[${r.level}] ${r.message}`).join("\n"),
      consoleLines: rows.map((r) => ({
        ...r,
        levelClass: consoleLevelClass(r.level),
      })),
      testGroups: groups,
      jqFilter: item.jqFilter,
      rawBody: item.rawBody,
      contentType: contentTypeFromBody(item),
      isWebSocket: item.protocol === "websocket",
      wsConnected: false,
      wsClosed: false,
      ...overrides,
    };
  }

  private pushHistory(state: ResponseViewState): void {
    this.history.push(state);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  }

  private ensurePanel(): void {
    if (this.panel) {
      this.panel.reveal(responseViewColumn());
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "kulalaResponse",
      "Kulala Response",
      responseViewColumn(),
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel.iconPath = panelIconPath(this.context);
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    this.panel.webview.onDidReceiveMessage(
      (msg: {
        type?: string;
        index?: number;
        filter?: string;
        message?: string;
        entryId?: string;
      }) => {
        if (msg.type === "select" && typeof msg.index === "number") {
          this.historyIndex = Math.max(0, Math.min(msg.index, this.history.length - 1));
          const entry = this.history[this.historyIndex];
          if (entry) {
            this.last = entry;
            this.panel!.title = entry.title;
          }
          return;
        }
        const entry = msg.entryId
          ? this.history.find((e) => e.id === msg.entryId)
          : this.getActiveEntry();
        if (!entry) return;

        if (msg.type === "applyJq" && typeof msg.filter === "string") {
          this.handlers.onApplyJqFilter?.(msg.filter, entry.id);
        } else if (msg.type === "wsSend" && typeof msg.message === "string") {
          this.handlers.onSendWsMessage?.(msg.message, entry.id);
        } else if (msg.type === "wsClose") {
          this.handlers.onCloseWebSocket?.(entry.id);
        }
      },
    );

    const themeListener = vscode.window.onDidChangeActiveColorTheme(() => {
      if (this.panel) this.updateWebview();
    });
    this.panel.onDidDispose(() => themeListener.dispose());
  }

  private updateWebview(): void {
    if (!this.panel || this.history.length === 0) return;

    const index = Math.max(0, Math.min(this.historyIndex, this.history.length - 1));
    this.historyIndex = index;
    const entry = this.history[index];
    this.panel.title = entry.title;
    const webview = this.panel.webview;
    const stylesheet = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "media", "daisyui.css"),
    );
    this.panel.webview.html = renderResponseWebview({
      payload: {
        theme: daisyTheme(),
        entries: this.history,
        index,
        tab: this.activeTab,
      },
      stylesheetHref: stylesheet.toString(),
      styleCspSource: webview.cspSource,
    });
  }
}
