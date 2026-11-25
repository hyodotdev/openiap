import { SECTION_LABEL, SummaryPanel } from "@/components/SummaryPanel";
import { cn } from "@/lib/utils";
import { storeIndicatorConfig, type StoreIndicatorKey } from "./receipt-utils";

export type PurchaseStats = {
  total: number;
  apple: number;
  google: number;
  horizon: number;
  amazon: number;
  // Distinct Play Console orderIds. Pending-acknowledgement and error rows
  // count in `google` but carry no orderId, so the store row shows this.
  googleOrders: number;
  valid: number;
  invalid: number;
};

type Props = {
  stats: PurchaseStats;
  storeFilter?: StoreIndicatorKey;
  isValidFilter?: boolean;
  /** Any filter narrows the list, including ones this panel does not set. */
  filtered: boolean;
  onReset: () => void;
  onStore: (store: StoreIndicatorKey) => void;
  onValidity: (isValid: boolean) => void;
};

const STORES: StoreIndicatorKey[] = ["apple", "google", "amazon", "horizon"];

const ROW =
  "group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

/** Purchase totals in one panel; every figure filters the list below. */
export function PurchasesSummary({
  stats,
  storeFilter,
  isValidFilter,
  filtered,
  onReset,
  onStore,
  onValidity,
}: Props) {
  // Total, valid and invalid count rows, so total === valid + invalid.
  const storeCounts: Record<StoreIndicatorKey, number> = {
    apple: stats.apple,
    google: stats.googleOrders,
    amazon: stats.amazon,
    horizon: stats.horizon,
  };
  const largest = Math.max(1, ...Object.values(storeCounts));
  const unfiltered = !filtered;
  const validity = [
    { isValid: true, label: "Valid", count: stats.valid, dot: "bg-success" },
    {
      isValid: false,
      label: "Invalid",
      count: stats.invalid,
      dot: "bg-danger",
    },
  ];

  return (
    <SummaryPanel label="Purchase summary">
      <div className="grid divide-y divide-border @4xl:grid-cols-[13rem_minmax(0,1fr)_17rem] @4xl:divide-x @4xl:divide-y-0">
        <button
          type="button"
          aria-label="Total Purchases"
          aria-pressed={unfiltered}
          onClick={onReset}
          className="p-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
        >
          <span className={SECTION_LABEL}>{"Total purchases"}</span>
          <span className="mt-2 block text-4xl font-semibold tracking-tight tabular-nums">
            {stats.total.toLocaleString()}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {unfiltered ? "Showing every purchase" : "Show every purchase"}
          </span>
        </button>

        <div className="p-3">
          <p className={cn(SECTION_LABEL, "px-2 pt-1")}>{"By store"}</p>
          <ul className="mt-1.5">
            {STORES.map((store) => {
              const { icon: Icon, label } = storeIndicatorConfig[store];
              const count = storeCounts[store];
              const active = storeFilter === store;
              return (
                <li key={store}>
                  <button
                    type="button"
                    aria-label={label}
                    aria-pressed={active}
                    onClick={() => onStore(store)}
                    className={ROW}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "w-32 shrink-0 truncate",
                        active
                          ? "font-medium text-foreground"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {label}
                    </span>
                    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          active ? "bg-primary" : "bg-foreground/25",
                        )}
                        style={{ width: `${(count / largest) * 100}%` }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-right font-medium tabular-nums">
                      {count.toLocaleString()}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2 pt-1.5 text-xs text-muted-foreground">
            {
              "Google Play counts distinct Play Console orders; the other stores count saved purchases."
            }
          </p>
        </div>

        <div className="p-3">
          <p className={cn(SECTION_LABEL, "px-2 pt-1")}>{"Validity"}</p>
          <div
            className="mx-2 mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted"
            aria-hidden="true"
          >
            {stats.total > 0 ? (
              <>
                <span
                  className="bg-success"
                  style={{ width: `${(stats.valid / stats.total) * 100}%` }}
                />
                <span className="flex-1 bg-danger" />
              </>
            ) : null}
          </div>
          <ul className="mt-2">
            {validity.map(({ isValid, label, count, dot }) => {
              const active = isValidFilter === isValid;
              return (
                <li key={label}>
                  <button
                    type="button"
                    aria-label={label}
                    aria-pressed={active}
                    onClick={() => onValidity(isValid)}
                    className={ROW}
                  >
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", dot)}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "flex-1",
                        active
                          ? "font-medium text-foreground"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {label}
                    </span>
                    <span className="font-medium tabular-nums">
                      {count.toLocaleString()}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </SummaryPanel>
  );
}
