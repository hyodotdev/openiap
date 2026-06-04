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
  type RemoteMcpHttpServer,
} from "../src/http";

let remote: RemoteMcpHttpServer | null = null;
let kitApi: Server | null = null;

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
    });
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

    expect(toolNames).toContain("iapkit_inspect_state");
    expect(toolNames).toContain("iapkit_create_product");
    expect(toolNames).not.toContain("openiap_inspect_state");
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
