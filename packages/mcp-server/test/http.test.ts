import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import {
  createRemoteMcpHttpServer,
  startRemoteMcpHttpServer,
  type RemoteMcpHttpServer,
} from "../src/http";

let remote: RemoteMcpHttpServer | null = null;
let kitApi: Server | null = null;

interface SetupToolPayload {
  framework: string;
  snippet: string;
  note: string;
}

afterEach(async () => {
  if (remote) {
    await remote.close();
    remote = null;
  }
  if (kitApi) {
    await closeServer(kitApi);
    kitApi = null;
  }
});

describe("remote MCP HTTP server", () => {
  it("serves health and connection metadata", async () => {
    const baseUrl = await startServer();

    await expect(fetchJson(`${baseUrl}/health`)).resolves.toEqual({
      ok: true,
      name: "iapkit-mcp",
      version: "0.1.0",
      transport: "streamable-http",
      mcpPath: "/mcp",
    });

    const root = await fetchJson(`${baseUrl}/`);
    expect(root).toMatchObject({
      name: "iapkit-mcp",
      service: "IAPKit",
      endpoints: {
        mcp: "/mcp",
        health: "/health",
      },
      authentication: [
        "Authorization: Bearer <IAPKit project API key>",
        "IAPKIT_API_KEY environment variable",
      ],
    });
  });

  it("rejects when the configured listener cannot bind", async () => {
    const occupied = createServer();

    try {
      await new Promise<void>((resolve) => {
        occupied.listen(0, "127.0.0.1", resolve);
      });
      const port = (occupied.address() as AddressInfo).port;

      await expect(
        startRemoteMcpHttpServer({
          host: "127.0.0.1",
          port,
          logger: {
            error: () => undefined,
            info: () => undefined,
          },
        }),
      ).rejects.toMatchObject({ code: "EADDRINUSE" });
    } finally {
      await closeServer(occupied);
    }
  });

  it("initializes an MCP session and exposes IAPKit tool names", async () => {
    const baseUrl = await startServer();
    const initResponse = await postMcp(baseUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "vitest", version: "0.0.0" },
      },
    });

    expect(initResponse.status).toBe(200);
    const sessionId = initResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    const initEvent = parseSseJson(await initResponse.text());
    expect(initEvent.result.serverInfo).toMatchObject({
      name: "iapkit-mcp",
      websiteUrl: "https://kit.openiap.dev",
    });

    const listResponse = await postMcp(
      baseUrl,
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      sessionId ?? undefined,
    );
    const listEvent = parseSseJson(await listResponse.text());
    const toolNames = listEvent.result.tools.map(
      (tool: { name: string }) => tool.name,
    );
    const toolsByName = new Map(
      listEvent.result.tools.map(
        (tool: {
          name: string;
          annotations?: {
            readOnlyHint?: boolean;
            destructiveHint?: boolean;
          };
        }) => [tool.name, tool],
      ),
    );

    expect(toolNames).toContain("iapkit_inspect_state");
    expect(toolNames).toContain("iapkit_create_product");
    expect(toolNames).toContain("iapkit_revenue_analytics");
    expect(toolNames).toContain("iapkit_sync_products");
    expect(toolNames).toContain("iapkit_sync_status");
    expect(toolNames).not.toContain("openiap_inspect_state");
    expect(
      toolsByName.get("iapkit_revenue_analytics")?.annotations,
    ).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
    expect(toolsByName.get("iapkit_create_product")?.annotations).toMatchObject(
      {
        readOnlyHint: false,
        destructiveHint: true,
      },
    );
  });

  it("summarizes revenue analytics through the bearer-authenticated Kit API", async () => {
    const apiKey = "openiap-kit_secret_revenue";
    const previousBaseUrl = process.env.IAPKIT_BASE_URL;
    process.env.IAPKIT_BASE_URL = await startKitApi((req, res) => {
      expect(req.method).toBe("GET");
      expect(req.url).toBe(
        `/v1/subscriptions/revenue/${apiKey}?fromDay=2026-06-01&toDay=2026-06-04`,
      );
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          days: [
            {
              day: "2026-06-01",
              currency: "USD",
              productId: "premium_monthly",
              platform: "IOS",
              activeSubs: 10,
              newSubs: 2,
              renewals: 3,
              cancellations: 1,
              refunds: 0,
              revenueMicros: 4990000,
            },
          ],
          currencies: ["USD"],
          productIds: ["premium_monthly"],
          platforms: ["IOS"],
          truncated: false,
        }),
      );
    });

    try {
      const { baseUrl, sessionId } = await initializeMcpSession(apiKey);
      const response = await postMcp(
        baseUrl,
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "iapkit_revenue_analytics",
            arguments: {
              period: "custom",
              fromDay: "2026-06-01",
              toDay: "2026-06-04",
            },
          },
        },
        sessionId,
        { authorization: `Bearer ${apiKey}` },
      );
      const event = parseSseJson(await response.text());
      const payload = JSON.parse(event.result.content[0].text);

      expect(payload.totalsByCurrency.USD).toMatchObject({
        purchaseEvents: 5,
        newSubs: 2,
        renewals: 3,
        revenueMicros: 4990000,
      });
    } finally {
      if (previousBaseUrl === undefined) delete process.env.IAPKIT_BASE_URL;
      else process.env.IAPKIT_BASE_URL = previousBaseUrl;
    }
  });

  it("generates Expo setup snippets compatible with current SDK types", async () => {
    const apiKey = "openiap-kit_secret_setup";
    const { baseUrl, sessionId } = await initializeMcpSession(apiKey);

    const expoPayload = await callTool<SetupToolPayload>(
      baseUrl,
      sessionId,
      "iapkit_setup",
      {
        framework: "expo",
        productId: "premium_monthly",
      },
    );
    expect(expoPayload).toMatchObject({
      framework: "expo",
      note: expect.stringContaining("IAPKIT_API_KEY"),
    });
    expect(expoPayload.snippet).toContain(
      "export function useOpenIapPremium()",
    );
    expect(expoPayload.snippet).toContain("useIAP()");
    expect(expoPayload.snippet).toContain("fetchProducts({");
    expect(expoPayload.snippet).toContain("new EventSource<string>");
    expect(expoPayload.snippet).toContain("type WebhookEventStream");
    expect(expoPayload.snippet).toContain("<IAPKIT_API_KEY>");
    expect(expoPayload.snippet).not.toContain("useIAP({ skus:");
    expect(expoPayload.snippet).not.toContain(apiKey);
  });

  it("generates native iOS and Android setup snippets", async () => {
    const apiKey = "openiap-kit_secret_setup";
    const { baseUrl, sessionId } = await initializeMcpSession(apiKey);

    const iosPayload = await callTool<SetupToolPayload>(
      baseUrl,
      sessionId,
      "iapkit_setup",
      {
        framework: "ios",
        productId: "premium_monthly",
      },
    );
    expect(iosPayload).toMatchObject({
      framework: "ios",
      note: expect.stringContaining("IAPKIT_API_KEY"),
    });
    expect(iosPayload.snippet).toContain("OpenIapStore");
    expect(iosPayload.snippet).toContain(
      "RequestVerifyPurchaseWithIapkitAppleProps",
    );
    expect(iosPayload.snippet).toContain("<IAPKIT_API_KEY>");
    expect(iosPayload.snippet).not.toContain(apiKey);

    const androidPayload = await callTool<SetupToolPayload>(
      baseUrl,
      sessionId,
      "iapkit_setup",
      {
        framework: "android",
        productId: "premium_monthly",
      },
    );
    expect(androidPayload).toMatchObject({
      framework: "android",
      note: expect.stringContaining("IAPKIT_API_KEY"),
    });
    expect(androidPayload.snippet).toContain("OpenIapModule");
    expect(androidPayload.snippet).toContain("OpenIapPurchaseUpdateListener");
    expect(androidPayload.snippet).toContain(
      "RequestVerifyPurchaseWithIapkitGoogleProps",
    );
    expect(androidPayload.snippet).toContain("<IAPKIT_API_KEY>");
    expect(androidPayload.snippet).not.toContain(apiKey);
  });

  it("enqueues store sync jobs through the bearer-authenticated Kit API", async () => {
    const apiKey = "openiap-kit_secret_sync";
    const previousBaseUrl = process.env.IAPKIT_BASE_URL;
    process.env.IAPKIT_BASE_URL = await startKitApi((req, res) => {
      expect(req.method).toBe("POST");
      expect(req.url).toBe(
        `/v1/products/${apiKey}/sync/ios?direction=push&dryRun=false`,
      );
      res.writeHead(202, { "content-type": "application/json" });
      res.end(JSON.stringify({ jobId: "job_123", deduped: false }));
    });

    try {
      const { baseUrl, sessionId } = await initializeMcpSession(apiKey);
      const response = await postMcp(
        baseUrl,
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "iapkit_sync_products",
            arguments: {
              platform: "IOS",
              direction: "push",
              dryRun: false,
            },
          },
        },
        sessionId,
        { authorization: `Bearer ${apiKey}` },
      );
      const event = parseSseJson(await response.text());
      const payload = JSON.parse(event.result.content[0].text);

      expect(payload).toEqual({ jobId: "job_123", deduped: false });
    } finally {
      if (previousBaseUrl === undefined) delete process.env.IAPKIT_BASE_URL;
      else process.env.IAPKIT_BASE_URL = previousBaseUrl;
    }
  });

  it("posts UTF-8-safe synthetic Android webhook payloads", async () => {
    const apiKey = "openiap-kit_secret_webhook";
    const { baseUrl, sessionId } = await initializeMcpSession(apiKey);
    const kitBaseUrl = await startKitApi((req, res) => {
      expect(req.method).toBe("POST");
      expect(req.url).toBe(`/v1/webhooks/${apiKey}`);

      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        const parsed = JSON.parse(raw) as {
          message: { data: string; messageId: string };
        };
        const decoded = JSON.parse(
          Buffer.from(parsed.message.data, "base64").toString("utf8"),
        );

        expect(decoded).toMatchObject({
          version: "1.0",
          packageName: "com.example.app",
          testNotification: { version: "1.0" },
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    const response = await postMcp(
      baseUrl,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "iapkit_simulate_webhook",
          arguments: {
            platform: "Android",
            baseUrl: kitBaseUrl,
          },
        },
      },
      sessionId,
      { authorization: `Bearer ${apiKey}` },
    );
    const event = parseSseJson(await response.text());
    const payload = JSON.parse(event.result.content[0].text);

    expect(payload).toMatchObject({ status: 200 });
  });

  it("returns iOS webhook simulation guidance without credentials", async () => {
    const { baseUrl, sessionId } = await initializeMcpSession();

    const payload = await callTool<{ info: string }>(
      baseUrl,
      sessionId,
      "iapkit_simulate_webhook",
      { platform: "IOS" },
    );

    expect(payload.info).toContain("Apple ASN v2 simulation");
    expect(payload.info).toContain("/v1/webhooks/{apiKey}");
  });

  it("returns client errors for invalid JSON and oversized payloads", async () => {
    const baseUrl = await startServer();

    const invalidJson = await rawPostMcp(baseUrl, "{");
    expect(invalidJson.status).toBe(400);
    await expect(invalidJson.json()).resolves.toMatchObject({
      error: { code: -32700, message: "Parse error: Invalid JSON" },
    });

    const oversized = await rawPostMcp(baseUrl, "x".repeat(1024 * 1024 + 1));
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toMatchObject({
      error: { code: -32000, message: "Payload Too Large" },
    });
  });

  it("redacts bearer API keys from tool error responses", async () => {
    const apiKey = "openiap-kit_secret_http";
    const previousBaseUrl = process.env.IAPKIT_BASE_URL;
    process.env.IAPKIT_BASE_URL = await startKitApi((req, res) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: `upstream saw bearer key ${apiKey}`,
          path: req.url,
        }),
      );
    });

    try {
      const baseUrl = await startServer();
      const authHeaders = { authorization: `Bearer ${apiKey}` };
      const initResponse = await postMcp(
        baseUrl,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "vitest", version: "0.0.0" },
          },
        },
        undefined,
        authHeaders,
      );
      const sessionId = initResponse.headers.get("mcp-session-id");
      expect(sessionId).toBeTruthy();
      await initResponse.text();

      const callResponse = await postMcp(
        baseUrl,
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "iapkit_check_status",
            arguments: { userId: "user_1" },
          },
        },
        sessionId ?? undefined,
        authHeaders,
      );
      const callBody = await callResponse.text();

      expect(callBody).not.toContain(apiKey);
      expect(callBody).toContain("<IAPKIT_API_KEY>");
    } finally {
      if (previousBaseUrl === undefined) delete process.env.IAPKIT_BASE_URL;
      else process.env.IAPKIT_BASE_URL = previousBaseUrl;
    }
  });
});

async function startServer(): Promise<string> {
  remote = createRemoteMcpHttpServer({
    logger: {
      error: () => undefined,
      info: () => undefined,
    },
  });

  await new Promise<void>((resolve) => {
    remote?.server.listen(0, "127.0.0.1", resolve);
  });

  const address = remote.server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function startKitApi(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<string> {
  kitApi = createServer(handler);

  await new Promise<void>((resolve) => {
    kitApi?.listen(0, "127.0.0.1", resolve);
  });

  const address = kitApi.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function initializeMcpSession(
  apiKey?: string,
): Promise<{ baseUrl: string; sessionId: string }> {
  const baseUrl = await startServer();
  const headers = apiKey ? { authorization: `Bearer ${apiKey}` } : {};
  const initResponse = await postMcp(
    baseUrl,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "vitest", version: "0.0.0" },
      },
    },
    undefined,
    headers,
  );
  const sessionId = initResponse.headers.get("mcp-session-id");
  expect(sessionId).toBeTruthy();
  await initResponse.text();
  return { baseUrl, sessionId: sessionId ?? "" };
}

async function callTool<T>(
  baseUrl: string,
  sessionId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const response = await postMcp(
    baseUrl,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    },
    sessionId,
  );
  expect(response.status).toBe(200);
  const event = parseSseJson(await response.text());
  return JSON.parse(event.result.content[0].text) as T;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return response.json();
}

async function postMcp(
  baseUrl: string,
  body: unknown,
  sessionId?: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...headers,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
}

function rawPostMcp(baseUrl: string, body: string): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body,
  });
}

function parseSseJson(raw: string): any {
  const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) {
    throw new Error(`No SSE data line found: ${raw}`);
  }
  return JSON.parse(dataLine.slice("data: ".length));
}
