import { beforeEach, describe, expect, it, vi } from "vitest";

const convexMock = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn() }));
vi.mock("./convex", () => ({
  client: { query: convexMock.query, mutation: convexMock.mutation },
}));

const { handleIapKitMcpRequest } = await import("./mcp");

const SECRET_KEY = "openiap-kit_sk_hosted";
const ACCESS_TOKEN = "iapkit_oat_connector";

describe("IAPKit MCP route handler", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    convexMock.query.mockReset();
    convexMock.mutation.mockReset();
    convexMock.query.mockResolvedValue({
      found: true,
      projectId: "projects_1",
    });
  });

  it("creates no session until Convex confirms the secret key", async () => {
    convexMock.query.mockResolvedValue({ found: false, projectId: null });

    const response = await postMcp(INITIALIZE);

    expect(response.status).toBe(403);
    expect(response.headers.get("mcp-session-id")).toBeNull();
    expect(convexMock.query).toHaveBeenCalledWith(expect.anything(), {
      apiKey: SECRET_KEY,
    });
  });

  it("initializes a Codex-compatible MCP session", async () => {
    const initResponse = await postMcp({
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

    const toolsResponse = await postMcp(
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      sessionId ?? undefined,
    );
    const toolsEvent = parseSseJson(await toolsResponse.text());
    const toolNames = toolsEvent.result.tools.map(
      (tool: { name: string }) => tool.name,
    );

    expect(toolNames).toContain("iapkit_inspect_state");
    expect(toolNames).toContain("iapkit_manage_product");
    expect(toolNames).toContain("iapkit_get_client_payload");
    expect(toolNames).toContain("iapkit_set_client_payload");
    expect(toolNames).toContain("iapkit_remove_client_payload");
    for (const name of [
      "iapkit_get_client_payload_draft",
      "iapkit_set_client_payload_draft",
      "iapkit_publish_client_payload",
      "iapkit_get_client_payload_history",
      "iapkit_rollback_client_payload",
    ]) {
      expect(toolNames).toContain(name);
    }
    expect(toolNames).toContain("iapkit_revenue_analytics");
    expect(toolNames).toContain("iapkit_sync_products");
    expect(toolNames).toContain("iapkit_sync_status");
    expect(toolNames).not.toContain("openiap_inspect_state");
  });

  it("serves a read-only OAuth grant its read tools and records the use", async () => {
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64));
    convexMock.query.mockResolvedValue({
      grantId: "a".repeat(32),
      projectId: "projects_1",
      scope: "read",
      recordUse: true,
    });
    convexMock.mutation.mockResolvedValue(null);
    const auth = { authorization: `Bearer ${ACCESS_TOKEN}` };

    const init = await postMcp(INITIALIZE, undefined, auth);
    expect(init.status).toBe(200);
    const sessionId = init.headers.get("mcp-session-id") ?? undefined;
    const tools = await postMcp(
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      sessionId,
      auth,
    );
    const names = parseSseJson(await tools.text()).result.tools.map(
      (tool: { name: string }) => tool.name,
    );

    expect(names).toContain("iapkit_inspect_state");
    expect(names).not.toContain("iapkit_set_client_payload_draft");
    expect(convexMock.query).toHaveBeenCalledWith(expect.anything(), {
      server: { issuedAt: expect.any(Number), mac: expect.any(String) },
      accessToken: ACCESS_TOKEN,
    });
    expect(convexMock.mutation).toHaveBeenCalledWith(expect.anything(), {
      server: { issuedAt: expect.any(Number), mac: expect.any(String) },
      accessToken: ACCESS_TOKEN,
    });
  });

  it("answers 401 for an unknown token or a server without its secret", async () => {
    const auth = { authorization: `Bearer ${ACCESS_TOKEN}` };

    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64));
    convexMock.query.mockResolvedValue(null);
    const unknown = await postMcp(INITIALIZE, undefined, auth);
    expect(unknown.status).toBe(401);
    expect(unknown.headers.get("www-authenticate")).toContain(
      'error="invalid_token"',
    );

    // A Convex deployment with another secret refuses the server.
    convexMock.query.mockRejectedValue(new Error("UNAUTHENTICATED"));
    const refused = await postMcp(INITIALIZE, undefined, auth);
    expect(refused.status).toBe(401);

    convexMock.query.mockClear();
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", undefined);
    const unconfigured = await postMcp(INITIALIZE, undefined, auth);
    expect(unconfigured.status).toBe(401);
    expect(convexMock.query).not.toHaveBeenCalled();
    expect(convexMock.mutation).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid MCP JSON", async () => {
    const response = await rawPostMcp("{");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32700, message: "Parse error: Invalid JSON" },
    });
  });

  it("returns 403 before publishable keys can initialize the admin MCP surface", async () => {
    const response = await postMcp(
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
      { authorization: "Bearer openiap-kit_pk_mobile" },
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("mcp-session-id")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: -32003,
        message: expect.stringContaining("openiap-kit_sk_"),
      },
    });
  });

  it("returns 413 for oversized MCP JSON bodies", async () => {
    const response = await rawPostMcp("x".repeat(1024 * 1024 + 1));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32000, message: "Payload Too Large" },
    });
  });
});

function postMcp(
  body: unknown,
  sessionId?: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return handleIapKitMcpRequest(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        authorization: `Bearer ${SECRET_KEY}`,
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    }),
  );
}

function rawPostMcp(body: string): Promise<Response> {
  return handleIapKitMcpRequest(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        authorization: `Bearer ${SECRET_KEY}`,
      },
      body,
    }),
  );
}

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "vitest", version: "0.0.0" },
  },
};

function parseSseJson(raw: string): any {
  const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) {
    throw new Error(`No SSE data line found: ${raw}`);
  }
  return JSON.parse(dataLine.slice("data: ".length));
}
