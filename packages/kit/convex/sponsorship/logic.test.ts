import { describe, expect, it } from "vitest";

import {
  collectPages,
  nextNotice,
  suggestedSponsorshipUsd,
  toUsd,
} from "./logic";

describe("toUsd", () => {
  it("sums USD and converts other currencies with units-per-dollar rates", () => {
    const { usd, unconverted } = toUsd(
      [
        { currency: "USD", micros: 5_000_000_000 },
        { currency: "krw", micros: 1_400_000_000_000 },
        { currency: "EUR", micros: 0 },
      ],
      { KRW: 1_400, EUR: 0.9 },
    );
    expect(usd).toBeCloseTo(6_000);
    expect(unconverted).toEqual([]);
  });

  it("reports currencies it cannot convert instead of guessing", () => {
    const { usd, unconverted } = toUsd(
      [
        { currency: "XYZ", micros: 9_000_000_000 },
        { currency: "USD", micros: 1_000_000 },
      ],
      {},
    );
    expect(usd).toBe(1);
    expect(unconverted).toEqual(["XYZ"]);
  });
});

describe("nextNotice", () => {
  it("stays quiet under $8,000", () => {
    expect(nextNotice(7_999, null)).toBeNull();
  });

  it("sends the advisory once from $8,000", () => {
    expect(nextNotice(8_000, null)).toBe("advisory");
    expect(nextNotice(8_500, { stage: "advisory" })).toBeNull();
  });

  it("sends the request once from $9,000, even after an advisory", () => {
    expect(nextNotice(9_000, null)).toBe("request");
    expect(nextNotice(9_400, { stage: "advisory" })).toBe("request");
    expect(nextNotice(12_000, { stage: "request" })).toBeNull();
  });

  it("never emails a sponsor", () => {
    expect(nextNotice(20_000, { sponsoredAt: 1 })).toBeNull();
  });
});

describe("suggestedSponsorshipUsd", () => {
  it("is 0.5% of monthly revenue, rounded up", () => {
    expect(suggestedSponsorshipUsd(9_000)).toBe(45);
    expect(suggestedSponsorshipUsd(10_000)).toBe(50);
    expect(suggestedSponsorshipUsd(9_001)).toBe(46);
  });
});

describe("collectPages", () => {
  const usd = (micros: number) => [{ currency: "USD", micros }];

  it("halves the page after a failure, including on the first page", async () => {
    const sizes: number[] = [];
    const amounts = await collectPages(async (cursor, numItems) => {
      sizes.push(numItems);
      if (numItems > 25) throw new Error("Too many bytes read");
      return cursor === null
        ? { amounts: usd(1), isDone: false, continueCursor: "next" }
        : { amounts: usd(2), isDone: true, continueCursor: "" };
    }, 100);
    expect(amounts).toEqual([...usd(1), ...usd(2)]);
    expect(sizes).toEqual([100, 50, 25, 25]);
  });

  it("throws when a one-item page still fails", async () => {
    await expect(
      collectPages(async () => {
        throw new Error("broken");
      }, 4),
    ).rejects.toThrow("broken");
  });
});
