import * as vscode from "vscode";
import { getConfig } from "../config";
import { KulalaSyntaxEngine } from "./engine";
import { registerSemanticHighlighting } from "./provider";

let engine: KulalaSyntaxEngine | undefined;

export async function registerKulalaSyntax(context: vscode.ExtensionContext): Promise<void> {
  if (!getConfig().get<boolean>("syntaxHighlighting", true)) {
    return;
  }

  engine = new KulalaSyntaxEngine(context);
  try {
    await engine.ready();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    void vscode.window.showWarningMessage(`Kulala syntax highlighting disabled: ${msg}`);
    return;
  }

  context.subscriptions.push(registerSemanticHighlighting(engine));
}
