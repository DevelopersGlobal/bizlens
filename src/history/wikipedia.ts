import { sourceFetch as fetch } from "./fetch.js";
import type { EvidenceBuilder } from "../evidence.js";

/** Wikipedia: free, no key. Only records a hit when the extract actually mentions the domain. */
export async function wikipediaMention(domain: string, companyName: string, eb: EvidenceBuilder, timeoutMs = 15_000): Promise<void> {
  if (!companyName || companyName.length < 3) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const search = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=3&search=${encodeURIComponent(companyName)}`,
      { signal: controller.signal, headers: { "user-agent": "bizlens/0.1 (+https://github.com/DevelopersGlobal/bizlens)" } },
    );
    if (!search.ok) return;
    const [, titles] = (await search.json()) as [string, string[], string[], string[]];
    for (const title of titles ?? []) {
      const sum = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        signal: controller.signal,
        headers: { "user-agent": "bizlens/0.1 (+https://github.com/DevelopersGlobal/bizlens)" },
      });
      if (!sum.ok) continue;
      const data = (await sum.json()) as { extract?: string; content_urls?: { desktop?: { page?: string } } };
      const extract = data.extract ?? "";
      if (!extract.toLowerCase().includes(domain.toLowerCase())) continue; // require a domain tie to avoid wrong-company matches
      eb.add("history.wikipedia", `Wikipedia article found: "${title}"`, data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, extract.slice(0, 300));
      return;
    }
  } catch (error) {
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
