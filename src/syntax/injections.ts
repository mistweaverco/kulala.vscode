import type { Query, Tree } from "web-tree-sitter";
import * as vscode from "vscode";
import { isInjectedLanguage, type InjectedLanguage } from "./grammars";

export type InjectionSpan = {
  language: InjectedLanguage;
  startIndex: number;
  endIndex: number;
};

const SKIP_LANGUAGES = new Set(["comment"]);

export function collectInjectionSpans(tree: Tree, injectionQuery: Query): InjectionSpan[] {
  const spans: InjectionSpan[] = [];

  for (const match of injectionQuery.matches(tree.rootNode)) {
    const lang =
      match.setProperties?.["injection.language"] ??
      match.captures.find((c) => c.setProperties?.["injection.language"])?.setProperties?.[
        "injection.language"
      ];

    if (!lang || SKIP_LANGUAGES.has(lang) || !isInjectedLanguage(lang)) {
      continue;
    }

    for (const capture of match.captures) {
      if (capture.name !== "injection.content") {
        continue;
      }

      const { node } = capture;
      spans.push({
        language: lang,
        startIndex: node.startIndex,
        endIndex: node.endIndex,
      });
    }
  }

  return dedupeSpans(spans);
}

function dedupeSpans(spans: InjectionSpan[]): InjectionSpan[] {
  const out: InjectionSpan[] = [];
  for (const span of spans) {
    const dup = out.find(
      (s) =>
        s.language === span.language &&
        s.startIndex === span.startIndex &&
        s.endIndex === span.endIndex,
    );
    if (!dup) {
      out.push(span);
    }
  }
  return out;
}

export function injectionRange(document: vscode.TextDocument, span: InjectionSpan): vscode.Range {
  return new vscode.Range(document.positionAt(span.startIndex), document.positionAt(span.endIndex));
}

export function rangeContains(outer: vscode.Range, inner: vscode.Range): boolean {
  return outer.contains(inner.start) && outer.contains(inner.end);
}

export function shiftRange(range: vscode.Range, base: vscode.Position): vscode.Range {
  const start =
    range.start.line === 0
      ? new vscode.Position(base.line, base.character + range.start.character)
      : new vscode.Position(base.line + range.start.line, range.start.character);
  const end =
    range.end.line === 0
      ? new vscode.Position(base.line, base.character + range.end.character)
      : new vscode.Position(base.line + range.end.line, range.end.character);
  return new vscode.Range(start, end);
}
