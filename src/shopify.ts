const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const API_VERSION = "2024-10";

function getBaseUrl(): string {
  if (!SHOPIFY_STORE_URL) {
    throw new Error("SHOPIFY_STORE_URL environment variable is required");
  }
  const url = SHOPIFY_STORE_URL.replace(/\/+$/, "");
  return `${url}/admin/api/${API_VERSION}`;
}

function getHeaders(): Record<string, string> {
  if (!SHOPIFY_ACCESS_TOKEN) {
    throw new Error("SHOPIFY_ACCESS_TOKEN environment variable is required");
  }
  return {
    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
    "Content-Type": "application/json",
  };
}

export async function shopifyGet<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${getBaseUrl()}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  console.error(`[shopify] GET ${url.pathname}${url.search}`);

  const response = await fetch(url.toString(), { headers: getHeaders() });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[shopify] Error ${response.status}: ${body}`);
    throw new Error(
      `Shopify API error ${response.status}: ${body.slice(0, 200)}`
    );
  }

  return response.json() as Promise<T>;
}
