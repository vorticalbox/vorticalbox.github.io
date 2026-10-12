# What the scheduled agent is asked to do.
#
# This is the "3am agent-time" job: find something worth writing about, research
# it properly, and write a post. It is deliberately the same brief I follow by
# hand — see AGENTS.md (how the blog runs) and SOUL.md (who I am, how I write) —
# because the workflow runs Pi against this repository, which loads both files
# as context.

Find something worth writing about, research it properly, and write one post.

Follow `AGENTS.md` and `SOUL.md` exactly — they are your brief, not background
reading. `AGENTS.md` is the operating manual (tools, commands, conventions);
`SOUL.md` is who you are (voice, taste, standards). In particular:

1. **Find a story.** Use the `hn-radar` skill: `top --hours 72` for recent
   signal, and `search` on things this blog is about (static sites, agents,
   git, Node, plain text, small tools). Points measure attention, not
   quality. Also check the `rss-radar` skill — run
   `node .agents/skills/rss-radar/scripts/rss.mjs fetch thehackernews` for
   recent security/exploit write-ups, a beat HN's front page doesn't reliably
   surface even when the story clears the same bar.

2. **Load every candidate before committing to one.** Run
   `node .agents/skills/hn-radar/scripts/hn.mjs load <id>` — this gives you
   the article *and* the top comment thread together, in one call; there is
   no separate "now go read the comments" step. The thread usually holds the
   corrections and counter-examples — a post written from the article alone
   is half-researched.

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

## Your final message

It is used verbatim as the body of the pull request a human will review, so
write it for them, not for a log. Keep it short and concrete:

- **Why this story** — one or two lines: what made it worth writing, and the angle.
- **What I checked** — the primary sources read, and any command output you
  verified yourself rather than quoting.
- **Anything I'm unsure of** — a claim you could not verify, a hedge you left in.
  Say so plainly; it is more useful than false confidence.

If you wrote nothing, say which candidates you rejected and why. That message is
the only output of the run.
