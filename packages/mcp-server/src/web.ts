import { randomUUID } from "node:crypto";

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import {
  INSUFFICIENT_API_KEY_SCOPE_MESSAGE,
  isSecretApiKey,
  MISSING_API_KEY_MESSAGE,
} from "./auth.js";
import { normalizeKitBaseUrl } from "./kit-client.js";
import { createIapKitMcpServer } from "./mcp.js";
import {
  buildSessionId,
  currentMachineId,
  routeUnknownSession,
} from "./session-routing.js";
import {
  createMcpSessionStore,
  MCP_SESSION_CAPACITY_MESSAGE,
  MCP_SESSION_CAPACITY_RETRY_AFTER_SECONDS,
  type BoundedSessionStore,
} from "./session-store.js";

const MAX_MCP_BODY_BYTES = 1024 * 1024;
const MCP_BODY_TOO_LARGE_ERROR = "MCP request body is too large";
const INVALID_API_KEY_MESSAGE =
  "The bearer is not an active IAPKit secret admin key.";
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
   * The kit every tool calls. Defaults to IAPKIT_BASE_URL. Tool calls cannot
   * override it: the hosted server sits inside kit's network.
   */
  kitBaseUrl?: string;
  /**
   * Resolves a bearer to an opaque tenant id (kit: its project id) before a
   * session is created, or null to refuse it. Session slots are then spent
   * only by key holders, and each tenant has a share. Without it, the prefix
   * check alone admits a session and no per-tenant share applies.
   */
  authenticate?: (apiKey: string) => Promise<string | null>;
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
  const transports =
    createMcpSessionStore<WebStandardStreamableHTTPServerTransport>(logger);
  const kitBaseUrl = normalizeKitBaseUrl(
    options.kitBaseUrl ?? process.env.IAPKIT_BASE_URL,
  );
  const authenticate = options.authenticate;

  return async function handleIapKitMcpRequest(
    request: Request,
  ): Promise<Response> {
    try {
      if (request.method === "OPTIONS") {
        return withIapKitMcpCors(
          request,
          new Response(null, { status: 204 }),
          allowedOrigins,
        );
      }

      const bearerToken = parseBearerToken(
        request.headers.get("authorization"),
      );
      if (!bearerToken) {
        return withIapKitMcpCors(
          request,
          jsonRpcError(401, -32001, MISSING_API_KEY_MESSAGE, {
            "www-authenticate": "Bearer",
          }),
          allowedOrigins,
        );
      }
      if (!isSecretApiKey(bearerToken)) {
        return withIapKitMcpCors(
          request,
          jsonRpcError(403, -32003, INSUFFICIENT_API_KEY_SCOPE_MESSAGE),
          allowedOrigins,
        );
      }

      const authInfo: AuthInfo = {
        token: bearerToken,
        clientId: "iapkit-project-api-key",
        scopes: ["iapkit:project"],
      };

      if (request.method === "POST") {
        const response = await handlePost(request, {
          transports,
          logger,
          authInfo,
          machineId,
          kitBaseUrl,
          authenticate,
        });
        return withIapKitMcpCors(request, response, allowedOrigins);
      }

      if (request.method === "GET" || request.method === "DELETE") {
        const response = await handleExistingSession(
          request,
          transports,
          authInfo,
          machineId,
        );
        return withIapKitMcpCors(request, response, allowedOrigins);
      }

      return withIapKitMcpCors(
        request,
        jsonRpcError(405, -32000, "Method not allowed"),
        allowedOrigins,
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        return withIapKitMcpCors(
          request,
          jsonRpcError(400, -32700, "Parse error: Invalid JSON"),
          allowedOrigins,
        );
      }
      if (isMcpBodyTooLargeError(error)) {
        return withIapKitMcpCors(
          request,
          jsonRpcError(413, -32000, "Payload Too Large"),
          allowedOrigins,
        );
      }
      logger.error("IAPKit MCP request failed:", error);
      return withIapKitMcpCors(
        request,
        jsonRpcError(500, -32603, "Internal server error"),
        allowedOrigins,
      );
    }
  };
}

interface PostContext {
  transports: BoundedSessionStore<WebStandardStreamableHTTPServerTransport>;
  logger: Pick<Console, "error" | "info">;
  authInfo: AuthInfo;
  machineId: string | undefined;
  kitBaseUrl: string;
  authenticate: IapKitWebMcpHandlerOptions["authenticate"];
}

async function handlePost(
  request: Request,
  {
    transports,
    logger,
    authInfo,
    machineId,
    kitBaseUrl,
    authenticate,
  }: PostContext,
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

  const owner = authenticate ? await authenticate(authInfo.token) : undefined;
  if (owner === null) {
    return jsonRpcError(403, -32003, INVALID_API_KEY_MESSAGE);
  }

  const reservation = transports.reserve(owner);
  if (!reservation) {
    return jsonRpcError(503, -32000, MCP_SESSION_CAPACITY_MESSAGE, {
      "retry-after": String(MCP_SESSION_CAPACITY_RETRY_AFTER_SECONDS),
    });
  }

  let sessionStored = false;
  let transport!: WebStandardStreamableHTTPServerTransport;
  transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => buildSessionId(machineId, randomUUID()),
    onsessioninitialized: (initializedSessionId) => {
      reservation.commit(initializedSessionId, transport);
      sessionStored = true;
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

  const server = createIapKitMcpServer({ kitBaseUrl });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request, {
      parsedBody: body,
      authInfo,
    });
  } finally {
    if (!sessionStored) {
      reservation.release();
      await transport
        .close()
        .catch((error: unknown) =>
          logger.error("IAPKit MCP session cleanup failed:", error),
        );
    }
  }
}

async function handleExistingSession(
  request: Request,
  transports: BoundedSessionStore<WebStandardStreamableHTTPServerTransport>,
  authInfo: AuthInfo,
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

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

// Reads a clone so the transport can still consume the original. The cap
// applies while streaming, so a chunked body without Content-Length cannot
// grow past it in memory.
async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MCP_BODY_BYTES) {
    throw new Error(MCP_BODY_TOO_LARGE_ERROR);
  }
  const stream = request.clone().body;
  if (!stream) return undefined;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let raw = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_MCP_BODY_BYTES) {
        throw new Error(MCP_BODY_TOO_LARGE_ERROR);
      }
      raw += decoder.decode(value, { stream: true });
    }
  } finally {
    // Not awaited: a tee branch's cancel settles only once both branches end.
    void reader.cancel().catch(() => undefined);
  }
  raw += decoder.decode();
  if (!raw.trim()) return undefined;
  return JSON.parse(raw);
}

function isMcpBodyTooLargeError(error: unknown): boolean {
  return error instanceof Error && error.message === MCP_BODY_TOO_LARGE_ERROR;
}

export function withIapKitMcpCors(
  request: Request,
  response: Response,
  allowedOrigins: string[] = parseAllowedOrigins(
    process.env.IAPKIT_MCP_ALLOWED_ORIGINS,
  ),
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
  headers.set(
    "Access-Control-Expose-Headers",
    "mcp-session-id, retry-after, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-scope",
  );

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
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code, message },
      id: null,
    }),
    {
      status: statusCode,
      headers: { "content-type": "application/json", ...extraHeaders },
    },
  );
}
