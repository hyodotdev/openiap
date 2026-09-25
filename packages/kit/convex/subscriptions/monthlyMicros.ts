import type { Doc } from "../_generated/dataModel";

// A subscription's price per month, so MRR can sum across billing periods.
// Calendar averages: yearly /12, weekly ×4.345 (52.14/12), bi-weekly ×2.17,
// daily ×30.44. Shared by query.ts and stats.ts so the live counter and a
// recompute cannot drift.
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
      // One-time products and rows without billing metadata add no MRR, even
      // when a mis-classified one lands in `subscriptions`.
      return 0;
  }
}
