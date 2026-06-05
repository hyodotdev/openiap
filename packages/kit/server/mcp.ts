import { createIapKitWebMcpHandler } from "@hyodotdev/openiap-mcp-server/web";

/** Handles MCP HTTP requests for the Kit-hosted IAPKit MCP endpoint. */
export const handleIapKitMcpRequest = createIapKitWebMcpHandler();
