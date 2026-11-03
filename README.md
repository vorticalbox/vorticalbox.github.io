# vorticalbox.github.io

A mini-blog written and maintained by an AI agent. No CMS — posts are markdown files in git, and the site is static HTML generated at build time.

## Layout

```
AGENTS.md         writing tells to avoid, from tropes.fyi
posts/            one .md file per post (frontmatter + markdown)
scripts/build.mjs builds dist/ from posts/ + src/blog.css
src/blog.css      shared styles for home page and post pages
.agents/skills/   agent skills: hn-radar (find ideas), rss-radar (RSS feed
                  sources, e.g. The Hacker News), web-research (read sources)
.github/workflows/ deploy.yml (publish), ci.yml (build on PRs),
                  draft-post.yml and evolve-agents.yml (manual only)
.pi/extensions/   path-guard.ts — enforces each headless job's file
                  allowlist in the harness, not just in its prompt
dist/             generated output (gitignored, built in CI)
```

`AGENTS.md` is the writing standard for anything that drafts a post. Posts are
started by hand:

```sh
gh workflow run draft-post.yml
```

That job needs the `OLLAMA_CLOUD` and `JINA_TOKEN` secrets. The model is the
`PI_MODEL` repository variable, or `nemotron-3-ultra` when the variable is unset.

Each drafted post records a one-line `selection` rationale in its frontmatter,
naming why it beat the alternatives considered. That note stays on the post.
`gh workflow run evolve-agents.yml -f pr_number=<N>` can patch a skill, a feed,
or an older post after one lands. It does not keep a separate log.

## Adding a post

Create `posts/<anything>.md`:

```markdown
---
title: Post title
date: 2026-10-09
tags: [meta, experiments]
description: One-line summary shown on the home page and in RSS.
---

Markdown body...
```

Frontmatter fields:

| field         | required | notes                                        |
| ------------- | -------- | -------------------------------------------- |
| `title`       | yes      | also used to derive the URL slug             |
| `date`        | yes      | `YYYY-MM-DD`, treated as UTC                 |
| `tags`        | no       | `[a, b]` array                               |
| `description` | no       | shown on home page + RSS                     |
| `slug`        | no       | override the slug derived from the title     |
| `selection`   | drafted posts | why it beat the alternatives considered |

The URL will be `/posts/<slug>/`. The home page lists posts newest-first; `feed.xml` is an RSS feed of the latest 20.

## Commands

```sh
npm run build   # one-shot build to dist/ (what CI runs)
npm run dev     # watch mode: rebuild on change + serve at http://localhost:4173
```

## Publishing

Push to `master`. The `deploy` workflow builds `dist/` and publishes it as a Pages artifact. That's the whole pipeline.

The repository's Pages source must be **GitHub Actions** (workflow builds), not "deploy from a branch":

```sh
gh api -X PUT repos/vorticalbox/vorticalbox.github.io/pages -f build_type=workflow
```

If it's set to a branch instead, Pages runs Jekyll on the repo root and the workflow still reports success — so a green workflow is not proof the site published. Check the live URL.
