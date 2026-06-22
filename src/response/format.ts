import type { KulalaRequestResult } from "../core/types";
import { scriptLogLines } from "./tests";

export type StatusBadge = "success" | "info" | "warning" | "error" | "neutral";

export type HeaderRow = { name: string; value: string };
export type TimingRow = { phase: string; ms: number };
export type ConsoleRow = { level: string; message: string };

const TIMING_ORDER: Array<[keyof NonNullable<KulalaRequestResult["timings"]>, string]> = [
  ["dns", "DNS"],
  ["tcp", "TCP"],
  ["tls", "TLS"],
  ["request", "Request"],
  ["redirect", "Redirect"],
  ["firstByte", "TTFB"],
  ["startTransfer", "Start transfer"],
  ["total", "Total"],
];

export function prettyMs(ms: number | undefined): string {
  if (ms === undefined || Number.isNaN(ms)) return "-";
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function statusBadge(status: number | string | undefined): StatusBadge {
  if (typeof status === "string") {
    const s = status.toLowerCase();
    if (s === "error" || s === "failed") return "error";
    if (s === "websocket") return "info";
    return "neutral";
  }
  if (typeof status !== "number" || status <= 0) return "neutral";
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "info";
  if (status >= 400 && status < 500) return "warning";
  if (status >= 500) return "error";
  return "neutral";
}

export function badgeClass(badge: StatusBadge): string {
  switch (badge) {
    case "success":
      return "kulala-badge-success";
    case "info":
      return "kulala-badge-info";
    case "warning":
      return "kulala-badge-warning";
    case "error":
      return "kulala-badge-error";
    default:
      return "kulala-badge-ghost";
  }
}

export function headerRows(headers: Record<string, string> | undefined): HeaderRow[] {
  if (!headers) return [];
  return Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map(([name, value]) => ({ name, value }));
}

export function timingRows(timings: KulalaRequestResult["timings"] | undefined): TimingRow[] {
  if (!timings) return [];
  const rows: TimingRow[] = [];
  for (const [key, label] of TIMING_ORDER) {
    const ms = timings[key];
    if (typeof ms === "number" && !Number.isNaN(ms)) {
      rows.push({ phase: label, ms });
    }
  }
  return rows;
}

export function totalDurationMs(
  timings: KulalaRequestResult["timings"] | undefined,
): number | undefined {
  const total = timings?.total;
  return typeof total === "number" ? total : undefined;
}

export function consoleRows(item: KulalaRequestResult): ConsoleRow[] {
  return scriptLogLines(item.scriptConsole).map((l) => ({
    level: l.level,
    message: l.message,
  }));
}

export function consoleLevelClass(level: string): string {
  switch (level) {
    case "error":
      return "text-error";
    case "warn":
      return "text-warning";
    case "info":
      return "text-info";
    case "debug":
      return "opacity-70";
    default:
      return "";
  }
}
