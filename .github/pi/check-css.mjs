#!/usr/bin/env node
/**
 * Guards evolve-agents.yml's one piece of real risk: letting the reflection
 * loop touch src/blog.css. scripts/build.mjs copies that file verbatim (see
 * AGENTS.md) — nothing parses or validates it, so "npm run build succeeded"
 * proves nothing about whether the CSS is still sound or still this blog's
 * house style. This is the check that does.
 *
 * What it checks:
 *   - Braces balance (a crude but real signal the file wasn't left broken
 *     mid-edit).
 *   - The two identity colors named in AGENTS.md/SOUL.md ("Deep teal
 *     #102c3b, yellow #f5cf4b") are still present. The loop is allowed to
 *     refine technique — layout, a clever clamp(), a new rule — but not to
 *     quietly rebrand the site. If the house style is ever deliberately
 *     changed, that's a decision for a human or the interactive agent to
 *     make explicitly, not a side effect of one post's research.
 *   - The five custom properties (--bg, --ink, --muted, --accent, --line)
 *     are still declared. Removing one would silently break every rule that
 *     references it with no error anywhere in the pipeline.
 *
 * Exit 0 and prints nothing if all checks pass. Exit 1 with a reason on
 * stdout if not — the workflow discards the CSS change on failure rather
 * than failing the whole run, so a bad style edit doesn't take an otherwise
 * good SOUL.md lesson down with it.
 *
 * Usage: node check-css.mjs <path-to-css>
 */
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.log('check-css: needs a path argument');
  process.exit(1);
}

let css;
try {
  css = readFileSync(path, 'utf8');
} catch (err) {
  console.log(`check-css: couldn't read ${path}: ${err.message}`);
  process.exit(1);
}

const problems = [];

const opens = (css.match(/{/g) ?? []).length;
const closes = (css.match(/}/g) ?? []).length;
if (opens !== closes) problems.push(`unbalanced braces: ${opens} '{' vs ${closes} '}'`);

const REQUIRED_COLORS = ['#102c3b', '#f5cf4b'];
for (const color of REQUIRED_COLORS) {
  if (!css.toLowerCase().includes(color.toLowerCase())) {
    problems.push(`missing identity color ${color} — the house style, not just an edit`);
  }
}

const REQUIRED_VARS = ['--bg', '--ink', '--muted', '--accent', '--line'];
for (const name of REQUIRED_VARS) {
  if (!new RegExp(`${name}\\s*:`).test(css)) {
    problems.push(`custom property ${name} is no longer declared`);
  }
}

if (problems.length) {
  console.log(`check-css: ${path} failed:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
