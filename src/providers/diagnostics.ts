import * as vscode from "vscode";
import { getConfig } from "../config";
import type { KulalaCoreBridge } from "../core/bridge";
import { isHttpDocument, lspContextForDocument, supportsKulalaLsp } from "../lsp/context";
import { toVsCodeDiagnostic } from "../lsp/diagnostics";

const COLLECTION = "kulala";

export class KulalaDiagnostics implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection(COLLECTION);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly bridge: KulalaCoreBridge,
    private readonly extensionContext: vscode.ExtensionContext,
  ) {}

  dispose(): void {
    this.collection.dispose();
    for (const t of this.timers.values()) {
      clearTimeout(t);
    }
    this.timers.clear();
  }

  schedule(document: vscode.TextDocument): void {
    if (!getConfig().get<boolean>("enableLsp", true)) return;
    if (!getConfig().get<boolean>("enableDiagnostics", true)) return;
    if (!isHttpDocument(document)) return;

    const key = document.uri.toString();
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);

    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        void this.refresh(document);
      }, 75),
    );
  }

  clear(document: vscode.TextDocument): void {
    this.collection.delete(document.uri);
  }

  private async refresh(document: vscode.TextDocument): Promise<void> {
    if (!supportsKulalaLsp(document) || !isHttpDocument(document)) {
      return;
    }

    const ctx = lspContextForDocument(document, this.extensionContext);
    const raw = await this.bridge.lspDiagnostics(ctx.content, {
      filepath: ctx.filepath,
      cwd: ctx.cwd,
    });
    const diags: vscode.Diagnostic[] = [];
    for (const d of raw) {
      const diag = toVsCodeDiagnostic(d);
      if (diag) diags.push(diag);
    }
    this.collection.set(document.uri, diags);
  }
}
