import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { useMutation, useQuery, useAction } from "convex/react";
import {
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  ChevronDown,
  X,
  Trash2,
  AlertTriangle,
  Info,
  ExternalLink,
} from "lucide-react";

import type { Doc } from "@/convex";
import { api } from "@/convex";
import { PageLoading } from "@/components/LoadingSpinner";
import { Modal } from "@/components/Modal";
import { Tooltip } from "@/components/Tooltip";
import { Badge, PlatformBadge } from "../../../../components/Badge";

type ProjectContext = { project: Doc<"projects"> };
type SyncJob = Doc<"productSyncJobs">;

export default function ProjectProducts() {
  const { project } = useOutletContext<ProjectContext>();
  const products = useQuery(api.products.query.listProducts, {
    apiKey: project.apiKey,
  });
  const upsert = useMutation(api.products.mutation.upsertProduct);
  const enqueueSync = useMutation(api.products.jobs.enqueueProductSync);
  const cancelSync = useMutation(api.products.jobs.cancelProductSync);
  const dismissJob = useMutation(api.products.jobs.dismissCompletedJob);
  const iosJob = useQuery(api.products.jobs.getActiveSyncJob, {
    apiKey: project.apiKey,
    platform: "IOS",
  });
  const androidJob = useQuery(api.products.jobs.getActiveSyncJob, {
    apiKey: project.apiKey,
    platform: "Android",
  });
  const listAscGroups = useAction(
    api.products.asc.listSubscriptionGroupsAppleIOS,
  );
  // Cached ASC subscription group reference names for the
  // autocomplete. Populated lazily — on first focus of the group
  // input — so projects without ASC credentials configured don't
  // hit the action and surface a credential error every page load.
  const [ascGroupNames, setAscGroupNames] = useState<string[] | null>(null);
  const [ascGroupLoadFailed, setAscGroupLoadFailed] = useState(false);

  // Sync state now lives in `productSyncJobs` and is read reactively
  // via `getActiveSyncJob` per platform — the worker writes progress
  // back to the row, so the dashboard re-renders without polling.
  //
  // Toast policy: only fire a completion toast for jobs the operator
  // *actively triggered in this mounted session*. We track the
  // previous status per platform; a toast fires only on the
  // transition `running/queued → succeeded/failed`, never on the
  // first observed status. That way revisiting the page (where the
  // first observation is already terminal) shows the result banner
  // but does NOT pop a stale toast for a sync the operator didn't
  // just run.
  type JobStatusSnapshot = {
    jobId: string;
    status: "queued" | "running" | "succeeded" | "failed";
  };
  const prevJobStatusRef = useRef<
    Record<"IOS" | "Android", JobStatusSnapshot | null>
  >({
    IOS: null,
    Android: null,
  });
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

  // Toast on the running → terminal transition only.
  //
  // Earlier versions used a "shown jobIds" set, which fired on
  // every fresh mount because the ref reset to empty — landing on
  // the page with a pre-existing terminal job re-toasted it every
  // time. The transition rule means: the very first observation
  // of a job (no matter its status) just records state without
  // toasting; subsequent observations fire only when the status
  // crossed from non-terminal to terminal.
  useEffect(() => {
    for (const platform of ["IOS", "Android"] as const) {
      const job = platform === "IOS" ? iosJob : androidJob;
      if (!job) continue;
      const prev = prevJobStatusRef.current[platform];
      const terminal = job.status === "succeeded" || job.status === "failed";
      // Update the snapshot before deciding whether to toast — so
      // even if we don't toast (initial observation, dismissed, or
      // unchanged status) we still track the latest state.
      prevJobStatusRef.current[platform] = {
        jobId: job._id,
        status: job.status,
      };
      if (!terminal) continue;
      if (job.progress.phase === "dismissed") continue;
      // Initial observation (no prev snapshot) OR a new jobId we've
      // never seen → don't toast. We only toast for the same jobId
      // when the previous render saw it in a non-terminal state.
      if (!prev || prev.jobId !== job._id) continue;
      if (prev.status !== "queued" && prev.status !== "running") continue;
      const label = platform === "IOS" ? "App Store Connect" : "Play Console";
      const result = job.result;
      if (job.status === "succeeded" && result) {
        const summary =
          result.deleted !== undefined
            ? `Deleted ${result.deleted} row${result.deleted === 1 ? "" : "s"}`
            : `Pulled ${result.pulled}, pushed ${result.pushed}`;
        const plannedLines = result.plannedWrites?.length
          ? result.plannedWrites
              .map(
                (p) =>
                  `${p.productId} → ${p.step}${p.detail ? ": " + p.detail : ""}`,
              )
              .join("\n")
          : undefined;
        if (result.failures.length) {
          toast.error(`${label} sync — ${summary}`, {
            description:
              (plannedLines ? `Planned writes:\n${plannedLines}\n\n` : "") +
              result.failures
                .map((f) => `${f.productId}: ${f.reason}`)
                .join("\n"),
            duration: 12_000,
          });
        } else if (plannedLines) {
          toast.success(`${label} dry-run — ${summary} (no writes performed)`, {
            description: plannedLines,
            duration: 12_000,
          });
        } else {
          toast.success(`${label} sync — ${summary}`);
        }
      } else if (job.status === "failed") {
        toast.error(`${label} sync failed: ${job.error ?? "Unknown error"}`, {
          duration: 12_000,
        });
      }
    }
  }, [iosJob, androidJob]);

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
    const activeForPlatform = platform === "IOS" ? iosJob : androidJob;
    const isActive =
      activeForPlatform?.status === "queued" ||
      activeForPlatform?.status === "running";
    if (isActive) return;
    const label = platform === "IOS" ? "App Store Connect" : "Play Console";
    const dryRun = options?.dryRun === true;
    try {
      const { deduped } = await enqueueSync({
        apiKey: project.apiKey,
        platform,
        direction: "both",
        ...(dryRun ? { dryRun: true } : {}),
      });
      if (deduped) {
        toast.message(`${label} sync already running`, { duration: 4_000 });
      } else {
        toast.message(`${label} sync queued`, { duration: 3_000 });
      }
    } catch (error) {
      toast.error(
        `${label} sync failed: ${error instanceof Error ? error.message : String(error)}`,
        { duration: 12_000 },
      );
    }
  };

  const onPurge = async (platform: "IOS" | "Android") => {
    const activeForPlatform = platform === "IOS" ? iosJob : androidJob;
    const isActive =
      activeForPlatform?.status === "queued" ||
      activeForPlatform?.status === "running";
    if (isActive) return;
    const label = platform === "IOS" ? "App Store Connect" : "Play Console";
    try {
      const { deduped } = await enqueueSync({
        apiKey: project.apiKey,
        platform,
        direction: "purge-local",
      });
      if (deduped) {
        toast.message(`${label} reset already running`, { duration: 4_000 });
      } else {
        toast.message(`${label} catalog reset queued`, { duration: 3_000 });
      }
    } catch (error) {
      toast.error(
        `${label} reset failed: ${error instanceof Error ? error.message : String(error)}`,
        { duration: 12_000 },
      );
    }
  };

  const onCancel = async (jobId: SyncJob["_id"], label: string) => {
    try {
      const result = await cancelSync({ apiKey: project.apiKey, jobId });
      // The mutation returns `{ ok: false, reason: "not active" }`
      // when the job already finished between render and click.
      // Showing "cancellation requested" in that case is misleading
      // — the caller didn't actually request anything because the
      // job was already terminal (Copilot review on PR #127).
      if (result.ok) {
        toast.message(`${label} sync — cancellation requested`, {
          duration: 4_000,
        });
      } else if (result.reason === "not active") {
        toast.message(`${label} sync already finished`, {
          duration: 4_000,
        });
      } else {
        toast.message(`${label} sync — nothing to cancel`, {
          duration: 4_000,
        });
      }
    } catch (error) {
      toast.error(
        `Cancel failed: ${error instanceof Error ? error.message : String(error)}`,
        { duration: 8_000 },
      );
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

      {project.horizonEnabled ? <HorizonCatalogNotice /> : null}

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
        job={iosJob ?? null}
        onSync={() => {
          void onSync("IOS");
        }}
        onDryRun={() => {
          void onSync("IOS", { dryRun: true });
        }}
        onPurge={() => {
          void onPurge("IOS");
        }}
        onCancel={(jobId) => {
          void onCancel(jobId, "App Store Connect");
        }}
        onDismiss={(jobId) => {
          void dismissJob({ apiKey: project.apiKey, jobId });
        }}
      />
      <ProductGroup
        platform="Android"
        rows={grouped.android}
        job={androidJob ?? null}
        onSync={() => {
          void onSync("Android");
        }}
        onDryRun={() => {
          void onSync("Android", { dryRun: true });
        }}
        onPurge={() => {
          void onPurge("Android");
        }}
        onCancel={(jobId) => {
          void onCancel(jobId, "Play Console");
        }}
        onDismiss={(jobId) => {
          void dismissJob({ apiKey: project.apiKey, jobId });
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

// Map a job's `progress.phase` to the button label. Adds counts for
// the pull phases when available so the operator sees forward motion
// instead of a static "Syncing…" while the worker walks dozens of
// products.
function formatJobPhaseLabel(job: SyncJob | null, storeLabel: string): string {
  if (!job) return `Syncing with ${storeLabel}…`;
  const phase = job.progress.phase;
  const current = job.progress.current;
  switch (phase) {
    case "queued":
    case "starting":
      return `Queued for ${storeLabel}…`;
    case "pull-iaps":
      return `Pulling IAPs from ${storeLabel}…`;
    case "pull-subscriptions":
      return `Pulling subscriptions${
        current !== undefined ? ` (${current})` : ""
      }…`;
    case "pull-products":
      return `Pulling from ${storeLabel}…`;
    case "push-drafts":
      return `Pushing drafts to ${storeLabel}…`;
    case "purge-local":
      return `Resetting kit catalog${
        current !== undefined ? ` (${current} deleted)` : ""
      }…`;
    default:
      return `Syncing with ${storeLabel}…`;
  }
}

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
// "Subscription Group · {name}" header row. One-time products
// (Consumable / NonConsumable) and any row missing group metadata
// fall into an "Other products" cluster rendered after the
// subscription groups so the section breaks are explicit — without
// the second header, consumables visually inherited the previous
// "Subscription Group" header and looked like part of it.
// Original ordering is preserved within each cluster.
function groupRowsByHierarchy(
  rows: Array<ProductRow>,
): Array<
  | { kind: "groupHeader"; id: string; name: string }
  | { kind: "otherHeader"; id: string }
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
    | { kind: "otherHeader"; id: string }
    | { kind: "row"; row: ProductRow }
  > = [];
  for (const name of groupOrder) {
    out.push({ kind: "groupHeader", id: name, name });
    for (const row of buckets.get(name) ?? []) {
      out.push({ kind: "row", row });
    }
  }
  // Only emit the "Other products" delimiter when at least one
  // subscription group is also rendering — when there are no
  // groups, the table is just a flat list and the extra header
  // is noise. With at least one group above, the explicit
  // delimiter is what visually closes the group section.
  if (groupOrder.length > 0 && ungrouped.length > 0) {
    out.push({ kind: "otherHeader", id: "other-products" });
  }
  for (const row of ungrouped) {
    out.push({ kind: "row", row });
  }
  return out;
}

// Dry-run skips every POST/PATCH against the upstream store and
// returns a `plannedWrites` list the toast/banner renders so the
// operator can verify group, price tier, base plan, billing
// period, etc. before committing. Apple's ASC catalog can't be
// fully deleted (Removed != gone from catalog); Play archive is
// reversible but still affects live billing. Either way, previewing
// is the safer first step.
function DryRunButton({
  onDryRun,
  disabled,
  platform,
}: {
  onDryRun: () => void;
  disabled: boolean;
  platform: "IOS" | "Android";
}) {
  const storeLabel = platform === "IOS" ? "App Store Connect" : "Play Console";
  const constraint =
    platform === "IOS"
      ? "Apple won't let you fully delete an IAP once it's in the catalog, so this is the safety check."
      : "Play archive is reversible but still affects live billing, so this is the safety check.";
  return (
    <Tooltip
      content={
        <>
          <div className="font-medium mb-1">Read-only preview</div>
          <p className="text-muted-foreground leading-relaxed">
            Walks {storeLabel} like a real sync but{" "}
            <strong>skips every write</strong> (no products created, no
            listings, no price changes, no base plan activations). Returns a
            list of writes the real run would have made so you can verify them
            before committing — {constraint}
          </p>
        </>
      }
    >
      <button
        onClick={onDryRun}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs border border-border hover:bg-muted/40 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Dry-run
      </button>
    </Tooltip>
  );
}

// Meta Horizon doesn't expose a catalog REST API — only
// `verify_entitlement` (purchase check) and `consume_entitlement`
// (consumable burn-down) are reachable from the server side. SKU
// definitions live exclusively in Meta Quest Developer Hub. We
// surface the constraint here so a Horizon-enabled project's
// operator doesn't keep looking for a missing "Sync with Meta"
// button — kit handles entitlements (receipt verification +
// 6-hour reconciliation cron) but cannot mirror the catalog.
function HorizonCatalogNotice() {
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 flex items-start gap-3 text-xs text-blue-200">
      <Info className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="font-medium">Horizon catalog is upstream-only</div>
        <p className="leading-relaxed">
          Meta doesn&apos;t expose a catalog API — manage Quest / Horizon SKUs
          in Meta Quest Developer Hub. kit verifies Horizon receipts and
          reconciles subscription entitlements every 6 hours, but the SKU list
          itself can&apos;t be synced.
        </p>
        <a
          href="https://developers.meta.com/horizon/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline hover:text-blue-100"
        >
          Open Meta Quest Developer Hub
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// Trigger for the local-purge confirm dialog. Tooltip explains the
// scope (kit cache only, never store) so the operator isn't scared
// off by the destructive icon. Disabled state covers both "sync in
// progress" (would race with the worker) and "nothing to purge".
function ResetCatalogButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Tooltip
      content={
        <>
          <div className="font-medium mb-1">Reset local catalog</div>
          <p className="text-muted-foreground leading-relaxed">
            Deletes kit&apos;s local rows for this platform.{" "}
            <strong>Does not modify App Store Connect / Play Console.</strong>{" "}
            Use this when kit&apos;s cache has drifted from the store and you
            want a clean re-pull. Run Sync after to re-import.
          </p>
        </>
      }
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs border border-border hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Reset
      </button>
    </Tooltip>
  );
}

// Renders inside the shared <Modal> so the destructive confirm
// inherits the focus trap, escape handling, scroll lock, and
// focus-restore behavior — keyboard users can't tab into the table
// behind the backdrop while this is open (Copilot review on
// PR #127). The warning list intentionally calls out the two real
// risks of purge-then-sync: unpushed local edits get overwritten
// on re-pull, and kit-only Draft rows that never made it to the
// store disappear permanently.
function PurgeConfirmDialog({
  open,
  platform,
  rowCount,
  onClose,
  onConfirm,
}: {
  open: boolean;
  platform: "IOS" | "Android";
  rowCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const storeLabel = platform === "IOS" ? "App Store Connect" : "Play Console";
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      ariaLabel={`Reset local ${storeLabel} catalog`}
      showCloseButton={false}
      contentClassName="p-5"
      className="bg-card"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-rose-500/15 p-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div className="font-medium">Reset local {storeLabel} catalog?</div>
            <p className="text-xs text-muted-foreground mt-1">
              Deletes all {rowCount} kit-side{" "}
              {platform === "IOS" ? "iOS" : "Android"} row
              {rowCount === 1 ? "" : "s"}. {storeLabel} itself is not modified.
            </p>
          </div>
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>
              Local edits not yet pushed to {storeLabel} (price changes, review
              notes, titles) will be <strong>lost</strong> when the next Sync
              re-pulls the upstream copy.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>
              Draft rows that were never pushed upstream will be{" "}
              <strong>permanently deleted</strong> — they don&apos;t exist on{" "}
              {storeLabel} so Sync can&apos;t recover them.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs border border-border hover:bg-muted/40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded text-xs bg-rose-500/20 text-rose-700 dark:text-rose-200 border border-rose-500/40 hover:bg-rose-500/30"
          >
            Delete {rowCount} row{rowCount === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProductGroup({
  platform,
  rows,
  job,
  onSync,
  onDryRun,
  onPurge,
  onCancel,
  onDismiss,
}: {
  platform: "IOS" | "Android";
  rows: Array<ProductRow>;
  job: SyncJob | null;
  onSync: () => void;
  onDryRun?: () => void;
  onPurge: () => void;
  onCancel: (jobId: SyncJob["_id"]) => void;
  onDismiss: (jobId: SyncJob["_id"]) => void;
}) {
  const storeLabel = platform === "IOS" ? "App Store Connect" : "Play Console";
  const isActive = job?.status === "queued" || job?.status === "running";
  const isTerminal = job?.status === "succeeded" || job?.status === "failed";
  const dismissed = job?.progress.phase === "dismissed";
  const showResult = isTerminal && !dismissed;
  const [purgeOpen, setPurgeOpen] = useState(false);
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
            <DryRunButton
              onDryRun={onDryRun}
              disabled={isActive}
              platform={platform}
            />
          )}
          <ResetCatalogButton
            disabled={isActive || rows.length === 0}
            onClick={() => setPurgeOpen(true)}
          />
          {isActive && job ? (
            <button
              onClick={() => onCancel(job._id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs border border-border hover:bg-muted/40"
              title="Cancel takes effect at the next phase boundary"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          ) : null}
          <button
            onClick={onSync}
            disabled={isActive}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-muted hover:bg-muted/80 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isActive ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {isActive
              ? formatJobPhaseLabel(job, storeLabel)
              : `Sync with ${storeLabel}`}
          </button>
        </div>
      </div>
      <PurgeConfirmDialog
        open={purgeOpen}
        platform={platform}
        rowCount={rows.length}
        onClose={() => setPurgeOpen(false)}
        onConfirm={() => {
          setPurgeOpen(false);
          onPurge();
        }}
      />
      {showResult && job ? (
        // Theme-aware text colors — `-700` for the light surface,
        // `-200` for the dark surface. The earlier dark-only
        // palette (`text-rose-200` etc.) was unreadable in light
        // mode against the bg-tint background (Gemini review on
        // PR #127).
        <div
          className={`px-4 py-2 border-b border-border flex items-start gap-2 text-xs ${
            job.status === "failed"
              ? "bg-rose-500/10 text-rose-700 dark:text-rose-200"
              : job.result?.failures.length
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-200"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
          }`}
        >
          <div className="flex-1">
            {job.status === "succeeded" && job.result ? (
              <div>
                {job.result.deleted !== undefined
                  ? `Reset — deleted ${job.result.deleted} row${
                      job.result.deleted === 1 ? "" : "s"
                    }`
                  : `Last sync — pulled ${job.result.pulled}, pushed ${job.result.pushed}`}
                {job.result.failures.length
                  ? `, ${job.result.failures.length} failure${
                      job.result.failures.length === 1 ? "" : "s"
                    }`
                  : ""}
                {job.result.failuresTruncated ? " (truncated)" : ""}
              </div>
            ) : (
              <div>Last sync failed — {job.error ?? "Unknown error"}</div>
            )}
          </div>
          <button
            onClick={() => onDismiss(job._id)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      ) : null}
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
            ) : entry.kind === "otherHeader" ? (
              <tr
                key={`other:${entry.id}`}
                className="border-t border-border/50 bg-muted/20"
              >
                <td
                  colSpan={6}
                  className="px-4 py-1.5 text-xs uppercase tracking-wide text-muted-foreground"
                >
                  Other products
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
