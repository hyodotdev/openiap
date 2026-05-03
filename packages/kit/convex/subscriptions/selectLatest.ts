export type UpdatedSubscriptionCandidate = {
  updatedAt: number;
  _creationTime?: number;
};

export function selectMostRecentlyUpdatedSubscription<
  T extends UpdatedSubscriptionCandidate,
>(subscriptions: readonly T[]): T | null {
  let selected: T | null = null;
  for (const subscription of subscriptions) {
    if (!selected) {
      selected = subscription;
      continue;
    }
    if (subscription.updatedAt > selected.updatedAt) {
      selected = subscription;
      continue;
    }
    if (
      subscription.updatedAt === selected.updatedAt &&
      (subscription._creationTime ?? 0) > (selected._creationTime ?? 0)
    ) {
      selected = subscription;
    }
  }
  return selected;
}
