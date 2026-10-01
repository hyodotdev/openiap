# Private Sites pilot verification

The synthetic transport works. Managed ChatGPT registration is blocked, so
this pilot is not ready for real development data or a production migration.

## Verified on 2026-10-02

- The MCP SDK HTTP client initialized, discovered exactly three tools, and
  called setup, catalog listing, and subscription status successfully.
- The signed-in browser passed the same five requests, all HTTP 200.
  One observed run took 292 ms; this is not a latency benchmark.
- Anonymous live requests returned 403. Direct write calls returned a tool
  error. Credential and upstream overrides returned 400.
- All 74 MCP tests, package build, lint, and pilot typecheck passed. The default
  16-tool surface remains covered, including the original 65 tests.
- All 13 Kit MCP, API contract, and server entrypoint tests passed.
- The compiled Kit server and dashboard passed API, authentication, removed-route,
  and browser smoke probes with a placeholder Convex URL.
- Repository layout and SDK parity audits passed.

The owner-private Site remains at version 2, deployed from the separate Sites
source repository commit `816f60bd1c433d9aa46259226ad767139a626005`:
https://iapkit-mcp-pilot-20261001.crossplatformkorea.chatgpt.site.
The endpoint is `/api/mcp`. No real credentials, customer data, store calls,
or Convex writes were used. Existing production configuration is unchanged.

## Managed registration blocker

Sites reports `has_mcp: false`. Requesting connection settings returns
`The published Site does not declare an MCP server. Enable MCP and republish it.`
Its reserved `/mcp` route returned 404. The Plugins setup screen could not
discover OAuth settings for `/api/mcp`; anonymous requests to that endpoint
and standard protected-resource discovery paths returned 403 without
`WWW-Authenticate`. Browser sign-in does not establish an MCP OAuth connection.

The available Sites connector, settings, and official documentation supplied
no supported MCP declaration or activation method. An attempted `mcp` hosting
field was rejected and removed. Keep owner-private access while resolving the
supported declaration and authentication setup, then verify managed discovery
and the three read tools against a development-only project.

## Cost comparison

The current Fly configuration cohosts the API and MCP with at least one
512 MiB shared-CPU machine running. Moving MCP alone would not remove that
configured minimum. Live machine and billing data could not be inspected
because the Fly CLI is not authenticated. No hosting savings were measured.

References: [Sites](https://learn.chatgpt.com/docs/sites) and
[Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt).
