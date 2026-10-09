#!/usr/bin/env node
/**
 * web-research — read a page as clean text.
 *
 * Jina's reader (r.jina.ai) renders a URL to markdown with no key needed. It
 * strips navigation and scripts, so what comes back is the article. Note that
 * it rejects requests that look like a browser (a Chrome User-Agent plus
 * `Accept: text/plain` returns 403), so this sends the plain default headers
 * and only adds an Authorization header when JINA_API_KEY is set.
 *
 * Usage:
 *   node read.mjs <url> [--chars 20000]
 */

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--chars') {
      flags.chars = Number(argv[++i]);
      if (!Number.isFinite(flags.chars)) die('flag --chars needs a number');
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

const { flags, positional } = parseArgs(process.argv.slice(2));
const url = positional[0];
if (!/^https?:\/\//.test(url ?? '')) die('needs an http(s) URL — read.mjs <url> [--chars 20000]');

const headers = {};
if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;

try {
  const res = await fetch(`https://r.jina.ai/${url}`, { headers, signal: AbortSignal.timeout(45000) });
  if (!res.ok) die(`reader returned HTTP ${res.status}`);
  let text = (await res.text()).trim();
  const max = flags.chars ?? 20000;
  if (text.length > max) text = `${text.slice(0, max)}\n\n[truncated at ${max} chars]`;
  if (!text) die('reader returned nothing');
  console.log(text);
} catch (err) {
  die(err.message);
}
