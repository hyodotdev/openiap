import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "convex/react";
import { api, HarmonizedPurchaseState, Id } from "@/convex";
import { PageLoading } from "@/components/LoadingSpinner";
import { utcDayEnd, utcDayStart } from "@/lib/utils";
import { AlertTriangle, History, Search, X } from "lucide-react";
import {
  getPurchaseStateDisplay,
  storeIndicatorConfig,
  type StoreIndicatorKey,
} from "./receipt-utils";
import { PurchasesSummary, type PurchaseStats } from "./PurchasesSummary";
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

// Sorting and paging live in the URL too, but do not narrow the list.
const NON_FILTER_PARAMS = [
  "sortField",
  "sortDirection",
  "cursor",
  "cursorStack",
];
// Two to a row on a phone, natural width from `sm`.
const FILTER_CONTROL = "min-w-[9rem] flex-1 sm:w-40 sm:flex-none";

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
  const appUserIdFilter = searchParams.get("user")?.trim() || undefined;
  const productIdFilter = searchParams.get("product")?.trim() || undefined;
  const createdFromDay = searchParams.get("from") ?? "";
  const createdToDay = searchParams.get("to") ?? "";
  const createdFrom = utcDayStart(createdFromDay);
  const createdTo = utcDayEnd(createdToDay);
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
          appUserId: appUserIdFilter,
          productId: productIdFilter,
          createdFrom,
          createdTo,
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

  const applyStoreFilter = (store: StoreIndicatorKey) => {
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

  const hasFilters = [...searchParams.keys()].some(
    (key) => !NON_FILTER_PARAMS.includes(key),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="min-w-0 max-w-3xl">
          <h2 className="text-2xl font-bold mb-1">{"Purchases"}</h2>
          <p className="text-muted-foreground">
            {
              "View each purchase's latest store state. Apple and Google subscriptions also appear in Subscriptions; Amazon lifecycle stays here through RVS rechecks."
            }
          </p>
        </div>
        <Link
          to={`/${orgSlug}/project/${projectSlug}/purchases/issues`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <AlertTriangle className="h-4 w-4" />
          {"Purchase issues"}
        </Link>
      </div>

      <PurchasesSummary
        stats={stats}
        storeFilter={storeFilter}
        isValidFilter={isValidFilter}
        onReset={resetFilters}
        onStore={applyStoreFilter}
        onValidity={applyValidityFilter}
      />

      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <div className={FILTER_CONTROL}>
            <Select
              aria-label="Store"
              value={storeFilter ?? undefined}
              onChange={(value) => setFilters({ store: value || null })}
              placeholder={"All stores"}
              allowClear
              className="w-full"
              options={Object.entries(storeIndicatorConfig).map(
                ([value, { label }]) => ({ value, label }),
              )}
            />
          </div>
          <div className={FILTER_CONTROL}>
            <Select
              aria-label="Validity"
              value={
                isValidFilter === undefined
                  ? undefined
                  : isValidFilter
                    ? "true"
                    : "false"
              }
              onChange={(value) => setFilters({ isValid: value || null })}
              placeholder={"Valid and invalid"}
              allowClear
              className="w-full"
              options={[
                { value: "true", label: "Valid" },
                { value: "false", label: "Invalid" },
              ]}
            />
          </div>
          <div className={FILTER_CONTROL}>
            <Select
              aria-label="Verified state"
              value={stateFilter ?? undefined}
              onChange={(value) => setFilters({ state: value || null })}
              placeholder={"All states"}
              allowClear
              className="w-full"
              options={(
                Object.values(
                  HarmonizedPurchaseState,
                ) as HarmonizedPurchaseState[]
              ).map((state) => ({
                value: state,
                label: getPurchaseStateDisplay(state).label,
              }))}
            />
          </div>
          <div className={FILTER_CONTROL}>
            <Input
              aria-label="Filter by product ID"
              className="w-full"
              value={searchParams.get("product") ?? ""}
              onChange={(event) => setFilters({ product: event.target.value })}
              placeholder={"Product ID"}
              allowClear
            />
          </div>
          <div className={FILTER_CONTROL}>
            <Input
              aria-label="Filter by app user ID"
              className="w-full"
              value={searchParams.get("user") ?? ""}
              onChange={(event) => setFilters({ user: event.target.value })}
              placeholder={"App user ID"}
              allowClear
            />
          </div>
          <div className={FILTER_CONTROL}>
            <Input
              aria-label="Search by request IP"
              className="w-full"
              prefix={<Search className="w-4 h-4 text-muted-foreground" />}
              value={requestIpQuery}
              onChange={(event) => setFilters({ ip: event.target.value })}
              placeholder={"Request IP"}
              allowClear
            />
          </div>
          <div className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm">
            <input
              type="date"
              aria-label="Created from"
              value={createdFromDay}
              onChange={(event) => setFilters({ from: event.target.value })}
              className="bg-transparent text-foreground outline-none"
            />
            <span className="text-muted-foreground" aria-hidden="true">
              {"–"}
            </span>
            <input
              type="date"
              aria-label="Created to"
              value={createdToDay}
              onChange={(event) => setFilters({ to: event.target.value })}
              className="bg-transparent text-foreground outline-none"
            />
          </div>
          {appUserIdFilter ? (
            <button
              type="button"
              onClick={() =>
                void navigate(
                  `/${orgSlug}/project/${projectSlug}/purchases/user/${encodeURIComponent(appUserIdFilter)}`,
                )
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm font-medium hover:bg-muted"
            >
              <History className="h-3.5 w-3.5" />
              {"User timeline"}
            </button>
          ) : null}
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              {"Clear filters"}
            </button>
          ) : null}
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
