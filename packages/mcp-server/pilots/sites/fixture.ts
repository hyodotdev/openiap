import {
  kitClient,
  type KitProductsResponse,
  type StatusResponseV2,
} from "../../src/kit-client.js";

export const PILOT_TOOLS = [
  "iapkit_setup",
  "iapkit_list_products",
  "iapkit_check_status",
] as const;

const FIXTURE_ORIGIN = "https://iapkit-fixture.invalid";
const FIXTURE_KEY = "openiap-kit_sk_sites_fixture_only";

const fixtureFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== FIXTURE_ORIGIN || request.method !== "GET") {
    throw new Error("The Sites pilot serves synthetic reads only.");
  }
  if (request.headers.get("authorization") !== `Bearer ${FIXTURE_KEY}`) {
    return Response.json(
      { error: "Unauthorized fixture request" },
      { status: 401 },
    );
  }
  if (url.pathname === "/v1/products") {
    const catalog: KitProductsResponse = {
      products: [
        {
          productId: "com.example.sites_monthly",
          platform: "IOS",
          type: "Subscription",
          title: "Sites pilot monthly",
          description: "Synthetic catalog data for the hosting trial.",
          state: "Draft",
          updatedAt: 0,
        },
      ],
      hasMore: false,
    };
    return Response.json(catalog);
  }
  if (url.pathname === "/v2/subscriptions/status") {
    const status: StatusResponseV2 = { active: false, subscription: null };
    return Response.json(status);
  }
  return Response.json({ error: "Unknown fixture route" }, { status: 404 });
};

export const fixtureClient = kitClient({
  baseUrl: FIXTURE_ORIGIN,
  apiKey: FIXTURE_KEY,
  fetch: fixtureFetch,
});
