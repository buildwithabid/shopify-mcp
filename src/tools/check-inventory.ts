import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { shopifyGet } from "../shopify.js";

interface ShopifyVariant {
  id: number;
  title: string;
  sku: string;
  inventory_quantity: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  variants: ShopifyVariant[];
}

interface ProductsResponse {
  products: ShopifyProduct[];
}

interface SingleProductResponse {
  product: ShopifyProduct;
}

export function registerCheckInventory(server: McpServer) {
  server.tool(
    "check_inventory",
    "Look up current inventory levels for a product by its title or numeric product ID. Use this to answer questions like 'is the Blue T-Shirt in stock?', 'how many units of product 12345 are left?', or 'what SKUs does this product have?'",
    {
      product_id: z
        .string()
        .optional()
        .describe("Shopify numeric product ID (use this if you already know the ID)"),
      title: z
        .string()
        .optional()
        .describe("Search for a product by title (partial match supported)"),
    },
    async ({ product_id, title }) => {
      try {
        if (!product_id && !title) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Please provide either a product_id or title to look up inventory.",
              },
            ],
            isError: true,
          };
        }

        let products: ShopifyProduct[];

        if (product_id) {
          const data = await shopifyGet<SingleProductResponse>(
            `/products/${product_id}.json`,
            { fields: "id,title,variants" }
          );
          products = [data.product];
        } else {
          const data = await shopifyGet<ProductsResponse>("/products.json", {
            title: title!,
            limit: "5",
            fields: "id,title,variants",
          });
          products = data.products;
        }

        if (products.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No products found matching "${title}".`,
              },
            ],
          };
        }

        const results = products.map((p) => ({
          product_id: p.id,
          product_title: p.title,
          variants: p.variants.map((v) => ({
            variant_title: v.title,
            sku: v.sku || "N/A",
            inventory_quantity: v.inventory_quantity,
          })),
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
              text: `Failed to check inventory: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
