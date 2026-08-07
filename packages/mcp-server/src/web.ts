import { randomUUID } from "node:crypto";

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import {
  INSUFFICIENT_API_KEY_SCOPE_MESSAGE,
  isPublishableApiKey,
} from "./auth.js";
import { createIapKitMcpServer } from "./mcp.js";
import {
  buildSessionId,
  currentMachineId,
  routeUnknownSession,
} from "./session-routing.js";

const MAX_MCP_BODY_BYTES = 1024 * 1024;
const MCP_BODY_TOO_LARGE_ERROR = "MCP request body is too large";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://chatgpt.com",
  "https://chat.openai.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

export interface IapKitWebMcpHandlerOptions {
  allowedOrigins?: string[];
  logger?: Pick<Console, "error" | "info">;
  /**
   * Identity of this process for session affinity. Defaults to
   * FLY_MACHINE_ID; session ids are prefixed with it so a follow-up
   * request landing on a sibling machine can be replayed to the owner
   * (GitHub issue #287). Undefined disables replay routing.
   */
  machineId?: string;
}

export function createIapKitWebMcpHandler(
  options: IapKitWebMcpHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const logger = options.logger ?? console;
  const allowedOrigins =
    options.allowedOrigins ??
    parseAllowedOrigins(process.env.IAPKIT_MCP_ALLOWED_ORIGINS);
  const machineId = options.machineId ?? currentMachineId();
  const transports = new Map<
    string,
    WebStandardStreamableHTTPServerTransport
  >();

  return async function handleIapKitMcpRequest(
    request: Request,
  ): Promise<Response> {
    try {
      if (request.method === "OPTIONS") {
        return withCors(
          request,
          new Response(null, { status: 204 }),
          allowedOrigins,
        );
      }

      const bearerToken = parseBearerToken(
        request.headers.get("authorization"),
      );
      if (isPublishableApiKey(bearerToken)) {
        return withCors(
          request,
          jsonRpcError(403, -32003, INSUFFICIENT_API_KEY_SCOPE_MESSAGE),
          allowedOrigins,
        );
      }

      const authInfo = authInfoFromRequest(request);

      if (request.method === "POST") {
        const response = await handlePost(
          request,
          transports,
          logger,
          authInfo,
          machineId,
        );
        return withCors(request, response, allowedOrigins);
      }

      if (request.method === "GET" || request.method === "DELETE") {
        const response = await handleExistingSession(
          request,
          transports,
          authInfo,
          machineId,
        );
        return withCors(request, response, allowedOrigins);
      }

      return withCors(
        request,
        jsonRpcError(405, -32000, "Method not allowed"),
        allowedOrigins,
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        return withCors(
          request,
          jsonRpcError(400, -32700, "Parse error: Invalid JSON"),
          allowedOrigins,
        );
      }
      if (isMcpBodyTooLargeError(error)) {
        return withCors(
          request,
          jsonRpcError(413, -32000, "Payload Too Large"),
          allowedOrigins,
        );
      }
      logger.error("IAPKit MCP request failed:", error);
      return withCors(
        request,
        jsonRpcError(500, -32603, "Internal server error"),
        allowedOrigins,
      );
    }
  };
}

async function handlePost(
  request: Request,
  transports: Map<string, WebStandardStreamableHTTPServerTransport>,
  logger: Pick<Console, "error" | "info">,
  authInfo: AuthInfo | undefined,
  machineId: string | undefined,
): Promise<Response> {
  const sessionId = request.headers.get("mcp-session-id") ?? undefined;
  const body = await readJsonBody(request);
  const existingTransport = sessionId ? transports.get(sessionId) : undefined;

  if (existingTransport) {
    return existingTransport.handleRequest(request, {
      parsedBody: body,
      authInfo,
    });
  }

  if (sessionId) {
    return unknownSessionResponse(request, sessionId, machineId);
  }

  if (!isInitializeRequest(body)) {
    return jsonRpcError(
      400,
      -32000,
      "Bad Request: initialize first, then send mcp-session-id on follow-up requests.",
    );
  }

  let transport!: WebStandardStreamableHTTPServerTransport;
  transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => buildSessionId(machineId, randomUUID()),
    onsessioninitialized: (initializedSessionId) => {
      transports.set(initializedSessionId, transport);
      logger.info(`IAPKit MCP session initialized: ${initializedSessionId}`);
    },
    onsessionclosed: (closedSessionId) => {
      transports.delete(closedSessionId);
      logger.info(`IAPKit MCP session closed: ${closedSessionId}`);
    },
  });

  transport.onclose = () => {
    const initializedSessionId = transport.sessionId;
    if (initializedSessionId) transports.delete(initializedSessionId);
  };

  const server = createIapKitMcpServer();
  await server.connect(transport);
  return transport.handleRequest(request, {
    parsedBody: body,
    authInfo,
  });
}

async function handleExistingSession(
  request: Request,
  transports: Map<string, WebStandardStreamableHTTPServerTransport>,
  authInfo: AuthInfo | undefined,
  machineId: string | undefined,
): Promise<Response> {
  const sessionId = request.headers.get("mcp-session-id") ?? undefined;
  const transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    if (sessionId) {
      return unknownSessionResponse(request, sessionId, machineId);
    }
    return jsonRpcError(400, -32000, "Invalid or missing mcp-session-id");
  }

  return transport.handleRequest(request, { authInfo });
}

/**
 * Answers a request whose session id isn't in this process's transport
 * map: replay it to the machine that minted the id when possible,
 * otherwise 404 so a spec-compliant client transparently re-initializes.
 * (The previous 400 "initialize first" reply broke that recovery path —
 * GitHub issue #287.)
 */
function unknownSessionResponse(
  request: Request,
  sessionId: string,
  machineId: string | undefined,
): Response {
  const routing = routeUnknownSession({
    sessionId,
    machineId,
    alreadyReplayed: request.headers.has("fly-replay-src"),
  });

  if (routing.action === "replay") {
    // Fly's proxy intercepts any response carrying `fly-replay` and
    // re-sends the original request to the named machine; the client
    // never sees this interim response. `prefer_instance` rather than
    // `instance` so a destroyed or restarting owner degrades to "route
    // anywhere" — that replay carries `fly-replay-src`, so wherever it
    // lands answers 404 and the client re-initializes. A bare
    // `instance=` would instead fail at the proxy after its timeout,
    // and the 404 this fix depends on would never be produced.
    return new Response(null, {
      status: 204,
      headers: {
        "fly-replay": `prefer_instance=${routing.targetMachineId};timeout=5s`,
      },
    });
  }

  return jsonRpcError(
    404,
    -32001,
    "Session not found — initialize a new MCP session.",
  );
}

function authInfoFromRequest(request: Request): AuthInfo | undefined {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) return undefined;

  return {
    token,
    clientId: "iapkit-project-api-key",
    scopes: ["iapkit:project"],
  };
}

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MCP_BODY_BYTES) {
    throw new Error(MCP_BODY_TOO_LARGE_ERROR);
  }

  const raw = await request.clone().text();
  if (new TextEncoder().encode(raw).length > MAX_MCP_BODY_BYTES) {
    throw new Error(MCP_BODY_TOO_LARGE_ERROR);
  }
  if (!raw.trim()) return undefined;
  return JSON.parse(raw);
}

function isMcpBodyTooLargeError(error: unknown): boolean {
  return error instanceof Error && error.message === MCP_BODY_TOO_LARGE_ERROR;
}

function withCors(
  request: Request,
  response: Response,
  allowedOrigins: string[],
): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");
  const allowAll = allowedOrigins.includes("*");

  if (origin && (allowAll || allowedOrigins.includes(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set(
    "Access-Control-Allow-Headers",
    "authorization, content-type, last-event-id, mcp-protocol-version, mcp-session-id",
  );
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Expose-Headers", "mcp-session-id");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
}

function jsonRpcError(
  statusCode: number,
  code: number,
  message: string,
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code, message },
      id: null,
    }),
    {
      status: statusCode,
      headers: { "content-type": "application/json" },
    },
  );
}
