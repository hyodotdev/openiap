# Sites MCP hosting pilot

Run three existing IAPKit tool handlers on a private Sites host:
`iapkit_setup`, `iapkit_list_products`, and `iapkit_check_status`.
Catalog and subscription responses are synthetic fixtures. No IAPKit, store,
or Convex requests are made. Do not enter an API key.

The pilot uses a fresh, stateless JSON transport for each request. The existing
stdio, HTTP, and Fly transports keep their current behavior and all 16 tools.
The pilot's tool allowlist also rejects direct calls to omitted tools.

From this package:

```sh
bun run test
bun run check:sites-pilot
bun run build:sites-pilot
bun --port=8787 pilots/sites/worker.ts
```

Open `http://localhost:8787` and run the compatibility check. The Worker exposes
`/api/mcp` and `/health`. Sites reserves `/mcp` for managed MCP registration;
the trial uses an application route. Test discovery, all three tool calls,
invalid inputs, and write rejection before publishing an owner-private version.

Keep the returned Sites project ID in the ignored `.openai/hosting.json` and
reuse it. Upload only the generated Worker and hosting metadata through a
separate Sites source repository. Never push the monorepo or its environment
files to the Sites repository. The bundle builds with an empty `process.env`.

This trial establishes transport and runtime compatibility. It does not
establish real-project authorization, production reliability, or cost savings.
A later trial needs a development project, explicit upstream configuration,
per-user authorization, and comparison with the current hosting bill and load.
