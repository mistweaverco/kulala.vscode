import * as vscode from "vscode";
import type {
  OpenAPITryValues,
  OpenAPIViewState,
  OpenAPIWebviewMessage,
} from "../../shared/openapi-view";
import type { OpenAPIUiPayload, OpenAPIUITreeNode } from "../core/types";
import type { DocumentContext } from "../document";
import { openapiViewColumn } from "../config";
import { postOpenapiState, renderOpenapiWebview, webviewDistUri } from "../response/webview-html";

export type OpenAPIPanelContext = DocumentContext & {
  env: string;
};

export type OpenAPIPanelHandlers = {
  onRunOperation?: (operationKey: string, parameterOverrides: Record<string, string>) => void;
};

function vscodeTheme(): "light" | "dark" {
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight
    ? "light"
    : "dark";
}

function panelIconPath(context: vscode.ExtensionContext): { light: vscode.Uri; dark: vscode.Uri } {
  const logo = vscode.Uri.joinPath(context.extensionUri, "images", "logo.png");
  return { light: logo, dark: logo };
}

function seedTryValues(nodes: OpenAPIUITreeNode[], into: OpenAPITryValues = {}): OpenAPITryValues {
  for (const node of nodes) {
    if (node.operationKey && node.paramName && node.defaultValue !== undefined) {
      into[node.operationKey] ??= {};
      if (into[node.operationKey][node.paramName] === undefined) {
        into[node.operationKey][node.paramName] = node.defaultValue;
      }
    }
    if (node.children?.length) {
      seedTryValues(node.children, into);
    }
  }
  return into;
}

function overridesForOperation(
  tryValues: OpenAPITryValues,
  operationKey: string,
): Record<string, string> {
  const values = tryValues[operationKey] ?? {};
  const out: Record<string, string> = {};
  for (const [param, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    out[param] = value;
  }
  return out;
}

export class OpenAPIPanel {
  private panel: vscode.WebviewPanel | undefined;
  private last: OpenAPIViewState | undefined;
  private parentCtx: OpenAPIPanelContext | undefined;
  private tryValues: OpenAPITryValues = {};
  private handlers: OpenAPIPanelHandlers = {};
  private webviewHtmlReady = false;

  constructor(private readonly context: vscode.ExtensionContext) {}

  setHandlers(handlers: OpenAPIPanelHandlers): void {
    this.handlers = handlers;
  }

  getParentContext(): OpenAPIPanelContext | undefined {
    return this.parentCtx;
  }

  hasTree(): boolean {
    return Boolean(this.last?.tree?.length);
  }

  getCacheKey(): string | undefined {
    return this.last?.cacheKey;
  }

  revealLast(): boolean {
    if (!this.last) return false;
    this.ensurePanel();
    this.updateWebview();
    return true;
  }

  isOpen(): boolean {
    return this.panel !== undefined;
  }

  show(openapi: OpenAPIUiPayload, ctx: OpenAPIPanelContext): void {
    this.parentCtx = ctx;
    this.tryValues = seedTryValues(openapi.tree);
    this.last = {
      theme: vscodeTheme(),
      title: openapi.title,
      version: openapi.version,
      cacheKey: openapi.cacheKey,
      tree: openapi.tree,
      tryValues: this.tryValues,
    };
    this.ensurePanel();
    this.updateWebview();
  }

  private ensurePanel(): void {
    if (this.panel) {
      this.panel.reveal(openapiViewColumn());
      return;
    }

    this.panel = vscode.window.createWebviewPanel("kulalaOpenapi", "OpenAPI", openapiViewColumn(), {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [webviewDistUri(this.context.extensionUri)],
    });
    this.panel.iconPath = panelIconPath(this.context);
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.webviewHtmlReady = false;
    });
    this.panel.webview.onDidReceiveMessage((msg: OpenAPIWebviewMessage) => {
      if (msg.type === "close") {
        this.panel?.dispose();
        return;
      }
      if (msg.type === "setTryValue") {
        this.tryValues[msg.operationKey] ??= {};
        this.tryValues[msg.operationKey][msg.paramName] = msg.value;
        if (this.last) {
          this.last = { ...this.last, tryValues: this.tryValues };
        }
        return;
      }
      if (msg.type === "runOperation") {
        const overrides = overridesForOperation(this.tryValues, msg.operationKey);
        this.handlers.onRunOperation?.(msg.operationKey, overrides);
      }
    });

    const themeListener = vscode.window.onDidChangeActiveColorTheme(() => {
      if (this.panel && this.last) {
        this.last = { ...this.last, theme: vscodeTheme() };
        this.updateWebview();
      }
    });
    this.panel.onDidDispose(() => themeListener.dispose());
  }

  private buildPayload(): OpenAPIViewState {
    return {
      theme: vscodeTheme(),
      title: this.last?.title,
      version: this.last?.version,
      cacheKey: this.last?.cacheKey,
      tree: this.last?.tree ?? [],
      tryValues: this.tryValues,
    };
  }

  private updateWebview(): void {
    if (!this.panel) return;
    const payload = this.buildPayload();
    const titleParts = ["OpenAPI"];
    if (payload.title) titleParts.push(payload.title);
    if (payload.version) titleParts.push(`v${payload.version}`);
    this.panel.title = titleParts.join(" · ");

    const webview = this.panel.webview;
    if (!this.webviewHtmlReady) {
      this.panel.webview.html = renderOpenapiWebview(this.context.extensionUri, webview, payload);
      this.webviewHtmlReady = true;
      return;
    }

    postOpenapiState(webview, payload);
  }
}
