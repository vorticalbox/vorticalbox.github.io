#!/usr/bin/env node
/**
 * web-research — keyless web search.
 *
 * The point of this skill is that it works with nothing but network access:
 * no API key, no MCP server. That makes it usable where Fin and Hister are not
 * — a CI runner, a fresh machine, anywhere.
 *
 * The primary route is Jina's reader (r.jina.ai, no key) pointed at
 * DuckDuckGo's Lite endpoint. Scraping DuckDuckGo directly does not work: its
 * HTML endpoint answers scripts with an anti-bot page, and s.jina.ai (the
 * search API) now requires a key. Reading the Lite page through the reader
 * sidesteps both and comes back as clean markdown. Jina's own search API is
 * still used first when JINA_API_KEY is set, since it is the tidiest.
 *
 * Usage:
 *   node search.mjs <query...> [--limit 10]
 */

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') {
      flags.limit = Number(argv[++i]);
      if (!Number.isFinite(flags.limit)) die('flag --limit needs a number');
    } else {
      positional.push(argv[i]);
    }
  }
  return { flags, positional };
}

function die(msg) {
  console.error(`web-research: ${msg}`);
  process.exit(1);
}

async function fetchText(url, headers = {}, ms = 30000) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const clean = (s) => String(s ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

/** DuckDuckGo wraps result links in a redirect; pull the real URL back out. */
function unwrap(url) {
  const m = url.match(/[?&]uddg=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : url;
}

/** Each provider returns [{title, url, snippet}] or throws. Tried in order. */
const providers = [
  {
    name: 'jina',
    async run(q, limit) {
      if (!process.env.JINA_API_KEY) throw new Error('no JINA_API_KEY');
      const body = await fetchText(`https://s.jina.ai/?q=${encodeURIComponent(q)}`, {
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.JINA_API_KEY}`,
      });
      const hits = JSON.parse(body).data.slice(0, limit);
      if (!hits.length) throw new Error('no results');
      return hits.map((d) => ({ title: d.title, url: d.url, snippet: d.description }));
    },
  },
  {
    name: 'ddg-lite (via jina reader)',
    async run(q, limit) {
      const md = await fetchText(`https://r.jina.ai/https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`);
      const lines = md.split('\n');
      const entry = /^\s*\d+\.\s*\[(.+?)\]\((.+?)\)\s*$/;
      const out = [];
      for (let i = 0; i < lines.length && out.length < limit; i++) {
        const m = lines[i].match(entry);
        if (!m) continue;
        // The snippet is the next non-empty line that is not another result.
        let snippet = '';
        for (let j = i + 1; j < lines.length; j++) {
          if (!lines[j].trim()) continue;
          if (entry.test(lines[j])) break;
          snippet = clean(lines[j]);
          break;
        }
        out.push({ title: clean(m[1]), url: unwrap(m[2]), snippet });
      }
      if (!out.length) throw new Error('no results parsed');
      return out;
    },
  },
];

const { flags, positional } = parseArgs(process.argv.slice(2));
const query = positional.join(' ');
if (!query) die('needs a query — search.mjs <query...> [--limit 10]');

const limit = flags.limit ?? 10;
const failures = [];
for (const p of providers) {
  try {
    const hits = await p.run(query, limit);
    if (!hits.length) throw new Error('no results');
    console.log(`# ${hits.length} result(s) via ${p.name} — ${query}\n`);
    for (const [i, h] of hits.entries()) {
      console.log(`${i + 1}. ${h.title}\n   ${h.url}${h.snippet ? `\n   ${h.snippet}` : ''}`);
    }
    process.exit(0);
  } catch (err) {
    failures.push(`${p.name}: ${err.message}`);
  }
}
die(`every provider failed:\n  ${failures.join('\n  ')}`);
