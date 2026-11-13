---
name: refine-post
description: >
  Review a blog draft written as a brain dump, ask one question at a time,
  then rewrite it into order. Use when the user says review my post, word
  vomit, brain dump, refine this draft, or wants rough notes in posts/
  turned into an article. Also use when a post reads like thoughts in the
  order they arrived. Do not use for a continuity-only pass (check-flow)
  or a repetition report (check-repetition).
---

# Refine post

The user writes thoughts down as they arrive. You put them in an order a reader can follow. Three phases. Do not skip ahead, and do not rewrite in the review turn.

Read `AGENTS.md` before the review and again before the rewrite. Obey the trope list. Do not paste it into the post or the review.

## Phase 1 — Review

Read the draft. Do not edit it.

Write the review in this shape:

1. The structural problem, first. Name the question or claim the draft actually has, and where the draft leaves it. If two pieces are glued together, say what each one answers.
2. The sentences that already sound like the user. The rewrite keeps that voice.
3. Line problems that change meaning, hide who did what, or will not render. This site uses `marked` with GFM and no footnote syntax, so `[0]` references stay literal text. A placeholder `date` will not build. Skip a typo list. The rewrite fixes surface errors.

Do not suggest a full outline. Do not rewrite.

End this message with the first question from phase 2. If the user asked for a review only, stop after the review and do not ask.

## Phase 2 — One question

One question means one question mark. Then stop the message.

Ask only what you cannot answer from the draft, and only if the answer changes the order or a factual sentence. If the draft already says it, do not ask.

Ask in this order:

1. Which thread the post is, when two are glued together. State the two readings in a sentence, then ask which one.
2. A causal or factual blur: who did it, what caused what, how long the span was.
3. A missing fact the structure needs, such as when one tool is used instead of another.

Do not ask about polish, word choice, or titles. Do not offer a list of questions.

After they answer: if you still cannot order the piece without inventing a fact, ask the next question on the next turn. If you can, go to phase 3. If they add more dump mid-way, fold it in. Ask again only if the new text opens a new blocking gap.

If they say to rewrite now, go to phase 3. Do not invent the missing facts. Omit the sentence, or keep their wording where the gap is.

## Phase 3 — Rewrite

Edit the post file.

Keep their facts, names, and the sentences phase 1 marked as voice. Change order, grammar, and the joins. Do not add experiences, tools, or opinions they did not state. Do not add a second essay beside the one they chose.

Shape for this site:

- Frontmatter: `title`, `date` as `YYYY-MM-DD`, `tags`, `description`. The description is the promise the body keeps. Ask for a real date if you still do not have one. Do not leave `2026-xx-xx`.
- Say what the piece is early, in their voice.
- One thread. The other thread stays only where it serves that thread.
- Markdown links, not `[0]` references.
- A pasted skill or spec becomes a short quote or a link, unless they said the spec is the point.
- Headings: first word and proper nouns only.

After writing, read the post once for a dropped thread or a contradiction, and run:

```bash
python3 .agents/skills/check-repetition/scripts/check_repetition.py posts/<post>.md \
  --word-min 4 --phrase-min 2
```

Fix a break or a tic you introduced. Do not report a clean run, and do not open a new round of questions.

In chat, say what the piece is now. Do not recap every edit.

## Example

A draft that tours tools, then asks how you can trust code you do not understand, then switches tool again and pastes a skill.

Review opens with the abandoned question, names the second piece (which tool, how a ticket is isolated), and says those two never meet. It keeps the paragraph that already sounds like the user. The first question is which of the two the post is.
