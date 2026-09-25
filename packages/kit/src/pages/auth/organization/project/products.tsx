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
  FileCode2,
} from "lucide-react";

import type { Doc } from "@/convex";
import { api } from "@/convex";
import { PageLoading } from "@/components/LoadingSpinner";
import { Modal } from "@/components/Modal";
import { Tooltip } from "@/components/Tooltip";
import { Badge, PlatformBadge } from "../../../../components/Badge";
import { usdPriceToMicros } from "./productPrice";
import type { ProductClientPayloadSummary } from "./clientPayload";
import { openProductClientPayloadEditor } from "@/lib/signals";
import {
  formatProductSyncSummary,
  shouldShowProductSyncResult,
} from "./product-sync-result";
import { ProductSyncFailureList } from "./product-sync-failure-list";
import { resolveProductListingDraft } from "./product-localizations";

type DashboardProject = Omit<
  Doc<"projects">,
  "apiKey" | "horizonAppSecret" | "amazonSharedSecret"
>;
type ProjectContext = { project: DashboardProject };
type SyncJob = Doc<"productSyncJobs">;

export default function ProjectProducts() {
  const { project } = useOutletContext<ProjectContext>();
  const products = useQuery(api.products.query.listProducts, {
    projectId: project._id,
  });
  const clientPayloadSummaries = useQuery(
    api.products.query.listProductClientPayloadSummaries,
    { projectId: project._id },
  );
  const upsert = useMutation(api.products.mutation.upsertProduct);
  const enqueueSync = useMutation(api.products.jobs.enqueueProductSync);
  const cancelSync = useMutation(api.products.jobs.cancelProductSync);
  const dismissJob = useMutation(api.products.jobs.dismissCompletedJob);
  // The sync worker writes progress to its `productSyncJobs` row, so these
  // update without polling.
  const iosJob = useQuery(api.products.jobs.getActiveSyncJob, {
    projectId: project._id,
    platform: "IOS",
  });
  const androidJob = useQuery(api.products.jobs.getActiveSyncJob, {
    projectId: project._id,
    platform: "Android",
  });
  const listAscGroups = useAction(
    api.products.asc.listSubscriptionGroupsAppleIOS,
  );
  // ASC subscription group names for the autocomplete, loaded on first focus
  // so a project without ASC credentials doesn't hit a credential error on load.
  const [ascGroupNames, setAscGroupNames] = useState<string[] | null>(null);
  const [ascGroupLoadFailed, setAscGroupLoadFailed] = useState(false);
  // Last seen job status per platform, for the completion-toast check below.
  // Typed from `SyncJob` so a status added to the schema can't drift from it.
  type JobStatusSnapshot = {
    jobId: SyncJob["_id"];
    status: SyncJob["status"];
  };
  const prevJobStatusRef = useRef<
    Record<"IOS" | "Android", JobStatusSnapshot | null>
  >({
    IOS: null,
    Android: null,
  });
  // Job ids started from this mount (Sync, Dry-run, Reset). Only these get a
  // completion toast, so a job left over from a reload or revisit stays quiet.
  const sessionTriggeredJobIdsRef = useRef<Set<string>>(new Set());
  // Optional fields stay "" here and become `undefined` on submit, so an
  // empty price can't overwrite a stored price with NaN.
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
  // Extra store-listing languages. `title` / `description` keep the row's
  // base locale (en-US for new rows; a pulled store default may differ).
  const [localizations, setLocalizations] = useState<
    Array<{ locale: string; title: string; description: string }>
  >([]);
  // Comma-separated ISO region codes. Blank means "every region the
  // store prices", which is the default that fixes US-only products.
  const [regionsInput, setRegionsInput] = useState("");
  // Three states, matching what the product actually stores. "inherit"
  // is the default because expanding an existing product's markets is
  // something the operator asks for, not something a price edit does.
  const [regionMode, setRegionMode] = useState<"inherit" | "all" | "list">(
    "inherit",
  );
  // Only the Android one-time push applies regions: ASC prices territories
  // through a resource this flow doesn't touch, and Play fixes a base plan's
  // regions at create. The field is hidden rather than rejected on save.
  const supportsSalesRegions =
    draft.platform === "Android" && draft.type !== "Subscription";
  // A typed productId that matches a stored row means "edit this row", so the
  // editor can show what is stored instead of looking empty.
  const editingExisting = useMemo(
    () =>
      (products ?? []).find(
        (product) =>
          product.productId === draft.productId.trim() &&
          product.platform === draft.platform,
      ),
    [products, draft.productId, draft.platform],
  );
  const baseListingLocale = editingExisting?.baseLocale ?? "en-US";
  // The stored row the editors were loaded from, or null. Loading is a button,
  // not an effect: inferring it from a matching id overwrote half-typed work,
  // latched loading off, and let a blank language row delete stored listings.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const editingKey = editingExisting
    ? `${editingExisting.platform}\u0000${editingExisting.productId}`
    : null;
  // Only a row loaded from THIS product may send an empty array, which
  // is how a delete-all reaches the mutation. Otherwise an empty editor
  // means "not specified" and the stored value is preserved.
  const isLoadedRow = loadedKey !== null && loadedKey === editingKey;
  const loadStoredMetadata = () => {
    if (!editingExisting || !editingKey) return;
    setLoadedKey(editingKey);
    const storedRegions = editingExisting.regions;
    setRegionMode(
      storedRegions === "all"
        ? "all"
        : storedRegions?.length
          ? "list"
          : "inherit",
    );
    setRegionsInput(
      Array.isArray(storedRegions) ? storedRegions.join(", ") : "",
    );
    setLocalizations(
      (editingExisting.localizations ?? []).map((entry) => ({
        locale: entry.locale,
        title: entry.title,
        description: entry.description ?? "",
      })),
    );
  };

  const grouped = useMemo(() => {
    if (!products) return { ios: [], android: [] };
    const summariesByKey = new Map(
      (clientPayloadSummaries ?? []).map((summary) => [
        `${summary.platform}\u0000${summary.productId}`,
        summary,
      ]),
    );
    const rows = products.map((product) => ({
      ...product,
      clientPayload: summariesByKey.get(
        `${product.platform}\u0000${product.productId}`,
      ),
    }));
    return {
      ios: rows.filter((p) => p.platform === "IOS"),
      android: rows.filter((p) => p.platform === "Android"),
    };
  }, [clientPayloadSummaries, products]);

  // Toast only when a job moves from queued/running to terminal. The first
  // observation just records its status, so a job that finished before this
  // mount shows its banner without a toast (a seen-ids set resets on mount).
  useEffect(() => {
    for (const platform of ["IOS", "Android"] as const) {
      const job = platform === "IOS" ? iosJob : androidJob;
      if (!job) continue;
      const prev = prevJobStatusRef.current[platform];
      const terminal = job.status === "succeeded" || job.status === "failed";
      // Record the status before any of the `continue`s below.
      prevJobStatusRef.current[platform] = {
        jobId: job._id,
        status: job.status,
      };
      if (!terminal) continue;
      if (job.progress.phase === "dismissed") continue;
      // A job seen for the first time never toasts.
      if (!prev || prev.jobId !== job._id) continue;
      if (prev.status !== "queued" && prev.status !== "running") continue;
      // A sync started in another tab would otherwise toast here too.
      if (!sessionTriggeredJobIdsRef.current.has(job._id)) continue;
      const label = platform === "IOS" ? "App Store Connect" : "Play Console";
      const result = job.result;
      if (job.status === "succeeded" && result) {
        const summary = formatProductSyncSummary({
          dryRun: job.dryRun,
          direction: job.direction,
          result,
        });
        const plannedLines = result.plannedWrites?.length
          ? result.plannedWrites
              .map(
                (p) =>
                  `${p.productId} → ${p.step}${p.detail ? ": " + p.detail : ""}`,
              )
              .join("\n")
          : undefined;
        const manualLines = result.manualActions?.length
          ? result.manualActions
              .map((action) => `${action.productId}: ${action.message}`)
              .join("\n")
          : undefined;
        if (result.failures.length) {
          toast.error(`${label}: ${summary}`, {
            description:
              (plannedLines ? `Planned writes:\n${plannedLines}\n\n` : "") +
              (manualLines ? `Manual actions:\n${manualLines}\n\n` : "") +
              result.failures
                .map((f) => `${f.productId}: ${f.reason}`)
                .join("\n"),
            duration: 12_000,
          });
        } else if (manualLines) {
          toast.warning(`${label}: ${summary}`, {
            description: manualLines,
            duration: 12_000,
          });
        } else if (plannedLines) {
          toast.success(`${label}: ${summary}`, {
            description: plannedLines,
            duration: 12_000,
          });
        } else {
          toast.success(`${label}: ${summary}`);
        }
      } else if (job.status === "failed") {
        toast.error(
          `${label} ${job.dryRun ? "dry-run" : "sync"} failed: ${
            job.error ?? "Unknown error"
          }`,
          { duration: 12_000 },
        );
      }
    }
  }, [iosJob, androidJob]);

  if (products === undefined || clientPayloadSummaries === undefined) {
    return <PageLoading />;
  }

  // Convex wraps a thrown ConvexError so `error.message` carries the
  // framework's own prefix; the operator needs the guidance we wrote.
  const convexErrorMessage = (error: unknown): string | undefined => {
    const data = (error as { data?: unknown } | null)?.data;
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    if (typeof data === "string") return data;
    return error instanceof Error ? error.message : undefined;
  };

  const onAdd = async () => {
    if (!draft.productId || !draft.title) return;
    // "" → undefined, so a re-edit keeps the stored value (`?? existing.X`)
    // and a new row doesn't store "" as its description or review note.
    const description = draft.description.trim() || undefined;
    const reviewNote = draft.reviewNote.trim() || undefined;
    const priceAmountMicros = usdPriceToMicros(draft.priceUsd);
    const isSubIos = draft.type === "Subscription" && draft.platform === "IOS";
    if (isSubIos && !draft.subscriptionGroupName.trim()) {
      toast.error("Subscription group is required for iOS subscriptions");
      return;
    }
    const subscriptionGroupName = isSubIos
      ? draft.subscriptionGroupName.trim()
      : undefined;
    const billingPeriod =
      draft.type === "Subscription" ? draft.billingPeriod : undefined;
    const resolvedDraft = resolveProductListingDraft({
      rows: localizations,
      regionsInput,
      regionMode,
      supportsSalesRegions,
      editingExisting: Boolean(editingExisting),
      isLoadedRow,
    });
    if (!resolvedDraft.ok) {
      toast.error(resolvedDraft.error);
      return;
    }
    try {
      await upsert({
        projectId: project._id,
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
        localizations: resolvedDraft.localizations,
        regions: resolvedDraft.regions,
        state: "Draft",
      });
    } catch (error) {
      // The mutation rejects malformed locales, duplicates, and over-long
      // text; uncaught, that rejection vanished silently into `void onAdd()`.
      toast.error(convexErrorMessage(error) ?? "Could not save product");
      return;
    }
    setDraft({
      ...draft,
      productId: "",
      title: "",
      description: "",
      priceUsd: "",
      subscriptionGroupName: "",
      reviewNote: "",
    });
    setLocalizations([]);
    setRegionsInput("");
    setLoadedKey(null);
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
      const { jobId, deduped } = await enqueueSync({
        projectId: project._id,
        platform,
        direction: "both",
        ...(dryRun ? { dryRun: true } : {}),
      });
      sessionTriggeredJobIdsRef.current.add(jobId);
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
      const { jobId, deduped } = await enqueueSync({
        projectId: project._id,
        platform,
        direction: "purge-local",
      });
      sessionTriggeredJobIdsRef.current.add(jobId);
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
      const result = await cancelSync({ projectId: project._id, jobId });
      // "not active" means the job finished between render and click.
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
                required
                value={draft.subscriptionGroupName}
                onFocus={() => {
                  if (ascGroupNames !== null || ascGroupLoadFailed) return;
                  void listAscGroups({ projectId: project._id })
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
        {supportsSalesRegions && (
          <Field label="Sales regions">
            <select
              value={regionMode}
              onChange={(e) =>
                setRegionMode(e.target.value as "inherit" | "all" | "list")
              }
              className="w-full px-2 py-1.5 rounded border border-border bg-background"
            >
              <option value="inherit">
                Keep the store's current regions (new products: everywhere)
              </option>
              <option value="all">Sell in every region the store prices</option>
              <option value="list">Only these regions…</option>
            </select>
            {regionMode === "list" && (
              <input
                value={regionsInput}
                onChange={(e) => setRegionsInput(e.target.value)}
                placeholder="US, KR, JP"
                className="mt-2 w-full px-2 py-1.5 rounded border border-border bg-background"
              />
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              {regionMode === "inherit"
                ? "A product the store already has keeps exactly the regions it has today — a price change will not widen where it sells. A new product is priced in every region the store supports, converted from the price above."
                : regionMode === "all"
                  ? "Prices the product in every region the store supports, and follows the store into markets it adds later."
                  : "Two-letter country codes, comma separated. Restricts the product to those markets and keeps it out of regions the store adds later. Stores refuse to drop a region once it has been added, so the others are withdrawn rather than removed."}
            </p>
          </Field>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Other languages (optional)
            </span>
            {editingExisting && !isLoadedRow && (
              <button
                onClick={loadStoredMetadata}
                className="text-xs text-primary hover:underline"
              >
                Load stored languages{supportsSalesRegions ? " & regions" : ""}
              </button>
            )}
            <button
              onClick={() =>
                setLocalizations([
                  ...localizations,
                  { locale: "", title: "", description: "" },
                ])
              }
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="w-3 h-3" /> Add language
            </button>
          </div>
          {localizations.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">
              The title and description above publish as {baseListingLocale}.
              Add a language to show a translated name in that store locale —
              pricing is already converted per region automatically.
              {editingExisting
                ? " This product already exists: leaving this empty keeps its stored languages. Load them to edit or remove them."
                : ""}
            </p>
          ) : (
            localizations.map((entry, index) => (
              <div
                key={index}
                className="grid md:grid-cols-[7rem_1fr_1fr_auto] gap-2 items-center"
              >
                <input
                  value={entry.locale}
                  onChange={(e) =>
                    setLocalizations(
                      localizations.map((row, i) =>
                        i === index ? { ...row, locale: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="ko-KR"
                  className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm"
                />
                <input
                  value={entry.title}
                  onChange={(e) =>
                    setLocalizations(
                      localizations.map((row, i) =>
                        i === index ? { ...row, title: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="Title in this language"
                  className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm"
                />
                <input
                  value={entry.description}
                  onChange={(e) =>
                    setLocalizations(
                      localizations.map((row, i) =>
                        i === index
                          ? { ...row, description: e.target.value }
                          : row,
                      ),
                    )
                  }
                  placeholder="Description in this language"
                  className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm"
                />
                <button
                  onClick={() =>
                    setLocalizations(
                      localizations.filter((_, i) => i !== index),
                    )
                  }
                  aria-label={`Remove ${entry.locale || "language"}`}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
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
        {draft.platform === "IOS" && (
          <div className="rounded border border-border/80 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            On iOS, Sync pushes the row to App Store Connect, creates the base
            localization, and sets the USA price tier. App Store Connect may
            still show &quot;Missing Metadata&quot; until review metadata and
            screenshots are added and the product is attached to an app version
            for review.
          </div>
        )}
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
          void dismissJob({ projectId: project._id, jobId });
        }}
        onEditClientPayload={(row) =>
          openProductClientPayloadEditor({
            projectId: project._id,
            platform: "IOS",
            productId: row.productId,
            title: row.title,
          })
        }
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
          void dismissJob({ projectId: project._id, jobId });
        }}
        onEditClientPayload={(row) =>
          openProductClientPayloadEditor({
            projectId: project._id,
            platform: "Android",
            productId: row.productId,
            title: row.title,
          })
        }
      />
    </div>
  );
}

type ProductRow = {
  clientPayload?: ProductClientPayloadSummary;
  productId: string;
  type: string;
  title: string;
  state: string;
  storeRef?: string;
  priceAmountMicros?: number;
  currency?: string;
  billingPeriod?: "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y";
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

// Includes a count where the phase has one, so a long sync visibly moves.
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

// Subscriptions get their period ("USD 9.99 / 1 month") so iOS rows match
// Play's base-plan badges; other types show the bare price.
function formatPriceWithPeriod(
  priceAmountMicros: number,
  currency: string | undefined,
  billingPeriod: string | undefined,
): string {
  const cur = currency ?? "";
  const amount = (priceAmountMicros / 1_000_000).toFixed(2);
  const base = `${cur} ${amount}`.trim();
  const period = billingPeriod ? formatIsoDuration(billingPeriod) : "";
  return period ? `${base} / ${period}` : base;
}

// Badge label for one offer. Separate from price formatting because a free
// trial has no price.
function offerLabel(
  offer: ProductRow["offers"] extends Array<infer O> | undefined ? O : never,
): string {
  const period = offer.duration ? formatIsoDuration(offer.duration) : "";
  // A Play base plan can lose its period between the Play API and kit's
  // cache; show the bare price then, never "USD 10.99 / ?".
  switch (offer.kind) {
    case "BasePlan":
      if (offer.priceAmountMicros !== undefined && offer.currency) {
        const price = `${offer.currency} ${(offer.priceAmountMicros / 1_000_000).toFixed(2)}`;
        return period ? `${price} / ${period}` : price;
      }
      return period || "Base plan";
    case "FreeTrial":
      return period ? `${period} free trial` : "Free trial";
    case "IntroPayUpFront":
      if (offer.priceAmountMicros !== undefined && offer.currency) {
        const price = `${offer.currency} ${(offer.priceAmountMicros / 1_000_000).toFixed(2)}`;
        return period ? `${price} intro for ${period}` : `${price} intro`;
      }
      return "Intro (pay up front)";
    case "IntroPayAsYouGo":
      if (offer.priceAmountMicros !== undefined && offer.currency) {
        const price = `${offer.currency} ${(offer.priceAmountMicros / 1_000_000).toFixed(2)}`;
        const periods = offer.numberOfPeriods;
        if (period && periods !== undefined) {
          return `${price} / ${period} × ${periods}`;
        }
        if (period) return `${price} / ${period}`;
        return periods !== undefined ? `${price} × ${periods}` : price;
      }
      return "Intro (pay as you go)";
    case "PromotionalOffer":
      return "Promotional offer";
    default:
      return offer.kind;
  }
}

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

// Orders rows as: named iOS subscription groups (Apple's upgrade/downgrade
// unit), then ungrouped subscriptions under "Subscriptions" (Play has no
// groups; older iOS rows lack a name), then "Other products". Both platforms
// list subscriptions first; order within each cluster is kept.
function groupRowsByHierarchy(
  rows: Array<ProductRow>,
): Array<
  | { kind: "groupHeader"; id: string; name: string }
  | { kind: "subscriptionsHeader"; id: string }
  | { kind: "otherHeader"; id: string }
  | { kind: "row"; row: ProductRow }
> {
  const namedBuckets = new Map<string, Array<ProductRow>>();
  const namedOrder: string[] = [];
  const unnamedSubs: Array<ProductRow> = [];
  const others: Array<ProductRow> = [];
  for (const row of rows) {
    if (row.type !== "Subscription") {
      others.push(row);
      continue;
    }
    const name = row.subscriptionGroupName;
    if (name) {
      if (!namedBuckets.has(name)) {
        namedBuckets.set(name, []);
        namedOrder.push(name);
      }
      namedBuckets.get(name)!.push(row);
      continue;
    }
    unnamedSubs.push(row);
  }
  const out: Array<
    | { kind: "groupHeader"; id: string; name: string }
    | { kind: "subscriptionsHeader"; id: string }
    | { kind: "otherHeader"; id: string }
    | { kind: "row"; row: ProductRow }
  > = [];
  for (const name of namedOrder) {
    out.push({ kind: "groupHeader", id: name, name });
    for (const row of namedBuckets.get(name) ?? []) {
      out.push({ kind: "row", row });
    }
  }
  if (unnamedSubs.length > 0) {
    out.push({ kind: "subscriptionsHeader", id: "subscriptions" });
    for (const row of unnamedSubs) {
      out.push({ kind: "row", row });
    }
  }
  // A list with no subscriptions needs no "Other products" header.
  const hasSubsAbove = namedOrder.length > 0 || unnamedSubs.length > 0;
  if (hasSubsAbove && others.length > 0) {
    out.push({ kind: "otherHeader", id: "other-products" });
  }
  for (const row of others) {
    out.push({ kind: "row", row });
  }
  return out;
}

// Previews a sync: no store writes, just the `plannedWrites` it would make.
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
      ? "Apple deletes eligible IAPs/subscriptions irreversibly and product IDs cannot be reused."
      : "Play only deletes eligible products; subscriptions with published base plans will report a sync failure.";
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

// IAPKit has no Horizon catalog sync; this tells operators why there is no
// Sync button and that verification is on-demand only.
function HorizonCatalogNotice() {
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 flex items-start gap-3 text-xs text-blue-700 dark:text-blue-200">
      <Info className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="font-medium">Horizon catalog sync is not supported</div>
        <p className="leading-relaxed">
          Manage Quest / Horizon SKUs in Meta Horizon Developer Dashboard.
          IAPKit currently supports on-demand entitlement checks through its raw
          REST verification route; it does not sync the catalog or run
          background Horizon subscription reconciliation.
        </p>
        <a
          href="https://developers.meta.com/horizon/documentation/native/ps-iap-s2s/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline hover:text-blue-800 dark:hover:text-blue-100"
        >
          Open Meta Horizon documentation
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// Opens the purge confirm. Disabled while a sync runs (it would race the
// worker) and when there is nothing to purge.
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
            want a clean re-pull. Run Sync after to re-import. Client payloads
            are stored separately and retained.
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

// Uses the shared <Modal> for its focus trap. The warnings name the two real
// risks of purge-then-sync: unpushed edits are overwritten on re-pull, and
// Draft rows never pushed to the store are lost for good.
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
        <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-200">
          Client payloads are stored separately and are retained. They appear
          again when Sync re-pulls the matching platform and product ID.
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
  onEditClientPayload,
}: {
  platform: "IOS" | "Android";
  rows: Array<ProductRow>;
  job: SyncJob | null;
  onSync: () => void;
  onDryRun?: () => void;
  onPurge: () => void;
  onCancel: (jobId: SyncJob["_id"]) => void;
  onDismiss: (jobId: SyncJob["_id"]) => void;
  onEditClientPayload: (row: ProductRow) => void;
}) {
  const storeLabel = platform === "IOS" ? "App Store Connect" : "Play Console";
  const isActive = job?.status === "queued" || job?.status === "running";
  // A terminal result stays visible across reloads until dismissed, so an
  // operator who left mid-sync still sees ASC manual actions on return. Only
  // the completion toast is limited to jobs started in this session.
  const showResult = shouldShowProductSyncResult(job);
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
        // `-700` text for light, `-200` for dark; `-200` alone is unreadable
        // on the light tint.
        <div
          className={`px-4 py-2 border-b border-border flex items-start gap-2 text-xs ${
            job.status === "failed"
              ? "bg-rose-500/10 text-rose-700 dark:text-rose-200"
              : job.result?.failures.length || job.result?.manualActions?.length
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-200"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
          }`}
        >
          <div className="flex-1">
            {job.status === "succeeded" && job.result ? (
              <div>
                <div>
                  {formatProductSyncSummary({
                    dryRun: job.dryRun,
                    direction: job.direction,
                    result: job.result,
                  })}
                  {job.result.failures.length
                    ? `, ${job.result.failures.length} failure${
                        job.result.failures.length === 1 ? "" : "s"
                      }`
                    : ""}
                  {job.result.failuresTruncated ? " (truncated)" : ""}
                  {job.result.plannedWritesTruncated
                    ? ", planned writes truncated"
                    : ""}
                  {job.result.manualActions?.length
                    ? `, ${job.result.manualActions.length} manual action${
                        job.result.manualActions.length === 1 ? "" : "s"
                      }`
                    : ""}
                  {job.result.manualActionsTruncated
                    ? " (manual actions truncated)"
                    : ""}
                </div>
                <ProductSyncFailureList failures={job.result.failures} />
                {job.result.manualActions?.length ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {job.result.manualActions.map((action, index) => (
                      <li key={`${action.productId}:${action.code}:${index}`}>
                        <span className="font-medium">{action.productId}</span>
                        {": "}
                        {action.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <div>
                {job.dryRun ? "Dry-run failed" : "Last sync failed"} —{" "}
                {job.error ?? "Unknown error"}
              </div>
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 text-left">
                Product ID
              </th>
              <th scope="col" className="px-4 py-2 text-left">
                Title
              </th>
              <th scope="col" className="px-4 py-2 text-left">
                Type
              </th>
              <th scope="col" className="px-4 py-2 text-left">
                State
              </th>
              <th scope="col" className="px-4 py-2 text-left">
                Store ref
              </th>
              <th scope="col" className="px-4 py-2 text-left">
                Price
              </th>
              <th scope="col" className="px-4 py-2 text-left">
                Client payload
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Nothing yet. Add a product above or hit Sync to pull an
                  existing catalog.
                </td>
              </tr>
            )}
            {groupRowsByHierarchy(rows).map((entry) =>
              entry.kind === "groupHeader" ? (
                <tr
                  key={`group:${entry.id}`}
                  className="border-t-2 border-l-4 border-blue-500/60 border-t-blue-500/30 bg-blue-500/10"
                >
                  <td
                    colSpan={7}
                    className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="text-blue-700 dark:text-blue-300">
                        Subscription Group
                      </span>
                      <span className="text-blue-700/40 dark:text-blue-300/40">
                        ·
                      </span>
                      <span className="font-mono normal-case tracking-normal text-foreground">
                        {entry.name}
                      </span>
                    </span>
                  </td>
                </tr>
              ) : entry.kind === "subscriptionsHeader" ? (
                <tr
                  key={`subs:${entry.id}`}
                  className="border-t-2 border-l-4 border-blue-500/60 border-t-blue-500/30 bg-blue-500/10"
                >
                  <td
                    colSpan={7}
                    className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                  >
                    <span className="text-blue-700 dark:text-blue-300">
                      Subscriptions
                    </span>
                  </td>
                </tr>
              ) : entry.kind === "otherHeader" ? (
                <tr
                  key={`other:${entry.id}`}
                  className="border-t-2 border-l-4 border-amber-500/50 border-t-amber-500/30 bg-amber-500/10"
                >
                  <td
                    colSpan={7}
                    className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                  >
                    <span className="text-amber-700 dark:text-amber-300">
                      Other products
                    </span>
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
                      ? formatPriceWithPeriod(
                          entry.row.priceAmountMicros,
                          entry.row.currency,
                          entry.row.type === "Subscription"
                            ? entry.row.billingPeriod
                            : undefined,
                        )
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => onEditClientPayload(entry.row)}
                      aria-label={`${
                        entry.row.clientPayload ? "Edit" : "Add"
                      } client payload for ${entry.row.productId} on ${
                        platform === "IOS" ? "iOS" : "Android"
                      }`}
                      className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground"
                    >
                      <FileCode2 className="h-3.5 w-3.5" />
                      {entry.row.clientPayload
                        ? `${entry.row.clientPayload.format.toUpperCase()} v${entry.row.clientPayload.version}`
                        : "Add payload"}
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
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

// `appearance-none` hides the native arrow; a padded ChevronDown replaces it.
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
