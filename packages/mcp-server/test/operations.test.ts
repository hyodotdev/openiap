import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createIapKitMcpServer } from "../src/mcp";

const SECRET = "openiap-kit_sk_operations";

type KitCall = { method: string; path: string; body?: string; auth?: string };

async function connect(
  respond: (call: KitCall) => unknown = () => ({ ok: true }),
): Promise<{ client: Client; calls: KitCall[]; close: () => Promise<void> }> {
  const calls: KitCall[] = [];
  vi.stubGlobal("fetch", async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const headers = init.headers as Record<string, string>;
    const call = {
      method: init.method ?? "GET",
      path: `${url.pathname}${url.search}`,
      ...(typeof init.body === "string" ? { body: init.body } : {}),
      auth: headers.authorization,
    };
    calls.push(call);
    return new Response(JSON.stringify(respond(call)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  const server = createIapKitMcpServer({ kitBaseUrl: "https://kit.test" });
  const client = new Client({ name: "test", version: "1" });
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    calls,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function payload(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  const [content] = result.content as Array<{ type: string; text: string }>;
  return JSON.parse(content.text);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("operations tools", () => {
  it("registers reads as read-only and writes as writes", async () => {
    const { client, close } = await connect();
    try {
      const { tools } = await client.listTools();
      const hint = (name: string) =>
        tools.find((tool) => tool.name === name)?.annotations?.readOnlyHint;
      expect(hint("iapkit_list_deliveries")).toBe(true);
      expect(hint("iapkit_list_inbound_notifications")).toBe(true);
      expect(hint("iapkit_user_timeline")).toBe(true);
      expect(hint("iapkit_resend_delivery")).toBe(false);
      expect(hint("iapkit_resync_from_store")).toBe(false);
    } finally {
      await close();
    }
  });

  it("calls the secret-key operations routes", async () => {
    const { client, calls, close } = await connect();
    const call = (name: string, args: Record<string, unknown>) =>
      client.callTool({ name, arguments: { apiKey: SECRET, ...args } });
    try {
      await call("iapkit_list_deliveries", {
        status: "failed",
        eventType: "entitlement.revoked",
        limit: 10,
      });
      await call("iapkit_resend_delivery", {
        deliveryId: "outboundDeliveries/1",
      });
      await call("iapkit_list_inbound_notifications", { cursor: "c 1" });
      await call("iapkit_resync_from_store", {
        subscriptionId: "subscriptions_1",
      });
      await call("iapkit_user_timeline", { userId: "user a" });
      expect(calls).toEqual([
        {
          method: "GET",
          path: "/v1/webhooks/deliveries?status=failed&eventType=entitlement.revoked&limit=10",
          auth: `Bearer ${SECRET}`,
        },
        {
          method: "POST",
          path: "/v1/webhooks/deliveries/outboundDeliveries%2F1/resend",
          auth: `Bearer ${SECRET}`,
        },
        {
          method: "GET",
          path: "/v1/webhooks/notifications?cursor=c+1",
          auth: `Bearer ${SECRET}`,
        },
        {
          method: "POST",
          path: "/v1/subscriptions/resync",
          body: JSON.stringify({ subscriptionId: "subscriptions_1" }),
          auth: `Bearer ${SECRET}`,
        },
        {
          method: "GET",
          path: "/v1/subscriptions/timeline?userId=user%20a",
          auth: `Bearer ${SECRET}`,
        },
      ]);
    } finally {
      await close();
    }
  });

  it("needs exactly one re-sync target and a secret key", async () => {
    const { client, calls, close } = await connect();
    try {
      const both = await client.callTool({
        name: "iapkit_resync_from_store",
        arguments: { apiKey: SECRET, purchaseId: "p", subscriptionId: "s" },
      });
      expect(both.isError).toBe(true);
      const publishable = await client.callTool({
        name: "iapkit_resend_delivery",
        arguments: {
          apiKey: "openiap-kit_pk_mobile",
          deliveryId: "outboundDeliveries_1",
        },
      });
      expect(publishable.isError).toBe(true);
      expect(calls).toEqual([]);
    } finally {
      await close();
    }
  });

  it("returns kit's response unchanged", async () => {
    const { client, close } = await connect(() => ({
      notifications: [{ _id: "webhookEvents_1", status: "applied" }],
      hasMore: false,
      nextCursor: null,
    }));
    try {
      const result = await client.callTool({
        name: "iapkit_list_inbound_notifications",
        arguments: { apiKey: SECRET },
      });
      expect(payload(result)).toEqual({
        notifications: [{ _id: "webhookEvents_1", status: "applied" }],
        hasMore: false,
        nextCursor: null,
      });
    } finally {
      await close();
    }
  });
});
