import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { harmonizedPurchaseStateValidator } from "./purchases/purchaseState";
import {
  dataProvenanceValidator,
  subscriptionStateValidator,
} from "./utils/validation";

// Same shape as authTables.users, redeclared so `.withIndex("email", ...)`
// typechecks: spreading authTables loses the index names to a wide generic.
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
  v.literal("amazon"),
);

export const receiptEnvironmentValidator = v.union(
  v.literal("Sandbox"),
  v.literal("Production"),
);

export const purchaseRequestDataValidator = v.union(
  v.object({
    store: v.literal("apple"),
    jws: v.string(),
    expectedProductId: v.optional(v.string()),
  }),
  v.object({
    store: v.literal("google"),
    purchaseToken: v.string(),
    expectedProductId: v.optional(v.string()),
  }),
  // Meta Horizon has no opaque receipt: the Graph API verifies (userId, sku)
  // with the App Access Token the server holds. See
  // https://developers.meta.com/horizon/documentation/native/ps-iap-s2s/
  v.object({
    store: v.literal("horizon"),
    userId: v.string(),
    sku: v.string(),
  }),
  // Amazon RVS verifies userId + receiptId with the server-held shared secret.
  // App Tester sandbox receipts use the same shape with `sandbox: true`.
  v.object({
    store: v.literal("amazon"),
    userId: v.string(),
    receiptId: v.string(),
    sandbox: v.optional(v.boolean()),
    expectedProductId: v.optional(v.string()),
  }),
);

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
    // Stripe tax-id type such as "eu_vat" or "us_ein"; unset means "eu_vat".
    // See https://stripe.com/docs/api/customer_tax_ids/object
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
    // Legacy Stripe fields, unused since IAPKit became free for everyone. Kept
    // so existing production rows validate until a schema cleanup removes them.
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

    // Set by the membership drain when the org's sole member runs
    // `deleteAccount`. The paginated drain then deletes the org's projects,
    // purchases, files and so on, and finally the org row.
    pendingDeletion: v.optional(v.boolean()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    // Storage cleanup must distinguish a true orphan from the legacy direct
    // avatar reference without scanning every organization.
    .index("by_avatar_file_id", ["avatarFileId"])
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
    .index("by_organization_and_role", ["organizationId", "role"])
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

  // Projects table
  projects: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(), // URL-friendly identifier within org - UNIQUE per org enforced in mutations
    apiKey: v.string(), // Deprecated - will be removed after migration
    // Set once scoped keys are issued. The legacy `apiKey` then stays rejected,
    // even after the last scoped key is deleted.
    legacyApiKeyFallbackDisabledAt: v.optional(v.number()),
    // Persistent admission backstop for public receipt-verification actions.
    verificationAdmissionTokens: v.optional(v.number()),
    verificationAdmissionRefilledAt: v.optional(v.number()),
    // Separate bucket for entitlement rechecks (one store call per bound
    // purchase), so access reads cannot starve receipt verification.
    entitlementRecheckTokens: v.optional(v.number()),
    entitlementRecheckRefilledAt: v.optional(v.number()),
    // Keyed user-erasure lookup without retaining a dictionary-testable hash.
    userErasureHashKey: v.optional(v.string()),

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
    // `undefined` keeps the legacy newest-file fallback, an ID pins the active
    // credential, and `null` revokes the slot while old duplicates drain.
    googlePlayServiceAccountFileId: v.optional(
      v.union(v.id("files"), v.null()),
    ),
    googlePlayServiceAccountCleanupPending: v.optional(v.boolean()),
    googlePlayServiceAccountCleanupRecoveryAt: v.optional(v.number()),
    iosBundleId: v.optional(v.string()),
    iosAppAppleId: v.optional(v.number()),
    // App Store Server API key (Users and Access → Integrations → In-App
    // Purchase) for `purchases/ios.ts`; its .p8 is `purpose: "apple_p8_key"`.
    iosAppStoreIssuerId: v.optional(v.string()),
    iosAppStoreKeyId: v.optional(v.string()),
    // App Store Connect API key (Integrations → App Store Connect API, Team or
    // Individual Keys) for `products/asc.ts` push-sync; its .p8 is
    // `purpose: "apple_p8_asc_api_key"`. Apple scopes it apart from the Server
    // API key. Optional: receipt verification works without it.
    iosAscIssuerId: v.optional(v.string()),
    iosAscKeyId: v.optional(v.string()),

    // Meta Horizon. Shares the Android card (its client SDK is Play Billing
    // compatible) but verifies through Graph API `verify_entitlement`: the
    // server builds an `OC|$APP_ID|$APP_SECRET` token per request, so the
    // secret never reaches a client. Optional, gated by horizonEnabled.
    horizonEnabled: v.optional(v.boolean()),
    // Nullable because a patch with `undefined` leaves a field unchanged;
    // turning Horizon off clears the credentials with `null`.
    horizonAppId: v.optional(v.union(v.string(), v.null())),
    horizonAppSecret: v.optional(v.union(v.string(), v.null())),

    // Amazon RVS. Production needs the developer shared secret; Cloud Sandbox
    // accepts any non-empty one. Sandbox is opt-in because App Tester
    // responses are not production evidence.
    amazonSharedSecret: v.optional(v.union(v.string(), v.null())),
    amazonSandboxEnabled: v.optional(v.boolean()),

    // Dashboard reporting currency. There is no FX conversion: rows keep their
    // store currency, and totals include only rows already in this one.
    reportingCurrency: v.optional(v.string()),

    // Per-platform active sync-job lock. `enqueueProductSync` reads and patches
    // it, so concurrent enqueues conflict and end on one job instead of two
    // competing workers. The worker clears it when it finishes.
    activeSyncJobIds: v.optional(
      v.object({
        IOS: v.optional(v.id("productSyncJobs")),
        Android: v.optional(v.id("productSyncJobs")),
      }),
    ),

    // Set before the bounded project-deletion drain starts. Pending projects
    // disappear from dashboard/API reads immediately while scheduled
    // mutations remove large client-payload documents in safe pages.
    pendingDeletion: v.optional(v.boolean()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_api_key", ["apiKey"])
    .index("by_org_and_slug", ["organizationId", "slug"])
    .index("by_google_service_account_cleanup", [
      "googlePlayServiceAccountCleanupPending",
      "googlePlayServiceAccountCleanupRecoveryAt",
    ])
    .index("by_pending_deletion", ["pendingDeletion"]),

  // API Keys table - Multiple API keys per project
  apiKeys: defineTable({
    projectId: v.id("projects"),
    organizationId: v.id("organizations"), // Denormalized for faster queries

    // Key information
    // Publishable keys are public identifiers and remain recoverable for
    // webhook URLs. Secret keys store only keyHash + keyPreview.
    key: v.optional(v.string()),
    keyHash: v.optional(v.string()),
    keyPreview: v.optional(v.string()),
    name: v.string(), // User-friendly name for the key
    description: v.optional(v.string()),

    // Publishable keys are safe to ship in apps and reach only client
    // verification and read routes. Secret keys are operator credentials for
    // MCP, catalog writes, analytics and store sync. Unset (older keys) means
    // publishable.
    keyType: v.optional(v.union(v.literal("publishable"), v.literal("secret"))),
    permissions: v.optional(v.array(v.string())), // Reserved for future custom scopes

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
    .index("by_key_hash", ["keyHash"])
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

    // Apple's two .p8 kinds are not interchangeable; the wrong one gets a 401.
    // `apple_p8_key` is the App Store Server API key, for receipt verification;
    // `apple_p8_asc_api_key` is the App Store Connect API key, for push-sync.
    // `apple_iap_review_screenshot` is one project-level PNG/JPEG forwarded
    // privately to ASC during iOS push-sync.
    purpose: v.union(
      v.literal("apple_p8_key"),
      v.literal("apple_p8_asc_api_key"),
      v.literal("android_service_account"),
      v.literal("apple_iap_review_screenshot"),
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
    .index("by_project_and_purpose", ["projectId", "purpose"])
    .index("by_uploader", ["uploadedBy"])
    .index("by_org_and_purpose", ["organizationId", "purpose"])
    .index("by_storage_id", ["storageId"])
    .index("by_created_at", ["createdAt"]),

  // Short-lived bearer capabilities issued with upload URLs. They may outlive
  // their project, org or user on purpose: after an account deletion, a late
  // `saveFile` needs the reservation to reclaim the orphaned blob.
  // `files.internal.pruneUploadReservations` bounds their lifetime.
  fileUploadReservations: defineTable({
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    createdBy: v.id("users"),
    // `expiresAt` ends save authorization. Until `cleanupExpiresAt` the row can
    // still clean up a slow upload; after it the row is dead and the cron
    // removes it.
    expiresAt: v.number(),
    cleanupExpiresAt: v.number(),
    // Set only by the server-side binary validator after it fetches the
    // immutable storage object and verifies PNG/JPEG signature/transparency.
    validatedAppleReviewScreenshot: v.optional(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.string(),
        fileType: v.string(),
        fileSize: v.number(),
      }),
    ),
    validatedGoogleServiceAccount: v.optional(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.string(),
        fileType: v.string(),
        fileSize: v.number(),
        clientEmail: v.string(),
      }),
    ),
    // Claimed before the Node action downloads the private blob, so the expiry
    // pruner can still reclaim it if the action crashes mid-validation.
    pendingAppleReviewScreenshotStorageId: v.optional(v.id("_storage")),
    pendingGoogleServiceAccountStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  })
    .index("by_cleanup_expires_at", ["cleanupExpiresAt"])
    // Enforces bounded outstanding capabilities per issuer and target. The
    // cleanup expiry is last so issuance can select only still-active rows.
    .index("by_creator_target_and_cleanup_expiry", [
      "createdBy",
      "organizationId",
      "projectId",
      "cleanupExpiresAt",
    ]),

  // Purchases table - unified receipt storage
  purchases: defineTable({
    projectId: v.id("projects"),
    store: purchaseStoreValidator,
    appUserId: v.optional(v.string()),
    accountErased: v.optional(v.boolean()),
    applicationId: v.string(), // bundleId or packageName
    remoteId: v.optional(v.string()),
    requestData: purchaseRequestDataValidator,
    remoteResponse: v.optional(v.string()),
    requestIp: v.optional(v.string()),
    state: harmonizedPurchaseStateValidator,
    isValid: v.optional(v.boolean()), // computed from state at time of verification
    verificationDurationMs: v.optional(v.number()),
    // Only Amazon's environment is chosen by the request. Stored as a field so
    // operators need not dig it out of the request JSON.
    environment: v.optional(receiptEnvironmentValidator),
    // Next RVS recheck of an active Amazon receipt. A claim moves it forward as
    // a lease, so overlapping five-minute cron ticks skip the row.
    nextAmazonReconcileAt: v.optional(v.number()),
    // Extracted on write so the list query doesn't re-parse
    // `remoteResponse` for every page item.
    productId: v.optional(v.string()),
    // Google order id, extracted from `remoteResponse` on write. Google reissues
    // `purchaseToken` for the same order but `orderId` stays, so
    // `savePurchaseInternal` dedups on (projectId, remoteId), then
    // (projectId, applicationId, orderId).
    orderId: v.optional(v.string()),
    // Marker for the `backfillPurchaseStatsFromPurchases` migration. New rows
    // start true; the migration sets it on a legacy row once its delta is in
    // `purchaseStats`.
    statsCounted: v.optional(v.boolean()),
    // Like `statsCounted`, for the Horizon/Amazon bucket backfill. New rows
    // start marked; the migration marks each legacy row atomically with its delta.
    storeStatsCounted: v.optional(v.boolean()),
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
    .index("by_project_and_app_user", ["projectId", "appUserId"])
    .index("by_project_app_orderId", ["projectId", "applicationId", "orderId"])
    .index("by_store_isValid_nextAmazonReconcileAt", [
      "store",
      "isValid",
      "nextAmazonReconcileAt",
    ])
    .searchIndex("search_request_ip_by_project", {
      searchField: "requestIp",
      filterFields: ["projectId"],
    }),

  // Per-project purchase counters, kept current by the purchase save, update
  // and invalidate paths and the project-delete cascade, so dashboard reads
  // never scan receipts.
  purchaseStats: defineTable({
    projectId: v.id("projects"),
    // Denormalized for org-level totals. Optional only for rows the backfill
    // has not reached; new rows always set it.
    organizationId: v.optional(v.id("organizations")),
    total: v.number(),
    apple: v.number(),
    google: v.number(),
    // Absent on older rows and read as zero; every new write sets both.
    horizon: v.optional(v.number()),
    amazon: v.optional(v.number()),
    // Distinct Google `orderId`s. Rows without one (pending acknowledgement,
    // errors) count in `google` only, so the "Google Play" card reads this to
    // show Play Console orders, not validation calls. Optional for rows the
    // backfill has not reached; new writes always set it.
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
    // In-flight Stripe meter-event batch, set when a sync starts and cleared
    // once the post-send mutation commits. A retry reuses its `identifier`, so
    // Stripe dedupes even if new usage arrived in between.
    inFlightSyncId: v.optional(v.union(v.string(), v.null())),
    inFlightQuantity: v.optional(v.union(v.number(), v.null())),
    inFlightLastEventAt: v.optional(v.union(v.number(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_pending_quantity", ["pendingQuantity"]),

  // Cursor state for cron jobs. cleanupIncompleteUsers stores the
  // `_creationTime` of its last processed user here, so a tick resumes there
  // instead of spending its read budget on older, complete users.
  cronState: defineTable({
    jobName: v.string(),
    cursor: v.number(),
    updatedAt: v.number(),
  }).index("by_jobName", ["jobName"]),

  // Normalized Apple ASN v2 and Google RTDN events. They drive subscription
  // state, revenue metrics, dedup and delivery history. `pruneWebhookEvents`
  // deletes them after 30 days.
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
      v.literal("SubscriptionDeferred"),
      v.literal("SubscriptionPauseScheduleChanged"),
      v.literal("SubscriptionPendingPurchaseCanceled"),
      v.literal("SubscriptionPriceStepUpConsentChanged"),
      v.literal("PurchaseRefunded"),
      v.literal("PurchaseConsumptionRequest"),
      v.literal("TestNotification"),
    ),
    source: v.union(
      v.literal("AppleAppStoreServerNotificationsV2"),
      v.literal("GooglePlayRealTimeDeveloperNotifications"),
      // Legacy source, kept until its synthetic rows age out. Ingestion and
      // analytics never create or count these rows.
      v.literal("MetaHorizonReconciler"),
    ),
    platform: v.union(v.literal("IOS"), v.literal("Android")),
    environment: v.union(
      v.literal("Production"),
      v.literal("Sandbox"),
      v.literal("Xcode"),
    ),
    // Absent only on TestNotification, which carries no transaction; every
    // lifecycle event sets it (see webhooks/internal.ts).
    purchaseToken: v.optional(v.string()),
    linkedPurchaseToken: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    originalTransactionId: v.optional(v.string()),
    applicationId: v.optional(v.string()),
    productKind: v.optional(
      v.union(v.literal("subscription"), v.literal("one_time")),
    ),
    // Original notification id from the store (ASN v2 `notificationUUID`
    // or RTDN Pub/Sub `messageId`). Used internally for source-aware
    // deduplication and pruning correlation.
    sourceNotificationId: v.string(),
    productId: v.optional(v.string()),
    effectiveImmediately: v.optional(v.boolean()),
    subscriptionState: v.optional(subscriptionStateValidator),
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
    amountProvenance: v.optional(dataProvenanceValidator),
    rawSignedPayload: v.optional(v.string()),
    occurredAt: v.number(),
    receivedAt: v.number(),
    // Set in the mutation that applies this event's transition and stats delta.
    // Unlike subscriptions.lastEventId it stays on the event, so a late
    // redelivery cannot replay the transition over newer state.
    appliedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_purchase_token", ["purchaseToken"])
    // Convex appends `_creationTime` automatically. Revenue metrics use this
    // index for bounded project/time-window reads.
    .index("by_project_and_received", ["projectId", "receivedAt"])
    .index("by_received_at", ["receivedAt"])
    // Source-aware lookup used for ingestion dedup. Ingestion preserves the
    // full (projectId, source, sourceNotificationId) natural key.
    .index("by_project_and_source_and_notification_id", [
      "projectId",
      "source",
      "sourceNotificationId",
    ]),

  // Webhook dedup on (projectId, source, sourceNotificationId). The project is
  // in the key because a Pub/Sub messageId is unique only within its topic
  // (Apple's UUID is global; one key shape keeps lookups simple). A duplicate
  // reuses the stored event and reapplies its transition idempotently, so a
  // retry repairs a half-finished first attempt. `projectId` is optional only
  // so older rows validate; new inserts always set it.
  webhookIdempotencyKeys: defineTable({
    projectId: v.optional(v.id("projects")),
    source: v.union(v.literal("apple"), v.literal("google")),
    sourceNotificationId: v.string(),
    eventId: v.optional(v.id("webhookEvents")),
    firstSeenAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_event", ["eventId"])
    .index("by_source_and_id", ["source", "sourceNotificationId"])
    .index("by_project_and_source_and_id", [
      "projectId",
      "source",
      "sourceNotificationId",
    ])
    // Lets `pruneWebhookEvents` age out dedup rows without a full-table scan.
    .index("by_first_seen_at", ["firstSeenAt"]),

  // One row per store purchase id: `originalTransactionId` (Apple) or
  // `purchaseToken` (Google), not per (userId, productId), because one user
  // can hold several entitlements over time (resubscribe, cross-grade, family
  // sharing). Entitlement checks aggregate by user. `applySubscriptionEvent`
  // drives transitions per `knowledge/external/webhook-mapping.md`.
  //
  // Google reissues `purchaseToken` on replacement and RTDN omits the old one,
  // so subscriptionsv2 enrichment supplies `linkedPurchaseToken` and the
  // transition moves the row to the new token atomically. Apple's
  // `originalTransactionId` never changes.
  subscriptions: defineTable({
    accountErased: v.optional(v.boolean()),
    projectId: v.id("projects"),
    purchaseToken: v.string(),
    userId: v.optional(v.string()),
    productKind: v.optional(v.literal("subscription")),
    productId: v.string(),
    platform: v.union(v.literal("IOS"), v.literal("Android")),
    state: subscriptionStateValidator,
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
    lastEventOccurredAt: v.optional(v.number()),
    lastEventCreationTime: v.optional(v.number()),
    lastEventSourceNotificationId: v.optional(v.string()),
    // Snapshot of the source event, so a late user binding can still emit its
    // entitlement grant after the webhook event is pruned.
    lastEventSource: v.optional(
      v.object({
        type: v.optional(v.string()),
        environment: v.union(
          v.literal("Production"),
          v.literal("Sandbox"),
          v.literal("Xcode"),
        ),
        productId: v.optional(v.string()),
        applicationId: v.optional(v.string()),
        transactionId: v.optional(v.string()),
        originalTransactionId: v.optional(v.string()),
        currency: v.optional(v.string()),
        priceAmountMicros: v.optional(v.number()),
      }),
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_token", ["projectId", "purchaseToken"])
    .index("by_project_and_user", ["projectId", "userId"])
    .index("by_project_and_user_and_updated", [
      "projectId",
      "userId",
      "updatedAt",
    ])
    .index("by_project_and_state", ["projectId", "state"])
    .index("by_project_and_updated", ["projectId", "updatedAt"])
    .index("by_project_and_product", ["projectId", "productId"])
    .index("by_last_event", ["lastEventId"])
    // Serves listSubscriptions' state + productId filter; filtering after
    // take() would miss rows when thousands of subs share a state.
    .index("by_project_and_state_and_product", [
      "projectId",
      "state",
      "productId",
    ])
    // Revenue rollups scan each counted state in update order.
    .index("by_project_and_state_and_updated", [
      "projectId",
      "state",
      "updatedAt",
    ]),

  // Google replacement tokens form a successor chain. Keeping the chain
  // separate from canonical subscriptions lets late predecessor notifications
  // remain auditable without creating a second logical subscription row.
  subscriptionTokenAliases: defineTable({
    projectId: v.id("projects"),
    purchaseToken: v.string(),
    successorPurchaseToken: v.string(),
    predecessorProductId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_token", ["projectId", "purchaseToken"]),

  // Durable app-user erasure work. The raw userId exists only while a job is
  // active; completion keeps a project-keyed digest for idempotency.
  subscriptionUserErasureJobs: defineTable({
    projectId: v.id("projects"),
    userId: v.optional(v.string()),
    userIdHash: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
    ),
    subscriptionsErased: v.number(),
    commerceEventsErased: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_user_hash", ["projectId", "userIdHash"])
    .index("by_status_and_updated", ["status", "updatedAt"]),

  // Per-(project, currency) subscription counters and MRR, kept current by
  // `applySubscriptionEvent` so `metricsSummary` reads one row per currency
  // instead of scanning `subscriptions`. Keyed by currency because MRR is
  // never summed across currencies. The 30-day refunded and canceled counts
  // are not stored: they stay small, so reads scan `by_project_and_state`
  // from the cutoff.
  subscriptionStats: defineTable({
    projectId: v.id("projects"),
    currency: v.string(),
    activeSubs: v.number(),
    inGracePeriod: v.number(),
    inBillingRetry: v.number(),
    mrrMicros: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_currency", ["projectId", "currency"])
    // `recomputeAllSubscriptionStats` takes the stalest rows first without
    // sorting the whole table.
    .index("by_updated_at", ["updatedAt"]),

  // Daily revenue rollup per (projectId, day, productId, currency), so the
  // dashboard never scans the event log. The `recomputeRevenueMetrics` cron
  // rebuilds the trailing window from `subscriptions` to pick up late webhooks.
  //
  // Currency is in the key because one SKU can sell in several currencies on
  // the same UTC day; without it, totals would mix or overwrite each other.
  // IAPKit never converts currencies; accounting-grade conversion belongs
  // outside the dashboard.
  revenueMetricsDaily: defineTable({
    projectId: v.id("projects"),
    day: v.string(), // ISO date (YYYY-MM-DD), UTC
    productId: v.string(),
    currency: v.string(),
    // Also part of the key, so the dashboard can chart revenue per store.
    // Strict because `webhookEvents` and `subscriptions` allow only these two.
    platform: v.union(v.literal("IOS"), v.literal("Android")),
    activeSubs: v.number(),
    newSubs: v.number(),
    renewals: v.number(),
    cancellations: v.number(),
    refunds: v.number(),
    revenueMicros: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    // Dashboard read path: `getRevenueMetrics` range-scans a project's window
    // by day, then filters product, platform and currency in memory (the
    // window is typically tens of rows).
    .index("by_project_and_day_and_currency", ["projectId", "day", "currency"])
    .index("by_project_and_product_and_day_and_currency", [
      "projectId",
      "productId",
      "day",
      "currency",
    ]),

  // Rotation state for the `recomputeAllRevenueMetrics` cron, which picks the
  // oldest `lastRunAt` first. Separate from `subscriptionStats.updatedAt` so
  // the revenue and subscription-stats crons rotate independently.
  //
  // At most one row per project. Convex has no unique constraint, so upsert
  // through `by_project` as `markRevenueMetricsRun` does; a duplicate gets its
  // project picked twice.
  revenueMetricsRunStatus: defineTable({
    projectId: v.id("projects"),
    lastRunAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_run", ["lastRunAt"]),

  // Cached metadata for the App Store Connect / Play Console products kit can
  // read, create and update (what onesub holds in @onesub/providers). Store
  // credentials stay in `files`.
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
    // Listing text in languages beyond the base `title`/`description` (see
    // `baseLocale`), keyed by BCP-47 codes such as "ko-KR" that Play and ASC
    // both accept. Nullable because a patch with `undefined` leaves the field
    // unchanged, so removing the last localization needs `null`.
    localizations: v.optional(
      v.union(
        v.array(
          v.object({
            locale: v.string(),
            title: v.string(),
            description: v.optional(v.string()),
          }),
        ),
        v.null(),
      ),
    ),
    // Locale of `title`/`description`; en-US when unset. A store pull with no
    // en-US listing records its locale so the next push cannot label it English.
    baseLocale: v.optional(v.string()),
    // Sales regions: a list limits the product to those markets; "all" sells
    // wherever Play prices it, including markets Play adds later; unset sells a
    // product new to Play everywhere and leaves an existing one's regions as
    // they are, so a price sync never widens them. Nullable so a patch can
    // clear it.
    regions: v.optional(
      v.union(v.literal("all"), v.array(v.string()), v.null()),
    ),
    priceAmountMicros: v.optional(v.number()),
    currency: v.optional(v.string()),
    state: v.union(
      v.literal("Draft"),
      v.literal("Ready"),
      v.literal("Active"),
      v.literal("Removed"),
    ),
    // Subscription billing period, as an ISO-8601 duration; unset for other
    // types. Push maps it to ASC `subscriptionPeriod` (`ONE_WEEK`, ...) and to
    // Play `autoRenewingBasePlanType.billingPeriodDuration`.
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
    // App Store subscription group; null on Android, which has no equivalent.
    // A user holds at most one subscription per group and switches within it
    // by upgrade or downgrade; the dashboard groups subscriptions by it.
    // `subscriptionGroupId` is Apple's resource id, `subscriptionGroupName`
    // the referenceName shown in ASC. Nullable so a patch can clear both when
    // a row stops being a subscription.
    subscriptionGroupId: v.optional(v.union(v.string(), v.null())),
    subscriptionGroupName: v.optional(v.union(v.string(), v.null())),
    // Apple introductory offers and Play base plan offers in one store-neutral
    // shape, so both stores upsert alike and the dashboard renders badges
    // ("7-day free trial") without the raw store response.
    offers: v.optional(
      v.array(
        v.object({
          // ASC offer id (eyJ...) or Play's basePlanId+offerId composite.
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
    // ASC `reviewNote`, read by App Review with the screenshot. ASC caps it at
    // 4000 chars; not enforced here so the operator sees Apple's own message.
    reviewNote: v.optional(v.string()),
    storeRef: v.optional(v.string()),
    // Project screenshot handled in this product's latest ASC review attempt.
    // A Ready row is eligible again only once the operator replaces it, which
    // keeps batched runs resumable across pull-sync timestamp updates.
    lastAppleReviewScreenshotFileId: v.optional(v.id("files")),
    syncedAt: v.optional(v.number()),
    // Where the row was first inserted from; never changed afterwards.
    // Push-sync (`listDraft*Products`) takes rows with `origin === "kit"` or no
    // `storeRef`, skipping pulled store drafts, which would otherwise be pushed
    // and pulled back on every sync. Optional for older rows.
    origin: v.optional(v.union(v.literal("kit"), v.literal("store"))),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    // Platform is in the key because apps often ship one productId on both
    // stores; without it, a sync would flip the existing row's platform.
    .index("by_project_and_platform_and_product", [
      "projectId",
      "platform",
      "productId",
    ])
    .index("by_project_and_platform", ["projectId", "platform"]),

  // Client-readable product metadata that is never pushed to the stores. Kept
  // out of `products` so it survives store pulls and purges; only project
  // deletion or an operator removes it.
  productClientPayloads: defineTable({
    projectId: v.id("projects"),
    platform: v.union(v.literal("IOS"), v.literal("Android")),
    productId: v.string(),
    format: v.union(v.literal("toml"), v.literal("json"), v.literal("text")),
    body: v.string(),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_platform", ["projectId", "platform"])
    .index("by_project_and_platform_and_product", [
      "projectId",
      "platform",
      "productId",
    ]),

  // Body-free copy of each client payload, for the dashboard and as its
  // revision clock: listing `productClientPayloads` would load every 16 KiB
  // body just to show badges. A deleted payload keeps this row as a tombstone
  // so recreating it cannot reset the version to 1 and let a stale write
  // through (ABA). Written in the same transaction as the payload.
  productClientPayloadSummaries: defineTable({
    projectId: v.id("projects"),
    platform: v.union(v.literal("IOS"), v.literal("Android")),
    productId: v.string(),
    format: v.union(v.literal("toml"), v.literal("json"), v.literal("text")),
    version: v.number(),
    deleted: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_platform_and_product", [
      "projectId",
      "platform",
      "productId",
    ]),

  // Jobs for the `runProductSyncIOS` / `runProductSyncAndroid` workers. A sync
  // can take minutes, and iOS Safari aborts a pending fetch when the tab
  // backgrounds or the network changes, so the dashboard enqueues a job and
  // watches it with `useQuery(getActiveSyncJob)`.
  //
  // Succeeded rows are pruned after 7 days, failed after 30.
  // `reapStaleProductSyncJobs` fails running rows past `expectedDeadline`, so
  // a crashed worker cannot hold the active-job slot forever.
  productSyncJobs: defineTable({
    projectId: v.id("projects"),
    platform: v.union(v.literal("IOS"), v.literal("Android")),
    direction: v.union(
      v.literal("pull"),
      v.literal("push"),
      v.literal("both"),
      // Empties kit's local catalog for the platform without touching the
      // store; the next sync re-pulls. Recovers from stale local state.
      v.literal("purge-local"),
    ),
    dryRun: v.boolean(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
    ),
    progress: v.object({
      phase: v.string(),
      current: v.optional(v.number()),
      total: v.optional(v.number()),
      failuresCount: v.optional(v.number()),
    }),
    result: v.optional(
      v.object({
        pulled: v.number(),
        pushed: v.number(),
        // Number of kit-side product rows removed by purge-local or
        // by a successful upstream delete during push/both sync.
        deleted: v.optional(v.number()),
        failures: v.array(
          v.object({ productId: v.string(), reason: v.string() }),
        ),
        failuresTruncated: v.optional(v.boolean()),
        plannedWrites: v.optional(
          v.array(
            v.object({
              productId: v.string(),
              step: v.string(),
              detail: v.optional(v.string()),
            }),
          ),
        ),
        plannedWritesTruncated: v.optional(v.boolean()),
        // Steps an operator must finish in App Store Connect, such as a
        // first-of-type product Apple requires to ship with a new app version.
        // Unlike `failures`, retrying will not clear them.
        manualActions: v.optional(
          v.array(
            v.object({
              productId: v.string(),
              code: v.string(),
              message: v.string(),
            }),
          ),
        ),
        manualActionsTruncated: v.optional(v.boolean()),
      }),
    ),
    error: v.optional(v.string()),
    cancelRequested: v.optional(v.boolean()),
    expectedDeadline: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    // Backs `getActiveSyncJob` and the double-enqueue guard in
    // `enqueueProductSync`.
    .index("by_project_platform_status", ["projectId", "platform", "status"])
    // Lets `getActiveSyncJob` read the latest job per platform from the index
    // instead of filtering all of a project's jobs in memory.
    .index("by_project_platform_created", [
      "projectId",
      "platform",
      "createdAt",
    ])
    .index("by_project_and_created", ["projectId", "createdAt"])
    // Reaper / pruner scans.
    .index("by_status_and_deadline", ["status", "expectedDeadline"])
    .index("by_status_and_completed", ["status", "completedAt"]),

  // ── Normalized commerce events (outbound contract) ───────────────────────
  //
  // `webhookEvents` records what a store said; this records what happened, in
  // IAPKit's vocabulary, for consumers that must not parse store payloads.
  // Written in the same transaction as the subscription transition, so it
  // shares that transition's dedup and staleness guarantees.
  //
  // No `rawSignedPayload` and no credentials: each row becomes the body of a
  // request to a developer's server.
  commerceEvents: defineTable({
    projectId: v.id("projects"),
    eventType: v.string(),
    // Schema version of the emitted body. Consumers pin on the major.
    eventVersion: v.string(),
    store: purchaseStoreValidator,
    environment: v.union(
      v.literal("production"),
      v.literal("sandbox"),
      v.literal("xcode"),
    ),
    applicationId: v.optional(v.string()),
    userId: v.optional(v.string()),
    productId: v.optional(v.string()),
    previousProductId: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    originalTransactionId: v.optional(v.string()),
    subscriptionId: v.optional(v.id("subscriptions")),
    // Subscription as it stood immediately after this event. Stored rather
    // than joined at read time because the live row may have moved on.
    subscription: v.optional(
      v.object({
        state: subscriptionStateValidator,
        productId: v.string(),
        expiresAt: v.optional(v.number()),
        renewsAt: v.optional(v.number()),
        willRenew: v.optional(v.boolean()),
        cancellationReason: v.optional(v.string()),
      }),
    ),
    // Entitlement gate after this event, denormalized so a consumer can act on
    // the row without joining the subscription.
    entitlementActive: v.optional(v.boolean()),
    currency: v.optional(v.string()),
    amountMicros: v.optional(v.number()),
    // Which of store / catalog / inferred produced `amountMicros`. Never mix.
    amountProvenance: v.optional(dataProvenanceValidator),
    // Source store event, for support triage. Only the store's notification id
    // goes out: a developer can look it up with the store, and it outlives the
    // pruned inbound row.
    sourceEventId: v.optional(v.id("webhookEvents")),
    sourceStoreNotificationId: v.optional(v.string()),
    extensions: v.optional(v.record(v.string(), v.string())),
    occurredAt: v.number(),
    processedAt: v.number(),
    prunableAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_user", ["projectId", "userId"])
    .index("by_prunable_at", ["prunableAt"]),

  // Developer-registered endpoints for outbound commerce events, server to
  // server only: no shipped app can reach them and there is no client stream
  // (see the webhook direction guardrail).
  outboundDestinations: defineTable({
    projectId: v.id("projects"),
    url: v.string(),
    // HMAC key for the signature header. Stored server-side only and never
    // echoed by any query that a dashboard or API client can reach.
    secret: v.string(),
    // Previous secret kept valid during rotation so a destination can roll
    // its key without dropping in-flight deliveries.
    previousSecret: v.optional(v.string()),
    previousSecretExpiresAt: v.optional(v.number()),
    enabled: v.boolean(),
    pendingDeletion: v.optional(v.boolean()),
    // Empty/absent means "every event type".
    eventTypes: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    // Set when repeated failures trip the breaker; cleared on manual re-enable.
    disabledReason: v.optional(v.string()),
    consecutiveFailures: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_enabled", ["projectId", "enabled"])
    .index("by_pending_deletion", ["pendingDeletion"])
    .index("by_previous_secret_expiry", ["previousSecretExpiresAt"]),

  // One row per project with queued deliveries. Claiming in `nextClaimAt`
  // order rotates the worker across projects without scanning a busy
  // project's whole backlog.
  outboundDeliveryQueues: defineTable({
    projectId: v.id("projects"),
    nextClaimAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_next_claim", ["nextClaimAt"]),

  // One row per (event, destination) attempt chain. Also the dead-letter
  // store: a row that exhausts `maxAttempts` stays with status "failed" and
  // can be replayed without re-deriving the event.
  outboundDeliveries: defineTable({
    projectId: v.id("projects"),
    eventId: v.id("commerceEvents"),
    destinationId: v.id("outboundDestinations"),
    status: v.union(
      v.literal("pending"),
      v.literal("delivering"),
      v.literal("delivered"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    // Exponential backoff target. The worker claims rows at or past this.
    nextAttemptAt: v.number(),
    lastStatusCode: v.optional(v.number()),
    lastError: v.optional(v.string()),
    // Lease held while an attempt is in flight, so overlapping cron ticks
    // cannot double-deliver the same row.
    leaseExpiresAt: v.optional(v.number()),
    // Fencing token issued with the lease: only a result carrying the current
    // token is recorded, so a superseded attempt cannot overwrite a reclaimed row.
    leaseToken: v.optional(v.string()),
    deliveredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_event", ["eventId"])
    .index("by_destination", ["destinationId"])
    .index("by_project_and_status_and_next_attempt", [
      "projectId",
      "status",
      "nextAttemptAt",
    ])
    .index("by_project_and_status_and_lease_expiry", [
      "projectId",
      "status",
      "leaseExpiresAt",
    ])
    .index("by_project_and_status_and_updated", [
      "projectId",
      "status",
      "updatedAt",
    ])
    .index("by_status_and_updated", ["status", "updatedAt"])
    // Worker claim scan.
    .index("by_status_and_next_attempt", ["status", "nextAttemptAt"])
    .index("by_status_and_lease_expiry", ["status", "leaseExpiresAt"]),
});

export default schema;
