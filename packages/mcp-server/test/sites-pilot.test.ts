import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PILOT_TOOLS } from "../pilots/sites/fixture.js";
import { handlePilotRequest, PILOT_MCP_PATH } from "../pilots/sites/worker.js";
import { createIapKitMcpServer } from "../src/mcp.js";

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://pilot.example${PILOT_MCP_PATH}`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2025-06-18",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function call(name: string, args: Record<string, unknown> = {}): Request {
  return request({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name, arguments: args },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("Sites MCP pilot", () => {
  it("keeps all 16 existing tools enabled by default", async () => {
    const server = createIapKitMcpServer();
    const client = new Client({ name: "regression", version: "1" });
    const [local, remote] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(remote);
      await client.connect(local);
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(16);
      expect(tools.map((tool) => tool.name)).toContain("iapkit_create_product");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("initializes without retaining a session and serves the next request", async () => {
    const init = await handlePilotRequest(
      request({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "pilot", version: "1" },
        },
      }),
    );
    expect(init.status).toBe(200);
    expect(init.headers.has("mcp-session-id")).toBe(false);
    await init.json();
    const list = await handlePilotRequest(
      request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    );
    expect(list.status).toBe(200);
    const discovery = await list.json();
    expect(discovery.result.tools).toHaveLength(PILOT_TOOLS.length);
    expect(discovery).toMatchObject({
      result: {
        tools: expect.arrayContaining(
          PILOT_TOOLS.map((name) => expect.objectContaining({ name })),
        ),
      },
    });
  });

  it("runs existing handlers on fixtures without any outgoing network call", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Network disabled"));
    const setup = await handlePilotRequest(
      call("iapkit_setup", { framework: "expo" }),
    );
    expect(await setup.json()).toMatchObject({
      result: {
        content: [
          {
            type: "text",
            text: expect.stringContaining("IAPKIT_PUBLISHABLE_KEY"),
          },
        ],
      },
    });
    const products = await handlePilotRequest(call("iapkit_list_products"));
    expect(await products.json()).toMatchObject({
      result: {
        content: [
          {
            type: "text",
            text: expect.stringContaining("com.example.sites_monthly"),
          },
        ],
      },
    });
    const status = await handlePilotRequest(
      call("iapkit_check_status", { userId: "synthetic-user" }),
    );
    expect(await status.json()).toMatchObject({
      result: {
        content: [
          { type: "text", text: expect.stringContaining('"active": false') },
        ],
      },
    });
    expect(network).not.toHaveBeenCalled();
  });

  it("rejects direct write calls as well as omitting them from discovery", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Network disabled"));
    const response = await handlePilotRequest(
      call("iapkit_create_product", { productId: "must-not-create" }),
    );
    const body = await response.json();
    expect(body).toMatchObject({
      result: {
        isError: true,
        content: [{ type: "text", text: expect.stringContaining("not found") }],
      },
    });
    expect(network).not.toHaveBeenCalled();
  });

  it("rejects credentials and upstream overrides before executing a tool", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Network disabled"));
    for (const args of [
      { apiKey: "openiap-kit_sk_do_not_use" },
      { baseUrl: "https://kit.openiap.dev" },
    ]) {
      const response = await handlePilotRequest(
        call("iapkit_list_products", args),
      );
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain("openiap-kit_sk_do_not_use");
    }
    expect(network).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies with or without Content-Length", async () => {
    const variants: Record<string, string>[] = [
      {},
      { "content-length": String(70 * 1024) },
    ];
    for (const headers of variants) {
      const response = await handlePilotRequest(
        request(
          {
            jsonrpc: "2.0",
            id: 1,
            method: "ping",
            params: { value: "x".repeat(70 * 1024) },
          },
          headers,
        ),
      );
      expect(response.status).toBe(413);
    }
  });

  it("rejects malformed JSON and batch requests", async () => {
    const invalid = new Request(`https://pilot.example${PILOT_MCP_PATH}`, {
      method: "POST",
      body: "{",
    });
    expect((await handlePilotRequest(invalid)).status).toBe(400);
    expect(
      (
        await handlePilotRequest(
          request([{ jsonrpc: "2.0", id: 1, method: "ping" }]),
        )
      ).status,
    ).toBe(400);
  });

  it("allows ChatGPT origins and rejects unrelated origins", async () => {
    const message = { jsonrpc: "2.0", id: 1, method: "ping" };
    const allowed = await handlePilotRequest(
      request(message, { origin: "https://chatgpt.com" }),
    );
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://chatgpt.com",
    );
    const denied = await handlePilotRequest(
      request(message, { origin: "https://unrelated.example" }),
    );
    expect(denied.status).toBe(403);
  });

  it("does not open an SSE stream or accept DELETE requests", async () => {
    for (const method of ["GET", "DELETE"]) {
      expect(
        (
          await handlePilotRequest(
            new Request(`https://pilot.example${PILOT_MCP_PATH}`, { method }),
          )
        ).status,
      ).toBe(405);
    }
  });
});
