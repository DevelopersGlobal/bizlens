<div align="center">

# BizLens

### Understand the business behind a website.

Give it a URL. Collect public evidence. Learn what the business sells, how it reaches people, and which ideas you could test yourself.

[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/node-22%2B-green.svg)](package.json)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Website signals → evidence pack → local AI report**

</div>

## Why BizLens?

A website can reveal pricing, positioning, distribution links, technical hints and public history. It cannot tell you the whole business story. BizLens keeps that distinction visible.

- **Understand the model:** value proposition, customer, pricing and visible distribution channels.
- **Learn from the journey:** public archive and launch-discussion records, where a source can be tied to the target.
- **Start something of your own:** evidence-inspired experiments, not a made-up account of how a founder succeeded.
- **Check the work:** source URLs, snippets and evidence IDs stay next to the analysis.
- **Run locally:** Ollama for analysis, no paid API or API key. Your own hardware, bandwidth and electricity are still needed.

Inspired by [REA](https://github.com/morluto/rea)'s evidence-first approach. This is an independent project, not a REA fork, integration or business-analysis feature of REA. No REA code is reused.

## Quick start

Node.js 22+ and npm are required. This package is **not published to npm yet**. Clone and run it locally:

```bash
git clone https://github.com/DevelopersGlobal/bizlens.git
cd bizlens
npm ci
npm run build

# No model needed: inspect the evidence first
node dist/src/cli.js analyze https://example.com --no-llm --no-history

# Install/start Ollama separately, then pull a model that fits your machine
ollama pull qwen2.5:7b-instruct
node dist/src/cli.js analyze https://example.com --model qwen2.5:7b-instruct
```

The default model is a suggestion, not a tested quality benchmark. Small models may produce invalid or unsupported claims; those responses are rejected. BizLens never downloads a model automatically.

Reports are saved to `out/<domain>/`:

| File | Contents |
| --- | --- |
| `evidence.json` | Observations, source URLs, snippets, timestamps and crawl failures |
| `report.md` | Cited analysis, or an explicitly evidence-only report |
| `analysis.json` | Structurally checked model output, only when analysis succeeds |

If Ollama is unavailable or validation fails, the evidence pack and evidence-only report remain available and the command exits with an error. Invalid analysis is not passed off as a finished report.

## What a report covers

1. What the business does and who it appears to serve
2. Business model and observed pricing
3. Visible distribution and growth signals
4. Public timeline, without confusing archive dates with founding dates
5. What *appears* promising, explicitly labeled as inference
6. Ideas to try when building from scratch, with suggested experiments
7. Risks, missing evidence and unknowns

An `observed` claim means a source said or exposed something. It does **not** mean the source's claim was independently verified. `inferred` means interpretation, not proven causation.

## Options

```text
bizlens analyze <url>
  --out <dir>          Output directory
  --model <name>       Local Ollama model (or BIZLENS_MODEL)
  --ollama-host <url>  Loopback HTTP endpoint (or OLLAMA_HOST)
  --max-pages <n>      1-30 successful pages, default 12
  --no-history        Skip public-source adapters
  --no-llm            Collect evidence without calling a model
  --json              Also print evidence JSON to stdout
```

For local `bizlens` command usage, run `npm link` after building. Until npm publication, do not use an unverified `npx bizlens` package.

## Sources and limits

- Site HTML: pricing language, payment/analytics/framework hints, careers, social/app/repo links and self-reported social proof.
- Public history adapters: Wayback CDX, Hacker News Algolia, Wikipedia and GitHub REST. They are best-effort, unauthenticated sources, not an exhaustive internet search. Failed or empty lookups are reported as limitations.
- No login, paywall bypass, private data, JavaScript execution or headless browser. Some sites will yield little usable evidence.
- A tracker does not prove a profitable acquisition channel. A checkout script does not prove revenue. Customer counts are site claims. A Show HN post may be a later relaunch. The earliest returned archive record is not a founding date.
- Models can cite a real item while drawing the wrong conclusion. Citation-ID and number checks reduce obvious errors; they do **not** prove semantic correctness. Review the evidence before using a report for a decision.
- Website text is untrusted input. Local analysis has no tools, shell access or credentials. Prompt-injection resistance is not guaranteed.

## Responsible use

Only inspect public sites you are allowed to access. Respect terms, copyright and site owners. BizLens checks `robots.txt`, limits response size, fetches sequentially and spaces page requests. It stops on HTTP 403/429 rather than trying to evade a block. Network targets and redirects are checked for public addresses; local/private networks and credential-bearing URLs are rejected. Do not expose this CLI as a public server without a separate security review.

## Contribute

New observers and better evidence quality are useful first contributions. Start with [CONTRIBUTING.md](CONTRIBUTING.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [ROADMAP.md](ROADMAP.md).

```bash
npm ci
npm test
```

Tests use synthetic fixtures and mocked services, not live-site assertions. See [TESTING.md](TESTING.md) for the exact test scope and live smoke checks.

[MIT license](LICENSE). Built as a DevelopersGlobal open-source project.

<!-- Initial repository README retained:
# bizlens
Understand how a business works from its website and public sources. Cited observations, local AI analysis, and ideas for starting from scratch. Free and open source.
-->
