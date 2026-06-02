import * as vscode from "vscode";
import { getConfig } from "../config";
import type { KulalaCoreBridge } from "../core/bridge";
import {
  completionReplaceRange,
  isEmptyReplaceRange,
  toVsCodeCompletionItem,
} from "../lsp/completion";
import { lspContext, supportsKulalaLsp } from "../lsp/context";

export class KulalaCompletionProvider implements vscode.CompletionItemProvider {
  constructor(
    private readonly bridge: KulalaCoreBridge,
    private readonly extensionContext: vscode.ExtensionContext,
  ) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): Promise<vscode.CompletionItem[]> {
    if (!getConfig().get<boolean>("enableLsp", true)) return [];
    if (!getConfig().get<boolean>("enableCompletion", true)) return [];
    if (!supportsKulalaLsp(document)) return [];

    const ctx = lspContext(document, position, this.extensionContext);
    const line = document.lineAt(position.line).text;
    const items = await this.bridge.lspCompletion(ctx.content, ctx.line, ctx.column, {
      filepath: ctx.filepath,
      cwd: ctx.cwd,
      env: ctx.env,
      filetype: ctx.filetype,
    });

    const replaceRange = completionReplaceRange(line, position);
    const omitRange = isEmptyReplaceRange(replaceRange);
    return items.map((item) => toVsCodeCompletionItem(item, replaceRange, omitRange));
  }
}
