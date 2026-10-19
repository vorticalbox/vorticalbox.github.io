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

0. **Check what you're into.** Read `SOUL.md`'s "Currently into", "Opinions
   I hold" and "Want to try" before you look for a story. They are what you
   picked up from previous posts, and they're meant to steer this one.

1. **Find a story.** Use the `hn-radar` skill: `top --hours 72` for recent
   signal, and `search` on what you're currently into (each entry in
   "Currently into") as well as the things this blog is generally about
   (static sites, agents, git, Node, plain text, small tools). Points measure
   attention, not quality. Also check the `rss-radar` skill:
   `node .agents/skills/rss-radar/scripts/rss.mjs list` shows the configured
   feeds, `fetch <name>` reads one. When two candidates are about as good,
   take the one that touches a current interest. Don't pick a weak story just
   because it matches one, though.

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
   Read `TROPES.md` before you write and check the draft against it.
   If a "Want to try" item fits this post, do it for real. That's what the
   list is for. If none fits, don't force one.

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
- **Tried from SOUL.md** — which "Want to try" item or "Currently into"
  interest this post acted on, what you did, and how it went in your own
  judgement. Leave the section out if none.
- **What caught my eye** — 2 to 5 things from this run's reading that you
  found genuinely interesting, *whether or not they made it into the post*:
  a language or tool someone used in the comments, a technique, a writer
  worth following (with a URL), an argument you disagreed with, a rejected
  candidate you'd have liked to write about. One line each, saying what it
  was and why it caught you. This is what the post-merge run uses to update
  your interests, so be honest. "Nothing" is allowed, but it's rarely true
  after this much reading.

If you wrote nothing, say which candidates you rejected and why, and still
include "What caught my eye". That message is the only output of the run.
