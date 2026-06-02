import * as vscode from "vscode";
import type { LspCompletionItem } from "../core/types";
import { LspCompletionItemKind } from "../core/types";

const LSP_INSERT_SNIPPET = 2;

const KIND_MAP: Record<number, vscode.CompletionItemKind> = {
  [LspCompletionItemKind.Text]: vscode.CompletionItemKind.Text,
  [LspCompletionItemKind.Method]: vscode.CompletionItemKind.Method,
  [LspCompletionItemKind.Function]: vscode.CompletionItemKind.Function,
  [LspCompletionItemKind.Constructor]: vscode.CompletionItemKind.Constructor,
  [LspCompletionItemKind.Field]: vscode.CompletionItemKind.Field,
  [LspCompletionItemKind.Variable]: vscode.CompletionItemKind.Variable,
  [LspCompletionItemKind.Class]: vscode.CompletionItemKind.Class,
  [LspCompletionItemKind.Interface]: vscode.CompletionItemKind.Interface,
  [LspCompletionItemKind.Module]: vscode.CompletionItemKind.Module,
  [LspCompletionItemKind.Property]: vscode.CompletionItemKind.Property,
  [LspCompletionItemKind.Unit]: vscode.CompletionItemKind.Unit,
  [LspCompletionItemKind.Value]: vscode.CompletionItemKind.Value,
  [LspCompletionItemKind.Enum]: vscode.CompletionItemKind.Enum,
  [LspCompletionItemKind.Keyword]: vscode.CompletionItemKind.Keyword,
  [LspCompletionItemKind.Snippet]: vscode.CompletionItemKind.Snippet,
  [LspCompletionItemKind.File]: vscode.CompletionItemKind.File,
  [LspCompletionItemKind.Reference]: vscode.CompletionItemKind.Reference,
  [LspCompletionItemKind.Folder]: vscode.CompletionItemKind.Folder,
  [LspCompletionItemKind.EnumMember]: vscode.CompletionItemKind.EnumMember,
  [LspCompletionItemKind.Constant]: vscode.CompletionItemKind.Constant,
  [LspCompletionItemKind.Struct]: vscode.CompletionItemKind.Struct,
  [LspCompletionItemKind.Event]: vscode.CompletionItemKind.Event,
  [LspCompletionItemKind.Operator]: vscode.CompletionItemKind.Operator,
  [LspCompletionItemKind.TypeParameter]: vscode.CompletionItemKind.TypeParameter,
};

const SCRIPT_PREFIX_RE = /[$\w.]+$/;
/** Inside `{{ … }}` - allow JSONPath / spaced names (JetBrains-style). */
const TEMPLATE_PREFIX_RE = /[$\w.[\]*'"\s-]+$/;

/**
 * Replace range for completion items at `position`.
 * Mirrors kulala.nvim `apply_completion_text_edits` (client-side, not kulala-core's textEdit).
 *
 * Returns a zero-width range when there is no meaningful prefix yet (e.g. right after `{{` or
 * `{{ `) so VS Code does not filter out `$env.*` / magic variables.
 */
export function completionReplaceRange(line: string, position: vscode.Position): vscode.Range {
  const endCharacter = Math.max(0, Math.min(position.character, line.length));
  const before = line.slice(0, endCharacter);
  const inTemplate = /\{\{[^}]*$/.test(before);
  const rawPrefix = before.match(inTemplate ? TEMPLATE_PREFIX_RE : SCRIPT_PREFIX_RE)?.[0] ?? "";
  // JetBrains-style `{{ VAR }}` - leading spaces are not part of the variable name.
  const prefix = inTemplate ? rawPrefix.trimStart() : rawPrefix;
  if (!prefix) {
    return new vscode.Range(position.line, endCharacter, position.line, endCharacter);
  }
  const startCharacter = endCharacter - rawPrefix.length;
  return new vscode.Range(position.line, startCharacter, position.line, endCharacter);
}

export function isEmptyReplaceRange(range: vscode.Range): boolean {
  return range.start.line === range.end.line && range.start.character === range.end.character;
}

/** VS Code word matching treats `$` as non-word; widen filterText so `$` vars still match. */
function filterTextForLabel(label: string): string {
  if (label.startsWith("$env.")) {
    return `${label} ${label.slice(5)}`;
  }
  if (label.startsWith("$")) {
    return `${label} ${label.slice(1)}`;
  }
  return label;
}

export function toVsCodeCompletionItem(
  item: LspCompletionItem,
  replaceRange: vscode.Range,
  omitRange = false,
): vscode.CompletionItem {
  const kind =
    item.kind !== undefined ? (KIND_MAP[item.kind] ?? vscode.CompletionItemKind.Text) : undefined;
  const c = new vscode.CompletionItem(item.label, kind);
  if (item.detail) {
    c.detail = item.detail;
  }
  if (item.labelDetails?.description) {
    c.detail = c.detail
      ? `${c.detail} - ${item.labelDetails.description}`
      : item.labelDetails.description;
  }
  if (item.documentation) {
    const doc = item.documentation;
    c.documentation = doc.kind === "markdown" ? new vscode.MarkdownString(doc.value) : doc.value;
  }
  if (item.sortText) {
    c.sortText = item.sortText;
  }

  c.filterText = filterTextForLabel(item.label);

  const newText = item.insertText ?? item.textEdit?.newText ?? item.label;
  if (newText) {
    if (!omitRange) {
      c.range = replaceRange;
    }
    if (item.insertTextFormat === LSP_INSERT_SNIPPET) {
      c.insertText = new vscode.SnippetString(newText);
    } else {
      c.insertText = newText;
    }
  }

  return c;
}
