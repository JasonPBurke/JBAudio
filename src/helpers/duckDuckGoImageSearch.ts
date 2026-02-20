export type DuckDuckGoImageResult = {
  image: string; // Full-size image URL
  thumbnail: string; // Thumbnail URL
  title: string;
  width: number;
  height: number;
};

const SEARCH_TIMEOUT_MS = 10_000;

// DDG's i.js endpoint rejects requests without a browser-like User-Agent
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  Referer: 'https://duckduckgo.com/',
};

/**
 * Extracts the vqd token from DuckDuckGo's HTML response.
 * This token is required to authenticate image search API calls.
 */
function extractVqdToken(html: string): string | null {
  const match = html.match(/vqd=["']([^"']+)["']/);
  return match?.[1] ?? null;
}

/**
 * Fetches a URL with a per-request timeout.
 */
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: HEADERS,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Searches DuckDuckGo for images matching the given query.
 * Uses a two-step process: fetch vqd token, then query the image API.
 */
export async function searchImages(
  query: string,
): Promise<DuckDuckGoImageResult[]> {
  const encodedQuery = encodeURIComponent(query);

  // Step 1: Get vqd token from the search page
  const tokenResponse = await fetchWithTimeout(
    `https://duckduckgo.com/?q=${encodedQuery}&iax=images&ia=images`,
  );
  const html = await tokenResponse.text();
  const vqd = extractVqdToken(html);

  if (!vqd) {
    throw new Error('Failed to extract DuckDuckGo search token');
  }

  // Step 2: Fetch image results using the token
  const imageResponse = await fetchWithTimeout(
    `https://duckduckgo.com/i.js?q=${encodedQuery}&vqd=${vqd}&o=json`,
  );
  const data = await imageResponse.json();

  if (!Array.isArray(data.results)) {
    return [];
  }

  return data.results.map(
    ({ image, thumbnail, title, width, height }: DuckDuckGoImageResult) => ({
      image,
      thumbnail,
      title,
      width,
      height,
    }),
  );
}
