---
name: openiap
description: Use when the user wants their AI coding agent (Codex, Claude Code, etc.) to inspect, implement, or troubleshoot app in-app purchase flows with OpenIAP, including SDK setup, product catalog checks, subscription analytics, IAPKit receipt validation, store sync jobs, and webhook simulation.
---

# OpenIAP

Use the bundled `openiap` MCP server for OpenIAP and IAPKit-backed in-app
purchase workflows. The current hosted MCP endpoint is IAPKit-backed by default
and exposes `iapkit_*` tools for live project operations.

## Authentication

The server expects an IAPKit project API key, not an OpenAI, ChatGPT,
Anthropic, or Claude API key. Set `IAPKIT_API_KEY` in the environment that
launches the agent before using the plugin:

- **Codex**: export `IAPKIT_API_KEY` before starting Codex; the plugin's MCP
  config reads it through `bearer_token_env_var`.
- **Claude Code**: export `IAPKIT_API_KEY` before starting Claude Code; the
  plugin's MCP config expands it into the `Authorization` header.

## Operating Rules

- Start by reviewing the app's current purchase flow and SDK usage before
  proposing code changes.
- Use read-only tools first, including `iapkit_inspect_state`,
  `iapkit_list_products`, `iapkit_revenue_analytics`, `iapkit_check_status`, and
  `iapkit_setup`.
- Treat product management and store sync tools as real writes.
- Use `dryRun: true` for store sync previews first.
- Do not create products, start non-dry-run sync jobs, simulate webhooks, or
  edit app code unless the user explicitly asks for that action in the current
  thread.
- Keep IAPKit project API keys out of code snippets and final responses.
