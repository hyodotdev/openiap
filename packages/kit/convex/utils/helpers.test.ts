import { describe, expect, it } from "vitest";

import { generateApiKey } from "./helpers";

describe("generateApiKey", () => {
  it("uses distinct publishable and secret prefixes", () => {
    const publishable = generateApiKey("publishable");
    const secret = generateApiKey("secret");

    expect(publishable).toMatch(/^openiap-kit_pk_[0-9a-f]{64}$/);
    expect(secret).toMatch(/^openiap-kit_sk_[0-9a-f]{64}$/);
    expect(publishable).not.toBe(secret);
  });
});
