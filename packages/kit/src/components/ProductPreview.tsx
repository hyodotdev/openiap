import {
  Activity,
  BarChart3,
  Layers,
  ReceiptText,
  ShoppingBag,
  Webhook,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { HarmonizedPurchaseState } from "@/convex";
import { PurchasesTable } from "@/pages/auth/organization/project/PurchasesTable";

const TABS = [
  { label: "Purchases", icon: ShoppingBag },
  { label: "Subscriptions", icon: Activity },
  { label: "Orders", icon: ReceiptText },
  { label: "Analytics", icon: BarChart3 },
  { label: "Products", icon: Layers },
  { label: "Webhooks", icon: Webhook },
];

// Fixed sample rows (documentation IP range) so the preview renders the same
// everywhere; these are not real purchases.
const SAMPLE_TIME = Date.UTC(2026, 10, 3, 9, 41);
const SAMPLE_PURCHASES = [
  {
    store: "apple",
    productId: "premium_monthly",
    state: HarmonizedPurchaseState.ENTITLED,
    isValid: true,
    ms: 212,
  },
  {
    store: "google",
    productId: "coins_500",
    state: HarmonizedPurchaseState.READY_TO_CONSUME,
    isValid: true,
    ms: 341,
  },
  {
    store: "amazon",
    productId: "premium_yearly",
    state: HarmonizedPurchaseState.ENTITLED,
    isValid: true,
    ms: 486,
  },
  {
    store: "google",
    productId: "remove_ads",
    state: HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT,
    isValid: true,
    ms: 298,
  },
  {
    store: "apple",
    productId: "premium_monthly",
    state: HarmonizedPurchaseState.INAUTHENTIC,
    isValid: false,
    ms: 175,
  },
  {
    store: "horizon",
    productId: "level_pack_2",
    state: HarmonizedPurchaseState.ENTITLED,
    isValid: true,
    ms: 263,
  },
].map((row, index) => ({
  _id: `sample-${index}`,
  store: row.store,
  productId: row.productId,
  state: row.state,
  isValid: row.isValid,
  verificationDurationMs: row.ms,
  requestIp: `203.0.113.${24 + index * 7}`,
  _creationTime: SAMPLE_TIME - index * 4 * 60_000,
}));

const noop = () => {};

/** The dashboard's real purchases table, with sample rows, as the landing visual. */
export function ProductPreview() {
  const navigate = useNavigate();

  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_-40px_rgba(58,37,31,0.45)]">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <p className="text-sm font-semibold text-foreground">{"Sample app"}</p>
        <p className="text-xs text-muted-foreground">{"Sample data"}</p>
      </div>
      {/* Visual only: the table keeps its real markup but takes no input. */}
      <div inert aria-hidden="true" className="relative">
        {/* On narrow screens the table runs past the edge; fade it out there. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-card to-transparent xl:hidden" />
        <nav className="flex overflow-hidden border-b border-border px-3">
          {TABS.map(({ label, icon: Icon }, index) => (
            <span
              key={label}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-3 text-sm font-medium ${
                index === 0
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </span>
          ))}
        </nav>
        <PurchasesTable
          purchases={SAMPLE_PURCHASES}
          isLoading={false}
          hasPrev={false}
          hasNext={false}
          onPrevPage={noop}
          onNextPage={noop}
          pageSize={SAMPLE_PURCHASES.length}
          orgSlug="sample"
          projectSlug="sample-app"
          navigate={navigate}
          searchQuery=""
          sortField="_creationTime"
          sortDirection="desc"
          onSortChange={noop}
          variant="preview"
        />
      </div>
      <figcaption className="sr-only">
        {
          "The IAPKit dashboard's purchases list, showing sample verifications from four stores."
        }
      </figcaption>
    </figure>
  );
}
