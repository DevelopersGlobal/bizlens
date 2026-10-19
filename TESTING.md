# Test scope

`npm test` builds TypeScript and runs deterministic Node tests using synthetic HTML fixtures and a local mocked Ollama HTTP service. No model or internet is required.

Coverage includes payment and tracker hints, pricing strings, hiring links, same-domain page discovery, citation tags, missing IDs, unsupported numeric claims, private-address/credential rejection, HTML escaping and the Ollama request/response contract.

Manual smoke checks during initial development used Node 22 on Linux:

- A three-page crawl of Plausible's public site produced source-linked observations and an evidence-only report.
- A real local Ollama qwen2.5:0.5b generation attempt reached the model but returned invalid JSON at the output limit. The application rejected it, exited nonzero and retained an evidence-only report. Successful real-model report quality is not established. The successful response path is tested with a mocked local service, not presented as a model benchmark.
- Wayback CDX and Hacker News returned target-linked records for example.com. Wikipedia returned no matching evidence; empty/failed lookups are limitations, not proof of absence.
- npm packaging was inspected with `npm pack --dry-run`. No npm publication was done.

Not established: analysis quality across companies, causal business-success explanations, broad prompt-injection resistance, Node 24 execution, Windows/macOS behavior, JS-rendered pages or comprehensive financial/history coverage. CI is configured for Node 22 and 24; a configuration is not itself a passing CI result.

The deterministic checks are structural safeguards, not a guarantee that an LLM claim is true. Add adversarial and semantic tests before making accuracy claims.
