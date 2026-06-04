import { createIapKitWebMcpHandler } from "@hyodotdev/openiap-mcp-server/web";

/**
 * handleIapKitMcpRequest exports the Kit-hosted MCP request handler created by
 * createIapKitWebMcpHandler. Set IAPKIT_MCP_LEGACY_ALIASES=true to enable
 * includeLegacyOpenIapAliases and expose legacy openiap_* tool aliases.
 */
export const handleIapKitMcpRequest = createIapKitWebMcpHandler({
  includeLegacyOpenIapAliases: process.env.IAPKIT_MCP_LEGACY_ALIASES === "true",
});
