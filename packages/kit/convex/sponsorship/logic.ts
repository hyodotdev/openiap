// Staged sponsorship requests, published on /pricing and in the terms of
// service: an email at $8,000 of monthly subscription revenue, a sponsorship
// request with a 30-day grace period at $9,000. Monthly revenue is production
// subscription MRR plus the last 30 days of charges for products whose billing
// period is unknown, which MRR cannot count. Purchase verification, store
// notifications and webhooks never stop at any stage.

export const ADVISORY_USD = 8_000;
export const REQUEST_USD = 9_000;
export const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
/** The suggested sponsorship is 0.5% of monthly revenue. */
export const SUGGESTED_RATE = 0.005;
/** Days of uncataloged-product charges counted as one month of revenue. */
export const REVENUE_WINDOW_DAYS = 30;

/** The UTC days of the revenue window ending `now`, today included. */
export function revenueWindowDays(now: number): string[] {
  return Array.from({ length: REVENUE_WINDOW_DAYS }, (_, index) =>
    new Date(now - (REVENUE_WINDOW_DAYS - 1 - index) * 86_400_000)
      .toISOString()
      .slice(0, 10),
  );
}

export type SponsorshipStage = "advisory" | "request";

export interface SponsorshipState {
  stage?: SponsorshipStage;
  sponsoredAt?: number;
}

export interface CurrencyAmount {
  currency: string;
  micros: number;
}

/**
 * Sums amounts in US dollars. `usdRates` maps a currency to units per US
 * dollar. A currency without a rate is reported instead of guessed.
 */
export function toUsd(
  rows: CurrencyAmount[],
  usdRates: Record<string, number>,
): { usd: number; unconverted: string[] } {
  let usd = 0;
  const unconverted = new Set<string>();
  for (const row of rows) {
    if (row.micros <= 0) continue;
    const currency = row.currency.toUpperCase();
    const amount = row.micros / 1_000_000;
    if (currency === "USD") {
      usd += amount;
      continue;
    }
    const rate = usdRates[currency];
    if (rate && rate > 0) usd += amount / rate;
    else unconverted.add(currency);
  }
  return { usd, unconverted: [...unconverted].sort() };
}

export interface Page<T> {
  items: T[];
  isDone: boolean;
  continueCursor: string;
}

/**
 * Reads every page of a per-project query, halving the page when one fails on
 * a read limit (large catalog documents), as `runRecomputePage` does. A
 * one-item page that still fails throws.
 */
export async function collectPages<T>(
  fetchPage: (cursor: string | null, numItems: number) => Promise<Page<T>>,
  numItems: number,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    let page: Page<T>;
    try {
      page = await fetchPage(cursor, numItems);
    } catch (error) {
      if (numItems === 1) throw error;
      numItems = Math.ceil(numItems / 2);
      continue;
    }
    items.push(...page.items);
    if (page.isDone) return items;
    cursor = page.continueCursor;
  }
}

/** The email an organization should get now, if any. Each stage is sent once. */
export function nextNotice(
  usd: number,
  state: SponsorshipState | null,
): SponsorshipStage | null {
  if (state?.sponsoredAt !== undefined) return null;
  if (usd >= REQUEST_USD && state?.stage !== "request") return "request";
  if (usd >= ADVISORY_USD && state?.stage === undefined) return "advisory";
  return null;
}

/** The suggested monthly sponsorship, rounded up to whole dollars. */
export function suggestedSponsorshipUsd(usd: number): number {
  return Math.ceil(usd * SUGGESTED_RATE);
}
