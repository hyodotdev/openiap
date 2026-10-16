import { v, type Infer } from "convex/values";

// Analytics never feeds entitlement decisions. Unknown history stays unknown.
const evidenceValidator = v.object({
  effectiveAt: v.number(),
  sourceAt: v.number(),
  sourceCreatedAt: v.number(),
  active: v.optional(v.boolean()),
  expiresAt: v.optional(v.number()),
});

export const accessHistoryValidator = v.object({
  latest: v.optional(evidenceValidator),
  checkpoints: v.array(
    v.object({ at: v.number(), evidence: evidenceValidator }),
  ),
});
export type AccessHistory = Infer<typeof accessHistoryValidator>;
export type AccessEvidence = Infer<typeof evidenceValidator>;

export const ACCESS_HISTORY_MONTHS = 24;
export const ACCESS_HISTORY_DAYS = 30;
// Full histories are about 12 KB; keep subscription scans inside the read budget.
export const SUBSCRIPTION_SCAN_PAGE_SIZE = 250;
export const SUBSCRIPTION_SCAN_BYTES = 8 * 1024 * 1024;
const DAY = 86_400_000;

function checkpointTimes(now: number): number[] {
  const date = new Date(now);
  const today = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const times = new Set<number>();
  for (let i = 0; i < ACCESS_HISTORY_DAYS; i++) times.add(today - i * DAY - 1);
  for (let i = 0; i < ACCESS_HISTORY_MONTHS; i++) {
    times.add(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - i, 1) - 1);
  }
  return [...times].sort((a, b) => a - b);
}

function newer(a: AccessEvidence, b: AccessEvidence | undefined): boolean {
  return (
    !b ||
    a.effectiveAt > b.effectiveAt ||
    (a.effectiveAt === b.effectiveAt &&
      (a.sourceAt > b.sourceAt ||
        (a.sourceAt === b.sourceAt && a.sourceCreatedAt > b.sourceCreatedAt)))
  );
}

function evidenceAt(
  history: AccessHistory | undefined,
  at: number,
): AccessEvidence | undefined {
  const point = history?.checkpoints.find((point) => point.at === at)?.evidence;
  const latest = history?.latest;
  return latest && latest.effectiveAt <= at && newer(latest, point)
    ? latest
    : point;
}

export function accessAt(
  history: AccessHistory | undefined,
  at: number,
): boolean | null {
  const evidence = evidenceAt(history, at);
  if (evidence?.active === undefined) return null;
  return (
    evidence.active &&
    (evidence.expiresAt === undefined || evidence.expiresAt > at)
  );
}

// Before replacing latest, preserve its proof at the bounded UTC cutoffs.
// An aliased predecessor can correct only points before its replacement.
export function foldAccessHistory(
  history: AccessHistory | undefined,
  evidence: readonly AccessEvidence[],
  now: number,
  before?: number | null,
): AccessHistory {
  const checkpoints: AccessHistory["checkpoints"] = [];
  for (const at of checkpointTimes(now)) {
    let selected = evidenceAt(history, at);
    if (before !== null && (before === undefined || at < before)) {
      for (const candidate of evidence) {
        if (candidate.effectiveAt <= at && newer(candidate, selected))
          selected = candidate;
      }
    }
    if (selected) checkpoints.push({ at, evidence: selected });
  }
  let latest = history?.latest;
  if (before === undefined) {
    for (const candidate of evidence)
      if (newer(candidate, latest)) latest = candidate;
  }
  return { ...(latest ? { latest } : {}), checkpoints };
}

// A predecessor's later expiry is never authority over its successor.
export function replaceAccessHistory(
  predecessor: AccessHistory | undefined,
  successor: AccessHistory | undefined,
  replacementAt: number | undefined,
  now: number,
): AccessHistory {
  const checkpoints: AccessHistory["checkpoints"] = [];
  if (replacementAt !== undefined) {
    for (const at of checkpointTimes(now)) {
      const evidence = evidenceAt(
        at < replacementAt ? predecessor : successor,
        at,
      );
      if (evidence) checkpoints.push({ at, evidence });
    }
  }
  return {
    ...(successor?.latest ? { latest: successor.latest } : {}),
    checkpoints,
  };
}

type AccessEvent = {
  platform: "IOS" | "Android";
  type: string;
  occurredAt: number;
  _creationTime?: number;
  purchaseDate?: number;
  revocationDate?: number;
  snapshotObservedAt?: number;
  subscriptionState?: string;
  expiresAt?: number;
  refundReversal?: boolean;
  effectiveImmediately?: boolean;
};

// A fetched Play status describes observation time, not the old RTDN's time.
// Apple charge/revocation dates describe the actual access boundary.
export function eventAccessEvidence(event: AccessEvent): AccessEvidence[] {
  const base = {
    sourceAt: event.occurredAt,
    sourceCreatedAt: event._creationTime ?? event.occurredAt,
  };
  if (event.platform === "Android" && event.snapshotObservedAt !== undefined) {
    if (!event.subscriptionState) return [];
    const active =
      event.subscriptionState === "Unknown"
        ? undefined
        : event.subscriptionState === "Active" ||
          event.subscriptionState === "InGracePeriod";
    return [
      ...(event.occurredAt < event.snapshotObservedAt
        ? [{ ...base, effectiveAt: event.occurredAt }]
        : []),
      {
        ...base,
        effectiveAt: event.snapshotObservedAt,
        ...(active !== undefined ? { active } : {}),
        ...(event.expiresAt !== undefined
          ? { expiresAt: event.expiresAt }
          : {}),
      },
    ];
  }
  if (
    event.type === "PurchaseRefunded" ||
    event.type === "SubscriptionRevoked"
  ) {
    const effectiveAt =
      event.platform === "IOS" ? event.revocationDate : event.occurredAt;
    return [
      {
        ...base,
        effectiveAt: effectiveAt ?? event.occurredAt,
        ...(effectiveAt !== undefined ? { active: false } : {}),
      },
    ];
  }
  if (
    event.type === "SubscriptionExpired" ||
    event.type === "SubscriptionInBillingRetry" ||
    event.type === "SubscriptionPaused"
  ) {
    return [
      {
        ...base,
        effectiveAt: event.expiresAt ?? event.occurredAt,
        active: false,
      },
    ];
  }
  if (
    event.type === "SubscriptionStarted" ||
    event.type === "SubscriptionRenewed" ||
    event.type === "SubscriptionRecovered" ||
    event.type === "SubscriptionInGracePeriod" ||
    (event.type === "SubscriptionProductChanged" &&
      event.effectiveImmediately === true)
  ) {
    const effectiveAt =
      event.refundReversal ||
      event.type === "SubscriptionInGracePeriod" ||
      event.platform === "Android"
        ? event.occurredAt
        : event.purchaseDate;
    return [
      {
        ...base,
        effectiveAt: effectiveAt ?? event.occurredAt,
        ...(effectiveAt !== undefined ? { active: true } : {}),
        ...(event.expiresAt !== undefined
          ? { expiresAt: event.expiresAt }
          : {}),
      },
    ];
  }
  if (event.type === "SubscriptionDeferred")
    return [{ ...base, effectiveAt: event.occurredAt }];
  return [];
}
