# Shopify MCP Server

[![npm version](https://img.shields.io/npm/v/@abidali/shopify-mcp-server)](https://www.npmjs.com/package/@abidali/shopify-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An MCP (Model Context Protocol) server that connects Claude to your Shopify store via the Admin REST API. Provides read-only tools for searching orders, checking inventory, looking up customers, and generating sales summaries.

<p align="center">
  <img src="assets/demo.gif" alt="Shopify MCP Server in Claude Code" width="720" />
</p>

## Tools

| Tool | Description |
|------|-------------|
| `search_orders` | Search orders by status, date range, or customer email |
| `check_inventory` | Look up inventory levels by product title or ID |
| `lookup_customer` | Find customers by email, name, or phone |
| `get_sales_summary` | Revenue summary with top products for a date range |

## Quick Start

### 1. Install

```bash
npm install -g @abidali/shopify-mcp-server
```

Or clone locally:

```bash
git clone https://github.com/buildwithabid/shopify-mcp.git
cd shopify-mcp
npm install && npm run build
```

### 2. Configure

Create a [Shopify custom app](https://help.shopify.com/en/manual/apps/app-types/custom-apps) with these Admin API scopes:

- `read_orders`
- `read_products`
- `read_customers`

Set your environment variables:

```bash
export SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export SHOPIFY_STORE_URL=https://your-store.myshopify.com
```

### 3. Run

```bash
shopify-mcp-server
# Server starts at http://localhost:3000/mcp
```

### 4. Add to Claude Code

```bash
claude mcp add shopify-mcp --transport http http://localhost:3000/mcp
```

Then ask Claude things like:

> "Show me all open orders from last week"
>
> "Is the Blue T-Shirt XL in stock?"
>
> "Look up customer john@example.com"
>
> "What was our revenue last month?"

## Docker

```bash
docker build -t shopify-mcp .
docker run -p 3000:3000 \
  -e SHOPIFY_ACCESS_TOKEN=shpat_xxx \
  -e SHOPIFY_STORE_URL=https://your-store.myshopify.com \
  shopify-mcp
```

## Development

```bash
cp .env.example .env    # fill in your credentials
npm run dev             # runs with tsx
```

## License

MIT
