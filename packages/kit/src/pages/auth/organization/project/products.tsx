import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { useMutation, useQuery, useAction } from "convex/react";
import { Layers, Loader2, Plus, RefreshCw, ChevronDown } from "lucide-react";

import type { Doc } from "@/convex";
import { api } from "@/convex";
import { PageLoading } from "@/components/LoadingSpinner";
import { Badge, PlatformBadge } from "../../../../components/Badge";

type ProjectContext = { project: Doc<"projects"> };

export default function ProjectProducts() {
  const { project } = useOutletContext<ProjectContext>();
  const products = useQuery(api.products.query.listProducts, {
    apiKey: project.apiKey,
  });
  const upsert = useMutation(api.products.mutation.upsertProduct);
  const syncApple = useAction(api.products.asc.pushSyncProductsApple);
  const syncGoogle = useAction(api.products.play.pushSyncProductsGoogle);
  const listAscGroups = useAction(api.products.asc.listSubscriptionGroupsApple);
  // Cached ASC subscription group reference names for the
  // autocomplete. Populated lazily — on first focus of the group
  // input — so projects without ASC credentials configured don't
  // hit the action and surface a credential error every page load.
  const [ascGroupNames, setAscGroupNames] = useState<string[] | null>(null);
  const [ascGroupLoadFailed, setAscGroupLoadFailed] = useState(false);

  // Per-platform sync state — the button shows a spinner instead of a
  // separate page-level banner so the affordance lives next to the
  // action the operator triggered.
  const [syncingPlatform, setSyncingPlatform] = useState<
    "IOS" | "Android" | null
  >(null);
  // The draft form holds every field the push-sync flow consumes.
  // Optional fields are stored as empty strings here and converted to
  // `undefined` on submit so an unfilled price doesn't end up
  // overwriting an existing row's price with NaN.
  const [draft, setDraft] = useState({
    productId: "",
    platform: "IOS" as "IOS" | "Android",
    type: "Subscription" as "Subscription" | "NonConsumable" | "Consumable",
    title: "",
    description: "",
    priceUsd: "", // operator types "9.99"; converted to micros on submit
    billingPeriod: "P1M" as "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y",
    subscriptionGroupName: "",
    reviewNote: "",
  });

  const grouped = useMemo(() => {
    if (!products) return { ios: [], android: [] };
    return {
      ios: products.filter((p) => p.platform === "IOS"),
      android: products.filter((p) => p.platform === "Android"),
    };
  }, [products]);

  if (products === undefined) {
    return <PageLoading />;
  }

  const onAdd = async () => {
    if (!draft.productId || !draft.title) return;
    // Empty strings → undefined so the mutation's `?? existing.X`
    // coalescing path kicks in for re-edits of an existing row, and
    // so a brand-new row doesn't store the literal "" as its
    // description / reviewNote.
    const description = draft.description.trim() || undefined;
    const reviewNote = draft.reviewNote.trim() || undefined;
    const priceUsd = parseFloat(draft.priceUsd);
    const priceAmountMicros =
      Number.isFinite(priceUsd) && priceUsd > 0
        ? Math.round(priceUsd * 1_000_000)
        : undefined;
    const isSubIos = draft.type === "Subscription" && draft.platform === "IOS";
    const subscriptionGroupName =
      isSubIos && draft.subscriptionGroupName.trim()
        ? draft.subscriptionGroupName.trim()
        : undefined;
    const billingPeriod =
      draft.type === "Subscription" ? draft.billingPeriod : undefined;
    await upsert({
      apiKey: project.apiKey,
      productId: draft.productId,
      platform: draft.platform,
      type: draft.type,
      title: draft.title,
      description,
      priceAmountMicros,
      currency: priceAmountMicros !== undefined ? "USD" : undefined,
      billingPeriod,
      subscriptionGroupName,
      reviewNote,
      state: "Draft",
    });
    setDraft({
      ...draft,
      productId: "",
      title: "",
      description: "",
      priceUsd: "",
      subscriptionGroupName: "",
      reviewNote: "",
    });
  };

  const onSync = async (
    platform: "IOS" | "Android",
    options?: { dryRun?: boolean },
  ) => {
    if (syncingPlatform) return;
    setSyncingPlatform(platform);
    const label = platform === "IOS" ? "App Store Connect" : "Play Console";
    const dryRun = options?.dryRun === true;
    try {
      // Dry-run is iOS-only for now — Android push doesn't have an
      // equivalent skip-writes path yet (we'd need to mirror the same
      // gating across play.ts). When operator hits "Dry-run" on
      // Android we just route to a regular sync and surface a notice
      // explaining the limitation.
      if (dryRun && platform === "Android") {
        toast.message(
          "Dry-run not yet supported for Play Console — running real sync instead.",
          { duration: 6_000 },
        );
      }
      const result =
        platform === "IOS"
          ? await syncApple({
              apiKey: project.apiKey,
              direction: "both",
              ...(dryRun ? { dryRun: true } : {}),
            })
          : await syncGoogle({
              apiKey: project.apiKey,
              direction: "both",
            });
      const summary = `Pulled ${result.pulled}, pushed ${result.pushed}`;
      const planned:
        | Array<{
            productId: string;
            step: string;
            detail?: string;
          }>
        | undefined =
        "plannedWrites" in result &&
        Array.isArray((result as { plannedWrites?: unknown }).plannedWrites)
          ? (
              result as {
                plannedWrites: Array<{
                  productId: string;
                  step: string;
                  detail?: string;
                }>;
              }
            ).plannedWrites
          : undefined;
      const plannedLines = planned?.length
        ? planned
            .map(
              (p) =>
                `${p.productId} → ${p.step}${p.detail ? ": " + p.detail : ""}`,
            )
            .join("\n")
        : undefined;
      if (result.failures.length) {
        const failureLines = result.failures
          .map((f) => `${f.productId}: ${f.reason}`)
          .join("\n");
        toast.error(
          `${label} ${dryRun && platform === "IOS" ? "dry-run" : "sync"} — ${summary}`,
          {
            description:
              (plannedLines ? `Planned writes:\n${plannedLines}\n\n` : "") +
              failureLines,
            duration: 12_000,
          },
        );
      } else if (plannedLines) {
        toast.success(`${label} dry-run — ${summary} (no writes performed)`, {
          description: plannedLines,
          duration: 12_000,
        });
      } else {
        toast.success(`${label} sync — ${summary}`);
      }
    } catch (error) {
      toast.error(
        `${label} sync failed: ${error instanceof Error ? error.message : String(error)}`,
        { duration: 12_000 },
      );
    } finally {
      setSyncingPlatform(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Products
        </h2>
        <p className="text-sm text-muted-foreground">
          kit-side catalog of every productId used by your app. Push-sync
          mirrors Draft rows to App Store Connect / Play Console using the
          credentials you uploaded; Pull-sync brings store-side changes back
          into kit.
        </p>
      </div>

      <div className="border border-border rounded-lg bg-card p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="Product ID">
            <input
              value={draft.productId}
              onChange={(e) =>
                setDraft({ ...draft, productId: e.target.value })
              }
              placeholder="com.example.premium"
              className="w-full px-2 py-1.5 rounded border border-border bg-background"
            />
          </Field>
          <Field label="Title">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Premium Monthly"
              className="w-full px-2 py-1.5 rounded border border-border bg-background"
            />
          </Field>
          <Field label="Platform">
            <SelectWithChevron
              value={draft.platform}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  platform: value as "IOS" | "Android",
                })
              }
              options={[
                { value: "IOS", label: "iOS" },
                { value: "Android", label: "Android" },
              ]}
            />
          </Field>
          <Field label="Type">
            <SelectWithChevron
              value={draft.type}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  type: value as
                    | "Subscription"
                    | "NonConsumable"
                    | "Consumable",
                })
              }
              options={[
                { value: "Subscription", label: "Subscription" },
                { value: "NonConsumable", label: "Non-consumable" },
                { value: "Consumable", label: "Consumable" },
              ]}
            />
          </Field>
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="Price (USD)">
            <input
              value={draft.priceUsd}
              onChange={(e) => setDraft({ ...draft, priceUsd: e.target.value })}
              placeholder="9.99"
              inputMode="decimal"
              className="w-full px-2 py-1.5 rounded border border-border bg-background"
            />
          </Field>
          {draft.type === "Subscription" && (
            <Field label="Billing period">
              <SelectWithChevron
                value={draft.billingPeriod}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    billingPeriod: value as
                      | "P1W"
                      | "P1M"
                      | "P2M"
                      | "P3M"
                      | "P6M"
                      | "P1Y",
                  })
                }
                options={[
                  { value: "P1W", label: "Weekly" },
                  { value: "P1M", label: "Monthly" },
                  { value: "P2M", label: "Bi-monthly" },
                  { value: "P3M", label: "Quarterly" },
                  { value: "P6M", label: "Semi-annual" },
                  { value: "P1Y", label: "Yearly" },
                ]}
              />
            </Field>
          )}
          {draft.type === "Subscription" && draft.platform === "IOS" && (
            <Field label="Subscription group (iOS)">
              <input
                list="asc-subscription-groups"
                value={draft.subscriptionGroupName}
                onFocus={() => {
                  if (ascGroupNames !== null || ascGroupLoadFailed) return;
                  void listAscGroups({ apiKey: project.apiKey })
                    .then((groups) =>
                      setAscGroupNames(groups.map((g) => g.referenceName)),
                    )
                    .catch(() => setAscGroupLoadFailed(true));
                }}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    subscriptionGroupName: e.target.value,
                  })
                }
                placeholder="Premium"
                className="w-full px-2 py-1.5 rounded border border-border bg-background"
              />
              <datalist id="asc-subscription-groups">
                {(ascGroupNames ?? []).map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Type a new name to create a group, or pick an existing one.
                Android has no equivalent — Play uses base plans within a single
                subscription product instead.
              </p>
            </Field>
          )}
          <Field label="Description">
            <input
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="Unlock all premium features"
              className="w-full px-2 py-1.5 rounded border border-border bg-background"
            />
          </Field>
        </div>
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
          <Field label="Review note (optional)">
            <input
              value={draft.reviewNote}
              onChange={(e) =>
                setDraft({ ...draft, reviewNote: e.target.value })
              }
              placeholder="Use account testflight@example.com to trigger this purchase."
              className="w-full px-2 py-1.5 rounded border border-border bg-background"
            />
          </Field>
          <button
            onClick={() => {
              void onAdd();
            }}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> Add product
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          On Sync, kit pushes the row to App Store Connect / Play Console,
          creates an en-US localization, and sets the USA price tier — leaving
          the IAP in &quot;Ready to Submit&quot; state. Final review submission
          (screenshot upload) is still done in App Store Connect web.
        </p>
      </div>

      <ProductGroup
        platform="IOS"
        rows={grouped.ios}
        syncing={syncingPlatform === "IOS"}
        onSync={() => {
          void onSync("IOS");
        }}
        onDryRun={() => {
          void onSync("IOS", { dryRun: true });
        }}
      />
      <ProductGroup
        platform="Android"
        rows={grouped.android}
        syncing={syncingPlatform === "Android"}
        onSync={() => {
          void onSync("Android");
        }}
      />
    </div>
  );
}

type ProductRow = {
  productId: string;
  type: string;
  title: string;
  state: string;
  storeRef?: string;
  priceAmountMicros?: number;
  currency?: string;
  subscriptionGroupId?: string;
  subscriptionGroupName?: string;
  offers?: Array<{
    id: string;
    kind:
      | "FreeTrial"
      | "IntroPayUpFront"
      | "IntroPayAsYouGo"
      | "PromotionalOffer"
      | "BasePlan";
    duration?: string;
    numberOfPeriods?: number;
    priceAmountMicros?: number;
    currency?: string;
  }>;
  updatedAt: number;
};

// Render a human-readable label for a single offer row. The dashboard
// shows these as small badges under the subscription title so the
// operator can see at a glance which plans/intros a sub carries
// without drilling into the raw store data. Distinct from price
// formatting because some offers (free trials) have no price.
function offerLabel(
  offer: ProductRow["offers"] extends Array<infer O> | undefined ? O : never,
): string {
  const period = offer.duration ? formatIsoDuration(offer.duration) : "";
  switch (offer.kind) {
    case "BasePlan":
      return offer.priceAmountMicros !== undefined && offer.currency
        ? `${offer.currency} ${(offer.priceAmountMicros / 1_000_000).toFixed(2)} / ${period || "?"}`
        : period || "Base plan";
    case "FreeTrial":
      return period ? `${period} free trial` : "Free trial";
    case "IntroPayUpFront":
      return offer.priceAmountMicros !== undefined && offer.currency
        ? `${offer.currency} ${(offer.priceAmountMicros / 1_000_000).toFixed(2)} intro for ${period || "?"}`
        : "Intro (pay up front)";
    case "IntroPayAsYouGo":
      return offer.priceAmountMicros !== undefined && offer.currency
        ? `${offer.currency} ${(offer.priceAmountMicros / 1_000_000).toFixed(2)} / ${period || "?"} × ${offer.numberOfPeriods ?? "?"}`
        : "Intro (pay as you go)";
    case "PromotionalOffer":
      return "Promotional offer";
    default:
      return offer.kind;
  }
}

// Map ISO-8601 duration strings (P1W / P1M / P3D) to compact human
// labels for the badge UI. Falls through with the raw value for
// anything we don't recognize so the operator still sees something.
function formatIsoDuration(iso: string): string {
  switch (iso) {
    case "P3D":
      return "3 days";
    case "P1W":
      return "1 week";
    case "P2W":
      return "2 weeks";
    case "P1M":
      return "1 month";
    case "P2M":
      return "2 months";
    case "P3M":
      return "3 months";
    case "P6M":
      return "6 months";
    case "P1Y":
      return "1 year";
    default:
      return iso;
  }
}

// Reorder a flat product list so subscriptions sharing the same ASC
// `subscriptionGroupName` are visually clustered under a single
// "Subscription Group · {name}" header row. One-time products (no
// group) and rows missing group metadata pass through unchanged at
// the bottom — we don't want to invent a synthetic group label for
// non-subscriptions or for legacy rows synced before group capture
// landed. Original ordering is preserved within each cluster.
function groupRowsByHierarchy(
  rows: Array<ProductRow>,
): Array<
  | { kind: "groupHeader"; id: string; name: string }
  | { kind: "row"; row: ProductRow }
> {
  const buckets = new Map<string, Array<ProductRow>>();
  const ungrouped: Array<ProductRow> = [];
  const groupOrder: string[] = [];
  for (const row of rows) {
    const key = row.subscriptionGroupName;
    if (!key || row.type !== "Subscription") {
      ungrouped.push(row);
      continue;
    }
    if (!buckets.has(key)) {
      buckets.set(key, []);
      groupOrder.push(key);
    }
    buckets.get(key)!.push(row);
  }
  const out: Array<
    | { kind: "groupHeader"; id: string; name: string }
    | { kind: "row"; row: ProductRow }
  > = [];
  for (const name of groupOrder) {
    out.push({ kind: "groupHeader", id: name, name });
    for (const row of buckets.get(name) ?? []) {
      out.push({ kind: "row", row });
    }
  }
  for (const row of ungrouped) {
    out.push({ kind: "row", row });
  }
  return out;
}

function ProductGroup({
  platform,
  rows,
  syncing,
  onSync,
  onDryRun,
}: {
  platform: "IOS" | "Android";
  rows: Array<ProductRow>;
  syncing: boolean;
  onSync: () => void;
  onDryRun?: () => void;
}) {
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={platform === "IOS" ? "ios" : "android"} />
          <span className="text-sm text-muted-foreground">
            {rows.length} product{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onDryRun && (
            <button
              onClick={onDryRun}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs border border-border hover:bg-muted/40 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Read-only preview — calls ASC for context but skips all writes (no rows created)."
            >
              Dry-run
            </button>
          )}
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-muted hover:bg-muted/80 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {syncing
              ? `Syncing with ${platform === "IOS" ? "App Store Connect" : "Play Console"}…`
              : `Sync with ${platform === "IOS" ? "App Store Connect" : "Play Console"}`}
          </button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left">Product ID</th>
            <th className="px-4 py-2 text-left">Title</th>
            <th className="px-4 py-2 text-left">Type</th>
            <th className="px-4 py-2 text-left">State</th>
            <th className="px-4 py-2 text-left">Store ref</th>
            <th className="px-4 py-2 text-left">Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                Nothing yet. Add a product above or hit Sync to pull an existing
                catalog.
              </td>
            </tr>
          )}
          {groupRowsByHierarchy(rows).map((entry) =>
            entry.kind === "groupHeader" ? (
              <tr
                key={`group:${entry.id}`}
                className="border-t border-border/50 bg-muted/20"
              >
                <td
                  colSpan={6}
                  className="px-4 py-1.5 text-xs uppercase tracking-wide text-muted-foreground"
                >
                  Subscription Group · {entry.name}
                </td>
              </tr>
            ) : (
              <tr
                key={entry.row.productId}
                className="border-t border-border/50"
              >
                <td className="px-4 py-2 font-mono text-xs">
                  {entry.row.productId}
                </td>
                <td className="px-4 py-2">
                  <div>{entry.row.title}</div>
                  {entry.row.offers && entry.row.offers.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.row.offers.map((offer) => (
                        <span
                          key={offer.id}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            offer.kind === "BasePlan"
                              ? "bg-muted text-muted-foreground"
                              : offer.kind === "FreeTrial"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-amber-500/15 text-amber-400"
                          }`}
                          title={offer.kind}
                        >
                          {offerLabel(offer)}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <Badge variant="default" size="xs">
                    {entry.row.type}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  <Badge
                    variant={entry.row.state === "Active" ? "new" : "default"}
                    size="xs"
                  >
                    {entry.row.state}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-muted-foreground font-mono text-xs">
                  {entry.row.storeRef ?? "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {entry.row.priceAmountMicros
                    ? `${entry.row.currency ?? ""} ${(entry.row.priceAmountMicros / 1_000_000).toFixed(2)}`.trim()
                    : "—"}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs">
      <span className="block text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

// Wrapped <select> so the chevron icon has breathing room and the
// browser's default chrome doesn't crowd the text. `appearance-none`
// hides the native arrow; we render our own ChevronDown inside the
// trailing slot of the wrapper div.
function SelectWithChevron({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none px-2 pr-8 py-1.5 rounded border border-border bg-background"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    </div>
  );
}
