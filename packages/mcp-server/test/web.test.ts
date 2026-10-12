import { afterEach, describe, expect, it, vi } from "vitest";

import { MANAGE_PRODUCT_DISABLE_MESSAGE } from "../src/mcp";
import { createIapKitWebMcpHandler } from "../src/web";

// Regression suite for GitHub issue #287: the hosted /mcp endpoint kept
// per-process session state, so a valid mcp-session-id landing on a
// sibling Fly machine was rejected with 400 "initialize first". The web
// handler must instead (a) mint machine-prefixed session ids, (b) replay
// foreign-machine sessions via `fly-replay`, and (c) answer 404 (not
// 400) for sessions it genuinely cannot serve so spec-compliant clients
// transparently re-initialize.

const silentLogger = { error: () => undefined, info: () => undefined };
const SECRET_KEY = "openiap-kit_sk_hosted";
const BEARER = { authorization: `Bearer ${SECRET_KEY}` };

function createHandler(machineId?: string) {
  return createIapKitWebMcpHandler({ logger: silentLogger, machineId });
}

function initializeRequest(
  sessionId?: string,
  headers: Record<string, string> = {},
): Request {
  return mcpRequest(
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
    sessionId,
    headers,
  );
}

function toolsListRequest(
  sessionId: string,
  headers: Record<string, string> = {},
): Request {
  return mcpRequest(
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    sessionId,
    headers,
  );
}

function mcpRequest(
  body: unknown,
  sessionId?: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...BEARER,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("web MCP handler session routing", () => {
  it("prefixes session ids with the machine id on Fly", async () => {
    const handler = createHandler("self42");
    const response = await handler(initializeRequest());

    expect(response.status).toBe(200);
    const sessionId = response.headers.get("mcp-session-id");
    expect(sessionId).toMatch(/^self42\.[0-9a-f-]{36}$/);
  });

  it("keeps bare-UUID session ids off Fly", async () => {
    const handler = createHandler(undefined);
    const response = await handler(initializeRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("serves follow-up requests on a session it owns", async () => {
    const handler = createHandler("self42");
    const init = await handler(initializeRequest());
    const sessionId = init.headers.get("mcp-session-id") ?? "";
    await init.text();

    const list = await handler(toolsListRequest(sessionId));
    expect(list.status).toBe(200);
  });

  it("evicts the least recently used session at capacity instead of locking out", async () => {
    const handler = createHandler("self42");
    const sessionIds: string[] = [];

    // 16 tenants at their per-key share fill the 256 slots.
    for (let index = 0; index < 256; index += 1) {
      const tenant = { authorization: `Bearer ${SECRET_KEY}_${index % 16}` };
      const response = await handler(initializeRequest(undefined, tenant));
      expect(response.status).toBe(200);
      sessionIds.push(response.headers.get("mcp-session-id") ?? "");
      await response.text();
    }
    const firstTenant = { authorization: `Bearer ${SECRET_KEY}_0` };
    const touched = await handler(toolsListRequest(sessionIds[0], firstTenant));
    await touched.text();

    const admitted = await handler(
      initializeRequest(undefined, { authorization: `Bearer ${SECRET_KEY}_x` }),
    );
    expect(admitted.status).toBe(200);
    await admitted.text();

    const stillServed = await handler(
      toolsListRequest(sessionIds[0], firstTenant),
    );
    expect(stillServed.status).toBe(200);
    const evicted = await handler(
      toolsListRequest(sessionIds[1], {
        authorization: `Bearer ${SECRET_KEY}_1`,
      }),
    );
    expect(evicted.status).toBe(404);
  });

  it("caps one key's sessions so it cannot evict other tenants", async () => {
    const handler = createHandler("self42");
    const victim = { authorization: `Bearer ${SECRET_KEY}_victim` };
    const victimInit = await handler(initializeRequest(undefined, victim));
    const victimSession = victimInit.headers.get("mcp-session-id") ?? "";
    await victimInit.text();

    const attackerSessions: string[] = [];
    for (let index = 0; index < 300; index += 1) {
      const response = await handler(initializeRequest());
      attackerSessions.push(response.headers.get("mcp-session-id") ?? "");
      await response.text();
    }

    const victimFollowUp = await handler(
      toolsListRequest(victimSession, victim),
    );
    expect(victimFollowUp.status).toBe(200);
    const attackerOldest = await handler(toolsListRequest(attackerSessions[0]));
    expect(attackerOldest.status).toBe(404);
  });

  it("replays a foreign machine's session via fly-replay", async () => {
    const handler = createHandler("self42");
    const response = await handler(
      toolsListRequest("other77.7e33e2b1-9a45-4c8e-b1de-000000000000"),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("fly-replay")).toBe(
      "prefer_instance=other77;timeout=5s",
    );
  });

  it("returns 404 instead of replaying twice", async () => {
    const handler = createHandler("self42");
    const response = await handler(
      toolsListRequest("other77.7e33e2b1-9a45-4c8e-b1de-000000000000", {
        "fly-replay-src": "instance=other77;state=;t=1754400000000000",
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: -32001,
        message: "Session not found — initialize a new MCP session.",
      },
    });
  });

  it("returns 404 for its own session id after a restart wiped the map", async () => {
    const handler = createHandler("self42");
    const response = await handler(
      toolsListRequest("self42.7e33e2b1-9a45-4c8e-b1de-000000000000"),
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for unknown sessions off Fly", async () => {
    const handler = createHandler(undefined);
    const response = await handler(
      toolsListRequest("7e33e2b1-9a45-4c8e-b1de-000000000000"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32001 },
    });
  });

  it("routes GET and DELETE for foreign sessions the same way", async () => {
    const handler = createHandler("self42");

    for (const method of ["GET", "DELETE"] as const) {
      const response = await handler(
        new Request("http://localhost/mcp", {
          method,
          headers: {
            accept: "application/json, text/event-stream",
            ...BEARER,
            "mcp-session-id": "other77.7e33e2b1-9a45-4c8e-b1de-000000000000",
          },
        }),
      );
      expect(response.status).toBe(204);
      expect(response.headers.get("fly-replay")).toBe(
        "prefer_instance=other77;timeout=5s",
      );
    }
  });

  it("still 400s a POST that has no session and is not initialize", async () => {
    const handler = createHandler("self42");
    const response = await handler(
      mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: -32000,
        message:
          "Bad Request: initialize first, then send mcp-session-id on follow-up requests.",
      },
    });
  });

  it("still 400s GET/DELETE without any session id", async () => {
    const handler = createHandler("self42");
    const response = await handler(
      new Request("http://localhost/mcp", {
        method: "DELETE",
        headers: { accept: "application/json, text/event-stream", ...BEARER },
      }),
    );

    expect(response.status).toBe(400);
  });
});

describe("hosted MCP from kit's network position", () => {
  afterEach(() => vi.unstubAllGlobals());

  async function openSession(
    handler: (request: Request) => Promise<Response>,
  ): Promise<string> {
    const response = await handler(initializeRequest());
    expect(response.status).toBe(200);
    await response.text();
    return response.headers.get("mcp-session-id") ?? "";
  }

  function callTool(sessionId: string, name: string, args: object): Request {
    return mcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name, arguments: args },
      },
      sessionId,
    );
  }

  it("requires a bearer before anything else", async () => {
    const handler = createHandler("self42");
    const response = await handler(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
  });

  it("creates no session for a key the kit does not recognize", async () => {
    const authenticate = vi.fn(async () => false);
    const handler = createIapKitWebMcpHandler({
      logger: silentLogger,
      authenticate,
    });

    const response = await handler(initializeRequest());

    expect(response.status).toBe(403);
    expect(response.headers.get("mcp-session-id")).toBeNull();
    expect(authenticate).toHaveBeenCalledWith(SECRET_KEY);
  });

  it("ignores a per-call baseUrl and never follows redirects", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ products: [], hasMore: false }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const handler = createIapKitWebMcpHandler({
      logger: silentLogger,
      kitBaseUrl: "http://127.0.0.1:3000",
    });
    const sessionId = await openSession(handler);

    const response = await handler(
      callTool(sessionId, "iapkit_list_products", {
        baseUrl: "http://169.254.169.254/latest/meta-data",
      }),
    );
    await response.text();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://127.0.0.1:3000/v1/products");
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("refuses manage_product disable instead of queueing a store deletion", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const handler = createHandler(undefined);
    const sessionId = await openSession(handler);

    const response = await handler(
      callTool(sessionId, "iapkit_manage_product", {
        productId: "premium",
        platform: "IOS",
        action: "disable",
      }),
    );

    expect(await response.text()).toContain(
      MANAGE_PRODUCT_DISABLE_MESSAGE.slice(0, 40),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps a chunked body while it streams", async () => {
    const handler = createHandler(undefined);
    const chunk = new Uint8Array(256 * 1024).fill(0x20);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        if (sent > 64) controller.close();
        else controller.enqueue(chunk);
      },
    });

    const response = await handler(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", ...BEARER },
        body,
        duplex: "half",
      } as RequestInit),
    );

    expect(response.status).toBe(413);
    expect(sent).toBeLessThan(64);
  });
});
