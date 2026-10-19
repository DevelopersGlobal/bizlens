import { load } from "cheerio";
import type { PageFetch, EvidenceBuilder } from "../evidence.js";

/**
 * An observer inspects fetched pages and records evidence.
 * To add a new observer: write a function with this signature and add it to OBSERVERS.
 * Rules for observers: only record what is actually present; always include the
 * source URL and an exact quote; never invent values.
 */
export type Observer = (pages: PageFetch[], eb: EvidenceBuilder) => void;

const find = (html: string, re: RegExp): string | null => {
  const m = re.exec(html);
  return m ? m[0].slice(0, 200) : null;
};

const text = (html: string): string => { const $ = load(html); $("script,style,noscript").remove(); $("h1,h2,h3,p,div,li,br").each((_, e) => { $(e).append(" "); }); return $.root().text().replace(/\s+/g, " ").trim(); };

function firstSnippetAround(html: string, re: RegExp, span = 160): string | null {
  const m = re.exec(html);
  if (!m) return null;
  const start = Math.max(0, m.index - 40);
  return html.slice(start, m.index + span).replace(/\s+/g, " ").trim();
}

const PAYMENT_PROVIDERS: [RegExp, string][] = [
  [/js\.stripe\.com|stripe\.com\/v3|checkout\.stripe/i, "Stripe"],
  [/cdn\.paddle\.com|paddle\.js/i, "Paddle"],
  [/lemonsqueezy|lemon_squeezy/i, "Lemon Squeezy"],
  [/gumroad\.com\/js|gumroad\.com\/embed/i, "Gumroad"],
  [/checkout\.razorpay|razorpay\.com\/v1/i, "Razorpay"],
  [/js\.chargebee\.com/i, "Chargebee"],
  [/ recurly\.js|js\.recurly\.com/i, "Recurly"],
  [/js\.braintreegateway\.com/i, "Braintree"],
  [/paypal\.com\/sdk|paypalobjects/i, "PayPal"],
  [/buy\.stripe|payment[- ]?link/i, "payment link"],
];

const TRACKERS: [RegExp, string][] = [
  [/googletagmanager\.com|gtag\/js|google-analytics\.com/i, "Google Analytics / Tag Manager"],
  [/connect\.facebook\.net|fbq\(/i, "Meta Pixel"],
  [/doubleclick\.net|adsbygoogle|googlesyndication/i, "Google Ads / AdSense"],
  [/static\.hotjar\.com|hj\(/i, "Hotjar"],
  [/cdn\.segment\.com|analytics\.js/i, "Segment"],
  [/cdn\.mxpnl\.com|mixpanel/i, "Mixpanel"],
  [/plausible\.io\/js/i, "Plausible"],
  [/posthog\.com|posthog\.js|cdn\.posthog/i, "PostHog"],
  [/clarity\.ms/i, "Microsoft Clarity"],
  [/cdn\.heapanalytics\.com/i, "Heap"],
  [/intercomcdn|widget\.intercom/i, "Intercom"],
  [/cdn\.cookielaw\.org|cookiebot/i, "cookie-consent manager"],
];

const STACK_HINTS: [RegExp, string][] = [
  [/__NEXT_DATA__|\/_next\/static/i, "Next.js"],
  [/_nuxt\/|__NUXT__/i, "Nuxt"],
  [/gatsby-(?:chunk|browser)|___gatsby/i, "Gatsby"],
  [/wp-content|wp-includes/i, "WordPress"],
  [/cdn\.shopify\.com|Shopify\.theme/i, "Shopify"],
  [/framer\.com\/|framerusercontent/i, "Framer"],
  [/webflow\.js|data-wf-/i, "Webflow"],
  [/squarespace/i, "Squarespace"],
  [/wixstatic\.com|X-Wix/i, "Wix"],
  [/astro\.dev|"astro"/i, "Astro"],
  [/data-reactroot|react-dom/i, "React"],
  [/ng-version=/i, "Angular"],
  [/data-v-[a-f0-9]{8}|vue(?:\.global)?(?:\.prod)?\.js/i, "Vue"],
];

const paymentObserver: Observer = (pages, eb) => {
  const seen = new Set<string>();
  for (const p of pages) {
    for (const [re, name] of PAYMENT_PROVIDERS) {
      if (seen.has(name)) continue;
      const quote = find(p.html, re);
      if (quote) {
        seen.add(name);
        eb.add("money.payment_provider", `Payment provider detected: ${name}`, p.finalUrl, quote);
      }
    }
  }
};

const trackerObserver: Observer = (pages, eb) => {
  const seen = new Set<string>();
  for (const p of pages) {
    for (const [re, name] of TRACKERS) {
      if (seen.has(name)) continue;
      const quote = find(p.html, re);
      if (quote) {
        seen.add(name);
        eb.add("growth.tracker", `Analytics/ad tooling detected: ${name}`, p.finalUrl, quote);
      }
    }
  }
};

const stackObserver: Observer = (pages, eb) => {
  const seen = new Set<string>();
  for (const p of pages) {
    const gen = /<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i.exec(p.html);
    if (gen && !seen.has(gen[1])) {
      seen.add(gen[1]);
      eb.add("tech.generator", `Site generator: ${gen[1]}`, p.finalUrl, gen[0]);
    }
    const powered = p.headers["x-powered-by"];
    if (powered && !seen.has(powered)) {
      seen.add(powered);
      eb.add("tech.server", `X-Powered-By: ${powered}`, p.finalUrl, `x-powered-by: ${powered}`);
    }
    for (const [re, name] of STACK_HINTS) {
      if (seen.has(name)) continue;
      const quote = find(p.html, re);
      if (quote) {
        seen.add(name);
        eb.add("tech.stack", `Framework/platform detected: ${name}`, p.finalUrl, quote);
      }
    }
  }
};

const PRICING_PAGE = /\/pricing|\/plans|\/buy/i;
const pricingObserver: Observer = (pages, eb) => {
  for (const p of pages) {
    if (!PRICING_PAGE.test(p.finalUrl) && !/pricing/i.test(p.url)) continue;
    const body = text(p.html);
    const prices = [...body.matchAll(/(?:[$€£₹]\s?\d[\d,.]*(?:\s?\/\s?(?:mo|month|yr|year|user|seat))?|\b\d+(?:\.\d+)?\s?(?:USD|EUR|INR)\b)/g)]
      .map((m) => m[0].replace(/\s+/g, " ").trim());
    const unique = [...new Set(prices)].slice(0, 20);
    if (unique.length) {
      eb.add(
        "pricing.price_points",
        `Price points found on ${p.finalUrl}: ${unique.join(", ")}`,
        p.finalUrl,
        firstSnippetAround(body, /[$€£₹]\s?\d/) ?? body.slice(0, 300),
      );
    }
    const tiers = [...body.matchAll(/\b(Free|Starter|Hobby|Basic|Pro(?:fessional)?|Team|Business|Growth|Scale|Enterprise|Ultimate|Premium|Plus)\b(?=\s*(?:plan|tier|–|-|\/|$|\s))/g)]
      .map((m) => m[1]);
    const uniqTiers = [...new Set(tiers)].slice(0, 12);
    if (uniqTiers.length) {
      eb.add("pricing.tiers", `Plan names found: ${uniqTiers.join(", ")}`, p.finalUrl, firstSnippetAround(body, /Free|Starter|Pro|Enterprise/) ?? body.slice(0, 300));
    }
    const trial = firstSnippetAround(body, /free trial|try (it )?free|start (for )?free|no credit card/i);
    if (trial) eb.add("pricing.free_trial", "Free trial / free start language found", p.finalUrl, trial);
    const freemium = firstSnippetAround(body, /free (plan|tier|forever)/i);
    if (freemium) eb.add("pricing.freemium", "Free plan language found", p.finalUrl, freemium);
    const contact = firstSnippetAround(body, /contact (us|sales)|talk to sales|custom pricing/i);
    if (contact) eb.add("pricing.sales_led", "Sales-contact pricing language found", p.finalUrl, contact);
  }
};

const HIRING_PAGE = /career|jobs|hiring|work-with/i;
const hiringObserver: Observer = (pages, eb) => {
  for (const p of pages) {
    if (!HIRING_PAGE.test(p.finalUrl)) continue;
    const body = text(p.html);
    const boards = [...p.html.matchAll(/(boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|apply\.workable\.com|wellfound\.com\/company)/g)].map(
      (m) => m[1],
    );
    for (const b of new Set(boards)) {
      eb.add("team.hiring_board", `Uses hiring board: ${b}`, p.finalUrl, b);
    }
    const roles = [...body.matchAll(/\b(engineer|designer|manager|developer|marketer|analyst|founder|intern)\b/gi)].length;
    const hiringLine = firstSnippetAround(body, /(we('| a)re hiring|open (roles|positions)|join (our|the) team)/i);
    if (hiringLine) eb.add("team.hiring", "Careers page says the company is hiring", p.finalUrl, hiringLine);
    if (roles > 3 && !hiringLine) {
      eb.add("team.careers_page", "Careers page lists multiple role keywords", p.finalUrl, body.slice(0, 200));
    }
  }
};

const socialObserver: Observer = (pages, eb) => {
  const seen = new Set<string>();
  const re = /https?:\/\/(?:www\.)?(github\.com|twitter\.com|x\.com|linkedin\.com|discord\.gg|discord\.com\/invite|youtube\.com|apps\.apple\.com|play\.google\.com|producthunt\.com)\/[^\s"'<>)\]]*/gi;
  for (const p of pages) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(p.html))) {
      const url = m[0].replace(/["']$/, "");
      const host = m[1].toLowerCase();
      if (/github\.com\/(sponsors|features|topics|marketplace)/.test(url)) continue;
      const key = host + url.split("/").slice(0, 4).join("/");
      if (seen.has(key)) continue;
      seen.add(key);
      const label =
        host === "apps.apple.com" ? "iOS app listing" :
        host === "play.google.com" ? "Android app listing" :
        host === "producthunt.com" ? "Product Hunt listing" :
        host.startsWith("github") ? "GitHub link" :
        host.includes("linkedin") ? "LinkedIn page" :
        host.includes("discord") ? "Discord invite" :
        host.includes("youtube") ? "YouTube channel" : "X/Twitter profile";
      eb.add("presence.link", `${label}: ${url}`, p.finalUrl, url);
    }
  }
};

const proofObserver: Observer = (pages, eb) => {
  for (const p of pages) {
    if (!/customer|case-stud|testimonial|\/pricing|^[^/]*\/$/.test(p.finalUrl)) continue;
    const body = text(p.html);
    const trusted = firstSnippetAround(body, /(trusted by|used by|loved by|powering|teams at)\b[^.]{0,120}/i);
    if (trusted) eb.add("proof.customers", "Customer social-proof language found", p.finalUrl, trusted);
    const count = firstSnippetAround(body, /([\d,.]+\s?\+?\s?(?:customers|companies|teams|developers|users|businesses))/i);
    if (count) eb.add("proof.count", "Customer/user count claim on site", p.finalUrl, count);
  }
};

const ossObserver: Observer = (pages, eb) => {
  const seen = new Set<string>();
  for (const p of pages) {
    const re = /https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p.html))) {
      const repo = m[1].replace(/\.git$/, "");
      if (/^(sponsors|features|topics|marketplace|login|signup|pricing|about|explore)\b/i.test(repo)) continue;
      if (seen.has(repo.toLowerCase())) continue;
      seen.add(repo.toLowerCase());
      eb.add("oss.repo_link", `Site links to GitHub repo: ${repo}`, p.finalUrl, m[0]);
    }
  }
};

const newsletterObserver: Observer = (pages, eb) => {
  for (const p of pages) {
    const rss = /<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/i.exec(p.html);
    if (rss) eb.add("growth.rss", "Site offers an RSS/Atom feed", p.finalUrl, rss[0].slice(0, 200));
    const nl = firstSnippetAround(text(p.html), /subscribe to (our )?newsletter|join (our )?newsletter|get updates/i);
    if (nl) eb.add("growth.newsletter", "Newsletter signup found", p.finalUrl, nl);
    if (/\/blog/.test(p.finalUrl)) {
      const dates = [...p.html.matchAll(/datetime=["'](\d{4}-\d{2}-\d{2})["']/g)].map((m) => m[1]);
      if (dates.length >= 2) {
        const sorted = [...new Set(dates)].sort();
        eb.add(
          "growth.blog_cadence",
          `Blog posts dated ${sorted[0]} to ${sorted[sorted.length - 1]} (${sorted.length} dated entries on index page)`,
          p.finalUrl,
          sorted.join(", "),
        );
      }
    }
  }
};

const metaObserver: Observer = (pages, eb) => {
  const home = pages[0];
  if (!home) return;
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(home.html);
  if (title) eb.add("meta.title", `Homepage title: ${title[1].trim().slice(0, 140)}`, home.finalUrl, title[1].trim().slice(0, 200));
  const desc = /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i.exec(home.html);
  if (desc) eb.add("meta.description", `Homepage meta description: ${desc[1].slice(0, 200)}`, home.finalUrl, desc[0].slice(0, 300));
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(home.html);
  if (h1) {
    const t = h1[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (t) eb.add("meta.h1", `Homepage H1: ${t.slice(0, 140)}`, home.finalUrl, t.slice(0, 200));
  }
};

const narrativeObserver: Observer = (pages, eb) => {
  for (const p of pages) {
    const $ = load(p.html);
    $('script,style,nav,footer,header,noscript').remove();
    let count = 0;
    $('h1,h2,p').each((_, el) => {
      if (count >= 4) return;
      const quote = $(el).text().replace(/\s+/g, ' ').trim();
      if (quote.length < 45 || quote.length > 800) return;
      if (!/about|company|story|history|pricing|plans/.test(p.finalUrl) && pages[0] !== p) return;
      eb.add('content.excerpt', 'Public page excerpt (site statement, not independently verified)', p.finalUrl, quote);
      count++;
    });
  }
};

/** All built-in observers. Add yours here (see ARCHITECTURE.md). */
export const OBSERVERS: Observer[] = [
  metaObserver,
  narrativeObserver,
  pricingObserver,
  paymentObserver,
  trackerObserver,
  stackObserver,
  hiringObserver,
  socialObserver,
  proofObserver,
  ossObserver,
  newsletterObserver,
];
