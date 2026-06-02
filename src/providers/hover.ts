import * as vscode from "vscode";
import { getConfig } from "../config";
import type { KulalaCoreBridge } from "../core/bridge";
import { lspContext, supportsKulalaLsp } from "../lsp/context";

export class KulalaHoverProvider implements vscode.HoverProvider {
  constructor(
    private readonly bridge: KulalaCoreBridge,
    private readonly extensionContext: vscode.ExtensionContext,
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): Promise<vscode.Hover | undefined> {
    if (!getConfig().get<boolean>("enableLsp", true)) return undefined;
    if (!supportsKulalaLsp(document)) return undefined;

    const ctx = lspContext(document, position, this.extensionContext);
    const hover = await this.bridge.lspHover(ctx.content, ctx.line, ctx.column, {
      filepath: ctx.filepath,
      cwd: ctx.cwd,
      env: ctx.env,
      filetype: ctx.filetype,
    });
    if (!hover) return undefined;

    const contents = hover.contents;
    if (typeof contents === "string") {
      return new vscode.Hover(new vscode.MarkdownString(contents));
    }
    const text = contents.value;
    if (contents.kind === "markdown") {
      return new vscode.Hover(new vscode.MarkdownString(text));
    }
    return new vscode.Hover(text);
  }
}
