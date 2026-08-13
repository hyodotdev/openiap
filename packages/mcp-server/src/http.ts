#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server as NodeHttpServer,
  type ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { INSUFFICIENT_API_KEY_SCOPE_MESSAGE, isSecretApiKey } from "./auth.js";
import {
  createIapKitMcpServer,
  IAPKIT_MCP_SERVER_NAME,
  IAPKIT_MCP_SERVER_VERSION,
} from "./mcp.js";
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

const DEFAULT_MCP_PATH = "/mcp";
const DEFAULT_PORT = 3939;
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

type AuthenticatedRequest = IncomingMessage & { auth?: AuthInfo };

export interface RemoteMcpHttpServerOptions {
  /** Interface address to bind. Defaults to HOST, then 0.0.0.0. */
  host?: string;
  /** TCP port to bind. Defaults to PORT, IAPKIT_MCP_PORT, then 3939. */
  port?: number;
  /** MCP endpoint path. Defaults to /mcp. */
  mcpPath?: string;
  /** CORS allow-list. Defaults to IAPKIT_MCP_ALLOWED_ORIGINS or local/Codex origins. */
  allowedOrigins?: string[];
  /** Logger for lifecycle and request failures. Defaults to console. */
  logger?: Pick<Console, "error" | "info">;
  /**
   * Identity of this process for session affinity. Defaults to
   * FLY_MACHINE_ID; session ids are prefixed with it so a follow-up
   * request landing on a sibling machine can be replayed to the owner
   * (GitHub issue #287). Undefined disables replay routing.
   */
  machineId?: string;
}

/** Runtime handle for an IAPKit remote MCP HTTP server. */
export interface RemoteMcpHttpServer {
  /** Node HTTP server instance, unbound until listen/start is called. */
  server: NodeHttpServer;
  /** Closes MCP transports first, then the HTTP listener. */
  close: () => Promise<void>;
}

/**
 * Creates an IAPKit Streamable HTTP MCP server without binding a socket.
 *
 * @param options Server configuration.
 * @returns A server handle whose `server` can be bound by the caller.
 */
export function createRemoteMcpHttpServer(
  options: RemoteMcpHttpServerOptions = {},
): RemoteMcpHttpServer {
  const logger = options.logger ?? console;
  const mcpPath = normalizePath(options.mcpPath ?? DEFAULT_MCP_PATH);
  const allowedOrigins =
    options.allowedOrigins ??
    parseAllowedOrigins(process.env.IAPKIT_MCP_ALLOWED_ORIGINS);
  const machineId = options.machineId ?? currentMachineId();
  const transports =
    createMcpSessionStore<StreamableHTTPServerTransport>(logger);

  const server = createServer(async (req, res) => {
    try {
      setCorsHeaders(req, res, allowedOrigins);

      if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return;
      }

      const pathname = requestPathname(req);

      if (pathname === "/health") {
        writeJson(res, 200, {
          ok: true,
          name: IAPKIT_MCP_SERVER_NAME,
          version: IAPKIT_MCP_SERVER_VERSION,
          transport: "streamable-http",
          mcpPath,
        });
        return;
      }

      if (pathname === "/") {
        writeJson(res, 200, {
          name: IAPKIT_MCP_SERVER_NAME,
          version: IAPKIT_MCP_SERVER_VERSION,
          service: "IAPKit",
          endpoints: {
            mcp: mcpPath,
            health: "/health",
          },
          authentication: [
            "Authorization: Bearer <IAPKit secret admin key>",
            "IAPKIT_API_KEY environment variable (secret admin key)",
          ],
        });
        return;
      }

      if (pathname !== mcpPath) {
        writeJson(res, 404, { ok: false, error: "Not found" });
        return;
      }

      const bearerToken = parseBearerToken(
        headerString(req.headers.authorization),
      );
      if (bearerToken && !isSecretApiKey(bearerToken)) {
        writeJsonRpcError(res, 403, -32003, INSUFFICIENT_API_KEY_SCOPE_MESSAGE);
        return;
      }

      attachAuthInfo(req as AuthenticatedRequest);

      if (req.method === "POST") {
        await handleMcpPost(
          req as AuthenticatedRequest,
          res,
          transports,
          logger,
          machineId,
        );
        return;
      }

      if (req.method === "GET" || req.method === "DELETE") {
        await handleExistingMcpSession(req, res, transports, machineId);
        return;
      }

      writeJsonRpcError(res, 405, -32000, "Method not allowed");
    } catch (error) {
      if (error instanceof SyntaxError) {
        if (!res.headersSent) {
          writeJsonRpcError(res, 400, -32700, "Parse error: Invalid JSON");
        }
        return;
      }
      if (isMcpBodyTooLargeError(error)) {
        if (!res.headersSent) {
          writeJsonRpcError(res, 413, -32000, "Payload Too Large");
        }
        return;
      }
      logger.error("IAPKit MCP HTTP error:", error);
      if (!res.headersSent) {
        writeJsonRpcError(res, 500, -32603, "Internal server error");
      }
    }
  });

  async function close(): Promise<void> {
    await transports.closeAll();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  return { server, close };
}

/**
 * Creates and starts the IAPKit Streamable HTTP MCP server.
 *
 * @param options Server configuration.
 * @returns A bound server handle.
 * @throws When the configured port/host is invalid or the listener emits an error.
 */
export async function startRemoteMcpHttpServer(
  options: RemoteMcpHttpServerOptions = {},
): Promise<RemoteMcpHttpServer> {
  const host = options.host ?? process.env.HOST ?? "0.0.0.0";
  const port =
    options.port ??
    parsePort(process.env.PORT) ??
    parsePort(process.env.IAPKIT_MCP_PORT) ??
    DEFAULT_PORT;
  const remote = createRemoteMcpHttpServer(options);

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      remote.server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      remote.server.off("error", onError);
      resolve();
    };

    remote.server.once("error", onError);
    remote.server.listen(port, host, onListening);
  });

  (options.logger ?? console).info(
    `IAPKit MCP server listening on http://${host}:${port}${options.mcpPath ?? DEFAULT_MCP_PATH}`,
  );
  return remote;
}

async function handleMcpPost(
  req: AuthenticatedRequest,
  res: ServerResponse,
  transports: BoundedSessionStore<StreamableHTTPServerTransport>,
  logger: Pick<Console, "error" | "info">,
  machineId: string | undefined,
): Promise<void> {
  const sessionId = headerString(req.headers["mcp-session-id"]);
  const body = await readJsonBody(req);
  const existingTransport = sessionId ? transports.get(sessionId) : undefined;

  if (existingTransport) {
    await existingTransport.handleRequest(req, res, body);
    return;
  }

  if (sessionId) {
    writeUnknownSessionResponse(req, res, sessionId, machineId);
    return;
  }

  if (!isInitializeRequest(body)) {
    writeJsonRpcError(
      res,
      400,
      -32000,
      "Bad Request: initialize first, then send mcp-session-id on follow-up requests.",
    );
    return;
  }

  const reservation = transports.reserve();
  if (!reservation) {
    res.setHeader(
      "Retry-After",
      String(MCP_SESSION_CAPACITY_RETRY_AFTER_SECONDS),
    );
    writeJsonRpcError(res, 503, -32000, MCP_SESSION_CAPACITY_MESSAGE);
    return;
  }

  let sessionStored = false;
  let transport!: StreamableHTTPServerTransport;
  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => buildSessionId(machineId, randomUUID()),
    onsessioninitialized: (initializedSessionId) => {
      reservation.commit(initializedSessionId, transport);
      sessionStored = true;
      logger.info(`IAPKit MCP session initialized: ${initializedSessionId}`);
    },
  });

  transport.onclose = () => {
    const initializedSessionId = transport.sessionId;
    if (initializedSessionId) {
      transports.delete(initializedSessionId);
      logger.info(`IAPKit MCP session closed: ${initializedSessionId}`);
    }
  };

  const mcpServer = createIapKitMcpServer();
  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, body);
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

async function handleExistingMcpSession(
  req: IncomingMessage,
  res: ServerResponse,
  transports: BoundedSessionStore<StreamableHTTPServerTransport>,
  machineId: string | undefined,
): Promise<void> {
  const sessionId = headerString(req.headers["mcp-session-id"]);
  const transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    if (sessionId) {
      writeUnknownSessionResponse(req, res, sessionId, machineId);
      return;
    }
    writeJsonRpcError(res, 400, -32000, "Invalid or missing mcp-session-id");
    return;
  }

  await transport.handleRequest(req as AuthenticatedRequest, res);
}

/**
 * Answers a request whose session id isn't in this process's transport
 * map: replay it to the machine that minted the id when possible,
 * otherwise 404 so a spec-compliant client transparently re-initializes.
 * (The previous 400 "initialize first" reply broke that recovery path —
 * GitHub issue #287.)
 */
function writeUnknownSessionResponse(
  req: IncomingMessage,
  res: ServerResponse,
  sessionId: string,
  machineId: string | undefined,
): void {
  const routing = routeUnknownSession({
    sessionId,
    machineId,
    alreadyReplayed: req.headers["fly-replay-src"] !== undefined,
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
    res
      .writeHead(204, {
        "fly-replay": `prefer_instance=${routing.targetMachineId};timeout=5s`,
      })
      .end();
    return;
  }

  writeJsonRpcError(
    res,
    404,
    -32001,
    "Session not found — initialize a new MCP session.",
  );
}

function attachAuthInfo(req: AuthenticatedRequest): void {
  const bearerToken = parseBearerToken(headerString(req.headers.authorization));
  if (!bearerToken) return;

  req.auth = {
    token: bearerToken,
    clientId: "iapkit-project-api-key",
    scopes: ["iapkit:project"],
  };
}

function parseBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let byteLength = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.byteLength;
    if (byteLength > MAX_MCP_BODY_BYTES) {
      throw new Error(MCP_BODY_TOO_LARGE_ERROR);
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return undefined;
  return JSON.parse(raw);
}

function isMcpBodyTooLargeError(error: unknown): boolean {
  return error instanceof Error && error.message === MCP_BODY_TOO_LARGE_ERROR;
}

function setCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: string[],
): void {
  const origin = headerString(req.headers.origin);
  const allowAll = allowedOrigins.includes("*");
  const allowOrigin =
    origin && (allowAll || allowedOrigins.includes(origin)) ? origin : null;

  if (allowOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, content-type, last-event-id, mcp-protocol-version, mcp-session-id",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "mcp-session-id, retry-after, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-scope",
  );
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
}

function requestPathname(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.pathname;
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

function parsePort(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`Invalid port: ${raw}`);
  }
  return value;
}

function headerString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function writeJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function writeJsonRpcError(
  res: ServerResponse,
  statusCode: number,
  code: number,
  message: string,
): void {
  writeJson(res, statusCode, {
    jsonrpc: "2.0",
    error: { code, message },
    id: null,
  });
}

function isMainModule(): boolean {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false;
}

if (isMainModule()) {
  const remote = await startRemoteMcpHttpServer();

  const shutdown = async () => {
    await remote.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}
