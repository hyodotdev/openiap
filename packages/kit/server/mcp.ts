import { createIapKitWebMcpHandler } from "@hyodotdev/openiap-mcp-server/web";

export const handleIapKitMcpRequest = createIapKitWebMcpHandler({
  includeLegacyOpenIapAliases: process.env.IAPKIT_MCP_LEGACY_ALIASES === "true",
});
