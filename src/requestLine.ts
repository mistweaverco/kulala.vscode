import * as vscode from "vscode";
import type { KulalaDocument } from "./core/types";

/** First line of an HTTP/gRPC/WebSocket request (JetBrains / REST Client style). */
const REQUEST_LINE_RE = /^(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|GRAPHQL|GRPC|WS|WSS)\s+/i;

type ParsedBlock = KulalaDocument["blocks"][number];

/** 0-based editor line for the request start, or undefined when the block has no request line. */
export function requestStartLine0(
  document: vscode.TextDocument,
  block: ParsedBlock,
): number | undefined {
  if (block.runExpander && !block.request?.method) {
    return undefined;
  }

  if (typeof block.contentStartLine === "number" && block.contentStartLine > 0) {
    return block.contentStartLine - 1;
  }

  const start1 = block.position?.start ?? 1;
  const end1 = block.position?.end ?? start1;
  const start0 = Math.max(0, start1 - 1);
  const end0 = Math.min(document.lineCount, end1);

  for (let line = start0; line < end0; line++) {
    const trimmed = document.lineAt(line).text.trim();
    if (REQUEST_LINE_RE.test(trimmed)) {
      return line;
    }
  }

  return undefined;
}

const BLOCK_NAME_LINE_RE = /^###\s+/;

/**
 * 0-based line for the "Send Request" CodeLens / gutter affordance.
 * Uses the `###` block title when present; otherwise the HTTP request line.
 */
export function codeLensLine0(
  document: vscode.TextDocument,
  block: ParsedBlock,
): number | undefined {
  const start0 = Math.max(0, (block.position?.start ?? 1) - 1);
  const end0 = Math.min(document.lineCount, block.position?.end ?? start0 + 1);

  for (let line = start0; line < end0; line++) {
    if (BLOCK_NAME_LINE_RE.test(document.lineAt(line).text.trim())) {
      return line;
    }
  }

  return requestStartLine0(document, block);
}

/** Find the request line after a `###` heading (fallback when parse is unavailable). */
export function requestLineAfterHeading0(
  document: vscode.TextDocument,
  headingLine0: number,
): number {
  const limit = Math.min(document.lineCount, headingLine0 + 500);
  for (let line = headingLine0 + 1; line < limit; line++) {
    const trimmed = document.lineAt(line).text.trim();
    if (/^###\s+/.test(trimmed)) {
      break;
    }
    if (REQUEST_LINE_RE.test(trimmed)) {
      return line;
    }
  }
  return headingLine0;
}
