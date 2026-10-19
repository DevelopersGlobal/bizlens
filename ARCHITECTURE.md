# Architecture

```text
CLI → public-address-checked crawler → observers → EvidencePack
                                             ↘ public-source adapters
EvidencePack → local Ollama → structured claim validation → Markdown + JSON
```

## Modules

- `src/net/public-fetch.ts`: HTTP(S), DNS/public-address pinning, bounded body, manual checked redirects, no cookies.
- `src/observe/crawl.ts`: robots policy, sequential bounded crawl, business-page link discovery.
- `src/observe/signals.ts`: HTML observers. No network calls here.
- `src/evidence.ts`: source-linked observations and timeline types.
- `src/history/`: optional free public-source adapters. Identity checks matter more than hit count.
- `src/analyze/prompt.ts`: evidence-only analysis contract.
- `src/analyze/ollama.ts`: loopback-only local generation, no tool execution.
- `src/analyze/claims.ts`: shape, citation-ID and numeric-support checks. This is not an entailment verifier.
- `src/report/markdown.ts`: report and evidence rendering.
- `src/cli.ts`: options, artifact writes, error exit codes.

## Add an observer

An observer is `(pages: PageFetch[], builder: EvidenceBuilder) => void`.

1. Parse fetched HTML. Find one concrete signal.
2. Add a stable dotted signal name, restrained summary, source URL and short source excerpt.
3. Register the function in `OBSERVERS`.
4. Add synthetic HTML fixtures and tests for matches, near misses, escaping and missing fields.
5. Never fetch URLs discovered in page scripts, run JavaScript, or treat website text as instructions.

Use an observer to record *what is visible*, not to explain business success. Keep interpretation in the analyzer and label it inferred.

## Add a public source

Use free public read-only endpoints with timeouts and size limits. Bind records to the target domain or a directly linked entity. A similar company name is not a match. Record the source response excerpt and source URL. Distinguish request failure from an empty result. No source should silently invent a zero value. Add mocked failure, identity-mismatch and success tests.

## Add an analyzer

Accept `EvidencePack`; return structured claims using existing IDs. Feed it through `validateAnalysis` before rendering. Never expose tools or credentials to the model. Keep the default workflow free and local. Tests must include malicious website text, unknown IDs and unsupported numbers. A provider name is not a quality guarantee.

## Current tradeoffs

Static HTML only. Detection is heuristic and mostly English. Public history is sparse. There is no full-web search, verified financial dataset or automatic fact-checking service. These are explicit gaps, not hidden capabilities.
