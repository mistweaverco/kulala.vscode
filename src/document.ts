import * as path from "node:path";
import * as vscode from "vscode";

export type DocumentContext = {
  content: string;
  filepath?: string;
  cwd: string;
  /** 1-based line (kulala-core). */
  line: number;
  /** 1-based column (kulala-core). */
  column: number;
};

export function documentContext(editor: vscode.TextEditor): DocumentContext {
  const doc = editor.document;
  const pos = editor.selection.active;
  const filepath = doc.uri.scheme === "file" ? doc.uri.fsPath : undefined;
  let cwd = filepath ? path.dirname(filepath) : undefined;
  if (!cwd || !path.isAbsolute(cwd)) {
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
    cwd = folder?.uri.fsPath ?? process.cwd();
  }
  return {
    content: doc.getText(),
    filepath,
    cwd,
    line: pos.line + 1,
    column: pos.character + 1,
  };
}

export { isHttpDocument, supportsKulalaLsp } from "./lsp/context";

/** CodeLens/command args are JSON-serialized; revive to real instances. */
export function revivePosition(
  pos: vscode.Position | { line: number; character: number } | undefined,
  fallback: vscode.Position,
): vscode.Position {
  if (pos === undefined) {
    return fallback;
  }
  if (pos instanceof vscode.Position) {
    return pos;
  }
  return new vscode.Position(pos.line, pos.character);
}
