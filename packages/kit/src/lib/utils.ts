import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_REPORTING_CURRENCY = "USD";

/** `YYYY-MM-DD HH:MM:SS` in UTC, so operators compare it with store consoles. */
export function formatUtcDateTime(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 19).replace("T", " ");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Epoch ms for a `YYYY-MM-DD` date input, read as a UTC day. */
export function utcDayStart(day: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const value = Date.parse(`${day}T00:00:00.000Z`);
  return Number.isFinite(value) ? value : undefined;
}

/** The last epoch ms of a `YYYY-MM-DD` UTC day. */
export function utcDayEnd(day: string): number | undefined {
  const start = utcDayStart(day);
  return start === undefined ? undefined : start + DAY_MS - 1;
}

export const currencyCodePattern = /^[A-Z]{3}$/;

export function normalizeCurrencyCode(
  input: string | null | undefined,
  fallback = DEFAULT_REPORTING_CURRENCY,
): string {
  const normalized = input?.trim().toUpperCase() ?? "";
  if (currencyCodePattern.test(normalized)) {
    return normalized;
  }
  return fallback;
}

export interface FormatMicrosOptions {
  currency?: string | null;
  compact?: boolean;
  emptyWhenZero?: boolean;
}

export function formatMicros(
  micros: number,
  {
    currency,
    compact = false,
    emptyWhenZero = false,
  }: FormatMicrosOptions = {},
): string {
  if (!micros) {
    if (emptyWhenZero) return "—";
    if (compact) return "0";
    return `${currency ?? ""} 0.00`.trim();
  }

  const value = micros / 1_000_000;
  if (compact) {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    if (value < 10) return value.toFixed(2);
    return value.toFixed(0);
  }

  return `${currency ?? ""} ${value.toFixed(2)}`.trim();
}
