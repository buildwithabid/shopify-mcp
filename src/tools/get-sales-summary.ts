import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { shopifyGet } from "../shopify.js";

interface ShopifyLineItem {
  title: string;
  quantity: number;
  price: string;
}

interface ShopifyOrder {
  id: number;
  total_price: string;
  line_items: ShopifyLineItem[];
}

interface OrdersResponse {
  orders: ShopifyOrder[];
}

export function registerGetSalesSummary(server: McpServer) {
  server.tool(
    "get_sales_summary",
    "Generate a revenue summary for a specific date range, including total revenue, number of orders, average order value, and top 5 best-selling products. Use this for questions like 'what were our sales last month?', 'revenue this quarter?', or 'what are our top selling products?'",
    {
      start_date: z
        .string()
        .describe("Start of the date range (ISO 8601, e.g. 2024-01-01)"),
      end_date: z
        .string()
        .describe("End of the date range (ISO 8601, e.g. 2024-01-31)"),
    },
    async ({ start_date, end_date }) => {
      try {
        const allOrders: ShopifyOrder[] = [];
        let page = 1;
        const limit = 250;
        let hasMore = true;

        // Paginate through orders in the date range (max ~1000 for safety)
        while (hasMore && page <= 4) {
          const data = await shopifyGet<OrdersResponse>("/orders.json", {
            status: "any",
            created_at_min: start_date,
            created_at_max: end_date,
            limit: limit.toString(),
            page: page.toString(),
            fields: "id,total_price,line_items",
          });
          allOrders.push(...data.orders);
          hasMore = data.orders.length === limit;
          page++;
        }

        if (allOrders.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No orders found between ${start_date} and ${end_date}.`,
              },
            ],
          };
        }

        const totalRevenue = allOrders.reduce(
          (sum, o) => sum + parseFloat(o.total_price),
          0
        );
        const orderCount = allOrders.length;
        const avgOrderValue = totalRevenue / orderCount;

        // Aggregate product sales
        const productSales = new Map<
          string,
          { quantity: number; revenue: number }
        >();
        for (const order of allOrders) {
          for (const item of order.line_items) {
            const existing = productSales.get(item.title) ?? {
              quantity: 0,
              revenue: 0,
            };
            existing.quantity += item.quantity;
            existing.revenue += parseFloat(item.price) * item.quantity;
            productSales.set(item.title, existing);
          }
        }

        const topProducts = Array.from(productSales.entries())
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .slice(0, 5)
          .map(([title, stats]) => ({
            product: title,
            units_sold: stats.quantity,
            revenue: stats.revenue.toFixed(2),
          }));

        const summary = {
          period: { start: start_date, end: end_date },
          total_revenue: totalRevenue.toFixed(2),
          order_count: orderCount,
          average_order_value: avgOrderValue.toFixed(2),
          top_5_products: topProducts,
          note:
            allOrders.length >= 1000
              ? "Results capped at ~1000 orders. Actual totals may be higher."
              : undefined,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(summary, null, 2),
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
              text: `Failed to generate sales summary: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
