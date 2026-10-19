import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PageFetch } from "../src/evidence.js";
import { EvidenceBuilder } from "../src/evidence.js";
import { OBSERVERS } from "../src/observe/signals.js";
import { discoverLinks } from "../src/observe/crawl.js";
import { verificationWarnings } from "../src/report/markdown.js";
import { buildPrompt } from "../src/analyze/prompt.js";

const here = dirname(fileURLToPath(import.meta.url));
// tests run from dist/test/, fixtures are copied next to compiled output by the build script
const fixture = (name: string) => readFileSync(join(here, "../../test/fixtures", name), "utf8");

function page(url: string, html: string): PageFetch {
  return { url, status: 200, finalUrl: url, contentType: "text/html", headers: {}, html, ok: true };
}

function runObservers(): ReturnType<EvidenceBuilder["all"]> {
  const eb = new EvidenceBuilder();
  const pages = [page("https://acme.test/pricing", fixture("pricing.html")), page("https://acme.test/careers", fixture("careers.html"))];
  for (const o of OBSERVERS) o(pages, eb);
  return eb.all();
}

test("detects Stripe as a payment provider with a quote", () => {
  const ev = runObservers().find((e) => e.summary.includes("Stripe"));
  assert.ok(ev, "expected a Stripe observation");
  assert.match(ev.quote, /stripe/i);
  assert.equal(ev.sourceUrl, "https://acme.test/pricing");
});

test("detects Google Analytics tooling", () => {
  assert.ok(runObservers().some((e) => e.summary.includes("Google Analytics")));
});

test("extracts price points and plan tiers", () => {
  const all = runObservers();
  const prices = all.find((e) => e.signal === "pricing.price_points");
  assert.ok(prices, "expected price points");
  assert.match(prices.summary, /\$20/);
  const tiers = all.find((e) => e.signal === "pricing.tiers");
  assert.ok(tiers && /Pro/.test(tiers.summary) && /Free/.test(tiers.summary));
});

test("detects free-trial and sales-led language", () => {
  const all = runObservers();
  assert.ok(all.some((e) => e.signal === "pricing.free_trial"));
  assert.ok(all.some((e) => e.signal === "pricing.sales_led"));
});

test("detects hiring board on careers page", () => {
  assert.ok(runObservers().some((e) => e.summary.includes("greenhouse.io")));
});

test("detects customer-count claim as an observation", () => {
  const count = runObservers().find((e) => e.signal === "proof.count");
  assert.ok(count && count.quote.includes("4,200"));
});

test("detects GitHub repo link", () => {
  assert.ok(runObservers().some((e) => e.quote.includes("github.com/acme/acme-cli")));
});

test("discoverLinks finds business-relevant same-domain links only", () => {
  const html = `<a href="/pricing">Pricing</a><a href="https://other.test/pricing">Other</a><a href="/random">Nothing</a>`;
  const links = discoverLinks(html, "https://acme.test");
  assert.deepEqual(links, ["https://acme.test/pricing"]);
});

test("verificationWarnings flags uncited money claims and keeps cited ones", () => {
  const analysis = [
    "Revenue is around $5 million ARR", // no citation -> warn
    "Pricing starts at $20 /month [observed E3]", // cited -> fine
    "Raised $2M seed [inferred from E7]", // cited -> fine
  ].join("\n");
  const warnings = verificationWarnings(analysis);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /\$5 million/);
});

test("prompt demands citation tags and forbids invented numbers", () => {
  const eb = new EvidenceBuilder();
  eb.add("meta.title", "t", "https://x.test", "q");
  const prompt = buildPrompt({
    target: "https://x.test",
    domain: "x.test",
    fetchedAt: "2026-01-01T00:00:00Z",
    pagesFetched: ["https://x.test"],
    pagesFailed: [],
    evidence: eb.all(),
    timeline: [],
    limitations: [],
  });
  assert.match(prompt, /NEVER state revenue, valuation, traffic, funding, or user-count numbers/);
  assert.match(prompt, /evidenceIds/);
  assert.match(prompt, /## Unknowns and limitations/);
});
