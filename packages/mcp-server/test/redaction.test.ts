import { describe, expect, it } from "vitest";

import { redactSecretString } from "../src/mcp.js";

// The caller's own key and the environment key were already replaced by name.
// An upstream error body can carry a key that is neither, which is why the
// rule is a pattern rather than a list of known secrets.
describe("redactSecretString", () => {
  it("redacts a secret that is not the calling key", () => {
    const other = "openiap-kit_sk_someoneelsesproject";
    expect(
      redactSecretString(`upstream said ${other}`, "openiap-kit_sk_mine"),
    ).not.toContain(other);
  });

  it("redacts a publishable key too", () => {
    expect(
      redactSecretString("url /v1/products/openiap-kit_pk_live"),
    ).not.toContain("openiap-kit_pk_live");
  });

  it("still redacts a bearer header", () => {
    expect(redactSecretString("Authorization: Bearer abc123")).not.toContain(
      "abc123",
    );
  });

  it("leaves text with no credential alone", () => {
    expect(redactSecretString("subscription not found")).toBe(
      "subscription not found",
    );
  });
});
