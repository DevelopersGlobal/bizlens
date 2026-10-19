# Roadmap and contribution ideas

Implemented: bounded static website crawl, heuristic observations, public-source adapters, local Ollama integration, structured output checks, evidence export.

Small starter ideas:

- Improve currency extraction for amounts written as EUR 19 or 19,90 €. Include locale-specific positive and negative fixtures; preserve original price wording.
- Support meta description tags with reversed attributes and Open Graph descriptions. Do not mistake social preview descriptions for verified facts.
- Detect RSS links regardless of attribute order. Include Atom, missing href, and non-feed MIME negative cases.

Larger directions, not promises:

- More reliable origin/founder timeline from company story pages, with exact source excerpts
- Manually supplied article URLs for deeper history, with domain/identity checks
- Better citation entailment evaluation and adversarial model benchmarks
- Optional browser observation with the same public-only and robots policies
- MCP interface and report comparisons over time
- International observers and localization

Open an issue to discuss scope before building a larger feature. No funding, traffic or revenue estimates without source evidence. A good feature makes the distinction between observation and inference clearer.
