import { describe, expect, test } from "vitest";
import * as v from "valibot";

import { verifyPurchaseSuccessResponseSchema } from "./route-response-schemas";

function parse(input: unknown) {
  return v.safeParse(verifyPurchaseSuccessResponseSchema, input);
}

describe("verifyPurchaseSuccessResponseSchema", () => {
  test("requires the verified store in successful responses", () => {
    const result = parse({
      store: "amazon",
      isValid: true,
      state: "ENTITLED",
    });

    expect(result.success).toBe(true);
  });

  test("rejects legacy responses without store", () => {
    const result = parse({
      isValid: true,
      state: "ENTITLED",
    });

    expect(result.success).toBe(false);
  });

  test("rejects unknown stores", () => {
    const result = parse({
      store: "play-store",
      isValid: true,
      state: "ENTITLED",
    });

    expect(result.success).toBe(false);
  });
});
