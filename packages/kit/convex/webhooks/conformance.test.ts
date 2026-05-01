// End-to-end conformance harness driving the full webhook → state
// machine → entitlement decision path, using pre-canned ASN v2 + RTDN
// payloads. This is the "sandbox-without-Apple/Google" suite — every
// scenario starts from a deterministic notification payload and
// asserts the resulting `subscriptions` row + entitlement boolean.
//
// The harness exercises:
//   1. `normalizeAppleAsn` / `normalizeGoogleRtdn`   (webhook receiver)
//   2. `applySubscriptionTransition`                 (state machine)
//   3. `entitlementActive`                           (status route)
//
// Each scenario is a script of `(input event) -> (expected after)`
// transitions so we cover the multi-step lifecycle (purchase → renew
// → cancel → expire, billing-retry → recovery, refund, etc.) rather
// than just a single edge.

import { describe, expect, it } from "vitest";

import {
  normalizeAppleAsn,
  normalizeGoogleRtdn,
  type AppleAsnPayload,
  type AppleDecodedTransaction,
  type AppleDecodedRenewalInfo,
  type GoogleRtdnPayload,
  type GoogleSubscriptionInfo,
} from "./shared";
import {
  applySubscriptionTransition,
  entitlementActive,
  type CurrentSubscription,
} from "../subscriptions/stateMachine";

type AppleStep = {
  payload: AppleAsnPayload;
  transaction?: AppleDecodedTransaction | null;
  renewalInfo?: AppleDecodedRenewalInfo | null;
  expect: ExpectAfter;
};

type GoogleStep = {
  payload: GoogleRtdnPayload;
  subscriptionInfo?: GoogleSubscriptionInfo | null;
  expect: ExpectAfter;
};

type ExpectAfter = {
  state: NonNullable<CurrentSubscription>["state"];
  active: boolean;
  willRenew?: boolean;
  cancellationReason?: NonNullable<CurrentSubscription>["cancellationReason"];
};

function runAppleScenario(
  steps: AppleStep[],
  productId = "com.example.premium",
) {
  let current: CurrentSubscription = null;
  for (const [index, step] of steps.entries()) {
    const normalized = normalizeAppleAsn({
      payload: step.payload,
      transaction: {
        originalTransactionId: "txn-1",
        productId,
        ...(step.transaction ?? {}),
      },
      renewalInfo: step.renewalInfo,
    });
    const transition = applySubscriptionTransition(current, {
      type: normalized.type,
      productId: normalized.productId,
      subscriptionState: normalized.subscriptionState,
      expiresAt: normalized.expiresAt,
      renewsAt: normalized.renewsAt,
      cancellationReason: normalized.cancellationReason,
      currency: normalized.currency,
      priceAmountMicros: normalized.priceAmountMicros,
    });
    current = transition.next ?? current;
    expect(current?.state, `step ${index} state`).toBe(step.expect.state);
    expect(transition.active, `step ${index} active`).toBe(step.expect.active);
    if (step.expect.willRenew !== undefined) {
      expect(current?.willRenew, `step ${index} willRenew`).toBe(
        step.expect.willRenew,
      );
    }
    if (step.expect.cancellationReason !== undefined) {
      expect(
        current?.cancellationReason,
        `step ${index} cancellationReason`,
      ).toBe(step.expect.cancellationReason);
    }
  }
  return current;
}

function runGoogleScenario(steps: GoogleStep[], productId = "premium_monthly") {
  let current: CurrentSubscription = null;
  for (const [index, step] of steps.entries()) {
    const normalized = normalizeGoogleRtdn({
      payload: step.payload,
      subscriptionInfo: step.subscriptionInfo,
    });
    const transition = applySubscriptionTransition(current, {
      type: normalized.type,
      productId: normalized.productId ?? productId,
      subscriptionState: normalized.subscriptionState,
      expiresAt: normalized.expiresAt,
      renewsAt: normalized.renewsAt,
      cancellationReason: normalized.cancellationReason,
      currency: normalized.currency,
      priceAmountMicros: normalized.priceAmountMicros,
    });
    current = transition.next ?? current;
    expect(current?.state, `google step ${index} state`).toBe(
      step.expect.state,
    );
    expect(transition.active, `google step ${index} active`).toBe(
      step.expect.active,
    );
    if (step.expect.willRenew !== undefined) {
      expect(current?.willRenew, `google step ${index} willRenew`).toBe(
        step.expect.willRenew,
      );
    }
  }
  return current;
}

const FUTURE = 9_999_999_999_000;

describe("conformance: Apple lifecycle scenarios", () => {
  it("purchase → renew → cancel → expire", () => {
    const final = runAppleScenario([
      {
        payload: applePayload("SUBSCRIBED", "INITIAL_BUY", "u-1"),
        transaction: { originalTransactionId: "1", expiresDate: FUTURE },
        expect: { state: "Active", active: true, willRenew: true },
      },
      {
        payload: applePayload("DID_RENEW", undefined, "u-2"),
        transaction: {
          originalTransactionId: "1",
          expiresDate: FUTURE + 1,
        },
        expect: { state: "Active", active: true, willRenew: true },
      },
      {
        payload: applePayload(
          "DID_CHANGE_RENEWAL_STATUS",
          "AUTO_RENEW_DISABLED",
          "u-3",
        ),
        transaction: { originalTransactionId: "1", expiresDate: FUTURE + 1 },
        expect: {
          state: "Active",
          active: true,
          willRenew: false,
          cancellationReason: "UserCanceled",
        },
      },
      {
        payload: applePayload("EXPIRED", undefined, "u-4"),
        transaction: { originalTransactionId: "1", expiresDate: 0 },
        renewalInfo: { expirationIntent: 1 },
        expect: {
          state: "Expired",
          active: false,
          willRenew: false,
          cancellationReason: "UserCanceled",
        },
      },
    ]);
    expect(entitlementActive(final!)).toBe(false);
  });

  it("billing-retry → recovery", () => {
    runAppleScenario([
      {
        payload: applePayload("SUBSCRIBED", "INITIAL_BUY", "b-1"),
        transaction: { originalTransactionId: "2", expiresDate: FUTURE },
        expect: { state: "Active", active: true },
      },
      {
        payload: applePayload("DID_FAIL_TO_RENEW", "GRACE_PERIOD", "b-2"),
        transaction: { originalTransactionId: "2", expiresDate: FUTURE },
        expect: { state: "InGracePeriod", active: true },
      },
      {
        payload: applePayload("DID_RENEW", "BILLING_RECOVERY", "b-3"),
        transaction: {
          originalTransactionId: "2",
          expiresDate: FUTURE + 100,
        },
        expect: { state: "Active", active: true, willRenew: true },
      },
    ]);
  });

  it("refund flow flips state to Refunded and de-entitles", () => {
    runAppleScenario([
      {
        payload: applePayload("SUBSCRIBED", "INITIAL_BUY", "r-1"),
        transaction: { originalTransactionId: "3", expiresDate: FUTURE },
        expect: { state: "Active", active: true },
      },
      {
        payload: applePayload("REFUND", undefined, "r-2"),
        transaction: { originalTransactionId: "3", expiresDate: FUTURE },
        expect: {
          state: "Refunded",
          active: false,
          cancellationReason: "Refunded",
        },
      },
    ]);
  });
});

describe("conformance: Google lifecycle scenarios", () => {
  it("purchase → renew → on-hold → recovered", () => {
    runGoogleScenario([
      {
        payload: googleSubPayload("g-1", 4, "tok-1"),
        subscriptionInfo: { state: "SUBSCRIPTION_STATE_ACTIVE" },
        expect: { state: "Active", active: true },
      },
      {
        payload: googleSubPayload("g-2", 2, "tok-1"),
        subscriptionInfo: { state: "SUBSCRIPTION_STATE_ACTIVE" },
        expect: { state: "Active", active: true },
      },
      {
        payload: googleSubPayload("g-3", 5, "tok-1"),
        subscriptionInfo: { state: "SUBSCRIPTION_STATE_ON_HOLD" },
        expect: { state: "InBillingRetry", active: false },
      },
      {
        payload: googleSubPayload("g-4", 1, "tok-1"),
        subscriptionInfo: { state: "SUBSCRIPTION_STATE_ACTIVE" },
        expect: { state: "Active", active: true },
      },
    ]);
  });

  it("voided purchase flips to Refunded", () => {
    runGoogleScenario([
      {
        payload: googleSubPayload("v-1", 4, "tok-vp"),
        subscriptionInfo: { state: "SUBSCRIPTION_STATE_ACTIVE" },
        expect: { state: "Active", active: true },
      },
      {
        payload: {
          messageId: "v-2",
          eventTimeMillis: 1,
          voidedPurchaseNotification: { purchaseToken: "tok-vp" },
        },
        expect: { state: "Refunded", active: false },
      },
    ]);
  });

  it("paused → resumed", () => {
    runGoogleScenario([
      {
        payload: googleSubPayload("p-1", 4, "tok-p"),
        subscriptionInfo: { state: "SUBSCRIPTION_STATE_ACTIVE" },
        expect: { state: "Active", active: true },
      },
      {
        payload: googleSubPayload("p-2", 10, "tok-p"),
        subscriptionInfo: { state: "SUBSCRIPTION_STATE_PAUSED" },
        expect: { state: "Paused", active: false },
      },
      {
        // Resume in real RTDN comes back as RECOVERED (1) — pause-
        // schedule-changed (11) is only the schedule update, not the
        // actual end-of-pause signal. PR #123 review caught the
        // earlier draft mapping that treated 11 as Resumed.
        payload: googleSubPayload("p-3", 1, "tok-p"),
        subscriptionInfo: { state: "SUBSCRIPTION_STATE_ACTIVE" },
        expect: { state: "Active", active: true },
      },
    ]);
  });
});

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
      notificationType,
      purchaseToken,
      subscriptionId: "premium_monthly",
    },
  };
}
