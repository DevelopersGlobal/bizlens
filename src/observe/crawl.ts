import { load } from 'cheerio';
import { createRequire } from 'node:module';
const robotsParser = createRequire(import.meta.url)('robots-parser') as (url: string, body: string) => { isAllowed(url: string, agent: string): boolean | undefined };
import type { PageFetch } from '../evidence.js';
import { publicFetch, publicUrl } from '../net/public-fetch.js';

export interface CrawlOptions { maxPages: number; timeoutMs: number; maxBytes: number; }
export const DEFAULT_CRAWL: CrawlOptions = { maxPages: 12, timeoutMs: 15000, maxBytes: 2000000 };
export const CANDIDATE_PATHS = ['/pricing', '/about', '/careers', '/blog', '/customers', '/changelog', '/docs', '/terms'];
const KEY_LINK = /pricing|plans|about|company|careers|jobs|blog|changelog|customers|case-stud|docs|terms|team|press|story|history/i;

export function discoverLinks(html: string, base: string): string[] {
  const $ = load(html), found = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')!;
    if (!KEY_LINK.test(href + ' ' + $(el).text())) return;
    try {
      const u = publicUrl(new URL(href, base).href);
      if (u.hostname.replace(/^www\./, '') !== new URL(base).hostname.replace(/^www\./, '')) return;
      if (/\.(pdf|zip|png|jpg|mp4)$/i.test(u.pathname)) return;
      u.hash = ''; u.search = '';
      found.add(u.href);
    } catch { /* malformed or non-public link */ }
  });
  return [...found];
}
export interface CrawlResult { pages: PageFetch[]; failed: { url: string; error: string }[]; }
export async function crawl(target: string, options: Partial<CrawlOptions> = {}): Promise<CrawlResult> {
  const opts = { ...DEFAULT_CRAWL, ...options };
  if (!Number.isInteger(opts.maxPages) || opts.maxPages < 1 || opts.maxPages > 30) throw new Error('max-pages must be an integer between 1 and 30');
  const initial = publicUrl(target), pages: PageFetch[] = [], failed: CrawlResult['failed'] = [];
  const policies = new Map<string, ReturnType<typeof robotsParser>>();
  async function permitted(url: URL): Promise<boolean> {
    if (!policies.has(url.origin)) {
      const robotsUrl = url.origin + '/robots.txt';
      const res = await publicFetch(robotsUrl, { timeoutMs: opts.timeoutMs, maxBytes: 250000 });
      if (res.status !== 404 && !res.ok) throw new Error(`Cannot check robots.txt: HTTP ${res.status}`);
      policies.set(url.origin, robotsParser(robotsUrl, res.status === 404 ? '' : res.body));
    }
    return policies.get(url.origin)!.isAllowed(url.href, 'bizlens') !== false;
  }
  const queue = [initial.href], seen = new Set<string>();
  for (let i = 0; i < queue.length && pages.length < opts.maxPages && i < opts.maxPages * 2; i++) {
    const next = queue[i];
    if (seen.has(next)) continue;
    seen.add(next);
    try {
      const url = new URL(next);
      if (!(await permitted(url))) throw new Error('Disallowed by robots.txt');
      // One request at a time, at least one second apart. No retry on throttling/challenges.
      if (i) await new Promise(r => setTimeout(r, 1000));
      const res = await publicFetch(next, opts);
      if (res.status === 429 || res.status === 403) { failed.push({ url: next, error: `HTTP ${res.status}: stopped crawl` }); break; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!/html/i.test(res.headers['content-type'] ?? '')) throw new Error('Not an HTML page');
      if (/just a moment|verify you are human|cf-chl-/i.test(res.body.slice(0, 15000))) throw new Error('Possible anti-bot challenge; no bypass attempted');
      const final = new URL(res.url);
      if (final.origin !== url.origin && !(await permitted(final))) throw new Error('Redirect destination disallowed by robots.txt');
      if (pages.some(p => p.finalUrl === final.href)) continue;
      pages.push({ url: next, finalUrl: res.url, status: res.status, contentType: res.headers['content-type'], headers: res.headers, html: res.body, ok: true });
      if (i === 0) {
        queue.push(...discoverLinks(res.body, res.url).sort((a,b) => Number(!/pricing|plans|about|story|history/.test(a)) - Number(!/pricing|plans|about|story|history/.test(b))));
        queue.push(...CANDIDATE_PATHS.map(p => final.origin + p));
      }
    } catch (err) {
      failed.push({ url: next, error: err instanceof Error ? err.message : String(err) });
      if (i === 0) break;
    }
  }
  return { pages, failed };
}
