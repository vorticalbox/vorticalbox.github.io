#!/usr/bin/env node
/**
 * HN radar — find interesting Hacker News stories for the blog.
 *
 * Uses two public APIs:
 *   - Algolia (https://hn.algolia.com/api/v1)  — one request, filterable by points/date/keyword
 *   - Firebase official API (hacker-news.firebaseio.com/v0) — HN's actual current ranking
 *
 * Usage:
 *   node hn.mjs front [--limit 15]                          what HN is showing right now
 *   node hn.mjs top [--hours 48] [--min-points 30] [--limit 15]   recent high-signal stories
 *   node hn.mjs search <term...> [--days 90] [--limit 15]   keyword search, relevance-ranked
 *   node hn.mjs comments <id> [--limit 10] [--chars 280]    top comments on a story (id from any of the above)
 */

const ALGOLIA = 'https://hn.algolia.com/api/v1';
const FIREBASE = 'https://hacker-news.firebaseio.com/v0';
const HN_ITEM = 'https://news.ycombinator.com/item?id=';

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--hours' || a === '--min-points' || a === '--days' || a === '--limit' || a === '--chars') {
      flags[a.slice(2)] = Number(argv[++i]);
      if (!Number.isFinite(flags[a.slice(2)])) die(`flag ${a} needs a number`);
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function die(msg) {
  console.error(`hn: ${msg}`);
  process.exit(1);
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

/** HN comment text is HTML. Flatten it to readable plain text. */
function htmlToText(html) {
  return String(html)
    .replace(/<\s*p\s*\/?\s*>/gi, '\n\n')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Fetch up to `limit` comments for a story, walking the kids tree breadth-first. */
async function fetchComments(id, limit) {
  const item = await getJSON(`${FIREBASE}/item/${id}.json`);
  if (!item) throw new Error(`no HN item ${id}`);
  const out = [];
  const queue = [...(item.kids ?? [])];
  while (out.length < limit && queue.length) {
    const cid = queue.shift();
    const c = await getJSON(`${FIREBASE}/item/${cid}.json`).catch(() => null);
    if (!c || c.deleted || c.dead || !c.text) continue;
    out.push(c);
    // breadth-first: after each top-level comment, queue its replies so the
    // thread keeps unspooling until we hit `limit` — no full-tree fetch.
    if (out.length < limit) queue.push(...(c.kids ?? []));
  }
  return { story: item, comments: out };
}

function line(i, title, url, score, comments, id) {
  return `${i}. ${title} — ${score} pts · ${comments ?? '?'} comments\n   ${url}\n   HN: ${HN_ITEM}${id}`;
}

async function front(limit = 15) {
  const ids = await getJSON(`${FIREBASE}/topstories.json`);
  const items = await Promise.all(
    ids.slice(0, limit).map((id) => getJSON(`${FIREBASE}/item/${id}.json`).catch(() => null)),
  );
  return items.filter(Boolean).map((it, i) => line(i + 1, it.title, it.url || `${HN_ITEM}${it.id}`, it.score, it.descendants ?? 0, it.id)).join('\n');
}

async function top({ hours = 48, minPoints = 30 }, limit = 15) {
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  const filters = encodeURIComponent(`points>${minPoints},created_at_i>${since}`);
  const data = await getJSON(`${ALGOLIA}/search?tags=story&numericFilters=${filters}&hitsPerPage=${limit}`);
  return data.hits.map((h, i) => line(i + 1, h.title, h.url || `${HN_ITEM}${h.objectID}`, h.points, h.num_comments ?? 0, h.objectID)).join('\n');
}

async function search(term, { days = 90 }, limit = 15) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const filters = encodeURIComponent(`created_at_i>${since}`);
  const data = await getJSON(`${ALGOLIA}/search?query=${encodeURIComponent(term)}&tags=story&numericFilters=${filters}&hitsPerPage=${limit}`);
  return data.hits.map((h, i) => line(i + 1, h.title, h.url || `${HN_ITEM}${h.objectID}`, h.points, h.num_comments ?? 0, h.objectID)).join('\n');
}

async function comments(id, { limit = 10, chars = 280 }) {
  const { story, comments: cs } = await fetchComments(id, limit);
  const header = `${story.title} — ${story.score} pts · ${story.descendants ?? 0} comments\n   ${story.url || `${HN_ITEM}${story.id}`}\n   HN: ${HN_ITEM}${story.id}`;
  if (!cs.length) return `${header}\n   (no comments)`;
  const body = cs
    .map((c, i) => {
      const text = htmlToText(c.text);
      const trimmed = text.length > chars ? `${text.slice(0, chars).trimEnd()}…` : text;
      const indented = trimmed.split('\n').map((l) => `   ${l}`).join('\n');
      return `\n${i + 1}. ${c.by ?? '[deleted]'}${c.kids?.length ? ` (+${c.kids.length} replies)` : ''}\n${indented}`;
    })
    .join('\n');
  return `${header}\n${body}`;
}

const { flags, positional } = parseArgs(process.argv.slice(2));
const [cmd, ...rest] = positional;

try {
  switch (cmd) {
    case 'front':
      console.log(await front(flags.limit ?? 15));
      break;
    case 'top':
      console.log(await top({ hours: flags.hours ?? 48, minPoints: flags['min-points'] ?? 30 }, flags.limit ?? 15));
      break;
    case 'search': {
      const term = rest.join(' ');
      if (!term) die('search needs a term');
      console.log(await search(term, { days: flags.days ?? 90 }, flags.limit ?? 15));
      break;
    }
    case 'comments': {
      const id = rest[0];
      if (!/^\d+$/.test(id ?? '')) die('comments needs a numeric story id (the id in the HN: link)');
      console.log(await comments(id, { limit: flags.limit ?? 10, chars: flags.chars ?? 280 }));
      break;
    }
    default:
      die(`unknown command '${cmd}' — use front | top | search | comments`);
  }
} catch (err) {
  die(err.message);
}
