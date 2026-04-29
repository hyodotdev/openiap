import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

// Shown once per browser to orgs that had a billing relationship before
// the 2026-04 free transition. Uses localStorage (not user profile) so
// we don't need a schema change for a throwaway one-time banner —
// dismissing resets a browser-scoped flag, which is acceptable since
// the target audience is tiny (ex-paying orgs) and re-seeing it on a
// second device does no harm.
// v2: v1 was dismissed-on-click-through (accidentally) for anyone
// who opened the blog link before the behavior was scoped to the
// explicit X button only. Bump the key to invalidate those stale
// dismissals so the target audience actually sees the banner.
const DISMISS_KEY = "iapkit.freeTransitionNoticeDismissed.v2";

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage?.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(DISMISS_KEY, "1");
  } catch {
    // private mode / disabled storage — banner will simply come back
    // on next load, which is an acceptable soft-degradation.
  }
}

export function FreeTransitionNotice({
  hadBillingRelationship,
}: {
  hadBillingRelationship: boolean;
}) {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed || !hadBillingRelationship) return null;

  const handleDismiss = () => {
    setDismissed(true);
    writeDismissed();
  };

  return (
    <div className="mx-6 mt-6 relative overflow-hidden rounded-lg bg-amber-50 dark:bg-amber-950/40 p-5 pl-6">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-amber-400 dark:bg-amber-500"
      />
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={"Dismiss notice"}
        className="absolute top-3 right-3 rounded-md p-1.5 text-amber-700/70 transition-colors hover:bg-amber-100 hover:text-amber-900 dark:text-amber-200/70 dark:hover:bg-amber-900/40 dark:hover:text-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-8">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-50">
            {"IAPKit is now free for everyone."}
          </h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-amber-900/80 dark:text-amber-100/85">
          {
            "Thank you for supporting IAPKit. Your subscription has been cancelled and any unused portion refunded in full — there's nothing you need to do. The validation APIs you were using keep working, without limits."
          }
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <Link
            to="/blog/iapkit-joins-openiap"
            className="font-medium text-amber-800 underline-offset-4 hover:underline dark:text-amber-300"
          >
            {"Read the announcement →"}
          </Link>
          <a
            href="https://www.openiap.dev/sponsors"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-900/70 underline-offset-4 hover:text-amber-900 hover:underline dark:text-amber-100/70 dark:hover:text-amber-100"
          >
            {"Sponsor OpenIAP"}
          </a>
        </div>
      </div>
    </div>
  );
}
