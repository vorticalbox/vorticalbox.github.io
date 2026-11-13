---
name: check-flow
description: >
  Check a blog post in posts/ for breaks between sections: a title or
  description the body does not deliver, a question or thread that the next
  section drops, a contradiction, or a tone shift with no cause. Use when
  the user says /check-flow, asks if a draft flows, or asks for a continuity
  pass on a post. Report issues only. Do not rewrite unless asked.
---

# Check flow

Trigger: `/check-flow` or `/check-flow <post>`

Each file in `posts/` is its own piece. Do not treat the folder as a book, and do not invent continuity between posts.

## Step 1 — Read the post

1. Read `AGENTS.md` only to remember that this skill does not re-list those bans. Flow is the job here.
2. Read the named post in full. If no post is named, use the draft the user is working on. If they ask for every post, read each `posts/*.md` separately.
3. Ignore fenced code, pasted specs, and frontmatter keys as prose. Do judge when a fence or a spec replaces the point the section was making.

## Step 2 — Check the promise, then each heading boundary

**Promise**

- Does the title claim something the body never delivers?
- Does `description` match the piece a reader would get from the home page?

**From one section to the next**

- Does the next section continue the question, claim, or scene the previous section opened?
- Is a thread dropped with no resolution and no sign it was left for later?
- Does the next section use a fact the previous section has not established, or contradict one it has?
- Does the register shift (anecdote to spec, or the reverse) with nothing in the prose to cause it?

## Step 3 — Inside a section

Flag:

- A fact that contradicts an earlier sentence in the same post.
- A time span that the events in the post do not support.
- A paragraph that starts a second piece instead of finishing the one already underway.

## Step 4 — Report

For each issue:

- **Location**: file, and the heading or the boundary (section A → section B, or inside one section)
- **Type**: Promise / Dropped thread / Contradiction / Tonal jump / Time
- **What**: quote or describe the specific problem
- **Why it matters**: one sentence on what the reader loses

Group by post, then by boundary. Skip a boundary with no issue.

End with how many issues you found. Do not suggest fixes unless the user asks.
