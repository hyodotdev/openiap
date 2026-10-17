import { describe, expect, it } from "vitest";
import {
  accessAt,
  eventAccessEvidence,
  foldAccessHistory,
  replaceAccessHistory,
  SUBSCRIPTION_SCAN_PAGE_SIZE,
  type AccessEvidence,
} from "./accessHistory";

const at = (date: string): number => Date.parse(date);
const JAN = at("2026-01-31T23:59:59.999Z");
const FEB = at("2026-02-28T23:59:59.999Z");
const MAR = at("2026-03-31T23:59:59.999Z");
function proof(
  date: string,
  active: boolean,
  expires?: string,
): AccessEvidence {
  const time = at(date);
  return {
    effectiveAt: time,
    sourceAt: time,
    sourceCreatedAt: time,
    active,
    ...(expires ? { expiresAt: at(expires) } : {}),
  };
}

describe("bounded access evidence", () => {
  it("keeps the lapse when a subscriber returns on the same token", () => {
    let history = foldAccessHistory(
      undefined,
      [proof("2026-01-01", true, "2026-02-01")],
      at("2026-01-01"),
    );
    history = foldAccessHistory(
      history,
      [proof("2026-02-01", false)],
      at("2026-02-01"),
    );
    history = foldAccessHistory(
      history,
      [proof("2026-03-01", true, "2026-04-01")],
      at("2026-03-15"),
    );
    expect([
      accessAt(history, JAN),
      accessAt(history, FEB),
      accessAt(history, at("2026-03-15")),
    ]).toEqual([true, false, true]);
  });

  it("does not erase paid access before a refund, or fill its reversal gap", () => {
    const now = at("2026-04-01");
    let history = foldAccessHistory(
      undefined,
      [proof("2026-01-01", true, "2026-06-01")],
      at("2026-01-01"),
    );
    history = foldAccessHistory(
      history,
      [proof("2026-02-01", false)],
      at("2026-02-01"),
    );
    history = foldAccessHistory(
      history,
      [proof("2026-03-01", true, "2026-06-01")],
      now,
    );
    expect([
      accessAt(history, JAN),
      accessAt(history, FEB),
      accessAt(history, MAR),
    ]).toEqual([true, false, true]);
  });

  it("converges when the expiry and original period arrive after the recovery", () => {
    let history = foldAccessHistory(
      undefined,
      [proof("2026-03-01", true, "2026-04-01")],
      at("2026-03-15"),
    );
    history = foldAccessHistory(
      history,
      [proof("2026-01-01", true, "2026-02-01")],
      at("2026-03-15"),
    );
    history = foldAccessHistory(
      history,
      [proof("2026-02-01", false)],
      at("2026-03-15"),
    );
    expect([
      accessAt(history, JAN),
      accessAt(history, FEB),
      accessAt(history, at("2026-03-15")),
    ]).toEqual([true, false, true]);
  });

  it("does not invent legacy history or an earlier in-flight snapshot", () => {
    expect(accessAt(undefined, JAN)).toBeNull();
    const history = foldAccessHistory(
      undefined,
      [proof("2026-03-15T12:00:00Z", true, "2026-04-01")],
      at("2026-03-15T13:00:00Z"),
    );
    expect(accessAt(history, at("2026-03-15T11:00:00Z"))).toBeNull();
    expect(accessAt(history, FEB)).toBeNull();
    expect(accessAt(history, at("2026-03-15T12:30:00Z"))).toBe(true);
  });

  it("cuts predecessor authority at replacement, even if its expiry is later", () => {
    const now = at("2026-06-01");
    const predecessor = foldAccessHistory(
      undefined,
      [proof("2026-01-01", true, "2026-05-01")],
      now,
    );
    const successor = foldAccessHistory(
      undefined,
      [proof("2026-03-01", true, "2026-07-01")],
      now,
    );
    let history = replaceAccessHistory(
      predecessor,
      successor,
      at("2026-03-01"),
      now,
    );
    history = foldAccessHistory(
      history,
      [proof("2026-05-01", false)],
      now,
      at("2026-03-01"),
    );
    expect(accessAt(history, JAN)).toBe(true);
    expect(accessAt(history, at("2026-05-31T23:59:59.999Z"))).toBe(true);
    expect(accessAt(history, now)).toBe(true);
  });

  it("keeps ambiguous legacy replacement history unknown", () => {
    const now = at("2026-06-01");
    const history = replaceAccessHistory(
      foldAccessHistory(undefined, [proof("2026-01-01", true)], now),
      foldAccessHistory(undefined, [proof("2026-05-01", true)], now),
      undefined,
      now,
    );
    expect(accessAt(history, JAN)).toBeNull();
    expect(accessAt(history, now)).toBe(true);
  });

  it("stores at most 54 cutoffs plus latest and stays within a page read budget", () => {
    let history = foldAccessHistory(
      undefined,
      [proof("2020-01-01", true)],
      at("2020-01-01"),
    );
    for (let i = 0; i < 1000; i++) {
      const time = Date.UTC(2020, 0, i + 2);
      history = foldAccessHistory(
        history,
        [
          {
            effectiveAt: time,
            sourceAt: time,
            sourceCreatedAt: time,
            active: i % 2 === 0,
            expiresAt: time + 86_400_000,
          },
        ],
        time,
      );
    }
    expect(history.checkpoints.length).toBeLessThanOrEqual(54);
    // Include 4 KB of ordinary row metadata in the 8 MiB conservative budget.
    expect(
      (JSON.stringify(history).length + 4096) * SUBSCRIPTION_SCAN_PAGE_SIZE,
    ).toBeLessThan(8 * 1024 * 1024);
  });
});

describe("store access boundaries", () => {
  it("uses Apple charge and revocation dates, preserving lifecycle signing order", () => {
    const common = {
      platform: "IOS" as const,
      occurredAt: at("2026-03-01"),
      purchaseDate: at("2026-01-31"),
      expiresAt: at("2026-04-01"),
    };
    expect(
      eventAccessEvidence({ ...common, type: "SubscriptionRenewed" })[0]
        .effectiveAt,
    ).toBe(at("2026-01-31"));
    expect(
      eventAccessEvidence({
        ...common,
        type: "PurchaseRefunded",
        revocationDate: at("2026-02-01"),
      })[0],
    ).toMatchObject({ effectiveAt: at("2026-02-01"), active: false });
    expect(
      eventAccessEvidence({
        ...common,
        type: "SubscriptionStarted",
        refundReversal: true,
      })[0].effectiveAt,
    ).toBe(common.occurredAt);
    expect(
      eventAccessEvidence({ ...common, type: "SubscriptionCanceled" }),
    ).toEqual([]);
    expect(
      eventAccessEvidence({ ...common, type: "SubscriptionPriceChange" }),
    ).toEqual([]);
  });

  it("does not backdate a current Play response into an old RTDN", () => {
    const now = at("2026-03-15");
    const evidence = eventAccessEvidence({
      platform: "Android",
      type: "SubscriptionRenewed",
      occurredAt: at("2026-01-01"),
      snapshotObservedAt: now,
      subscriptionState: "Active",
      expiresAt: at("2026-04-01"),
    });
    const history = foldAccessHistory(undefined, evidence, now);
    expect(accessAt(history, JAN)).toBeNull();
    expect(accessAt(history, FEB)).toBeNull();
    expect(accessAt(history, now)).toBe(true);
  });
  it("keeps a known Play snapshot when the notification and observation times tie", () => {
    const now = at("2026-03-15");
    const evidence = eventAccessEvidence({
      platform: "Android",
      type: "SubscriptionExpired",
      occurredAt: now,
      snapshotObservedAt: now,
      subscriptionState: "Expired",
    });
    expect(accessAt(foldAccessHistory(undefined, evidence, now), now)).toBe(
      false,
    );
  });
});
