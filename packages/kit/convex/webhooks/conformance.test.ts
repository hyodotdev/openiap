// Provider conformance for webhook -> state machine -> entitlement, using
// pre-canned ASN v2 + RTDN payloads (the "sandbox-without-Apple/Google" suite).
//
// Scenarios are declared once as abstract lifecycle events; each provider's
// adapter renders them into its own wire payload. Adding a provider means
// writing an adapter, not another scenario list.

import { describe, expect, it } from "vitest";

import {
  normalizeAppleAsn,
  normalizeGoogleRtdn,
  type AppleAsnPayload,
  type AppleDecodedTransaction,
  type AppleDecodedRenewalInfo,
  type GoogleRtdnPayload,
  type GoogleSubscriptionInfo,
  type NormalizedWebhookEvent,
} from "./shared";
import {
  applySubscriptionTransition,
  entitlementActive,
  type CurrentSubscription,
} from "../subscriptions/stateMachine";
import { behaviorsByCategory } from "../../../conformance/src/spec/behaviors.mjs";

// ---------------------------------------------------------------------------
// Abstract lifecycle vocabulary
// ---------------------------------------------------------------------------

type LifecycleEvent =
  | "InitialPurchase"
  | "Renew"
  | "DisableAutoRenew"
  | "Expire"
  | "EnterGracePeriod"
  | "RecoverFromGracePeriod"
  | "EnterBillingRetry"
  | "RecoverFromBillingRetry"
  // Refund (money returned) and Revoke (entitlement withdrawn) are distinct
  // signals on both providers and land in different normalized states.
  | "Refund"
  | "Revoke"
  | "Pause"
  | "Resume";

type ExpectAfter = {
  state: NonNullable<CurrentSubscription>["state"];
  active: boolean;
  willRenew?: boolean;
  cancellationReason?: NonNullable<CurrentSubscription>["cancellationReason"];
};

type Step = { event: LifecycleEvent; expect: ExpectAfter };

type Scenario = {
  name: string;
  steps: Step[];
  /** Entitlement expected after the final step. */
  entitledAtEnd: boolean;
  /** Behavior ids from packages/conformance this scenario demonstrates. */
  covers: string[];
};

type StepContext = {
  index: number;
  productId: string;
  purchaseToken: string;
};

type ProviderAdapter = {
  name: string;
  productId: string;
  /** Abstract events this provider's notification stream can express. */
  supports: ReadonlySet<LifecycleEvent>;
  normalize(event: LifecycleEvent, ctx: StepContext): NormalizedWebhookEvent;
};

const FUTURE = 9_999_999_999_000;

// ---------------------------------------------------------------------------
// Scenarios — declared once, run against every capable provider
// ---------------------------------------------------------------------------

const SCENARIOS: Scenario[] = [
  {
    name: "purchase -> renew -> cancel -> expire",
    entitledAtEnd: false,
    covers: [
      "lifecycle.purchase-starts-active-entitlement",
      "lifecycle.cancel-retains-entitlement-until-expiry",
      "lifecycle.expiry-ends-entitlement",
    ],
    steps: [
      {
        event: "InitialPurchase",
        expect: { state: "Active", active: true, willRenew: true },
      },
      {
        event: "Renew",
        expect: { state: "Active", active: true, willRenew: true },
      },
      {
        event: "DisableAutoRenew",
        expect: {
          state: "Active",
          active: true,
          willRenew: false,
          cancellationReason: "UserCanceled",
        },
      },
      {
        event: "Expire",
        expect: { state: "Expired", active: false, willRenew: false },
      },
    ],
  },
  {
    name: "grace period -> recovery",
    entitledAtEnd: true,
    covers: ["lifecycle.grace-period-retains-entitlement"],
    steps: [
      { event: "InitialPurchase", expect: { state: "Active", active: true } },
      {
        event: "EnterGracePeriod",
        expect: { state: "InGracePeriod", active: true },
      },
      {
        event: "RecoverFromGracePeriod",
        expect: { state: "Active", active: true, willRenew: true },
      },
    ],
  },
  {
    name: "billing retry -> recovery",
    entitledAtEnd: true,
    covers: ["lifecycle.billing-retry-suspends-entitlement"],
    steps: [
      { event: "InitialPurchase", expect: { state: "Active", active: true } },
      {
        event: "EnterBillingRetry",
        expect: { state: "InBillingRetry", active: false },
      },
      {
        event: "RecoverFromBillingRetry",
        expect: { state: "Active", active: true },
      },
    ],
  },
  {
    name: "refund de-entitles",
    entitledAtEnd: false,
    covers: ["lifecycle.refund-ends-entitlement"],
    steps: [
      { event: "InitialPurchase", expect: { state: "Active", active: true } },
      {
        event: "Refund",
        expect: {
          state: "Refunded",
          active: false,
          cancellationReason: "Refunded",
        },
      },
    ],
  },
  {
    name: "revoke de-entitles",
    entitledAtEnd: false,
    covers: ["lifecycle.revoke-ends-entitlement"],
    steps: [
      { event: "InitialPurchase", expect: { state: "Active", active: true } },
      { event: "Revoke", expect: { state: "Revoked", active: false } },
    ],
  },
  {
    name: "pause -> resume",
    entitledAtEnd: true,
    covers: [],
    steps: [
      { event: "InitialPurchase", expect: { state: "Active", active: true } },
      { event: "Pause", expect: { state: "Paused", active: false } },
      { event: "Resume", expect: { state: "Active", active: true } },
    ],
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function runScenario(adapter: ProviderAdapter, scenario: Scenario) {
  let current: CurrentSubscription = null;

  scenario.steps.forEach((step, index) => {
    const normalized = adapter.normalize(step.event, {
      index,
      productId: adapter.productId,
      purchaseToken: `${adapter.name}-token`,
    });

    const transition = applySubscriptionTransition(current, {
      type: normalized.type,
      productId: normalized.productId ?? adapter.productId,
      subscriptionState: normalized.subscriptionState,
      expiresAt: normalized.expiresAt,
      renewsAt: normalized.renewsAt,
      cancellationReason: normalized.cancellationReason,
      currency: normalized.currency,
      priceAmountMicros: normalized.priceAmountMicros,
    });

    // Without this, a `transition.next ?? current` fallback would let
    // same-state assertions (Active -> Active on renew) pass on a no-op.
    expect(
      transition.next,
      `${adapter.name}/${scenario.name} step ${index} (${step.event}) produced no next state`,
    ).toBeTruthy();

    current = transition.next ?? current;

    const where = `${adapter.name}/${scenario.name} step ${index} (${step.event})`;
    expect(current?.state, `${where} state`).toBe(step.expect.state);
    expect(transition.active, `${where} active`).toBe(step.expect.active);
    if (step.expect.willRenew !== undefined) {
      expect(current?.willRenew, `${where} willRenew`).toBe(
        step.expect.willRenew,
      );
    }
    if (step.expect.cancellationReason !== undefined) {
      expect(current?.cancellationReason, `${where} cancellationReason`).toBe(
        step.expect.cancellationReason,
      );
    }
  });

  return current;
}

// ---------------------------------------------------------------------------
// Apple adapter
// ---------------------------------------------------------------------------

function applePayload(
  notificationType: string,
  subtype: string | undefined,
  uuid: string,
): AppleAsnPayload {
  return {
    notificationType,
    subtype,
    notificationUUID: uuid,
    signedDate: 1_711_000_000_000,
    data: { environment: "Production", bundleId: "com.example.app" },
  };
}

const APPLE_EVENTS: Record<
  LifecycleEvent,
  {
    type: string;
    subtype?: string;
    expiresDate?: number;
    expirationIntent?: number;
  } | null
> = {
  InitialPurchase: {
    type: "SUBSCRIBED",
    subtype: "INITIAL_BUY",
    expiresDate: FUTURE,
  },
  Renew: { type: "DID_RENEW", expiresDate: FUTURE + 1 },
  DisableAutoRenew: {
    type: "DID_CHANGE_RENEWAL_STATUS",
    subtype: "AUTO_RENEW_DISABLED",
    expiresDate: FUTURE + 1,
  },
  Expire: { type: "EXPIRED", expiresDate: 0, expirationIntent: 1 },
  EnterGracePeriod: {
    type: "DID_FAIL_TO_RENEW",
    subtype: "GRACE_PERIOD",
    expiresDate: FUTURE,
  },
  RecoverFromGracePeriod: {
    type: "DID_RENEW",
    subtype: "BILLING_RECOVERY",
    expiresDate: FUTURE + 100,
  },
  EnterBillingRetry: { type: "DID_FAIL_TO_RENEW", expiresDate: FUTURE },
  RecoverFromBillingRetry: {
    type: "DID_RENEW",
    subtype: "BILLING_RECOVERY",
    expiresDate: FUTURE + 100,
  },
  Refund: { type: "REFUND", expiresDate: FUTURE },
  Revoke: { type: "REVOKE", expiresDate: FUTURE },
  // Apple has no subscription pause/resume notification.
  Pause: null,
  Resume: null,
};

const appleAdapter: ProviderAdapter = {
  name: "apple",
  productId: "com.example.premium",
  supports: new Set(
    (Object.keys(APPLE_EVENTS) as LifecycleEvent[]).filter(
      (key) => APPLE_EVENTS[key] !== null,
    ),
  ),
  normalize(event, ctx) {
    const spec = APPLE_EVENTS[event];
    if (!spec) throw new Error(`apple adapter cannot express ${event}`);

    const transaction: AppleDecodedTransaction = {
      originalTransactionId: ctx.purchaseToken,
      productId: ctx.productId,
      expiresDate: spec.expiresDate,
    };
    const renewalInfo: AppleDecodedRenewalInfo | undefined =
      spec.expirationIntent === undefined
        ? undefined
        : { expirationIntent: spec.expirationIntent };

    return normalizeAppleAsn({
      payload: applePayload(spec.type, spec.subtype, `${event}-${ctx.index}`),
      transaction,
      renewalInfo,
    });
  },
};

// ---------------------------------------------------------------------------
// Google adapter
// ---------------------------------------------------------------------------

function googleSubPayload(
  messageId: string,
  notificationType: number,
  purchaseToken: string,
): GoogleRtdnPayload {
  return {
    messageId,
    eventTimeMillis: 1_711_000_000_000,
    packageName: "com.example.app",
    subscriptionNotification: {
      version: "1.0",
      notificationType,
      purchaseToken,
      subscriptionId: "premium_monthly",
    },
  };
}

// RTDN subscription notification types.
const RTDN = {
  RECOVERED: 1,
  RENEWED: 2,
  CANCELED: 3,
  PURCHASED: 4,
  ON_HOLD: 5,
  IN_GRACE_PERIOD: 6,
  REVOKED: 12,
  EXPIRED: 13,
  PAUSED: 10,
} as const;

// A Google refund is a voidedPurchaseNotification: a different top-level
// payload shape, not just a different notification type code.
function googleVoidedPayload(
  messageId: string,
  purchaseToken: string,
): GoogleRtdnPayload {
  return {
    messageId,
    eventTimeMillis: 1_711_000_000_000,
    voidedPurchaseNotification: { purchaseToken },
  };
}

type GoogleEventSpec =
  | {
      kind: "subscription";
      notificationType: number;
      state?: GoogleSubscriptionInfo["state"];
      cancelReason?: string;
    }
  | { kind: "voided" };

const GOOGLE_EVENTS: Record<LifecycleEvent, GoogleEventSpec | null> = {
  InitialPurchase: {
    kind: "subscription",
    notificationType: RTDN.PURCHASED,
    state: "SUBSCRIPTION_STATE_ACTIVE",
  },
  Renew: {
    kind: "subscription",
    notificationType: RTDN.RENEWED,
    state: "SUBSCRIPTION_STATE_ACTIVE",
  },
  DisableAutoRenew: {
    kind: "subscription",
    notificationType: RTDN.CANCELED,
    state: "SUBSCRIPTION_STATE_CANCELED",
    cancelReason: "USER_CANCELED",
  },
  Expire: {
    kind: "subscription",
    notificationType: RTDN.EXPIRED,
    state: "SUBSCRIPTION_STATE_EXPIRED",
  },
  EnterGracePeriod: {
    kind: "subscription",
    notificationType: RTDN.IN_GRACE_PERIOD,
    state: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  },
  RecoverFromGracePeriod: {
    kind: "subscription",
    notificationType: RTDN.RECOVERED,
    state: "SUBSCRIPTION_STATE_ACTIVE",
  },
  EnterBillingRetry: {
    kind: "subscription",
    notificationType: RTDN.ON_HOLD,
    state: "SUBSCRIPTION_STATE_ON_HOLD",
  },
  RecoverFromBillingRetry: {
    kind: "subscription",
    notificationType: RTDN.RECOVERED,
    state: "SUBSCRIPTION_STATE_ACTIVE",
  },
  Refund: { kind: "voided" },
  Revoke: {
    kind: "subscription",
    notificationType: RTDN.REVOKED,
    state: "SUBSCRIPTION_STATE_EXPIRED",
  },
  Pause: {
    kind: "subscription",
    notificationType: RTDN.PAUSED,
    state: "SUBSCRIPTION_STATE_PAUSED",
  },
  // Resume arrives as RECOVERED (1). Pause-schedule-changed (11) is only the
  // schedule update, not the end-of-pause signal (see PR #123).
  Resume: {
    kind: "subscription",
    notificationType: RTDN.RECOVERED,
    state: "SUBSCRIPTION_STATE_ACTIVE",
  },
};

const googleAdapter: ProviderAdapter = {
  name: "google",
  productId: "premium_monthly",
  supports: new Set(
    (Object.keys(GOOGLE_EVENTS) as LifecycleEvent[]).filter(
      (key) => GOOGLE_EVENTS[key] !== null,
    ),
  ),
  normalize(event, ctx) {
    const spec = GOOGLE_EVENTS[event];
    if (!spec) throw new Error(`google adapter cannot express ${event}`);

    const messageId = `${event}-${ctx.index}`;
    if (spec.kind === "voided") {
      return normalizeGoogleRtdn({
        payload: googleVoidedPayload(messageId, ctx.purchaseToken),
      });
    }

    return normalizeGoogleRtdn({
      payload: googleSubPayload(
        messageId,
        spec.notificationType,
        ctx.purchaseToken,
      ),
      subscriptionInfo:
        spec.state || spec.cancelReason
          ? { state: spec.state, cancelReason: spec.cancelReason }
          : undefined,
    });
  },
};

const ADAPTERS: ProviderAdapter[] = [appleAdapter, googleAdapter];

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

for (const adapter of ADAPTERS) {
  describe(`conformance: ${adapter.name} lifecycle scenarios`, () => {
    for (const scenario of SCENARIOS) {
      const unsupported = scenario.steps
        .map((step) => step.event)
        .filter((event) => !adapter.supports.has(event));

      if (unsupported.length > 0) {
        // Reported as a skip so a capability gap stays visible.
        it.skip(`${scenario.name} (unsupported: ${[...new Set(unsupported)].join(", ")})`, () => {});
        continue;
      }

      it(scenario.name, () => {
        const final = runScenario(adapter, scenario);
        expect(
          entitlementActive(final!),
          `${adapter.name}/${scenario.name} entitlement`,
        ).toBe(scenario.entitledAtEnd);
      });
    }
  });
}

describe("conformance: harness integrity", () => {
  it("runs every scenario against at least one provider", () => {
    for (const scenario of SCENARIOS) {
      const capable = ADAPTERS.filter((adapter) =>
        scenario.steps.every((step) => adapter.supports.has(step.event)),
      );
      expect(
        capable.length,
        `${scenario.name} has no capable provider`,
      ).toBeGreaterThan(0);
    }
  });

  // Binds this suite to the versioned spec: a lifecycle behavior added to
  // packages/conformance with no scenario demonstrating it fails here.
  it("covers every lifecycle behavior in the conformance spec", () => {
    const covered = new Set(SCENARIOS.flatMap((scenario) => scenario.covers));
    const specIds = behaviorsByCategory("lifecycle").map(
      (behavior: { id: string }) => behavior.id,
    );

    expect(specIds.length).toBeGreaterThan(0);
    for (const id of specIds) {
      expect(covered, `no scenario covers ${id}`).toContain(id);
    }
  });

  it("references only behavior ids the spec defines", () => {
    const specIds = new Set(
      behaviorsByCategory("lifecycle").map(
        (behavior: { id: string }) => behavior.id,
      ),
    );
    for (const scenario of SCENARIOS) {
      for (const id of scenario.covers) {
        expect(
          specIds,
          `${scenario.name} references unknown behavior ${id}`,
        ).toContain(id);
      }
    }
  });

  it("declares provider support for every abstract lifecycle event", () => {
    const allEvents = new Set<LifecycleEvent>(
      SCENARIOS.flatMap((s) => s.steps.map((x) => x.event)),
    );
    for (const event of allEvents) {
      const capable = ADAPTERS.filter((adapter) => adapter.supports.has(event));
      expect(capable.length, `no provider expresses ${event}`).toBeGreaterThan(
        0,
      );
    }
  });
});
