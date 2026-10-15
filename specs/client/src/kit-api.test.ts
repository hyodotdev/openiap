import { describe, expect, it, vi } from "vitest";
import { kitApi, KitApiError, resolveLocalizedPayload } from "./kit-api";

function fakeFetch(
  recipe: (
    path: string,
    init?: RequestInit,
  ) => {
    status: number;
    body: unknown;
  },
) {
  return vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const path = url.pathname + url.search;
    const { status, body } = recipe(path, init);
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(text, { status });
  });
}

describe("kitApi", () => {
  it("calls /v1/subscriptions/status with the apiKey + userId", async () => {
    const fetchImpl = fakeFetch(() => ({
      status: 200,
      body: { active: true, subscription: null },
    }));
    const api = kitApi({
      apiKey: "k",
      baseUrl: "http://localhost",
      fetchImpl,
    });
    const result = await api.status("user-1");
    expect(result.active).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/v1/subscriptions/status/k?userId=user-1",
      expect.anything(),
    );
  });

  it("URL-encodes apiKey and userId", async () => {
    const fetchImpl = fakeFetch(() => ({
      status: 200,
      body: { userId: "u 1", productIds: [], subscriptions: [] },
    }));
    const api = kitApi({
      apiKey: "k 1",
      baseUrl: "http://localhost",
      fetchImpl,
    });
    await api.entitlements("u 1");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/v1/subscriptions/entitlements/k%201?userId=u%201",
      expect.anything(),
    );
  });

  it("throws KitApiError on non-2xx", async () => {
    const fetchImpl = fakeFetch(() => ({
      status: 401,
      body: { errors: [{ code: "INVALID_API_KEY", message: "nope" }] },
    }));
    const api = kitApi({
      apiKey: "bad",
      baseUrl: "http://localhost",
      fetchImpl,
    });
    await expect(api.status("u")).rejects.toBeInstanceOf(KitApiError);
  });

  it("bindUser POSTs JSON", async () => {
    const fetchImpl = fakeFetch((_path, init) => {
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string);
      expect(body).toEqual({ purchaseToken: "tok", userId: "user" });
      return { status: 200, body: { ok: true, bound: true } };
    });
    const api = kitApi({
      apiKey: "k",
      baseUrl: "http://localhost",
      fetchImpl,
    });
    const result = await api.bindUser("tok", "user");
    expect(result).toEqual({ ok: true, bound: true });
  });

  it("lists products without opting into payload bodies by default", async () => {
    const fetchImpl = fakeFetch(() => ({
      status: 200,
      body: { products: [] },
    }));
    const api = kitApi({
      apiKey: "key",
      baseUrl: "http://localhost",
      fetchImpl,
    });

    await api.products();

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/v1/products/key",
      expect.anything(),
    );
  });

  it("opts into a bounded product-payload page with an opaque cursor", async () => {
    const fetchImpl = fakeFetch(() => ({
      status: 200,
      body: { products: [] },
    }));
    const api = kitApi({
      apiKey: "key",
      baseUrl: "http://localhost",
      fetchImpl,
    });

    await api.products({
      platform: "IOS",
      includeClientPayload: true,
      limit: 10,
      cursor: "next/page=2",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/v1/products/key?platform=IOS&includeClientPayload=true&limit=10&cursor=next%2Fpage%3D2",
      expect.anything(),
    );
  });

  it("requires a platform before fetching payload-inclusive products", () => {
    const fetchImpl =
      vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
    const api = kitApi({
      apiKey: "key",
      baseUrl: "http://localhost",
      fetchImpl,
    });

    expect(() => api.products({ includeClientPayload: true })).toThrow(
      "kitApi.products requires platform when includeClientPayload is true",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reads one client payload with encoded identifiers", async () => {
    const payload = {
      format: "toml",
      body: 'tier = "gold"',
      version: 2,
      updatedAt: 123,
    };
    const fetchImpl = fakeFetch(() => ({
      status: 200,
      body: { clientPayload: payload },
    }));
    const api = kitApi({
      apiKey: "key with space",
      baseUrl: "http://localhost",
      fetchImpl,
    });

    await expect(api.clientPayload("premium/year", "Android")).resolves.toEqual(
      { clientPayload: payload },
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost/v1/products/key%20with%20space/premium%2Fyear/client-payload?platform=Android",
      expect.anything(),
    );
  });

  it("persists payloads and conditionally refreshes with ETag", async () => {
    const values = new Map<string, string>();
    const cache = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
    };
    const payload = {
      clientPayload: {
        format: "text" as const,
        body: "rules",
        version: 3,
        updatedAt: 123,
      },
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(payload, { headers: { etag: '"scoped-v3"' } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const api = kitApi({
      apiKey: "openiap-kit_pk_mobile",
      baseUrl: "https://kit.test",
      fetchImpl,
      clientPayloadCache: cache,
    });

    await expect(api.clientPayload("premium", "IOS")).resolves.toEqual(payload);
    await expect(api.clientPayload("premium", "IOS")).resolves.toEqual(payload);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await expect(
      api.clientPayload("premium", "IOS", { refresh: true }),
    ).resolves.toEqual(payload);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(
      new Headers(fetchImpl.mock.calls[1]?.[1]?.headers).get("if-none-match"),
    ).toBe('"scoped-v3"');
  });

  it("isolates cached payloads by API key and evicts a cached 404", async () => {
    const values = new Map<string, string>();
    const cache = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
    };
    const payload = {
      clientPayload: {
        format: "text" as const,
        body: "rules",
        version: 3,
        updatedAt: 123,
      },
    };
    await kitApi({
      apiKey: "openiap-kit_pk_a",
      baseUrl: "https://kit.test",
      fetchImpl: vi
        .fn()
        .mockResolvedValue(
          Response.json(payload, { headers: { etag: '"a-v3"' } }),
        ),
      clientPayloadCache: cache,
    }).clientPayload("premium", "IOS");

    const otherFetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(payload, { headers: { etag: '"b-v3"' } }),
      )
      .mockResolvedValueOnce(
        Response.json(
          { errors: [{ code: "NOT_FOUND", message: "missing" }] },
          { status: 404 },
        ),
      );
    const other = kitApi({
      apiKey: "openiap-kit_pk_b",
      baseUrl: "https://kit.test",
      fetchImpl: otherFetch,
      clientPayloadCache: cache,
    });

    await other.clientPayload("premium", "IOS");
    expect(otherFetch).toHaveBeenCalledTimes(1);
    await expect(
      other.clientPayload("premium", "IOS", { refresh: true }),
    ).rejects.toBeInstanceOf(KitApiError);
    expect(cache.removeItem).toHaveBeenCalledTimes(1);
  });
});

describe("kitApi client payload fallback", () => {
  const payload = {
    clientPayload: {
      format: "json",
      body: JSON.stringify({
        schemaVersion: 1,
        default: { headline: "Go premium", cta: "Subscribe" },
        locales: { ko: { headline: "프리미엄" } },
      }),
      version: 4,
      updatedAt: 123,
    },
  };

  function memoryCache() {
    const values = new Map<string, string>();
    return {
      values,
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
    };
  }

  async function primedApi(refreshResult: () => Promise<Response>) {
    const cache = memoryCache();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(payload, { headers: { etag: '"scoped-v4"' } }),
      )
      .mockImplementationOnce(refreshResult);
    const api = kitApi({
      apiKey: "openiap-kit_pk_mobile",
      baseUrl: "https://kit.test",
      fetchImpl,
      clientPayloadCache: cache,
    });
    await api.clientPayload("premium", "IOS");
    return { api, cache };
  }

  it.each([
    ["a network error", () => Promise.reject(new TypeError("Load failed"))],
    ["a 503", async () => new Response("unavailable", { status: 503 })],
    ["a 429", async () => Response.json({ errors: [] }, { status: 429 })],
  ])("returns the cached copy marked stale on %s", async (_label, result) => {
    const { api, cache } = await primedApi(result);

    await expect(
      api.clientPayload("premium", "IOS", { refresh: true }),
    ).resolves.toEqual({ ...payload, stale: true });
    expect(cache.removeItem).not.toHaveBeenCalled();
  });

  it("still evicts and throws on a 404 refresh", async () => {
    const { api, cache } = await primedApi(async () =>
      Response.json({ errors: [] }, { status: 404 }),
    );

    await expect(
      api.clientPayload("premium", "IOS", { refresh: true }),
    ).rejects.toMatchObject({ status: 404 });
    expect(cache.values.size).toBe(0);
  });

  it("still throws a network error when nothing is cached", async () => {
    const api = kitApi({
      apiKey: "openiap-kit_pk_mobile",
      baseUrl: "https://kit.test",
      fetchImpl: vi.fn().mockRejectedValue(new TypeError("Load failed")),
    });

    await expect(api.clientPayload("premium", "IOS")).rejects.toThrow(
      "Load failed",
    );
  });

  it("resolves localized UI copy and reports a stale fallback", async () => {
    const { api } = await primedApi(async () =>
      Response.json({ errors: [] }, { status: 500 }),
    );

    await expect(
      api.localizedClientPayload("premium", "IOS", {
        locale: "ko-KR",
        refresh: true,
      }),
    ).resolves.toEqual({
      values: { headline: "프리미엄", cta: "Subscribe" },
      version: 4,
      stale: true,
    });
  });

  it("returns null instead of throwing from the localized helper", async () => {
    const respond = (response: Promise<Response>) =>
      kitApi({
        apiKey: "openiap-kit_pk_mobile",
        baseUrl: "https://kit.test",
        fetchImpl: vi.fn().mockReturnValue(response),
      });
    const apis = [
      respond(Promise.reject(new TypeError("offline"))),
      respond(Promise.resolve(Response.json({ errors: [] }, { status: 404 }))),
      respond(
        Promise.resolve(
          Response.json({
            clientPayload: { ...payload.clientPayload, format: "toml" },
          }),
        ),
      ),
      respond(
        Promise.resolve(
          Response.json({
            clientPayload: { ...payload.clientPayload, body: "{" },
          }),
        ),
      ),
    ];

    for (const api of apis) {
      await expect(
        api.localizedClientPayload("premium", "IOS", { locale: "en" }),
      ).resolves.toBeNull();
    }
  });
});

describe("resolveLocalizedPayload", () => {
  const document = {
    schemaVersion: 1,
    default: { headline: "Go premium", cta: "Subscribe" },
    locales: {
      ko: { headline: "프리미엄" },
      "en-US": { headline: "Go Premium (US)" },
      "zh-Hant": { headline: "高級版" },
      broken: "not an object",
    },
  };

  it("prefers the exact locale, then shorter prefixes, then fallbacks", () => {
    expect(
      resolveLocalizedPayload(document, { locale: "en-US" })?.headline,
    ).toBe("Go Premium (US)");
    expect(
      resolveLocalizedPayload(document, { locale: "ko_KR" })?.headline,
    ).toBe("프리미엄");
    expect(
      resolveLocalizedPayload(document, { locale: "zh-Hant-TW" })?.headline,
    ).toBe("高級版");
    expect(
      resolveLocalizedPayload(document, {
        locale: "fr-CA",
        fallbackLocales: ["en-US"],
      }),
    ).toEqual({ headline: "Go Premium (US)", cta: "Subscribe" });
  });

  it("does not widen a language to one of its regions", () => {
    expect(resolveLocalizedPayload(document, { locale: "en" })).toEqual(
      document.default,
    );
  });

  it("falls back to default, then null", () => {
    expect(resolveLocalizedPayload(document, { locale: "fr" })).toEqual(
      document.default,
    );
    expect(
      resolveLocalizedPayload(
        { schemaVersion: 1, locales: { ko: { headline: "프리미엄" } } },
        { locale: "fr" },
      ),
    ).toBeNull();
  });

  it("returns null for an unsupported or missing schemaVersion", () => {
    expect(
      resolveLocalizedPayload(
        { ...document, schemaVersion: 2 },
        { locale: "ko" },
      ),
    ).toBeNull();
    expect(
      resolveLocalizedPayload({ default: document.default }, { locale: "ko" }),
    ).toBeNull();
    expect(
      resolveLocalizedPayload(
        { ...document, schemaVersion: 2 },
        { locale: "ko", supportedSchemaVersions: [1, 2] },
      )?.headline,
    ).toBe("프리미엄");
    for (const value of [null, [], "text", 1]) {
      expect(resolveLocalizedPayload(value, { locale: "ko" })).toBeNull();
    }
  });
});
