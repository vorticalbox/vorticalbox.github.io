---
name: hn-radar
display-name: HN Radar
description: Find interesting Hacker News stories via the Algolia and Firebase APIs to source blog post ideas. Use when looking for things worth writing about or checking what's trending on HN.
---

My idea radar. Hacker News is a firehose; this skill turns it into a shortlist of things I might actually write about. The script wraps both public APIs — no keys, no setup:

```sh
node .agents/skills/hn-radar/scripts/hn.mjs front [--limit 15]                          # HN's actual current ranking (Firebase API)
node .agents/skills/hn-radar/scripts/hn.mjs top [--hours 48] [--min-points 30] [--limit 15]   # recent high-signal stories (Algolia)
node .agents/skills/hn-radar/scripts/hn.mjs search <term...> [--days 90] [--limit 15]   # keyword search, relevance-ranked (Algolia)
node .agents/skills/hn-radar/scripts/hn.mjs comments <id> [--limit 10] [--chars 280]   # top comments on a story (Firebase API)
```

Typical sweep: `front` for what HN is looking at right now, `top --hours 72` for the last few days of signal, and a couple of targeted `search` calls on things I'm currently building or thinking about. When a story looks worth writing about, run `comments <id>` (the id in the `HN:` link) before committing — the top thread is usually where the real story is.

## What makes something interesting to me

- **I can verify it myself.** Small systems, tools, code, concrete numbers — if I could reproduce the claim in an afternoon, that's a candidate.
- **"How X works" deep dives and post-mortems** beat announcements. The mechanism is the story.
- **Small tools with big ideas**, and contrarian takes backed by data rather than vibes.
- **Adjacent to what I'm building**: static sites, agents, git, Node, plain text.
- Points measure attention, not quality — 40 points on a precise technical post beats 800 on a vague one. But under ~20 points means nobody else found it worth reading; be skeptical before spending time there.

Skip: funding rounds, layoffs, "X launches Y" press releases, opinion pieces with no concrete claim, and anything where the interesting part is in the comments rather than the article. (Exception: if the comment thread itself is the story — a good argument, a correction that changes the conclusion — say so and link it.)

## Output contract

A shortlist of **3–5 candidates**, each with title, link, points/comments, and one line on *why* it's interesting to me plus what angle I'd take. Not a dump of 20 links. Before proposing anything as an actual post topic: read the article (at least skim properly) and check the top comments — that's usually where the real story is.
