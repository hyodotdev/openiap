import { describe, expect, it, vi } from "vitest";

import {
  ProductSyncCancelledError,
  pushAscReviewLocalizations,
  ascCustomerPriceToMicros,
  createAscReviewEligibilityLoader,
  getAscReviewFinalizeDisposition,
  mapAscReviewProductType,
  mapAscOfferDurationToIso,
  mapAscOfferKind,
  mapBillingPeriodToAsc,
  parseIntroOffers,
  pickActivePriceRow,
  pickPricePointIdMatching,
  shouldMarkAscReviewSubmissionOutcomePushed,
} from "./asc";
import type { AscReviewVersionItem } from "./ascReview";

type EligibilityClient = Parameters<
  typeof createAscReviewEligibilityLoader
>[0]["client"];

function createEligibilityClient() {
  return {
    listInAppPurchases: vi
      .fn<EligibilityClient["listInAppPurchases"]>()
      .mockResolvedValue({ data: [] }),
    listInAppPurchaseVersions: vi
      .fn<EligibilityClient["listInAppPurchaseVersions"]>()
      .mockResolvedValue({ data: [] }),
    listSubscriptionGroups: vi
      .fn<EligibilityClient["listSubscriptionGroups"]>()
      .mockResolvedValue({ data: [] }),
    listSubscriptionsInGroup: vi
      .fn<EligibilityClient["listSubscriptionsInGroup"]>()
      .mockResolvedValue({ data: [] }),
    listSubscriptionGroupVersions: vi
      .fn<EligibilityClient["listSubscriptionGroupVersions"]>()
      .mockResolvedValue({ data: [] }),
    listSubscriptionVersions: vi
      .fn<EligibilityClient["listSubscriptionVersions"]>()
      .mockResolvedValue({ data: [] }),
  };
}

function reviewItem(
  productType: AscReviewVersionItem["productType"],
  overrides: Partial<AscReviewVersionItem> = {},
): AscReviewVersionItem {
  return {
    productId: `local-${productType}`,
    storeRef: `store-${productType}`,
    kind: productType === "Subscription" ? "subscription" : "iap",
    productType,
    versionId: `version-${productType}`,
    ...overrides,
  };
}

describe("createAscReviewEligibilityLoader", () => {
  it("checks only matching IAP histories for a Consumable candidate", async () => {
    const client = createEligibilityClient();
    client.listInAppPurchases.mockResolvedValue({
      data: [
        {
          id: "consumable-history",
          type: "inAppPurchases",
          attributes: {
            inAppPurchaseType: "CONSUMABLE",
            state: "READY_TO_SUBMIT",
          },
        },
        {
          id: "unrelated-non-consumable",
          type: "inAppPurchases",
          attributes: {
            inAppPurchaseType: "NON_CONSUMABLE",
            state: "READY_TO_SUBMIT",
          },
        },
      ],
    });
    client.listInAppPurchaseVersions.mockResolvedValue({
      data: [
        {
          id: "consumable-approved-version",
          attributes: { state: "APPROVED" },
        },
      ],
    });
    const loader = createAscReviewEligibilityLoader({
      client,
      appId: "app-1",
      checkCancelled: vi.fn(async () => undefined),
    });

    await expect(loader.getActions(reviewItem("Consumable"))).resolves.toEqual(
      [],
    );
    expect(client.listSubscriptionGroups).not.toHaveBeenCalled();
    expect(client.listSubscriptionsInGroup).not.toHaveBeenCalled();
    expect(client.listSubscriptionGroupVersions).not.toHaveBeenCalled();
    expect(client.listSubscriptionVersions).not.toHaveBeenCalled();
    expect(client.listInAppPurchaseVersions).toHaveBeenCalledTimes(1);
    expect(client.listInAppPurchaseVersions).toHaveBeenCalledWith(
      "consumable-history",
    );
    expect(client.listInAppPurchaseVersions).not.toHaveBeenCalledWith(
      "unrelated-non-consumable",
    );
  });

  it("uses an approved parent without loading any IAP version history", async () => {
    const client = createEligibilityClient();
    client.listInAppPurchases.mockResolvedValue({
      data: [
        {
          id: "approved-consumable",
          type: "inAppPurchases",
          attributes: {
            inAppPurchaseType: "CONSUMABLE",
            state: "APPROVED",
          },
        },
        {
          id: "draft-consumable",
          type: "inAppPurchases",
          attributes: {
            inAppPurchaseType: "CONSUMABLE",
            state: "READY_TO_SUBMIT",
          },
        },
      ],
    });
    const loader = createAscReviewEligibilityLoader({
      client,
      appId: "app-1",
      checkCancelled: vi.fn(async () => undefined),
    });

    await expect(loader.getActions(reviewItem("Consumable"))).resolves.toEqual(
      [],
    );
    expect(client.listInAppPurchaseVersions).not.toHaveBeenCalled();
  });

  it("stops scheduling later history candidates after a bounded concurrent match", async () => {
    const client = createEligibilityClient();
    client.listInAppPurchases.mockResolvedValue({
      data: Array.from({ length: 6 }, (_, index) => ({
        id: `consumable-${index + 1}`,
        type: "inAppPurchases" as const,
        attributes: {
          inAppPurchaseType: "CONSUMABLE",
          state: "READY_TO_SUBMIT",
        },
      })),
    });
    client.listInAppPurchaseVersions.mockImplementation(async (id) => ({
      data:
        id === "consumable-1"
          ? [{ id: "approved-history", attributes: { state: "APPROVED" } }]
          : [],
    }));
    const loader = createAscReviewEligibilityLoader({
      client,
      appId: "app-1",
      checkCancelled: vi.fn(async () => undefined),
    });

    await expect(loader.getActions(reviewItem("Consumable"))).resolves.toEqual(
      [],
    );
    expect(client.listInAppPurchaseVersions).toHaveBeenCalledTimes(3);
    expect(
      client.listInAppPurchaseVersions.mock.calls.map(([id]) => id),
    ).toEqual(["consumable-1", "consumable-2", "consumable-3"]);
  });

  it("reuses type, group, subscription, and history caches across repeated checks", async () => {
    const client = createEligibilityClient();
    client.listSubscriptionGroups.mockResolvedValue({
      data: [
        {
          id: "group-pro",
          type: "subscriptionGroups",
          attributes: { referenceName: "Pro" },
        },
      ],
    });
    client.listSubscriptionsInGroup.mockResolvedValue({
      data: [
        {
          id: "approved-subscription",
          type: "subscriptions",
          attributes: { state: "APPROVED" },
        },
      ],
    });
    client.listSubscriptionGroupVersions.mockResolvedValue({
      data: [
        {
          id: "approved-group-version",
          type: "subscriptionGroupVersions",
          attributes: { state: "APPROVED" },
        },
      ],
    });
    const loader = createAscReviewEligibilityLoader({
      client,
      appId: "app-1",
      checkCancelled: vi.fn(async () => undefined),
    });

    await expect(
      loader.getActions(
        reviewItem("Subscription", {
          productId: "local-sub-one",
          subscriptionGroupId: "group-pro",
        }),
      ),
    ).resolves.toEqual([]);
    await expect(
      loader.getActions(
        reviewItem("Subscription", {
          productId: "local-sub-two",
          subscriptionGroupId: "group-pro",
        }),
      ),
    ).resolves.toEqual([]);

    expect(client.listSubscriptionGroups).toHaveBeenCalledTimes(1);
    expect(client.listSubscriptionsInGroup).toHaveBeenCalledTimes(1);
    expect(client.listSubscriptionsInGroup).toHaveBeenCalledWith("group-pro");
    expect(client.listSubscriptionGroupVersions).toHaveBeenCalledTimes(1);
    expect(client.listSubscriptionGroupVersions).toHaveBeenCalledWith(
      "group-pro",
    );
    expect(client.listSubscriptionVersions).not.toHaveBeenCalled();
  });

  it("checks the target subscription group exactly without loading unrelated group versions", async () => {
    const client = createEligibilityClient();
    client.listSubscriptionGroups.mockResolvedValue({
      data: [
        {
          id: "group-approved-elsewhere",
          type: "subscriptionGroups",
          attributes: { referenceName: "Elsewhere" },
        },
        {
          id: "group-target",
          type: "subscriptionGroups",
          attributes: { referenceName: "Target" },
        },
      ],
    });
    client.listSubscriptionsInGroup.mockImplementation(async (groupId) => ({
      data:
        groupId === "group-approved-elsewhere"
          ? [
              {
                id: "approved-subscription",
                type: "subscriptions" as const,
                attributes: { state: "APPROVED" },
              },
            ]
          : [
              {
                id: "target-draft-subscription",
                type: "subscriptions" as const,
                attributes: { state: "READY_TO_SUBMIT" },
              },
            ],
    }));
    client.listSubscriptionGroupVersions.mockImplementation(
      async (groupId) => ({
        data:
          groupId === "group-approved-elsewhere"
            ? [
                {
                  id: "unrelated-approved-group-version",
                  type: "subscriptionGroupVersions" as const,
                  attributes: { state: "APPROVED" },
                },
              ]
            : [],
      }),
    );
    const loader = createAscReviewEligibilityLoader({
      client,
      appId: "app-1",
      checkCancelled: vi.fn(async () => undefined),
    });

    await expect(
      loader.getActions(
        reviewItem("Subscription", {
          subscriptionGroupId: "group-target",
        }),
      ),
    ).resolves.toMatchObject([
      {
        code: "subscription_group_required",
        productId: "local-Subscription",
      },
    ]);
    expect(client.listSubscriptionGroupVersions).toHaveBeenCalledTimes(1);
    expect(client.listSubscriptionGroupVersions).toHaveBeenCalledWith(
      "group-target",
    );
    expect(client.listSubscriptionGroupVersions).not.toHaveBeenCalledWith(
      "group-approved-elsewhere",
    );
  });
});

describe("getAscReviewFinalizeDisposition", () => {
  it("never attaches a version that already belongs to another review submission", () => {
    expect(
      getAscReviewFinalizeDisposition({
        alreadySubmitted: false,
        attachedToSubmission: true,
        screenshotConfigured: false,
      }),
    ).toBe("attached");
  });

  it("does not create a second submission even when a screenshot is configured", () => {
    expect(
      getAscReviewFinalizeDisposition({
        alreadySubmitted: false,
        attachedToSubmission: true,
        screenshotConfigured: true,
      }),
    ).toBe("attached");
  });
});

describe("shouldMarkAscReviewSubmissionOutcomePushed", () => {
  it("keeps every manual and failed outcome retryable", () => {
    const item = reviewItem("Consumable");
    expect(
      shouldMarkAscReviewSubmissionOutcomePushed({
        item,
        status: "manual",
        action: {
          productId: item.productId,
          code: "app_version_required",
          message: "Submit with an app version",
        },
      }),
    ).toBe(false);
    expect(
      shouldMarkAscReviewSubmissionOutcomePushed({
        item,
        status: "manual",
        action: {
          productId: item.productId,
          code: "review_submission_status_unknown",
          message: "Inspect App Store Connect",
        },
      }),
    ).toBe(false);
    expect(
      shouldMarkAscReviewSubmissionOutcomePushed({
        item,
        status: "failed",
        reason: "ASC unavailable",
      }),
    ).toBe(false);
  });

  it("marks only a confirmed submitted outcome", () => {
    expect(
      shouldMarkAscReviewSubmissionOutcomePushed({
        item: reviewItem("Consumable"),
        status: "submitted",
      }),
    ).toBe(true);
  });
});

describe("mapAscReviewProductType", () => {
  it("preserves Apple's non-renewing subscription type for manual gates", () => {
    expect(
      mapAscReviewProductType("NON_RENEWING_SUBSCRIPTION", "NonConsumable"),
    ).toBe("NonRenewingSubscription");
    expect(mapAscReviewProductType("NON_CONSUMABLE", "Consumable")).toBe(
      "NonConsumable",
    );
  });
});

describe("ascCustomerPriceToMicros", () => {
  it("converts ASC customerPrice strings to micros", () => {
    expect(ascCustomerPriceToMicros("0.99")).toBe(990_000);
    expect(ascCustomerPriceToMicros("9")).toBe(9_000_000);
  });

  it("returns undefined for malformed or unsafe prices", () => {
    expect(ascCustomerPriceToMicros(undefined)).toBeUndefined();
    expect(ascCustomerPriceToMicros("abc")).toBeUndefined();
    expect(ascCustomerPriceToMicros("-1")).toBeUndefined();
    expect(ascCustomerPriceToMicros("10000000000")).toBeUndefined();
  });
});

describe("pickPricePointIdMatching", () => {
  const list = {
    data: [
      {
        id: "tier-29",
        type: "inAppPurchasePricePoints" as const,
        attributes: { customerPrice: "0.29" },
      },
      {
        id: "tier-99",
        type: "inAppPurchasePricePoints" as const,
        attributes: { customerPrice: "0.99" },
      },
      {
        id: "tier-999",
        type: "inAppPurchasePricePoints" as const,
        attributes: { customerPrice: "9.99" },
      },
      {
        id: "tier-9999",
        type: "inAppPurchasePricePoints" as const,
        attributes: { customerPrice: "99.99" },
      },
      {
        id: "tier-malformed",
        type: "inAppPurchasePricePoints" as const,
        attributes: { customerPrice: "abc" },
      },
      {
        id: "tier-unsafe",
        type: "inAppPurchasePricePoints" as const,
        attributes: { customerPrice: "9007199254.740993" },
      },
      {
        id: "tier-empty",
        type: "inAppPurchasePricePoints" as const,
        attributes: {},
      },
    ],
  };

  it("returns null when the catalog response is null", () => {
    expect(pickPricePointIdMatching(null, 9_990_000)).toBeNull();
  });

  it("returns null when no tier matches the requested USD amount", () => {
    expect(pickPricePointIdMatching(list, 1_500_000)).toBeNull();
  });

  it("returns null for invalid requested amounts", () => {
    expect(pickPricePointIdMatching(list, -1)).toBeNull();
    expect(pickPricePointIdMatching(list, 1.5)).toBeNull();
    expect(
      pickPricePointIdMatching(list, Number.MAX_SAFE_INTEGER + 1),
    ).toBeNull();
  });

  it("matches an exact tier on the cent boundary", () => {
    expect(pickPricePointIdMatching(list, 9_990_000)).toBe("tier-999");
    expect(pickPricePointIdMatching(list, 290_000)).toBe("tier-29");
    expect(pickPricePointIdMatching(list, 99_990_000)).toBe("tier-9999");
  });

  it("absorbs one-cent floating-point drift in the requested amount", () => {
    expect(pickPricePointIdMatching(list, 9_989_999)).toBe("tier-999");
    expect(pickPricePointIdMatching(list, 9_985_000)).toBe("tier-999");
  });

  it("skips malformed, missing, and unsafe customerPrice rows", () => {
    expect(pickPricePointIdMatching(list, 0)).toBeNull();
    expect(pickPricePointIdMatching(list, Number.MAX_SAFE_INTEGER)).toBeNull();
  });
});

describe("mapBillingPeriodToAsc", () => {
  it.each([
    ["P1W", "ONE_WEEK"],
    ["P1M", "ONE_MONTH"],
    ["P2M", "TWO_MONTHS"],
    ["P3M", "THREE_MONTHS"],
    ["P6M", "SIX_MONTHS"],
    ["P1Y", "ONE_YEAR"],
  ] as const)("maps %s → %s", (iso, asc) => {
    expect(mapBillingPeriodToAsc(iso)).toBe(asc);
  });

  it("defaults undefined / unknown periods to ONE_MONTH so push doesn't silently drop the picker", () => {
    expect(mapBillingPeriodToAsc(undefined)).toBe("ONE_MONTH");
    // Unknown periods throw — silently coercing to ONE_MONTH used
    // to provision the wrong subscription duration in ASC, which is
    // much harder to unwind than a failed sync. The throw is caught
    // inside processOneDraft and recorded as a per-row failure.
    const wider = mapBillingPeriodToAsc as (
      period: string | undefined,
    ) => string;
    expect(() => wider("P9X")).toThrow(/Invalid billing period/);
  });
});

describe("mapAscOfferDurationToIso", () => {
  it.each([
    ["THREE_DAYS", "P3D"],
    ["ONE_WEEK", "P1W"],
    ["TWO_WEEKS", "P2W"],
    ["ONE_MONTH", "P1M"],
    ["TWO_MONTHS", "P2M"],
    ["THREE_MONTHS", "P3M"],
    ["SIX_MONTHS", "P6M"],
    ["ONE_YEAR", "P1Y"],
  ])("normalizes ASC enum %s → ISO %s", (asc, iso) => {
    expect(mapAscOfferDurationToIso(asc)).toBe(iso);
  });

  it("returns undefined when no input", () => {
    expect(mapAscOfferDurationToIso(undefined)).toBeUndefined();
  });

  it("passes unknown enum values through unchanged so future Apple values still render", () => {
    expect(mapAscOfferDurationToIso("FOUR_MOONS")).toBe("FOUR_MOONS");
  });
});

describe("mapAscOfferKind", () => {
  it.each([
    ["FREE_TRIAL", "FreeTrial"],
    ["PAY_UP_FRONT", "IntroPayUpFront"],
    ["PAY_AS_YOU_GO", "IntroPayAsYouGo"],
  ] as const)("maps %s → %s", (mode, kind) => {
    expect(mapAscOfferKind(mode)).toBe(kind);
  });

  it("falls back to FreeTrial for unknown / undefined modes", () => {
    expect(mapAscOfferKind(undefined)).toBe("FreeTrial");
    expect(mapAscOfferKind("UNKNOWN")).toBe("FreeTrial");
  });
});

describe("pickActivePriceRow", () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  it("returns null for empty input", () => {
    expect(pickActivePriceRow([])).toBeNull();
  });

  it("picks the row whose date window covers today", () => {
    const rows = [
      { id: "future", attributes: { startDate: tomorrow, endDate: null } },
      { id: "active", attributes: { startDate: yesterday, endDate: null } },
    ];
    expect(pickActivePriceRow(rows)?.id).toBe("active");
  });

  it("treats null start / end as open bounds", () => {
    const rows = [
      { id: "open", attributes: { startDate: null, endDate: null } },
    ];
    expect(pickActivePriceRow(rows)?.id).toBe("open");
  });

  it("rejects rows whose endDate has already passed", () => {
    const rows = [
      {
        id: "expired",
        attributes: { startDate: yesterday, endDate: yesterday },
      },
      { id: "active", attributes: { startDate: yesterday, endDate: tomorrow } },
    ];
    expect(pickActivePriceRow(rows)?.id).toBe("active");
  });

  it("falls back to the first row when no window covers today (defensive default)", () => {
    const rows = [
      { id: "future-a", attributes: { startDate: tomorrow, endDate: null } },
      { id: "future-b", attributes: { startDate: tomorrow, endDate: null } },
    ];
    expect(pickActivePriceRow(rows)?.id).toBe("future-a");
  });

  it("accepts a row whose startDate equals today (only strictly-future startDates are rejected)", () => {
    const rows = [
      { id: "starts-today", attributes: { startDate: today, endDate: null } },
    ];
    expect(pickActivePriceRow(rows)?.id).toBe("starts-today");
  });
});

describe("parseIntroOffers", () => {
  const today = new Date().toISOString().slice(0, 10);

  it("returns [] when no response or empty data", () => {
    expect(parseIntroOffers(null)).toEqual([]);
    expect(parseIntroOffers({ data: [] })).toEqual([]);
  });

  it("parses a free-trial offer (no pricePoint, just duration)", () => {
    const out = parseIntroOffers({
      data: [
        {
          id: "offer-free",
          type: "subscriptionIntroductoryOffers" as const,
          attributes: {
            offerMode: "FREE_TRIAL",
            duration: "ONE_WEEK",
            numberOfPeriods: 1,
            startDate: today,
            endDate: null,
          },
          relationships: {},
        },
      ],
    });
    expect(out).toEqual([
      {
        id: "offer-free",
        kind: "FreeTrial",
        duration: "P1W",
        numberOfPeriods: 1,
        priceAmountMicros: undefined,
        currency: undefined,
      },
    ]);
  });

  it("parses a pay-up-front intro with included pricePoint", () => {
    const out = parseIntroOffers({
      data: [
        {
          id: "offer-paid",
          type: "subscriptionIntroductoryOffers" as const,
          attributes: {
            offerMode: "PAY_UP_FRONT",
            duration: "THREE_MONTHS",
            numberOfPeriods: 1,
          },
          relationships: {
            subscriptionPricePoint: {
              data: { id: "pp-99" },
            },
          },
        },
      ],
      included: [
        {
          id: "pp-99",
          type: "subscriptionPricePoints" as const,
          attributes: { customerPrice: "0.99" },
        },
      ],
    });
    expect(out).toEqual([
      {
        id: "offer-paid",
        kind: "IntroPayUpFront",
        duration: "P3M",
        numberOfPeriods: 1,
        priceAmountMicros: 990_000,
        currency: "USD",
      },
    ]);
  });

  it("filters out offers whose date window doesn't cover today", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const out = parseIntroOffers({
      data: [
        {
          id: "offer-future",
          type: "subscriptionIntroductoryOffers" as const,
          attributes: {
            offerMode: "FREE_TRIAL",
            duration: "ONE_WEEK",
            startDate: future,
            endDate: null,
          },
        },
      ],
    });
    expect(out).toEqual([]);
  });
});

describe("pushAscReviewLocalizations", () => {
  const listings = [
    { locale: "en-US", title: "Coins", description: "100 coins" },
    { locale: "ko-KR", title: "코인" },
    { locale: "ja-JP", title: "コイン" },
  ];

  it("writes every locale, not just the base listing", async () => {
    const seen: string[] = [];
    await pushAscReviewLocalizations({
      listings,
      productId: "coins",
      upsert: async (l) => {
        seen.push(l.locale);
      },
      recordFailure: () => {
        throw new Error("unexpected failure");
      },
    });
    expect(seen).toEqual(["en-US", "ko-KR", "ja-JP"]);
  });

  it("keeps going after one locale fails, and names it", async () => {
    const seen: string[] = [];
    const failures: Array<{ productId: string; reason: string }> = [];
    await pushAscReviewLocalizations({
      listings,
      productId: "coins",
      upsert: async (l) => {
        seen.push(l.locale);
        if (l.locale === "ko-KR") throw new Error("ASC rejected it");
      },
      recordFailure: (f) => failures.push(f),
    });
    // ja-JP must still be attempted.
    expect(seen).toEqual(["en-US", "ko-KR", "ja-JP"]);
    expect(failures).toEqual([
      { productId: "coins (localization ko-KR)", reason: "ASC rejected it" },
    ]);
  });

  it("propagates a base-listing failure so the row fails", async () => {
    await expect(
      pushAscReviewLocalizations({
        listings,
        productId: "coins",
        upsert: async () => {
          throw new Error("base blew up");
        },
        recordFailure: () => undefined,
      }),
    ).rejects.toThrow("base blew up");
  });

  it("lets a cancellation keep unwinding instead of grinding on", async () => {
    const seen: string[] = [];
    await expect(
      pushAscReviewLocalizations({
        listings,
        productId: "coins",
        upsert: async (l) => {
          seen.push(l.locale);
          if (l.locale === "ko-KR") throw new ProductSyncCancelledError();
        },
        recordFailure: () => {
          throw new Error("cancellation must not be recorded as a failure");
        },
      }),
    ).rejects.toBeInstanceOf(ProductSyncCancelledError);
    expect(seen).toEqual(["en-US", "ko-KR"]);
  });
});
