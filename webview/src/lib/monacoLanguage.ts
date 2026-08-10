/** Map body kind / content-type to a Monaco language id. */
export function monacoLanguage(bodyKind?: string, contentType?: string): string {
  if (bodyKind === "json") return "json";

  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("json") || ct.includes("+json")) return "json";
  if (ct.includes("xml") || ct.includes("+xml")) return "xml";
  if (ct.includes("html")) return "html";
  if (ct.includes("javascript") || ct.includes("ecmascript")) return "javascript";
  if (ct.includes("css")) return "css";
  if (ct.includes("yaml") || ct.includes("yml")) return "yaml";
  if (ct.includes("markdown")) return "markdown";
  if (ct.includes("sql")) return "sql";
  if (ct.includes("graphql")) return "graphql";

  return "plaintext";
}
