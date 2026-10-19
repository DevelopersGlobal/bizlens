import { publicFetch } from '../net/public-fetch.js';
/** Fetch public API data with the same DNS, redirect and body limits as the crawler. */
export async function sourceFetch(url: string, _options?: unknown): Promise<Response> {
  const r = await publicFetch(url, { timeoutMs: 15000, maxBytes: 1000000 });
  if (!r.ok) throw new Error(`Public source HTTP ${r.status}`);
  return new Response(r.body, { status: r.status, headers: r.headers });
}
