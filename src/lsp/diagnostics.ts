import * as vscode from "vscode";
import type { LspDiagnostic } from "../core/types";

/** kulala-core returns LSP-style 0-based ranges. */
export function toVsCodeDiagnostic(d: LspDiagnostic): vscode.Diagnostic | undefined {
  const { start, end } = d.range;
  if (start.line < 0 || start.character < 0 || end.line < 0 || end.character < 0) {
    return undefined;
  }
  const range = new vscode.Range(
    new vscode.Position(start.line, start.character),
    new vscode.Position(end.line, end.character),
  );
  const severity =
    d.severity === 1
      ? vscode.DiagnosticSeverity.Error
      : d.severity === 2
        ? vscode.DiagnosticSeverity.Warning
        : d.severity === 3
          ? vscode.DiagnosticSeverity.Information
          : vscode.DiagnosticSeverity.Hint;
  const diag = new vscode.Diagnostic(range, d.message, severity);
  diag.source = d.source ?? "kulala";
  return diag;
}
