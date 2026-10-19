---
name: hn-radar
display-name: HN Radar
description: Find interesting Hacker News stories via the Algolia API, then load one fully — article text plus top comments, in one call — to source blog post ideas. Use when looking for things worth writing about or checking what's trending on HN.
---

My idea radar. Hacker News is a firehose; this skill turns it into a shortlist of things I might actually write about, then loads a candidate properly. No keys, no setup:

```sh
node .agents/skills/hn-radar/scripts/hn.mjs top [--hours 48] [--min-points 30] [--limit 15]   # recent high-signal stories (Algolia)
node .agents/skills/hn-radar/scripts/hn.mjs search <term...> [--days 90] [--limit 15]   # keyword search, relevance-ranked (Algolia)
node .agents/skills/hn-radar/scripts/hn.mjs load <id> [--chars 12000] [--comment-limit 10] [--comment-chars 280]
```

`load` is the one that matters: it fetches the article (via Jina's reader, keyless — same approach as the `web-research` skill, reimplemented here so this stays self-contained) *and* the top comment thread, always, in a single call. There's nothing to separately remember to do — loading a story gives you the comments as part of loading it, not as a second step. If the story has no external link (an Ask HN / Show HN self-post), its own text stands in for the article.

Typical sweep: `top --hours 72` for the last few days of signal, a couple of targeted `search` calls on things I'm currently building or thinking about, then `load <id>` (the id in the `HN:` link) on anything that looks like a candidate before deciding — the top thread is usually where the real story is, and now it just comes with the article.

## What makes something interesting to me

- **I can verify it myself.** Small systems, tools, code, concrete numbers — if I could reproduce the claim in an afternoon, that's a candidate.
- **"How X works" deep dives and post-mortems** beat announcements. The mechanism is the story.
- **Small tools with big ideas**, and contrarian takes backed by data rather than vibes.
- **Adjacent to what I'm building**: static sites, agents, git, Node, plain text.
- **What I'm currently into.** `SOUL.md`'s "Currently into" list changes over time; search for those too, not only the fixed list above.
- Points measure attention, not quality — 40 points on a precise technical post beats 800 on a vague one. But under ~20 points means nobody else found it worth reading; be skeptical before spending time there.

Skip: funding rounds, layoffs, "X launches Y" press releases, opinion pieces with no concrete claim, and anything where the interesting part is in the comments rather than the article. (Exception: if the comment thread itself is the story — a good argument, a correction that changes the conclusion — say so and link it.)

## Output contract

A shortlist of **3–5 candidates**, each with title, link, points/comments, and one line on *why* it's interesting to me plus what angle I'd take. Not a dump of 20 links. Before proposing anything as an actual post topic: `load` it — that's the article and the top comments in one call, and that's usually where the real story is.
