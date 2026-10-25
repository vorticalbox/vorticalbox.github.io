#!/usr/bin/env node
/**
 * Mixed shortlist for the scheduled draft job.
 *
 * Hacker News and every feed in feeds.json, round-robin, so the draft does
 * not start from HN and only glance at the feeds. Each item is labelled
 * with its source and a subject. A subject that is sitting out — two or
 * more of the newest posts in a row, the same alias rule as the draft
 * prompt — is held out of the mixture and listed under "Sitting out".
 * A URL already in posts/ or in an open pull request is dropped.
 *
 * One source failing (HN, a feed, or `gh`) is a line in the brief, not a
 * failed run. stdout is the brief. Diagnostics go to stderr.
 *
 *   node .github/pi/shortlist.mjs
 *   node .github/pi/shortlist.mjs --self-check
 */
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FEEDS_PATH = path.join(ROOT, '.agents/skills/rss-radar/feeds.json');
const POSTS_DIR = path.join(ROOT, 'posts');

const CAPS = { perSource: 2, list: 30, held: 8, consider: 12 };
const HN_HOURS = 72;
const POOL = 6;

const LIBC_TAGS = new Set(['glibc', 'musl', 'libc', 'bionic', 'libm']);
const METHOD_TAGS = new Set(['c', 'plain text', 'portability', 'meta', 'experiments', 'reverse-engineering']);
const LIBC_RE = /\b(glibc|musl|bionic|libc|libm|strtod|wcscspn|fmaf|math_errhandling|math_error)\b/i;
const LIBC_SUBJECT = 'C library behaviour';

/** First match wins. Strings are the same ones post tags collapse to. */
const ITEM_SUBJECTS = [
  ['git', /\bgit\b/i],
  ['agents', /\bagents?\b/i],
  ['floating-point', /floating[- ]point|\bsubnormal/i],
  ['time-zones', /time ?zones?|\btzdb\b|\btzdata\b|\btz-announce\b|\btz code\b|daylight saving/i],
  ['dns', /\bdns(?:sec)?\b|\bresolver\b|root key|\bksk\b/i],
  ['tls', /\btls\b|\bcertificate\b|cryptograph/i],
  ['http', /\bhttps?\b|\bcurl\b|\bquic\b|http\/2/i],
  ['databases', /\bsql\b|query plan|\bpostgres\b|\bsqlite\b|\bdatabase\b/i],
  ['compilers', /\bcompiler\b|\bcodegen\b|\bllvm\b|\bjit\b/i],
  ['file-formats', /file format|\bpng\b|\bpdf\b|\btiff\b|\bdeflate\b/i],
  ['hardware', /microcode|datasheet|\bsilicon\b|\b8087\b|\bchip\b/i],
  ['filesystems', /filesystem|file system|\bbtrfs\b|\bext4\b|\bvfs\b/i],
  ['rust', /\brust\b/i],
  ['android', /\bandroid\b/i],
];

function log(msg) {
  process.stderr.write(`shortlist: ${msg}\n`);
}

function oneLine(err) {
  const stderr = err && err.stderr ? String(err.stderr) : '';
  const msg = stderr || (err && err.message) || String(err);
  return msg.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function field(md, name) {
  const fm = String(md).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return '';
  const hit = fm[1].match(new RegExp(`^${name}:\\s*(.*)$`, 'm'));
  return hit ? hit[1].trim().replace(/^["']|["']$/g, '') : '';
}

function tagsOf(md) {
  const fm = String(md).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return [];
  const hit = fm[1].match(/^tags:\s*\[(.*)\]\s*$/m);
  if (!hit) return [];
  return hit[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

function basename(p) {
  return String(p ?? '').split('/').pop();
}

function slugOf(post) {
  return field(post.body, 'slug') || basename(post.path).replace(/\.md$/, '') || post.id;
}

/** The subject the rotation rule sits out. Method tags do not count. */
function postSubject(md) {
  const tags = tagsOf(md);
  const title = field(md, 'title');
  if (tags.some((t) => LIBC_TAGS.has(t.toLowerCase())) || LIBC_RE.test(title)) return LIBC_SUBJECT;
  for (const tag of tags) {
    const t = tag.toLowerCase();
    if (!METHOD_TAGS.has(t)) return t;
  }
  return 'unspecified';
}

function labelSubject(text) {
  if (LIBC_RE.test(text)) return LIBC_SUBJECT;
  for (const [name, re] of ITEM_SUBJECTS) {
    if (re.test(text)) return name;
  }
  return 'unspecified';
}

/** Title first, so a URL or an aside in the summary cannot relabel the item. */
function labelItem(item) {
  const fromTitle = labelSubject(item.title);
  if (fromTitle !== 'unspecified') return fromTitle;
  return labelSubject(String(item.detail ?? '').replace(/https?:\/\/\S+/g, ' '));
}

/**
 * Newest first. An open draft sorts above published posts, which is what
 * the draft prompt means by counting a draft as the newest post. hello-world
 * is the intro and has no story subject.
 */
function streakOf(posts) {
  const rows = posts
    .filter((p) => basename(p.path) !== 'hello-world.md')
    .map((p) => ({ ...p, subject: postSubject(p.body), date: p.date || field(p.body, 'date') }))
    .sort((a, b) => {
      const tier = Number(Boolean(b.draft)) - Number(Boolean(a.draft));
      if (tier) return tier;
      const byDate = String(b.date).localeCompare(String(a.date));
      if (byDate) return byDate;
      return String(b.id).localeCompare(String(a.id));
    });
  if (!rows.length) return null;
  const subject = rows[0].subject;
  if (!subject || subject === 'unspecified') return null;
  let count = 1;
  let endedBy = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].subject === subject) count += 1;
    else {
      endedBy = rows[i];
      break;
    }
  }
  if (count < 2) return null;
  return { subject, count, newest: rows[0], endedBy };
}

function normalizeUrl(raw) {
  let u;
  try {
    u = new URL(String(raw).trim().replace(/[),.;:]+$/g, ''));
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'news.ycombinator.com') {
    const id = u.searchParams.get('id');
    const p = u.pathname.replace(/\/+$/, '');
    if (p === '/item' && /^\d+$/.test(id ?? '')) return `https://news.ycombinator.com/item?id=${id}`;
    return null;
  }
  for (const key of [...u.searchParams.keys()]) {
    if (/^utm_/i.test(key) || key === 'fbclid' || key === 'gclid') u.searchParams.delete(key);
  }
  const params = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(params).toString();
  const p = u.pathname.replace(/\/+$/, '');
  if (!p || p === '/') return null;
  return `https://${host}${p}${query ? `?${query}` : ''}`;
}

function coveredUrls(posts) {
  const out = new Set();
  const re = /https?:\/\/[^\s<>\]"'`]+/gi;
  for (const post of posts) {
    for (const raw of String(post.body).match(re) ?? []) {
      const url = normalizeUrl(raw);
      if (url) out.add(url);
    }
  }
  return out;
}

function interleave(pools, order, cap) {
  const lists = order.map((name) => pools.get(name) ?? []);
  const rounds = Math.max(0, ...lists.map((l) => l.length));
  const out = [];
  for (let r = 0; r < rounds && out.length < cap; r++) {
    for (let s = 0; s < order.length && out.length < cap; s++) {
      const item = lists[s][r];
      if (item) out.push(item);
    }
  }
  return out;
}

/**
 * Fill each source up to `perSource` eligible items, then round-robin.
 * A URL already covered, or already taken by an earlier source, is skipped
 * so the slot falls through to that source's next item.
 */
function buildShortlist({ posts, itemsBySource, sourceOrder, caps }) {
  const streak = streakOf(posts);
  const covered = coveredUrls(posts);
  const seen = new Set();
  const main = new Map();
  const held = new Map();
  let skippedCovered = 0;
  for (const name of sourceOrder) {
    const kept = [];
    const park = [];
    for (const item of itemsBySource.get(name) ?? []) {
      if (!item.title || !item.url) continue;
      const urls = [item.url, item.hn].map(normalizeUrl).filter(Boolean);
      if (!urls.length) continue;
      if (urls.some((u) => covered.has(u))) {
        skippedCovered += 1;
        continue;
      }
      if (urls.some((u) => seen.has(u))) continue;
      const subject = labelItem(item);
      const row = { source: name, title: item.title, url: item.url, hn: item.hn, points: item.points, subject };
      const parking = streak && subject === streak.subject;
      const dest = parking ? park : kept;
      if (dest.length >= caps.perSource) continue;
      for (const u of urls) seen.add(u);
      dest.push(row);
      if (kept.length >= caps.perSource && park.length >= caps.perSource) break;
    }
    main.set(name, kept);
    held.set(name, park);
  }
  return {
    streak,
    skippedCovered,
    main: interleave(main, sourceOrder, caps.list),
    held: interleave(held, sourceOrder, caps.held),
  };
}

function formatItem(n, item) {
  const head = `${n}. [${item.source} · ${item.subject}] ${item.title}`;
  const lines = [item.points == null ? head : `${head} — ${item.points} pts`, `   ${item.url}`];
  if (item.hn && normalizeUrl(item.hn) !== normalizeUrl(item.url)) lines.push(`   ${item.hn}`);
  return lines.join('\n');
}

function formatBrief({ streak, main, held, failures, skippedCovered }) {
  const lines = [
    '## Shortlist',
    '',
    'Hacker News (`hn`) and every feed in `feeds.json`, round-robin in alphabetical source order, two slots each before any source gets another. Position is not rank. Read this first. You may look past it.',
    '',
  ];
  if (streak) {
    const newest = slugOf(streak.newest);
    const ended = streak.endedBy ? ` \`${slugOf(streak.endedBy)}\` is the older post with a different subject.` : '';
    const where = held.length
      ? ' Labelled items are under "Sitting out" below, not in this mixture.'
      : ' Nothing fetched was labelled with it.';
    lines.push(`Sitting out: ${streak.subject} — ${streak.count} in a row, newest \`${newest}\`.${ended}${where} Use one only if nothing here clears the bar.`);
  } else {
    lines.push('Sitting out: none.');
  }
  if (skippedCovered) lines.push(`Left out as already published or in an open pull request: ${skippedCovered}.`);
  if (failures.length) {
    lines.push(`Sources that failed (the rest of the list still stands): ${failures.map((f) => `${f.source} (${f.error})`).join('; ')}.`);
  }
  lines.push('');
  if (!main.length) lines.push('No mixed items. Look past this list.');
  else main.forEach((item, i) => lines.push(formatItem(i + 1, item), ''));
  if (held.length) {
    lines.push('## Sitting out', '');
    held.forEach((item, i) => lines.push(formatItem(i + 1, item), ''));
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

const decode = (s) => String(s ?? '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"')
  .replace(/&#x27;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

const clean = (s) => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function tagText(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? m[1] : '';
}

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
  return blocks.slice(0, CAPS.consider).map((b) => ({
    title: clean(tagText(b, 'title')).slice(0, 160),
    url: clean(isAtom ? atomLink(b) : tagText(b, 'link')),
    detail: clean(tagText(b, isAtom ? 'summary' : 'description')).slice(0, 240),
  })).filter((item) => item.title && item.url);
}

async function fetchText(url, ms = 12000) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(ms),
    headers: {
      'user-agent': 'shortlist/1.0',
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchFeed(url) {
  const xml = await fetchText(url);
  const items = parseFeed(xml);
  if (!items.length) throw new Error('no items parsed');
  return items;
}

async function fetchHn() {
  const since = Math.floor(Date.now() / 1000) - HN_HOURS * 3600;
  const filters = encodeURIComponent(`points>0,created_at_i>${since}`);
  const raw = await fetchText(`https://hn.algolia.com/api/v1/search?tags=story&numericFilters=${filters}&hitsPerPage=30`);
  const data = JSON.parse(raw);
  const hits = Array.isArray(data.hits) ? data.hits : [];
  return hits
    .filter((h) => h && h.title && h.objectID)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, CAPS.consider)
    .map((h) => ({
      title: clean(h.title).slice(0, 160),
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      hn: `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: h.points ?? 0,
    }));
}

async function mapPool(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const idx = next;
      next += 1;
      if (idx >= list.length) return;
      out[idx] = await fn(list[idx]);
    }
  }
  const n = Math.max(1, Math.min(limit, list.length || 1));
  if (!list.length) return out;
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

function gh(args) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function loadOpenDrafts() {
  let prs;
  let repo;
  try {
    repo = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();
    prs = JSON.parse(gh([
      'pr', 'list', '--state', 'open', '--limit', '100',
      '--json', 'number,headRefName,files',
    ]));
  } catch (err) {
    return { drafts: [], error: oneLine(err) };
  }
  if (!Array.isArray(prs)) return { drafts: [], error: 'gh pr list did not return a list' };
  const drafts = [];
  const errors = [];
  for (const pr of prs) {
    const files = (pr.files ?? []).filter((f) => f.path?.startsWith('posts/') && f.path.endsWith('.md'));
    for (const file of files) {
      try {
        const encoded = file.path.split('/').map(encodeURIComponent).join('/');
        const body = gh([
          'api', '-H', 'Accept: application/vnd.github.raw',
          `/repos/${repo}/contents/${encoded}?ref=${encodeURIComponent(pr.headRefName)}`,
        ]);
        drafts.push({
          id: `pr-${pr.number}-${file.path}`,
          path: file.path,
          body,
          draft: true,
          date: field(body, 'date'),
        });
      } catch (err) {
        errors.push(`PR #${pr.number} ${oneLine(err)}`);
      }
    }
  }
  return { drafts, error: errors.join('; ') };
}

async function loadPublished() {
  let names;
  try {
    names = await readdir(POSTS_DIR);
  } catch (err) {
    return { posts: [], error: oneLine(err) };
  }
  const posts = [];
  for (const name of names) {
    if (!name.endsWith('.md')) continue;
    const body = await readFile(path.join(POSTS_DIR, name), 'utf8');
    posts.push({ id: name, path: `posts/${name}`, body, draft: false, date: field(body, 'date') });
  }
  return { posts, error: '' };
}

async function loadFeedList() {
  try {
    const data = JSON.parse(await readFile(FEEDS_PATH, 'utf8'));
    if (!Array.isArray(data)) throw new Error('feeds.json is not a list');
    return { feeds: data.filter((f) => f && f.name && f.url), error: '' };
  } catch (err) {
    return { feeds: [], error: oneLine(err) };
  }
}

function sourceOrder(feeds) {
  return ['hn', ...feeds.map((f) => f.name)].sort((a, b) => a.localeCompare(b));
}

async function run() {
  const { feeds, error: feedError } = await loadFeedList();
  const { posts, error: postError } = await loadPublished();
  const open = loadOpenDrafts();
  const jobs = [
    { name: 'hn', run: fetchHn },
    ...feeds.map((f) => ({ name: f.name, run: () => fetchFeed(f.url) })),
  ];
  const results = await mapPool(jobs, POOL, async (job) => {
    try {
      return { name: job.name, items: await job.run(), error: '' };
    } catch (err) {
      return { name: job.name, items: [], error: oneLine(err) };
    }
  });
  const failures = [];
  if (feedError) failures.push({ source: 'feeds.json', error: feedError });
  if (postError) failures.push({ source: 'posts', error: postError });
  if (open.error) failures.push({ source: 'open-prs', error: open.error });
  for (const r of results) {
    if (r.error) failures.push({ source: r.name, error: r.error });
  }
  const itemsBySource = new Map(results.map((r) => [r.name, r.items]));
  const order = sourceOrder(feeds);
  const built = buildShortlist({
    posts: [...open.drafts, ...posts],
    itemsBySource,
    sourceOrder: order,
    caps: CAPS,
  });
  if (built.streak) log(`sitting out ${built.streak.subject} (${built.streak.count})`);
  else log('no subject sitting out');
  log(`${built.main.length} mixed, ${built.held.length} held back, ${failures.length} source failure(s)`);
  process.stdout.write(formatBrief({ ...built, failures }));
}

function post(pathName, date, tags, title, body = '') {
  const tagLine = tags.length ? `tags: [${tags.join(', ')}]\n` : '';
  return {
    id: pathName,
    path: pathName,
    draft: false,
    date,
    body: `---\ntitle: ${title}\ndate: ${date}\n${tagLine}---\n${body}\n`,
  };
}

async function selfCheck() {
  const failures = [];
  const eq = (actual, expected, label) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) failures.push(`${label}\n  got  ${a}\n  want ${e}`);
  };

  eq(normalizeUrl('https://example.com/a/?utm_source=hn'), 'https://example.com/a', 'strip utm');
  eq(
    normalizeUrl('http://www.news.ycombinator.com/item?id=9&utm_source=t'),
    'https://news.ycombinator.com/item?id=9',
    'canonical HN item',
  );
  eq(normalizeUrl('https://example.com/'), null, 'homepage is not a story url');

  const libc = (name, date) => post(`posts/${name}.md`, date, ['c', 'glibc', 'musl'], name);
  const streak = streakOf([
    libc('math-error-man-page-stale', '2026-10-25'),
    post('posts/musl-fmaf-fixed-on-master-no-release.md', '2026-10-19', ['c', 'musl', 'floating-point', 'rust'], 'fmaf'),
    post('posts/android-wcscspn-non-latin.md', '2026-10-16', ['c', 'libc', 'android'], 'wcscspn'),
    post('posts/codex-daemon-by-default.md', '2026-10-13', ['agents', 'tools'], 'codex'),
    post('posts/strtod-errno-not-portable.md', '2026-10-12', ['c', 'musl'], 'strtod'),
    post('posts/hello-world.md', '2026-10-26', ['libc'], 'intro'),
  ]);
  eq(streak?.subject, LIBC_SUBJECT, 'libc aliases are one subject');
  eq(streak?.count, 3, 'streak stops at the codex post');
  eq(slugOf(streak.newest), 'math-error-man-page-stale', 'newest of the streak');
  eq(slugOf(streak.endedBy), 'codex-daemon-by-default', 'codex breaks the streak');
  eq(streakOf([libc('only-one', '2026-10-01')]), null, 'one post does not sit out');
  eq(
    streakOf([
      post('posts/a.md', '2026-10-02', ['git'], 'git a'),
      post('posts/b.md', '2026-10-01', ['agents'], 'agents b'),
    ]),
    null,
    'two different subjects do not sit out',
  );

  const draftBreaks = streakOf([
    { ...post('posts/draft.md', '2026-10-01', ['git'], 'draft git'), draft: true, id: 'pr-9' },
    libc('math-error-man-page-stale', '2026-10-25'),
    libc('older', '2026-10-19'),
  ]);
  eq(draftBreaks, null, 'a newer open draft on another subject ends the streak');

  eq(postSubject(post('posts/fp.md', '2026-10-01', ['floating-point'], 'subnormals').body), 'floating-point', 'fp without a libc tag is its own subject');
  eq(labelSubject('Inside the Intel 8087 chip: floating-point addition'), 'floating-point', '8087 post is not the C library');
  eq(labelSubject('glibc strtod sets errno'), LIBC_SUBJECT, 'glibc headline is the C library');
  eq(labelSubject('[tz-announce] 2026e release of tz code and data available'), 'time-zones', 'tz release titles label as time zones');
  eq(labelItem({ title: 'an inaccurate man page', detail: 'glibc and musl disagree' }), LIBC_SUBJECT, 'detail supplies a libc subject the title lacks');
  eq(labelItem({ title: 'Inside the Intel 8087 chip', detail: 'compared with glibc libm' }), 'hardware', 'title wins over a libc aside');

  const posts = [
    libc('math-error-man-page-stale', '2026-10-25'),
    libc('musl-fmaf-fixed-on-master-no-release', '2026-10-19'),
    post('posts/seen.md', '2026-10-01', ['git'], 'seen', 'Already wrote https://example.com/seen?utm_source=hn'),
  ];
  const itemsBySource = new Map([
    ['hn', [
      { title: 'A git note', url: 'https://example.com/git', hn: 'https://news.ycombinator.com/item?id=1', points: 10 },
      { title: 'Already written', url: 'https://example.com/seen', hn: 'https://news.ycombinator.com/item?id=2', points: 99 },
      { title: 'Second git', url: 'https://example.com/git-2', points: 4 },
    ]],
    ['sebsite', [
      { title: 'glibc strtod sets errno', url: 'https://sebsite.pw/a' },
      { title: 'musl fmaf is wrong', url: 'https://sebsite.pw/b' },
    ]],
    ['shirriff', [
      { title: 'Inside the Intel 8087 chip', url: 'https://www.righto.com/8087' },
      { title: 'A second chip', url: 'https://www.righto.com/chip-2' },
    ]],
  ]);
  const order = ['hn', 'sebsite', 'shirriff'];
  const built = buildShortlist({ posts, itemsBySource, sourceOrder: order, caps: CAPS });
  eq(built.main.map((i) => i.source), ['hn', 'shirriff', 'hn', 'shirriff'], 'round-robin skips a source whose items all sat out');
  eq(built.main.some((i) => i.url.includes('seen')), false, 'published url is dropped');
  eq(built.skippedCovered, 1, 'covered count');
  eq(built.held.map((i) => i.source), ['sebsite', 'sebsite'], 'libc items are held back, still interleaved by source');
  eq(built.main.some((i) => i.subject === LIBC_SUBJECT), false, 'mixture has no sitting-out subject');
  eq(built.main[0].url.includes('git') && built.main[0].points === 10, true, 'covered HN story does not consume the slot');

  const wide = buildShortlist({
    posts: [],
    itemsBySource: new Map(Array.from({ length: 20 }, (_, n) => [
      `s${String(n).padStart(2, '0')}`,
      [{ title: `t${n}a`, url: `https://example.com/${n}/a` }, { title: `t${n}b`, url: `https://example.com/${n}/b` }],
    ])),
    sourceOrder: Array.from({ length: 20 }, (_, n) => `s${String(n).padStart(2, '0')}`),
    caps: CAPS,
  });
  eq(wide.main.length, CAPS.list, 'list stays capped');
  eq(new Set(wide.main.slice(0, 20).map((i) => i.source)).size, 20, 'every source gets a slot before any gets a second');

  const isolated = await mapPool([
    { name: 'hn', run: async () => { throw new Error('HTTP 503 from algolia'); } },
    { name: 'shirriff', run: async () => [{ title: '8087', url: 'https://www.righto.com/a' }] },
  ], 2, async (job) => {
    try {
      return { name: job.name, items: await job.run(), error: '' };
    } catch (err) {
      return { name: job.name, items: [], error: oneLine(err) };
    }
  });
  eq(isolated[0].error.includes('503'), true, 'HN failure is recorded');
  eq(isolated[1].items.length, 1, 'a later source still returns items');
  const brief = formatBrief({
    streak: built.streak,
    main: built.main,
    held: built.held,
    skippedCovered: built.skippedCovered,
    failures: [{ source: 'hn', error: 'HTTP 503' }],
  });
  eq(brief.includes('## Shortlist'), true, 'brief has a heading');
  eq(brief.includes('[shirriff · hardware]'), true, 'item is labelled with source and subject');
  eq(brief.includes('## Sitting out'), true, 'held items are marked, not mixed');
  eq(brief.indexOf('## Sitting out') > brief.indexOf('[shirriff · hardware]'), true, 'mixture comes before the held list');
  eq(brief.includes('HTTP 503'), true, 'a failed source is named');
  eq(brief.split('\n').length < 80, true, 'a normal brief stays short');

  const rss = parseFeed(`<?xml version="1.0"?><rss version="2.0"><channel>
    <item><title><![CDATA[Git packfiles &amp; thin packs]]></title><link>https://example.com/git</link><description>pack</description></item>
    </channel></rss>`);
  eq(rss[0].title, 'Git packfiles & thin packs', 'rss title decodes entities');
  eq(labelSubject(rss[0].title), 'git', 'decoded title still labels');

  if (failures.length) {
    console.error(`shortlist: self-check failed\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log('shortlist: self-check ok');
}

if (process.argv.includes('--self-check')) {
  selfCheck();
} else if (process.argv.length > 2) {
  console.error('shortlist: unknown argument — use --self-check or no arguments');
  process.exit(1);
} else {
  run().catch((err) => {
    console.error(`shortlist: ${oneLine(err)}`);
    process.exit(1);
  });
}
