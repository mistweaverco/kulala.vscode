import * as vscode from "vscode";
import type { LspCompletionItem, LspTextEdit } from "../core/types";
import { LspCompletionItemKind } from "../core/types";

const LSP_INSERT_SNIPPET = 2;
const LSP_PLAIN_TEXT = 1;

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

const COMPLETION_PREFIX_RE = /[$\w.]+$/;

export type CompletionReplaceResult = {
  range: vscode.Range;
  closingSuffix?: string;
};

function longestSuffixPrefixMatch(before: string, candidate: string): number {
  const maxLen = Math.min(before.length, candidate.length);
  for (let len = maxLen; len > 0; len--) {
    const suffix = before.slice(before.length - len);
    if (candidate.startsWith(suffix)) return len;
  }
  return 0;
}

const TEMPLATE_VAR_CHAR_RE = /[\w$.[\]*-]/;

/** Matching `}}` for `{{` opened at `innerStart - 2`, skipping nested `{{ ... }}`. */
function findTemplateClose(line: string, innerStart: number): number | null {
  let i = innerStart;
  while (i < line.length - 1) {
    if (line[i] === "{" && line[i + 1] === "{") {
      const nestedClose = findTemplateClose(line, i + 2);
      if (nestedClose === null) return null;
      i = nestedClose + 2;
      continue;
    }
    if (line[i] === "}" && line[i + 1] === "}") {
      return i;
    }
    i++;
  }
  return null;
}

function templateVarReplaceEnd(line: string, innerStart: number, endCol0: number): number {
  let i = innerStart;
  while (i < endCol0) {
    if (!TEMPLATE_VAR_CHAR_RE.test(line[i]!)) break;
    i++;
  }
  return Math.max(innerStart, i);
}

/** Mirrors kulala-core `templateVarCompletionRange`. */
function templateVarCompletionRange(
  line: string,
  column1: number,
): { startCol0: number; endCol0: number; addClosingBraces: boolean } | null {
  const endCol0 = Math.max(0, Math.min(column1, line.length));
  const before = line.slice(0, endCol0);
  const openCol0 = before.lastIndexOf("{{");
  if (openCol0 < 0) return null;

  const innerStart = openCol0 + 2;
  const closeCol0 = findTemplateClose(line, innerStart);

  if (closeCol0 !== null) {
    const replaceEnd = Math.max(innerStart, Math.min(endCol0, closeCol0));
    return {
      startCol0: innerStart,
      endCol0: replaceEnd,
      addClosingBraces: false,
    };
  }

  const typed = before.slice(innerStart);
  if (typed.includes("}")) return null;

  return {
    startCol0: innerStart,
    endCol0: templateVarReplaceEnd(line, innerStart, endCol0),
    addClosingBraces: true,
  };
}

/**
 * Client-side replace range when kulala-core did not attach `textEdit`.
 * Mirrors kulala.nvim `completion_replace_range` / kulala-core `completionReplaceRange`.
 */
export function completionReplaceRange(
  line: string,
  position: vscode.Position,
  newText?: string,
  label?: string,
): CompletionReplaceResult {
  const column1 = position.character + 1;
  const endCol0 = Math.max(0, Math.min(column1, line.length));
  const before = line.slice(0, endCol0);
  const lineNum = position.line;

  const templateRange = templateVarCompletionRange(line, column1);
  if (templateRange) {
    return {
      range: new vscode.Range(lineNum, templateRange.startCol0, lineNum, templateRange.endCol0),
      closingSuffix: templateRange.addClosingBraces ? "}}" : undefined,
    };
  }

  if (newText) {
    let matchLen = longestSuffixPrefixMatch(before, newText);
    if (matchLen === 0 && label && label !== newText) {
      matchLen = longestSuffixPrefixMatch(before, label);
    }
    if (matchLen > 0) {
      return {
        range: new vscode.Range(lineNum, endCol0 - matchLen, lineNum, endCol0),
      };
    }
  }

  const templateMatch = before.match(/\{\{([^}]*)$/);
  if (templateMatch) {
    const prefix = templateMatch[1] ?? "";
    return {
      range: new vscode.Range(lineNum, endCol0 - prefix.length, lineNum, endCol0),
      closingSuffix: "}}",
    };
  }

  const word = before.match(COMPLETION_PREFIX_RE)?.[0] ?? "";
  return {
    range: new vscode.Range(lineNum, endCol0 - word.length, lineNum, endCol0),
  };
}

export function isEmptyReplaceRange(range: vscode.Range): boolean {
  return range.start.line === range.end.line && range.start.character === range.end.character;
}

function lspRangeToVsCode(textEdit: LspTextEdit): vscode.Range {
  return new vscode.Range(
    textEdit.range.start.line,
    textEdit.range.start.character,
    textEdit.range.end.line,
    textEdit.range.end.character,
  );
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

function setInsertText(c: vscode.CompletionItem, text: string, insertTextFormat?: number): void {
  if (insertTextFormat === LSP_INSERT_SNIPPET) {
    c.insertText = new vscode.SnippetString(text);
  } else {
    c.insertText = text;
  }
}

export function toVsCodeCompletionItem(
  item: LspCompletionItem,
  line: string,
  position: vscode.Position,
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

  let insertTextFormat = item.insertTextFormat;
  if (item.label.startsWith("$kulala") && !item.textEdit) {
    insertTextFormat = LSP_PLAIN_TEXT;
  }

  if (item.textEdit) {
    c.range = lspRangeToVsCode(item.textEdit);
    setInsertText(c, item.textEdit.newText, insertTextFormat);
    return c;
  }

  const newText = item.insertText ?? item.label;
  if (!newText) {
    return c;
  }

  const { range, closingSuffix } = completionReplaceRange(line, position, newText, item.label);
  const omitRange = isEmptyReplaceRange(range);
  if (!omitRange) {
    c.range = range;
  }
  setInsertText(c, newText + (closingSuffix ?? ""), insertTextFormat);

  return c;
}
