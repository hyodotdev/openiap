import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_REPORTING_CURRENCY = "USD";

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
