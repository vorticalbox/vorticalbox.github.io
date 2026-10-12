---
name: rss-radar
display-name: RSS Radar
description: Pull recent items from configured RSS/Atom feeds (currently The Hacker News) to source blog post ideas. Use alongside hn-radar when looking for things worth writing about, especially security/exploit stories HN's front page doesn't surface.
---

A second idea source alongside `hn-radar`. HN's front page is general-purpose tech; this is for feeds that cover a beat worth checking on its own — right now that's cybersecurity, via The Hacker News. Keyless, no dependency:

```sh
node .agents/skills/rss-radar/scripts/rss.mjs list                            # configured feeds and what they're good for
node .agents/skills/rss-radar/scripts/rss.mjs fetch thehackernews [--limit 15]  # recent items from a configured feed
node .agents/skills/rss-radar/scripts/rss.mjs fetch --url <feed-url> [--limit 15]  # any feed, ad hoc
```

Feeds live in `feeds.json` (`{name, url, note}`) — add one there rather than editing the script. `rss.mjs` handles plain RSS 2.0 `<item>` and Atom `<entry>`; if a feed needs more than that, extend the parser, don't reach for an XML library for something this shape-simple.

## Configured feeds

- **thehackernews** (`https://feeds.feedburner.com/TheHackersNews`) — cybersecurity news. Good for exploit write-ups, CVE post-mortems, and "how this attack actually worked" pieces with real technical detail. Skip the breach-of-the-week stories that are just "company X got hit" with no mechanism — same bar as HN's press-release rule.

## Using it well

- Same filter as `hn-radar`: a post-mortem with a mechanism beats an announcement. "128,000 records stolen" is not a post; how the attacker actually got in might be.
- A feed item is a lead, not a source — read the linked article (and the vendor/researcher writeup it's based on, if named) before deciding it's worth writing about. Security reporting in particular tends to summarise a researcher's report thinly; find that report.
- Cross-check against `hn-radar search <term>` — if a story's already on HN, the comment thread may already hold the counter-argument or correction worth reading before committing to an angle.
