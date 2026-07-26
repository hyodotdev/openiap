# @hyodotdev/openiap-mcp-server

Model Context Protocol server for IAPKit. It exposes `iapkit_*` tools
(setup snippets, catalog reads/writes, subscription lists, revenue
analytics, webhook simulation, store sync jobs) to Codex, Claude Code,
and any other MCP client.

The hosted deployment lives at `https://kit.openiap.dev/mcp`. This
package is what you run for local development and unreleased PR
testing. Full user-facing setup docs:
[openiap.dev/docs/guides/mcp-server](https://openiap.dev/docs/guides/mcp-server).

## Authentication

Every transport authenticates with an **IAPKit secret admin key**
(`openiap-kit_sk_…`) — not a mobile publishable key and not an OpenAI,
ChatGPT, Anthropic, or Claude API key. The key is resolved from, in order:
a tool's explicit `apiKey` argument, then the MCP `Authorization: Bearer`
token, then the `IAPKIT_API_KEY` environment variable. Keep it out of app
bundles; generated mobile snippets use a separate publishable key placeholder.
When MCP calls IAPKit's administrative REST surface, it forwards the secret in
the `Authorization` header and never places it in the request URL.

## Transports

```bash
# stdio (bin: iapkit-mcp / openiap-mcp)
IAPKIT_API_KEY="openiap-kit_sk_<your-secret-key>" bun run start

# Streamable HTTP on http://127.0.0.1:3939/mcp (bin: iapkit-mcp-http)
IAPKIT_API_KEY="openiap-kit_sk_<your-secret-key>" bun run start:http
```

`PORT` / `IAPKIT_MCP_PORT` override the HTTP port and
`IAPKIT_MCP_ALLOWED_ORIGINS` overrides the CORS allow-list.

## Client configuration

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.openiap]
url = "https://kit.openiap.dev/mcp"
bearer_token_env_var = "IAPKIT_API_KEY"
default_tools_approval_mode = "prompt"
```

Claude Code:

```bash
claude mcp add --transport http openiap https://kit.openiap.dev/mcp \
  --header "Authorization: Bearer ${IAPKIT_API_KEY}"
```

Both agents can instead install the `plugins/openiap` plugin — see the
Codex marketplace entry in `.agents/plugins/marketplace.json` and the
Claude Code marketplace in `.claude-plugin/marketplace.json` at the
repo root. For local PR testing, point either client at
`http://127.0.0.1:3939/mcp`.

## Development

```bash
bun run lint   # tsc --noEmit
bun run test   # vitest
bun run build  # emit dist/
```
