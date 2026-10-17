import { useState } from "react";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { api, type Id } from "@/convex";
import { convexErrorMessage } from "@/lib/appError";
import { cn } from "@/lib/utils";

type ResyncResult = FunctionReturnType<
  typeof api.subscriptions.action.resyncFromStore
>;

function describeResync(result: ResyncResult): string {
  const purchase = result.purchase
    ? result.purchase.changed
      ? `Purchase is now ${result.purchase.state}.`
      : "Purchase already matched the store."
    : null;
  const subscription = result.subscription
    ? result.subscription.status === "updated"
      ? `Subscription is now ${result.subscription.state ?? "updated"}.`
      : result.subscription.status === "superseded"
        ? "A newer purchase replaced this subscription token."
        : "Subscription already matched the store."
    : null;
  return [purchase, subscription].filter(Boolean).join(" ");
}

/** Admin action; callers render it only for owners and admins. */
export function ResyncFromStoreButton({
  projectId,
  target,
  label = "Re-sync from store",
}: {
  projectId: Id<"projects">;
  target: { purchaseId: string } | { subscriptionId: string };
  label?: string;
}) {
  const resync = useAction(api.subscriptions.action.resyncFromStore);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      toast.success(describeResync(await resync({ projectId, ...target })));
    } catch (error) {
      toast.error(convexErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void run()}
      className="inline-flex shrink-0 items-center gap-1.5 rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
      {label}
    </button>
  );
}
