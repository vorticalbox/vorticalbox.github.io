#!/usr/bin/env node
/**
 * RSS radar — discover a feed for a page, and check it's one worth keeping.
 *
 * Point this at any article or blog's homepage. It looks for the page's own
 * declared feed (`<link rel="alternate" type="application/rss+xml|atom+xml">`
 * in the HTML head — standard, and most static site generators emit it) and
 * falls back to a handful of common paths if the page doesn't declare one.
 * Found feeds are validated by checking they actually parse as RSS/Atom with
 * at least one entry, not just checked for a 200 — a wrong guess that
 * returns an HTML 404 page should not look like a hit.
 *
 * This exists for the evolve-agents loop: when a merged post's research
 * turned up a source worth coming back to (an individual's blog, a specific
 * project's blog — not a one-off news article or a big aggregator), this is
 * how it finds that source's feed before adding it to feeds.json.
 *
 * Usage:
 *   node discover.mjs <page-url>
 */

function die(msg) {
  console.error(`discover: ${msg}`);
  process.exit(1);
}

const url = process.argv[2];
if (!/^https?:\/\//.test(url ?? '')) die('needs a page URL — discover.mjs <url>');

async function fetchText(u, ms = 20000) {
  const res = await fetch(u, { signal: AbortSignal.timeout(ms), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { text: await res.text(), finalUrl: res.url };
}

/** Pull declared feed <link> tags out of an HTML <head>, resolved to absolute URLs. */
function declaredFeeds(html, baseUrl) {
  const out = [];
  const re = /<link\b[^>]*>/gi;
  for (const tag of html.match(re) ?? []) {
    if (!/rel=["']alternate["']/i.test(tag)) continue;
    if (!/type=["']application\/(rss|atom)\+xml["']/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i);
    if (!href) continue;
    try {
      out.push(new URL(href[1], baseUrl).toString());
    } catch {
      /* malformed href, skip */
    }
  }
  return [...new Set(out)];
}

/** Common feed paths to try when a page doesn't declare one. */
function guessPaths(baseUrl) {
  const origin = new URL(baseUrl).origin;
  return ['/feed', '/feed.xml', '/rss.xml', '/rss', '/atom.xml', '/index.xml'].map((p) => origin + p);
}

/**
 * A candidate counts as a real feed only if it parses as RSS/Atom with at
 * least one entry — a wrong guess returning a 200 HTML page should not pass.
 * rss.mjs is a CLI script with no exports, so this is a deliberately minimal
 * reimplementation of "is this actually a feed", not a shared parser.
 */
async function validate(feedUrl) {
  try {
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const xml = await res.text();
    const isFeed = /<rss\b/i.test(xml) || /<feed\b/i.test(xml);
    const count = (xml.match(/<item\b/gi) ?? xml.match(/<entry\b/gi) ?? []).length;
    if (!isFeed || count === 0) return null;
    return count;
  } catch {
    return null;
  }
}

try {
  const { text: html, finalUrl } = await fetchText(url);
  const candidates = [...declaredFeeds(html, finalUrl), ...guessPaths(finalUrl)];
  if (!candidates.length) die(`no feed candidates found for ${url}`);

  const checked = [];
  for (const c of [...new Set(candidates)]) {
    const count = await validate(c);
    if (count) checked.push({ url: c, items: count });
  }

  if (!checked.length) die(`found no working feed for ${url} (tried ${candidates.length} candidate(s))`);

  checked.sort((a, b) => b.items - a.items);
  console.log(`# feed(s) found for ${url}\n`);
  for (const c of checked) console.log(`${c.url} (${c.items} items)`);
} catch (err) {
  die(err.message);
}
