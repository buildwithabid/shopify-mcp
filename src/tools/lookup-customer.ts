import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { shopifyGet } from "../shopify.js";

interface ShopifyCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  orders_count: number;
  total_spent: string;
  last_order_name: string | null;
  created_at: string;
  last_order_id: number | null;
}

interface CustomersResponse {
  customers: ShopifyCustomer[];
}

interface OrderResponse {
  order: {
    created_at: string;
  };
}

export function registerLookupCustomer(server: McpServer) {
  server.tool(
    "lookup_customer",
    "Search for Shopify customers by email, name, or phone number. Use this to answer questions like 'find customer john@example.com', 'look up customers named Smith', or 'who is the customer with phone 555-1234?'",
    {
      query: z
        .string()
        .describe(
          "Search query: an email address, customer name, or phone number"
        ),
    },
    async ({ query }) => {
      try {
        const params: Record<string, string> = {
          limit: "10",
          fields:
            "id,first_name,last_name,email,phone,orders_count,total_spent,last_order_name,last_order_id,created_at",
        };

        if (query.includes("@")) {
          params.email = query;
        } else if (/^[+\d\s()-]+$/.test(query)) {
          params.phone = query;
        } else {
          const searchData = await shopifyGet<CustomersResponse>(
            "/customers/search.json",
            { query, limit: "10", fields: params.fields }
          );
          return formatCustomers(searchData.customers);
        }

        const data = await shopifyGet<CustomersResponse>(
          "/customers.json",
          params
        );
        return formatCustomers(data.customers);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to lookup customer: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

function formatCustomers(customers: ShopifyCustomer[]) {
  if (customers.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "No customers found matching the query.",
        },
      ],
    };
  }

  const results = customers.map((c) => ({
    customer_id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    email: c.email,
    phone: c.phone ?? "N/A",
    total_orders: c.orders_count,
    total_spent: c.total_spent,
    last_order: c.last_order_name ?? "None",
    member_since: c.created_at,
  }));

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
}
