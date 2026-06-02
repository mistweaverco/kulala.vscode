/** WebSocket jq input is a JSON array of messages. Adapt filters accordingly. */
export function adaptWsJqFilter(filter: string, bodyRaw: string): string {
  if (!filter || bodyRaw.trim().charAt(0) !== "[") return filter;

  const objects = '([.[] | select(type == "object")]';

  const idxMatch = filter.match(/^(\.\[-?\d+\])(.*)$/);
  if (idxMatch) {
    const idx = idxMatch[1];
    const rest = idxMatch[2] ?? "";
    const base = idx === ".[-1]" ? `${objects} | last)` : `${objects} | ${idx})`;
    return rest ? base + rest : base;
  }

  if (filter.startsWith("..") || /^\.\s*\[/.test(filter)) return filter;
  if (filter === "." || /^\.\w/.test(filter)) {
    return `${objects} | ${filter})`;
  }
  return filter;
}

export function normalizeWsFilterForInput(filter: string, jqInput: string): string {
  if (jqInput.trim().charAt(0) !== "[") {
    const rest = filter.match(/^(\.\[-?\d+\])(.+)$/)?.[2];
    if (rest) return rest;
    if (/^\.\[-?\d+\]$/.test(filter)) return ".";
  }
  return adaptWsJqFilter(filter, jqInput);
}

export function buildWsJqSource(messages: string[]): string {
  const items: unknown[] = [];
  for (const raw of messages) {
    try {
      items.push(JSON.parse(raw));
    } catch {
      items.push(raw);
    }
  }
  return items.length > 0 ? JSON.stringify(items) : "";
}

export function buildWsJqObjectSource(
  messages: string[],
  initialMessage?: string,
): { input: string; hasObjects: boolean } {
  const objects: unknown[] = [];
  for (const raw of messages) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        objects.push(parsed);
      }
    } catch {
      /* plain text message */
    }
  }
  if (objects.length === 0 && initialMessage) {
    try {
      const parsed = JSON.parse(initialMessage);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { input: JSON.stringify(parsed), hasObjects: true };
      }
    } catch {
      /* ignore */
    }
  }
  if (objects.length === 0) return { input: "", hasObjects: false };
  if (objects.length === 1) return { input: JSON.stringify(objects[0]), hasObjects: true };
  return { input: JSON.stringify(objects), hasObjects: true };
}

export function buildWsDisplayStream(messages: string[]): string {
  if (!messages.length) return "";
  return messages.map((raw) => `=> ${raw}`).join("\n");
}

export function isEmptyJqDisplay(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === "" || trimmed === "null";
}
