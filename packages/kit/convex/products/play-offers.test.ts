import { getFunctionName } from "convex/server";
import { google, type androidpublisher_v3 } from "googleapis";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";
import {
  collectPlaySubscriptionOffers,
  listPlaySubscriptionOffers,
  pickSubBasePlanPrice,
  runProductSyncAndroid,
} from "./play";

function subscription(
  productId = "pro",
): androidpublisher_v3.Schema$Subscription {
  return {
    productId,
    basePlans: [
      {
        basePlanId: "yearly",
        state: "ACTIVE",
        autoRenewingBasePlanType: { billingPeriodDuration: "P1Y" },
        regionalConfigs: [
          {
            regionCode: "US",
            newSubscriberAvailability: true,
            price: { currencyCode: "USD", units: "12" },
          },
        ],
      },
    ],
  };
}

function offer(
  config: androidpublisher_v3.Schema$RegionalSubscriptionOfferPhaseConfig = {
    relativeDiscount: 0.25,
  },
  productId = "pro",
): androidpublisher_v3.Schema$SubscriptionOffer {
  return {
    productId,
    basePlanId: "yearly",
    offerId: "intro",
    state: "ACTIVE",
    regionalConfigs: [{ regionCode: "US", newSubscriberAvailability: true }],
    phases: [
      {
        duration: "P3M",
        recurrenceCount: 1,
        regionalConfigs: [{ regionCode: "US", ...config }],
      },
    ],
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Play offer prices", () => {
  it.each([
    [
      { price: { currencyCode: "USD", units: "4", nanos: 990_000_000 } },
      "IntroPayUpFront",
      4_990_000,
    ],
    [{ relativeDiscount: 0.25 }, "IntroPayUpFront", 750_000],
    [
      { absoluteDiscount: { currencyCode: "USD", units: "1" } },
      "IntroPayUpFront",
      2_000_000,
    ],
    [{ free: {} }, "FreeTrial", undefined],
  ] as const)(
    "normalizes %j using its explicit override",
    (config, kind, priceAmountMicros) => {
      const rows = collectPlaySubscriptionOffers(subscription(), undefined, [
        offer(config),
      ]);
      expect(rows[1]).toMatchObject({ kind });
      expect(rows[1]?.priceAmountMicros).toBe(priceAmountMicros);
      expect(rows[1]?.currency).toBe(kind === "FreeTrial" ? undefined : "USD");
    },
  );

  it("keeps each recurring phase price separate from its recurrence count", () => {
    const intro = offer();
    intro.phases![0].recurrenceCount = 3;
    expect(
      collectPlaySubscriptionOffers(subscription(), undefined, [intro])[1],
    ).toMatchObject({
      kind: "IntroPayAsYouGo",
      numberOfPeriods: 3,
      priceAmountMicros: 750_000,
    });
  });

  it.each([
    ["USD", "9", 990_000_000, 5_000_000],
    ["JPY", "999", 0, 500_000_000],
  ] as const)(
    "rounds discounts to a billable %s amount",
    (currencyCode, units, nanos, expected) => {
      const sub = subscription();
      sub.basePlans![0].regionalConfigs![0].price = {
        currencyCode,
        units,
        nanos,
      };
      const intro = offer({ relativeDiscount: 0.5 });
      intro.phases![0].duration = "P1Y";
      expect(
        collectPlaySubscriptionOffers(sub, currencyCode, [intro])[1]
          ?.priceAmountMicros,
      ).toBe(expected);
    },
  );

  it("prorates week and day periods without multiplying the recurrence count", () => {
    const sub = subscription();
    sub.basePlans![0].autoRenewingBasePlanType!.billingPeriodDuration = "P4W";
    const intro = offer({ relativeDiscount: 0.5 });
    intro.phases![0].duration = "P7D";
    expect(
      collectPlaySubscriptionOffers(sub, undefined, [intro])[1]
        ?.priceAmountMicros,
    ).toBe(1_500_000);
  });

  it("keeps calendar-dependent discount amounts unknown instead of marking them free", () => {
    const intro = offer();
    intro.phases![0].duration = "P1W";
    const row = collectPlaySubscriptionOffers(subscription(), undefined, [
      intro,
    ])[1];
    expect(row).toMatchObject({ kind: "IntroPayUpFront", currency: "USD" });
    expect(row?.priceAmountMicros).toBeUndefined();
  });

  it.each([
    {},
    { relativeDiscount: 0 },
    { relativeDiscount: 1 },
    { relativeDiscount: Number.NaN },
    { absoluteDiscount: { currencyCode: "EUR", units: "1" } },
    { absoluteDiscount: { currencyCode: "USD", units: "4" } },
    { price: { currencyCode: "USD", units: "invalid" } },
  ])(
    "rejects an unreadable price override instead of treating it as a free trial: %j",
    (config) => {
      expect(() =>
        collectPlaySubscriptionOffers(subscription(), undefined, [
          offer(config),
        ]),
      ).toThrow();
    },
  );

  it("uses the base price in the same region as the chosen discount", () => {
    const sub = subscription();
    sub.basePlans![0].regionalConfigs!.unshift({
      regionCode: "EC",
      newSubscriberAvailability: true,
      price: { currencyCode: "USD", units: "120" },
    });
    const intro = offer();
    intro.regionalConfigs!.unshift({
      regionCode: "EC",
      newSubscriberAvailability: true,
    });
    intro.phases![0].regionalConfigs!.unshift({
      regionCode: "EC",
      relativeDiscount: 0.5,
    });
    expect(
      collectPlaySubscriptionOffers(sub, "USD", [intro])[1]?.priceAmountMicros,
    ).toBe(750_000);
    intro.regionalConfigs![1].newSubscriberAvailability = false;
    expect(
      collectPlaySubscriptionOffers(sub, "USD", [intro])[1]?.priceAmountMicros,
    ).toBe(15_000_000);
  });
});

describe("Play offer availability", () => {
  it.each(["DRAFT", "INACTIVE", "STATE_UNSPECIFIED", undefined])(
    "excludes a %s offer",
    (state) => {
      const intro = offer();
      intro.state = state;
      expect(
        collectPlaySubscriptionOffers(subscription(), undefined, [intro]).map(
          (row) => row.kind,
        ),
      ).toEqual(["BasePlan"]);
    },
  );

  it.each(["DRAFT", "INACTIVE", "STATE_UNSPECIFIED", undefined])(
    "excludes offers and prices from a %s base plan",
    (state) => {
      const sub = subscription();
      sub.basePlans![0].state = state;
      expect(collectPlaySubscriptionOffers(sub, undefined, [offer()])).toEqual(
        [],
      );
      expect(pickSubBasePlanPrice(sub)).toEqual({});
    },
  );

  it("does not attach an offer belonging to another product or base plan", () => {
    const wrongPlan = offer();
    wrongPlan.basePlanId = "monthly";
    expect(
      collectPlaySubscriptionOffers(subscription(), undefined, [
        offer({}, "other"),
        wrongPlan,
      ]),
    ).toHaveLength(1);
  });
});

function publisherFixture() {
  const oneTimes = vi.fn().mockResolvedValue({ data: {} });
  const offers = vi
    .fn()
    .mockResolvedValue({ data: { subscriptionOffers: [] } });
  const subscriptions = vi
    .fn()
    .mockResolvedValue({ data: { subscriptions: [] } });
  const publisher = {
    inappproducts: { list: oneTimes },
    monetization: {
      onetimeproducts: { list: vi.fn().mockResolvedValue({ data: {} }) },
      subscriptions: {
        list: subscriptions,
        basePlans: { offers: { list: offers } },
      },
    },
  } as unknown as androidpublisher_v3.Androidpublisher;
  return { publisher, offers, subscriptions, oneTimes };
}

describe("Play offer catalog pagination", () => {
  it("reads all products and base plans in one paginated stream", async () => {
    const { publisher, offers } = publisherFixture();
    const first = offer();
    const second = offer({ free: {} }, "another");
    offers.mockResolvedValueOnce({
      data: { subscriptionOffers: [first], nextPageToken: "next" },
    });
    offers.mockResolvedValueOnce({ data: { subscriptionOffers: [second] } });
    const checkCancelled = vi.fn(async () => undefined);
    const result = await listPlaySubscriptionOffers(
      publisher,
      "dev.test",
      checkCancelled,
    );
    expect(result.get("pro")).toEqual([first]);
    expect(result.get("another")).toEqual([second]);
    expect(offers.mock.calls).toEqual([
      [
        {
          packageName: "dev.test",
          productId: "-",
          basePlanId: "-",
          pageSize: 1000,
        },
      ],
      [
        {
          packageName: "dev.test",
          productId: "-",
          basePlanId: "-",
          pageSize: 1000,
          pageToken: "next",
        },
      ],
    ]);
    expect(checkCancelled).toHaveBeenCalledTimes(2);
  });

  it("rejects a truncated catalog at the page limit", async () => {
    const { publisher, offers } = publisherFixture();
    offers.mockResolvedValue({ data: { nextPageToken: "more" } });
    await expect(
      listPlaySubscriptionOffers(publisher, "dev.test", async () => undefined),
    ).rejects.toThrow("exceeded 50 pages");
    expect(offers).toHaveBeenCalledTimes(50);
  });

  it("accepts a complete catalog ending on page 50", async () => {
    const { publisher, offers } = publisherFixture();
    offers.mockImplementation(async () => ({
      data: offers.mock.calls.length < 50 ? { nextPageToken: "more" } : {},
    }));
    await expect(
      listPlaySubscriptionOffers(publisher, "dev.test", async () => undefined),
    ).resolves.toEqual(new Map());
    expect(offers).toHaveBeenCalledTimes(50);
  });
});

function workerFixture() {
  const fixture = publisherFixture();
  vi.spyOn(google, "androidpublisher").mockReturnValue(fixture.publisher);
  let cancelled = false;
  const writes: Array<{ name: string; args: Record<string, unknown> }> = [];
  const ctx = {
    runQuery: vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => {
      switch (getFunctionName(ref)) {
        case "products/jobs:getJobForWorker":
          return {
            status: "queued",
            projectId: "project",
            direction: "pull",
            dryRun: false,
          };
        case "products/jobs:isCancelRequested":
          return cancelled;
        case "projects/internal:getProjectById":
          return { _id: "project", androidPackageName: "dev.test" };
        case "files/internal:getGooglePlayFileByProjectInternal":
          return { _id: "file" };
        case "products/sync:listExistingProductTypes":
          return [];
        default:
          throw new Error(`Unexpected query: ${getFunctionName(ref)}`);
      }
    }),
    runAction: vi.fn(async () => ({ content: "{}" })),
    runMutation: vi.fn(
      async (
        ref: Parameters<typeof getFunctionName>[0],
        args: Record<string, unknown>,
      ) => {
        writes.push({ name: getFunctionName(ref), args });
        return "row";
      },
    ),
  };
  return {
    ...fixture,
    writes,
    cancel: () => {
      cancelled = true;
    },
    run: () =>
      testableFunction(runProductSyncAndroid)._handler(ctx, {
        jobId: "job" as Id<"productSyncJobs">,
      }),
  };
}

describe("Play subscription pull worker", () => {
  it("records a bad subscription and persists later subscriptions and pages", async () => {
    const fixture = workerFixture();
    fixture.offers.mockResolvedValue({
      data: {
        subscriptionOffers: [
          offer({}, "broken"),
          offer(),
          offer({ free: {} }, "later"),
        ],
      },
    });
    fixture.subscriptions.mockResolvedValueOnce({
      data: {
        subscriptions: [subscription("broken"), subscription()],
        nextPageToken: "next-subs",
      },
    });
    fixture.subscriptions.mockResolvedValueOnce({
      data: { subscriptions: [subscription("later")] },
    });
    await fixture.run();
    const imported = fixture.writes.filter(
      (write) => write.name === "products/sync:upsertFromStore",
    );
    expect(imported.map((write) => write.args.productId)).toEqual([
      "pro",
      "later",
    ]);
    expect(imported[0]?.args.offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "IntroPayUpFront",
          priceAmountMicros: 750_000,
        }),
      ]),
    );
    expect(imported[1]?.args.offers).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "FreeTrial" })]),
    );
    expect(
      fixture.writes.find(
        (write) => write.name === "products/jobs:markJobSucceeded",
      )?.args,
    ).toMatchObject({
      pulled: 2,
      failures: [
        {
          productId: "broken",
          reason: "subscription import: Play offer phase has no price override",
        },
      ],
    });
    expect(fixture.offers).toHaveBeenCalledTimes(1);
    expect(fixture.subscriptions).toHaveBeenLastCalledWith({
      packageName: "dev.test",
      pageToken: "next-subs",
    });
  });

  it("does not overwrite subscriptions with a partial offer catalog after a page failure", async () => {
    const fixture = workerFixture();
    fixture.oneTimes.mockResolvedValueOnce({
      data: {
        inappproduct: [
          { sku: "credits", purchaseType: "managedUser", status: "active" },
        ],
      },
    });
    fixture.offers.mockResolvedValueOnce({
      data: { subscriptionOffers: [offer()], nextPageToken: "next" },
    });
    fixture.offers.mockRejectedValueOnce(new Error("offer page unavailable"));
    await fixture.run();
    expect(fixture.subscriptions).not.toHaveBeenCalled();
    expect(
      fixture.writes
        .filter((write) => write.name === "products/sync:upsertFromStore")
        .map((write) => write.args.productId),
    ).toEqual(["credits"]);
    expect(
      fixture.writes.find(
        (write) => write.name === "products/jobs:markJobSucceeded",
      )?.args,
    ).toMatchObject({
      pulled: 1,
      failures: [
        {
          productId: "(play list subscriptions)",
          reason: "offer page unavailable",
        },
      ],
    });
  });

  it("clears inactive offers and imports unavailable subscriptions as removed", async () => {
    const fixture = workerFixture();
    const sub = subscription();
    sub.basePlans![0].state = "INACTIVE";
    fixture.offers.mockResolvedValue({
      data: { subscriptionOffers: [offer()] },
    });
    fixture.subscriptions.mockResolvedValue({ data: { subscriptions: [sub] } });
    await fixture.run();
    expect(
      fixture.writes.find(
        (write) => write.name === "products/sync:upsertFromStore",
      )?.args,
    ).toMatchObject({
      productId: "pro",
      state: "Removed",
      offers: [],
    });
  });

  it("honors cancellation between offer pages before any subscription write", async () => {
    const fixture = workerFixture();
    fixture.offers.mockImplementationOnce(async () => {
      fixture.cancel();
      return { data: { nextPageToken: "next" } };
    });
    await fixture.run();
    expect(fixture.offers).toHaveBeenCalledTimes(1);
    expect(fixture.subscriptions).not.toHaveBeenCalled();
    expect(
      fixture.writes.find(
        (write) => write.name === "products/jobs:markJobFailed",
      )?.args.error,
    ).toBe("Cancelled by operator");
    expect(
      fixture.writes.some(
        (write) => write.name === "products/jobs:markJobSucceeded",
      ),
    ).toBe(false);
  });
});
