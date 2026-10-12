#!/usr/bin/env node
/**
 * RSS radar — another idea source alongside HN.
 *
 * Keyless, no dependency: fetches a feed and pulls out title/link/date/
 * description with regex rather than pulling in an XML parser for a shape
 * this simple. Handles RSS 2.0 <item> and Atom <entry> — the two this skill
 * has actually been pointed at. If a feed needs more than that, extend the
 * extractor rather than reach for a library.
 *
 * Feeds this agent already knows about live in feeds.json, by short name.
 * Add a feed by appending {"name", "url", "note"} there, not by editing this
 * script.
 *
 * Usage:
 *   node rss.mjs list                                 configured feeds
 *   node rss.mjs fetch <name> [--limit 15]             a configured feed
 *   node rss.mjs fetch --url <url> [--limit 15]        any feed, ad hoc
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FEEDS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'feeds.json');

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') {
      flags.limit = Number(argv[++i]);
      if (!Number.isFinite(flags.limit)) die('flag --limit needs a number');
    } else if (a === '--url') {
      flags.url = argv[++i];
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function die(msg) {
  console.error(`rss: ${msg}`);
  process.exit(1);
}

async function loadFeeds() {
  try {
    return JSON.parse(await readFile(FEEDS_PATH, 'utf8'));
  } catch (err) {
    die(`couldn't read feeds.json: ${err.message}`);
  }
}

const decodeEntities = (s) =>
  String(s ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const clean = (s) =>
  decodeEntities(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Pull the first capture of `tag` out of a block, CDATA-aware. */
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? m[1] : '';
}

/** Atom <link href="..."/> is self-closing with no text content. */
function atomLink(block) {
  const rel = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (rel) return rel[1];
  const any = block.match(/<link\b[^>]*href=["']([^"']+)["']/i);
  return any ? any[1] : '';
}

function parseFeed(xml) {
  const isAtom = /<feed\b/i.test(xml) && !/<rss\b/i.test(xml);
  const entryTag = isAtom ? 'entry' : 'item';
  const blocks = xml.match(new RegExp(`<${entryTag}[\\s\\S]*?<\\/${entryTag}>`, 'gi')) ?? [];
  return blocks.map((b) => ({
    title: clean(tag(b, 'title')),
    link: isAtom ? atomLink(b) : clean(tag(b, 'link')),
    date: clean(tag(b, isAtom ? 'updated' : 'pubDate')),
    description: clean(tag(b, isAtom ? 'summary' : 'description')),
  }));
}

async function fetchFeed(url, limit) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const items = parseFeed(await res.text());
  if (!items.length) throw new Error(`no items parsed from ${url} — feed shape may not be RSS 2.0 or Atom`);
  return items.slice(0, limit);
}

function format(items) {
  return items
    .map((it, i) => {
      const desc = it.description.length > 240 ? `${it.description.slice(0, 240).trimEnd()}…` : it.description;
      return `${i + 1}. ${it.title}${it.date ? ` — ${it.date}` : ''}\n   ${it.link}${desc ? `\n   ${desc}` : ''}`;
    })
    .join('\n');
}

const { flags, positional } = parseArgs(process.argv.slice(2));
const [cmd, ...rest] = positional;

try {
  switch (cmd) {
    case 'list': {
      const feeds = await loadFeeds();
      if (!feeds.length) die('no feeds configured in feeds.json');
      console.log(feeds.map((f) => `${f.name} — ${f.url}${f.note ? `\n   ${f.note}` : ''}`).join('\n'));
      break;
    }
    case 'fetch': {
      let url = flags.url;
      if (!url) {
        const name = rest[0];
        if (!name) die('fetch needs a configured feed name or --url <url>');
        const feeds = await loadFeeds();
        const found = feeds.find((f) => f.name === name);
        if (!found) die(`no feed named '${name}' in feeds.json — run 'list' to see configured feeds`);
        url = found.url;
      }
      console.log(format(await fetchFeed(url, flags.limit ?? 15)));
      break;
    }
    default:
      die(`unknown command '${cmd}' — use list | fetch`);
  }
} catch (err) {
  die(err.message);
}
