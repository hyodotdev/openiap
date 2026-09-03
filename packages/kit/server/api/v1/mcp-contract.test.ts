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

import type { KitProductsResponse as SdkProductsResponse } from "../../../../../specs/client/src/kit-api";
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
const { apiRoutesV2 } = await import("../v2/routes");

type McpClient = ReturnType<typeof kitClient>;
type McpProductsResponse = Awaited<ReturnType<McpClient["listProducts"]>>;
type McpStatusResponse = Awaited<ReturnType<McpClient["status"]>>;
type McpEntitlementsResponse = Awaited<ReturnType<McpClient["entitlements"]>>;
type McpSubscriptionsResponse = Awaited<
  ReturnType<McpClient["listSubscriptions"]>
>;
type McpMetricsResponse = Awaited<ReturnType<McpClient["metrics"]>>;
type McpRevenueResponse = Awaited<ReturnType<McpClient["revenueMetrics"]>>;
type McpUpsertProductResponse = Awaited<ReturnType<McpClient["upsertProduct"]>>;
type McpProductStateResponse = Awaited<
  ReturnType<McpClient["setProductState"]>
>;
type McpClientPayloadStateResponse = Awaited<
  ReturnType<McpClient["getClientPayloadState"]>
>;
type McpSetClientPayloadResponse = Awaited<
  ReturnType<McpClient["setClientPayload"]>
>;
type McpRemoveClientPayloadResponse = Awaited<
  ReturnType<McpClient["removeClientPayload"]>
>;
type McpSyncResponse = Awaited<ReturnType<McpClient["syncProducts"]>>;
type McpSyncJobResponse = Awaited<ReturnType<McpClient["syncJob"]>>;
type McpHealthResponse = Awaited<ReturnType<McpClient["health"]>>;

type ServerProductsResponse = FunctionReturnType<
  typeof api.products.query.listProductsPage
>;
type ServerStatusV2Response = FunctionReturnType<
  typeof api.subscriptions.query.subscriptionStatusV2
>;
type ServerEntitlementsV2Response = FunctionReturnType<
  typeof api.subscriptions.query.entitlementsV2
>;
type ServerSubscriptionsResponse = FunctionReturnType<
  typeof api.subscriptions.query.listSubscriptions
>;
type ServerMetricsResponse = FunctionReturnType<
  typeof api.subscriptions.query.metricsSummary
>;
type ServerRevenueResponse = FunctionReturnType<
  typeof api.subscriptions.query.getRevenueMetrics
>;
type ServerUpsertProductResponse = FunctionReturnType<
  typeof api.products.mutation.upsertProduct
>;
type ServerProductStateResponse = FunctionReturnType<
  typeof api.products.mutation.setProductState
>;
type ServerClientPayloadStateResponse = NonNullable<
  FunctionReturnType<
    typeof api.products.query.getProductClientPayloadEditorStateWithApiKey
  >
>;
type ServerSetClientPayloadResponse = FunctionReturnType<
  typeof api.products.mutation.upsertProductClientPayloadWithApiKey
>;
type ServerRemoveClientPayloadResponse = FunctionReturnType<
  typeof api.products.mutation.removeProductClientPayloadWithApiKey
>;
type ServerSyncResponse = FunctionReturnType<
  typeof api.products.jobs.enqueueProductSync
>;
type ServerSyncJobResponse = NonNullable<
  FunctionReturnType<typeof api.products.jobs.getSyncJobById>
>;

type NormalizeContract<T> = T extends { __tableName: string }
  ? string
  : T extends readonly (infer Item)[]
    ? NormalizeContract<Item>[]
    : T extends {
          format: string;
          body: string;
          version: number;
          updatedAt: number;
        }
      ? {
          [Key in keyof T]: Key extends "format"
            ? string
            : NormalizeContract<T[Key]>;
        }
      : T extends object
        ? { [Key in keyof T]: NormalizeContract<T[Key]> }
        : T;

describe("MCP Kit response contracts", () => {
  beforeEach(() => {
    mocks.action.mockReset();
    mocks.mutation.mockReset();
    mocks.query.mockReset();
    vi.stubGlobal(
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const versionedRoutes = url.pathname.startsWith("/v2")
          ? apiRoutesV2
          : apiRoutes;
        return versionedRoutes.request(
          `${url.pathname.replace(/^\/v[12]/, "")}${url.search}`,
          {
            method: request.method,
            headers: request.headers,
            ...(request.method === "GET" || request.method === "HEAD"
              ? {}
              : { body: await request.text() }),
          },
        );
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps app-readable response types aligned", () => {
    expectTypeOf<McpStatusResponse>().toEqualTypeOf<
      NormalizeContract<ServerStatusV2Response>
    >();
    expectTypeOf<McpEntitlementsResponse>().toEqualTypeOf<
      NormalizeContract<ServerEntitlementsV2Response>
    >();
    expectTypeOf<McpProductsResponse>().toEqualTypeOf<SdkProductsResponse>();
    expectTypeOf<McpProductsResponse>().toEqualTypeOf<
      NormalizeContract<ServerProductsResponse>
    >();
  });

  it("calls the v2 account-read handlers", async () => {
    const client = kitClient({
      apiKey: "openiap-kit_sk_contract",
      baseUrl: "http://kit.test",
    });
    mocks.query
      .mockResolvedValueOnce({ active: false, subscription: null })
      .mockResolvedValueOnce({
        userId: "user-1",
        productIds: [],
        subscriptions: [],
      });

    await expect(client.status("user-1")).resolves.toEqual({
      active: false,
      subscription: null,
    });
    await expect(client.entitlements("user-1")).resolves.toEqual({
      userId: "user-1",
      productIds: [],
      subscriptions: [],
    });
    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        apiKey: "openiap-kit_sk_contract",
        userId: "user-1",
        now: expect.any(Number),
      }),
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        apiKey: "openiap-kit_sk_contract",
        userId: "user-1",
        now: expect.any(Number),
      }),
    );
  });

  it("keeps administrative read response types aligned", () => {
    expectTypeOf<McpMetricsResponse>().toEqualTypeOf<ServerMetricsResponse>();
    expectTypeOf<McpSubscriptionsResponse>().toEqualTypeOf<
      NormalizeContract<ServerSubscriptionsResponse>
    >();
    expectTypeOf<McpRevenueResponse>().toEqualTypeOf<ServerRevenueResponse>();
    expectTypeOf<McpClientPayloadStateResponse>().toEqualTypeOf<
      NormalizeContract<ServerClientPayloadStateResponse>
    >();
    expectTypeOf<McpSyncJobResponse>().toEqualTypeOf<
      NormalizeContract<ServerSyncJobResponse>
    >();
  });

  it("keeps administrative write response types aligned", () => {
    expectTypeOf<McpUpsertProductResponse>().toEqualTypeOf<
      NormalizeContract<ServerUpsertProductResponse>
    >();
    expectTypeOf<McpProductStateResponse>().toEqualTypeOf<
      NormalizeContract<ServerProductStateResponse>
    >();
    expectTypeOf<McpSetClientPayloadResponse>().toEqualTypeOf<
      NormalizeContract<ServerSetClientPayloadResponse>
    >();
    expectTypeOf<McpRemoveClientPayloadResponse>().toEqualTypeOf<ServerRemoveClientPayloadResponse>();
    expectTypeOf<McpSyncResponse>().toEqualTypeOf<
      NormalizeContract<ServerSyncResponse>
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
