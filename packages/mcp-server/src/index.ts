#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createIapKitMcpServer } from "./mcp.js";

const server = createIapKitMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);
