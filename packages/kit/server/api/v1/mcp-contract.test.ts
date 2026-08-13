import type { FunctionReturnType } from "convex/server";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

import type { KitProductsResponse as SdkProductsResponse } from "../../../../gql/src/kit-api";
import { kitClient } from "../../../../mcp-server/src/kit-client";
import type { api } from "../../../convex/_generated/api";
import type { HealthPayload } from "../../health";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
}));

vi.mock("hono/bun", () => ({
  getConnInfo: () => ({ remote: { address: "127.0.0.1" } }),
}));

vi.mock("../../convex", () => ({
  client: mocks,
  handleConvexError: () => null,
}));

const { apiRoutes } = await import("./routes");

type McpClient = ReturnType<typeof kitClient>;
type McpProductsResponse = Awaited<ReturnType<McpClient["listProducts"]>>;
type McpSubscriptionsResponse = Awaited<
  ReturnType<McpClient["listSubscriptions"]>
>;
type McpMetricsResponse = Awaited<ReturnType<McpClient["metrics"]>>;
type McpSyncResponse = Awaited<ReturnType<McpClient["syncProducts"]>>;
type McpHealthResponse = Awaited<ReturnType<McpClient["health"]>>;

type ServerProductsResponse = FunctionReturnType<
  typeof api.products.query.listProductsPage
>;
type ServerSubscriptionsResponse = FunctionReturnType<
  typeof api.subscriptions.query.listSubscriptions
>;
type ServerMetricsResponse = FunctionReturnType<
  typeof api.subscriptions.query.metricsSummary
>;
type ServerSyncResponse = FunctionReturnType<
  typeof api.products.jobs.enqueueProductSync
>;

type OptionalKeys<T extends object> = {
  [Key in keyof T]-?: object extends Pick<T, Key> ? Key : never;
}[keyof T];

describe("MCP Kit response contracts", () => {
  beforeEach(() => {
    mocks.action.mockReset();
    mocks.mutation.mockReset();
    mocks.query.mockReset();
    vi.stubGlobal(
      "fetch",
      (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        return apiRoutes.request(
          `${url.pathname.replace(/^\/v1/, "")}${url.search}`,
          { method: request.method, headers: request.headers },
        );
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps product pagination envelopes aligned", () => {
    expectTypeOf<keyof McpProductsResponse>().toEqualTypeOf<
      keyof ServerProductsResponse
    >();
    expectTypeOf<keyof McpProductsResponse>().toEqualTypeOf<
      keyof SdkProductsResponse
    >();
    expectTypeOf<OptionalKeys<McpProductsResponse>>().toEqualTypeOf<
      OptionalKeys<ServerProductsResponse>
    >();
    expectTypeOf<OptionalKeys<McpProductsResponse>>().toEqualTypeOf<
      OptionalKeys<SdkProductsResponse>
    >();
  });

  it("keeps administrative response fields and optionality aligned", () => {
    expectTypeOf<McpMetricsResponse>().toEqualTypeOf<ServerMetricsResponse>();
    expectTypeOf<keyof McpSubscriptionsResponse>().toEqualTypeOf<
      keyof ServerSubscriptionsResponse
    >();
    expectTypeOf<OptionalKeys<McpSubscriptionsResponse>>().toEqualTypeOf<
      OptionalKeys<ServerSubscriptionsResponse>
    >();
    expectTypeOf<keyof McpSyncResponse>().toEqualTypeOf<
      keyof ServerSyncResponse
    >();
    expectTypeOf<OptionalKeys<McpSyncResponse>>().toEqualTypeOf<
      OptionalKeys<ServerSyncResponse>
    >();
  });

  it("keeps the health response aligned", () => {
    expectTypeOf<McpHealthResponse>().toEqualTypeOf<HealthPayload>();
  });

  it("calls the real catalog handler with pagination", async () => {
    const responsePayload = {
      products: [{ productId: "premium", platform: "IOS" }],
      hasMore: true,
      nextCursor: "opaque/next=2",
    };
    mocks.query.mockResolvedValueOnce(responsePayload);
    const client = kitClient({
      apiKey: "openiap-kit_sk_contract",
      baseUrl: "http://kit.test",
    });

    await expect(
      client.listProducts({
        platform: "IOS",
        limit: 50,
        cursor: "opaque/start=1",
      }),
    ).resolves.toEqual(responsePayload);
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), {
      apiKey: "openiap-kit_sk_contract",
      platform: "IOS",
      limit: 50,
      cursor: "opaque/start=1",
    });
  });
});
