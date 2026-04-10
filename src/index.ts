#!/usr/bin/env node

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerSearchOrders } from "./tools/search-orders.js";
import { registerCheckInventory } from "./tools/check-inventory.js";
import { registerLookupCustomer } from "./tools/lookup-customer.js";
import { registerGetSalesSummary } from "./tools/get-sales-summary.js";

const server = new McpServer({
  name: "shopify-mcp-server",
  version: "1.0.0",
});

// Register all tools
registerSearchOrders(server);
registerCheckInventory(server);
registerLookupCustomer(server);
registerGetSalesSummary(server);

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, () => {
  console.error(`Shopify MCP server running on http://localhost:${PORT}/mcp`);
});
