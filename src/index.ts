#!/usr/bin/env node

import express from "express";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerSearchOrders } from "./tools/search-orders.js";
import { registerCheckInventory } from "./tools/check-inventory.js";
import { registerLookupCustomer } from "./tools/lookup-customer.js";
import { registerGetSalesSummary } from "./tools/get-sales-summary.js";

const server = new McpServer({
  name: "shopify-mcp-server",
  version: "1.1.1",
});

// Register all tools
registerSearchOrders(server);
registerCheckInventory(server);
registerLookupCustomer(server);
registerGetSalesSummary(server);

// Security (1.1.1): the server holds a Shopify Admin token, so it must not be reachable by anyone who can reach the
// port. It binds to loopback by default; binding anywhere else requires MCP_AUTH_TOKEN, and every /mcp request must
// then carry "Authorization: Bearer <token>". In loopback mode the Host and Origin headers are checked as well
// (DNS-rebinding protection). Reported privately by 0xwaidwerk (Christian Terorde), October 2026.
const HOST = process.env.HOST || "127.0.0.1";
const PORT = parseInt(process.env.PORT || "3000", 10);
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || "";
const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);
const isLoopback = LOOPBACK.has(HOST);

if (!isLoopback && !AUTH_TOKEN) {
  console.error(
    `Refusing to start: HOST=${HOST} exposes the server beyond this machine. Set MCP_AUTH_TOKEN (a long random string) ` +
      `and send it as "Authorization: Bearer <token>", or use the default HOST=127.0.0.1.`
  );
  process.exit(1);
}

function tokenMatches(header: string | undefined): boolean {
  if (!AUTH_TOKEN) return true;
  const m = /^Bearer\s+(.+)$/i.exec(header || "");
  if (!m) return false;
  const a = Buffer.from(m[1].trim());
  const b = Buffer.from(AUTH_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

const LOCAL_NAME = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
function localRequest(host: string | undefined, origin: string | undefined): boolean {
  if (!host || !LOCAL_NAME.test(host)) return false;
  if (!origin) return true;
  try {
    return LOCAL_NAME.test(new URL(origin).host);
  } catch {
    return false;
  }
}

const app = express();
app.use(express.json());

app.use("/mcp", (req, res, next) => {
  if (!tokenMatches(req.headers.authorization)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (!AUTH_TOKEN && !localRequest(req.headers.host, req.headers.origin)) {
    res.status(403).json({ error: "forbidden: local requests only (set MCP_AUTH_TOKEN for remote access)" });
    return;
  }
  next();
});

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

app.listen(PORT, HOST, () => {
  const shown = HOST.includes(":") ? `[${HOST}]` : HOST;
  console.error(
    `Shopify MCP server listening on http://${shown}:${PORT}/mcp` +
      (AUTH_TOKEN ? " (bearer token required)" : " (local requests only)")
  );
});
