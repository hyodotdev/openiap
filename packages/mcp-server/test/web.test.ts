import { describe, expect, it } from "vitest";

import { createIapKitWebMcpHandler } from "../src/web";

// Regression suite for GitHub issue #287: the hosted /mcp endpoint kept
// per-process session state, so a valid mcp-session-id landing on a
// sibling Fly machine was rejected with 400 "initialize first". The web
// handler must instead (a) mint machine-prefixed session ids, (b) replay
// foreign-machine sessions via `fly-replay`, and (c) answer 404 (not
// 400) for sessions it genuinely cannot serve so spec-compliant clients
// transparently re-initialize.

const silentLogger = { error: () => undefined, info: () => undefined };

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

  it("rejects new sessions at capacity without evicting active sessions", async () => {
    const handler = createHandler("self42");
    let firstSessionId = "";

    for (let index = 0; index < 256; index += 1) {
      const response = await handler(initializeRequest());
      expect(response.status).toBe(200);
      firstSessionId ||= response.headers.get("mcp-session-id") ?? "";
      await response.text();
    }

    const denied = await handler(
      initializeRequest(undefined, { origin: "https://chatgpt.com" }),
    );
    expect(denied.status).toBe(503);
    expect(denied.headers.get("retry-after")).toBe("5");
    expect(denied.headers.get("access-control-allow-origin")).toBe(
      "https://chatgpt.com",
    );

    const followUp = await handler(toolsListRequest(firstSessionId));
    expect(followUp.status).toBe(200);
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
        headers: { accept: "application/json, text/event-stream" },
      }),
    );

    expect(response.status).toBe(400);
  });
});
