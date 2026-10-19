/** One observed fact, always tied to a source URL and an exact quoted snippet. */
export interface Evidence {
  id: string; // E1, E2, ...
  signal: string; // e.g. "pricing.tiers", "tech.payment_provider"
  summary: string; // one-line human statement of what was observed
  sourceUrl: string;
  quote: string; // exact snippet from the source, capped
  observedAt: string; // ISO timestamp
}

export interface PageFetch {
  url: string;
  status: number;
  finalUrl: string;
  contentType: string;
  headers: Record<string, string>;
  html: string; // empty for non-HTML
  ok: boolean;
  error?: string;
}

export interface TimelineEntry {
  date: string; // ISO or year
  event: string;
  sourceUrl: string;
  evidenceId?: string;
}

export interface EvidencePack {
  target: string; // the URL the user gave
  domain: string;
  fetchedAt: string;
  pagesFetched: string[];
  pagesFailed: { url: string; error: string }[];
  evidence: Evidence[];
  timeline: TimelineEntry[];
  limitations: string[];
}

export class EvidenceBuilder {
  private items: Evidence[] = [];
  add(signal: string, summary: string, sourceUrl: string, quote: string): Evidence {
    const ev: Evidence = {
      id: `E${this.items.length + 1}`,
      signal,
      summary,
      sourceUrl,
      quote: quote.replace(/\s+/g, " ").trim().slice(0, 400),
      observedAt: new Date().toISOString(),
    };
    this.items.push(ev);
    return ev;
  }
  all(): Evidence[] {
    return this.items;
  }
}
