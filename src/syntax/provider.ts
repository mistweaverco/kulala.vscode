import * as vscode from "vscode";
import { TOKEN_MODIFIERS, TOKEN_TYPES } from "./captureMap";
import type { HighlightToken, KulalaSyntaxEngine } from "./engine";

const LEGEND = new vscode.SemanticTokensLegend([...TOKEN_TYPES], [...TOKEN_MODIFIERS]);
const LEGEND_TYPES = new Set<string>(TOKEN_TYPES);

function comparePositions(a: vscode.Position, b: vscode.Position): number {
  if (a.line !== b.line) {
    return a.line - b.line;
  }
  return a.character - b.character;
}

function pushToken(
  builder: vscode.SemanticTokensBuilder,
  last: vscode.Position | undefined,
  token: HighlightToken,
): vscode.Position | undefined {
  if (!LEGEND_TYPES.has(token.type)) {
    return last;
  }
  if (last) {
    const cmp = comparePositions(token.range.start, last);
    if (cmp < 0) {
      return last;
    }
  }
  try {
    builder.push(token.range, token.type, token.modifiers);
    return token.range.start;
  } catch {
    return last;
  }
}

export class KulalaSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  private readonly changeEmitter = new vscode.EventEmitter<void>();

  readonly onDidChangeSemanticTokens = this.changeEmitter.event;

  constructor(private readonly engine: KulalaSyntaxEngine) {}

  invalidate(): void {
    this.changeEmitter.fire();
  }

  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): Promise<vscode.SemanticTokens> {
    try {
      const tokens = await this.engine.reparse(document);
      const builder = new vscode.SemanticTokensBuilder(LEGEND);
      let last: vscode.Position | undefined;
      for (const t of tokens) {
        last = pushToken(builder, last, t);
      }
      return builder.build();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Kulala: semantic highlighting failed: ${msg}`);
      return new vscode.SemanticTokensBuilder(LEGEND).build();
    }
  }
}

export function registerSemanticHighlighting(engine: KulalaSyntaxEngine): vscode.Disposable {
  const selector = [{ language: "http" }, { language: "rest" }];
  const provider = new KulalaSemanticTokensProvider(engine);
  const registration = vscode.languages.registerDocumentSemanticTokensProvider(
    selector,
    provider,
    LEGEND,
  );

  let debounce: ReturnType<typeof setTimeout> | undefined;
  const onChange = vscode.workspace.onDidChangeTextDocument((e) => {
    if (e.document.languageId !== "http" && e.document.languageId !== "rest") {
      return;
    }
    if (debounce) {
      clearTimeout(debounce);
    }
    debounce = setTimeout(() => {
      engine.invalidate(e.document.uri.toString());
      provider.invalidate();
    }, 200);
  });

  const onClose = vscode.workspace.onDidCloseTextDocument((doc) => {
    engine.invalidate(doc.uri.toString());
  });

  return vscode.Disposable.from(registration, onChange, onClose);
}

export { LEGEND };
