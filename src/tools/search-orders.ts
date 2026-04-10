import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { shopifyGet } from "../shopify.js";

interface ShopifyOrder {
  id: number;
  name: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  created_at: string;
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface OrdersResponse {
  orders: ShopifyOrder[];
}

export function registerSearchOrders(server: McpServer) {
  server.tool(
    "search_orders",
    "Search and retrieve Shopify orders filtered by status, date range, or customer email. Use this to answer questions like 'show me recent open orders', 'what orders did customer@email.com place?', or 'how many orders were placed last week?'",
    {
      status: z
        .enum(["open", "closed", "any"])
        .default("any")
        .describe("Filter by order status: open, closed, or any"),
      created_at_min: z
        .string()
        .optional()
        .describe("Only orders created after this date (ISO 8601, e.g. 2024-01-01)"),
      created_at_max: z
        .string()
        .optional()
        .describe("Only orders created before this date (ISO 8601, e.g. 2024-12-31)"),
      email: z
        .string()
        .optional()
        .describe("Filter orders by customer email address"),
    },
    async ({ status, created_at_min, created_at_max, email }) => {
      try {
        const params: Record<string, string> = {
          status,
          limit: "25",
          fields:
            "id,name,financial_status,fulfillment_status,total_price,currency,created_at,customer",
        };
        if (created_at_min) params.created_at_min = created_at_min;
        if (created_at_max) params.created_at_max = created_at_max;

        const data = await shopifyGet<OrdersResponse>("/orders.json", params);
        let orders = data.orders;

        if (email) {
          const lowerEmail = email.toLowerCase();
          orders = orders.filter(
            (o) => o.customer?.email?.toLowerCase() === lowerEmail
          );
        }

        if (orders.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No orders found matching the given criteria.",
              },
            ],
          };
        }

        const results = orders.map((o) => ({
          order_id: o.name,
          internal_id: o.id,
          status: o.financial_status,
          fulfillment: o.fulfillment_status ?? "unfulfilled",
          total: `${o.total_price} ${o.currency}`,
          customer: o.customer
            ? `${o.customer.first_name} ${o.customer.last_name}`
            : "Guest",
          created: o.created_at,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to search orders: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
