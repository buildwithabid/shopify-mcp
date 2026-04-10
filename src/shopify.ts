const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const API_VERSION = "2024-10";

// Token cache for client credentials flow
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function getStoreUrl(): string {
  if (!SHOPIFY_STORE_URL) {
    throw new Error("SHOPIFY_STORE_URL environment variable is required");
  }
  return SHOPIFY_STORE_URL.replace(/\/+$/, "");
}

function getBaseUrl(): string {
  return `${getStoreUrl()}/admin/api/${API_VERSION}`;
}

async function getAccessToken(): Promise<string> {
  // Static token (legacy apps created before Jan 2026)
  if (SHOPIFY_ACCESS_TOKEN) {
    return SHOPIFY_ACCESS_TOKEN;
  }

  // Client credentials flow (apps created after Jan 2026)
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error(
      "Either SHOPIFY_ACCESS_TOKEN or both SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET are required"
    );
  }

  // Return cached token if still valid (refresh 5 min before expiry)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  console.error("[shopify] Generating new access token via client credentials");

  const response = await fetch(
    `${getStoreUrl()}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(`[shopify] Token error ${response.status}: ${body}`);
    throw new Error(
      `Failed to obtain Shopify access token: ${response.status} ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };
  cachedToken = data.access_token;
  // Default to 23 hours if expires_in not provided (tokens last 24h)
  tokenExpiresAt = Date.now() + (data.expires_in ?? 82800) * 1000;

  console.error("[shopify] Access token obtained, expires in ~24h");
  return cachedToken;
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

  const token = await getAccessToken();
  const response = await fetch(url.toString(), {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[shopify] Error ${response.status}: ${body}`);
    throw new Error(
      `Shopify API error ${response.status}: ${body.slice(0, 200)}`
    );
  }

  return response.json() as Promise<T>;
}
