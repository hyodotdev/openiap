import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";

import { createIapKitMcpServer } from "../../src/mcp.js";
import { fixtureClient, PILOT_TOOLS } from "./fixture.js";

const MAX_BODY_BYTES = 64 * 1024;
export const PILOT_MCP_PATH = "/api/mcp";
const ALLOWED_ORIGINS = new Set([
  "https://chatgpt.com",
  "https://chat.openai.com",
]);

export async function handlePilotRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    return Response.json({
      ok: true,
      mode: "synthetic-read-only",
      tools: PILOT_TOOLS,
    });
  }
  if (request.method === "GET" && url.pathname === "/") {
    return new Response(PILOT_PAGE, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  if (url.pathname !== PILOT_MCP_PATH)
    return new Response("Not found", { status: 404 });

  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response("Origin is not allowed", { status: 403 });
  }
  const headers = new Headers();
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set(
      "access-control-allow-headers",
      "authorization, content-type, mcp-protocol-version",
    );
  }
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST") {
    headers.set("allow", "POST, OPTIONS");
    return new Response("Method not allowed", { status: 405, headers });
  }

  function rpcError(status: number, code: number, message: string): Response {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code, message } },
      { status, headers },
    );
  }

  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return rpcError(413, -32000, "Request body is too large");
  }
  // Read at most the limit even when Content-Length is absent or inaccurate.
  const reader = request.body?.getReader();
  if (!reader) return rpcError(400, -32700, "A JSON request body is required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return rpcError(413, -32000, "Request body is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return rpcError(400, -32700, "Invalid JSON");
  }
  const parsed = JSONRPCMessageSchema.safeParse(body);
  if (!parsed.success) return rpcError(400, -32600, "Invalid JSON-RPC request");
  if ("method" in parsed.data && parsed.data.method === "tools/call") {
    const args = parsed.data.params?.arguments;
    if (
      args &&
      typeof args === "object" &&
      ("apiKey" in args || "baseUrl" in args)
    ) {
      return rpcError(
        400,
        -32602,
        "This pilot accepts no credentials or upstream overrides.",
      );
    }
  }

  // A fresh transport per request avoids process affinity on Workers.
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  const server = createIapKitMcpServer({
    allowedTools: PILOT_TOOLS,
    client: fixtureClient,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, {
      parsedBody: parsed.data,
    });
    for (const [key, value] of headers) response.headers.set(key, value);
    return response;
  } finally {
    await server.close();
  }
}

export default { fetch: handlePilotRequest };

const PILOT_PAGE = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>IAPKit MCP hosting pilot</title>
<style>body{max-width:760px;margin:64px auto;padding:0 24px;font:17px/1.6 system-ui;color:#182329}h1{line-height:1.2}button{padding:12px 20px;font:inherit;background:#182329;color:white;border:0;border-radius:8px;cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f5f4;padding:20px;border-radius:8px}</style>
<h1>IAPKit MCP hosting pilot</h1><p>This private trial runs three existing IAPKit tools on synthetic data. It makes no requests to IAPKit, Apple, Google, or Convex.</p>
<p>Test setup snippets, catalog listing, and subscription status through the same tool handlers used by the existing MCP server.</p>
<button id="run">Run compatibility check</button><p id="summary">Ready. No API key is needed.</p><details><summary>Response details</summary><pre id="result"></pre></details>
<script type="module">const run=document.querySelector('#run'),result=document.querySelector('#result'),summary=document.querySelector('#summary');run.onclick=async()=>{run.disabled=true;const started=performance.now();try{const messages=[{id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'sites-pilot',version:'1.0.0'}}},{id:2,method:'tools/list',params:{}},{id:3,method:'tools/call',params:{name:'iapkit_setup',arguments:{framework:'expo'}}},{id:4,method:'tools/call',params:{name:'iapkit_list_products',arguments:{}}},{id:5,method:'tools/call',params:{name:'iapkit_check_status',arguments:{userId:'synthetic-user'}}}];const results=[];for(const message of messages){const response=await fetch('${PILOT_MCP_PATH}',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream','mcp-protocol-version':'2025-06-18'},body:JSON.stringify({jsonrpc:'2.0',...message})});const body=await response.json();if(!response.ok||body.error||body.result?.isError)throw new Error('MCP request failed: '+message.method+' ('+response.status+')');results.push({method:message.method,status:response.status,result:body});}const names=results[1].result.result.tools.map(tool=>tool.name).sort();const expected=${JSON.stringify([...PILOT_TOOLS].sort())};if(JSON.stringify(names)!==JSON.stringify(expected))throw new Error('Unexpected tool surface');summary.textContent='Passed: initialization, discovery, setup, catalog, and subscription status. All 5 requests returned HTTP 200. '+Math.round(performance.now()-started)+' ms.';result.textContent=JSON.stringify(results,null,2);}catch(error){summary.textContent=String(error);result.textContent='';}finally{run.disabled=false;}};</script></html>`;
