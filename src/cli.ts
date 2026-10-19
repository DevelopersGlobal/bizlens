#!/usr/bin/env node
import { validateAnalysis, analysisMarkdown } from "./analyze/claims.js";
import { parseArgs } from "node:util";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { gatherEvidence } from "./analyze/index.js";
import { buildPrompt } from "./analyze/prompt.js";
import { analyzeWithOllama } from "./analyze/ollama.js";
import { renderReport, renderSkeleton } from "./report/markdown.js";

const USAGE = `bizlens - reverse-engineer a business model from a website.

Usage:
  bizlens analyze <url> [options]

Options:
  --out <dir>         Write report.md + evidence.json here (default: ./out/<domain>)
  --model <name>      Ollama model (default: BIZLENS_MODEL or qwen2.5:7b-instruct)
  --ollama-host <url> Ollama host (default: OLLAMA_HOST or http://127.0.0.1:11434)
  --max-pages <n>     Max pages to fetch (default: 12)
  --no-history        Skip Wayback/HN/Wikipedia/GitHub lookups
  --no-llm            Emit the evidence pack and skeleton report without calling a model
  --json              Also print the evidence pack JSON to stdout
  -h, --help          Show this help
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string" },
      model: { type: "string" },
      "ollama-host": { type: "string" },
      "max-pages": { type: "string" },
      "no-history": { type: "boolean", default: false },
      "no-llm": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const [command, url] = positionals;
  if (values.help || command !== "analyze" || !url) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  const model = values.model ?? process.env.BIZLENS_MODEL ?? "qwen2.5:7b-instruct";
  const host = values["ollama-host"] ?? process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

  console.error(`[bizlens] gathering evidence from ${url} ...`);
  const pack = await gatherEvidence(url, {
    maxPages: values["max-pages"] ? Number(values["max-pages"]) : undefined,
    includeHistory: !values["no-history"],
  });
  console.error(
    `[bizlens] ${pack.evidence.length} observations from ${pack.pagesFetched.length} pages` +
      (pack.pagesFailed.length ? ` (${pack.pagesFailed.length} pages failed)` : ""),
  );

  const outDir = values.out ?? join("out", pack.domain);
  await mkdir(outDir, { recursive: true });
  await rm(join(outDir, "analysis.json"), { force: true });
  await rm(join(outDir, "report.md"), { force: true });
  await writeFile(join(outDir, "evidence.json"), JSON.stringify(pack, null, 2));
  if (!pack.pagesFetched.length) {
    await writeFile(join(outDir, "report.md"), renderSkeleton(pack));
    throw new Error(`No pages collected. Evidence-only result saved in ${outDir}.`);
  }
  if (values.json) console.log(JSON.stringify(pack, null, 2));

  let report: string;
  if (values["no-llm"]) {
    report = renderSkeleton(pack);
    console.error("[bizlens] --no-llm: wrote evidence pack and skeleton report (no model called)");
  } else {
    console.error(`[bizlens] analyzing with ${model} via ${host} ...`);
    const prompt = buildPrompt(pack);
    try {
      const analysis = validateAnalysis(await analyzeWithOllama(prompt, { host, model, timeoutMs: 300_000 }), pack);
      await writeFile(join(outDir, "analysis.json"), JSON.stringify(analysis, null, 2));
      report = renderReport(pack, analysisMarkdown(analysis), model);
    } catch (error) {
      await writeFile(join(outDir, "report.md"), renderSkeleton(pack));
      throw new Error(`Analysis rejected or unavailable: ${error instanceof Error ? error.message : String(error)}. Evidence and evidence-only report saved in ${outDir}.`);
    }
  }

  const reportPath = join(outDir, "report.md");
  await writeFile(join(outDir, "report.md"), report);
  console.error(`[bizlens] done: ${reportPath} (+ evidence.json)`);
}

main().catch((err) => {
  console.error(`[bizlens] error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
