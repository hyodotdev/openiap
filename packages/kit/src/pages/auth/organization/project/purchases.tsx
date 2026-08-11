import { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "convex/react";
import { api, HarmonizedPurchaseState, Id } from "@/convex";
import { PageLoading } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { getPurchaseStateDisplay } from "./receipt-utils";
import { PurchasesTable } from "./PurchasesTable";
import { Select, Input } from "antd";
import { MixpanelEvent, trackEvent } from "@/lib/mixpanel";

interface ProjectData {
  _id: Id<"projects">;
  organizationId: Id<"organizations">;
  name: string;
  slug: string;
  platform?: string;
}

interface OutletContext {
  project: ProjectData;
}

type PurchaseStats = {
  total: number;
  apple: number;
  google: number;
  horizon: number;
  amazon: number;
  // Count of distinct Play Console orderIds across the project's Google
  // purchases. Diverges from `google` when pending-acknowledgement or
  // error rows exist (those inflate `google` but carry no orderId).
  // Used by the "Google Play" card only so customers see Play
  // Console-matching numbers there instead of validation-call counts;
  // the "Total" / "Valid" / "Invalid" cards still use the raw row
  // counts on `stats.total` / `stats.valid` / `stats.invalid` so
  // `total === valid + invalid` continues to hold and Horizon rows
  // stay represented in the total.
  googleOrders: number;
  valid: number;
  invalid: number;
};

type CardKey =
  | "total"
  | "apple"
  | "google"
  | "horizon"
  | "amazon"
  | "valid"
  | "invalid";
type StoreFilter = "apple" | "google" | "horizon" | "amazon";

const STATS_LABELS: Record<CardKey, string> = {
  total: "Total Purchases",
  apple: "App Store",
  google: "Google Play",
  horizon: "Meta Horizon",
  amazon: "Amazon Appstore",
  valid: "Valid",
  invalid: "Invalid",
};

export default function ProjectPurchases() {
  const PAGE_SIZE = 25;
  const navigate = useNavigate();
  const { project } = useOutletContext<OutletContext>();
  const { orgSlug = "", projectSlug = "" } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const stateParam = searchParams.get("state");
  const stateFilter = useMemo(() => {
    if (
      stateParam &&
      (Object.values(HarmonizedPurchaseState) as string[]).includes(stateParam)
    ) {
      return stateParam as HarmonizedPurchaseState;
    }
    return undefined;
  }, [stateParam]);

  const isValidParam = searchParams.get("isValid");
  const isValidFilter =
    isValidParam === "true"
      ? true
      : isValidParam === "false"
        ? false
        : undefined;

  const requestIpQuery = searchParams.get("ip") ?? "";
  const storeParam = searchParams.get("store");
  const storeFilter =
    storeParam === "apple" ||
    storeParam === "google" ||
    storeParam === "horizon" ||
    storeParam === "amazon"
      ? storeParam
      : undefined;
  const sortFieldParam = searchParams.get("sortField") ?? "_creationTime";
  const sortDirectionParam = searchParams.get("sortDirection") ?? "desc";
  const sortField: "_creationTime" | "updatedAt" | "verificationDurationMs" =
    sortFieldParam === "updatedAt" ||
    sortFieldParam === "verificationDurationMs"
      ? sortFieldParam
      : "_creationTime";
  const sortDirection: "asc" | "desc" =
    sortDirectionParam === "asc" ? "asc" : "desc";
  const cursorParam = searchParams.get("cursor");
  const cursorStackParam = searchParams.get("cursorStack");
  const cursorStack = useMemo(
    () =>
      cursorStackParam
        ? cursorStackParam
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
    [cursorStackParam],
  );

  const paginatedPurchases = useQuery(
    api.purchases.query.getReceiptsByProject,
    project
      ? {
          projectId: project._id,
          paginationOpts: {
            numItems: PAGE_SIZE,
            cursor: cursorParam ?? null,
          },
          store: storeFilter,
          sortField,
          sortDirection,
          state: stateFilter,
          isValid: isValidFilter,
          requestIpQuery: requestIpQuery || undefined,
        }
      : "skip",
  );

  type PurchaseResult = NonNullable<typeof paginatedPurchases>;
  type PurchaseRow = PurchaseResult["page"][number];

  const [cachedPurchases, setCachedPurchases] = useState<PurchaseResult | null>(
    null,
  );

  useEffect(() => {
    if (paginatedPurchases) {
      setCachedPurchases(paginatedPurchases);
    }
  }, [paginatedPurchases]);

  // Fire `viewed_purchases` once per projectId mount. This is the
  // "are they watching their own data?" signal we want for retention
  // cohorts; autocapture's pageview is too coarse (it fires on every
  // route change, including filter clicks that bump the URL).
  useEffect(() => {
    if (!project?._id) return;
    trackEvent(MixpanelEvent.ViewedPurchases, {
      projectId: project._id,
    });
  }, [project?._id]);

  const activePurchases = paginatedPurchases ?? cachedPurchases;

  const stats = useMemo<PurchaseStats>(() => {
    if (!activePurchases?.stats) {
      return {
        total: 0,
        apple: 0,
        google: 0,
        horizon: 0,
        amazon: 0,
        googleOrders: 0,
        valid: 0,
        invalid: 0,
      };
    }
    return {
      total: activePurchases.stats.total,
      apple: activePurchases.stats.apple,
      google: activePurchases.stats.google,
      horizon: activePurchases.stats.horizon ?? 0,
      amazon: activePurchases.stats.amazon ?? 0,
      googleOrders: activePurchases.stats.googleOrders ?? 0,
      valid: activePurchases.stats.valid,
      invalid: activePurchases.stats.invalid,
    };
  }, [activePurchases]);

  // Only Google has a separate stable order identifier. Its card uses the
  // distinct order count; the other store cards use persisted purchase rows.
  // Total / Valid / Invalid remain row counts so their arithmetic stays exact.
  const cardValues: Record<CardKey, number> = {
    total: stats.total,
    apple: stats.apple,
    google: stats.googleOrders,
    horizon: stats.horizon,
    amazon: stats.amazon,
    valid: stats.valid,
    invalid: stats.invalid,
  };

  const purchasePage: PurchaseRow[] = activePurchases?.page ?? [];

  const isInitialLoading = !paginatedPurchases && !cachedPurchases;
  const isTableLoading = !paginatedPurchases && !!cachedPurchases;

  const serializeCursor = (cursor: string | null) =>
    cursor === null ? "ROOT" : cursor;
  const deserializeCursor = (cursor: string) =>
    cursor === "ROOT" ? null : cursor;

  const setFilters = (updates: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    next.delete("cursor");
    next.delete("cursorStack");
    setSearchParams(next);
  };

  const setExclusiveFilters = (
    updates: Record<string, string | null | undefined>,
  ) => {
    const next = new URLSearchParams();
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        next.set(key, value);
      }
    });
    setSearchParams(next);
  };

  const resetFilters = () => {
    setExclusiveFilters({});
  };

  const applyStoreFilter = (store: StoreFilter) => {
    setExclusiveFilters({ store });
  };

  const applyValidityFilter = (isValid: boolean) => {
    setExclusiveFilters({ isValid: String(isValid) });
  };

  const goToCursor = (nextCursor: string | null, nextStack: string[]) => {
    const next = new URLSearchParams(searchParams);
    if (nextCursor) {
      next.set("cursor", nextCursor);
    } else {
      next.delete("cursor");
    }
    if (nextStack.length > 0) {
      next.set("cursorStack", nextStack.join(","));
    } else {
      next.delete("cursorStack");
    }
    setSearchParams(next);
  };

  const handleNextPage = () => {
    if (!activePurchases?.continueCursor) {
      return;
    }
    const serializedCurrent = serializeCursor(cursorParam ?? null);
    const nextStack = [...cursorStack, serializedCurrent];
    goToCursor(activePurchases.continueCursor, nextStack);
  };

  const handlePrevPage = () => {
    if (cursorStack.length === 0) {
      goToCursor(null, []);
      return;
    }
    const previousCursor = deserializeCursor(
      cursorStack[cursorStack.length - 1],
    );
    const nextStack = cursorStack.slice(0, -1);
    goToCursor(previousCursor, nextStack);
  };

  if (!project) {
    return <PageLoading />;
  }

  if (isInitialLoading) {
    return <PageLoading />;
  }

  const statConfig: Array<{ key: CardKey; accent: string }> = [
    {
      key: "total",
      accent: "from-violet-500/10 to-transparent",
    },
    { key: "apple", accent: "from-blue-500/10 to-transparent" },
    { key: "google", accent: "from-green-500/10 to-transparent" },
    { key: "horizon", accent: "from-sky-500/10 to-transparent" },
    { key: "amazon", accent: "from-orange-500/10 to-transparent" },
    { key: "valid", accent: "from-emerald-500/10 to-transparent" },
    { key: "invalid", accent: "from-rose-500/10 to-transparent" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">{"Purchases"}</h2>
        <p className="text-muted-foreground">
          {
            "View each purchase's latest store state. Apple and Google subscriptions also appear in Subscriptions; Amazon lifecycle stays here through RVS rechecks."
          }
        </p>
      </div>

      <p className="text-xs text-muted-foreground -mt-4">
        {
          "Google Play counts distinct Play Console orders. Other store cards count persisted purchase rows."
        }
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statConfig.map((stat) => {
          // Determine which card matches the currently-active filter
          // so the selected card is visually distinct from hover (the
          // prior styling only highlighted on hover, so users couldn't
          // tell which card they had already clicked).
          const storeCard: StoreFilter | undefined =
            stat.key === "apple" ||
            stat.key === "google" ||
            stat.key === "horizon" ||
            stat.key === "amazon"
              ? stat.key
              : undefined;
          const isActive =
            stat.key === "total"
              ? !storeFilter && isValidFilter === undefined
              : storeCard
                ? storeFilter === storeCard
                : stat.key === "valid"
                  ? isValidFilter === true
                  : isValidFilter === false;
          const applyCardFilter = () => {
            if (stat.key === "total") {
              resetFilters();
            } else if (storeCard) {
              applyStoreFilter(storeCard);
            } else {
              applyValidityFilter(stat.key === "valid");
            }
          };
          return (
            <div
              key={stat.key}
              className={cn(
                "bg-card border rounded-xl p-4 shadow-sm",
                "relative overflow-hidden",
                "cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                isActive
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50",
              )}
              role="button"
              aria-pressed={isActive}
              tabIndex={0}
              onClick={applyCardFilter}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  applyCardFilter();
                }
              }}
              aria-label={STATS_LABELS[stat.key]}
            >
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-80 pointer-events-none",
                  stat.accent,
                )}
              ></div>
              <div className="relative">
                <p className="text-sm text-muted-foreground">
                  {STATS_LABELS[stat.key]}
                </p>
                <p className="text-3xl font-semibold mt-2">
                  {cardValues[stat.key].toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="p-6 border-b border-border flex flex-col gap-3 w-full xl:flex-row xl:items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">{"Store"}</label>
            <Select
              value={storeFilter ?? undefined}
              onChange={(value) =>
                setFilters({
                  store: value || null,
                })
              }
              placeholder={"All"}
              allowClear
              className="min-w-[140px]"
              options={[
                {
                  value: "apple",
                  label: "App Store",
                },
                {
                  value: "google",
                  label: "Google Play",
                },
                {
                  value: "horizon",
                  label: "Meta Horizon",
                },
                {
                  value: "amazon",
                  label: "Amazon Appstore",
                },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">{"Status"}</label>
            <Select
              value={
                isValidFilter === undefined
                  ? undefined
                  : isValidFilter
                    ? "true"
                    : "false"
              }
              onChange={(value) =>
                setFilters({
                  isValid: value || null,
                })
              }
              placeholder={"All"}
              allowClear
              className="min-w-[140px]"
              options={[
                {
                  value: "true",
                  label: "Valid",
                },
                {
                  value: "false",
                  label: "Invalid",
                },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">{"State"}</label>
            <Select
              value={stateFilter ?? undefined}
              onChange={(value) =>
                setFilters({
                  state: value || null,
                })
              }
              placeholder={"All"}
              allowClear
              className="min-w-[140px]"
              options={(
                Object.values(
                  HarmonizedPurchaseState,
                ) as HarmonizedPurchaseState[]
              ).map((state) => {
                const { label } = getPurchaseStateDisplay(state);
                return {
                  value: state,
                  label,
                };
              })}
            />
          </div>
          <div className="w-full xl:w-72">
            <Input
              prefix={<Search className="w-4 h-4 text-muted-foreground" />}
              value={requestIpQuery}
              onChange={(event) =>
                setFilters({
                  ip: event.target.value,
                })
              }
              placeholder={"Search by request IP..."}
              allowClear
            />
          </div>
        </div>

        <PurchasesTable
          purchases={purchasePage}
          isLoading={isTableLoading}
          hasPrev={cursorStack.length > 0 || !!cursorParam}
          hasNext={
            !!activePurchases?.continueCursor && !activePurchases?.isDone
          }
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          pageSize={PAGE_SIZE}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          navigate={navigate}
          searchQuery={searchParams.toString()}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={(field, direction) =>
            setFilters({
              sortField: field,
              sortDirection: direction,
            })
          }
        />
      </div>
    </div>
  );
}
