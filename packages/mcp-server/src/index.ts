#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  kitClient,
  KitHttpError,
  normalizeKitBaseUrl,
} from "./kit-client.js";
import { redactSensitivePayload } from "./redact.js";

// 10-tool MCP server for openiap. Every tool funnels through
// `withClient` so `OPENIAP_API_KEY` / `OPENIAP_BASE_URL` env config is
// consistent and errors surface in a uniform `{ ok: false, error }`
// shape that LLMs handle predictably.

const server = new McpServer({
  name: "openiap-mcp",
  version: "0.1.0",
});

const OPTIONAL_BASE_URL = z
  .string()
  .url()
  .optional()
  .describe(
    "Override kit base URL. Defaults to OPENIAP_BASE_URL env var, then https://kit.openiap.dev.",
  );

const API_KEY_PLACEHOLDER = "<OPENIAP_API_KEY>";
const MAX_API_KEY_LENGTH = 128;
const MAX_KIT_ID_LENGTH = 256;
const MAX_PRICE_AMOUNT_MICROS = Number.MAX_SAFE_INTEGER;

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
  "Project API key. Defaults to OPENIAP_API_KEY env var. The MCP server is single-project per process — set this once via env when launching from a config.",
);

function validateApiKey(apiKey: string): string | null {
  if (!apiKey.trim()) return "apiKey must not be blank";
  if (/\s/.test(apiKey)) return "apiKey must not contain whitespace";
  if (apiKey.length > MAX_API_KEY_LENGTH) {
    return `apiKey must be at most ${MAX_API_KEY_LENGTH} characters`;
  }
  return null;
}

function withClient(opts: { apiKey?: string; baseUrl?: string }) {
  const apiKey = opts.apiKey ?? process.env.OPENIAP_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENIAP_API_KEY is not set and `apiKey` was not provided to the tool.",
    );
  }
  const validationError = validateApiKey(apiKey);
  if (validationError) {
    throw new Error(validationError);
  }
  return kitClient({
    apiKey,
    baseUrl: opts.baseUrl ?? process.env.OPENIAP_BASE_URL,
  });
}

function ok(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(redactSensitivePayload(payload), null, 2),
      },
    ],
  };
}

function err(error: unknown) {
  const detail =
    error instanceof KitHttpError
      ? { status: error.status, body: error.body, message: error.message }
      : { message: error instanceof Error ? error.message : String(error) };
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          redactSensitivePayload({ ok: false, error: detail }),
          null,
          2,
        ),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 1. setup — generate per-framework integration snippet.
// ---------------------------------------------------------------------------
server.tool(
  "openiap_setup",
  "Print a copy/pasteable openiap integration snippet for a given framework. Does not modify files — emit code for the LLM / human to apply.",
  {
    framework: z
      .enum(["expo", "react-native", "flutter", "kmp", "godot"])
      .describe("Which framework SDK to wire."),
    apiKey: z
      .string()
      .optional()
      .describe(
        "Accepted for compatibility, but never embedded in generated snippets. Configure OPENIAP_API_KEY in the runtime environment instead.",
      ),
    productId: PRODUCT_ID_PARAM.optional().describe(
      "Default productId to seed.",
    ),
  },
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
      note: "API keys are intentionally left as OPENIAP_API_KEY placeholders so tool output does not leak project credentials.",
    });
  },
);

// ---------------------------------------------------------------------------
// 2. check_status — entitlement check for one user.
// ---------------------------------------------------------------------------
server.tool(
  "openiap_check_status",
  "Return whether a userId currently has an active subscription, plus the latest subscription record.",
  {
    userId: USER_ID_PARAM,
    apiKey: OPTIONAL_API_KEY,
    baseUrl: OPTIONAL_BASE_URL,
  },
  async (args) => {
    try {
      return ok(await withClient(args).status(args.userId));
    } catch (error) {
      return err(error);
    }
  },
);

// ---------------------------------------------------------------------------
// 3. troubleshoot — quick diagnostics.
// ---------------------------------------------------------------------------
server.tool(
  "openiap_troubleshoot",
  "Run a fast diagnostic against the configured kit deployment: health probe, sample status query, sample entitlement query.",
  {
    sampleUserId: USER_ID_PARAM
      .optional()
      .describe("If provided, runs status + entitlements for this id."),
    apiKey: OPTIONAL_API_KEY,
    baseUrl: OPTIONAL_BASE_URL,
  },
  async (args) => {
    try {
      const client = withClient(args);
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
      return err(error);
    }
  },
);

// ---------------------------------------------------------------------------
// 4. create_product — upsert a product in kit's catalog.
// ---------------------------------------------------------------------------
server.tool(
  "openiap_create_product",
  "Add or update a product in kit's local catalog. Note: this creates the kit-side row only — actual App Store Connect / Play Console creation is triggered by `openiap_manage_product` once the project's store credentials are configured.",
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
  async (args) => {
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
        );
      }
      return ok(
        await withClient(args).upsertProduct({
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
      return err(error);
    }
  },
);

// ---------------------------------------------------------------------------
// 5. list_products — read kit's product catalog.
// ---------------------------------------------------------------------------
server.tool(
  "openiap_list_products",
  "List the project's product catalog stored in kit.",
  {
    platform: z.enum(["IOS", "Android"]).optional(),
    apiKey: OPTIONAL_API_KEY,
    baseUrl: OPTIONAL_BASE_URL,
  },
  async (args) => {
    try {
      return ok(
        await withClient(args).listProducts({ platform: args.platform }),
      );
    } catch (error) {
      return err(error);
    }
  },
);

// ---------------------------------------------------------------------------
// 6. view_subscribers — paginated subscription list for the dashboard.
// ---------------------------------------------------------------------------
server.tool(
  "openiap_view_subscribers",
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
  async (args) => {
    try {
      return ok(
        await withClient(args).listSubscriptions({
          state: args.state,
          productId: args.productId,
          userId: args.userId,
          limit: args.limit,
        }),
      );
    } catch (error) {
      return err(error);
    }
  },
);

// ---------------------------------------------------------------------------
// 7. simulate_purchase — print sandbox-purchase guidance per platform.
// ---------------------------------------------------------------------------
server.tool(
  "openiap_simulate_purchase",
  "Print step-by-step instructions for triggering a sandbox purchase on Apple StoreKit Configuration / Google Play License Tester. Does not call live APIs — sandbox purchases must be initiated from the device itself.",
  {
    productId: PRODUCT_ID_PARAM,
    platform: z.enum(["IOS", "Android"]),
  },
  async (args) => ok({ steps: simulatePurchaseSteps(args) }),
);

// ---------------------------------------------------------------------------
// 8. simulate_webhook — POST a synthetic webhook payload to kit.
// ---------------------------------------------------------------------------
server.tool(
  "openiap_simulate_webhook",
  "POST a synthetic test notification to kit's webhook endpoint. Android simulation is for local/dev deployments with KIT_ALLOW_UNAUTHENTICATED_PUBSUB=1; production Google RTDN requires Pub/Sub OIDC.",
  {
    platform: z.enum(["IOS", "Android"]),
    apiKey: OPTIONAL_API_KEY,
    baseUrl: OPTIONAL_BASE_URL,
  },
  async (args) => {
    const apiKey = args.apiKey ?? process.env.OPENIAP_API_KEY;
    if (!apiKey) return err(new Error("apiKey required"));
    const validationError = validateApiKey(apiKey);
    if (validationError) return err(new Error(validationError));
    let baseUrl: string;
    try {
      baseUrl = normalizeKitBaseUrl(
        args.baseUrl ?? process.env.OPENIAP_BASE_URL,
      );
    } catch (error) {
      return err(error);
    }
    if (args.platform === "Android") {
      const message = {
        version: "1.0",
        packageName: "com.example.app",
        eventTimeMillis: Date.now(),
        testNotification: { version: "1.0" },
      };
      const data = Buffer.from(JSON.stringify(message)).toString("base64");
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
          );
        }
        return ok({ status: response.status, body: responseBody });
      } catch (error) {
        return err(error);
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
server.tool(
  "openiap_inspect_state",
  "Return a dashboard-style summary: metrics, product catalog, configured webhooks endpoint URLs.",
  {
    apiKey: OPTIONAL_API_KEY,
    baseUrl: OPTIONAL_BASE_URL,
  },
  async (args) => {
    try {
      const client = withClient(args);
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
          legacyAliases: {
            apple: `${client.baseUrl}/v1/webhooks/apple/${API_KEY_PLACEHOLDER}`,
            google: `${client.baseUrl}/v1/webhooks/google/${API_KEY_PLACEHOLDER}`,
          },
        },
        note: "Use webhookUrls.lifecycle for both Apple ASN v2 and Google Pub/Sub RTDN. Legacy aliases remain supported for existing store-console wiring. URLs use an OPENIAP_API_KEY placeholder so tool output does not leak project credentials.",
      });
    } catch (error) {
      return err(error);
    }
  },
);

// ---------------------------------------------------------------------------
// 10. manage_product — disable / refresh a product entry.
// ---------------------------------------------------------------------------
server.tool(
  "openiap_manage_product",
  "Update or remove a product in kit's catalog. `action: 'remove'` soft-removes via the product state endpoint.",
  {
    productId: PRODUCT_ID_PARAM,
    platform: z.enum(["IOS", "Android"]),
    action: z.enum(["disable", "enable", "remove"]),
    apiKey: OPTIONAL_API_KEY,
    baseUrl: OPTIONAL_BASE_URL,
  },
  async (args) => {
    try {
      const client = withClient(args);
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
      const next = await client.setProductState({
        productId: args.productId,
        platform: args.platform,
        state: stateMap[args.action],
      });
      return ok({ ...next, action: args.action });
    } catch (error) {
      return err(error);
    }
  },
);

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

const transport = new StdioServerTransport();
await server.connect(transport);
