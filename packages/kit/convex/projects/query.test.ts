import { describe, expect, it } from "vitest";

import { selectActiveWebhookApiKeys } from "./query";

describe("selectActiveWebhookApiKeys", () => {
  it("selects the newest publishable key without returning secret material", () => {
    const selected = selectActiveWebhookApiKeys([
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

    expect(selected).toEqual({
      publishableKey: "openiap-kit_pk_newer",
      hasSecretKey: true,
    });
    expect(selected).not.toHaveProperty("secretKey");
  });

  it("treats legacy unclassified keys as publishable and ignores revoked keys", () => {
    const selected = selectActiveWebhookApiKeys([
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

    expect(selected).toEqual({
      publishableKey: "iapkit_legacy",
      hasSecretKey: false,
    });
  });
});
