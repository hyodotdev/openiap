import { describe, expect, it } from "vitest";
import { deltaForInsert, deltaForUpdate } from "./stats";

describe("deltaForInsert", () => {
  it("counts an apple valid insert", () => {
    expect(deltaForInsert("apple", true)).toEqual({
      total: 1,
      apple: 1,
      google: 0,
      googleOrders: 0,
      valid: 1,
      invalid: 0,
    });
  });

  it("counts an apple invalid insert", () => {
    expect(deltaForInsert("apple", false)).toEqual({
      total: 1,
      apple: 1,
      google: 0,
      googleOrders: 0,
      valid: 0,
      invalid: 1,
    });
  });

  it("counts a google insert without orderId (pending ack) — google row but no order yet", () => {
    expect(deltaForInsert("google", true)).toEqual({
      total: 1,
      apple: 0,
      google: 1,
      googleOrders: 0,
      valid: 1,
      invalid: 0,
    });
  });

  it("counts a google insert with orderId — row AND distinct order move together", () => {
    expect(deltaForInsert("google", true, true)).toEqual({
      total: 1,
      apple: 0,
      google: 1,
      googleOrders: 1,
      valid: 1,
      invalid: 0,
    });
  });

  it("counts a google invalid insert with orderId — still an order, but invalid", () => {
    expect(deltaForInsert("google", false, true)).toEqual({
      total: 1,
      apple: 0,
      google: 1,
      googleOrders: 1,
      valid: 0,
      invalid: 1,
    });
  });

  it("ignores hasOrderId for apple — orders tracked only for Google", () => {
    // Apple receipts dedup on `originalTransactionId` already, so
    // there's no separate order concept to track.
    expect(deltaForInsert("apple", true, true)).toEqual({
      total: 1,
      apple: 1,
      google: 0,
      googleOrders: 0,
      valid: 1,
      invalid: 0,
    });
  });
});

describe("deltaForUpdate", () => {
  it("emits an empty delta when nothing changed", () => {
    expect(deltaForUpdate("apple", true, "apple", true)).toEqual({});
  });

  it("emits an empty delta when only the non-counted fields changed", () => {
    // Same store and same isValid — expect no counter movement.
    expect(deltaForUpdate("google", false, "google", false)).toEqual({});
  });

  it("moves valid -> invalid when isValid flips off", () => {
    expect(deltaForUpdate("apple", true, "apple", false)).toEqual({
      valid: -1,
      invalid: 1,
    });
  });

  it("moves invalid -> valid when isValid flips on", () => {
    expect(deltaForUpdate("google", false, "google", true)).toEqual({
      valid: 1,
      invalid: -1,
    });
  });

  it("swaps apple -> google when the store changes", () => {
    expect(deltaForUpdate("apple", true, "google", true)).toEqual({
      apple: -1,
      google: 1,
    });
  });

  it("swaps google -> apple when the store changes", () => {
    expect(deltaForUpdate("google", false, "apple", false)).toEqual({
      apple: 1,
      google: -1,
    });
  });

  it("combines store swap + isValid flip in a single delta", () => {
    expect(deltaForUpdate("apple", true, "google", false)).toEqual({
      apple: -1,
      google: 1,
      valid: -1,
      invalid: 1,
    });
  });

  it("never touches the total counter (update preserves count)", () => {
    const delta = deltaForUpdate("apple", true, "google", false);
    expect(delta.total).toBeUndefined();
  });

  it("increments googleOrders when a pending-ack google row gains an orderId", () => {
    expect(deltaForUpdate("google", true, "google", true, false, true)).toEqual(
      {
        googleOrders: 1,
      },
    );
  });

  it("decrements googleOrders if a google row loses its orderId (defensive)", () => {
    expect(deltaForUpdate("google", true, "google", true, true, false)).toEqual(
      {
        googleOrders: -1,
      },
    );
  });

  it("drops googleOrders when a google-with-orderId row migrates to apple", () => {
    // Store swap removes the "counts as google order" contribution in
    // addition to the store swap itself.
    expect(deltaForUpdate("google", true, "apple", true, true, false)).toEqual({
      apple: 1,
      google: -1,
      googleOrders: -1,
    });
  });

  it("combines isValid flip + orderId appearance on a single google row", () => {
    expect(
      deltaForUpdate("google", false, "google", true, false, true),
    ).toEqual({
      valid: 1,
      invalid: -1,
      googleOrders: 1,
    });
  });
});
