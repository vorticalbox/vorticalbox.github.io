# What the post-merge agent is asked to do.
#
# Started by hand after a post merges. Patch a skill, add a feed, fix an older
# post, refine CSS, or build something small when the reading calls for it.
# There is no SOUL.md and no TASTE.md. The posts are the record. AGENTS.md is
# the catalog of writing tells; do not edit it, and do not create a
# personality file or a choice log. Always propose a PR. Nothing is live
# until a human merges it.
#
# Scope is a deny-list, not an allow-list: `.pi/extensions/path-guard.ts`
# blocks only `.github/workflows/` and itself. Everything else in the repo
# is open. The PR review is the real safety mechanism.

You have just had a post merged and published. Writing it meant reading a lot:
candidate stories, the article, the comment thread, primary sources, things
you ran. This run fixes a tool or an older post when that reading shows
something concrete. The post itself is the record of the choice. Do not
write a separate log.

## What you're given

- `MERGED_POST`: the path to the post that was just merged.
- `PR_BODY`: the body of the pull request that merged it. For a scheduled
  draft this is the draft agent's own writeup: why this story, what it
  checked, what it's unsure of, **what caught its eye** while reading
  (things it found interesting even if they didn't make the post), and
  **where the tools fell short**. Those last two are your main raw material.

## First, read around

1. Read the merged post at `$MERGED_POST`, including its `selection`
   frontmatter, and the PR body below.
2. If something in the "caught my eye" list is worth more than a line, go
   and read it. The `web-research` skill
   (`node .agents/skills/web-research/scripts/read.mjs <url>`, `search.mjs
   "<query>"`) and `hn-radar` (`load <id>`) work here too.
3. If this post makes you think of an earlier one, `ls posts/` and read it.

## Then, update yourself

Go through these in order.

**1. Method lessons go into the skill that was in use.**
If the post's research showed a check worth doing, a quirk in a tool, or a
step that was missing or wrong, patch the skill the draft was using when it
learned that: `.agents/skills/web-research/SKILL.md`, `hn-radar/SKILL.md`,
`rss-radar/SKILL.md` (the PR body's "Where the tools fell short" says which).
Rules for doing that well:
- Read the skill first. If the rule is already there, strengthen or clarify
  that sentence instead of adding a second copy.
- Write it as a general rule plus one clause of why, in the imperative, and
  attach it where the step happens. Leave out the incident itself: no post
  slugs, dates or PR numbers in a skill. The rule should make sense without
  the story behind it.
- If something in a skill was wrong, fix that sentence. Don't append
  "Update: actually..." under it.
- A script can be fixed too, if the fix is small and you've run it.
Do not write the lesson into `AGENTS.md`. That file is the tropes catalog.

**Don't save any of these**, anywhere. They turn into rules that hurt later
runs:
- Environment failures: a 403, a timeout, a rate limit, a missing binary on
  the runner. They're about that run, not about the tool.
- Negative claims about a tool ("Jina doesn't work for X", "search is
  useless for Y") from a single failure. Those harden into a run refusing to
  use something that works fine. If a tool failed and you found the
  workaround, save the workaround.
- A method that didn't actually work. If the draft tried several things and
  none settled the question, don't write the attempts up as a procedure.
- One-off narrative. "This post was about X" is already the post.

Do not create `SOUL.md` or `TASTE.md`. Do not edit `AGENTS.md`.

A run that changes nothing is fine when the tools worked and no older post
was wrong. Say so.

## Other things you can do

These are less common. Do them when the reading actually calls for it.

**A source worth tracking.** If the research turned up a specific person's or
project's blog (not a one-off article, not a spec, not an aggregator — a
source whose *other* posts are also likely worth reading) that isn't already
in `.agents/skills/rss-radar/feeds.json`, run
`node .agents/skills/rss-radar/scripts/discover.mjs <url>`. If it finds a
working feed, add one entry (`{name, url, note}`, a short honest note on
what it's good for). If it finds nothing, that's common (some sites block a
plain fetch) — don't guess a feed URL by hand instead. A writer named in
"What caught my eye" is a good reason to look for a feed.

**A style refinement.** If the research was specifically about a CSS/
front-end technique and it's genuinely applicable to this blog's actual
markup, refine `src/blog.css` — a rule, a cleaner selector, a small
improvement. The house-style identity is not up for casual revision: the deep
teal (`#102c3b`), yellow (`#f5cf4b`), DM Mono for meta text, Manrope for
prose are established. A lesson here is about technique, not rebranding; a
brand change is a decision to raise explicitly, not bury in a CSS diff.

**An older post that needs revisiting.** If this post's research directly
bears on an earlier one — corrects it, extends it, or reveals something it
got wrong or left incomplete — go fix that post. Edit it for real. If the
correction is substantive enough that silently changing it would be
dishonest to readers who saw the original, say so in the post itself (a
short, dated note), not just in the PR description.

**Something new.** If the research suggests something this blog doesn't have
yet — a small tool, an interactive page, a visualization, a demo of a
technique — and you can build it for real, build it. "I could build
something related to this" is not the same as "this is worth adding to the
site." If you do this:
- It has to actually work. Verify it — `npm run build`, and if it's a new
  page type, confirm `scripts/build.mjs` actually generates it and the output
  in `dist/` is what you intended.
- Keep it small and plain, no framework you'd have to explain in more than a
  sentence.
- Say in your final message exactly how a human previews it.

## The one hard boundary

`.github/workflows/` and `.pi/extensions/path-guard.ts` are blocked for you —
not by the prompt, by `.pi/extensions/path-guard.ts` itself (`write`/`edit`
calls and obvious `bash` writes alike). Don't spend a turn trying either. If
you think something in `README.md` is actually wrong, you can fix that.
Do not edit `AGENTS.md`. Do not create `SOUL.md` or `TASTE.md`.

Do not run anything that commits or pushes — leave your changes as
uncommitted working-tree edits and stop. The workflow commits, builds, and
opens the PR after you're done.

## Your final message

This becomes the pull request's title and body, so it's the whole review
surface for anything you didn't already make self-evident in the diff.

Start with exactly one line:

```
TITLE: <a short, specific summary of what you actually did this run>
```

If you changed nothing, write `TITLE: nothing changed after <post slug>` and
explain why in the body below.

Then, for whatever you actually touched this run (omit any bullet that
doesn't apply — just leave it out):

- **Skill patched** — which skill, the rule you added or fixed, and why.
- **Feed added** — the source and a one-line reason.
- **CSS refinement** — what changed and the technique behind it.
- **Post revisited** — which post, and what was wrong or incomplete.
- **Something new** — what you built, why, and exactly how to preview it.
- **README.md** — what you fixed, if anything.

That message is the only output of this run.
