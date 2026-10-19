import { sourceFetch as fetch } from "./fetch.js";
import type { EvidenceBuilder, TimelineEntry } from "../evidence.js";

interface HnHit {
  title?: string;
  url?: string;
  created_at?: string;
  points?: number;
  objectID?: string;
}

/** Hacker News Algolia API: free, no key. Finds launch posts ("Show HN") and coverage. */
export async function hnMentions(domain: string, eb: EvidenceBuilder, timeoutMs = 15_000): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(domain)}&tags=story&hitsPerPage=20`,
      { signal: controller.signal },
    );
    if (!res.ok) return entries;
    const data = (await res.json()) as { hits?: HnHit[] };
    for (const hit of (data.hits ?? []).slice(0, 8)) {
      if (!hit.title || !hit.objectID || !hit.url) continue;
      try { if (new URL(hit.url).hostname.replace(/^www\./, "") !== domain) continue; } catch { continue; }
      const hnUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const isShowHn = /^show hn:/i.test(hit.title);
      const ev = eb.add(
        isShowHn ? "history.show_hn" : "history.hn_story",
        `${isShowHn ? "Show HN post" : "Hacker News story"}: "${hit.title}" (${hit.points ?? "unknown"} points, ${hit.created_at?.slice(0, 10) ?? "date unknown"})`,
        hnUrl,
        `${hit.title} - ${hit.points ?? "unknown"} points`,
      );
      entries.push({
        date: hit.created_at?.slice(0, 10) ?? "unknown",
        event: `${isShowHn ? "Posted on Show HN" : "Discussed on Hacker News"}: ${hit.title} (${hit.points ?? "unknown"} points)`,
        sourceUrl: hnUrl,
        evidenceId: ev.id,
      });
    }
    return entries;
  } catch (error) {
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
