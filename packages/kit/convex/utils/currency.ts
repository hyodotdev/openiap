import { createError, ErrorCode } from "./errors";

export const DEFAULT_REPORTING_CURRENCY = "USD";

const currencyCodePattern = /^[A-Z]{3}$/;

export function isValidCurrencyCode(code: string): boolean {
  return currencyCodePattern.test(code);
}

function normalizeCurrencyCandidate(input: string | null | undefined): string {
  return input?.trim().toUpperCase() ?? "";
}

export function normalizeReportingCurrencyOrDefault(
  input: string | null | undefined,
): string {
  const normalized = normalizeCurrencyCandidate(input);
  return isValidCurrencyCode(normalized)
    ? normalized
    : DEFAULT_REPORTING_CURRENCY;
}

export function normalizeReportingCurrency(input: string): string {
  const normalized = normalizeCurrencyCandidate(input);
  if (!isValidCurrencyCode(normalized)) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "Reporting currency must be a 3-letter ISO 4217 code (e.g. USD, EUR, GBP).",
    );
  }
  return normalized;
}
