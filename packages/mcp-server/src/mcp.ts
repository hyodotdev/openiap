import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  ServerNotification,
  ServerRequest,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { kitClient, KitHttpError, normalizeKitBaseUrl } from "./kit-client.js";

// MCP server for IAPKit. Every tool funnels through `withClient`
// so Authorization bearer / IAPKIT_API_KEY config is consistent and errors
// surface in a uniform `{ ok: false, error }` shape that LLMs handle predictably.

export const IAPKIT_MCP_SERVER_NAME = "iapkit-mcp";
export const IAPKIT_MCP_SERVER_VERSION = "0.1.0";
const IAPKIT_TOOL_PREFIX = "iapkit";

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

const OPTIONAL_BASE_URL = z
  .string()
  .url()
  .optional()
  .describe(
    "Override IAPKit base URL. Defaults to IAPKIT_BASE_URL, then https://kit.openiap.dev.",
  );

const API_KEY_PLACEHOLDER = "<IAPKIT_API_KEY>";
const MAX_API_KEY_LENGTH = 128;
const MAX_KIT_ID_LENGTH = 256;
const MAX_PRICE_AMOUNT_MICROS = Number.MAX_SAFE_INTEGER;
const READ_ONLY_TOOL: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
};
const WRITE_TOOL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

function kitTextParam(name: string, maxLength?: number) {
  const schema =
    maxLength === undefined ? z.string() : z.string().max(maxLength);
  return schema.refine((value) => value.trim().length > 0, {
    message: `${name} must not be blank`,
  });
}

const PRODUCT_ID_PARAM = kitTextParam("productId", MAX_KIT_ID_LENGTH);
const USER_ID_PARAM = kitTextParam("userId", MAX_KIT_ID_LENGTH);
const TITLE_PARAM = kitTextParam("title");
const ISO_DAY_PARAM = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const PRICE_AMOUNT_MICROS_PARAM = z
  .number()
  .int()
  .nonnegative()
  .max(MAX_PRICE_AMOUNT_MICROS);
const API_KEY_PARAM = z
  .string()
  .max(MAX_API_KEY_LENGTH)
  .refine((value) => value.trim().length > 0, {
    message: "apiKey must not be blank",
  })
  .refine((value) => !/\s/.test(value), {
    message: "apiKey must not contain whitespace",
  });

const OPTIONAL_API_KEY = API_KEY_PARAM.optional().describe(
  "IAPKit project API key. Defaults to the MCP Authorization bearer token, then IAPKIT_API_KEY.",
);

function validateApiKey(apiKey: string): string | null {
  if (!apiKey.trim()) return "apiKey must not be blank";
  if (/\s/.test(apiKey)) return "apiKey must not contain whitespace";
  if (apiKey.length > MAX_API_KEY_LENGTH) {
    return `apiKey must be at most ${MAX_API_KEY_LENGTH} characters`;
  }
  return null;
}

function resolveApiKey(
  opts: { apiKey?: string; baseUrl?: string },
  extra?: ToolExtra,
): string | undefined {
  return (
    opts.apiKey ??
    extra?.authInfo?.token ??
    process.env.IAPKIT_API_KEY
  );
}

function withClient(
  opts: { apiKey?: string; baseUrl?: string },
  extra?: ToolExtra,
) {
  const apiKey = resolveApiKey(opts, extra);
  if (!apiKey) {
    throw new Error(
      "No IAPKit API key was provided. Set Authorization: Bearer <IAPKit project key>, IAPKIT_API_KEY, or the tool's apiKey argument.",
    );
  }
  const validationError = validateApiKey(apiKey);
  if (validationError) {
    throw new Error(validationError);
  }
  return kitClient({
    apiKey,
    baseUrl:
      opts.baseUrl ?? process.env.IAPKIT_BASE_URL,
  });
}

function ok(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function err(error: unknown, apiKey?: string) {
  const detail =
    error instanceof KitHttpError
      ? {
          status: error.status,
          body: redactSecrets(error.body, apiKey),
          message: redactSecrets(error.message, apiKey),
        }
      : {
          message: redactSecrets(
            error instanceof Error ? error.message : String(error),
            apiKey,
          ),
        };
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ ok: false, error: detail }, null, 2),
      },
    ],
  };
}

function redactSecrets(value: unknown, apiKey?: string): unknown {
  if (typeof value === "string") {
    return redactSecretString(value, apiKey);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, apiKey));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactSecrets(item, apiKey),
      ]),
    );
  }
  return value;
}

function redactSecretString(value: string, apiKey?: string): string {
  const knownSecrets = [
    apiKey,
    process.env.IAPKIT_API_KEY,
  ].filter((secret): secret is string => Boolean(secret?.trim()));
  let redacted = value;
  for (const secret of knownSecrets) {
    redacted = redacted.split(secret).join(API_KEY_PLACEHOLDER);
  }
  return redacted
    .replace(
      /(\/v1\/(?:subscriptions\/(?:status|entitlements|list|metrics|revenue)|products|webhooks(?:\/stream)?|webhooks\/(?:apple|google))\/)[^/?\s"]+/g,
      `$1${API_KEY_PLACEHOLDER}`,
    )
    .replace(
      /(Authorization:\s*Bearer\s+)[^\s"]+/gi,
      `$1${API_KEY_PLACEHOLDER}`,
    );
}

function registerTool(
  server: McpServer,
  localName: string,
  description: string,
  schema: Record<string, z.ZodTypeAny>,
  annotations: ToolAnnotations,
  handler: (args: any, extra: ToolExtra) => unknown,
) {
  server.tool(
    `${IAPKIT_TOOL_PREFIX}_${localName}`,
    description,
    schema,
    annotations,
    handler as any,
  );
}

export function createIapKitMcpServer(): McpServer {
  const server = new McpServer({
    name: IAPKIT_MCP_SERVER_NAME,
    version: IAPKIT_MCP_SERVER_VERSION,
    websiteUrl: "https://kit.openiap.dev",
  });
  registerIapKitTools(server);
  return server;
}

function registerIapKitTools(server: McpServer) {
  // ---------------------------------------------------------------------------
  // 1. setup — generate per-framework integration snippet.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "setup",
    "Print a copy/pasteable IAPKit integration snippet for a given framework. Does not modify files — emit code for the LLM / human to apply.",
    {
      framework: z
        .enum(["expo", "react-native", "flutter", "kmp", "godot"])
        .describe("Which framework SDK to wire."),
      apiKey: z
        .string()
        .optional()
        .describe(
          "Accepted for compatibility, but never embedded in generated snippets. Configure IAPKIT_API_KEY or the MCP Authorization bearer token instead.",
        ),
      productId: PRODUCT_ID_PARAM.optional().describe(
        "Default productId to seed.",
      ),
    },
    READ_ONLY_TOOL,
    async (args) => {
      const productId = args.productId ?? "com.example.premium_monthly";
      const snippet = renderSetupSnippet(
        args.framework,
        API_KEY_PLACEHOLDER,
        productId,
      );
      return ok({
        framework: args.framework,
        snippet,
        note: "API keys are intentionally left as IAPKIT_API_KEY placeholders so tool output does not leak project credentials.",
      });
    },
  );

  // ---------------------------------------------------------------------------
  // 2. check_status — entitlement check for one user.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "check_status",
    "Return whether a userId currently has an active subscription, plus the latest subscription record.",
    {
      userId: USER_ID_PARAM,
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        return ok(await withClient(args, extra).status(args.userId));
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 3. troubleshoot — quick diagnostics.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "troubleshoot",
    "Run a fast diagnostic against the configured kit deployment: health probe, sample status query, sample entitlement query.",
    {
      sampleUserId: USER_ID_PARAM.optional().describe(
        "If provided, runs status + entitlements for this id.",
      ),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        const client = withClient(args, extra);
        const [health, metrics] = await Promise.all([
          client.health().catch((e) => ({ error: stringifyError(e) })),
          client.metrics().catch((e) => ({ error: stringifyError(e) })),
        ]);
        // The tool description promises status + entitlement checks. Run
        // both in parallel when a sampleUserId is supplied so diagnostics
        // surface entitlement-specific failures (e.g. webhook-state drift)
        // alongside the basic status probe — running just `status` left
        // those blind.
        const userProbe = args.sampleUserId
          ? await Promise.all([
              client
                .status(args.sampleUserId)
                .catch((e) => ({ error: stringifyError(e) })),
              client
                .entitlements(args.sampleUserId)
                .catch((e) => ({ error: stringifyError(e) })),
            ]).then(([status, entitlements]) => ({ status, entitlements }))
          : null;
        return ok({ health, metrics, userProbe });
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 4. create_product — upsert a product in kit's catalog.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "create_product",
    "Add or update a product in IAPKit's local catalog. Note: this creates the IAPKit-side row only — use `iapkit_sync_products` with direction=push or both after store credentials are configured to enqueue App Store Connect / Play Console sync.",
    {
      productId: PRODUCT_ID_PARAM,
      platform: z.enum(["IOS", "Android"]),
      type: z.enum(["Subscription", "NonConsumable", "Consumable"]),
      title: TITLE_PARAM,
      description: z.string().optional(),
      priceAmountMicros: PRICE_AMOUNT_MICROS_PARAM.optional(),
      currency: z.string().optional(),
      billingPeriod: z
        .enum(["P1W", "P1M", "P2M", "P3M", "P6M", "P1Y"])
        .optional(),
      subscriptionGroupName: z
        .string()
        .optional()
        .describe(
          "Required for iOS Subscription products. Reuse the same group name for related tiers.",
        ),
      reviewNote: z.string().optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args, extra) => {
      try {
        if (
          args.platform === "IOS" &&
          args.type === "Subscription" &&
          !args.subscriptionGroupName?.trim()
        ) {
          return err(
            new Error(
              "subscriptionGroupName is required for iOS Subscription products",
            ),
            resolveApiKey(args, extra),
          );
        }
        return ok(
          await withClient(args, extra).upsertProduct({
            productId: args.productId,
            platform: args.platform,
            type: args.type,
            title: args.title,
            description: args.description,
            priceAmountMicros: args.priceAmountMicros,
            currency: args.currency,
            billingPeriod: args.billingPeriod,
            subscriptionGroupName: args.subscriptionGroupName,
            reviewNote: args.reviewNote,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 5. list_products — read kit's product catalog.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "list_products",
    "List the project's product catalog stored in IAPKit.",
    {
      platform: z.enum(["IOS", "Android"]).optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).listProducts({
            platform: args.platform,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 6. view_subscribers — paginated subscription list for the dashboard.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "view_subscribers",
    "List subscription rows for the project. Filter by state / productId / userId.",
    {
      state: z
        .enum([
          "Active",
          "InGracePeriod",
          "InBillingRetry",
          "Expired",
          "Revoked",
          "Refunded",
          "Paused",
          "Unknown",
        ])
        .optional(),
      productId: PRODUCT_ID_PARAM.optional(),
      userId: USER_ID_PARAM.optional(),
      limit: z.number().int().min(1).max(200).optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).listSubscriptions({
            state: args.state,
            productId: args.productId,
            userId: args.userId,
            limit: args.limit,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 7. simulate_purchase — print sandbox-purchase guidance per platform.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "simulate_purchase",
    "Print step-by-step instructions for triggering a sandbox purchase on Apple StoreKit Configuration / Google Play License Tester. Does not call live APIs — sandbox purchases must be initiated from the device itself.",
    {
      productId: PRODUCT_ID_PARAM,
      platform: z.enum(["IOS", "Android"]),
    },
    READ_ONLY_TOOL,
    async (args) => ok({ steps: simulatePurchaseSteps(args) }),
  );

  // ---------------------------------------------------------------------------
  // 8. simulate_webhook — POST a synthetic webhook payload to kit.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "simulate_webhook",
    "POST a synthetic test notification to kit's webhook endpoint. Android simulation is for local/dev deployments with KIT_ALLOW_UNAUTHENTICATED_PUBSUB=1; production Google RTDN requires Pub/Sub OIDC.",
    {
      platform: z.enum(["IOS", "Android"]),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args, extra) => {
      const apiKey =
        args.apiKey ??
        extra?.authInfo?.token ??
        process.env.IAPKIT_API_KEY;
      if (!apiKey) return err(new Error("apiKey required"));
      const validationError = validateApiKey(apiKey);
      if (validationError) return err(new Error(validationError), apiKey);
      let baseUrl: string;
      try {
        baseUrl = normalizeKitBaseUrl(
          args.baseUrl ?? process.env.IAPKIT_BASE_URL,
        );
      } catch (error) {
        return err(error, apiKey);
      }
      if (args.platform === "Android") {
        const message = {
          version: "1.0",
          packageName: "com.example.app",
          eventTimeMillis: Date.now(),
          testNotification: { version: "1.0" },
        };
        const data = base64EncodeUtf8(JSON.stringify(message));
        const body = {
          message: {
            data,
            messageId: `test-${Date.now()}`,
            publishTime: new Date().toISOString(),
          },
          subscription: "projects/local/subscriptions/openiap-test",
        };
        try {
          const response = await fetch(
            `${baseUrl}/v1/webhooks/${encodeURIComponent(apiKey)}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            },
          );
          const responseBody = await response.text();
          if (!response.ok) {
            return err(
              new KitHttpError(
                response.status,
                responseBody,
                `kit /v1/webhooks/${API_KEY_PLACEHOLDER} returned ${response.status}`,
              ),
              apiKey,
            );
          }
          return ok({ status: response.status, body: responseBody });
        } catch (error) {
          return err(error, apiKey);
        }
      }
      return ok({
        info: "Apple ASN v2 simulation requires a real signed payload from App Store Connect Sandbox. Use App Store Connect → App Store Server Notifications → Send Test Notification, configured to POST to /v1/webhooks/{apiKey}.",
      });
    },
  );

  // ---------------------------------------------------------------------------
  // 9. inspect_state — high-level dashboard summary in one tool call.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "inspect_state",
    "Return a dashboard-style summary: metrics, product catalog, configured webhooks endpoint URLs.",
    {
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        const client = withClient(args, extra);
        const [metrics, products] = await Promise.all([
          client.metrics().catch((e) => ({ error: stringifyError(e) })),
          client.listProducts().catch((e) => ({ error: stringifyError(e) })),
        ]);
        return ok({
          metrics,
          products,
          webhookUrls: {
            lifecycle: `${client.baseUrl}/v1/webhooks/${API_KEY_PLACEHOLDER}`,
            stream: `${client.baseUrl}/v1/webhooks/stream/${API_KEY_PLACEHOLDER}`,
          },
          note: "Use webhookUrls.lifecycle for both Apple ASN v2 and Google Pub/Sub RTDN. URLs use an IAPKIT_API_KEY placeholder so tool output does not leak project credentials.",
        });
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 10. revenue_analytics — answer purchase / revenue questions.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "revenue_analytics",
    "Summarize IAPKit subscription purchase and revenue analytics for a date range. Defaults to the current UTC month so Codex can answer questions like 'how many purchases happened this month?'.",
    {
      period: z
        .enum(["this_month", "last_30_days", "last_90_days", "custom"])
        .optional()
        .describe(
          "Date window to summarize. Use custom with fromDay and toDay for an explicit range.",
        ),
      fromDay: ISO_DAY_PARAM.optional().describe(
        "Inclusive UTC day for custom ranges, YYYY-MM-DD.",
      ),
      toDay: ISO_DAY_PARAM.optional().describe(
        "Inclusive UTC day for custom ranges, YYYY-MM-DD.",
      ),
      productId: PRODUCT_ID_PARAM.optional(),
      platform: z.enum(["IOS", "Android"]).optional(),
      currency: z.string().optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        const range = resolveRevenueRange(args);
        const metrics = await withClient(args, extra).revenueMetrics(range);
        return ok(
          summarizeRevenueMetrics(metrics, {
            ...range,
            productId: args.productId,
            platform: args.platform,
            currency: args.currency,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 11. manage_product — disable / refresh a product entry.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "manage_product",
    "Update or remove a product in IAPKit's catalog. `action: 'remove'` soft-removes via the product state endpoint.",
    {
      productId: PRODUCT_ID_PARAM,
      platform: z.enum(["IOS", "Android"]),
      action: z.enum(["disable", "enable", "remove"]),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args, extra) => {
      try {
        const client = withClient(args, extra);
        // Map the action onto the state-only endpoint. Using
        // `setProductState` instead of `upsertProduct` here avoids the
        // prior bug where calling upsertProduct with a hardcoded
        // `type: "Subscription"` + blank `title` would silently clobber
        // the existing row's product type and (depending on
        // upsertProduct's branch) its title.
        const stateMap = {
          disable: "Removed" as const,
          enable: "Active" as const,
          remove: "Removed" as const,
        };
        const action = args.action as keyof typeof stateMap;
        const next = await client.setProductState({
          productId: args.productId,
          platform: args.platform,
          state: stateMap[action],
        });
        return ok({ ...next, action: args.action });
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 12. sync_products — enqueue App Store / Play Console sync.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "sync_products",
    "Enqueue an IAPKit product sync job for App Store Connect or Google Play. Use dryRun=true first to inspect what Codex would change; set dryRun=false only when the user explicitly asks to apply the store sync.",
    {
      platform: z.enum(["IOS", "Android"]),
      direction: z
        .enum(["pull", "push", "both", "purge-local"])
        .optional()
        .describe(
          "pull imports from the store, push writes IAPKit catalog rows to the store, both does both, purge-local removes local rows missing from the store.",
        ),
      dryRun: z
        .boolean()
        .optional()
        .describe("Defaults to true so Codex previews store changes first."),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).syncProducts({
            platform: args.platform,
            direction: args.direction ?? "both",
            dryRun: args.dryRun ?? true,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 13. sync_status — poll a product sync job.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "sync_status",
    "Return the current state and log summary for a previously enqueued IAPKit product sync job.",
    {
      jobId: kitTextParam("jobId", MAX_KIT_ID_LENGTH),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        return ok(await withClient(args, extra).syncJob(args.jobId));
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );
}

function renderSetupSnippet(
  framework: "expo" | "react-native" | "flutter" | "kmp" | "godot",
  apiKey: string,
  productId: string,
): string {
  const apiKeyLiteral = codeStringLiteral(apiKey);
  const productIdLiteral = codeStringLiteral(productId);

  switch (framework) {
    case "expo":
    case "react-native":
      return `import { useIAP, useWebhookEvents } from '${framework === "expo" ? "expo-iap" : "react-native-iap"}';
import EventSource from 'react-native-sse';

const { events } = useWebhookEvents({
  apiKey: ${apiKeyLiteral},
  eventSourceFactory: (url) => new EventSource(url),
  onEvent: (event) => {
    if (event.type === 'SubscriptionRenewed') grantEntitlement(event.purchaseToken);
  },
});

const { fetchProducts, requestPurchase } = useIAP({ skus: [${productIdLiteral}] });`;
    case "flutter":
      return `import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase/webhook_client.dart';

final listener = connectWebhookStream(apiKey: ${apiKeyLiteral});
listener.events.listen((event) {
  if (event.type == WebhookEventType.SubscriptionRenewed) {
    grantEntitlement(event.purchaseToken);
  }
});
await FlutterInappPurchase.instance.requestPurchase(productId: ${productIdLiteral});`;
    case "kmp":
      return `import io.github.hyochan.kmpiap.openiap.WebhookEventParser
import io.github.hyochan.kmpiap.openiap.WebhookEventType

// Parse SSE frames from \`webhookStreamUrl(apiKey = ${apiKeyLiteral})\`
// in your platform's HTTP client and feed each data frame to:
val event = WebhookEventParser.parse(rawJson) ?: return
when (event.type) {
    WebhookEventType.SubscriptionRenewed -> grantEntitlement(event.purchaseToken)
    else -> Unit
}`;
    case "godot":
      return `extends Node

@onready var webhook := preload("res://addons/godot-iap/webhook_client.gd").new()

func _ready() -> void:
    webhook.api_key = ${apiKeyLiteral}
    webhook.event_received.connect(func(event):
        if event["type"] == "SubscriptionRenewed":
            grant_entitlement(event["purchaseToken"])
    )
    add_child(webhook)
    webhook.connect_stream()
    GodotIap.request_purchase(${productIdLiteral})`;
  }
}

function codeStringLiteral(value: string): string {
  return JSON.stringify(value);
}

function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

type RevenueMetricsResponse = {
  days: Array<{
    day: string;
    currency: string;
    productId: string;
    platform: "IOS" | "Android";
    activeSubs: number;
    newSubs: number;
    renewals: number;
    cancellations: number;
    refunds: number;
    revenueMicros: number;
  }>;
  currencies: string[];
  productIds: string[];
  platforms: Array<"IOS" | "Android">;
  truncated: boolean;
};

function resolveRevenueRange(args: {
  period?: "this_month" | "last_30_days" | "last_90_days" | "custom";
  fromDay?: string;
  toDay?: string;
}): { fromDay: string; toDay: string; period: string } {
  const period = args.period ?? "this_month";
  if (period === "custom") {
    if (!args.fromDay || !args.toDay) {
      throw new Error("fromDay and toDay are required when period is custom");
    }
    if (args.fromDay > args.toDay) {
      throw new Error("fromDay must be on or before toDay");
    }
    return { fromDay: args.fromDay, toDay: args.toDay, period };
  }

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (period === "this_month") {
    return {
      fromDay: formatUtcDay(
        new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
      ),
      toDay: formatUtcDay(today),
      period,
    };
  }

  return {
    fromDay: formatUtcDay(
      addUtcDays(today, period === "last_30_days" ? -29 : -89),
    ),
    toDay: formatUtcDay(today),
    period,
  };
}

function formatUtcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function summarizeRevenueMetrics(
  metrics: RevenueMetricsResponse,
  filters: {
    fromDay: string;
    toDay: string;
    period: string;
    productId?: string;
    platform?: "IOS" | "Android";
    currency?: string;
  },
) {
  const rows = metrics.days.filter((row) => {
    if (filters.productId && row.productId !== filters.productId) return false;
    if (filters.platform && row.platform !== filters.platform) return false;
    if (filters.currency && row.currency !== filters.currency) return false;
    return true;
  });

  const totalsByCurrency = new Map<
    string,
    {
      revenueMicros: number;
      purchaseEvents: number;
      newSubs: number;
      renewals: number;
      cancellations: number;
      refunds: number;
    }
  >();
  const totalsByProduct = new Map<
    string,
    { purchaseEvents: number; revenueMicrosByCurrency: Record<string, number> }
  >();
  const totalsByPlatform = new Map<
    "IOS" | "Android",
    { purchaseEvents: number; revenueMicrosByCurrency: Record<string, number> }
  >();

  for (const row of rows) {
    const purchaseEvents = row.newSubs + row.renewals;
    const currencyTotal = totalsByCurrency.get(row.currency) ?? {
      revenueMicros: 0,
      purchaseEvents: 0,
      newSubs: 0,
      renewals: 0,
      cancellations: 0,
      refunds: 0,
    };
    currencyTotal.revenueMicros += row.revenueMicros;
    currencyTotal.purchaseEvents += purchaseEvents;
    currencyTotal.newSubs += row.newSubs;
    currencyTotal.renewals += row.renewals;
    currencyTotal.cancellations += row.cancellations;
    currencyTotal.refunds += row.refunds;
    totalsByCurrency.set(row.currency, currencyTotal);

    const productTotal = totalsByProduct.get(row.productId) ?? {
      purchaseEvents: 0,
      revenueMicrosByCurrency: {},
    };
    productTotal.purchaseEvents += purchaseEvents;
    productTotal.revenueMicrosByCurrency[row.currency] =
      (productTotal.revenueMicrosByCurrency[row.currency] ?? 0) +
      row.revenueMicros;
    totalsByProduct.set(row.productId, productTotal);

    const platformTotal = totalsByPlatform.get(row.platform) ?? {
      purchaseEvents: 0,
      revenueMicrosByCurrency: {},
    };
    platformTotal.purchaseEvents += purchaseEvents;
    platformTotal.revenueMicrosByCurrency[row.currency] =
      (platformTotal.revenueMicrosByCurrency[row.currency] ?? 0) +
      row.revenueMicros;
    totalsByPlatform.set(row.platform, platformTotal);
  }

  return {
    range: filters,
    rowCount: rows.length,
    totalsByCurrency: Object.fromEntries(totalsByCurrency),
    totalsByProduct: Object.fromEntries(totalsByProduct),
    totalsByPlatform: Object.fromEntries(totalsByPlatform),
    availableFilters: {
      currencies: metrics.currencies,
      productIds: metrics.productIds,
      platforms: metrics.platforms,
    },
    truncated: metrics.truncated,
    note: "purchaseEvents counts subscription starts plus renewals in IAPKit revenue rollups. Refunds and cancellations are reported separately.",
  };
}

function simulatePurchaseSteps(args: {
  productId: string;
  platform: "IOS" | "Android";
}): string[] {
  if (args.platform === "IOS") {
    return [
      "Open the host app's Xcode scheme.",
      "Set Run > Options > StoreKit Configuration to a .storekit file containing the product.",
      `Run on Simulator and trigger the in-app purchase for ${args.productId}.`,
      "On purchase complete, kit's verifyReceipt route ingests the JWS; the matching ASN v2 TEST notification can be triggered from App Store Connect → App Store Server Notifications → Send Test Notification.",
    ];
  }
  return [
    "Open Google Play Console → Setup → License testing.",
    "Add your tester Google account.",
    `Sideload the host app and trigger the in-app purchase for ${args.productId} signed-in as the tester.`,
    "Pub/Sub will deliver an RTDN to /v1/webhooks/{apiKey} once the configured topic + subscription are wired.",
  ];
}

function stringifyError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
