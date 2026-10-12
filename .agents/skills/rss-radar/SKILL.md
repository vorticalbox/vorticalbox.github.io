---
name: rss-radar
display-name: RSS Radar
description: Pull recent items from configured RSS/Atom feeds (currently The Hacker News and 404 Media) to source blog post ideas, and discover + add new feeds for sources that turn out to be worth coming back to. Use alongside hn-radar when looking for things worth writing about, especially beats HN's front page doesn't surface — and after writing a post, to grow this list.
---

A second idea source alongside `hn-radar`, and one that's meant to grow on its own. HN's front page is general-purpose tech; this is for feeds that cover a beat — or a single good writer — worth checking on its own. Keyless, no dependency:

```sh
node .agents/skills/rss-radar/scripts/rss.mjs list                            # configured feeds and what they're good for
node .agents/skills/rss-radar/scripts/rss.mjs fetch thehackernews [--limit 15]  # recent items from a configured feed
node .agents/skills/rss-radar/scripts/rss.mjs fetch --url <feed-url> [--limit 15]  # any feed, ad hoc
node .agents/skills/rss-radar/scripts/discover.mjs <page-url>                  # find a feed for a page that isn't configured yet
```

Feeds live in `feeds.json` (`{name, url, note}`) — add one there rather than editing the script. `rss.mjs` handles plain RSS 2.0 `<item>` and Atom `<entry>`; if a feed needs more than that, extend the parser, don't reach for an XML library for something this shape-simple.

## Growing the list

This is the part that makes it a radar and not just a list: `.github/workflows/evolve-agents.yml` runs `discover.mjs` on sources used while researching a post, after that post merges, and adds a hit to `feeds.json` if it's worth tracking. The bar (same one applied by hand):

- **A specific person or project's blog, not a one-off article.** A link to a single news story doesn't earn a feed; a writer or project whose other posts are also likely worth reading does.
- **Actually has a feed.** `discover.mjs` checks the page's declared `<link rel="alternate">` tag first, then a handful of common paths (`/feed`, `/rss.xml`, `/atom.xml`, ...), and validates each candidate by parsing it rather than trusting a 200. Some sites block a plain `fetch()` outright (Cloudflare and similar; `thehackernews.com` is one — that's why it's in `feeds.json` by its Feedburner URL, found by hand, not by this script). No feed found there doesn't mean no feed exists, just that this tool couldn't confirm one.
- **Not a near-duplicate of an existing entry.** Check `feeds.json` first.

Add an entry with a short, honest `note` — what it's good for, same as the existing ones, not a generic description.

## Configured feeds

- **thehackernews** (`https://feeds.feedburner.com/TheHackersNews`) — cybersecurity news. Good for exploit write-ups, CVE post-mortems, and "how this attack actually worked" pieces with real technical detail. Skip the breach-of-the-week stories that are just "company X got hit" with no mechanism — same bar as HN's press-release rule.
- **404media** (`https://www.404media.co/rss/`) — independent tech/surveillance journalism. Good for investigations with a real mechanism behind them (how a tracking tool works, what a leaked dataset actually contains), not just "here's a bad thing that happened." Skip the "Behind the Blog" meta posts and general culture pieces with no technical core.

## Using it well

- Same filter as `hn-radar`: a post-mortem with a mechanism beats an announcement. "128,000 records stolen" is not a post; how the attacker actually got in might be.
- A feed item is a lead, not a source — read the linked article (and the vendor/researcher writeup it's based on, if named) before deciding it's worth writing about. Security reporting in particular tends to summarise a researcher's report thinly; find that report.
- Cross-check against `hn-radar search <term>` — if a story's already on HN, the comment thread may already hold the counter-argument or correction worth reading before committing to an angle.
