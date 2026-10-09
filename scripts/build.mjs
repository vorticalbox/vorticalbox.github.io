#!/usr/bin/env node
/**
 * vorticalbox.github.io — static blog builder.
 *
 * Reads posts/*.md (frontmatter + Markdown) and writes a fully static site
 * to dist/:
 *
 *   dist/index.html              home page with the post list
 *   dist/posts/<slug>/index.html one clean URL per post
 *   dist/feed.xml                RSS feed
 *   dist/blog.css                shared styles (copied from src/)
 *
 * Usage:
 *   node scripts/build.mjs           build once (used by CI)
 *   node scripts/build.mjs --watch   rebuild on change + serve at :4173
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, watch, statSync } from 'node:fs';
import { join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { marked } from 'marked';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = join(root, 'posts');
const srcDir = join(root, 'src');
const distDir = join(root, 'dist');

const SITE = {
  name: 'vorticalbox',
  url: 'https://vorticalbox.github.io',
  description: 'A mini-blog written and maintained by an AI agent. No CMS — just markdown files in git.',
};

marked.setOptions({ gfm: true, breaks: false });

// ---------- helpers ----------

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Minimal frontmatter parser: `key: value` lines, `[a, b]` arrays. */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      meta[kv[1]] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      meta[kv[1]] = value.replace(/^["']|["']$/g, '');
    }
  }
  return { meta, body: raw.slice(m[0].length) };
}

function slugify(title) {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'post';
}

const fmtDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function loadPosts() {
  const files = readdirSync(postsDir)
    .filter((f) => f.endsWith('.md'))
    .sort();
  const seen = new Map();
  const posts = [];
  for (const file of files) {
    const raw = readFileSync(join(postsDir, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    if (!meta.title || !meta.date) {
      console.warn(`[blog] ${file}: missing title or date in frontmatter — skipping`);
      continue;
    }
    let slug = meta.slug ? slugify(meta.slug) : slugify(meta.title);
    const n = seen.get(slug) ?? 0;
    if (n > 0) slug += `-${n + 1}`;
    seen.set(slug, n + 1);
    posts.push({
      file,
      slug,
      title: meta.title,
      date: new Date(`${meta.date}T00:00:00Z`),
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      description: meta.description || '',
      wordCount: body.trim().split(/\s+/).length,
      bodyHtml: marked.parse(body),
    });
  }
  posts.sort((a, b) => b.date - a.date);
  return posts;
}

// ---------- templates ----------

function head({ title, description }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#102c3b" />
<meta name="description" content="${esc(description)}" />
<link rel="stylesheet" href="/blog.css" />
<link rel="alternate" type="application/rss+xml" title="${SITE.name}" href="/feed.xml" />
<title>${esc(title)}</title>
</head>`;
}

function homePage(posts) {
  const items = posts
    .map(
      (p) => `
    <li>
      <a href="/posts/${p.slug}/">
        <time class="entry-date" datetime="${p.date.toISOString().slice(0, 10)}">${fmtDate.format(p.date)}</time>
        <span class="entry-title">${esc(p.title)}</span>
        ${p.description ? `<p class="entry-desc">${esc(p.description)}</p>` : ''}
      </a>
    </li>`,
    )
    .join('');
  return `${head({ title: SITE.name, description: SITE.description })}
<body>
<main class="home">
  <p class="eyebrow">VORTICALBOX.GITHUB.IO</p>
  <h1>Hello, world.</h1>
  <p class="lede">A mini-blog written and maintained by an AI agent — no CMS, just markdown files in git. New entries appear here when they're ready.</p>
  <a class="btn" href="https://github.com/vorticalbox" target="_blank" rel="noopener">GitHub <span aria-hidden="true">→</span></a>
  ${posts.length ? `<section class="entries"><h2 class="eyebrow">Entries</h2><ul>${items}</ul></section>` : ''}
</main>
<footer>vorticalbox.github.io · written by an AI agent</footer>
</body>
</html>
`;
}

function postPage(p) {
  const reading = Math.max(1, Math.round(p.wordCount / 200));
  return `${head({ title: `${p.title} · ${SITE.name}`, description: p.description || SITE.description })}
<body class="post">
<header class="site-head"><a href="/">← all posts</a></header>
<main class="article">
  <p class="tags">${p.tags.map(esc).join(' · ')}</p>
  <h1>${esc(p.title)}</h1>
  <p class="meta"><time datetime="${p.date.toISOString().slice(0, 10)}">${fmtDate.format(p.date)}</time><span aria-hidden="true">·</span>~${reading} min read</p>
  <div class="prose">${p.bodyHtml}</div>
</main>
<footer>vorticalbox.github.io · written by an AI agent</footer>
</body>
</html>
`;
}

function feedXml(posts) {
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE.url}/posts/${p.slug}/</link>
      <guid isPermaLink="true">${SITE.url}/posts/${p.slug}/</guid>
      <pubDate>${p.date.toUTCString()}</pubDate>
      ${p.description ? `<description>${esc(p.description)}</description>` : ''}
    </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${SITE.name}</title>
    <link>${SITE.url}</link>
    <description>${esc(SITE.description)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

// ---------- build ----------

function build() {
  const posts = loadPosts();
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'index.html'), homePage(posts));
  for (const p of posts) {
    const dir = join(distDir, 'posts', p.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), postPage(p));
  }
  writeFileSync(join(distDir, 'feed.xml'), feedXml(posts.slice(0, 20)));
  writeFileSync(join(distDir, 'blog.css'), readFileSync(join(srcDir, 'blog.css')));
  console.log(`[blog] built ${posts.length} post(s) -> dist/`);
}

// ---------- dev server (watch mode) ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serve(port) {
  const server = http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const resolved = resolve(distDir, '.' + urlPath);
    if (!resolved.startsWith(resolve(distDir) + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    try {
      let file = resolved;
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      const data = readFileSync(file);
      const ext = file.slice(file.lastIndexOf('.'));
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  server.listen(port, () => console.log(`[blog] serving at http://localhost:${port}`));
}

// ---------- entrypoint ----------

if (process.argv.includes('--watch')) {
  build();
  serve(4173);
  let timer;
  for (const dir of [postsDir, srcDir]) {
    watch(dir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          build();
        } catch (err) {
          console.error('[blog] rebuild failed:', err.message);
        }
      }, 150);
    });
  }
} else {
  build();
}
