import { sourceFetch as fetch } from "./fetch.js";
import type { EvidenceBuilder } from "../evidence.js";

interface GhRepo {
  full_name: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  pushed_at: string;
  license?: { spdx_id?: string } | null;
  description?: string | null;
}

/** GitHub REST API, unauthenticated (60 req/hr): only called when the site links a repo. */
export async function githubRepoStats(repo: string, eb: EvidenceBuilder, timeoutMs = 15_000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      signal: controller.signal,
      headers: { "user-agent": "bizlens/0.1", accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const r = (await res.json()) as GhRepo;
    const url = `https://github.com/${r.full_name}`;
    eb.add(
      "oss.repo_stats",
      `GitHub repo ${r.full_name}: ${r.stargazers_count} stars, ${r.forks_count} forks, created ${r.created_at.slice(0, 10)}, license ${r.license?.spdx_id ?? "none detected"}`,
      url,
      `stars=${r.stargazers_count} forks=${r.forks_count} created=${r.created_at.slice(0, 10)} open_issues=${r.open_issues_count}`,
    );
  } catch (error) {
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
