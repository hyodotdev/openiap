"use node";

import { createHash } from "node:crypto";

export type AscReviewKind = "iap" | "subscription";
export const ASC_REVIEW_SUBMISSION_ITEM_LIMIT = 200;
// Keep one worker's prepare→submit unit comfortably below Convex's action
// limit. Later rows remain Draft and are picked up after this ASC submission
// is no longer active.
export const ASC_REVIEW_SYNC_BATCH_LIMIT = 8;

export function partitionAscReviewSubmissionItems<T>(items: readonly T[]): {
  selected: T[];
  deferred: T[];
} {
  return {
    selected: items.slice(0, ASC_REVIEW_SUBMISSION_ITEM_LIMIT),
    deferred: items.slice(ASC_REVIEW_SUBMISSION_ITEM_LIMIT),
  };
}

export type AscJsonRequest = <T>(
  path: string,
  init?: RequestInit & { body?: string },
) => Promise<T>;

export interface AscReviewScreenshot {
  fileName: string;
  fileType: "image/png" | "image/jpeg";
  bytes: Uint8Array;
}

export interface AscReviewVersionItem {
  productId: string;
  storeRef: string;
  kind: AscReviewKind;
  productType:
    | "Subscription"
    | "NonRenewingSubscription"
    | "NonConsumable"
    | "Consumable";
  versionId: string;
  subscriptionGroupId?: string;
}

export interface AscReviewEligibilitySnapshot {
  approvedProductTypes: ReadonlySet<AscReviewVersionItem["productType"]>;
  approvedSubscriptionGroupIds: ReadonlySet<string>;
}

export type AscReviewSubmissionOutcome =
  | { item: AscReviewVersionItem; status: "submitted" }
  | {
      item: AscReviewVersionItem;
      status: "manual";
      action: AscManualReviewAction;
    }
  | { item: AscReviewVersionItem; status: "failed"; reason: string };

export interface AscReviewSubmissionResult {
  outcomes: AscReviewSubmissionOutcome[];
  globalFailure?: string;
}

export interface AscManualReviewAction {
  productId: string;
  code:
    | "app_version_required"
    | "subscription_group_required"
    | "review_submission_conflict"
    | "review_submission_status_unknown";
  message: string;
}

interface AscUploadOperation {
  method: string;
  url: string;
  offset: number;
  length: number;
  requestHeaders?: Array<{ name: string; value: string }>;
}

interface AscReviewScreenshotResource {
  data: {
    id: string;
    type:
      | "inAppPurchaseAppStoreReviewScreenshots"
      | "subscriptionAppStoreReviewScreenshots";
    attributes?: {
      fileName?: string;
      fileSize?: number;
      sourceFileChecksum?: string;
      uploadOperations?: AscUploadOperation[];
      assetDeliveryState?: {
        state?: string;
        errors?: Array<{ code?: string; description?: string }>;
      };
    };
  } | null;
}

interface AscVersionResource {
  id: string;
  type: "inAppPurchaseVersions" | "subscriptionVersions";
  attributes?: { state?: string; version?: string };
}

interface AscVersionResponse {
  data: AscVersionResource;
}

interface AscVersionsResponse {
  data: AscVersionResource[];
}

interface AscLocalizationResponse {
  data: Array<{
    id: string;
    type: "inAppPurchaseLocalizations" | "subscriptionLocalizations";
    attributes?: {
      locale?: string;
      name?: string;
      description?: string;
    };
  }>;
  links?: { next?: string | null };
}

const ASC_API_ORIGIN = "https://api.appstoreconnect.apple.com";

function ascNextPath(next: string): string {
  if (next.startsWith("/")) return next;
  const url = new URL(next);
  if (url.origin !== ASC_API_ORIGIN) {
    throw new Error(
      `ASC pagination returned an unexpected host: ${url.origin}`,
    );
  }
  return `${url.pathname}${url.search}`;
}

async function readAllAscLocalizations(args: {
  request: AscJsonRequest;
  initialPath: string;
  checkCancelled: () => Promise<void>;
}): Promise<AscLocalizationResponse["data"]> {
  const rows: AscLocalizationResponse["data"] = [];
  let path: string | null = args.initialPath;
  let pages = 0;
  while (path && pages < 200) {
    await args.checkCancelled();
    const page: AscLocalizationResponse = await args.request(path);
    rows.push(...page.data);
    path = page.links?.next ? ascNextPath(page.links.next) : null;
    pages += 1;
  }
  if (path) {
    throw new Error("ASC localization pagination exceeded 200 pages");
  }
  return rows;
}

interface AscReviewSubmissionResponse {
  data: { id: string; type: "reviewSubmissions" };
}

const SCREENSHOT_CONFIG = {
  iap: {
    type: "inAppPurchaseAppStoreReviewScreenshots" as const,
    collection: "/v1/inAppPurchaseAppStoreReviewScreenshots",
    relationship: "inAppPurchaseV2",
    parentType: "inAppPurchases",
    existingPath: (id: string) =>
      `/v2/inAppPurchases/${encodeURIComponent(id)}/appStoreReviewScreenshot`,
  },
  subscription: {
    type: "subscriptionAppStoreReviewScreenshots" as const,
    collection: "/v1/subscriptionAppStoreReviewScreenshots",
    relationship: "subscription",
    parentType: "subscriptions",
    existingPath: (id: string) =>
      `/v1/subscriptions/${encodeURIComponent(id)}/appStoreReviewScreenshot`,
  },
};

const VERSION_CONFIG = {
  iap: {
    type: "inAppPurchaseVersions" as const,
    collection: "/v1/inAppPurchaseVersions",
    relationship: "inAppPurchase",
    parentType: "inAppPurchases",
    listPath: (id: string) =>
      `/v2/inAppPurchases/${encodeURIComponent(id)}/versions?limit=200`,
    localizationType: "inAppPurchaseLocalizations" as const,
    localizationCollection: "/v2/inAppPurchaseLocalizations",
    localizationListPath: (versionId: string) =>
      `/v1/inAppPurchaseVersions/${encodeURIComponent(versionId)}/localizations?limit=200`,
    itemRelationship: "inAppPurchaseVersion",
  },
  subscription: {
    type: "subscriptionVersions" as const,
    collection: "/v1/subscriptionVersions",
    relationship: "subscription",
    parentType: "subscriptions",
    listPath: (id: string) =>
      `/v1/subscriptions/${encodeURIComponent(id)}/versions?limit=200`,
    localizationType: "subscriptionLocalizations" as const,
    localizationCollection: "/v2/subscriptionLocalizations",
    localizationListPath: (versionId: string) =>
      `/v1/subscriptionVersions/${encodeURIComponent(versionId)}/localizations?limit=200`,
    itemRelationship: "subscriptionVersion",
  },
};

function statusOf(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNotFound(error: unknown): boolean {
  return statusOf(error) === 404;
}

export function isAscApprovedReviewHistoryState(
  state: string | undefined,
): boolean {
  switch (state?.toUpperCase()) {
    case "APPROVED":
    case "ACCEPTED":
    case "READY_FOR_SALE":
    case "REPLACED":
    case "REPLACED_WITH_NEW_VERSION":
    case "DEVELOPER_REMOVED_FROM_SALE":
    case "REMOVED_FROM_SALE":
      return true;
    default:
      return false;
  }
}

export function getAscReviewEligibilityActions(args: {
  item: AscReviewVersionItem;
  snapshot: AscReviewEligibilitySnapshot;
}): AscManualReviewAction[] {
  const actions: AscManualReviewAction[] = [];
  if (!args.snapshot.approvedProductTypes.has(args.item.productType)) {
    actions.push({
      productId: args.item.productId,
      code: "app_version_required",
      message:
        `Apple requires the first ${args.item.productType} product to be ` +
        "submitted with a new app version in App Store Connect. The product " +
        "metadata and review screenshot are prepared; add it to that app-version submission.",
    });
  }
  if (
    args.item.productType === "Subscription" &&
    (!args.item.subscriptionGroupId ||
      !args.snapshot.approvedSubscriptionGroupIds.has(
        args.item.subscriptionGroupId,
      ))
  ) {
    actions.push({
      productId: args.item.productId,
      code: "subscription_group_required",
      message:
        "Apple requires each new subscription group to be submitted with at " +
        "least one subscription. The subscription metadata and review " +
        "screenshot are prepared; create/attach the group version and finish " +
        "the combined submission in App Store Connect. Include an app version " +
        "only when the separate first-subscription action also requires it.",
    });
  }
  return actions;
}

/** Map Apple's non-retryable first-product constraints to operator follow-up. */
export function classifyAscManualReviewAction(
  error: unknown,
  productId: string,
): AscManualReviewAction | null {
  const status = statusOf(error);
  if (status !== 409 && status !== 422) return null;

  const message = messageOf(error);
  const lower = message.toLowerCase();
  if (
    lower.includes("subscription group") &&
    (lower.includes("review") || lower.includes("submit"))
  ) {
    return {
      productId,
      code: "subscription_group_required",
      message:
        `${message} Finish the combined subscription-group and subscription ` +
        "submission in App Store Connect, then run Push Sync again. Include " +
        "an app version only when Apple separately requires the first " +
        "auto-renewable subscription to travel with one.",
    };
  }
  if (
    (lower.includes("app version") || lower.includes("new version")) &&
    (lower.includes("first") ||
      lower.includes("in-app purchase") ||
      lower.includes("subscription"))
  ) {
    return {
      productId,
      code: "app_version_required",
      message:
        `${message} Apple requires the first product of this type to be ` +
        "submitted with a new app version in App Store Connect.",
    };
  }
  if (
    lower.includes("review submission") &&
    (lower.includes("already") || lower.includes("active"))
  ) {
    return {
      productId,
      code: "review_submission_conflict",
      message:
        `${message} Complete or discard the existing draft review ` +
        "submission in App Store Connect, then run Push Sync again.",
    };
  }
  return null;
}

function matchesManualConstraintProduct(
  error: unknown,
  item: AscReviewVersionItem,
): boolean {
  if (!classifyAscManualReviewAction(error, item.productId)) return false;
  const lower = messageOf(error).toLowerCase();
  if (
    lower.includes("subscription group") ||
    lower.includes("auto-renewable")
  ) {
    return item.productType === "Subscription";
  }
  if (lower.includes("non-renewing")) {
    return item.productType === "NonRenewingSubscription";
  }
  if (lower.includes("non-consumable")) {
    return item.productType === "NonConsumable";
  }
  if (lower.includes("consumable")) {
    return item.productType === "Consumable";
  }
  if (lower.includes("subscription")) {
    return item.productType === "Subscription";
  }
  return false;
}

export function md5Hex(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("hex");
}

function validateUploadOperations(
  operations: AscUploadOperation[],
  fileSize: number,
): AscUploadOperation[] {
  if (operations.length === 0) {
    throw new Error("ASC screenshot reservation returned no upload operations");
  }
  const sorted = [...operations].sort((a, b) => a.offset - b.offset);
  let nextOffset = 0;
  for (const operation of sorted) {
    if (
      !operation.method ||
      !operation.url ||
      !Number.isSafeInteger(operation.offset) ||
      !Number.isSafeInteger(operation.length) ||
      operation.offset !== nextOffset ||
      operation.length <= 0 ||
      operation.offset + operation.length > fileSize
    ) {
      throw new Error(
        "ASC screenshot reservation returned invalid upload operation ranges",
      );
    }
    nextOffset += operation.length;
  }
  if (nextOffset !== fileSize) {
    throw new Error(
      `ASC screenshot upload operations cover ${nextOffset} of ${fileSize} bytes`,
    );
  }
  return sorted;
}

export class AscReviewScreenshotPendingError extends Error {
  constructor(attempts: number) {
    super(
      `ASC screenshot delivery is still processing after ${attempts} polls; run Push Sync again to resume`,
    );
    this.name = "AscReviewScreenshotPendingError";
  }
}

class AscReviewScreenshotDeliveryFailedError extends Error {
  constructor(detail: string) {
    super(`ASC screenshot delivery failed${detail ? `: ${detail}` : ""}`);
    this.name = "AscReviewScreenshotDeliveryFailedError";
  }
}

async function pollAscReviewScreenshotDelivery(args: {
  request: AscJsonRequest;
  resourcePath: string;
  checksum: string;
  reused: boolean;
  checkCancelled: () => Promise<void>;
  sleep: (milliseconds: number) => Promise<void>;
  maxPollAttempts: number;
}): Promise<{ screenshotId: string; checksum: string; reused: boolean }> {
  const attempts = Math.max(1, args.maxPollAttempts);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await args.checkCancelled();
    const current = await args.request<AscReviewScreenshotResource>(
      args.resourcePath,
    );
    const currentData = current.data;
    const state =
      currentData?.attributes?.assetDeliveryState?.state?.toUpperCase();
    if (state === "COMPLETE" && currentData) {
      return {
        screenshotId: currentData.id,
        checksum: args.checksum,
        reused: args.reused,
      };
    }
    if (state === "FAILED") {
      const errors = currentData?.attributes?.assetDeliveryState?.errors ?? [];
      const detail = errors
        .map((error) => error.description ?? error.code)
        .filter(Boolean)
        .join("; ");
      throw new AscReviewScreenshotDeliveryFailedError(detail);
    }
    if (attempt + 1 < attempts) {
      await args.sleep(Math.min(1_000 * 2 ** attempt, 5_000));
    }
  }
  throw new AscReviewScreenshotPendingError(attempts);
}

export async function uploadAscReviewScreenshot(args: {
  request: AscJsonRequest;
  kind: AscReviewKind;
  parentId: string;
  screenshot: AscReviewScreenshot;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  checkCancelled?: () => Promise<void>;
  maxPollAttempts?: number;
  uploadTimeoutMs?: number;
}): Promise<{ screenshotId: string; checksum: string; reused: boolean }> {
  const config = SCREENSHOT_CONFIG[args.kind];
  const checksum = md5Hex(args.screenshot.bytes);
  const checkCancelled = args.checkCancelled ?? (async () => undefined);
  const fetchImpl = args.fetchImpl ?? fetch;
  const sleep =
    args.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  await checkCancelled();
  let existing: AscReviewScreenshotResource | null = null;
  try {
    existing = await args.request<AscReviewScreenshotResource>(
      config.existingPath(args.parentId),
    );
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  const existingData = existing?.data ?? null;
  const existingState =
    existingData?.attributes?.assetDeliveryState?.state?.toUpperCase();
  const existingHasSameChecksum =
    existingData?.attributes?.sourceFileChecksum?.toLowerCase() === checksum;
  if (existingData && existingHasSameChecksum) {
    if (existingState === "COMPLETE") {
      return { screenshotId: existingData.id, checksum, reused: true };
    }
    if (existingState !== "FAILED") {
      // A prior run committed this exact file and stopped while Apple was
      // processing it. Resume polling the same asset; deleting/re-uploading on
      // every retry can keep a healthy asset from ever reaching COMPLETE.
      try {
        return await pollAscReviewScreenshotDelivery({
          request: args.request,
          resourcePath: `${config.collection}/${encodeURIComponent(existingData.id)}`,
          checksum,
          reused: true,
          checkCancelled,
          sleep,
          maxPollAttempts: args.maxPollAttempts ?? 8,
        });
      } catch (error) {
        if (!(error instanceof AscReviewScreenshotDeliveryFailedError)) {
          // Pending, cancellation, deadline, and transport errors all leave a
          // checksum-committed asset that a later sync can safely resume.
          throw error;
        }
        await checkCancelled();
        await args.request(
          `${config.collection}/${encodeURIComponent(existingData.id)}`,
          { method: "DELETE" },
        );
        throw error;
      }
    }
  }
  if (existingData) {
    // The GET above can be slow. Re-check immediately before the destructive
    // replacement so a cancellation never deletes the existing ASC asset and
    // exits without installing its replacement.
    await checkCancelled();
    await args.request(
      `${config.collection}/${encodeURIComponent(existingData.id)}`,
      {
        method: "DELETE",
      },
    );
  }

  await checkCancelled();
  const reserved = await args.request<AscReviewScreenshotResource>(
    config.collection,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: config.type,
          attributes: {
            fileName: args.screenshot.fileName,
            fileSize: args.screenshot.bytes.byteLength,
          },
          relationships: {
            [config.relationship]: {
              data: { type: config.parentType, id: args.parentId },
            },
          },
        },
      }),
    },
  );
  if (!reserved.data) {
    throw new Error("ASC screenshot reservation returned no resource");
  }
  const reservedData = reserved.data;
  const resourcePath = `${config.collection}/${encodeURIComponent(reservedData.id)}`;
  let checksumCommitAttempted = false;
  let checksumCommitConfirmed = false;
  try {
    const operations = validateUploadOperations(
      reservedData.attributes?.uploadOperations ?? [],
      args.screenshot.bytes.byteLength,
    );

    // These are Apple-provided pre-signed URLs. Deliberately use bare fetch
    // instead of request(): adding the ASC bearer token changes the signature.
    for (const operation of operations) {
      await checkCancelled();
      const headers = Object.fromEntries(
        (operation.requestHeaders ?? []).map(({ name, value }) => [
          name,
          value,
        ]),
      );
      const body = args.screenshot.bytes.slice(
        operation.offset,
        operation.offset + operation.length,
      );
      const controller = new AbortController();
      const timeoutMs = args.uploadTimeoutMs ?? 30_000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(operation.url, {
          method: operation.method,
          headers,
          body: body as BodyInit,
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error(
            `ASC screenshot upload operation timed out after ${timeoutMs}ms`,
          );
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        throw new Error(
          `ASC screenshot upload operation returned ${response.status}: ${await response.text()}`,
        );
      }
    }

    await checkCancelled();
    // Set before the request: a statusless transport error may mean Apple
    // accepted the commit but its response was lost. Preserve the asset in
    // that ambiguous case so a retry can discover it by checksum.
    checksumCommitAttempted = true;
    await args.request<AscReviewScreenshotResource>(resourcePath, {
      method: "PATCH",
      body: JSON.stringify({
        data: {
          type: config.type,
          id: reservedData.id,
          attributes: { uploaded: true, sourceFileChecksum: checksum },
        },
      }),
    });
    checksumCommitConfirmed = true;

    // Keep the per-run wait bounded. A later sync resumes this same
    // checksum-committed asset if Apple needs longer than this short window.
    return await pollAscReviewScreenshotDelivery({
      request: args.request,
      resourcePath,
      checksum,
      reused: false,
      checkCancelled,
      sleep,
      maxPollAttempts: args.maxPollAttempts ?? 8,
    });
  } catch (error) {
    const preserveCommittedAsset =
      error instanceof AscReviewScreenshotPendingError ||
      (checksumCommitConfirmed &&
        !(error instanceof AscReviewScreenshotDeliveryFailedError)) ||
      (checksumCommitAttempted &&
        !checksumCommitConfirmed &&
        !(error instanceof AscReviewScreenshotDeliveryFailedError) &&
        statusOf(error) === undefined);
    if (!preserveCommittedAsset) {
      // Pre-commit failures and confirmed FAILED delivery states cannot be
      // resumed. Remove the reservation so the next run can replace it.
      try {
        await args.request(resourcePath, { method: "DELETE" });
      } catch {
        // Preserve the original failure. The next run also removes any stale
        // parent screenshot before reserving a replacement.
      }
    }
    throw error;
  }
}

export type AscReviewVersionInspection = {
  versionId: string;
  state: "editable" | "attached" | "submitted" | "approved";
};

export type AscReviewVersionPlan = {
  action: "create" | "reuse";
  reviewVersion: {
    versionId: string;
    alreadySubmitted: boolean;
    attachedToSubmission: boolean;
  };
};

/** Apply local Draft/Ready semantics to a read-only ASC version snapshot. */
export function planAscReviewVersion(args: {
  localState: "Draft" | "Ready";
  current: AscReviewVersionInspection | null;
}): AscReviewVersionPlan {
  const { current } = args;
  if (
    current === null ||
    (current.state === "approved" && args.localState === "Draft")
  ) {
    return {
      action: "create",
      reviewVersion: {
        versionId: "(would-create)",
        alreadySubmitted: false,
        attachedToSubmission: false,
      },
    };
  }
  return {
    action: "reuse",
    reviewVersion: {
      versionId: current.versionId,
      alreadySubmitted:
        current.state === "submitted" || current.state === "approved",
      attachedToSubmission:
        current.state === "attached" ||
        current.state === "submitted" ||
        current.state === "approved",
    },
  };
}

/** Read the current version disposition without creating or mutating it. */
export async function inspectAscReviewVersion(args: {
  request: AscJsonRequest;
  kind: AscReviewKind;
  parentId: string;
  checkCancelled?: () => Promise<void>;
}): Promise<AscReviewVersionInspection | null> {
  const checkCancelled = args.checkCancelled ?? (async () => undefined);
  await checkCancelled();
  const config = VERSION_CONFIG[args.kind];
  const versions = await args.request<AscVersionsResponse>(
    config.listPath(args.parentId),
  );
  const draft = versions.data.find(
    (version) =>
      version.attributes?.state?.toUpperCase() === "PREPARE_FOR_SUBMISSION",
  );
  if (draft) return { versionId: draft.id, state: "editable" };
  const attached = versions.data.find(
    (version) =>
      version.attributes?.state?.toUpperCase() === "READY_FOR_REVIEW",
  );
  if (attached) return { versionId: attached.id, state: "attached" };
  const submitted = versions.data.find((version) => {
    const state = version.attributes?.state?.toUpperCase();
    return state === "WAITING_FOR_REVIEW" || state === "IN_REVIEW";
  });
  if (submitted) return { versionId: submitted.id, state: "submitted" };
  const approved = versions.data.find((version) =>
    isAscApprovedReviewHistoryState(version.attributes?.state),
  );
  return approved ? { versionId: approved.id, state: "approved" } : null;
}

/**
 * Reads the localized metadata attached to the current ASC review version.
 *
 * Product names on the parent resource are internal reference names, not the
 * customer-facing store listing. Pull-sync must read the version subresource
 * or it will lose every ASC-authored locale and later publish the reference
 * name as en-US.
 */
export async function readAscReviewListings(args: {
  request: AscJsonRequest;
  kind: AscReviewKind;
  parentId: string;
  checkCancelled?: () => Promise<void>;
}): Promise<Array<{ locale: string; title: string; description?: string }>> {
  const checkCancelled = args.checkCancelled ?? (async () => undefined);
  const current = await inspectAscReviewVersion({
    request: args.request,
    kind: args.kind,
    parentId: args.parentId,
    checkCancelled,
  });
  if (!current) return [];

  const resources = await readAllAscLocalizations({
    request: args.request,
    initialPath: VERSION_CONFIG[args.kind].localizationListPath(
      current.versionId,
    ),
    checkCancelled,
  });
  return resources.flatMap((resource) => {
    const locale = resource.attributes?.locale;
    const title = resource.attributes?.name;
    if (!locale || !title) return [];
    const description = resource.attributes?.description;
    return [
      {
        locale,
        title,
        ...(description ? { description } : {}),
      },
    ];
  });
}

export async function ensureAscReviewVersion(args: {
  request: AscJsonRequest;
  kind: AscReviewKind;
  parentId: string;
  allowCreate?: boolean;
  reuseApproved?: boolean;
  checkCancelled?: () => Promise<void>;
}): Promise<{
  versionId: string;
  alreadySubmitted: boolean;
  attachedToSubmission: boolean;
}> {
  const config = VERSION_CONFIG[args.kind];
  const checkCancelled = args.checkCancelled ?? (async () => undefined);
  const current = await inspectAscReviewVersion({
    request: args.request,
    kind: args.kind,
    parentId: args.parentId,
    checkCancelled,
  });
  if (current?.state === "editable") {
    return {
      versionId: current.versionId,
      alreadySubmitted: false,
      attachedToSubmission: false,
    };
  }
  if (current?.state === "attached") {
    return {
      versionId: current.versionId,
      alreadySubmitted: false,
      attachedToSubmission: true,
    };
  }
  if (current?.state === "submitted") {
    return {
      versionId: current.versionId,
      alreadySubmitted: true,
      attachedToSubmission: true,
    };
  }
  if (
    current?.state === "approved" &&
    (args.allowCreate === false || args.reuseApproved === true)
  ) {
    return {
      versionId: current.versionId,
      alreadySubmitted: true,
      attachedToSubmission: true,
    };
  }
  if (args.allowCreate === false) {
    throw new Error(
      "Ready product has no editable, attached, submitted, or approved review version to resume",
    );
  }

  await checkCancelled();
  const created = await args.request<AscVersionResponse>(config.collection, {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: config.type,
        relationships: {
          [config.relationship]: {
            data: { type: config.parentType, id: args.parentId },
          },
        },
      },
    }),
  });
  return {
    versionId: created.data.id,
    alreadySubmitted: false,
    attachedToSubmission: false,
  };
}

export async function upsertAscReviewLocalization(args: {
  request: AscJsonRequest;
  kind: AscReviewKind;
  versionId: string;
  name: string;
  description: string;
  locale?: string;
  checkCancelled?: () => Promise<void>;
}): Promise<void> {
  const config = VERSION_CONFIG[args.kind];
  const locale = args.locale ?? "en-US";
  const checkCancelled = args.checkCancelled ?? (async () => undefined);
  await checkCancelled();
  const localizations = await args.request<AscLocalizationResponse>(
    config.localizationListPath(args.versionId),
  );
  const existing = localizations.data.find(
    (localization) => localization.attributes?.locale === locale,
  );
  const attributes = {
    name: args.name,
    description: args.description,
    ...(existing ? {} : { locale }),
  };
  if (existing) {
    await checkCancelled();
    await args.request(
      `${config.localizationCollection}/${encodeURIComponent(existing.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          data: {
            type: config.localizationType,
            id: existing.id,
            attributes,
          },
        }),
      },
    );
    return;
  }
  await checkCancelled();
  await args.request(config.localizationCollection, {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: config.localizationType,
        attributes,
        relationships: {
          version: {
            data: { type: config.type, id: args.versionId },
          },
        },
      },
    }),
  });
}

/**
 * Whether a locked review version already carries exactly the listings
 * kit would push.
 *
 * Takes the whole set rather than one locale: the push writes every
 * locale on the row, so comparing only the base pair would report
 * "matches" for a Draft whose sole change is a translation — and that
 * Draft would then be marked pushed without the translation shipping.
 * One list fetch serves every comparison.
 *
 * @returns The first locale that differs, or undefined when all match.
 */
export async function ascReviewLocalizationMismatch(args: {
  request: AscJsonRequest;
  kind: AscReviewKind;
  versionId: string;
  listings: Array<{ locale: string; title: string; description?: string }>;
  checkCancelled?: () => Promise<void>;
}): Promise<string | undefined> {
  const config = VERSION_CONFIG[args.kind];
  const checkCancelled = args.checkCancelled ?? (async () => undefined);
  const localizations = await readAllAscLocalizations({
    request: args.request,
    initialPath: config.localizationListPath(args.versionId),
    checkCancelled,
  });
  for (const listing of args.listings) {
    const existing = localizations.find(
      (localization) => localization.attributes?.locale === listing.locale,
    );
    if (
      existing?.attributes?.name !== listing.title ||
      existing.attributes.description !== (listing.description ?? listing.title)
    ) {
      return listing.locale;
    }
  }
  return undefined;
}

export async function submitAscReviewVersions(args: {
  request: AscJsonRequest;
  cleanupRequest?: AscJsonRequest;
  appId: string;
  items: AscReviewVersionItem[];
  checkCancelled?: () => Promise<void>;
  isAbortError?: (error: unknown) => boolean;
}): Promise<AscReviewSubmissionResult> {
  if (args.items.length === 0) return { outcomes: [] };
  if (args.items.length > ASC_REVIEW_SUBMISSION_ITEM_LIMIT) {
    return {
      outcomes: [],
      globalFailure:
        `ASC review submissions accept at most ${ASC_REVIEW_SUBMISSION_ITEM_LIMIT} items; ` +
        `received ${args.items.length}`,
    };
  }
  const checkCancelled = args.checkCancelled ?? (async () => undefined);
  const isAbortError = args.isAbortError ?? (() => false);
  const cleanupRequest = args.cleanupRequest ?? args.request;
  await checkCancelled();

  const outcomeForError = (
    item: AscReviewVersionItem,
    error: unknown,
  ): AscReviewSubmissionOutcome => {
    const action = classifyAscManualReviewAction(error, item.productId);
    return action
      ? { item, status: "manual", action }
      : { item, status: "failed", reason: messageOf(error) };
  };
  const unknownStatusOutcome = (
    item: AscReviewVersionItem,
    error: unknown,
  ): AscReviewSubmissionOutcome => ({
    item,
    status: "manual",
    action: {
      productId: item.productId,
      code: "review_submission_status_unknown",
      message:
        `${messageOf(error)} App Store Connect may have accepted the write ` +
        "even though IAPKit did not receive its resource ID. Check App Store " +
        "Connect and complete or discard that draft before running Push Sync again.",
    },
  });
  const cancelSubmission = async (submissionId: string): Promise<void> => {
    try {
      await cleanupRequest(
        `/v1/reviewSubmissions/${encodeURIComponent(submissionId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            data: {
              type: "reviewSubmissions",
              id: submissionId,
              attributes: { canceled: true },
            },
          }),
        },
      );
    } catch {
      // Best effort. A later retry never adopts an unidentified ASC draft.
    }
  };

  let submissionId: string;
  try {
    const created = await args.request<AscReviewSubmissionResponse>(
      "/v1/reviewSubmissions",
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "reviewSubmissions",
            attributes: { platform: "IOS" },
            relationships: {
              app: { data: { type: "apps", id: args.appId } },
            },
          },
        }),
      },
    );
    submissionId = created.data.id;
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (statusOf(error) === undefined) {
      // Apple has no idempotency key/client reference on this endpoint. A
      // statusless transport failure can mean the draft was created but the
      // response was lost; an empty remote draft is indistinguishable from a
      // human-created one, so fail safely and ask the operator to inspect it.
      return {
        outcomes: args.items.map((item) => unknownStatusOutcome(item, error)),
      };
    }
    const action = classifyAscManualReviewAction(
      error,
      args.items[0].productId,
    );
    if (action?.code === "review_submission_conflict") {
      // A 409 does not prove the active draft belongs to IAPKit. Never add
      // items to or submit a user-created App Store Connect draft; keep every
      // product in Draft and ask the operator to finish/discard it first.
      return {
        outcomes: args.items.map((item) => outcomeForError(item, error)),
      };
    }
    if (args.items.length === 1) {
      return { outcomes: [outcomeForError(args.items[0], error)] };
    }
    return { outcomes: [], globalFailure: messageOf(error) };
  }

  const outcomes: AscReviewSubmissionOutcome[] = [];
  const added: Array<{
    item: AscReviewVersionItem;
    submissionItemId?: string;
  }> = [];
  let activeEntries = added;
  const cleanupDraft = async (): Promise<void> => {
    // Canceling the owned draft is O(1), regardless of how many items were
    // added. Sequential per-item cleanup can itself overrun the job deadline.
    await cancelSubmission(submissionId);
  };
  const removeEntry = async (
    entry: (typeof added)[number],
  ): Promise<boolean> => {
    if (!entry.submissionItemId) return false;
    try {
      await cleanupRequest(
        `/v1/reviewSubmissionItems/${encodeURIComponent(entry.submissionItemId)}`,
        { method: "DELETE" },
      );
      return true;
    } catch {
      return false;
    }
  };
  const checkCancelledAndCleanup = async (): Promise<void> => {
    try {
      await checkCancelled();
    } catch (error) {
      await cleanupDraft();
      throw error;
    }
  };
  for (const item of args.items) {
    await checkCancelledAndCleanup();
    const config = VERSION_CONFIG[item.kind];
    try {
      const created = await args.request<{ data: { id: string } }>(
        "/v1/reviewSubmissionItems",
        {
          method: "POST",
          body: JSON.stringify({
            data: {
              type: "reviewSubmissionItems",
              relationships: {
                reviewSubmission: {
                  data: { type: "reviewSubmissions", id: submissionId },
                },
                [config.itemRelationship]: {
                  data: { type: config.type, id: item.versionId },
                },
              },
            },
          }),
        },
      );
      added.push({ item, submissionItemId: created.data.id });
    } catch (error) {
      if (isAbortError(error)) {
        await cleanupDraft();
        throw error;
      }
      if (statusOf(error) === undefined) {
        // The item may exist remotely even though its ID was lost. Cancel the
        // IAPKit-owned submission and stop; submitting the remaining tracked
        // items could create a remote/local state mismatch.
        await cleanupDraft();
        return {
          outcomes: args.items.map((candidate) =>
            unknownStatusOutcome(candidate, error),
          ),
        };
      }
      outcomes.push(outcomeForError(item, error));
    }
  }

  if (added.length === 0) {
    await cleanupDraft();
    return { outcomes };
  }

  const submitDraft = () =>
    args.request(`/v1/reviewSubmissions/${encodeURIComponent(submissionId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        data: {
          type: "reviewSubmissions",
          id: submissionId,
          attributes: { submitted: true },
        },
      }),
    });
  for (let attempt = 0; attempt <= added.length; attempt += 1) {
    await checkCancelledAndCleanup();
    try {
      await submitDraft();
      outcomes.push(
        ...activeEntries.map(
          ({ item }): AscReviewSubmissionOutcome => ({
            item,
            status: "submitted",
          }),
        ),
      );
      return { outcomes };
    } catch (error) {
      if (isAbortError(error)) {
        await cleanupDraft();
        throw error;
      }
      const manualEntries = activeEntries.filter(({ item }) =>
        matchesManualConstraintProduct(error, item),
      );
      if (manualEntries.length === 1) {
        if (!(await removeEntry(manualEntries[0]))) {
          await cleanupDraft();
          return {
            outcomes,
            globalFailure:
              "ASC could not confirm removal of the manually gated item; " +
              "the IAPKit-owned review draft was canceled instead",
          };
        }
        outcomes.push(
          ...manualEntries.map(
            ({ item }): AscReviewSubmissionOutcome => ({
              item,
              status: "manual",
              action: classifyAscManualReviewAction(error, item.productId)!,
            }),
          ),
        );
        activeEntries = activeEntries.filter(
          (entry) => !manualEntries.includes(entry),
        );
        if (activeEntries.length === 0) {
          await cancelSubmission(submissionId);
          return { outcomes };
        }
        continue;
      }
      if (manualEntries.length > 1) {
        // Apple's generic wording does not identify a product/group. Never
        // mark every subscription of the same broad type Ready: that could
        // silently misclassify unrelated groups in the same batch.
        await cleanupDraft();
        return {
          outcomes,
          globalFailure: `ASC review constraint could not be attributed to one product: ${messageOf(error)}`,
        };
      }

      // An unattributable final error must not be copied onto every product.
      // Keep the rows Draft and surface one batch-level failure instead.
      if (activeEntries.length === 1) {
        outcomes.push(outcomeForError(activeEntries[0].item, error));
      }
      await cleanupDraft();
      return {
        outcomes,
        ...(activeEntries.length > 1
          ? { globalFailure: messageOf(error) }
          : {}),
      };
    }
  }

  await cleanupDraft();
  return {
    outcomes,
    globalFailure: "ASC review submission exceeded the manual-gate retry bound",
  };
}
