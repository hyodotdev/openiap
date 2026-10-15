import {
  McpServer,
  type ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  ServerNotification,
  ServerRequest,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { INSUFFICIENT_API_KEY_SCOPE_MESSAGE, isSecretApiKey } from "./auth.js";
import {
  fetchKit,
  KIT_PURCHASE_ISSUE_CAUSES,
  kitClient,
  KitHttpError,
  normalizeKitBaseUrl,
  type KitRevenueMetricsResponse,
} from "./kit-client.js";

// MCP server for IAPKit. Every tool funnels through `withClient`, so key
// resolution and the kit endpoint are decided in one place, and errors surface
// in a uniform `{ ok: false, error }` shape that LLMs handle predictably.

export const IAPKIT_MCP_SERVER_NAME = "iapkit-mcp";
export const IAPKIT_MCP_SERVER_VERSION = "0.1.0";
const IAPKIT_TOOL_PREFIX = "iapkit";
const SETUP_FRAMEWORKS = [
  "expo",
  "react-native",
  "flutter",
  "kmp",
  "godot",
  "ios",
  "android",
] as const;

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;
type SetupFramework = (typeof SETUP_FRAMEWORKS)[number];

const OPTIONAL_BASE_URL = z
  .string()
  .url()
  .optional()
  .describe(
    "Override IAPKit base URL. Defaults to IAPKIT_BASE_URL, then https://kit.openiap.dev. The hosted server ignores it.",
  );

const API_KEY_PLACEHOLDER = "<IAPKIT_SECRET_KEY>";
export const MANAGE_PRODUCT_DISABLE_MESSAGE =
  "IAPKit has no non-destructive disabled state. Pause sales in App Store Connect or Play Console, or use action 'remove' to delete the product on the next push sync.";
const PUBLISHABLE_KEY_PLACEHOLDER = "<IAPKIT_PUBLISHABLE_KEY>";
const MAX_API_KEY_LENGTH = 128;
const MAX_KIT_ID_LENGTH = 256;
const MAX_CLIENT_PAYLOAD_BYTES = 16 * 1024;
const MAX_PRODUCT_PAGE_SIZE = 50;
const MAX_PRODUCT_CURSOR_LENGTH = 4096;
const MAX_OPERATIONS_PAGE_SIZE = 100;
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
const ISO_TIME_PARAM = z.string().datetime({ offset: true });
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
  "IAPKit secret admin key. Defaults to the MCP Authorization bearer token (stdio: IAPKIT_API_KEY).",
);

function validateApiKey(apiKey: string): string | null {
  if (!apiKey.trim()) return "apiKey must not be blank";
  if (/\s/.test(apiKey)) return "apiKey must not contain whitespace";
  if (apiKey.length > MAX_API_KEY_LENGTH) {
    return `apiKey must be at most ${MAX_API_KEY_LENGTH} characters`;
  }
  return null;
}

export interface IapKitMcpServerOptions {
  /**
   * Kit endpoint every tool calls. When set, the per-call `baseUrl` argument
   * is ignored, so a tool call cannot point the server at another host.
   */
  kitBaseUrl?: string;
  /**
   * Fall back to IAPKIT_API_KEY when a call carries no key. Only for stdio,
   * where the operator owns the process; network transports require a bearer.
   */
  allowEnvApiKey?: boolean;
}

type KeyedArgs = { apiKey?: string; baseUrl?: string };

interface KitAccess {
  /** The caller's `baseUrl`, or undefined when the server pins its kit. */
  callerBaseUrl: (requested?: string) => string | undefined;
  kitBaseUrl: (requested?: string) => string | undefined;
  resolveApiKey: (opts: KeyedArgs, extra?: ToolExtra) => string | undefined;
  withClient: (
    opts: KeyedArgs,
    extra?: ToolExtra,
  ) => ReturnType<typeof kitClient>;
}

function createKitAccess(options: IapKitMcpServerOptions): KitAccess {
  const callerBaseUrl = (requested?: string): string | undefined =>
    options.kitBaseUrl === undefined ? requested : undefined;
  const kitBaseUrl = (requested?: string): string | undefined =>
    options.kitBaseUrl ?? requested ?? process.env.IAPKIT_BASE_URL;
  const resolveApiKey = (
    opts: KeyedArgs,
    extra?: ToolExtra,
  ): string | undefined =>
    opts.apiKey ??
    extra?.authInfo?.token ??
    (options.allowEnvApiKey ? process.env.IAPKIT_API_KEY : undefined);
  const withClient = (opts: KeyedArgs, extra?: ToolExtra) => {
    const apiKey = resolveApiKey(opts, extra);
    if (!apiKey) {
      throw new Error(
        `No IAPKit secret admin key was provided. Set Authorization: Bearer ${API_KEY_PLACEHOLDER} or the tool's apiKey argument.`,
      );
    }
    const validationError = validateApiKey(apiKey);
    if (validationError) {
      throw new Error(validationError);
    }
    if (!isSecretApiKey(apiKey)) {
      throw new Error(INSUFFICIENT_API_KEY_SCOPE_MESSAGE);
    }
    return kitClient({ apiKey, baseUrl: kitBaseUrl(opts.baseUrl) });
  };
  return { callerBaseUrl, kitBaseUrl, resolveApiKey, withClient };
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

export function redactSecretString(value: string, apiKey?: string): string {
  const knownSecrets = [apiKey, process.env.IAPKIT_API_KEY].filter(
    (secret): secret is string => Boolean(secret?.trim()),
  );
  let redacted = value;
  for (const secret of knownSecrets) {
    redacted = redacted.split(secret).join(API_KEY_PLACEHOLDER);
  }
  // Pattern, not instance: an upstream body can carry a key that is neither
  // this caller's nor the environment's, and listing known secrets would miss it.
  return redacted
    .replace(/openiap-kit_(?:sk|pk)_[A-Za-z0-9_-]+/g, API_KEY_PLACEHOLDER)
    .replace(
      /(Authorization:\s*Bearer\s+)[^\s"]+/gi,
      `$1${API_KEY_PLACEHOLDER}`,
    );
}

function registerTool<Args extends z.ZodRawShape>(
  server: McpServer,
  localName: string,
  description: string,
  schema: Args,
  annotations: ToolAnnotations,
  handler: ToolCallback<Args>,
) {
  server.tool(
    `${IAPKIT_TOOL_PREFIX}_${localName}`,
    description,
    schema,
    annotations,
    handler,
  );
}

/**
 * Creates the IAPKit MCP server and registers the `iapkit_*` tool surface.
 *
 * The returned server is configured with the package name/version metadata and
 * `https://kit.openiap.dev` as its website URL. Tool registration is performed
 * before returning so callers can connect the server directly to stdio, HTTP,
 * or web-standard MCP transports.
 *
 * @returns An `McpServer` instance with all IAPKit tools registered.
 */
export function createIapKitMcpServer(
  options: IapKitMcpServerOptions = {},
): McpServer {
  const server = new McpServer({
    name: IAPKIT_MCP_SERVER_NAME,
    version: IAPKIT_MCP_SERVER_VERSION,
    websiteUrl: "https://kit.openiap.dev",
  });
  registerIapKitTools(server, createKitAccess(options));
  return server;
}

function registerIapKitTools(
  server: McpServer,
  { callerBaseUrl, kitBaseUrl, resolveApiKey, withClient }: KitAccess,
) {
  // ---------------------------------------------------------------------------
  // 1. setup — generate per-framework integration snippet.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "setup",
    "Print a copy/pasteable mobile IAPKit integration snippet using a restricted publishable key. Does not modify files or expose the MCP secret key.",
    {
      framework: z
        .enum(SETUP_FRAMEWORKS)
        .describe("Which framework SDK or native platform to wire."),
      apiKey: z
        .string()
        .optional()
        .describe(
          "Accepted for compatibility, but never embedded in generated snippets. Mobile code must use a separate publishable key.",
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
        PUBLISHABLE_KEY_PLACEHOLDER,
        productId,
      );
      return ok({
        framework: args.framework,
        snippet,
        note: "Insert an openiap-kit_pk_ publishable key in the IAPKIT_PUBLISHABLE_KEY placeholder. Never put the MCP openiap-kit_sk_ secret key in an app.",
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
          client
            .health()
            .catch((e) => ({ error: stringifyError(e, client.apiKey) })),
          client
            .metrics()
            .catch((e) => ({ error: stringifyError(e, client.apiKey) })),
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
                .catch((e) => ({ error: stringifyError(e, client.apiKey) })),
              client
                .entitlements(args.sampleUserId)
                .catch((e) => ({ error: stringifyError(e, client.apiKey) })),
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
      localizations: z
        .array(
          z.object({
            locale: z
              .string()
              .describe('BCP-47 code, e.g. "ko-KR" or "ja-JP".'),
            title: z.string(),
            description: z.string().optional(),
          }),
        )
        .optional()
        .describe(
          "Store-listing text in other languages. `title` / `description` are the base listing (en-US for a new product; a product pulled from a store preserves that store's base locale). These add locales on top. Do not repeat the product's base locale. Regional pricing is converted automatically and is not configured here.",
        ),
      regions: z
        .union([z.literal("all"), z.array(z.string())])
        .optional()
        .describe(
          'Android one-time products only — rejected for iOS and for subscriptions. A list of two-letter ISO 3166-1 codes, e.g. ["US","KR","JP"], restricts the product to those markets and keeps it out of regions Play adds later. "all" explicitly expands to every region Play prices and follows Play into new markets. On create, omission uses the safe default: every priced region. On update, omission preserves the stored choice. Send [] to clear a stored choice back to inherit; an existing Play product then keeps its current live footprint, while a product Play has never seen is created everywhere.',
        ),
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
            localizations: args.localizations,
            regions: args.regions,
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
    "List one page of the project's product catalog stored in IAPKit. Use nextCursor until hasMore is false.",
    {
      platform: z.enum(["IOS", "Android"]).optional(),
      limit: z.number().int().min(1).max(MAX_PRODUCT_PAGE_SIZE).optional(),
      cursor: kitTextParam("cursor", MAX_PRODUCT_CURSOR_LENGTH)
        .optional()
        .describe("Opaque nextCursor returned by the previous page."),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).listProducts({
            platform: args.platform,
            limit: args.limit,
            cursor: args.cursor,
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
    "POST a synthetic test notification to kit's webhook endpoint with a separate publishable key. Android simulation is for local/dev deployments with KIT_ALLOW_UNAUTHENTICATED_PUBSUB=1; production Google RTDN requires Pub/Sub OIDC.",
    {
      platform: z.enum(["IOS", "Android"]),
      publishableKey: API_KEY_PARAM.optional().describe(
        "IAPKit publishable project key for the lifecycle webhook URL. Required for Android simulation; the MCP secret is never used automatically.",
      ),
      apiKey: API_KEY_PARAM.optional().describe(
        "Deprecated alias for publishableKey. Must be a publishable project key.",
      ),
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args) => {
      if (args.platform === "Android") {
        const publishableKey = args.publishableKey ?? args.apiKey;
        if (!publishableKey) {
          return err(
            new Error(
              "publishableKey is required. The MCP secret is intentionally not reused for lifecycle webhook URLs.",
            ),
          );
        }
        if (publishableKey.startsWith("openiap-kit_sk_")) {
          return err(
            new Error(
              "publishableKey must not be an openiap-kit_sk_ secret. Create or select an openiap-kit_pk_ key for the lifecycle webhook URL.",
            ),
            publishableKey,
          );
        }
        const validationError = validateApiKey(publishableKey);
        if (validationError) {
          return err(new Error(validationError), publishableKey);
        }
        let baseUrl: string;
        try {
          baseUrl = normalizeKitBaseUrl(kitBaseUrl(args.baseUrl));
        } catch (error) {
          return err(error, publishableKey);
        }
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
          const { response, text: responseBody } = await fetchKit(
            `${baseUrl}/v1/webhooks/${encodeURIComponent(publishableKey)}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            },
          );
          if (!response.ok) {
            return err(
              new KitHttpError(
                response.status,
                responseBody,
                `kit /v1/webhooks/${PUBLISHABLE_KEY_PLACEHOLDER} returned ${response.status}`,
              ),
              publishableKey,
            );
          }
          return ok({ status: response.status, body: responseBody });
        } catch (error) {
          return err(error, publishableKey);
        }
      }
      return ok({
        info: "Apple ASN v2 simulation requires a real signed payload from App Store Connect Sandbox. Use App Store Connect → App Store Server Notifications → Send Test Notification, configured to POST to /v1/webhooks/{publishableKey}.",
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
        const publicBaseUrl = normalizeKitBaseUrl(
          callerBaseUrl(args.baseUrl) ?? process.env.IAPKIT_PUBLIC_BASE_URL,
        );
        const [metrics, products] = await Promise.all([
          client
            .metrics()
            .catch((e) => ({ error: stringifyError(e, client.apiKey) })),
          client
            .listProducts()
            .catch((e) => ({ error: stringifyError(e, client.apiKey) })),
        ]);
        return ok({
          metrics,
          products,
          webhookUrls: {
            lifecycle: `${publicBaseUrl}/v1/webhooks/${PUBLISHABLE_KEY_PLACEHOLDER}`,
          },
          note: "Use webhookUrls.lifecycle for inbound Apple ASN v2 and Google Pub/Sub RTDN delivery. IAPKit does not expose an outbound webhook stream.",
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
    "Summarize IAPKit subscription revenue analytics, verified from store notifications, for a UTC date range: paid charges, trials started and converted, direct paid starts, auto-renew turned off vs expirations, refunds, and optionally monthly cohorts with retention and realized LTV. Production only unless environment is sandbox. Revenue is the store list price in each currency, before store fees and refunds; IAPKit never converts currencies. Defaults to the current UTC month.",
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
      environment: z
        .enum(["production", "sandbox"])
        .optional()
        .describe("Store environment to report. Defaults to production."),
      includeCohorts: z
        .boolean()
        .optional()
        .describe(
          "Add monthly paid cohorts (retention, realized LTV) and trial-to-paid conversion by trial month.",
        ),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        const range = resolveRevenueRange(args);
        const metrics = await withClient(args, extra).revenueMetrics({
          fromDay: range.fromDay,
          toDay: range.toDay,
          ...(args.environment ? { environment: args.environment } : {}),
          ...(args.includeCohorts ? { cohorts: true } : {}),
        });
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
  // 11. manage_product — enable / remove a product entry.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "manage_product",
    "Update or remove a product in IAPKit's catalog. `action: 'remove'` marks the row Removed; the next product sync push/both deletes the upstream store product when the platform allows it. `action: 'disable'` is rejected: IAPKit has no non-destructive disabled state, so pause sales in App Store Connect or Play Console instead.",
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
        // Kept in the schema so existing callers get this message, not a
        // validation error.
        if (args.action === "disable") {
          return err(new Error(MANAGE_PRODUCT_DISABLE_MESSAGE));
        }
        const next = await withClient(args, extra).setProductState({
          productId: args.productId,
          platform: args.platform,
          state: args.action === "enable" ? "Active" : "Removed",
        });
        return ok({ ...next, action: args.action });
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 12. get_client_payload — read public rules plus their durable OCC state.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "get_client_payload",
    "Read a product's public client payload and durable expectedVersion. Requires a secret admin key and returns the revision even after deletion.",
    {
      productId: PRODUCT_ID_PARAM,
      platform: z.enum(["IOS", "Android"]),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).getClientPayloadState({
            productId: args.productId,
            platform: args.platform,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 13. set_client_payload — attach public app-readable product rules.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "set_client_payload",
    "Publish a product's public app-readable TOML, JSON, or text payload immediately and record it in history. Requires a secret admin key; publishable mobile keys are rejected.",
    {
      productId: PRODUCT_ID_PARAM,
      platform: z.enum(["IOS", "Android"]),
      // Opaque: IAPKit owns this value space, so a stale enum here would
      // reject a format the server already accepts.
      format: kitTextParam("format").describe(
        "Payload format, currently toml, json, or text. Forwarded as-is for IAPKit to validate.",
      ),
      body: z
        .string()
        .max(MAX_CLIENT_PAYLOAD_BYTES)
        .describe(
          "Public app-readable payload body. The server enforces a 16 KiB UTF-8 limit and validates TOML/JSON.",
        ),
      expectedVersion: z.number().int().nonnegative().optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).setClientPayload({
            productId: args.productId,
            platform: args.platform,
            format: args.format,
            body: args.body,
            expectedVersion: args.expectedVersion,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 14. remove_client_payload — remove public product rules.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "remove_client_payload",
    "Remove a product's public client payload while retaining its monotonic revision history. Requires a secret admin key.",
    {
      productId: PRODUCT_ID_PARAM,
      platform: z.enum(["IOS", "Android"]),
      expectedVersion: z.number().int().nonnegative().optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).removeClientPayload({
            productId: args.productId,
            platform: args.platform,
            expectedVersion: args.expectedVersion,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 15. get_client_payload_draft — read the unpublished draft.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "get_client_payload_draft",
    "Read a product's unpublished client payload draft and its expectedDraftRevision. Apps never receive drafts.",
    {
      productId: PRODUCT_ID_PARAM,
      platform: z.enum(["IOS", "Android"]),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).getClientPayloadDraft({
            productId: args.productId,
            platform: args.platform,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 16. set_client_payload_draft — save a draft without publishing it.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "set_client_payload_draft",
    "Save a client payload draft. Apps keep receiving the published version until you publish.",
    {
      productId: PRODUCT_ID_PARAM,
      platform: z.enum(["IOS", "Android"]),
      format: kitTextParam("format").describe(
        "Payload format, currently toml, json, or text. Forwarded as-is for IAPKit to validate.",
      ),
      body: z.string().max(MAX_CLIENT_PAYLOAD_BYTES),
      expectedDraftRevision: z.number().int().nonnegative().optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).saveClientPayloadDraft({
            productId: args.productId,
            platform: args.platform,
            format: args.format,
            body: args.body,
            expectedDraftRevision: args.expectedDraftRevision,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 17. publish_client_payload — make the draft the published version.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "publish_client_payload",
    "Publish the saved draft as a new version that apps receive, and record it in history.",
    {
      productId: PRODUCT_ID_PARAM,
      platform: z.enum(["IOS", "Android"]),
      expectedVersion: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe(
          "Published version to replace. Defaults to the version the draft was saved on, so a newer publish is never overwritten.",
        ),
      expectedDraftRevision: z.number().int().nonnegative().optional(),
      note: z
        .string()
        .optional()
        .describe("Optional audit note, up to 500 characters."),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).publishClientPayload({
            productId: args.productId,
            platform: args.platform,
            expectedVersion: args.expectedVersion,
            expectedDraftRevision: args.expectedDraftRevision,
            note: args.note,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 18. get_client_payload_history — audit published versions.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "get_client_payload_history",
    "List the newest 50 published client payload versions without bodies, or pass version to read that version's body.",
    {
      productId: PRODUCT_ID_PARAM,
      platform: z.enum(["IOS", "Android"]),
      version: z.number().int().positive().optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        const client = withClient(args, extra);
        const target = { productId: args.productId, platform: args.platform };
        return ok(
          args.version === undefined
            ? await client.listClientPayloadHistory(target)
            : await client.getClientPayloadVersion({
                ...target,
                version: args.version,
              }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 19. rollback_client_payload — republish an older version.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "rollback_client_payload",
    "Republish a retained version's body as a new version. History stays append-only.",
    {
      productId: PRODUCT_ID_PARAM,
      platform: z.enum(["IOS", "Android"]),
      toVersion: z.number().int().positive(),
      expectedVersion: z.number().int().nonnegative().optional(),
      note: z
        .string()
        .optional()
        .describe("Optional audit note, up to 500 characters."),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).rollbackClientPayload({
            productId: args.productId,
            platform: args.platform,
            toVersion: args.toVersion,
            expectedVersion: args.expectedVersion,
            note: args.note,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 20. sync_products — enqueue App Store / Play Console sync.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "sync_products",
    "Enqueue an IAPKit product sync job for App Store Connect or Google Play. Use dryRun=true first to inspect what the sync would change; set dryRun=false only when the user explicitly asks to apply the store sync.",
    {
      platform: z.enum(["IOS", "Android"]),
      direction: z
        .enum(["pull", "push", "both", "purge-local"])
        .optional()
        .describe(
          "pull imports from the store, push writes IAPKit catalog rows to the store (including eligible Removed-row deletes), both does both, purge-local deletes kit's local catalog cache only.",
        ),
      dryRun: z
        .boolean()
        .optional()
        .describe("Defaults to true so store changes are previewed first."),
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
  // 21. sync_status — poll a product sync job.
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

  // ---------------------------------------------------------------------------
  // 22. list_deliveries — outbound webhook delivery history.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "list_deliveries",
    "List outbound webhook deliveries with their recent attempts, newest first. Page with nextCursor.",
    {
      status: z
        .enum(["pending", "delivering", "delivered", "failed"])
        .optional(),
      eventType: kitTextParam("eventType", MAX_KIT_ID_LENGTH).optional(),
      destinationId: kitTextParam(
        "destinationId",
        MAX_KIT_ID_LENGTH,
      ).optional(),
      eventId: kitTextParam("eventId", MAX_KIT_ID_LENGTH).optional(),
      limit: z.number().int().min(1).max(MAX_OPERATIONS_PAGE_SIZE).optional(),
      cursor: kitTextParam("cursor", MAX_PRODUCT_CURSOR_LENGTH).optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).listDeliveries({
            status: args.status,
            eventType: args.eventType,
            destinationId: args.destinationId,
            eventId: args.eventId,
            limit: args.limit,
            cursor: args.cursor,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 23. resend_delivery — redeliver one event to one destination.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "resend_delivery",
    "Re-send a delivered or failed webhook delivery with its original eventId, so receivers dedupe it. At most 30 per project per minute.",
    {
      deliveryId: kitTextParam("deliveryId", MAX_KIT_ID_LENGTH),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).resendDelivery(args.deliveryId),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 24. list_inbound_notifications — store notifications IAPKit received.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "list_inbound_notifications",
    "List store notifications IAPKit received, newest first, with applied state. Raw signed payloads are never returned.",
    {
      limit: z.number().int().min(1).max(MAX_OPERATIONS_PAGE_SIZE).optional(),
      cursor: kitTextParam("cursor", MAX_PRODUCT_CURSOR_LENGTH).optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).listInboundNotifications({
            limit: args.limit,
            cursor: args.cursor,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 25. resync_from_store — refresh one Apple or Google record.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "resync_from_store",
    "Re-read one Apple or Google purchase or subscription from the store and apply its current state. Pass exactly one id. Never changes the owner.",
    {
      purchaseId: kitTextParam("purchaseId", MAX_KIT_ID_LENGTH).optional(),
      subscriptionId: kitTextParam(
        "subscriptionId",
        MAX_KIT_ID_LENGTH,
      ).optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    WRITE_TOOL,
    async (args, extra) => {
      try {
        const target =
          args.purchaseId !== undefined && args.subscriptionId === undefined
            ? { purchaseId: args.purchaseId }
            : args.subscriptionId !== undefined && args.purchaseId === undefined
              ? { subscriptionId: args.subscriptionId }
              : null;
        if (!target) {
          return err(
            new Error("Pass exactly one of purchaseId or subscriptionId."),
          );
        }
        return ok(await withClient(args, extra).resyncFromStore(target));
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 26. user_timeline — one app user's purchases, subscriptions and events.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "user_timeline",
    "Look up one app user's purchases, subscriptions, commerce events and purchase issues, newest first.",
    {
      userId: USER_ID_PARAM,
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        return ok(await withClient(args, extra).userTimeline(args.userId));
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 27. list_purchase_issues — failed verifications and links.
  // ---------------------------------------------------------------------------
  registerTool(
    server,
    "list_purchase_issues",
    "List failed purchase verifications and links from the last 30 days, most recently seen first, with cause, count and correlationId. Rows carry an evidence fingerprint, never the token, JWS or receipt. Page with nextCursor.",
    {
      cause: z.enum(KIT_PURCHASE_ISSUE_CAUSES).optional(),
      store: z.enum(["apple", "google", "horizon", "amazon"]).optional(),
      productId: PRODUCT_ID_PARAM.optional().describe(
        "Matches the store-verified or the claimed product id.",
      ),
      appUserId: USER_ID_PARAM.optional(),
      from: ISO_TIME_PARAM.optional().describe(
        "ISO 8601 date-time; lastSeenAt at or after it.",
      ),
      to: ISO_TIME_PARAM.optional().describe(
        "ISO 8601 date-time; lastSeenAt at or before it.",
      ),
      limit: z.number().int().min(1).max(MAX_OPERATIONS_PAGE_SIZE).optional(),
      cursor: kitTextParam("cursor", MAX_PRODUCT_CURSOR_LENGTH).optional(),
      apiKey: OPTIONAL_API_KEY,
      baseUrl: OPTIONAL_BASE_URL,
    },
    READ_ONLY_TOOL,
    async (args, extra) => {
      try {
        return ok(
          await withClient(args, extra).listPurchaseIssues({
            cause: args.cause,
            store: args.store,
            productId: args.productId,
            appUserId: args.appUserId,
            from: args.from === undefined ? undefined : Date.parse(args.from),
            to: args.to === undefined ? undefined : Date.parse(args.to),
            limit: args.limit,
            cursor: args.cursor,
          }),
        );
      } catch (error) {
        return err(error, resolveApiKey(args, extra));
      }
    },
  );
}

function renderSetupSnippet(
  framework: SetupFramework,
  apiKey: string,
  productId: string,
): string {
  const apiKeyLiteral = codeStringLiteral(apiKey);
  const productIdLiteral = codeStringLiteral(productId);

  switch (framework) {
    case "expo":
    case "react-native":
      return `import { Platform } from 'react-native';
import {
  verifyPurchaseWithProvider,
  type Purchase,
} from '${framework === "expo" ? "expo-iap" : "react-native-iap"}';

const iapkitPublishableKey = ${apiKeyLiteral};
const expectedProductId = ${productIdLiteral};

export async function verifyAndGrant(purchase: Purchase) {
  const token = purchase.purchaseToken ?? '';
  const result = await verifyPurchaseWithProvider({
    provider: 'iapkit',
    iapkit: {
      apiKey: iapkitPublishableKey,
      includeClientPayload: true,
      ...(Platform.OS === 'ios'
        ? { apple: { jws: token } }
        : { google: { purchaseToken: token } }),
    },
  });

  const verified = result.iapkit;
  const allowedState =
    verified?.state === 'entitled' ||
    (Platform.OS === 'android' &&
      verified?.state === 'pending-acknowledgment');
  if (
    verified?.isValid === true &&
    allowedState &&
    verified.productId === purchase.productId &&
    verified.productId === expectedProductId
  ) {
    grantEntitlement(verified.productId);
    if (verified.clientPayload) applyPublicRules(verified.clientPayload);
  }
}`;
    case "flutter":
      return `import 'dart:io';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

const iapkitPublishableKey = ${apiKeyLiteral};

Future<void> verifyAndGrant(Purchase purchase) async {
  final result =
      await FlutterInappPurchase.instance.verifyPurchaseWithProvider(
    provider: PurchaseVerificationProvider.Iapkit,
    iapkit: RequestVerifyPurchaseWithIapkitProps(
      apiKey: iapkitPublishableKey,
      includeClientPayload: true,
      apple: Platform.isIOS
          ? RequestVerifyPurchaseWithIapkitAppleProps(
              jws: purchase.purchaseToken ?? '',
            )
          : null,
      google: Platform.isAndroid
          ? RequestVerifyPurchaseWithIapkitGoogleProps(
              purchaseToken: purchase.purchaseToken ?? '',
            )
          : null,
    ),
  );

  final verified = result.iapkit;
  final allowedState =
      verified?.state == IapkitPurchaseState.Entitled ||
      (Platform.isAndroid &&
          verified?.state == IapkitPurchaseState.PendingAcknowledgment);
  if (verified?.isValid == true &&
      allowedState &&
      verified?.productId == purchase.productId &&
      verified?.productId == ${productIdLiteral}) {
    grantEntitlement(verified!.productId!);
    if (verified.clientPayload != null) {
      applyPublicRules(verified.clientPayload!);
    }
  }
}`;
    case "kmp":
      return `import io.github.hyochan.kmpiap.*

suspend fun verifyAndGrant(purchase: Purchase, isIos: Boolean) {
    val result = kmpIapInstance.verifyPurchaseWithProvider(
        VerifyPurchaseWithProviderProps(
            provider = PurchaseVerificationProvider.Iapkit,
            iapkit = RequestVerifyPurchaseWithIapkitProps(
                apiKey = ${apiKeyLiteral},
                includeClientPayload = true,
                apple = if (isIos) {
                    RequestVerifyPurchaseWithIapkitAppleProps(
                        jws = purchase.purchaseToken.orEmpty(),
                    )
                } else null,
                google = if (!isIos) {
                    RequestVerifyPurchaseWithIapkitGoogleProps(
                        purchaseToken = purchase.purchaseToken.orEmpty(),
                    )
                } else null,
            ),
        ),
    )

    val verified = result.iapkit
    val verifiedProductId = verified?.productId
    val allowedState =
        verified?.state == IapkitPurchaseState.Entitled ||
            (!isIos && verified?.state == IapkitPurchaseState.PendingAcknowledgment)
    if (verified?.isValid == true &&
        allowedState &&
        verifiedProductId != null &&
        verifiedProductId == purchase.productId &&
        verifiedProductId == ${productIdLiteral}) {
        grantEntitlement(verifiedProductId)
        verified?.clientPayload?.let(::applyPublicRules)
    }
}`;
    case "godot":
      return `const Types = preload("res://addons/godot-iap/types.gd")

func verify_and_grant(purchase: Variant) -> void:
    var token = purchase.get("purchaseToken", "")
    var iapkit = {
        "apiKey": ${apiKeyLiteral},
        "includeClientPayload": true,
    }
    if OS.get_name() == "iOS":
        iapkit["apple"] = { "jws": token }
    else:
        iapkit["google"] = { "purchaseToken": token }

    var result = await GodotIapPlugin.verify_purchase_with_provider({
        "provider": "iapkit",
        "iapkit": iapkit,
    })
    var verified = result.iapkit
    var allowed_state = (
        verified != null
        and (
            verified.state == Types.IapkitPurchaseState.ENTITLED
            or (
                OS.get_name() != "iOS"
                and verified.state == Types.IapkitPurchaseState.PENDING_ACKNOWLEDGMENT
            )
        )
    )
    if (
        verified != null
        and verified.is_valid
        and allowed_state
        and verified.product_id == purchase.get("productId", "")
        and verified.product_id == ${productIdLiteral}
    ):
        grant_entitlement(verified.product_id)
        if verified.client_payload != null:
            apply_public_rules(verified.client_payload)`;
    case "ios":
      return `import OpenIAP

let iapkitApiKey = ${apiKeyLiteral}
let productId = ${productIdLiteral}
let iapStore = OpenIapStore()

try await iapStore.initConnection()
try await iapStore.fetchProducts(skus: [productId], type: .inApp)

if let purchase = try await iapStore.requestPurchase(sku: productId, type: .inApp),
   let jws = purchase.purchaseToken {
    let verification = try await iapStore.verifyPurchaseWithProvider(
        VerifyPurchaseWithProviderProps(
            iapkit: RequestVerifyPurchaseWithIapkitProps(
                apiKey: iapkitApiKey,
                apple: RequestVerifyPurchaseWithIapkitAppleProps(jws: jws),
                google: nil,
                includeClientPayload: true
            ),
            provider: .iapkit
        )
    )
    if verification?.isValid == true,
       verification?.state == .entitled,
       verification?.productId == purchase.productId,
       verification?.productId == productId {
        grantEntitlement(purchase.productId)
        if let payload = verification?.clientPayload {
            applyPublicRules(payload)
        }
    }
}`;
    case "android":
      return `import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.IapkitPurchaseState
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.PurchaseVerificationProvider
import dev.hyo.openiap.RequestPurchaseAndroidProps
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchasePropsByPlatforms
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitGoogleProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps
import dev.hyo.openiap.VerifyPurchaseWithProviderProps
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private val openIap by lazy { OpenIapModule(this) }
    private val iapkitApiKey = ${apiKeyLiteral}
    private val productId = ${productIdLiteral}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        openIap.setActivity(this)
        openIap.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { purchase ->
            lifecycleScope.launch {
                val token = purchase.purchaseToken ?: return@launch
                val verification = openIap.verifyPurchaseWithProvider(
                    VerifyPurchaseWithProviderProps(
                        iapkit = RequestVerifyPurchaseWithIapkitProps(
                            apiKey = iapkitApiKey,
                            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                                purchaseToken = token
                            ),
                            includeClientPayload = true
                        ),
                        provider = PurchaseVerificationProvider.Iapkit
                    )
                ).iapkit
                val verifiedProductId = verification?.productId
                val allowedState =
                    verification?.state == IapkitPurchaseState.Entitled ||
                        verification?.state == IapkitPurchaseState.PendingAcknowledgment
                if (verification?.isValid == true &&
                    allowedState &&
                    verifiedProductId != null &&
                    verifiedProductId == purchase.productId &&
                    verifiedProductId == productId) {
                    grantEntitlement(verifiedProductId)
                    verification?.clientPayload?.let(::applyPublicRules)
                }
            }
        })

        lifecycleScope.launch {
            openIap.initConnection(null)
            openIap.fetchProducts(
                ProductRequest(skus = listOf(productId), type = ProductQueryType.InApp)
            )
        }
    }

    fun buyPremium() {
        lifecycleScope.launch {
            openIap.setActivity(this@MainActivity)
            openIap.requestPurchase(
                RequestPurchaseProps(
                    request = RequestPurchaseProps.Request.Purchase(
                        RequestPurchasePropsByPlatforms(
                            google = RequestPurchaseAndroidProps(skus = listOf(productId))
                        )
                    ),
                    type = ProductQueryType.InApp
                )
            )
        }
    }
}`;
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

// The metric definitions an assistant needs to read the numbers correctly.
const REVENUE_DEFINITIONS = {
  timezone: "UTC days and months.",
  revenue:
    "revenueMicros: gross store list price of paid charges, before store fees and refunds; IAPKit never converts currencies. netRevenueMicros subtracts store-reported refunds. Google reports a base plan's recurring price, so a discounted introductory phase is booked at that list price.",
  purchaseEvents:
    "Paid charges: direct paid starts, trial conversions, renewals and billing recoveries. Free trial starts and restores are not purchases.",
  trials:
    "trialStarts: free trials started. trialConversions: the paid charge that ends a free trial; a purchase after a lapsed trial is a direct paid start.",
  churn:
    "cancellations: auto-renew turned off (less turned back on); access continues until the paid period ends. expirations: paid access actually ended; a free trial that ended unpaid is not counted.",
  refunds:
    "refunds: store refunds less refund reversals, one per refund. Revocations are not refunds: Apple's are Family Sharing removals, and Play's accompany a voided purchase that is counted instead. Google refunds carry no amount.",
  environment:
    "Production only unless environment is sandbox. Rows before definitionsFromDay mix sandbox into production and have no trial split.",
  trialSplit:
    "Days before trialSplitFromDay omit trialStarts, trialConversions, directPaidStarts, activeTrials and expirations, and their totals here cover later days only; on those days Google free trials count as paid starts and Apple refund reversals as new subscriptions.",
  lateEvents:
    "pendingLateEvents: notifications that arrived after their day's rollup; a catch-up recompute folds them in.",
  cohorts:
    "Paid cohort: UTC month of the first paid charge. retentionRates[k]: members with paid access at the end of month k. realizedLtvMicros: observed gross revenue per member through observedThrough, never projected. trialToPaidRate: conversions over resolved trials of that month.",
} as const;

type RevenueTotals = {
  revenueMicros: number;
  refundedMicros: number;
  netRevenueMicros: number;
  purchaseEvents: number;
  newSubs: number;
  trialStarts: number;
  trialConversions: number;
  directPaidStarts: number;
  renewals: number;
  cancellations: number;
  expirations: number;
  refunds: number;
};

function summarizeRevenueMetrics(
  metrics: KitRevenueMetricsResponse,
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

  const totalsByCurrency = new Map<string, RevenueTotals>();
  const totalsByProduct = new Map<
    string,
    { purchaseEvents: number; revenueMicrosByCurrency: Record<string, number> }
  >();
  const totalsByPlatform = new Map<
    "IOS" | "Android",
    { purchaseEvents: number; revenueMicrosByCurrency: Record<string, number> }
  >();

  for (const row of rows) {
    const trialStarts = row.trialStarts ?? 0;
    const trialConversions = row.trialConversions ?? 0;
    const refundedMicros = row.refundedMicros ?? 0;
    const purchaseEvents =
      row.newSubs - trialStarts + row.renewals + trialConversions;
    const currencyTotal = totalsByCurrency.get(row.currency) ?? {
      revenueMicros: 0,
      refundedMicros: 0,
      netRevenueMicros: 0,
      purchaseEvents: 0,
      newSubs: 0,
      trialStarts: 0,
      trialConversions: 0,
      directPaidStarts: 0,
      renewals: 0,
      cancellations: 0,
      expirations: 0,
      refunds: 0,
    };
    currencyTotal.revenueMicros += row.revenueMicros;
    currencyTotal.refundedMicros += refundedMicros;
    currencyTotal.netRevenueMicros += row.revenueMicros - refundedMicros;
    currencyTotal.purchaseEvents += purchaseEvents;
    currencyTotal.newSubs += row.newSubs;
    currencyTotal.trialStarts += trialStarts;
    currencyTotal.trialConversions += trialConversions;
    currencyTotal.directPaidStarts += row.directPaidStarts ?? 0;
    currencyTotal.renewals += row.renewals;
    currencyTotal.cancellations += row.cancellations;
    currencyTotal.expirations += row.expirations ?? 0;
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

  const cohorts = metrics.cohorts
    ?.filter(
      (cohort) => !filters.currency || cohort.currency === filters.currency,
    )
    .map((cohort) => {
      const resolvedTrials = cohort.trialStarts - cohort.trialsPending;
      return {
        month: cohort.month,
        currency: cohort.currency,
        members: cohort.members,
        realizedLtvMicros: cohort.realizedLtvMicros,
        netRealizedLtvMicros:
          cohort.members > 0
            ? Math.round(
                (cohort.revenueMicros - cohort.refundedMicros) / cohort.members,
              )
            : 0,
        retentionRates: cohort.retained.map((count) =>
          cohort.members > 0 ? count / cohort.members : null,
        ),
        trialStarts: cohort.trialStarts,
        trialConversions: cohort.trialConversions,
        trialsPending: cohort.trialsPending,
        trialToPaidRate:
          resolvedTrials > 0 ? cohort.trialConversions / resolvedTrials : null,
        observedThrough: cohort.observedThrough,
      };
    });

  return {
    range: filters,
    environment: metrics.environment,
    dataState: metrics.dataState,
    lastRunAt:
      metrics.lastRunAt === undefined
        ? null
        : new Date(metrics.lastRunAt).toISOString(),
    definitionsFromDay: metrics.definitionsFromDay ?? null,
    trialSplitFromDay: metrics.trialSplitFromDay ?? null,
    pendingLateEvents: metrics.pendingLateEvents,
    rowCount: rows.length,
    totalsByCurrency: Object.fromEntries(totalsByCurrency),
    totalsByProduct: Object.fromEntries(totalsByProduct),
    totalsByPlatform: Object.fromEntries(totalsByPlatform),
    ...(cohorts ? { cohorts } : {}),
    availableFilters: {
      currencies: metrics.currencies,
      productIds: metrics.productIds,
      platforms: metrics.platforms,
    },
    truncated: metrics.truncated,
    definitions: REVENUE_DEFINITIONS,
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

function stringifyError(e: unknown, apiKey?: string): string {
  const message = e instanceof Error ? e.message : String(e);
  return String(redactSecrets(message, apiKey));
}
