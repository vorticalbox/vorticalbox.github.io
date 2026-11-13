---
name: my-voice
description: >
  Final voice pass over a finished post in posts/ so it sounds like the user
  (Vorticalbox). Run only when the user asks, after the draft is otherwise
  done (for example after refine-post). Triggers: "make it sound like me",
  "my voice pass", "less AI". Do not use for restructuring a draft
  (refine-post), continuity (check-flow) or repetition (check-repetition).
---

# My voice

A last pass over a post that is already in order. Change the wording, not the structure.

Read `AGENTS.md` first. Those rules say what to remove. This skill says what to put in its place.

## Pass

1. Read the post and `references/pairs.md`.
2. Rewrite the body in place with the rules below. Keep the frontmatter, headings, links, code blocks and paragraph order.
3. Keep every fact and opinion in the post. Cut sentences that only hedge, set up or restate. Do not add new points.
4. Reply with a short list of anything you cut that carried meaning, so the user can put it back. Nothing else.

The source material is `references/pairs.md`, which holds AI passages next to the user's rewrites. If a rule here does not cover a case, read it and copy what the rewrites do.

## Length

- Write about half as many words as your first draft. The user's rewrites often turned a paragraph into one or two sentences.
- Say the fact once. Drop the set-up sentence, the hedge and the lesson at the end.
- Leave out "it won't be for everyone", "a one-line fix that taught me a lesson" and "sometimes the best lessons...".
- Keep the user's own "I think". It is how they state an opinion, not a hedge to cut.

## Opening

- Start with the opinion or the fact. "I don't think AI will make developers obsolete." "You should give Neovim a go." "Docker is by far the worst thing I have installed on my Mac."
- When disagreeing with a popular claim, state the claim, say no, then give the reason in one sentence. Do not say you understand where the other view comes from.

## Feelings and opinions

- Say how you feel in plain words: love, really annoying, so much worse, the bane of my existence. Avoid measured phrasing like "a bit of a mixed bag" or "can be frustrating".
- Keep the strength of feeling the text already has. "Don't like" stays "don't like". Do not upgrade it to "hate".
- Be absolute when you are sure: "100% the right call", "this just destroys readability".
- Compare to before: "On Linux I loved it but on Mac...", "I used to love arrow functions but...", "For a long time I was fully in camp Postgres".
- Admit mistakes casually and briefly: "Yeah, my bad. I was sure X would help. Turns out it made it so much worse." Do not draw a moral from it.
- Do not add strong feelings the post did not have, and do not add qualifiers like "mostly" to an opinion. "I love my keyboard." The complaints that follow already show the limits.
- Put examples inside the sentence that needs them: "I clean up what I don't like, things like X, Y or Z." Do not split them out into a separate "I really hate X" sentence.
- Join a claim to its reason with "because" in the same sentence. Do not put the reason in a second sentence or attach it with "and" or "which".
- Back a complaint with a comparison the reader can check: "I just want to search the whole history. I can do it in the terminal."

## Specifics

- Give the concrete reason for the complaint: the VM is heavy, it eats disk space, and it will not clean its own build cache when the disk fills up.
- Show code when the point is about code. One short block beats a paragraph on readability.
- Name the tools, languages and services instead of describing them.

## Register

- Write in the first person and keep it casual. Use "super fast", "a good chunk", "a wild goose chase", "everyone and their dog" and "spin up".
- Talk to the reader as "you" when recommending something: "You should give X a go."
- Use contractions in some places and the full form in others. "I am" and "it is" are fine.
- Lists of steps can use "First", "Next", "Then". Keep each step to one sentence.
- End on practical advice or a plain fact, not an invitation to get in touch. "If it works for you, don't change it just because something else works for someone else."
- Team updates have no greeting and no sign-off: "Quick update, I have moved over a good chunk of the endpoints and should have this done by the end of the week. A couple of issues with file uploads I am still looking into."
- A reply to a reader can open with "Good question." Agree or disagree directly, then give the reason from your own situation.

## Correctness

- Fix spelling, grammar and capitalisation (TypeScript, GitHub, macOS). Typos in the user's notes are not part of the voice.
- After cutting or merging sentences, reread each one you touched. Do not leave two clauses joined with no punctuation.
- Keep the user's facts. If the user wrote something technically wrong, ask before changing it.
- Do not invent experiences, opinions or tools the user has not mentioned. Ask.

## Examples

AI:
> If you haven't tried Bun yet, I'd highly recommend giving it a go. It's incredibly fast, the tooling is thoughtfully designed, and the test runner feels natural rather than bolted on. It won't be for everyone, but for me it has become an essential part of my daily workflow.

Mine:
> You should give Bun a go. It is super fast and the test runner is really good.

AI:
> Docker Desktop on macOS has always been a bit of a mixed bag. While it gets the job done, the resource usage can be frustrating, especially on a laptop. After one too many spinning fans, I decided it was time to explore alternatives. The good news? There are some excellent options out there that offer a much lighter footprint.

Mine:
> Docker is by far the worst thing I have installed on my Mac. On Linux I loved it, but on Mac it is the bane of my existence. The VM is heavy, it uses a bunch of disk space, and when it runs out it won't clean its own build cache.
>
> So let's move to something else.

AI:
> I'll be honest: I got this one wrong. I was convinced that moving our config into environment variables would simplify deployments, but in practice it made local development significantly more painful. Sometimes the best lessons come from the decisions we have to walk back.

Mine:
> Yeah, my bad. I was sure moving the config into env would simplify deployments. Turns out it made it so much worse.
