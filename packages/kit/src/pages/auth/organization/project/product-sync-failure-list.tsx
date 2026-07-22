import type { ReactElement } from "react";

export interface ProductSyncFailure {
  productId: string;
  reason: string;
}

interface ProductSyncFailureListProps {
  failures: readonly ProductSyncFailure[];
}

/** Render persisted sync failures so completed jobs remain diagnosable. */
export function ProductSyncFailureList({
  failures,
}: ProductSyncFailureListProps): ReactElement | null {
  if (failures.length === 0) return null;

  return (
    <ul aria-label="Sync failures" className="mt-1 list-disc space-y-0.5 pl-4">
      {failures.map((failure, index) => (
        <li
          key={`${failure.productId}:${failure.reason}:${index}`}
          className="break-words"
        >
          <span className="font-medium">{failure.productId}</span>
          {": "}
          {failure.reason}
        </li>
      ))}
    </ul>
  );
}
