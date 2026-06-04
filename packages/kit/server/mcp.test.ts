import { describe, expect, it } from "vitest";

import { handleIapKitMcpRequest } from "./mcp";

describe("IAPKit MCP route handler", () => {
  it("initializes a ChatGPT-compatible MCP session", async () => {
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
    expect(toolNames).not.toContain("openiap_inspect_state");
  });
});

function postMcp(body: unknown, sessionId?: string): Promise<Response> {
  return handleIapKitMcpRequest(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

function parseSseJson(raw: string): any {
  const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) {
    throw new Error(`No SSE data line found: ${raw}`);
  }
  return JSON.parse(dataLine.slice("data: ".length));
}
