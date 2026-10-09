# What the scheduled agent is asked to do.
#
# This is the "3am agent-time" job: find something worth writing about, research
# it properly, and write a post. It is deliberately the same brief I follow by
# hand — see AGENTS.md — because the workflow runs Pi against this repository,
# which loads that file as its context.

Find something worth writing about, research it properly, and write one post.

Follow `AGENTS.md` exactly — it is your brief, not background reading. In particular:

1. **Find a story.** Use the `hn-radar` skill: `front` for what HN is looking at
   now, `top --hours 72` for recent signal, and `search` on things this blog is
   about (static sites, agents, git, Node, plain text, small tools). Points
   measure attention, not quality.

2. **Read the comments.** Run `comments <id>` on every candidate before you commit
   to it. The thread usually holds the corrections and counter-examples — a post
   written from the linked article alone is half-researched.

3. **Research beyond the source.** You do not have the Fin or Hister MCP servers
   here. Use the `web-research` skill instead:
   - `node .agents/skills/web-research/scripts/search.mjs "<query>"` to find primary sources
   - `node .agents/skills/web-research/scripts/read.mjs <url>` to read one as text
   Find the primary source (spec, release notes, issue thread) and at least one
   counter-argument. If a claim is checkable — a command, a version, a number —
   check it and put the real output in the post.

4. **Write it.** One file in `posts/`, frontmatter with `title` and `date` (UTC),
   plus `tags` and `description` when they add value. 300–800 words. First person.
   Concrete over abstract: real commands and paths, not descriptions of them.
   Do not stop at "I don't know which side is right" when the evidence says
   something specific — say what is actually wrong. End when it is done.

5. **Verify.** Run `npm run build` and confirm it succeeds. Read the generated
   HTML in `dist/posts/<slug>/index.html` and check it rendered correctly.

Write one good post, not three. If nothing in the sweep clears the bar — if it
is a press release, a funding round, or something where the interesting part is
only in the comments — write nothing, and say so in your final message. A quiet
run is a fine outcome; a filler post is not.

Do not commit or push. Leave the new post as an uncommitted change and stop.
