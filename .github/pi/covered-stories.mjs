#!/usr/bin/env node
/**
 * Stories an open pull request already covers, for the scheduled draft job.
 *
 * draft-post.yml checks out master, so the agent can see published posts and
 * cannot see a draft that is still an open PR. The branch name
 * (`post/<date>-<run id>`) and the PR title (`Draft post <date>`) identify
 * the run. The story is the `posts/*.md` file that PR adds, and the URLs
 * that file cites: the article, the HN item, the issue. Two drafts of one
 * piece had different slugs; the shared URL is what lines them up.
 *
 *   node covered-stories.mjs
 *       Brief for the draft prompt. Zero open PRs is a normal, successful
 *       result: the brief says nothing is waiting.
 *   node covered-stories.mjs check <post.md>...
 *       Exit 2 when a file shares a story URL, path, or slug with an open
 *       PR. Exit 1 when open PRs could not be listed or read. Exit 0 when
 *       the files are clear.
 *   node covered-stories.mjs --prs <file>
 *       Same commands, from a JSON file instead of `gh`:
 *       [{ "number": 16, "title": "...", "posts": [{ "path": "posts/a.md", "body": "..." }] }]
 *       A PR with an empty `posts` array covers nothing. An empty array
 *       covers nothing.
 *   node covered-stories.mjs --pr <number>
 *       Dry run against that PR (repeatable) instead of the open list.
 *       Merged and closed PRs work here, so a past duplicate can be replayed.
 *   node covered-stories.mjs --self-check
 *
 * Listing uses `gh pr list` / `gh pr view` (pull-requests permission).
 * Reading a post uses the contents API on the PR's head branch (contents
 * permission). draft-post.yml grants both as write, which includes read.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const URL_RE = /https?:\/\/[^\s<>\]"'`]+/gi;
const SOCIAL_HOSTS = new Set(['twitter.com', 'x.com', 't.co', 'youtube.com', 'youtu.be']);
const GITHUB_STORY = new Set(['issues', 'pull', 'discussions', 'commit']);

function die(msg) {
  console.error(`covered-stories: ${msg}`);
  process.exit(1);
}

function log(msg) {
  process.stderr.write(`covered-stories: ${msg}\n`);
}

function gh(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    const stdout = err.stdout ? String(err.stdout).trim() : '';
    throw new Error(stderr || stdout || err.message);
  }
}

function repoPath(p) {
  return String(p).replace(/^\.\//, '').replace(/\\/g, '/');
}

function frontmatter(md) {
  const m = String(md).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { title: '', slug: '' };
  const field = (name) => {
    const hit = m[1].match(new RegExp(`^${name}:\\s*(.*)$`, 'm'));
    return hit ? hit[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  return { title: field('title'), slug: field('slug') };
}

/** A URL that identifies a story, or null when it is too generic to match on. */
function normalizeUrl(raw) {
  let s = String(raw).trim().replace(/[),.;:]+$/g, '');
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (SOCIAL_HOSTS.has(host)) return null;

  if (host === 'news.ycombinator.com') {
    const id = u.searchParams.get('id');
    const path = u.pathname.replace(/\/+$/, '');
    if (path !== '/item' || !/^\d+$/.test(id ?? '')) return null;
    return `https://news.ycombinator.com/item?id=${id}`;
  }

  for (const key of [...u.searchParams.keys()]) {
    if (/^utm_/i.test(key) || key === 'fbclid' || key === 'gclid' || key === 'mc_cid' || key === 'mc_eid') {
      u.searchParams.delete(key);
    }
  }
  const params = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(params).toString();
  const path = u.pathname.replace(/\/+$/, '');
  if (!path) return null;

  if (host === 'github.com' || host === 'gist.github.com') {
    const parts = path.split('/').filter(Boolean);
    const orgsDiscussion = parts[0] === 'orgs' && parts[2] === 'discussions' && parts[3];
    const storyPath = parts.length >= 4 && GITHUB_STORY.has(parts[2]);
    const blob = parts.length >= 5 && parts[2] === 'blob';
    if (!orgsDiscussion && !storyPath && !blob) return null;
  }

  return `https://${host}${path}${query ? `?${query}` : ''}`;
}

function storyUrls(md) {
  const out = [];
  const seen = new Set();
  for (const raw of String(md).match(URL_RE) ?? []) {
    const url = normalizeUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function identity(md, path) {
  const { title, slug } = frontmatter(md);
  const keys = new Set(storyUrls(md));
  const rel = path ? repoPath(path) : '';
  if (rel) keys.add(`path:${rel}`);
  if (slug) keys.add(`slug:${slug}`);
  if (rel) {
    const stem = rel.replace(/^.*\//, '').replace(/\.md$/, '');
    if (stem) keys.add(`slug:${stem}`);
  }
  return { title, keys };
}

function findOverlap(filePath, body, stories) {
  const local = identity(body, filePath);
  for (const story of stories) {
    const other = identity(story.body, story.path);
    const shared = [...local.keys].filter((k) => other.keys.has(k));
    if (shared.length) return { pr: story.pr, path: story.path, title: other.title, shared };
  }
  return null;
}

function describeKey(key) {
  if (key.startsWith('path:')) return `the same path ${key.slice(5)}`;
  if (key.startsWith('slug:')) return `the same slug ${key.slice(5)}`;
  return key;
}

function formatHit(file, hit) {
  const shown = hit.shared.slice(0, 3).map(describeKey);
  const extra = hit.shared.length > 3 ? ` (+${hit.shared.length - 3} more)` : '';
  return `covered-stories: ${repoPath(file)} overlaps PR #${hit.pr} ${hit.path} via ${shown.join(', ')}${extra}`;
}

function formatBrief(stories) {
  if (!stories.length) {
    return [
      '## Already covered by an open pull request',
      '',
      'Nothing is waiting in an open pull request. Published posts in `posts/` are the only stories already taken.',
      '',
    ].join('\n');
  }
  const lines = [
    '## Already covered by an open pull request',
    '',
    'These stories already have a draft in an open pull request. Skip them, the same way you skip a file already in `posts/`. The same article, HN item, or bug counts even when the title would be different.',
    '',
  ];
  for (const story of stories) {
    const { title } = frontmatter(story.body);
    const heading = title ? `${story.path} — ${title}` : story.path;
    lines.push(`- PR #${story.pr}, \`${heading}\``);
    const urls = storyUrls(story.body);
    const shown = urls.slice(0, 20);
    for (const url of shown) lines.push(`  - ${url}`);
    if (urls.length > shown.length) {
      lines.push(`  - ${urls.length - shown.length} further URLs omitted from this list; the pre-PR check still matches on them`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function storiesFromData(data) {
  if (!Array.isArray(data)) throw new Error('--prs file must be a JSON array');
  const stories = [];
  for (const pr of data) {
    for (const post of pr.posts ?? []) {
      if (!post.path || !String(post.path).endsWith('.md')) continue;
      stories.push({
        pr: pr.number,
        path: repoPath(post.path),
        body: post.body ?? '',
      });
    }
  }
  return stories;
}

function storiesFromMock(file) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`could not read ${file}: ${err.message}`);
  }
  try {
    return storiesFromData(JSON.parse(raw));
  } catch (err) {
    throw new Error(`could not parse ${file}: ${err.message}`);
  }
}

function asMarkdown(raw) {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('{')) return raw;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (data.message && !data.content) throw new Error(data.message);
  if (data.encoding === 'base64' && data.content) return Buffer.from(data.content, 'base64').toString('utf8');
  return raw;
}

function addedPosts(pr) {
  return (pr.files ?? []).filter((f) => {
    if (!f.path?.startsWith('posts/') || !f.path.endsWith('.md')) return false;
    const type = String(f.changeType ?? 'ADDED').toUpperCase();
    return type !== 'MODIFIED' && type !== 'DELETED' && type !== 'REMOVED';
  });
}

function readPrFile(repo, ref, filePath) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const raw = gh([
    'api',
    '-H',
    'Accept: application/vnd.github.raw',
    `/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
  ]);
  return asMarkdown(raw);
}

function storiesFromPr(pr, repo) {
  const stories = [];
  for (const file of addedPosts(pr)) {
    let body;
    try {
      body = readPrFile(repo, pr.headRefName, file.path);
    } catch (err) {
      throw new Error(`could not read ${file.path} from PR #${pr.number} (${pr.headRefName}): ${err.message}`);
    }
    stories.push({ pr: pr.number, path: file.path, body });
  }
  return stories;
}

function loadOpen() {
  const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();
  const prs = JSON.parse(gh([
    'pr', 'list', '--state', 'open', '--limit', '100',
    '--json', 'number,title,headRefName,files',
  ]));
  if (!Array.isArray(prs)) throw new Error('gh pr list did not return a list');
  if (prs.length === 100) {
    throw new Error('100 open pull requests — refusing to guess past the page cap');
  }
  log(`${prs.length} open pull request${prs.length === 1 ? '' : 's'}`);
  const stories = prs.flatMap((pr) => storiesFromPr(pr, repo));
  if (prs.length && !stories.length) log('none of them add a post');
  return stories;
}

function loadPrNumbers(numbers) {
  const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();
  const stories = [];
  for (const number of numbers) {
    log(`dry run against PR #${number}`);
    const pr = JSON.parse(gh([
      'pr', 'view', String(number),
      '--json', 'number,title,state,headRefName,files',
    ]));
    stories.push(...storiesFromPr(pr, repo));
  }
  return stories;
}

function parseArgs(argv) {
  let mode = 'brief';
  const check = [];
  const prNumbers = [];
  let prs = null;
  let selfCheck = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-check') selfCheck = true;
    else if (a === '--prs') {
      prs = argv[++i];
      if (!prs || prs.startsWith('--')) die('--prs needs a file');
    } else if (a === '--pr') {
      const n = argv[++i];
      if (!/^\d+$/.test(n ?? '')) die('--pr needs a pull request number');
      prNumbers.push(n);
    } else if (a === 'check') mode = 'check';
    else if (a.startsWith('--')) die(`unknown flag ${a}`);
    else if (mode === 'check') check.push(a);
    else die(`unknown argument ${a}`);
  }
  if (selfCheck && (prs || prNumbers.length || check.length)) die('--self-check stands alone');
  if (mode === 'check' && !check.length) die('check needs at least one post path');
  if (prs && prNumbers.length) die('pass --prs or --pr, not both');
  return { mode, check, prNumbers, prs, selfCheck };
}

function selfCheck() {
  const failures = [];
  const eq = (actual, expected, label) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) failures.push(`${label}\n  got  ${a}\n  want ${e}`);
  };

  eq(
    normalizeUrl('https://shnatsel.github.io/implementing-fma-finding-bugs-in-std/?utm_source=hn'),
    'https://shnatsel.github.io/implementing-fma-finding-bugs-in-std',
    'strip utm and trailing slash',
  );
  eq(
    normalizeUrl('http://www.news.ycombinator.com/item?id=12345&utm_source=twitter'),
    'https://news.ycombinator.com/item?id=12345',
    'canonical HN item',
  );
  eq(normalizeUrl('https://news.ycombinator.com/'), null, 'HN front page is not a story');
  eq(normalizeUrl('https://github.com/openai/codex'), null, 'github repo root is not a story');
  eq(
    normalizeUrl('https://github.com/openai/codex/issues/48195'),
    'https://github.com/openai/codex/issues/48195',
    'github issue is a story',
  );
  eq(
    normalizeUrl('https://github.com/orgs/Homebrew/discussions/6895'),
    'https://github.com/orgs/Homebrew/discussions/6895',
    'github org discussion is a story',
  );
  eq(normalizeUrl('https://github.com/git/git/tree/master'), null, 'github tree URL is not a story');

  const open = [{
    number: 16,
    title: 'Draft post 2026-10-19',
    posts: [{
      path: 'posts/musl-fmaf-fixed-on-master-no-release.md',
      body: [
        '---',
        "title: musl's fmaf bug is fixed on master and in no release",
        'slug: musl-fmaf-fixed-on-master-no-release',
        '---',
        'His [write-up](https://shnatsel.github.io/implementing-fma-finding-bugs-in-std/).',
        'https://github.com/rust-lang/compiler-builtins/issues/1262',
      ].join('\n'),
    }],
  }];
  const stories = storiesFromData(open);
  const dup = [
    '---',
    'title: musl fixed fmaf in git and not in any release',
    'slug: musl-fmaf-fixed-in-git-no-release',
    '---',
    'See https://shnatsel.github.io/implementing-fma-finding-bugs-in-std',
  ].join('\n');
  const hit = findOverlap('posts/musl-fmaf-fixed-in-git-no-release.md', dup, stories);
  eq(hit?.pr, 16, 'shared article URL overlaps');
  eq(
    hit?.shared.includes('https://shnatsel.github.io/implementing-fma-finding-bugs-in-std'),
    true,
    'overlap names the article URL',
  );

  const other = [
    '---',
    'title: Android 17 wcscspn',
    'slug: android-wcscspn-non-latin',
    '---',
    'https://github.com/android/ndk/issues/2260',
    'https://github.com/openai/codex',
  ].join('\n');
  eq(findOverlap('posts/android-wcscspn-non-latin.md', other, stories), null, 'different story does not overlap');

  const sameSlug = '---\ntitle: other\nslug: musl-fmaf-fixed-on-master-no-release\n---\nNo links.\n';
  eq(findOverlap('posts/renamed.md', sameSlug, stories)?.pr, 16, 'same slug overlaps');

  const samePath = '---\ntitle: other\nslug: something-else\n---\nNo links.\n';
  eq(
    findOverlap('posts/musl-fmaf-fixed-on-master-no-release.md', samePath, stories)?.pr,
    16,
    'same path overlaps',
  );

  eq(findOverlap('posts/android-wcscspn-non-latin.md', other, []), null, 'zero stories does not overlap');
  eq(storiesFromData([{ number: 4, title: 'evolve', posts: [] }]).length, 0, 'PR that adds no post covers nothing');

  const emptyBrief = formatBrief([]);
  eq(emptyBrief.includes('Nothing is waiting in an open pull request.'), true, 'empty brief says nothing is waiting');
  const brief = formatBrief(stories);
  eq(brief.includes('PR #16'), true, 'brief names the PR');
  eq(brief.includes('musl-fmaf-fixed-on-master-no-release.md'), true, 'brief names the file');
  eq(brief.includes("musl's fmaf bug is fixed on master and in no release"), true, 'brief names the post title');
  eq(brief.includes('https://shnatsel.github.io/implementing-fma-finding-bugs-in-std'), true, 'brief names a story URL');
  eq(brief.includes('Draft post 2026-10-19'), false, 'brief does not use the run-date PR title as the story');

  const quoted = frontmatter('---\ntitle: "Hello"\nslug: \'hello\'\n---\n');
  eq(quoted, { title: 'Hello', slug: 'hello' }, 'quoted frontmatter');

  if (failures.length) {
    console.error(`covered-stories: self-check failed\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log('covered-stories: self-check ok');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfCheck) {
    selfCheck();
    return;
  }

  let stories;
  try {
    if (args.prs) stories = storiesFromMock(args.prs);
    else if (args.prNumbers.length) stories = loadPrNumbers(args.prNumbers);
    else stories = loadOpen();
  } catch (err) {
    die(err.message);
  }

  if (args.mode === 'check') {
    const hits = [];
    for (const file of args.check) {
      let body;
      try {
        body = readFileSync(file, 'utf8');
      } catch (err) {
        die(`could not read ${file}: ${err.message}`);
      }
      const hit = findOverlap(file, body, stories);
      if (hit) hits.push(formatHit(file, hit));
    }
    if (hits.length) {
      console.log(hits.join('\n'));
      process.exit(2);
    }
    console.log(stories.length
      ? `covered-stories: no overlap with ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'} in open pull requests`
      : 'covered-stories: no open pull request adds a post');
    return;
  }

  process.stdout.write(formatBrief(stories));
}

main();
