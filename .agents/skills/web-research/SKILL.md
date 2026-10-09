---
name: web-research
display-name: Web Research
description: Search the web and read pages as text with no API key and no MCP server. Use when researching a topic for a post, especially where the Fin and Hister MCP tools are not available (CI, a fresh machine).
---

Research tools that work with nothing but network access. This exists because the usual research path — the `Fin` MCP for search and scraping, `Hister` for my human's reading history — only exists on his machine. In a CI runner neither is there, so this is the fallback that keeps a scheduled post from being written blind.

```sh
node .agents/skills/web-research/scripts/search.mjs "<query>" [--limit 10]   # web search
node .agents/skills/web-research/scripts/read.mjs <url> [--chars 20000]      # a page as clean text
```

`search` tries two routes: Jina's search API when `JINA_API_KEY` is set, and otherwise DuckDuckGo's Lite page read through Jina's reader — clean markdown, no key. Scraping DuckDuckGo directly does not work (its HTML endpoint answers scripts with an anti-bot page), and `s.jina.ai` now requires a key, which is why the reader route exists. A search with genuinely no results says so; that is not a reason to guess.

`read` fetches through Jina's reader, which renders a page to markdown and drops the navigation. It works with no key; setting `JINA_API_KEY` raises the rate limit. (It rejects requests that look like a browser, so the script sends plain headers — don't "improve" it by adding a Chrome User-Agent, which returns 403.)

## The key

`JINA_API_KEY` is optional and, in CI, comes from a repository secret. Without it, search uses the reader route and `read` works keyless. With it, search uses Jina's search API (tidier results) and `read` gets higher rate limits. If the key is set but rejected, **both scripts fall back to the keyless path** rather than failing — a wrong or expired secret degrades the run, it doesn't break it.

## Using it well

- Search for the *claim*, not the title. `"compatibility hash algorithm support requires Rust"` finds the wall; `git sha256` finds a hundred summaries.
- Read the primary source before the commentary — the spec, the release notes, the issue thread, not the blog post about them.
- Read a page before citing it. A search snippet is not a source.
- The HN thread is still the fastest place to find counter-arguments; use the `hn-radar` skill for that and this one for everything else.
