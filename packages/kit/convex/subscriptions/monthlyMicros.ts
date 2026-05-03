import type { Doc } from "../_generated/dataModel";

// Normalize a subscription's billing-period price to a per-month
// micros figure so MRR can sum across products with different billing
// periods. Formula uses calendar averages — yearly /12, weekly *4.345
// (= 52.14/12), bi-weekly *2.17, daily *30.44 — chosen to land in the
// same order of magnitude as the standard SaaS MRR convention. The
// previous implementation summed `priceAmountMicros` raw, so a $120/yr
// plan inflated MRR by 12×.
//
// Lives in its own file so both `query.ts` (read path) and `stats.ts`
// (incremental aggregation) share the same calculation — splitting it
// into two copies would let MRR drift between the live counter and a
// future scan-based recomputation.
export function monthlyMicrosForSub(
  sub: Doc<"subscriptions">,
  productPeriod: string | undefined,
): number {
  if (typeof sub.priceAmountMicros !== "number") return 0;
  const amount = sub.priceAmountMicros;
  switch (productPeriod) {
    case "P1Y":
      return Math.round(amount / 12);
    case "P6M":
      return Math.round(amount / 6);
    case "P3M":
      return Math.round(amount / 3);
    case "P2M":
      return Math.round(amount / 2);
    case "P1W":
      return Math.round(amount * 4.345);
    case "P3D":
      return Math.round(amount * (30.44 / 3));
    case "P2W":
      return Math.round(amount * (30.44 / 14));
    case "P1M":
      return amount;
    case undefined:
    default:
      // One-time products (NonConsumable / Consumable) and rows
      // with missing billing metadata don't contribute to recurring
      // revenue. The previous fall-through to `amount` inflated MRR
      // by the full sticker price every time a one-time purchase
      // landed in `subscriptions` — which only happens when a
      // catalog row was mis-classified, but a mis-classification
      // shouldn't quietly skew the dashboard headline.
      return 0;
  }
}
