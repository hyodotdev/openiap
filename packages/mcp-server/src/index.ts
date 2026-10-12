#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createIapKitMcpServer } from "./mcp.js";

// The operator runs this process, so their environment key is the fallback.
const server = createIapKitMcpServer({ allowEnvApiKey: true });
const transport = new StdioServerTransport();

await server.connect(transport);
