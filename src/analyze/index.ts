import { EvidenceBuilder, type EvidencePack, type TimelineEntry } from "../evidence.js";
import { crawl } from "../observe/crawl.js";
import { OBSERVERS } from "../observe/signals.js";
import { waybackTimeline } from "../history/wayback.js";
import { hnMentions } from "../history/hackernews.js";
import { wikipediaMention } from "../history/wikipedia.js";
import { githubRepoStats } from "../history/github.js";

export interface GatherOptions {
  maxPages?: number;
  timeoutMs?: number;
  includeHistory?: boolean;
}

export async function gatherEvidence(target: string, opts: GatherOptions = {}): Promise<EvidencePack> {
  const normalized = /^https?:\/\//i.test(target) ? target : `https://${target}`;
  const domain = new URL(normalized).hostname.replace(/^www\./, "");

  const { pages, failed } = await crawl(normalized, {
    maxPages: opts.maxPages ?? 12,
    timeoutMs: opts.timeoutMs ?? 15_000,
  });

  const eb = new EvidenceBuilder();
  for (const observer of OBSERVERS) observer(pages, eb);

  const timeline: TimelineEntry[] = [];
  const limitations: string[] = ["Static HTML only; JavaScript-rendered content, full operating history and private financial results are not visible."];

  if (opts.includeHistory !== false && pages[0]?.ok) {
    const homeTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(pages[0].html)?.[1] ?? "";
    const companyName = homeTitle.split(/[|\-–—·:]/)[0]?.trim() ?? "";

    async function optional<T>(label: string, work: () => Promise<T>, empty: T): Promise<T> {
      const before = eb.all().length;
      try { const result = await work(); if (eb.all().length === before) limitations.push(`${label}: no matching evidence returned.`); return result; }
      catch (error) { limitations.push(`${label}: lookup failed (${error instanceof Error ? error.message : String(error)}).`); return empty; }
    }
    const wb = await optional("Wayback", () => waybackTimeline(domain, eb), []);
    const hn = await optional("Hacker News", () => hnMentions(domain, eb), []);
    timeline.push(...wb, ...hn);
    await optional("Wikipedia", () => wikipediaMention(domain, companyName, eb), undefined);

    const repoLinks = eb
      .all()
      .filter((e) => e.signal === "oss.repo_link")
      .map((e) => /github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/.exec(e.quote)?.[1])
      .filter((r): r is string => Boolean(r))
      .slice(0, 2);
    for (const repo of repoLinks) await optional("GitHub", () => githubRepoStats(repo, eb), undefined);
  }

  timeline.sort((a, b) => a.date.localeCompare(b.date));

  if (!pages[0]?.ok) {
    limitations.push(`The target URL could not be fetched: ${failed[0]?.error ?? "unknown error"}`);
  }
  if (pages.some((p) => p.html && p.html.length < 2_000 && /<div id="root">|<div id="app"|__NEXT_DATA__/.test(p.html))) {
    limitations.push(
      "One or more pages render mostly with JavaScript. This version does not run a headless browser, so client-rendered content may be missing.",
    );
  }
  if (failed.length) {
    limitations.push(`${failed.length} candidate page(s) failed to load and were skipped.`);
  }
  limitations.push("History sources are best-effort and free: Wayback Machine, Hacker News, Wikipedia, GitHub. Absence of a record is not proof it does not exist.");

  return {
    target: normalized,
    domain,
    fetchedAt: new Date().toISOString(),
    pagesFetched: pages.filter((p) => p.ok).map((p) => p.finalUrl),
    pagesFailed: failed,
    evidence: eb.all(),
    timeline,
    limitations,
  };
}
