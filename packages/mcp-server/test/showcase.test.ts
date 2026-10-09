import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createShowcaseMcpServer } from "../src/showcase.js";
import { createShowcaseSubmissionSchema } from "../src/showcase-schema.js";

describe("public showcase MCP", () => {
  it("rejects relative links without throwing from safeParse", () => {
    const schema = createShowcaseSubmissionSchema({
      categories: ["Education"],
      libraries: ["expo-iap"],
    });
    const submission = {
      name: "Test app",
      tagline: "Learn something every day",
      category: "Education",
      logo: "https://example.com/icon.png",
      library: ["expo-iap"],
      web: "https://example.com",
      contactEmail: "owner@example.com",
      ownershipConfirmed: true,
    };
    for (const field of ["logo", "ios", "android", "github", "web"]) {
      expect(
        schema.safeParse({ ...submission, [field]: "assets/icon.png" }).success,
      ).toBe(false);
    }
  });
  it("offers submission and status tools without administrative capabilities", async () => {
    const server = createShowcaseMcpServer({
      categories: ["Education"],
      libraries: ["expo-iap"],
      submit: async () => ({
        id: "123e4567-e89b-42d3-a456-426614174000",
        status: "pending",
      }),
      status: async () => "pending",
    });
    const client = new Client({ name: "test", version: "1" });
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual([
        "openiap_showcase_options",
        "openiap_showcase_submit_app",
        "openiap_showcase_submission_status",
      ]);
      expect(
        tools.find((tool) => tool.name === "openiap_showcase_submit_app")
          ?.annotations?.readOnlyHint,
      ).toBe(false);
      expect(
        tools.find((tool) => tool.name === "openiap_showcase_submission_status")
          ?.annotations?.readOnlyHint,
      ).toBe(true);
      const input = tools.find(
        (tool) => tool.name === "openiap_showcase_submit_app",
      )?.inputSchema;
      expect(input?.properties?.category).toMatchObject({
        enum: ["Education"],
      });
      expect(input?.properties?.library).toMatchObject({
        items: { enum: ["expo-iap"] },
      });
      const response = await client.callTool({
        name: "openiap_showcase_submission_status",
        arguments: { id: "123e4567-e89b-42d3-a456-426614174000" },
      });
      expect(response.content).toEqual([
        { type: "text", text: '{"status":"pending"}' },
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("does not relay database errors or secrets in tool results", async () => {
    const server = createShowcaseMcpServer({
      categories: ["Education"],
      libraries: ["expo-iap"],
      submit: async () => {
        throw new Error("postgres://private-credential");
      },
      status: async () => {
        throw new Error("postgres://private-credential");
      },
    });
    const client = new Client({ name: "test", version: "1" });
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const response = await client.callTool({
        name: "openiap_showcase_submit_app",
        arguments: {
          name: "Test app",
          tagline: "Learn something every day",
          category: "Education",
          logo: "https://example.com/icon.png",
          library: ["expo-iap"],
          web: "https://example.com",
          contactEmail: "owner@example.com",
          ownershipConfirmed: true,
        },
      });
      expect(response.isError).toBe(true);
      expect(JSON.stringify(response)).not.toContain("private-credential");
      const status = await client.callTool({
        name: "openiap_showcase_submission_status",
        arguments: { id: "123e4567-e89b-42d3-a456-426614174000" },
      });
      expect(status.isError).toBe(true);
      expect(JSON.stringify(status)).not.toContain("private-credential");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
