import * as path from "node:path";
import * as vscode from "vscode";
import type { KulalaCoreBridge } from "../core/bridge";
import { isHttpDocument } from "../document";
import { codeLensLine0 } from "../requestLine";

export class KulalaCodeLensProvider implements vscode.CodeLensProvider {
  constructor(private readonly bridge: KulalaCoreBridge) {}

  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): Promise<vscode.CodeLens[]> {
    if (!isHttpDocument(document)) return [];

    const filepath = document.uri.scheme === "file" ? document.uri.fsPath : undefined;
    const cwd = filepath ? path.dirname(filepath) : undefined;
    const { doc } = await this.bridge.parse(document.getText(), filepath, cwd);
    const lenses: vscode.CodeLens[] = [];

    if (doc?.blocks) {
      for (const block of doc.blocks) {
        const line = codeLensLine0(document, block);
        if (line === undefined) {
          continue;
        }
        const range = new vscode.Range(line, 0, line, 0);
        lenses.push(
          new vscode.CodeLens(range, {
            title: "$(play) Send Request",
            command: "kulala.sendRequest",
            arguments: [line],
          }),
        );
      }
      if (lenses.length) return lenses;
    }

    // Fallback: ### separators → lens on the ### line
    const text = document.getText();
    for (const match of text.matchAll(/^###.*$/gm)) {
      const offset = match.index ?? 0;
      const line = document.positionAt(offset).line;
      const range = new vscode.Range(line, 0, line, 0);
      lenses.push(
        new vscode.CodeLens(range, {
          title: "$(play) Send Request",
          command: "kulala.sendRequest",
          arguments: [line],
        }),
      );
    }
    return lenses;
  }
}
