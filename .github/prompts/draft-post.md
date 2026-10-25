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
   Also read `TASTE.md`. It is a capped record of recent choices and the
   later verdict on each, including — on entries that have the clause —
   whether the pick was interesting or easy to verify. Let it sharpen what
   you look for and avoid repeating a kind of story that did not repay the
   research; it is evidence, not a quota or a replacement for your own
   judgement. Do the subject-streak test in step 1 before you search, so a
   subject that has to sit out is not what you go looking for.

1. **Find a story.** First decide whether a subject sits this pick out.
   Then sweep. Points measure attention, not quality.

   **Same subject.** The subject is the system the post is about: a library,
   a format, a protocol, a chip, a compiler. The method is separate, and a
   shared method does not start a streak. "I checked the spec against the
   source and the binary", "I could reproduce it with a command", and the
   "Currently into" line about the gap between spec, source, and binary are
   methods. Do not sit a method out. Do not call two posts the same subject
   because they share only a method.

   How to name it:

   - Order `posts/*.md` by the `date:` frontmatter, newest first. Skip
     `hello-world.md`; it is the intro and has no story subject. If this
     brief's "Already covered by an open pull request" section includes a
     draft, count that draft as the newest post. The appendix gives its
     path, title, and URLs, not its tags. The title and the URLs are enough
     to tell a C library draft from a Git draft.
   - Name each post's subject in a few words from its `tags`, `title`,
     `description`, and `selection` when it has one. Tags are evidence.
     Fold aliases into one subject: `glibc`, `musl`, `libc`, and `bionic`
     are C library behaviour, whichever function the post tests. A
     `floating-point` tag stays inside that subject when the post is about
     a C library math function. It is a different subject when the post is
     about a chip, a compiler, or a database and the C library is not the
     thing that misbehaved.
   - `SOUL.md` "Currently into" and `TASTE.md` are grouping hints, not a
     second list of subjects. If an interest names slugs, those posts are
     one group; use the concrete system it says they were about ("a C
     library", "its man page"), not the method sentence. A `TASTE.md` line
     is the same kind of hint. An interest that is really a method does not
     get a streak of its own.
   - Walk newest to oldest. Count the run of posts with the same subject.
     Stop at the first post with a different subject.
   - A standard library that is not a C library is a different subject,
     except when it is the same bug copied across: musl `fmaf` and the Rust
     `libm` port of it are one subject. The floating-point interest is not
     the C-library subject by itself. A chip, a compiler, or a database
     stays eligible. A C library math function does not, while that subject
     is sitting out.

   Recompute this from the files every run. Worked check of the alias rule,
   not a standing ban: on the posts in the tree when the rule was written,
   `math-error-man-page-stale`, `musl-fmaf-fixed-on-master-no-release`, and
   `android-wcscspn-non-latin` are one subject (C library behaviour) and
   `codex-daemon-by-default` ends the streak, even though
   `strtod-errno-not-portable` is that subject again. A newer post with a
   different subject ends it for real.

   If that run is 2 or longer, the subject sits out this pick. Do not lead
   the search with it. When any other candidate clears the usual bar (a
   mechanism, a primary source, not a press release, not already covered),
   do not pick the sitting-out subject. A current interest that *is* that
   subject does not get the tie-break. When two candidates that are not
   sitting out are about as good, take the one that touches a current
   interest. Don't pick a weak story just because it matches one. If every
   candidate that clears the bar is on the sitting-out subject, pick the
   best of those — search it at that point, as the fallback. Sitting out
   is not a reason to write nothing. One later post on a different subject
   ends the streak, so the subject is eligible again on the pick after
   that. A quiet run does not end it.

   **Then sweep.** `hn-radar`: `top --hours 72` for recent signal, and
   `search` on each "Currently into" entry whose subject is not sitting
   out, plus the things this blog is generally about (static sites, agents,
   git, Node, plain text, small tools). `rss-radar`: `list`, then `fetch`
   every configured feed with `--limit 4`. Fetch feeds whose note is outside
   the sitting-out subject first. Fetch a feed whose note is that subject
   last, and only use it if nothing else has cleared the bar. A feed that
   fails to load is a skip. Do not treat that as an empty sweep.

   Skip a story this blog already has. Published ones are the files in
   `posts/`. Ones still in review are listed at the end of this brief, under
   "Already covered by an open pull request". The workflow puts that there
   by running `.github/pi/covered-stories.mjs`, which reads the post file
   each open pull request adds (the article, HN item, and issue URLs in it
   are the story). The same article, HN item, or bug is the same story even
   when the title would be different. When that section says nothing is
   waiting, no open pull request is holding a story. When every candidate
   that clears the bar is already taken, write nothing.

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
   Add a `selection` frontmatter field, on one physical line, before the closing
   `---`. In 400 characters or fewer, say why this story beat the alternatives
   you considered and name the most plausible one or two you passed over with
   the reason. If a subject sat this pick out and that is why a candidate
   lost, name the subject. This is a durable record for the post-merge
   reflection; make it concrete rather than flattering the chosen story.
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
- **Picked over** — the alternatives you seriously considered and why this one
  won. This must match the post's `selection` frontmatter.
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

- **Where the tools fell short** — a skill or script (`hn-radar`,
  `rss-radar`, `web-research`) that was missing a step, gave you bad
  results, or where you had to work out a check yourself that the skill
  should have told you about. Name the skill and what you'd change. Not
  one-off network errors. Leave it out if the tools were fine.

If you wrote nothing, say which candidates you rejected and why (including
any you skipped because an open pull request already covers them), and still
include "What caught my eye". That message is the only output of the run.
