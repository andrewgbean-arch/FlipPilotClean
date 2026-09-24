export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Treat timezone-less ISO strings as UTC, per the API contract.
  const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(value);
  const d = new Date(hasZone || !/T|\d\d:\d\d/.test(value) ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const rtf = typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }) : null;

export function timeAgo(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "never";
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (abs >= secs) {
      const n = Math.round(diff / secs);
      return rtf ? rtf.format(n, unit) : `${Math.abs(n)} ${unit}${Math.abs(n) === 1 ? "" : "s"} ${n < 0 ? "ago" : "from now"}`;
    }
  }
  return "just now";
}

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleString(undefined, opts);
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDate(value, { dateStyle: "medium", timeStyle: "short" });
}

export function formatTime(value: string | null | undefined): string {
  return formatDate(value, { hour: "numeric", minute: "2-digit" });
}

export function compactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/**
 * Converts a value on a known scale to 0-100. The scale is explicit because both
 * scales appear in the API: confidence, importance_score and relevance scores are 0-1;
 * emotions, traits, relationship metrics and interest strength are 0-100.
 */
export function toPercent(n: number | null | undefined, max: 1 | 100 = 100): number {
  if (n === null || n === undefined || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, (n / max) * 100));
}

export function pct(n: number | null | undefined, max: 1 | 100 = 100, digits = 0): string {
  return `${toPercent(n, max).toFixed(digits)}%`;
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function humanize(s: string): string {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "—";
  if (seconds % 86400 === 0) return `every ${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `every ${seconds / 3600}h`;
  if (seconds % 60 === 0) return `every ${seconds / 60}m`;
  return `every ${seconds}s`;
}

export function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
