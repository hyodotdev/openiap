import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";

let app: Hono;
let client: typeof import("../../convex").client;
beforeAll(async () => {
  vi.stubEnv("VITE_KIT_CONVEX_URL", "https://placeholder.convex.cloud");
  ({ client } = await import("../../convex"));
  const { externalCheckoutRoutes } = await import("./external-checkouts");
  app = new Hono().route("/v1", externalCheckoutRoutes);
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllEnvs());

const headers = {
  Authorization: "Bearer openiap-kit_sk_http_fixture",
  "Content-Type": "application/json",
  "Idempotency-Key": "external-order",
};
const payload = {
  orderId: "external-order",
  userId: "user_1",
  productId: "sku",
  payment: { provider: "stripe", kind: "payment_intent", reference: "pi_test" },
  price: { currency: "EUR", netMinor: 800, taxMinor: 200, regionCode: "DE" },
  reporting: {
    store: "google",
    profileId: "profile",
    externalTransactionToken: "opaque",
  },
};

it("wires checkout creation, verification and polling to the protected API", async () => {
  const action = vi
    .spyOn(client, "action")
    .mockResolvedValue({ checkoutId: "test" });
  const create = () =>
    app.request("/v1/external-checkouts", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  expect(
    (await app.request("/v1/external-checkouts", { method: "POST" })).status,
  ).toBe(401);
  expect((await create()).status).toBe(201);
  expect(getFunctionName(action.mock.calls[0][0])).toBe(
    "externalCheckouts/action:create",
  );
  expect(action.mock.calls[0][1]).toEqual({
    apiKey: "openiap-kit_sk_http_fixture",
    key: "external-order",
    input: payload,
  });
  expect(
    (
      await app.request("/v1/external-checkouts/test/verify", {
        method: "POST",
        headers,
      })
    ).status,
  ).toBe(202);
  expect(getFunctionName(action.mock.calls[1][0])).toBe(
    "externalCheckouts/action:verify",
  );
  const status = await app.request("/v1/external-checkouts/test", { headers });
  expect(status.status).toBe(200);
  expect(status.headers.get("Cache-Control")).toBe("private, no-store");
  expect(getFunctionName(action.mock.calls[2][0])).toBe(
    "externalCheckouts/action:get",
  );
  action.mockRejectedValueOnce(
    new ConvexError({
      code: "IDEMPOTENCY_CONFLICT",
      message: "Conflicting replay",
    }),
  );
  expect((await create()).status).toBe(409);
});

it("passes the exact Stripe bytes to the signature check without a project key", async () => {
  const action = vi
    .spyOn(client, "action")
    .mockResolvedValue({ received: true });
  const body = ' { "id": "evt_test" }\n';
  const response = await app.request("/v1/webhooks/stripe/integration-test", {
    method: "POST",
    body,
    headers: { "Stripe-Signature": "t=1,v1=signature" },
  });
  expect(response.status).toBe(200);
  expect(getFunctionName(action.mock.calls[0][0])).toBe(
    "externalCheckouts/action:ingestStripe",
  );
  expect(action.mock.calls[0][1]).toEqual({
    integrationId: "integration-test",
    raw: body,
    signature: "t=1,v1=signature",
  });
});
