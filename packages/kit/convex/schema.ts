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
    iosAppStoreIssuerId: v.optional(v.string()),
    iosAppStoreKeyId: v.optional(v.string()),

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
    .index("by_org_and_slug", ["organizationId", "slug"]),

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

    // Purpose/category
    purpose: v.union(
      v.literal("apple_p8_key"), // Apple .p8 private key
      v.literal("android_service_account"), // Android Service Account
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
});

export default schema;
