import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import {
  apiKeyStorageFields,
  assertApiKeyAccess,
  effectiveApiKeyType,
  getApiKeyByKey,
  hashApiKeyForStorage,
  hashStoredSecretApiKeyPatch,
} from "./helpers";

describe("API key access", () => {
  it("classifies legacy keys as publishable", () => {
    expect(effectiveApiKeyType(undefined)).toBe("publishable");
    expect(effectiveApiKeyType("publishable")).toBe("publishable");
    expect(effectiveApiKeyType("secret")).toBe("secret");
  });

  it("allows both key types on client operations", () => {
    expect(() => assertApiKeyAccess("publishable", "client")).not.toThrow();
    expect(() => assertApiKeyAccess("secret", "client")).not.toThrow();
  });

  it("requires a secret key for admin operations", () => {
    expect(() => assertApiKeyAccess("secret", "admin")).not.toThrow();

    try {
      assertApiKeyAccess("publishable", "admin");
      throw new Error("Expected publishable key to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      expect((error as ConvexError<{ code: string }>).data.code).toBe(
        "INSUFFICIENT_SCOPE",
      );
    }
  });
});

describe("API key storage", () => {
  it("stores secret keys as a deterministic SHA-256 digest only", async () => {
    const raw = "openiap-kit_sk_do-not-store-this";
    const fields = await apiKeyStorageFields(raw, "secret");

    expect(fields).toEqual({
      keyHash: await hashApiKeyForStorage(raw),
      keyPreview: "openiap-kit_...this",
    });
    expect(fields).not.toHaveProperty("key");
    expect(JSON.stringify(fields)).not.toContain(raw);
  });

  it("keeps publishable keys recoverable for lifecycle webhook URLs", async () => {
    await expect(
      apiKeyStorageFields("openiap-kit_pk_public-1234", "publishable"),
    ).resolves.toEqual({
      key: "openiap-kit_pk_public-1234",
      keyPreview: "openiap-kit_...1234",
    });
  });

  it("resolves hashed keys before the plaintext migration fallback", async () => {
    const raw = "openiap-kit_sk_hashed";
    const keyHash = await hashApiKeyForStorage(raw);
    const rows = [
      { _id: "hashed", keyHash },
      { _id: "legacy", key: raw },
    ];
    const db = {
      query() {
        return {
          withIndex: (_name: string, build: (q: unknown) => unknown) => {
            let expected: unknown;
            const q = {
              eq: (_field: string, value: unknown) => {
                expected = value;
                return q;
              },
            };
            build(q);
            return {
              first: async () =>
                rows.find(
                  (row) => row.keyHash === expected || row.key === expected,
                ) ?? null,
            };
          },
        };
      },
    };

    await expect(getApiKeyByKey({ db } as never, raw)).resolves.toMatchObject({
      _id: "hashed",
    });
  });
});

describe("hashStoredSecretApiKeys migration patch", () => {
  // The migrations component applies the return value with db.patch, so only
  // an explicit `key: undefined` deletes the plaintext. These assert on
  // property PRESENCE — a patch that merely omits `key` keeps the secret.
  it("clears the plaintext and adds digest fields", async () => {
    const patch = await hashStoredSecretApiKeyPatch({
      keyType: "secret",
      key: "openiap-kit_sk_live_1234",
    });
    expect(patch).not.toBeNull();
    expect("key" in patch!).toBe(true);
    expect(patch!.key).toBeUndefined();
    expect(patch!.keyHash).toBe(
      await hashApiKeyForStorage("openiap-kit_sk_live_1234"),
    );
    expect(patch!.keyPreview).toBe("openiap-kit_...1234");
  });

  it("strips plaintext a half-run left behind without rehashing", async () => {
    const patch = await hashStoredSecretApiKeyPatch({
      keyType: "secret",
      key: "openiap-kit_sk_live_1234",
      keyHash: "existing-hash",
    });
    expect(patch).toEqual({ key: undefined });
    expect("key" in patch!).toBe(true);
  });

  it("leaves publishable and already-clean rows alone", async () => {
    await expect(
      hashStoredSecretApiKeyPatch({ keyType: "publishable", key: "x" }),
    ).resolves.toBeNull();
    await expect(
      hashStoredSecretApiKeyPatch({ keyType: "secret", keyHash: "h" }),
    ).resolves.toBeNull();
  });
});
