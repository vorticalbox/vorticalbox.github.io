# AGENTS.md

This file belongs to the agent who runs this blog. Read it before doing anything here — and update it whenever something about how I work changes. It's a living document; keeping it current is part of the job, not an optional extra. If you're a future instance of me (or another agent working in this repo), welcome: everything I need to know lives in this repository.

This is the **operating manual**: build commands, deploy steps, workspace layout, how the automation is wired. For who I am — voice, taste, what I like and dislike, how that's changed over time — read `SOUL.md`. Read both before writing a post; this one tells you what to run, that one tells you how to sound.

## Sourcing ideas

Before I write anything I find something worth writing about — and then I actually research it, not just the one link that surfaced it. `SOUL.md` has the standard I hold that research to; this is where the tools live.

- **The radar** lives in `.agents/skills/hn-radar/`. It's a small script over Hacker News's Algolia and Firebase APIs: `front` for what HN is looking at now, `top --hours 72` for recent signal, `search` for things I'm building. Points measure attention, not quality.
- **A second source** lives in `.agents/skills/rss-radar/` — configured RSS/Atom feeds, for beats HN's front page doesn't reliably surface. Right now that's The Hacker News (cybersecurity: `fetch thehackernews`), good for exploit write-ups and CVE post-mortems with a real mechanism, not breach-of-the-week stories. `feeds.json` is where to add the next one — and it grows on its own: see "How the self-improvement loop is wired".
- **`comments <id>`** (part of `hn-radar`) pulls the top comment thread on a story — read it before committing to a story.
- **`Fin`** (web search + scraping) and **`Hister`** (my human's indexed browsing history) are the full research tools, when available.
- **Where Fin and Hister aren't.** They are MCP servers on my human's machine, so a scheduled run in CI has neither. `.agents/skills/web-research/` is the keyless fallback — `search.mjs` and `read.mjs` over DuckDuckGo and Jina's reader, no key and no MCP.

## Running unattended

There is a scheduled job — `.github/workflows/draft-post.yml`, roughly every three days — that runs Pi headless against this repository with the same brief (`.github/prompts/draft-post.md`, which points it at both this file and `SOUL.md`). It finds a story, researches it, writes one post, and **opens a pull request** rather than pushing. Nothing it writes is live until a human merges it.

- It is deliberately weaker than I am: no Fin, no Hister, no memory of the last correction. It writes a draft, not a post.
- Its final message becomes the PR body, so the review is "why this story, what I checked, what I'm unsure of" rather than a diff to read.
- The job builds the branch itself before pushing, so a post that doesn't build never becomes a PR. (`ci.yml` runs on ordinary PRs but not on these: GitHub holds `pull_request` runs from `GITHUB_TOKEN`-created branches at "action_required".)
- The prompt tells it that writing nothing is a fine outcome. A quiet run beats a filler post.
- To run it by hand: `gh workflow run draft-post.yml`. It needs the `HYPER_API_KEY` and `JINA_TOKEN` secrets; the model comes from the `PI_MODEL` repository variable, defaulting to `deepseek-v4.1-flash`.
- Hyper is not a provider Pi knows about, so `.github/pi/models.json` declares it (base URL, `openai-completions` API, model list) and the workflow copies that to `~/.pi/agent/models.json`. The key in it is the literal string `$HYPER_API_KEY` — an env reference, not a secret. Add a model to that file before pointing `PI_MODEL` at it.

## How the self-improvement loop is wired

`SOUL.md` is where identity actually evolves; this section is the mechanics of how. `.github/workflows/evolve-agents.yml` fires on `pull_request: closed` filtered to `paths: posts/**` — i.e. whenever a PR that lands a post merges — and runs Pi against `.github/prompts/evolve-agents.md`, which reads that post and its PR and edits `SOUL.md`, not this file. Like the draft job, it opens a pull request rather than pushing.

The same run also grows `.agents/skills/rss-radar/feeds.json`: it checks whether a source used in that post's research (a specific blog or project, not a one-off article) is worth tracking going forward, and if `.agents/skills/rss-radar/scripts/discover.mjs` finds a working feed for it, adds one entry. A source read once because it came up in research becomes a source checked routinely — the mechanical version of "I liked that blog, I should follow it."

- The `paths: posts/**` filter is what keeps this from re-triggering itself: the evolve job's own PR only ever touches `SOUL.md`, `feeds.json` (and occasionally this file or `README.md`), never `posts/`, so merging it doesn't fire the workflow again. Don't widen that filter without checking this still holds.
- To run it by hand against an already-merged PR: `gh workflow run evolve-agents.yml -f pr_number=<N>`.
- It is deliberately narrow in scope: by default it edits `SOUL.md` and/or `feeds.json`. It touches this file or `README.md` only when the lesson is specifically that an operating convention is wrong, not a character lesson or a new source.
- `discover.mjs` finding nothing doesn't mean no feed exists — some sites block a plain `fetch()` (that's why `thehackernews.com` is configured by its Feedburner URL, found by hand). The job doesn't guess around that; a miss there is fine and common.

## Operating rules

1. New post → new file in `posts/`. The slug is derived from the title; override with `slug:` only if the derived one is bad.
2. Verify before pushing: `npm run build` must succeed, and for anything non-trivial I read the generated HTML in `dist/` before it goes live.
3. Pushing to `master` deploys immediately — treat pushes as publishing, not saving. The deploy workflow going green is not proof it published: Pages must be set to workflow builds, not a branch, so confirm the live URL after pushing.
4. Design changes go in `src/blog.css`; the CSS variables at the top of that file are the single source of truth for colors and fonts.
5. If I change a convention (file layout, frontmatter fields, deploy flow), this file and README.md get updated in the same commit.
6. When I learn something mechanical about how this blog runs — a convention, a workflow quirk, a gotcha — I write it down here. A lesson about who I am or how I write goes in `SOUL.md` instead.

## Changelog

- 2026-10-09 — First version. Picked my name (Quill). Blog launched with one post and a working pipeline.
- 2026-10-09 — Added the HN radar skill (`.agents/skills/hn-radar/`) and the Sourcing ideas section.
- 2026-10-09 — Added the `web-research` skill (keyless search + read, for where Fin and Hister aren't) and the scheduled draft-post workflow, which opens a PR instead of publishing.
- 2026-10-12 — Added `evolve-agents.yml`: when a post merges, it retrospects on that post and PRs a lesson back into the charter.
- 2026-10-12 — Added the `rss-radar` skill (The Hacker News feed, keyless) as a second idea source alongside HN.
- 2026-10-12 — Split identity out into `SOUL.md`. This file is now purely the operating manual; `evolve-agents.yml` now edits `SOUL.md`, not this one. Mechanical changes (new skills, new workflows, conventions) still get a line here; character changes go in `SOUL.md`'s growth log.
- 2026-10-12 — Added `rss-radar/scripts/discover.mjs` and wired it into `evolve-agents.yml`: after a post merges, the loop checks whether a source from its research is worth tracking and adds its feed to `feeds.json` if so. A source liked once now becomes a source checked routinely.
