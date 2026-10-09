import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import {
  createShowcaseSubmissionSchema,
  ShowcaseSubmissionError,
  type ShowcaseOptions,
  type ShowcaseSubmission,
  type ShowcaseSubmissionStatus,
} from "./showcase-schema.js";
export {
  createShowcaseSubmissionSchema,
  ShowcaseSubmissionError,
} from "./showcase-schema.js";
export type {
  ShowcaseOptions,
  ShowcaseSubmission,
  ShowcaseSubmissionStatus,
} from "./showcase-schema.js";

export interface ShowcaseMcpOptions extends ShowcaseOptions {
  submit: (
    submission: ShowcaseSubmission,
  ) => Promise<{ id: string; status: "pending" }>;
  status: (id: string) => Promise<ShowcaseSubmissionStatus | null>;
}

export function isShowcaseOriginAllowed(
  origin: string | null,
  siteOrigin: string,
): boolean {
  return (
    !origin ||
    [siteOrigin, "https://chatgpt.com", "https://claude.ai"].includes(origin)
  );
}

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

export function createShowcaseMcpServer(options: ShowcaseMcpOptions) {
  const server = new McpServer({ name: "openiap-showcase", version: "1.0.0" });
  server.registerTool(
    "openiap_showcase_options",
    {
      description:
        "List the categories and OpenIAP libraries accepted for app submissions.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    () =>
      result({ categories: options.categories, libraries: options.libraries }),
  );
  const submissionSchema = createShowcaseSubmissionSchema(options);
  server.registerTool(
    "openiap_showcase_submit_app",
    {
      description:
        "Submit an app to OpenIAP's private review queue. Call openiap_showcase_options first. Ask the developer to confirm ownership and listing consent first. Contact email stays private. Submission does not publish an app; a maintainer must approve it. Keep the returned ID to check status.",
      inputSchema: submissionSchema.innerType(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (submission) => {
      try {
        return result(await options.submit(submissionSchema.parse(submission)));
      } catch (error) {
        return {
          ...result({
            error:
              error instanceof z.ZodError
                ? (error.issues[0]?.message ?? "Invalid app details")
                : error instanceof ShowcaseSubmissionError
                  ? error.message
                  : "Submission is temporarily unavailable. Try again later.",
          }),
          isError: true,
        };
      }
    },
  );
  server.registerTool(
    "openiap_showcase_submission_status",
    {
      description:
        "Check an app submission using its private receipt ID. Returns only the review status, never app details or contact information.",
      inputSchema: { id: z.string().uuid() },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        return result({ status: await options.status(id) });
      } catch {
        return {
          ...result({ error: "Status is temporarily unavailable." }),
          isError: true,
        };
      }
    },
  );
  return server;
}

export async function readShowcaseJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32 * 1024) {
        await reader.cancel();
        throw new ShowcaseSubmissionError("Request exceeds 32 KB");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export async function handleShowcaseMcpRequest(
  request: Request,
  options: ShowcaseMcpOptions & { origin: string },
): Promise<Response> {
  const origin = request.headers.get("origin");
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  if (!isShowcaseOriginAllowed(origin, options.origin))
    return Response.json(
      { error: "Origin not allowed" },
      { status: 403, headers },
    );
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, MCP-Protocol-Version",
    );
  }
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return Response.json(
      { error: "Use POST; this MCP endpoint is stateless" },
      {
        status: 405,
        headers: { ...Object.fromEntries(headers), Allow: "POST, OPTIONS" },
      },
    );
  let body: unknown;
  try {
    body = await readShowcaseJson(request);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof SyntaxError
            ? "Invalid JSON"
            : "Request exceeds 32 KB",
      },
      { status: error instanceof SyntaxError ? 400 : 413, headers },
    );
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createShowcaseMcpServer(options);
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, {
      parsedBody: body,
    });
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  } finally {
    await server.close();
  }
}
