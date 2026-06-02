import * as vscode from "vscode";
import { getSelectedEnv } from "./config";

export class KulalaStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor(context: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
    this.item.command = "kulala.selectEnvironment";
    context.subscriptions.push(this.item);
    this.update(context);
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.update(context)),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.update(context)),
    );
  }

  update(context: vscode.ExtensionContext): void {
    const editor = vscode.window.activeTextEditor;
    if (
      !editor ||
      (editor.document.languageId !== "http" && editor.document.languageId !== "rest")
    ) {
      this.item.hide();
      return;
    }
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    const env = getSelectedEnv(context, folder);
    this.item.text = `🐼 Kulala: ${env}`;
    this.item.tooltip = "Click to change Kulala environment";
    this.item.show();
  }
}
