"use node";
import { v } from "convex/values";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { getProjectByApiKey } from "../purchases/shared";
import { mintAscJwt } from "./jwt";

// App Store Connect REST client + push-sync action.
//
// Auth: every request carries a freshly-minted ES256 JWT signed with
// the project's `.p8` key (already stored for App Store Server API
// reuse). Token TTL is 600s with a 60s safety margin before expiry.
//
// Surface area implemented (matches what `@onesub/providers` exposes):
//   - listInAppPurchases(appId)  → GET /v1/apps/{id}/inAppPurchasesV2
//   - createInAppPurchase(args)  → POST /v1/inAppPurchases
//   - patchInAppPurchase(id,...) → PATCH /v1/inAppPurchases/{id}
//   - listSubscriptionGroups(appId) → GET /v1/apps/{id}/subscriptionGroups
//   - listSubscriptions(groupId) → GET /v1/subscriptionGroups/{id}/subscriptions
//   - createSubscription(...)    → POST /v1/subscriptions
//   - patchSubscription(...)     → PATCH /v1/subscriptions/{id}
// The `pushSyncProducts` action drives kit→ASC sync for a project.
//
// Failure model: ASC returns an `errors[]` array per the JSON:API
// spec; we throw the response status + the first error's `detail` so
// the dashboard / MCP / SDK surfaces a useful message instead of
// "fetch failed".

const ASC_BASE = "https://api.appstoreconnect.apple.com";

type AscToken = { value: string; expiresAt: number };

class AscClient {
  private cached: AscToken | null = null;

  constructor(
    private readonly issuerId: string,
    private readonly keyId: string,
    private readonly privateKey: string,
  ) {}

  private async token(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cached && this.cached.expiresAt - now > 60) {
      return this.cached.value;
    }
    const value = mintAscJwt({
      issuerId: this.issuerId,
      keyId: this.keyId,
      privateKey: this.privateKey,
      ttlSeconds: 600,
    });
    this.cached = { value, expiresAt: now + 600 };
    return value;
  }

  private async call<T>(
    path: string,
    init: RequestInit & { body?: string } = {},
  ): Promise<T> {
    const response = await fetch(`${ASC_BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await this.token()}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        accept: "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    const text = await response.text();
    let parsed: unknown = text;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // leave as text
      }
    }
    if (!response.ok) {
      const errorMessage = extractAscError(parsed);
      throw new Error(
        `ASC ${path} returned ${response.status}: ${errorMessage}`,
      );
    }
    return parsed as T;
  }

  listInAppPurchases(appId: string) {
    return this.call<AscIapListResponse>(
      `/v1/apps/${encodeURIComponent(appId)}/inAppPurchasesV2?limit=200`,
    );
  }

  listSubscriptionGroups(appId: string) {
    return this.call<AscSubGroupListResponse>(
      `/v1/apps/${encodeURIComponent(appId)}/subscriptionGroups?limit=200`,
    );
  }

  listSubscriptionsInGroup(groupId: string) {
    return this.call<AscSubListResponse>(
      `/v1/subscriptionGroups/${encodeURIComponent(groupId)}/subscriptions?limit=200`,
    );
  }

  createInAppPurchase(args: {
    appId: string;
    productId: string;
    name: string;
    type: "CONSUMABLE" | "NON_CONSUMABLE" | "NON_RENEWING_SUBSCRIPTION";
    reviewNote?: string;
  }) {
    return this.call<AscIapResource>(`/v1/inAppPurchases`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "inAppPurchases",
          attributes: {
            name: args.name,
            productId: args.productId,
            inAppPurchaseType: args.type,
            reviewNote: args.reviewNote,
          },
          relationships: {
            app: { data: { type: "apps", id: args.appId } },
          },
        },
      }),
    });
  }

  patchInAppPurchase(
    id: string,
    attributes: { name?: string; reviewNote?: string },
  ) {
    return this.call<AscIapResource>(
      `/v1/inAppPurchases/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          data: { type: "inAppPurchases", id, attributes },
        }),
      },
    );
  }

  createSubscription(args: {
    groupId: string;
    productId: string;
    name: string;
    subscriptionPeriod:
      | "ONE_WEEK"
      | "ONE_MONTH"
      | "TWO_MONTHS"
      | "THREE_MONTHS"
      | "SIX_MONTHS"
      | "ONE_YEAR";
    reviewNote?: string;
  }) {
    return this.call<AscSubResource>(`/v1/subscriptions`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "subscriptions",
          attributes: {
            name: args.name,
            productId: args.productId,
            subscriptionPeriod: args.subscriptionPeriod,
            reviewNote: args.reviewNote,
          },
          relationships: {
            group: {
              data: { type: "subscriptionGroups", id: args.groupId },
            },
          },
        },
      }),
    });
  }

  patchSubscription(
    id: string,
    attributes: { name?: string; reviewNote?: string },
  ) {
    return this.call<AscSubResource>(
      `/v1/subscriptions/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          data: { type: "subscriptions", id, attributes },
        }),
      },
    );
  }
}

type AscIapResource = {
  data: {
    id: string;
    type: "inAppPurchases";
    attributes: {
      productId?: string;
      name?: string;
      inAppPurchaseType?: string;
      state?: string;
      reviewNote?: string;
    };
  };
};

type AscIapListResponse = {
  data: AscIapResource["data"][];
};

type AscSubResource = {
  data: {
    id: string;
    type: "subscriptions";
    attributes: {
      productId?: string;
      name?: string;
      subscriptionPeriod?: string;
      state?: string;
      reviewNote?: string;
    };
  };
};

type AscSubListResponse = {
  data: AscSubResource["data"][];
};

type AscSubGroupListResponse = {
  data: Array<{
    id: string;
    type: "subscriptionGroups";
    attributes: { referenceName?: string };
  }>;
};

function extractAscError(parsed: unknown): string {
  if (
    parsed &&
    typeof parsed === "object" &&
    "errors" in parsed &&
    Array.isArray((parsed as { errors: unknown[] }).errors)
  ) {
    const errors = (
      parsed as { errors: Array<{ detail?: string; title?: string }> }
    ).errors;
    return (
      errors.map((e) => e.detail ?? e.title ?? "").join("; ") || "(no detail)"
    );
  }
  return typeof parsed === "string" ? parsed : "(non-JSON error)";
}

// ---------------------------------------------------------------------------
// Push-sync action: pulls the project's catalog from ASC, upserts kit's
// `products` rows from it, and pushes any kit-side products with state
// = "Draft" / "Ready" upstream.
// ---------------------------------------------------------------------------

export const pushSyncProductsApple = action({
  args: {
    apiKey: v.string(),
    direction: v.optional(
      v.union(v.literal("pull"), v.literal("push"), v.literal("both")),
    ),
  },
  returns: v.object({
    pulled: v.number(),
    pushed: v.number(),
    failures: v.array(v.object({ productId: v.string(), reason: v.string() })),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    pulled: number;
    pushed: number;
    failures: Array<{ productId: string; reason: string }>;
  }> => {
    const project = await getProjectByApiKey(ctx, args.apiKey);
    if (!project.iosBundleId) {
      throw new Error("Project iosBundleId is not configured");
    }
    if (!project.iosAppAppleId) {
      throw new Error("Project iosAppAppleId is required for ASC push-sync");
    }
    if (!project.iosAppStoreIssuerId || !project.iosAppStoreKeyId) {
      throw new Error("ASC issuerId / keyId not configured for this project");
    }

    const keyResponse = await ctx.runAction(
      internal.files.internal.getAppleP8Key,
      {
        organizationId: project.organizationId,
        projectId: project._id,
      },
    );
    if (!keyResponse?.keyContent) {
      throw new Error(
        "Apple .p8 key file not found — upload it before running push-sync",
      );
    }

    const client = new AscClient(
      project.iosAppStoreIssuerId,
      project.iosAppStoreKeyId,
      keyResponse.keyContent,
    );

    const direction = args.direction ?? "both";
    const failures: Array<{ productId: string; reason: string }> = [];
    let pulled = 0;
    let pushed = 0;

    const appIdStr = String(project.iosAppAppleId);

    // ── PULL: ASC → kit catalog ────────────────────────────────────
    if (direction === "pull" || direction === "both") {
      const iaps = await client.listInAppPurchases(appIdStr).catch((error) => {
        failures.push({
          productId: "(asc list iaps)",
          reason: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
      if (iaps) {
        for (const item of iaps.data) {
          const productId = item.attributes.productId;
          if (!productId) continue;
          const type = mapAscIapType(item.attributes.inAppPurchaseType);
          await ctx.runMutation(internal.products.sync.upsertFromStore, {
            projectId: project._id,
            productId,
            platform: "IOS",
            type,
            title: item.attributes.name ?? productId,
            storeRef: item.id,
            state: mapAscState(item.attributes.state),
          });
          pulled += 1;
        }
      }

      const groups = await client
        .listSubscriptionGroups(appIdStr)
        .catch((error) => {
          failures.push({
            productId: "(asc list groups)",
            reason: error instanceof Error ? error.message : String(error),
          });
          return null;
        });
      if (groups) {
        for (const group of groups.data) {
          const subs = await client
            .listSubscriptionsInGroup(group.id)
            .catch((error) => {
              failures.push({
                productId: `(asc list subs in group ${group.id})`,
                reason: error instanceof Error ? error.message : String(error),
              });
              return null;
            });
          if (!subs) continue;
          for (const sub of subs.data) {
            const productId = sub.attributes.productId;
            if (!productId) continue;
            await ctx.runMutation(internal.products.sync.upsertFromStore, {
              projectId: project._id,
              productId,
              platform: "IOS",
              type: "Subscription",
              title: sub.attributes.name ?? productId,
              storeRef: sub.id,
              state: mapAscState(sub.attributes.state),
            });
            pulled += 1;
          }
        }
      }
    }

    // ── PUSH: kit → ASC for Draft rows ─────────────────────────────
    if (direction === "push" || direction === "both") {
      const drafts = await ctx.runQuery(
        internal.products.sync.listDraftIosProducts,
        { projectId: project._id },
      );
      for (const row of drafts) {
        try {
          if (row.type === "Subscription") {
            // Subscriptions need a group; the v0 push assumes the
            // dashboard / MCP creates one via ASC web UI first and
            // populates `storeRef` on the row with the group id.
            if (!row.storeRef) {
              failures.push({
                productId: row.productId,
                reason:
                  "Set storeRef to the ASC subscriptionGroup id before pushing a subscription",
              });
              continue;
            }
            const result = await client.createSubscription({
              groupId: row.storeRef,
              productId: row.productId,
              name: row.title,
              // Translate the ISO-8601 `billingPeriod` from the catalog
              // row to ASC's enum. Default to `ONE_MONTH` only when
              // the operator hasn't picked one — the prior hardcode
              // silently created weekly / yearly subscriptions as
              // monthly with no error.
              subscriptionPeriod: mapBillingPeriodToAsc(row.billingPeriod),
            });
            await ctx.runMutation(internal.products.sync.markPushed, {
              projectId: project._id,
              productId: row.productId,
              platform: "IOS",
              storeRef: result.data.id,
            });
            pushed += 1;
          } else {
            const result = await client.createInAppPurchase({
              appId: appIdStr,
              productId: row.productId,
              name: row.title,
              type: row.type === "Consumable" ? "CONSUMABLE" : "NON_CONSUMABLE",
            });
            await ctx.runMutation(internal.products.sync.markPushed, {
              projectId: project._id,
              productId: row.productId,
              platform: "IOS",
              storeRef: result.data.id,
            });
            pushed += 1;
          }
        } catch (error) {
          failures.push({
            productId: row.productId,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return { pulled, pushed, failures };
  },
});

function mapBillingPeriodToAsc(
  period: string | undefined,
):
  | "ONE_WEEK"
  | "ONE_MONTH"
  | "TWO_MONTHS"
  | "THREE_MONTHS"
  | "SIX_MONTHS"
  | "ONE_YEAR" {
  switch (period) {
    case "P1W":
      return "ONE_WEEK";
    case "P2M":
      return "TWO_MONTHS";
    case "P3M":
      return "THREE_MONTHS";
    case "P6M":
      return "SIX_MONTHS";
    case "P1Y":
      return "ONE_YEAR";
    case "P1M":
    case undefined:
    default:
      return "ONE_MONTH";
  }
}

function mapAscIapType(
  raw: string | undefined,
): "Subscription" | "NonConsumable" | "Consumable" {
  switch (raw) {
    case "CONSUMABLE":
      return "Consumable";
    case "NON_RENEWING_SUBSCRIPTION":
    case "NON_CONSUMABLE":
      return "NonConsumable";
    default:
      return "NonConsumable";
  }
}

function mapAscState(
  raw: string | undefined,
): "Draft" | "Ready" | "Active" | "Removed" {
  switch (raw) {
    case "WAITING_FOR_REVIEW":
    case "PENDING_DEVELOPER_RELEASE":
    case "READY_TO_SUBMIT":
      return "Ready";
    case "APPROVED":
    case "REPLACED":
      return "Active";
    case "DEVELOPER_REMOVED_FROM_SALE":
    case "REMOVED_FROM_SALE":
      return "Removed";
    default:
      return "Draft";
  }
}
