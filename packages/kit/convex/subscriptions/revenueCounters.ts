// Every counter a revenue rollup row carries. No imports, so the dashboard can
// share it without bundling server code.
export const REVENUE_COUNTERS = [
  "activeSubs",
  "activeTrials",
  "newSubs",
  "trialStarts",
  "trialConversions",
  "directPaidStarts",
  "renewals",
  "cancellations",
  "expirations",
  "refunds",
  "revenueMicros",
  "refundedMicros",
] as const;

export type RevenueCounters = Record<(typeof REVENUE_COUNTERS)[number], number>;

export function zeroRevenueCounters(): RevenueCounters {
  return {
    activeSubs: 0,
    activeTrials: 0,
    newSubs: 0,
    trialStarts: 0,
    trialConversions: 0,
    directPaidStarts: 0,
    renewals: 0,
    cancellations: 0,
    expirations: 0,
    refunds: 0,
    revenueMicros: 0,
    refundedMicros: 0,
  };
}
