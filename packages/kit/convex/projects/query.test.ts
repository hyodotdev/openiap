import { describe, expect, it } from "vitest";

import { selectActiveWebhookPublishableKey } from "./query";

describe("selectActiveWebhookPublishableKey", () => {
  it("selects the newest publishable key without returning secret material", () => {
    const selected = selectActiveWebhookPublishableKey([
      {
        createdAt: 100,
        isActive: true,
        key: "openiap-kit_pk_older",
        keyType: "publishable",
      },
      {
        createdAt: 300,
        isActive: true,
        key: "openiap-kit_sk_admin",
        keyType: "secret",
      },
      {
        createdAt: 200,
        isActive: true,
        key: "openiap-kit_pk_newer",
        keyType: "publishable",
      },
    ]);

    expect(selected).toBe("openiap-kit_pk_newer");
  });

  it("treats legacy unclassified keys as publishable and ignores revoked keys", () => {
    const selected = selectActiveWebhookPublishableKey([
      {
        createdAt: 100,
        isActive: true,
        key: "iapkit_legacy",
        keyType: undefined,
      },
      {
        createdAt: 200,
        isActive: false,
        key: "openiap-kit_sk_revoked",
        keyType: "secret",
      },
    ]);

    expect(selected).toBe("iapkit_legacy");
  });
});
