import * as vscode from "vscode";
import { getConfig } from "../config";
import type { KulalaCoreBridge } from "../core/bridge";
import { LspSymbolKind } from "../core/types";
import { isHttpDocument, lspContextForDocument } from "../lsp/context";

const SYMBOL_KIND_MAP: Record<number, vscode.SymbolKind> = {
  [LspSymbolKind.File]: vscode.SymbolKind.File,
  [LspSymbolKind.Module]: vscode.SymbolKind.Module,
  [LspSymbolKind.Function]: vscode.SymbolKind.Function,
};

function toSymbolInformation(
  document: vscode.TextDocument,
  sym: {
    name: string;
    kind: number;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    selectionRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  },
): vscode.SymbolInformation {
  const range = new vscode.Range(
    sym.range.start.line,
    sym.range.start.character,
    sym.range.end.line,
    sym.range.end.character,
  );
  return new vscode.SymbolInformation(
    sym.name,
    SYMBOL_KIND_MAP[sym.kind] ?? vscode.SymbolKind.Function,
    range,
    document.uri,
  );
}

export class KulalaDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  constructor(
    private readonly bridge: KulalaCoreBridge,
    private readonly extensionContext: vscode.ExtensionContext,
  ) {}

  async provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): Promise<vscode.SymbolInformation[]> {
    if (!getConfig().get<boolean>("enableLsp", true)) return [];
    if (!isHttpDocument(document)) return [];

    const ctx = lspContextForDocument(document, this.extensionContext);
    const symbols = await this.bridge.lspDocumentSymbols(ctx.content, {
      filepath: ctx.filepath,
      cwd: ctx.cwd,
    });
    return symbols.map((sym) => toSymbolInformation(document, sym));
  }
}
