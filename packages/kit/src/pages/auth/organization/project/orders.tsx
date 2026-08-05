import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { api, Id } from "@/convex";
import { Badge, type BadgeVariant } from "@/components/Badge";
import { cn, formatMicros } from "@/lib/utils";
import { Select, Input } from "antd";
import {
  AlertCircle,
  ClipboardCheck,
  Copy,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { FALLBACK_VALUE, formatReceiptDate } from "./receipt-utils";

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

type OrderLookupResult = FunctionReturnType<
  typeof api.orders.action.lookupOrder
>;
type OrderLookupStore = OrderLookupResult["store"];

// The action returns Apple transactions as decoded JWS payloads typed
// `any[]` on the wire (`v.array(v.any())`); only the identifier fields
// the dashboard renders are typed here.
interface AppleOrderTransaction {
  transactionId?: string;
  originalTransactionId?: string;
  webOrderLineItemId?: string;
  appTransactionId?: string;
}

const STORE_LABELS: Record<OrderLookupStore, string> = {
  apple: "App Store",
  google: "Google Play",
};

const STORE_FORM_HINTS: Record<OrderLookupStore, string> = {
  apple:
    "Apple order lookups only match real App Store orders — sandbox order numbers are not supported.",
  google:
    "Google order lookups require the Play service account to have 'View financial data' access in Play Console.",
};

const STORE_NOT_FOUND_HINTS: Record<OrderLookupStore, string> = {
  apple:
    "Apple order lookup works for production orders only — sandbox order numbers cannot be looked up. Double-check the order ID from the customer's App Store receipt email.",
  google:
    "Verify the order ID in Play Console → Order management and confirm the Play service account has financial-data access.",
};

// Status colors per the #284 spec: green = valid/active, yellow =
// expired/canceled/pending, red = revoked/refunded/not found. States
// arrive as free-form store strings (Apple: "Valid" / "Revoked" /
// "Billing grace period"; Google: "PROCESSED" /
// "SUBSCRIPTION_STATE_ACTIVE" / ...), so this maps by keyword instead
// of reusing the HarmonizedPurchaseState display helper.
function getOrderStateVariant(state?: string): BadgeVariant {
  if (!state) {
    return "outline";
  }
  const normalized = state.toLowerCase();
  // Refund/revocation wins over the pending keyword so Google's
  // "PENDING_REFUND" lands red, not yellow.
  if (/revoke|refund/.test(normalized)) {
    return "danger";
  }
  if (/expired|cancel|pending|grace|retry|hold|paused/.test(normalized)) {
    return "warning";
  }
  if (/valid|active|processed|purchased/.test(normalized)) {
    return "success";
  }
  return "outline";
}

// "SUBSCRIPTION_STATE_ACTIVE" → "Active"; strings that already contain
// lowercase letters (Apple's "Billing grace period") pass through.
function formatOrderStateLabel(state: string): string {
  const stripped = state
    .replace(/^SUBSCRIPTION_STATE_/, "")
    .replace(/^ORDER_STATE_/, "");
  if (/[a-z]/.test(stripped)) {
    return stripped;
  }
  const words = stripped.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatProductTypeLabel(type?: string): string | undefined {
  if (!type) {
    return undefined;
  }
  if (type === "inapp") {
    return "In-app product";
  }
  if (type === "subscription") {
    return "Subscription";
  }
  return type;
}

function formatRawJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// The action throws ConvexError so its guidance survives Convex's
// production redaction of plain Error messages. The payload arrives on
// `data`; `message` would carry the framework's wrapper text.
//
// Reused verification helpers throw ReceiptVerificationError, whose
// payload is a JSON envelope `{error, message, details}` — unwrap it to
// the sentence rather than printing the envelope, the same way
// server/convex.ts does.
function describeLookupError(error: unknown): string {
  if (error instanceof ConvexError) {
    if (typeof error.data !== "string") {
      return JSON.stringify(error.data);
    }
    try {
      const parsed: unknown = JSON.parse(error.data);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as { message?: unknown }).message === "string"
      ) {
        return (parsed as { message: string }).message;
      }
    } catch {
      // Plain-string payload — use it as-is.
    }
    return error.data;
  }
  return error instanceof Error ? error.message : String(error);
}

function maskToken(token: string): string {
  return `${token.slice(0, 6)}…`;
}

function OrderStateBadge({ state }: { state?: string }) {
  if (!state) {
    return <span className="text-sm">{FALLBACK_VALUE}</span>;
  }
  return (
    <Badge variant={getOrderStateVariant(state)} size="sm">
      {formatOrderStateLabel(state)}
    </Badge>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h4>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DetailField({
  label,
  value,
  monospace,
}: {
  label: string;
  value: React.ReactNode;
  monospace?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-sm text-foreground break-words",
          monospace && "font-mono text-xs text-muted-foreground",
        )}
      >
        {value === undefined || value === null || value === ""
          ? FALLBACK_VALUE
          : value}
      </dd>
    </div>
  );
}

// Blue technical notice — a failed optional subscription-status fetch
// is reported by the action without invalidating the order lookup.
function TechnicalNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 flex items-start gap-2 text-xs text-blue-700 dark:text-blue-200">
      <Info className="w-4 h-4 mt-0.5 shrink-0" />
      <p className="leading-relaxed break-words">{message}</p>
    </div>
  );
}

function CopyButton({ getValue }: { getValue: () => string }) {
  const [copied, setCopied] = useState(false);

  const copyValue = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(getValue());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void copyValue();
      }}
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
    >
      {copied ? (
        <>
          <ClipboardCheck className="w-3 h-3" />
          {"Copied"}
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          {"Copy"}
        </>
      )}
    </button>
  );
}

// Masked by default — the purchase token grants API access to the
// purchase, so it is never auto-revealed.
function PurchaseTokenField({ token }: { token: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {"Purchase token"}
      </dt>
      <dd className="mt-1 flex items-center gap-2 flex-wrap">
        <code className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded break-all">
          {revealed ? token : maskToken(token)}
        </code>
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
        >
          {revealed ? (
            <>
              <EyeOff className="w-3 h-3" />
              {"Hide"}
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" />
              {"Show"}
            </>
          )}
        </button>
        <CopyButton getValue={() => token} />
      </dd>
    </div>
  );
}

export default function ProjectOrders() {
  const { project } = useOutletContext<OutletContext>();
  const lookupOrder = useAction(api.orders.action.lookupOrder);

  const [store, setStore] = useState<OrderLookupStore>("apple");
  const [orderId, setOrderId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderLookupResult | null>(null);

  const handleLookup = async () => {
    const trimmed = orderId.trim();
    if (!trimmed || isLoading) {
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await lookupOrder({
        projectId: project._id,
        store,
        orderId: trimmed,
      });
      setResult(response);
    } catch (lookupError) {
      // Never store an empty message: the error card gates on truthiness,
      // so a blank one would leave the page silently unchanged.
      setError(
        describeLookupError(lookupError) ||
          "Order lookup failed without a reported reason.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const summary = result?.summary;
  const subscription = result?.subscription;
  const appleTransactions =
    result?.store === "apple"
      ? ((result.transactions ?? []) as AppleOrderTransaction[])
      : [];
  const formattedRaw = result?.found ? formatRawJson(result.raw) : null;
  const formattedSubscriptionRaw = subscription?.raw
    ? formatRawJson(subscription.raw)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">{"Order lookup"}</h2>
        <p className="text-muted-foreground">
          {
            "Look up a store order ID from a customer support request. Read-only — nothing is stored."
          }
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleLookup();
          }}
          className="flex flex-col gap-3 lg:flex-row lg:items-center"
        >
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">{"Store"}</label>
            <Select
              value={store}
              onChange={(value) => setStore(value)}
              className="min-w-[160px]"
              options={[
                {
                  value: "apple",
                  label: "App Store",
                },
                {
                  value: "google",
                  label: "Google Play",
                },
              ]}
            />
          </div>
          <div className="w-full lg:w-96">
            <Input
              prefix={<Search className="w-4 h-4 text-muted-foreground" />}
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder={
                store === "apple" ? "MXXXXXXXXX" : "GPA.XXXX-XXXX-XXXX-XXXXX"
              }
              allowClear
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !orderId.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {isLoading ? "Looking up..." : "Look up order"}
          </button>
        </form>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p>{STORE_FORM_HINTS[store]}</p>
        </div>
      </div>

      {error && (
        <div className="border border-red-500/40 bg-red-500/10 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-red-700 dark:text-red-300">
              {"Order lookup failed"}
            </p>
            <p className="text-muted-foreground mt-1 break-words">{error}</p>
          </div>
        </div>
      )}

      {result && !result.found && (
        <div className="border border-red-500/40 bg-red-500/10 rounded-xl p-5 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-700 dark:text-red-300">
              {"Order not found"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 break-words">
              {`No ${STORE_LABELS[result.store]} order matches "${result.orderId}". `}
              {STORE_NOT_FOUND_HINTS[result.store]}
            </p>
          </div>
        </div>
      )}

      {result?.found && (
        <>
          <SectionCard title={`Summary — ${STORE_LABELS[result.store]}`}>
            {summary?.lineItemCount !== undefined && (
              <div className="mb-4">
                <TechnicalNotice
                  message={`This order has ${summary.lineItemCount} line items. The summary describes the first one — see the raw store response for the rest.`}
                />
              </div>
            )}
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField
                label="Product ID"
                value={summary?.productId}
                monospace={Boolean(summary?.productId)}
              />
              <DetailField
                label="Product title"
                value={summary?.productTitle}
              />
              <DetailField
                label="Type"
                value={formatProductTypeLabel(summary?.productType)}
              />
              <DetailField
                label="State"
                value={<OrderStateBadge state={summary?.state} />}
              />
              <DetailField label="Environment" value={summary?.environment} />
              <DetailField
                label="Purchase date"
                value={formatReceiptDate(summary?.purchaseDate)}
              />
              <DetailField
                label="Expires date"
                value={formatReceiptDate(summary?.expiresDate)}
              />
              <DetailField
                label="Price"
                value={
                  summary?.priceAmountMicros !== undefined
                    ? formatMicros(summary.priceAmountMicros, {
                        currency: summary.currency,
                      })
                    : undefined
                }
              />
              <DetailField label="Quantity" value={summary?.quantity} />
            </dl>
          </SectionCard>

          <SectionCard title="Transaction identifiers">
            {result.store === "apple" ? (
              appleTransactions.length > 0 ? (
                <div className="space-y-4">
                  {appleTransactions.map((transaction, index) => (
                    <div
                      key={transaction.transactionId ?? `transaction-${index}`}
                      className={cn(
                        "space-y-4",
                        appleTransactions.length > 1 &&
                          "border border-border rounded-lg p-4",
                      )}
                    >
                      {appleTransactions.length > 1 && (
                        <p className="text-xs font-medium text-muted-foreground">
                          {`Transaction ${index + 1} of ${appleTransactions.length}`}
                        </p>
                      )}
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <DetailField
                          label="Transaction ID"
                          value={transaction.transactionId}
                          monospace={Boolean(transaction.transactionId)}
                        />
                        <DetailField
                          label="Original transaction ID"
                          value={transaction.originalTransactionId}
                          monospace={Boolean(transaction.originalTransactionId)}
                        />
                        <DetailField
                          label="Web order line item ID"
                          value={transaction.webOrderLineItemId}
                          monospace={Boolean(transaction.webOrderLineItemId)}
                        />
                        <DetailField
                          label="App transaction ID"
                          value={transaction.appTransactionId}
                          monospace={Boolean(transaction.appTransactionId)}
                        />
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {"No decoded transactions were returned for this order."}
                </p>
              )
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailField
                  label="Order ID"
                  value={result.orderId}
                  monospace
                />
                {result.purchaseToken && (
                  <PurchaseTokenField token={result.purchaseToken} />
                )}
              </dl>
            )}
          </SectionCard>

          {subscription && (
            <SectionCard title="Payment & subscription status">
              <div className="space-y-4">
                {subscription.error !== undefined && (
                  <TechnicalNotice
                    message={`Subscription status could not be fetched: ${
                      subscription.error || "the store returned no detail"
                    }`}
                  />
                )}
                {(subscription.state !== undefined ||
                  subscription.autoRenewing !== undefined ||
                  subscription.expiresDate !== undefined ||
                  subscription.renewalProductId !== undefined ||
                  subscription.gracePeriodExpiresDate !== undefined) && (
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailField
                      label="Subscription state"
                      value={<OrderStateBadge state={subscription.state} />}
                    />
                    <DetailField
                      label="Auto-renewing"
                      value={
                        subscription.autoRenewing === undefined
                          ? undefined
                          : subscription.autoRenewing
                            ? "Yes"
                            : "No"
                      }
                    />
                    <DetailField
                      label="Expires date"
                      value={formatReceiptDate(subscription.expiresDate)}
                    />
                    <DetailField
                      label="Renewal product ID"
                      value={subscription.renewalProductId}
                      monospace={Boolean(subscription.renewalProductId)}
                    />
                    <DetailField
                      label="Grace period expires"
                      value={formatReceiptDate(
                        subscription.gracePeriodExpiresDate,
                      )}
                    />
                  </dl>
                )}
              </div>
            </SectionCard>
          )}

          {formattedRaw && (
            <details className="border border-border rounded-xl bg-card shadow-sm">
              <summary className="px-5 py-4 cursor-pointer text-sm font-medium">
                {"Raw store response"}
              </summary>
              <div className="border-t border-border p-5">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                  {formattedRaw}
                </pre>
              </div>
            </details>
          )}

          {formattedSubscriptionRaw && (
            <details className="border border-border rounded-xl bg-card shadow-sm">
              <summary className="px-5 py-4 cursor-pointer text-sm font-medium">
                {"Raw subscription status"}
              </summary>
              <div className="border-t border-border p-5">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                  {formattedSubscriptionRaw}
                </pre>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
