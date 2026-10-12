#!/usr/bin/env node
/**
 * HN radar — find interesting Hacker News stories for the blog, then load
 * one fully: article text plus the top comment thread, in a single call.
 *
 * Uses two public APIs:
 *   - Algolia (https://hn.algolia.com/api/v1)  — one request, filterable by points/date/keyword
 *   - Firebase official API (hacker-news.firebaseio.com/v0) — individual items and comment trees
 * Article text comes from Jina's reader (r.jina.ai) — same keyless approach
 * as the web-research skill's read.mjs, reimplemented here rather than
 * imported so this skill stays self-contained.
 *
 * Usage:
 *   node hn.mjs top [--hours 48] [--min-points 30] [--limit 15]   recent high-signal stories
 *   node hn.mjs search <term...> [--days 90] [--limit 15]   keyword search, relevance-ranked
 *   node hn.mjs load <id> [--chars 12000] [--comment-limit 10] [--comment-chars 280]
 *                                                           article + top comments, one call
 *
 * `load` is the point: it always pulls the top comment thread alongside the
 * article, no separate step and no prompt reminder needed — the comments are
 * just part of what loading a story gives you.
 */

const ALGOLIA = 'https://hn.algolia.com/api/v1';
const FIREBASE = 'https://hacker-news.firebaseio.com/v0';
const HN_ITEM = 'https://news.ycombinator.com/item?id=';

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  const numericFlags = ['hours', 'min-points', 'days', 'limit', 'chars', 'comment-limit', 'comment-chars'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const name = a.startsWith('--') ? a.slice(2) : null;
    if (name && numericFlags.includes(name)) {
      flags[name] = Number(argv[++i]);
      if (!Number.isFinite(flags[name])) die(`flag ${a} needs a number`);
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

/** HN comment/self-text is HTML. Flatten it to readable plain text. */
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
  return out;
}

function formatComments(cs, chars) {
  if (!cs.length) return '(no comments)';
  return cs
    .map((c, i) => {
      const text = htmlToText(c.text);
      const trimmed = text.length > chars ? `${text.slice(0, chars).trimEnd()}…` : text;
      const indented = trimmed.split('\n').map((l) => `   ${l}`).join('\n');
      return `${i + 1}. ${c.by ?? '[deleted]'}${c.kids?.length ? ` (+${c.kids.length} replies)` : ''}\n${indented}`;
    })
    .join('\n\n');
}

/** Jina's reader, keyless by default — same approach as web-research/read.mjs. */
async function readArticle(url, chars) {
  const fetchPage = (headers) => fetch(`https://r.jina.ai/${url}`, { headers, signal: AbortSignal.timeout(45000) });
  const key = process.env.JINA_API_KEY;
  let res = await fetchPage(key ? { Authorization: `Bearer ${key}` } : {});
  if (!res.ok && key) res = await fetchPage({}); // a bad/expired key degrades to keyless, doesn't fail the read
  if (!res.ok) throw new Error(`reader returned HTTP ${res.status} for ${url}`);
  let text = (await res.text()).trim();
  if (!text) throw new Error(`reader returned nothing for ${url}`);
  if (text.length > chars) text = `${text.slice(0, chars).trimEnd()}\n\n[truncated at ${chars} chars]`;
  return text;
}

function line(i, title, url, score, comments, id) {
  return `${i}. ${title} — ${score} pts · ${comments ?? '?'} comments\n   ${url}\n   HN: ${HN_ITEM}${id}`;
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

/**
 * Article text (from the story's link, or the self-post's own text if it has
 * no external link) plus the top comment thread. One call, always both — the
 * point of `load` is that nothing has to separately remember to check the
 * comments.
 */
async function load(id, { chars = 12000, commentLimit = 10, commentChars = 280 }) {
  const [story, comments] = await Promise.all([
    getJSON(`${FIREBASE}/item/${id}.json`),
    fetchComments(id, commentLimit),
  ]);
  if (!story) throw new Error(`no HN item ${id}`);

  const header = `${story.title} — ${story.score ?? '?'} pts · ${story.descendants ?? 0} comments\n${story.url || `${HN_ITEM}${story.id}`}\nHN: ${HN_ITEM}${story.id}`;

  let article;
  if (story.url) {
    article = await readArticle(story.url, chars).catch(
      (err) => `(could not load the article: ${err.message})`,
    );
  } else if (story.text) {
    article = htmlToText(story.text); // self-post (Ask HN / Show HN with no link): its own text is the article
  } else {
    article = '(no external link and no self-text — comments may be the whole story)';
  }

  return `${header}\n\n## Article\n\n${article}\n\n## Top comments\n\n${formatComments(comments, commentChars)}`;
}

const { flags, positional } = parseArgs(process.argv.slice(2));
const [cmd, ...rest] = positional;

try {
  switch (cmd) {
    case 'top':
      console.log(await top({ hours: flags.hours ?? 48, minPoints: flags['min-points'] ?? 30 }, flags.limit ?? 15));
      break;
    case 'search': {
      const term = rest.join(' ');
      if (!term) die('search needs a term');
      console.log(await search(term, { days: flags.days ?? 90 }, flags.limit ?? 15));
      break;
    }
    case 'load': {
      const id = rest[0];
      if (!/^\d+$/.test(id ?? '')) die('load needs a numeric story id (the id in the HN: link)');
      console.log(
        await load(id, {
          chars: flags.chars ?? 12000,
          commentLimit: flags['comment-limit'] ?? 10,
          commentChars: flags['comment-chars'] ?? 280,
        }),
      );
      break;
    }
    default:
      die(`unknown command '${cmd}' — use top | search | load`);
  }
} catch (err) {
  die(err.message);
}
