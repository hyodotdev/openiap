import {
  createIapKitWebMcpHandler,
  withIapKitMcpCors,
} from "@hyodotdev/openiap-mcp-server/web";
import type { Context } from "hono";

import { api } from "@/convex";
import type { ConsumeResult } from "./api/v1/rate-limit";
import { client } from "./convex";

/** Handles MCP HTTP requests for the Kit-hosted IAPKit MCP endpoint. */
export const handleIapKitMcpRequest = createIapKitWebMcpHandler({
  // A session slot needs an active secret key, not just its prefix.
  authenticate: async (apiKey) =>
    (await client.query(api.projects.setupStatus.getSetupStatus, { apiKey }))
      .found,
});

/** Preserves MCP JSON-RPC and CORS semantics for admission failures. */
export function mcpRateLimitResponse(
  c: Context,
  result: ConsumeResult,
): Response {
  return withIapKitMcpCors(
    c.req.raw,
    c.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: `Too many requests. Retry after ${result.retryAfterSec}s.`,
        },
        id: null,
      },
      429,
    ),
  );
}
