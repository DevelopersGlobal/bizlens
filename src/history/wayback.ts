import { sourceFetch as fetch } from "./fetch.js";
import type { EvidenceBuilder, TimelineEntry } from "../evidence.js";

/** Wayback Machine CDX API: free, no key. */
export async function waybackTimeline(domain: string, eb: EvidenceBuilder, timeoutMs = 20_000): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];
  const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&filter=statuscode:200&collapse=timestamp:4&fl=timestamp,original&limit=400`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return entries;
    const rows = (await res.json()) as string[][];
    if (!Array.isArray(rows) || rows.length < 2) return entries;
    const data = rows.slice(1);
    const first = data[0][0];
    const last = data[data.length - 1][0];
    const firstIso = `${first.slice(0, 4)}-${first.slice(4, 6)}-${first.slice(6, 8)}`;
    const lastIso = `${last.slice(0, 4)}-${last.slice(4, 6)}-${last.slice(6, 8)}`;
    const ev = eb.add(
      "history.wayback",
      `Wayback Machine: earliest returned capture ${firstIso}, latest returned ${lastIso}, ${data.length} sampled yearly captures`,
      `https://web.archive.org/web/${first}/${data[0][1]}`,
      `first=${firstIso} last=${lastIso} captures=${data.length}`,
    );
    entries.push({ date: firstIso, event: "Earliest returned sampled archive capture (not a founding date)", sourceUrl: ev.sourceUrl, evidenceId: ev.id });
    const byYear = new Map<string, number>();
    for (const r of data) byYear.set(r[0].slice(0, 4), (byYear.get(r[0].slice(0, 4)) ?? 0) + 1);
    return entries;
  } catch (error) {
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
