import { describe, expect, it, vi } from "vitest";
import { kitApi, KitApiError } from "./kit-api";

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
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(),
      text: async () =>
        typeof body === "string" ? body : JSON.stringify(body),
    } as unknown as Response;
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
      fetchImpl: fetchImpl as never,
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
      fetchImpl: fetchImpl as never,
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
      fetchImpl: fetchImpl as never,
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
      fetchImpl: fetchImpl as never,
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
      fetchImpl: fetchImpl as never,
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
      fetchImpl: fetchImpl as never,
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
    const fetchImpl = vi.fn();
    const api = kitApi({
      apiKey: "key",
      baseUrl: "http://localhost",
      fetchImpl: fetchImpl as never,
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
      fetchImpl: fetchImpl as never,
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
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
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
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
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
