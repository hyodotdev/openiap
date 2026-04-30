import { describe, expect, it, vi } from "vitest";
import { kitApi, KitApiError } from "./kit-api";

function fakeFetch(
  recipe: (path: string, init?: RequestInit) => {
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

  it("paywallUrl encodes slug + apiKey", () => {
    const api = kitApi({
      apiKey: "live key",
      baseUrl: "https://kit.openiap.dev/",
      fetchImpl: (() => Promise.resolve({} as Response)) as never,
    });
    expect(api.paywallUrl("intro/2026")).toBe(
      "https://kit.openiap.dev/v1/paywalls/live%20key/intro%2F2026",
    );
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
});
