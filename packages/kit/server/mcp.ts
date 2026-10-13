import {
  createIapKitWebMcpHandler,
  withIapKitMcpCors,
} from "@hyodotdev/openiap-mcp-server/web";
import type { Context } from "hono";

import { api } from "@/convex";
import type { ConsumeResult } from "./api/v1/rate-limit";

/** Handles MCP HTTP requests for the Kit-hosted IAPKit MCP endpoint. */
export const handleIapKitMcpRequest = createIapKitWebMcpHandler({
  // A session slot needs an active secret key, not just its prefix. The
  // project id, which this read already returns to the key holder, is the
  // tenant whose share of sessions it uses. Loaded on first use: importing
  // ./convex requires a Convex URL.
  authenticate: async (apiKey) => {
    const { client } = await import("./convex");
    const status = await client.query(api.projects.setupStatus.getSetupStatus, {
      apiKey,
    });
    return status.found ? status.projectId : null;
  },
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
