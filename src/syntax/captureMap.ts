/** Map tree-sitter @capture names (from highlights.scm) to VS Code semantic token types. */
export const CAPTURE_TO_TOKEN: Record<string, { type: string; modifiers?: string[] }> = {
  keyword: { type: "keyword" },
  "function.method": { type: "method" },
  constant: { type: "variable", modifiers: ["readonly"] },
  variable: { type: "variable" },
  "character.special": { type: "operator" },
  string: { type: "string" },
  "string.special": { type: "string" },
  "string.special.url": { type: "string" },
  operator: { type: "operator" },
  "punctuation.bracket": { type: "operator" },
  "punctuation.special": { type: "operator" },
  "punctuation.delimiter": { type: "operator" },
  number: { type: "number" },
  comment: { type: "comment" },
  "query_param.name": { type: "property" },
  "query_param.value": { type: "string" },
  form_param_name: { type: "property" },
  form_param_value: { type: "string" },
  external_body_path: { type: "string" },
  redirect_path: { type: "string" },
  "number.special.path": { type: "string" },
};

export const TOKEN_TYPES = [
  "namespace",
  "class",
  "enum",
  "interface",
  "struct",
  "typeParameter",
  "type",
  "parameter",
  "variable",
  "property",
  "enumMember",
  "decorator",
  "event",
  "function",
  "method",
  "macro",
  "label",
  "comment",
  "string",
  "keyword",
  "number",
  "regexp",
  "operator",
] as const;

export const TOKEN_MODIFIERS = [
  "declaration",
  "definition",
  "readonly",
  "static",
  "deprecated",
  "abstract",
  "async",
  "modification",
  "documentation",
  "defaultLibrary",
] as const;

export function resolveCapture(
  captureName: string,
): { type: string; modifiers: string[] } | undefined {
  const direct = CAPTURE_TO_TOKEN[captureName];
  if (direct) {
    return { type: direct.type, modifiers: direct.modifiers ?? [] };
  }

  const parts = captureName.split(".");
  const base = parts[0];
  if (!base) {
    return undefined;
  }

  const fromBase = CAPTURE_TO_TOKEN[base];
  if (fromBase) {
    return { type: fromBase.type, modifiers: fromBase.modifiers ?? [] };
  }

  if ((TOKEN_TYPES as readonly string[]).includes(base)) {
    const mods = parts.slice(1).filter((m) => (TOKEN_MODIFIERS as readonly string[]).includes(m));
    return { type: base, modifiers: mods };
  }

  return undefined;
}
