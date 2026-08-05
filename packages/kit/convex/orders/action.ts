"use node";
import {
  AppStoreServerAPIClient,
  Environment,
  APIException,
  OrderLookupStatus,
} from "@apple/app-store-server-library";
import { google } from "googleapis";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { action, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  getAppStoreServerCredentials,
  verifyJWSTransaction,
} from "../purchases/ios";
import { AppStoreProductType } from "../purchases/shared";
import { parseAndValidateServiceAccountKey } from "../purchases/android";
import { extractHttpStatus, retryOnTransient } from "../purchases/retry";
import type { AppStoreReceiptData } from "../purchases/shared";
import {
  isValidAppleOrderId,
  orderLookupResponseValidator,
  orderLookupStoreValidator,
  selectAppleSubscriptionItem,
  summarizeAppleTransactions,
  summarizeGoogleOrder,
  summarizeGoogleSubscription,
  type OrderLookupResponse,
  type OrderSubscriptionStatus,
} from "./shared";

// Read-only order lookup for the dashboard (discussion #284).
//
// Auth: dashboard session + organization membership — this is support
// tooling for project operators, not part of the public /api/v1
// surface, so it never accepts an apiKey.
//
// Privacy: nothing is persisted. The action proxies the store API with
// the project's already-configured credentials and returns the result.

export const lookupOrder = action({
  args: {
    projectId: v.id("projects"),
    store: orderLookupStoreValidator,
    orderId: v.string(),
  },
  returns: orderLookupResponseValidator,
  handler: async (ctx, args): Promise<OrderLookupResponse> => {
    const project = await getProjectForMember(ctx, args.projectId);
    const orderId = args.orderId.trim();
    if (!orderId) {
      throw new ConvexError("Order ID is required");
    }

    if (args.store === "apple") {
      return await lookupAppleOrder(ctx, project, orderId);
    }
    return await lookupGoogleOrder(ctx, project, orderId);
  },
});

async function getProjectForMember(
  ctx: ActionCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const userId: Id<"users"> | null = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Not authenticated");
  }

  const project: Doc<"projects"> | null = await ctx.runQuery(
    internal.projects.internal.getProjectById,
    { projectId },
  );
  if (!project) {
    throw new ConvexError("Project not found");
  }

  const membership = await ctx.runQuery(
    internal.organizations.internal.getMembership,
    { userId, organizationId: project.organizationId },
  );
  if (!membership) {
    throw new ConvexError("Not a member of this organization");
  }

  return project;
}

async function lookupAppleOrder(
  ctx: ActionCtx,
  project: Doc<"projects">,
  orderId: string,
): Promise<OrderLookupResponse> {
  if (!project.iosBundleId) {
    throw new ConvexError(
      "Apple order lookup requires the project's App Store bundle ID (Settings → iOS).",
    );
  }

  // Order lookup always runs against production (order IDs do not exist
  // in sandbox), and SignedDataVerifier refuses to construct for
  // production without the app's Apple ID. Fail with an actionable
  // message here instead of deep inside JWS verification.
  if (project.iosAppAppleId === undefined) {
    throw new ConvexError(
      "Apple order lookup verifies against production, which requires the project's App Apple ID (Settings → iOS).",
    );
  }

  if (!isValidAppleOrderId(orderId)) {
    throw new ConvexError(
      "Apple order IDs are alphanumeric. Check the order number from the customer's App Store receipt.",
    );
  }

  const credentials = await getAppStoreServerCredentials(ctx, project);

  // Order IDs only exist for real App Store orders; the lookup endpoint
  // has no sandbox counterpart, so the client always targets production.
  const client = new AppStoreServerAPIClient(
    credentials.privateKey,
    credentials.keyId,
    credentials.issuerId,
    project.iosBundleId,
    Environment.PRODUCTION,
  );

  let response;
  try {
    response = await retryOnTransient(() => client.lookUpOrderId(orderId));
  } catch (error) {
    if (error instanceof APIException && error.httpStatusCode === 404) {
      return { store: "apple", found: false, orderId, raw: "{}" };
    }
    throw new ConvexError(formatAppleApiError(error));
  }

  if (
    response.status !== OrderLookupStatus.VALID ||
    !response.signedTransactions?.length
  ) {
    return {
      store: "apple",
      found: false,
      orderId,
      raw: JSON.stringify({ status: response.status }),
    };
  }

  const transactions: AppStoreReceiptData[] = [];
  for (const signed of response.signedTransactions) {
    transactions.push(
      await verifyJWSTransaction(
        signed,
        project.iosBundleId,
        Environment.PRODUCTION,
        project.iosAppAppleId,
      ),
    );
  }

  const result: OrderLookupResponse = {
    store: "apple",
    found: true,
    orderId,
    transactions,
    raw: JSON.stringify({
      status: response.status,
      transactions,
    }),
  };

  const summary = summarizeAppleTransactions(transactions);
  if (summary) {
    result.summary = summary;
  }

  // Only auto-renewable orders have a subscription status. Every Apple
  // transaction carries an originalTransactionId (it equals
  // transactionId for one-time purchases), so gating on that alone
  // would fire this request — and surface a failure notice — for
  // consumable orders too. This mirrors the Google path, which gates on
  // the line item actually being a subscription.
  const subscriptionTransactionIds = transactions
    .filter(
      (transaction) =>
        transaction.type === AppStoreProductType.AUTO_RENEWABLE_SUBSCRIPTION,
    )
    .map((transaction) => transaction.originalTransactionId)
    .filter((id): id is string => Boolean(id));

  if (subscriptionTransactionIds.length > 0) {
    result.subscription = await fetchAppleSubscriptionStatus(
      client,
      subscriptionTransactionIds,
    );
  }

  return result;
}

// Optional secondary fetch — failure must not invalidate the lookup.
async function fetchAppleSubscriptionStatus(
  client: AppStoreServerAPIClient,
  orderTransactionIds: string[],
): Promise<OrderSubscriptionStatus> {
  try {
    const statuses = await retryOnTransient(() =>
      client.getAllSubscriptionStatuses(orderTransactionIds[0]),
    );

    const lastTransaction = selectAppleSubscriptionItem(
      statuses.data,
      orderTransactionIds,
    );
    if (!lastTransaction) {
      return { error: "No subscription status available for this order" };
    }

    const result: OrderSubscriptionStatus = {
      state: describeAppleSubscriptionStatus(lastTransaction.status),
      raw: JSON.stringify(statuses),
    };

    if (lastTransaction.signedRenewalInfo) {
      const renewal = decodeJwsPayloadLoose(lastTransaction.signedRenewalInfo);
      if (renewal) {
        if (typeof renewal.autoRenewStatus === "number") {
          result.autoRenewing = renewal.autoRenewStatus === 1;
        }
        if (typeof renewal.autoRenewProductId === "string") {
          result.renewalProductId = renewal.autoRenewProductId;
        }
        if (typeof renewal.gracePeriodExpiresDate === "number") {
          result.gracePeriodExpiresDate = renewal.gracePeriodExpiresDate;
        }
      }
    }

    if (lastTransaction.signedTransactionInfo) {
      const transaction = decodeJwsPayloadLoose(
        lastTransaction.signedTransactionInfo,
      );
      if (transaction && typeof transaction.expiresDate === "number") {
        result.expiresDate = transaction.expiresDate;
      }
    }

    return result;
  } catch (error) {
    // APIException carries its detail on errorMessage/httpStatusCode —
    // its `message` is always empty — so read it through the same
    // formatter the main lookup uses, and never surface a blank notice.
    return {
      error: formatAppleApiError(error) || "Subscription status request failed",
    };
  }
}

function describeAppleSubscriptionStatus(status: number | undefined): string {
  switch (status) {
    case 1:
      return "Active";
    case 2:
      return "Expired";
    case 3:
      return "Billing retry";
    case 4:
      return "Billing grace period";
    case 5:
      return "Revoked";
    default:
      return `Unknown (${String(status)})`;
  }
}

// The renewal/transaction payloads inside a status response come from
// Apple over TLS; decoding without signature re-verification is
// acceptable for read-only display, mirroring how the App Store Server
// library models these fields.
function decodeJwsPayloadLoose(jws: string): Record<string, unknown> | null {
  const parts = jws.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8"),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatAppleApiError(error: unknown): string {
  if (error instanceof APIException) {
    const status = error.httpStatusCode;
    const hints: Record<number, string> = {
      401: "Unauthorized. Verify the Issuer ID, Key ID, and .p8 key in project settings.",
      403: "Forbidden. Confirm the App Store Server API key has access to this bundle.",
    };
    const hint = status ? hints[status] : undefined;
    // `??` would stop at APIException's empty `message`, leaving the
    // dashboard with "Apple order lookup failed:" and nothing after it.
    const reason =
      error.errorMessage || error.message || `HTTP ${String(status)}`;
    return `Apple order lookup failed: ${reason}${hint ? ` – ${hint}` : ""}`;
  }
  return error instanceof Error ? error.message : String(error);
}

async function lookupGoogleOrder(
  ctx: ActionCtx,
  project: Doc<"projects">,
  orderId: string,
): Promise<OrderLookupResponse> {
  const packageName = project.androidPackageName;
  if (!packageName) {
    throw new ConvexError(
      "Google order lookup requires the project's Android package name (Settings → Android).",
    );
  }

  const serviceAccountFile = await ctx.runQuery(
    internal.files.internal.getGooglePlayFileByProjectInternal,
    { projectId: project._id },
  );
  if (!serviceAccountFile) {
    throw new ConvexError(
      "Google order lookup requires the project's Play service-account key (Settings → Android).",
    );
  }

  const fileContent = await ctx.runAction(
    internal.files.internal.readFileAsText,
    {
      fileId: serviceAccountFile._id,
    },
  );
  if (!fileContent?.content) {
    throw new ConvexError("Unable to read the stored Play service-account key");
  }

  const keyData = parseAndValidateServiceAccountKey(fileContent.content);
  const auth = new google.auth.GoogleAuth({
    credentials: keyData,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const androidpublisher = google.androidpublisher({ version: "v3", auth });

  let order;
  try {
    const response = await retryOnTransient(() =>
      androidpublisher.orders.get({ packageName, orderId }),
    );
    order = response.data;
  } catch (error) {
    if (isGoogleNotFound(error)) {
      return { store: "google", found: false, orderId, raw: "{}" };
    }
    throw new ConvexError(formatGoogleApiError(error));
  }

  if (!order) {
    return { store: "google", found: false, orderId, raw: "{}" };
  }

  const result: OrderLookupResponse = {
    store: "google",
    found: true,
    orderId,
    summary: summarizeGoogleOrder(order),
    raw: JSON.stringify(order),
  };

  if (order.purchaseToken) {
    result.purchaseToken = order.purchaseToken;
    if (order.lineItems?.some((item) => item.subscriptionDetails)) {
      result.subscription = await fetchGoogleSubscriptionStatus(
        androidpublisher,
        packageName,
        order.purchaseToken,
      );
    }
  }

  return result;
}

// Optional secondary fetch — failure must not invalidate the lookup.
async function fetchGoogleSubscriptionStatus(
  androidpublisher: ReturnType<typeof google.androidpublisher>,
  packageName: string,
  purchaseToken: string,
): Promise<OrderSubscriptionStatus> {
  try {
    const response = await retryOnTransient(() =>
      androidpublisher.purchases.subscriptionsv2.get({
        packageName,
        token: purchaseToken,
      }),
    );
    if (!response.data) {
      return { error: "No subscription status available for this token" };
    }
    const summary = summarizeGoogleSubscription(response.data);
    // A response with no state and no line items would render an empty
    // card; report it as unavailable instead.
    if (
      summary.state === undefined &&
      summary.autoRenewing === undefined &&
      summary.expiresDate === undefined &&
      summary.renewalProductId === undefined
    ) {
      return {
        error: "No subscription status available for this token",
        ...(summary.raw !== undefined ? { raw: summary.raw } : {}),
      };
    }
    return summary;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isGoogleNotFound(error: unknown): boolean {
  // extractHttpStatus already normalizes every shape the Google client
  // reports a status in (gaxios `.code`, `.status`, `.response.status`).
  return extractHttpStatus(error) === 404;
}

function formatGoogleApiError(error: unknown): string {
  const status = extractHttpStatus(error);
  const hints: Record<number, string> = {
    401: "Unauthorized. Verify the service-account key in project settings.",
    403: "Forbidden. Grant the service account 'View financial data' access in Play Console (required for order lookups).",
  };
  const hint = status ? hints[status] : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return `Google order lookup failed: ${message}${hint ? ` – ${hint}` : ""}`;
}
