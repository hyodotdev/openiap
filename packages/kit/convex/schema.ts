import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { harmonizedPurchaseStateValidator } from "./purchases/purchaseState";

// Redefine the `users` table (same shape as @convex-dev/auth's authTables.users)
// but re-declare indexes so the TypeScript data model surfaces them. Spreading
// `authTables` loses the index literals through a wide generic, which caused
// `.withIndex("email", ...)` to be rejected.
const usersTable = defineTable({
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  phone: v.optional(v.string()),
  phoneVerificationTime: v.optional(v.number()),
  isAnonymous: v.optional(v.boolean()),
})
  .index("email", ["email"])
  .index("phone", ["phone"]);

export const purchaseStoreValidator = v.union(
  v.literal("apple"),
  v.literal("google"),
  v.literal("horizon"),
);

export const purchaseRequestDataValidator = v.union(
  v.object({
    store: v.literal("apple"),
    jws: v.string(),
  }),
  v.object({
    store: v.literal("google"),
    purchaseToken: v.string(),
  }),
  // Meta Horizon (Quest / VR): the client SDK doesn't return a Google-
  // or Apple-style opaque receipt; instead Meta's Graph API verifies
  // an entitlement by (userId, sku) with a server-side App Access
  // Token the IAPKit server holds. See
  // https://developers.meta.com/horizon/documentation/native/ps-iap
  v.object({
    store: v.literal("horizon"),
    userId: v.string(),
    sku: v.string(),
  }),
);

// The schema is the source of truth for the database structure.
const schema = defineSchema({
  ...authTables,
  users: usersTable,

  // Organizations table
  organizations: defineTable({
    name: v.string(),
    slug: v.string(), // URL-friendly identifier - UNIQUE enforced in mutations
    avatarUrl: v.optional(v.string()),
    avatarFileId: v.optional(v.id("_storage")),

    // Billing
    billingEmail: v.optional(v.string()),
    taxId: v.optional(v.union(v.string(), v.null())),
    // Stripe tax-id type, e.g. "eu_vat", "us_ein", "gb_vat", etc.
    // See https://stripe.com/docs/api/customer_tax_ids/object for the
    // full list. Omitted rows default to "eu_vat" at the point of use
    // (unchanged behavior from before this field was introduced).
    taxIdType: v.optional(v.union(v.string(), v.null())),
    stripeTaxIdId: v.optional(v.union(v.string(), v.null())),
    subscriptionTier: v.optional(
      v.union(
        v.literal("developer"),
        v.literal("pro"),
        v.literal("enterprise"),
      ),
    ),
    monthlyRequestCount: v.optional(v.number()),
    monthlyRequestLimit: v.optional(v.number()),
    stripeCustomerId: v.optional(v.union(v.string(), v.null())),
    stripeSubscriptionId: v.optional(v.union(v.string(), v.null())),
    stripePriceId: v.optional(v.union(v.string(), v.null())),
    stripeBaseSubscriptionItemId: v.optional(v.union(v.string(), v.null())),
    stripeMeteredSubscriptionItemId: v.optional(v.union(v.string(), v.null())),
    // Legacy Stripe fields — kept as unused strings so existing prod
    // records validate after the free-for-everyone transition. Scheduled
    // for removal in a follow-up schema cleanup PR.
    stripeSubscriptionStatus: v.optional(v.union(v.string(), v.null())),
    stripeCancelAtPeriodEnd: v.optional(v.union(v.boolean(), v.null())),
    stripeCurrentPeriodEnd: v.optional(v.union(v.number(), v.null())),
    stripeTrialEnd: v.optional(v.union(v.number(), v.null())),
    stripeCanceledAt: v.optional(v.union(v.number(), v.null())),
    defaultPaymentMethodId: v.optional(v.union(v.string(), v.null())),
    defaultPaymentMethodBrand: v.optional(v.union(v.string(), v.null())),
    defaultPaymentMethodLast4: v.optional(v.union(v.string(), v.null())),
    defaultPaymentMethodExpMonth: v.optional(v.union(v.number(), v.null())),
    defaultPaymentMethodExpYear: v.optional(v.union(v.number(), v.null())),

    // Deletion orchestration: when a user who is the sole member of this
    // org initiates `deleteAccount`, the outer membership-drain mutation
    // flags the org here; the paginated drain action then walks
    // projects / purchases / files / etc. under the flag until empty and
    // finally removes the org row.
    pendingDeletion: v.optional(v.boolean()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"])
    .index("by_pending_deletion", ["pendingDeletion"]),

  // Organization members table
  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),

    // Timestamps
    joinedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_org_and_user", ["organizationId", "userId"]),

  // User profiles table - extends auth users with app-specific data
  userProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),

    // Preferences
    locale: v.optional(
      v.union(v.literal("en"), v.literal("ko"), v.literal("ja")),
    ),

    // Login tracking
    loginMethodType: v.optional(
      v.union(
        v.literal("email"),
        v.literal("github"),
        v.literal("email-github"),
        v.literal("none"),
      ),
    ),
    lastLoginMethod: v.optional(v.string()),
    lastLoginAt: v.optional(v.number()),
    githubUsername: v.optional(v.string()),

    // Current organization context
    currentOrganizationId: v.optional(v.id("organizations")),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_display_name", ["displayName"])
    .index("by_current_organization", ["currentOrganizationId"]),

  // Projects table (previously userApplications)
  projects: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(), // URL-friendly identifier within org - UNIQUE per org enforced in mutations
    apiKey: v.string(), // Deprecated - will be removed after migration

    // Platform
    platform: v.optional(
      v.union(
        v.literal("react-native"),
        v.literal("flutter"),
        v.literal("kmp"),
        v.literal("android"),
        v.literal("ios"),
        v.literal("node"),
        v.literal("php"),
        v.literal("dotnet"),
        v.literal("unity"),
        v.literal("web"),
        v.literal("other"),
      ),
    ),
    androidPackageName: v.optional(v.string()),
    iosBundleId: v.optional(v.string()),
    iosAppAppleId: v.optional(v.number()),
    // App Store Server API credentials — issued under "Users and
    // Access → Integrations → In-App Purchase". Used by the receipt
    // verifier in `purchases/ios.ts`. Pairs with the `.p8` file
    // stored as `purpose: "apple_p8_key"`.
    iosAppStoreIssuerId: v.optional(v.string()),
    iosAppStoreKeyId: v.optional(v.string()),
    // App Store Connect API credentials — issued under "Users and
    // Access → Integrations → App Store Connect API → Team Keys"
    // (or Individual Keys). Used by `products/asc.ts` push-sync.
    // Genuinely a different key from the App Store Server API one;
    // Apple scopes them separately at the gateway. Pairs with the
    // `.p8` file stored as `purpose: "apple_p8_asc_api_key"`. Both
    // are optional so existing iOS-only-receipt-verification
    // projects keep working without push-sync.
    iosAscIssuerId: v.optional(v.string()),
    iosAscKeyId: v.optional(v.string()),

    // Meta Horizon Billing (Quest / Meta VR). Piggybacks on the Android
    // configuration card in the UI because the client SDK is
    // Google-Play-Billing-compatible — the verification endpoint is
    // separate (Meta Graph API `verify_entitlement`) and requires an
    // App ID + App Secret. The IAPKit server combines these into an
    // `OC|$APP_ID|$APP_SECRET` app access token per request, so the
    // client never sees the secret. Kept optional and gated by
    // horizonEnabled so existing Android-only projects aren't forced
    // to carry empty Horizon fields.
    horizonEnabled: v.optional(v.boolean()),
    // Widen to `v.union(v.string(), v.null())` so `ctx.db.patch({ ...: null })`
    // actually clears the value. Convex treats `undefined` in a patch as a
    // no-op (leave field unchanged), so the "toggle Horizon off wipes stale
    // credentials" path needs explicit `null`s.
    horizonAppId: v.optional(v.union(v.string(), v.null())),
    horizonAppSecret: v.optional(v.union(v.string(), v.null())),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_api_key", ["apiKey"])
    .index("by_org_and_slug", ["organizationId", "slug"])
    // Horizon polling reconciler iterates only the projects that
    // opted into Meta Horizon billing — without this index the cron
    // would full-scan every project on each tick.
    .index("by_horizon_enabled", ["horizonEnabled"]),

  // API Keys table - Multiple API keys per project
  apiKeys: defineTable({
    projectId: v.id("projects"),
    organizationId: v.id("organizations"), // Denormalized for faster queries

    // Key information
    key: v.string(), // The actual API key
    name: v.string(), // User-friendly name for the key
    description: v.optional(v.string()),

    permissions: v.optional(v.array(v.string())), // Future: specific permissions

    // Usage tracking
    lastUsedAt: v.optional(v.number()),
    usageCount: v.optional(v.number()),

    // Status
    isActive: v.boolean(),

    // Metadata
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_organization", ["organizationId"])
    .index("by_key", ["key"])
    .index("by_project_and_active", ["projectId", "isActive"])
    .index("by_created_at", ["createdAt"]),

  // Files table - secure file storage with no client-side access
  files: defineTable({
    // Ownership
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    uploadedBy: v.id("users"),

    // File information
    storageId: v.id("_storage"), // Convex storage ID - never exposed to client
    fileName: v.string(),
    fileType: v.string(), // MIME type
    fileSize: v.number(), // Size in bytes

    // Purpose/category. Apple distributes two distinct .p8 key kinds
    // and they're NOT interchangeable:
    //   - `apple_p8_key`         — App Store Server API (the
    //     "In-App Purchase Key"). Used for receipt verification.
    //   - `apple_p8_asc_api_key` — App Store Connect API (the "Team
    //     Key" / "Individual Key"). Used for ASC REST endpoints
    //     (catalog list / create / patch). Push-sync calls these.
    // Uploading the wrong kind for either purpose returns 401.
    purpose: v.union(
      v.literal("apple_p8_key"),
      v.literal("apple_p8_asc_api_key"),
      v.literal("android_service_account"),
    ),
    description: v.optional(v.string()),

    // Metadata
    metadata: v.optional(v.any()), // Additional metadata specific to file type

    // Security
    isInternal: v.boolean(), // If true, only accessible via internalAction
    lastAccessedAt: v.optional(v.number()),
    accessCount: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_project", ["projectId"])
    .index("by_uploader", ["uploadedBy"])
    .index("by_org_and_purpose", ["organizationId", "purpose"])
    .index("by_storage_id", ["storageId"])
    .index("by_created_at", ["createdAt"]),

  // Purchases table - unified receipt storage
  purchases: defineTable({
    projectId: v.id("projects"),
    store: purchaseStoreValidator,
    applicationId: v.string(), // bundleId or packageName
    remoteId: v.optional(v.string()),
    requestData: purchaseRequestDataValidator,
    remoteResponse: v.optional(v.string()),
    requestIp: v.optional(v.string()),
    state: harmonizedPurchaseStateValidator,
    isValid: v.optional(v.boolean()), // computed from state at time of verification
    verificationDurationMs: v.optional(v.number()),
    // Extracted on write so the list query doesn't re-parse
    // `remoteResponse` for every page item.
    productId: v.optional(v.string()),
    // Google Play order identifier, extracted from `remoteResponse` on
    // write. Used as a secondary dedup key for Google receipts because
    // the client's `purchaseToken` is NOT stable for the same logical
    // order (Google reissues tokens between re-validations and state
    // transitions, which is the 3x inflation Adam observed on Black
    // Dust). `orderId` is stable per transaction, so when present it
    // collapses token reissues onto a single row. See
    // `savePurchaseInternal` for the write-path dedup order:
    // (projectId, remoteId) → (projectId, applicationId, orderId).
    orderId: v.optional(v.string()),
    // Sentinel used by the `backfillPurchaseStatsFromPurchases`
    // migration. New rows from `savePurchaseInternal` are created
    // with `statsCounted: true` so the migration skips them; the
    // migration flips it true for legacy rows after applying the
    // delta to `purchaseStats`.
    statsCounted: v.optional(v.boolean()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_store", ["projectId", "store"])
    .index("by_project_state_isValid", ["projectId", "state", "isValid"])
    .index("by_project_isValid", ["projectId", "isValid"])
    .index("by_project_updatedAt", ["projectId", "updatedAt"])
    .index("by_project_verificationDurationMs", [
      "projectId",
      "verificationDurationMs",
    ])
    .index("by_application", ["applicationId"])
    .index("by_project_and_remote", ["projectId", "remoteId"])
    .index("by_project_app_orderId", ["projectId", "applicationId", "orderId"])
    .searchIndex("search_request_ip_by_project", {
      searchField: "requestIp",
      filterFields: ["projectId"],
    }),

  // Maintained per-project purchase counters. Updated incrementally by the
  // purchase save / update / invalidate paths and by the project-delete
  // cascade, so dashboard reads are O(1) instead of scanning every receipt.
  purchaseStats: defineTable({
    projectId: v.id("projects"),
    // Denormalized for org-level aggregations without scanning projects.
    // Optional for widen phase; backfill populates existing rows, new
    // inserts always include it.
    organizationId: v.optional(v.id("organizations")),
    total: v.number(),
    apple: v.number(),
    google: v.number(),
    // Count of distinct Google `orderId`s present on this project's
    // `purchases` rows. Diverges from `google` when the table carries
    // rows without an `orderId` (e.g. pending-acknowledgement responses
    // or errors) — those inflate `google` but not `googleOrders`. The
    // dashboard "Google Play" card reads this field so customers see
    // logical Play Console orders instead of validation-call counts.
    // Widen phase: optional during rollout; backfill + recompute
    // populate existing rows, new writes always include it.
    googleOrders: v.optional(v.number()),
    valid: v.number(),
    invalid: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_organization", ["organizationId"]),

  stripeEvents: defineTable({
    eventId: v.string(),
    type: v.string(),
    organizationId: v.optional(v.id("organizations")),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_event_id", ["eventId"])
    .index("by_organization", ["organizationId"]),

  meteredUsageAccruals: defineTable({
    organizationId: v.id("organizations"),
    pendingQuantity: v.number(),
    firstEventAt: v.number(),
    lastEventAt: v.number(),
    lastSyncAttemptAt: v.optional(v.union(v.number(), v.null())),
    lastError: v.optional(v.union(v.string(), v.null())),
    // In-flight Stripe meter-event batch. Set when a sync attempt starts;
    // cleared after the post-send mutation commits. On retry, these
    // preserve the original Stripe `identifier` so Stripe dedupes even if
    // new usage arrived between attempts.
    inFlightSyncId: v.optional(v.union(v.string(), v.null())),
    inFlightQuantity: v.optional(v.union(v.number(), v.null())),
    inFlightLastEventAt: v.optional(v.union(v.number(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_pending_quantity", ["pendingQuantity"]),

  // Tiny KV state for internal cron jobs. Currently used by
  // cleanupIncompleteUsers to persist its cursor (`_creationTime` of
  // the last fully-processed user) across cron ticks. Without this,
  // every tick walked from the oldest user — once enough legitimate
  // users had aged past 24h, the read budget was exhausted on them
  // before the loop ever reached actually-incomplete users behind
  // them.
  cronState: defineTable({
    jobName: v.string(),
    cursor: v.number(),
    updatedAt: v.number(),
  }).index("by_jobName", ["jobName"]),

  // Normalized lifecycle webhook events ingested from Apple ASN v2 and
  // Google RTDN. Mirrors the GraphQL `WebhookEvent` shape defined in
  // `packages/gql/src/webhook.graphql` — kit's Subscription endpoint
  // streams rows from this table to authenticated clients, and the
  // `webhookEventsSince` query backfills events that occurred while a
  // client's WebSocket was closed.
  //
  // Retention: rows are pruned by the `pruneWebhookEvents` cron after
  // 30 days. The replay window matches `webhookEventsSince` so clients
  // returning from a long offline period can still reconcile.
  webhookEvents: defineTable({
    projectId: v.id("projects"),
    type: v.union(
      v.literal("SubscriptionStarted"),
      v.literal("SubscriptionRenewed"),
      v.literal("SubscriptionExpired"),
      v.literal("SubscriptionInGracePeriod"),
      v.literal("SubscriptionInBillingRetry"),
      v.literal("SubscriptionRecovered"),
      v.literal("SubscriptionCanceled"),
      v.literal("SubscriptionUncanceled"),
      v.literal("SubscriptionRevoked"),
      v.literal("SubscriptionPriceChange"),
      v.literal("SubscriptionProductChanged"),
      v.literal("SubscriptionPaused"),
      v.literal("SubscriptionResumed"),
      v.literal("PurchaseRefunded"),
      v.literal("PurchaseConsumptionRequest"),
      v.literal("TestNotification"),
    ),
    source: v.union(
      v.literal("AppleAppStoreServerNotificationsV2"),
      v.literal("GooglePlayRealTimeDeveloperNotifications"),
    ),
    platform: v.union(v.literal("IOS"), v.literal("Android")),
    environment: v.union(
      v.literal("Production"),
      v.literal("Sandbox"),
      v.literal("Xcode"),
    ),
    purchaseToken: v.string(),
    // Original notification id from the store (ASN v2 `notificationUUID`
    // or RTDN Pub/Sub `messageId`). Surfaced as the GraphQL `id` field
    // for clients and used to correlate events during pruning.
    sourceNotificationId: v.string(),
    productId: v.optional(v.string()),
    subscriptionState: v.optional(
      v.union(
        v.literal("Active"),
        v.literal("InGracePeriod"),
        v.literal("InBillingRetry"),
        v.literal("Expired"),
        v.literal("Revoked"),
        v.literal("Refunded"),
        v.literal("Paused"),
        v.literal("Unknown"),
      ),
    ),
    expiresAt: v.optional(v.number()),
    renewsAt: v.optional(v.number()),
    cancellationReason: v.optional(
      v.union(
        v.literal("UserCanceled"),
        v.literal("BillingError"),
        v.literal("PriceIncreaseDeclined"),
        v.literal("ProductUnavailable"),
        v.literal("Refunded"),
        v.literal("Other"),
      ),
    ),
    currency: v.optional(v.string()),
    priceAmountMicros: v.optional(v.number()),
    rawSignedPayload: v.optional(v.string()),
    occurredAt: v.number(),
    receivedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_purchase_token", ["purchaseToken"])
    .index("by_project_and_received", ["projectId", "receivedAt"])
    .index("by_received_at", ["receivedAt"])
    // Lookup helper used by the SSE stream's `Last-Event-ID` cursor
    // resolution. The reconnect cursor needs to translate a stable
    // notification id back to its `receivedAt` regardless of whether
    // the event is in the first 500 or the 50,000th. A direct index
    // hit is O(log n) vs O(n/page) for the prior linear scan.
    .index("by_project_and_notification_id", [
      "projectId",
      "sourceNotificationId",
    ]),

  // Dedup table for webhook payloads. Insertion uses
  // `(source, sourceNotificationId)` as the natural key; duplicates
  // detected here cause kit to silently ACK the upstream request with
  // 200 without re-emitting the event, matching Apple's documented
  // expectation that ASN may retry the same notification on transient
  // 5xx and Google's at-least-once Pub/Sub delivery contract.
  webhookIdempotencyKeys: defineTable({
    source: v.union(v.literal("apple"), v.literal("google")),
    sourceNotificationId: v.string(),
    eventId: v.optional(v.id("webhookEvents")),
    firstSeenAt: v.number(),
  }).index("by_source_and_id", ["source", "sourceNotificationId"]),

  // Authoritative per-(project, originalTransactionId) subscription record.
  // Mirrors the spec from `packages/gql/src/webhook.graphql` and the role
  // played by onesub's `onesub_subscriptions` table. State transitions are
  // driven by webhook events through `applySubscriptionEvent`.
  //
  // Why per-`originalTransactionId` (Apple) / `purchaseToken` (Google) and
  // not per-`(userId, productId)`: a single user can hold multiple historical
  // entitlements (resub after expiry, cross-grade, family-shared); the
  // store-issued purchase id is the only stable handle that survives all
  // transitions. Entitlement evaluation aggregates by user as needed.
  subscriptions: defineTable({
    projectId: v.id("projects"),
    purchaseToken: v.string(),
    userId: v.optional(v.string()),
    productId: v.string(),
    platform: v.union(v.literal("IOS"), v.literal("Android")),
    state: v.union(
      v.literal("Active"),
      v.literal("InGracePeriod"),
      v.literal("InBillingRetry"),
      v.literal("Expired"),
      v.literal("Revoked"),
      v.literal("Refunded"),
      v.literal("Paused"),
      v.literal("Unknown"),
    ),
    expiresAt: v.optional(v.number()),
    renewsAt: v.optional(v.number()),
    willRenew: v.optional(v.boolean()),
    cancellationReason: v.optional(
      v.union(
        v.literal("UserCanceled"),
        v.literal("BillingError"),
        v.literal("PriceIncreaseDeclined"),
        v.literal("ProductUnavailable"),
        v.literal("Refunded"),
        v.literal("Other"),
      ),
    ),
    currency: v.optional(v.string()),
    priceAmountMicros: v.optional(v.number()),
    startedAt: v.number(),
    updatedAt: v.number(),
    lastEventId: v.optional(v.id("webhookEvents")),
  })
    .index("by_project_and_token", ["projectId", "purchaseToken"])
    .index("by_project_and_user", ["projectId", "userId"])
    .index("by_project_and_state", ["projectId", "state"])
    .index("by_project_and_updated", ["projectId", "updatedAt"])
    .index("by_project_and_product", ["projectId", "productId"])
    // Composite index for the (state + productId) filter combination
    // in listSubscriptions. Without it, the prior over-fetch heuristic
    // could miss matching rows past the take() boundary on projects
    // with thousands of subs in the same state.
    .index("by_project_and_state_and_product", [
      "projectId",
      "state",
      "productId",
    ]),

  // Daily revenue metrics rollup keyed by (projectId, day, productId,
  // currency). Populated by `recomputeRevenueMetrics` cron (recomputes
  // the trailing window from `subscriptions` so late-arriving webhook
  // corrections are reflected). The dashboard reads from here to avoid
  // scanning the full events log on every page render.
  //
  // Currency is part of the row key because the same SKU can sell in
  // multiple storefront currencies on the same UTC day — keying only
  // by (projectId, day, productId) would either mix incompatible
  // `revenueMicros` totals or have one currency overwrite another,
  // both of which produce wrong dashboard numbers for multi-region
  // apps. Aggregating across currencies is a presentation-layer
  // concern (FX conversion happens in the UI, with whatever rates the
  // operator picks).
  revenueMetricsDaily: defineTable({
    projectId: v.id("projects"),
    day: v.string(), // ISO date (YYYY-MM-DD), UTC
    productId: v.string(),
    currency: v.string(),
    activeSubs: v.number(),
    newSubs: v.number(),
    renewals: v.number(),
    cancellations: v.number(),
    refunds: v.number(),
    revenueMicros: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_and_day_and_currency", ["projectId", "day", "currency"])
    .index("by_project_and_product_and_day_and_currency", [
      "projectId",
      "productId",
      "day",
      "currency",
    ]),

  // Unified product catalog. Mirrors what onesub holds in @onesub/providers
  // — the subset of App Store Connect / Play Console that kit can read /
  // create / update on the project owner's behalf. The auth-credential
  // payloads themselves stay in `files` (existing kit pattern); this row is
  // just the cached product metadata.
  products: defineTable({
    projectId: v.id("projects"),
    productId: v.string(),
    platform: v.union(v.literal("IOS"), v.literal("Android")),
    type: v.union(
      v.literal("Subscription"),
      v.literal("NonConsumable"),
      v.literal("Consumable"),
    ),
    title: v.string(),
    description: v.optional(v.string()),
    priceAmountMicros: v.optional(v.number()),
    currency: v.optional(v.string()),
    state: v.union(
      v.literal("Draft"),
      v.literal("Ready"),
      v.literal("Active"),
      v.literal("Removed"),
    ),
    // Subscription billing period. ISO-8601-ish duration the ASC + Play
    // push paths both accept (`P1W` / `P1M` / `P2M` / `P3M` / `P6M` /
    // `P1Y`). Optional because non-subscription types don't use it.
    // The push actions translate this to ASC `subscriptionPeriod` enum
    // (`ONE_WEEK` / `ONE_MONTH` / `TWO_MONTHS` / …) and Play
    // `autoRenewingBasePlanType.billingPeriodDuration`. Without this
    // field, the prior implementation silently created every
    // subscription as ONE_MONTH / P1M regardless of intent.
    billingPeriod: v.optional(
      v.union(
        v.literal("P1W"),
        v.literal("P1M"),
        v.literal("P2M"),
        v.literal("P3M"),
        v.literal("P6M"),
        v.literal("P1Y"),
      ),
    ),
    // Subscription Group (ASC concept; Play has no first-class
    // equivalent so these stay null for Android rows). All
    // subscriptions in the same group are mutually exclusive on
    // Apple's side — the user can switch between Premium / Premium
    // Year via in-app upgrade/downgrade, but cannot hold both. Kit
    // surfaces this in the dashboard so the operator can see at a
    // glance which subs share a group, and downstream paywalls can
    // pick a default selection within a group. `subscriptionGroupId`
    // is Apple's internal resource id; `subscriptionGroupName` is the
    // human-readable referenceName the operator sees in ASC.
    subscriptionGroupId: v.optional(v.string()),
    subscriptionGroupName: v.optional(v.string()),
    // Captures the *non-base* monetization variants attached to a
    // subscription: Apple introductory offers (free trial / pay as
    // you go / pay up front) and Play base plan offers (same kinds,
    // different shape). Stored as a generic shape so both stores can
    // upsert without branching, and the dashboard can render badges
    // ("7-day free trial", "$4.99 intro for 3 months") without
    // re-deriving from raw store responses.
    offers: v.optional(
      v.array(
        v.object({
          // Identifier from the store: ASC offer id (eyJ...) for
          // introductoryOffer / promotionalOffer, or Play's
          // basePlanId+offerId composite for offers.
          id: v.string(),
          kind: v.union(
            v.literal("FreeTrial"),
            v.literal("IntroPayUpFront"),
            v.literal("IntroPayAsYouGo"),
            v.literal("PromotionalOffer"),
            v.literal("BasePlan"),
          ),
          // ISO-8601 duration the offer covers (e.g. "P7D", "P3M").
          // For BasePlan rows this is the recurring billing period.
          duration: v.optional(v.string()),
          // Number of billing periods the discounted/free price
          // applies for (Apple's `numberOfPeriods`). Free trials and
          // pay-up-front intros use 1; pay-as-you-go uses N.
          numberOfPeriods: v.optional(v.number()),
          priceAmountMicros: v.optional(v.number()),
          currency: v.optional(v.string()),
        }),
      ),
    ),
    // Free-form note for App Store review. Maps to ASC's `reviewNote`
    // attribute on inAppPurchases / subscriptions and is the field
    // Apple's reviewer reads alongside the screenshot to understand
    // how to trigger / verify the IAP. Length cap is 4000 chars on
    // ASC's side; we don't enforce here so the operator gets Apple's
    // own validation message if they exceed it.
    reviewNote: v.optional(v.string()),
    storeRef: v.optional(v.string()),
    syncedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    // Lookup row by (projectId, platform, productId). Apps commonly
    // ship the SAME productId on both iOS and Android (e.g.
    // `dev.hyo.martie.premium` exists in both stores), so the
    // (projectId, productId)-only index would have collisions and
    // silently flip an existing row's platform on sync. Including
    // platform in the natural key keeps each store's catalog row
    // separate.
    .index("by_project_and_platform_and_product", [
      "projectId",
      "platform",
      "productId",
    ])
    .index("by_project_and_platform", ["projectId", "platform"]),

  // Paywall configurations served by `/v1/paywalls/{id}` for in-app
  // WebView. Hand-authored or generated by the MCP `add_paywall` tool.
  paywalls: defineTable({
    projectId: v.id("projects"),
    slug: v.string(),
    title: v.string(),
    layout: v.union(
      v.literal("Single"),
      v.literal("Compare"),
      v.literal("Carousel"),
    ),
    productIds: v.array(v.string()),
    headline: v.string(),
    subheadline: v.optional(v.string()),
    cta: v.string(),
    legalCopy: v.optional(v.string()),
    // What-you-get bullet list rendered above the product cards.
    // Operator types one per line in the dashboard. Kept on the
    // paywall (not the product) because feature copy is usually a
    // value-prop pitch tied to the paywall variant, not to a specific
    // SKU — the same product can sit behind multiple paywalls with
    // different feature framing for A/B tests.
    features: v.optional(v.array(v.string())),
    // Optional brand chrome. URLs are rendered as <img> tags with no
    // proxying — the operator hosts the asset wherever (CDN, public
    // S3, App Store screenshot URL). `logoUrl` shows above the
    // headline; `backgroundImageUrl` becomes a cover layer behind
    // the gradient.
    logoUrl: v.optional(v.string()),
    backgroundImageUrl: v.optional(v.string()),
    // Per-product hero images shown at the top of each plan card —
    // the visual element RevenueCat / Apphud paywalls lean on. Kept
    // on the paywall row (not the product) so the same product can
    // carry different art per paywall variant (A/B test, seasonal
    // creative, etc.). Sparse map: only the productIds the operator
    // has explicitly attached an image to appear here.
    productImages: v.optional(
      v.array(v.object({ productId: v.string(), imageUrl: v.string() })),
    ),
    // Operator-authored CSS appended after the default stylesheet so
    // any rule it carries wins by source order. Lets power users
    // restyle anything (typography, layout, gradients) without us
    // having to ship a knob per design choice. Body / script tags
    // get stripped at render time as a basic guard against script
    // injection — the WebView bridge contract stays kit-controlled.
    customCss: v.optional(v.string()),
    // Full HTML override. When set, the kit's default body markup is
    // discarded entirely — the operator's HTML is rendered inside a
    // minimal shell that injects two helpers:
    //   window.openiap.purchase(productId)  // dispatches the bridge message
    //   window.openiap.products             // [{productId, title, price, ...}]
    //   window.openiap.paywall              // {headline, cta, theme, ...}
    // So the operator can write any HTML/CSS/JS — React via UMD, Vue,
    // vanilla — and only needs to call openiap.purchase() to trigger
    // the SDK side. `<script>` tags are allowed here (unlike customCss)
    // because the whole point is operator-authored interactivity. The
    // tradeoff is that it's the operator's responsibility to wire CTA
    // clicks to openiap.purchase(); kit no longer guarantees the
    // bridge fires automatically.
    customHtml: v.optional(v.string()),
    theme: v.optional(
      v.object({
        primaryColor: v.optional(v.string()),
        accentColor: v.optional(v.string()),
        backgroundColor: v.optional(v.string()),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_project_and_slug", ["projectId", "slug"]),
});

export default schema;
