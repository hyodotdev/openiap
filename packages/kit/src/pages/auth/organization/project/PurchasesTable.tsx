import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/utils";
import { Apple, CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { formatReceiptDate, getPurchaseStateDisplay } from "./receipt-utils";

const storeIndicatorConfig = {
  apple: {
    icon: Apple,
    label: "App Store",
  },
  google: {
    icon: Play,
    label: "Google Play",
  },
} as const;

type StoreIndicatorKey = keyof typeof storeIndicatorConfig;

type PurchaseRow = {
  _id: string;
  store: string;
  isValid?: boolean | null;
  state?: string | null;
  requestIp?: string | null;
  verificationDurationMs?: number | null;
  _creationTime: number;
  updatedAt?: number | null;
  productId?: string | null;
};

type Props = {
  purchases: PurchaseRow[];
  isLoading: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  pageSize: number;
  orgSlug: string;
  projectSlug: string;
  navigate: ReturnType<typeof useNavigate>;
  searchQuery: string;
  sortField: "_creationTime" | "updatedAt" | "verificationDurationMs";
  sortDirection: "asc" | "desc";
  onSortChange: (
    field: "_creationTime" | "updatedAt" | "verificationDurationMs",
    direction: "asc" | "desc",
  ) => void;
};

const formatVerificationDuration = (durationMs?: number | null) => {
  if (durationMs === undefined || durationMs === null) {
    return null;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
};

const renderStoreIndicator = (store: string, label: string) => {
  const config = storeIndicatorConfig[store as StoreIndicatorKey];
  if (!config) {
    return <span className="font-mono text-xs whitespace-nowrap">{store}</span>;
  }
  const Icon = config.icon;
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-muted/40"
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </span>
  );
};

export function PurchasesTable({
  purchases,
  isLoading,
  hasPrev,
  hasNext,
  onPrevPage,
  onNextPage,
  pageSize,
  orgSlug,
  projectSlug,
  navigate,
  searchQuery,
  sortField,
  sortDirection,
  onSortChange,
}: Props) {
  const rows = useMemo(() => purchases, [purchases]);

  const toggleSort = (
    field: "_creationTime" | "updatedAt" | "verificationDurationMs",
  ) => {
    if (sortField === field) {
      onSortChange(field, sortDirection === "asc" ? "desc" : "asc");
    } else {
      onSortChange(field, "desc");
    }
  };

  const sortIndicator = (field: typeof sortField) =>
    sortField === field ? (sortDirection === "asc" ? "↑" : "↓") : "↕";

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground border-b border-border">
            <tr className="text-left">
              <th className="py-3 px-6 font-medium">{"Status"}</th>
              <th className="py-3 px-6 font-medium">{"State"}</th>
              <th className="py-3 px-6 font-medium">{"Store"}</th>
              <th className="py-3 px-6 font-medium">{"Product ID"}</th>
              <th className="py-3 px-6 font-medium">{"Request IP"}</th>
              <th className="py-3 px-6 font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("verificationDurationMs")}
                >
                  {"Res. time"}
                  <span className="text-muted-foreground text-xs">
                    {sortIndicator("verificationDurationMs")}
                  </span>
                </button>
              </th>
              <th className="py-3 px-6 font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("_creationTime")}
                >
                  {"Created"}
                  <span className="text-muted-foreground text-xs">
                    {sortIndicator("_creationTime")}
                  </span>
                </button>
              </th>
              <th className="py-3 px-6 font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("updatedAt")}
                >
                  {"Updated"}
                  <span className="text-muted-foreground text-xs">
                    {sortIndicator("updatedAt")}
                  </span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody aria-busy={isLoading}>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-10 text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <span>{"Loading..."}</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-16 text-center text-muted-foreground"
                >
                  <p className="font-semibold">{"No purchases found"}</p>
                  <p className="text-sm">
                    {
                      "Receipts will appear here after you validate transactions."
                    }
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((purchase) => {
                const detailPath = `/${orgSlug}/project/${projectSlug}/purchases/${purchase._id}${
                  searchQuery ? `?${searchQuery}` : ""
                }`;
                const navigateToDetail = () => {
                  void navigate(detailPath);
                };
                const { label, variant } = getPurchaseStateDisplay(
                  purchase.state as any,
                );
                const storeLabel =
                  storeIndicatorConfig[purchase.store as StoreIndicatorKey]
                    ?.label ?? "";

                return (
                  <tr
                    key={purchase._id}
                    tabIndex={0}
                    onClick={navigateToDetail}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigateToDetail();
                      }
                    }}
                    className={cn(
                      "border-b border-border/60 last:border-b-0 cursor-pointer transition-colors",
                      "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    )}
                    aria-label={"View details"}
                  >
                    <td className="py-4 px-6">
                      <Badge
                        variant={purchase.isValid ? "success" : "danger"}
                        size="sm"
                        icon={
                          purchase.isValid ? (
                            <CheckCircle2 className="w-full h-full" />
                          ) : (
                            <XCircle className="w-full h-full" />
                          )
                        }
                      >
                        {purchase.isValid ? "Valid" : "Invalid"}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <Badge
                        variant={variant}
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        {label}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs whitespace-nowrap">
                      {renderStoreIndicator(purchase.store, storeLabel)}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs">
                      {purchase.productId ?? "N/A"}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs whitespace-nowrap">
                      {purchase.requestIp ?? "N/A"}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs whitespace-nowrap">
                      {formatVerificationDuration(
                        purchase.verificationDurationMs,
                      ) ?? "N/A"}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs">
                      {formatReceiptDate(purchase._creationTime)}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs">
                      {formatReceiptDate(purchase.updatedAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-border flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {"Items per page"}: {pageSize}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={!hasPrev}
            className={cn(
              "px-3 py-2 rounded-lg border border-border text-sm",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {"Previous"}
          </button>
          <button
            type="button"
            onClick={onNextPage}
            disabled={!hasNext}
            className={cn(
              "px-3 py-2 rounded-lg border border-border text-sm",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {"Next"}
          </button>
        </div>
      </div>
    </>
  );
}
