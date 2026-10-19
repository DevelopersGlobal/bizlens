# Contributing to BizLens

Help make business analysis more checkable, not more confident.

## Get running

Use Node.js 22+, run `npm ci`, then `npm test`. Tests should be deterministic and should not call the internet or require a model.

Pick an item in ROADMAP.md or open an issue describing a real gap. Small PRs are easier to review. For bigger changes, discuss scope first.

## Changes we welcome

- Observers with positive and negative HTML fixtures
- Sources with reliable target identity checks and clear failure reporting
- Better extraction across languages and messy HTML
- Citation validation and adversarial tests
- Docs, examples and accessibility improvements

## Pull request checklist

1. Fork the repository, create a feature branch, and open a PR to `main`.
2. Explain what changes and why. Use plain titles; use labels, not bracket prefixes.
3. Run `npm test`. Add regression tests for a fix.
4. Quote a source for each observation. Never turn a guess into an observed fact.
5. Do not commit credentials, private data, generated customer reports or scraped archives.
6. Keep model services local and optional. No paid API dependency in the default workflow.
7. State what you did not test. Do not claim an unmeasured improvement in accuracy.

Only use short public excerpts you may redistribute, or synthetic fixtures. Do not copy a site's full content into tests. Contributions are under the project's MIT license.

## Adding an observer

Read ARCHITECTURE.md. Add a small `Observer`, register it in `OBSERVERS`, and test both matches and near misses. Tech matches are hints, not verified infrastructure. Link presence is not proof of channel success.

## Security reports

Do not post exploit details or secrets in a public issue. Use GitHub's private vulnerability reporting if enabled; otherwise contact the maintainers before sharing details publicly. Never test against someone else's site without permission.

Be respectful. Critique code and evidence, not people. No spam PRs, scraped personal data, fake stars or fabricated examples.
