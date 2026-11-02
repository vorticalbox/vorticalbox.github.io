# What the draft job is asked to do.
#
# Started by hand. Find something worth writing about, research it, and write
# one post. AGENTS.md is the catalog of writing tells to avoid. There is no
# SOUL.md.

Find something worth writing about, research it properly, and write one post.

`AGENTS.md` is the writing standard. Check the draft against it before you
stop. In particular:

0. **Read `TASTE.md`.** It is a capped record of recent choices and the later
   verdict on each. Let it sharpen what you look for and avoid repeating a
   kind of story that did not repay the research. It is evidence, not a quota
   or a replacement for your own judgement.

1. **Find a story.** Use the `hn-radar` skill: `top --hours 72` for recent
   signal, and `search` on what this blog is generally about (static sites,
   agents, git, Node, plain text, small tools, libc, numeric edge cases).
   Points measure attention, not quality. Also check the `rss-radar` skill:
   `node .agents/skills/rss-radar/scripts/rss.mjs list` shows the configured
   feeds, `fetch <name>` reads one. When two candidates are about as good,
   take the one with the clearer mechanism. Don't pick a weak story just
   because it is nearby.

   Skip a story this blog already has. The brief ends with two lists from
   `.github/pi/covered-stories.mjs`: "Already published" (every file in
   `posts/`, with the URLs it cites) and "Already covered by an open pull
   request". The same article, HN item, or bug is the same story even when
   the title would be different. The workflow runs that check again on the
   file you write and drops the pull request if it overlaps either list.
   When that open-pull-request section says nothing is waiting, no open
   pull request is holding a story. When every candidate that clears the
   bar is already taken, write nothing.

2. **Load every candidate before committing to one.** An HN story has a
   numeric id, the `HN:` link. Run
   `node .agents/skills/hn-radar/scripts/hn.mjs load <id>` — this gives you
   the article *and* the top comment thread together, in one call; there is
   no separate "now go read the comments" step. An RSS item has no HN id.
   `load` refusing anything that is not a numeric id is how it works.
   Read that article with
   `node .agents/skills/web-research/scripts/read.mjs <url>`, then
   `node .agents/skills/hn-radar/scripts/hn.mjs search <term>` if you want
   the comment thread. The thread usually holds the corrections and
   counter-examples — a post written from the article alone is
   half-researched.

3. **Research beyond the source.** You do not have the Fin or Hister MCP servers
   here. Use the `web-research` skill instead:
   - `node .agents/skills/web-research/scripts/search.mjs "<query>"` to find primary sources
   - `node .agents/skills/web-research/scripts/read.mjs <url>` to read one as text
   Find the primary source (spec, release notes, issue thread) and at least one
   counter-argument. A story does not have to be something this machine can
   compile. If you run a command, put the real output in the post. If you did
   not run it, attribute the number or behaviour to the person who did.

4. **Write it.** One file in `posts/`, frontmatter with `title` and `date` (UTC),
   plus `tags` and `description` when they add value. 300–800 words. First person.
   Concrete over abstract: real commands and paths, not descriptions of them.
   Do not stop at "I don't know which side is right" when the evidence says
   something specific — say what is actually wrong. End when it is done.
   Add a `selection` frontmatter field, on one physical line, before the closing
   `---`. In 400 characters or fewer, say why this story beat the alternatives
   you considered and name the most plausible one or two you passed over with
   the reason. This is a durable record for the post-merge reflection; make it
   concrete rather than flattering the chosen story.
   Read `AGENTS.md` before you write and check the draft against it.

5. **Verify.** Run `npm run build` and confirm it succeeds. Read the generated
   HTML in `dist/posts/<slug>/index.html` and check it rendered correctly.

Write one good post, not three. If nothing in the sweep clears the bar — if it
is a press release, a funding round, or something where the interesting part is
only in the comments — write nothing, and say so in your final message. A quiet
run is a fine outcome; a filler post is not.

Do not commit or push. Leave the new post as an uncommitted change and stop.

## Your final message

It is used verbatim as the body of the pull request a human will review, so
write it for them, not for a log. Start with the first section. Do not
announce that the build succeeded or that this is the pull request message.
Keep it short and concrete:

- **Why this story** — one or two lines: what made it worth writing, and the angle.
- **Picked over** — the alternatives you seriously considered and why this one
  won. This must match the post's `selection` frontmatter.
- **What I checked** — the primary sources read, and any command output you
  verified yourself rather than quoting.
- **Anything I'm unsure of** — a claim you could not verify, a hedge you left in.
  Say so plainly; it is more useful than false confidence.
- **What caught my eye** — 2 to 5 things from this run's reading that you
  found genuinely interesting, *whether or not they made it into the post*:
  a language or tool someone used in the comments, a technique, a writer
  worth following (with a URL), an argument you disagreed with, a rejected
  candidate you'd have liked to write about. One line each, saying what it
  was and why it caught you. "Nothing" is allowed, but it's rarely true
  after this much reading.

- **Where the tools fell short** — a skill or script (`hn-radar`,
  `rss-radar`, `web-research`) that was missing a step, gave you bad
  results, or where you had to work out a check yourself that the skill
  should have told you about. Name the skill and what you'd change. Not
  one-off network errors. Leave it out if the tools were fine.

If you wrote nothing, say which candidates you rejected and why (including
any you skipped because a published post or an open pull request already covers them), and still
include "What caught my eye". That message is the only output of the run.
