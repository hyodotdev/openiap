export const PRODUCT_SYNC_MANUAL_ACTIONS_CAP = 100;
export const PRODUCT_SYNC_MANUAL_ACTION_MESSAGE_CAP = 1_000;
export const PRODUCT_SYNC_PLANNED_WRITES_CAP = 300;
// Convex actions cap at roughly 10 minutes. Stop starting remote work with a
// safety window left for in-flight cleanup and the terminal mutation.
export const PRODUCT_SYNC_JOB_DEADLINE_MS = 9 * 60 * 1_000;
export const PRODUCT_SYNC_DEADLINE_SAFETY_MS = 45 * 1_000;

export function isProductSyncDeadlineReached(
  now: number,
  deadline: number,
): boolean {
  return now >= deadline - PRODUCT_SYNC_DEADLINE_SAFETY_MS;
}

export interface BoundedManualAction {
  productId: string;
  code: string;
  message: string;
}

export interface BoundedPlannedWrite {
  productId: string;
  step: string;
  detail?: string;
}

function truncateText(value: string, cap: number): string {
  if (value.length <= cap) return value;
  return `${value.slice(0, Math.max(0, cap - 1))}…`;
}

/** Keep terminal job documents and mutation arguments below Convex limits. */
export function truncateManualActions<T extends BoundedManualAction>(
  actions: T[],
): { items: T[]; truncated: boolean } {
  const items = actions
    .slice(0, PRODUCT_SYNC_MANUAL_ACTIONS_CAP)
    .map((action) => ({
      ...action,
      productId: truncateText(action.productId, 256),
      code: truncateText(action.code, 128),
      message: truncateText(
        action.message,
        PRODUCT_SYNC_MANUAL_ACTION_MESSAGE_CAP,
      ),
    })) as T[];
  return {
    items,
    truncated:
      actions.length > PRODUCT_SYNC_MANUAL_ACTIONS_CAP ||
      items.some(
        (item, index) =>
          item.productId !== actions[index]?.productId ||
          item.code !== actions[index]?.code ||
          item.message !== actions[index]?.message,
      ),
  };
}

export function truncatePlannedWrites<T extends BoundedPlannedWrite>(
  writes: T[],
): { items: T[]; truncated: boolean } {
  const items = writes
    .slice(0, PRODUCT_SYNC_PLANNED_WRITES_CAP)
    .map((write) => ({
      ...write,
      productId: truncateText(write.productId, 256),
      step: truncateText(write.step, 256),
      ...(write.detail === undefined
        ? {}
        : { detail: truncateText(write.detail, 512) }),
    }));
  return {
    items,
    truncated:
      writes.length > PRODUCT_SYNC_PLANNED_WRITES_CAP ||
      items.some(
        (item, index) =>
          item.productId !== writes[index]?.productId ||
          item.step !== writes[index]?.step ||
          item.detail !== writes[index]?.detail,
      ),
  };
}
