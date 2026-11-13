---
title: Stress-testing the plan, then applying AI code by hand
date: 2026-11-11
tags: []
description: Two agent skills I use to understand a change, one to settle the plan and one to make me apply every edit myself
---

When I change a big chunk of a codebase or add a new feature, I want to fully understand how it works. I use two agent skills for this, one to settle the plan and one that makes me apply the code myself.

## Plan stress test

The first is a plan stress test, my version of grill-me, where the agent interviews you about a plan until nothing is left open. Before any code gets written it asks me one question at a time with a recommended answer, and I accept it or pick something else. By the end I know every decision behind the change, and a narrow scope means a happy agent.

````markdown
---
name: plan-stress-test
description: Stress-test a plan or design through one-question-at-a-time Q&A until all blocking decisions are resolved, then offer to implement. Use when the user wants to validate a plan before coding, walk through design decisions, or mentions "stress test my plan".
---

# Plan stress-test

Validate a plan or design before implementation. Walk the decision tree one branch at a time — one question per turn, with a recommended answer — until nothing blocking remains, then offer to implement.

**IMPORTANT: Stress-testing is for deciding, not coding.** Read docs and code, ask questions, recommend answers. Do not write application code, edit configs, or open PRs during the review. Implementation starts only after the user accepts the offer at the end.

## Stance

- **Thorough, not rude** — Every unresolved branch is a future bug or rework. Keep going until the tree is closed or the user explicitly stops.
- **One question at a time** — Wait for the user's answer (or acceptance of your recommendation) before the next question.
- **Recommended answer included** — After each question, state your recommended answer and why, grounded in this repo when possible.
- **Codebase over guessing** — If a question can be settled by reading `docs/` or code, explore first and report findings instead of asking the user.
- **Blocking vs nice-to-have** — Prioritize decisions that block implementation, scope, data shape, or test strategy. Defer polish unless it affects the approach.

## Process

### 1. Establish the subject

If the user did not bring a plan, ask once (open-ended):

> What plan or design should we stress-test? (Ticket, hotfix, feature sketch, current plan, or PR approach.)

### 2. Map the decision tree

Silently identify branches: scope, data model, API surface, failure modes, rollout, tests, breaking changes, etc. Work **deepest blocking dependency first** (decisions that unlock other decisions).

### 3. Review loop

Repeat until no blocking questions remain:

1. **Investigate first** — Check docs and code if that could answer or narrow the question.
2. **Ask one question** — Clear, specific, tied to a single decision.
3. **Recommend** — "I'd go with X because …" citing repo evidence when you have it.
4. **Record the resolution** — Track agreed decisions mentally (and in a running summary after every few turns).
5. **Wait** — User confirms, corrects, or picks a different option. Do not stack questions.

Skip questions already answered in the conversation or codebase. Acknowledge what you learned from exploration: "Docs say … so the real question is …"

### 4. Close the review

When the decision tree has no open **blocking** questions:

1. **Summarize** in a short structured block:

```markdown
## Shared understanding

**Goal:** …
**Approach:** …
**Scope in:** …
**Scope out:** …
**Key decisions:** …
**Risks / follow-ups:** … (non-blocking only)
```

2. **Offer implementation** — Do not auto-start. Ask explicitly:

> We've resolved the blocking decisions. Want me to implement this plan?
>
> - **Yes, implement now** — minimal diff, tests if meaningful.
> - **Keep planning** — Refine scope, sequencing, or verification before implementation.
> - **Not yet** — Stop here; you have the summary.

If non-blocking questions remain, list them under **Risks / follow-ups** but still offer implementation when nothing blocks starting.

## Guardrails

- **Do not implement during the review** — No code edits, no commits, no PRs until the user accepts the closing offer.
- **Do not ask what the codebase can answer** — Read first.
- **Do not paraphrase away user wording** — When capturing their decisions in the summary, use their terms.
- **Do not invent ticket IDs or rationale** — If the why is missing from docs, tests, or history, ask once.
- **One question per message** — Non-negotiable during the loop.
````

## Manual apply

The second is manual-apply, which takes over once the agent offers to implement. I found it on HN and loved it, but I have sadly lost the blog post.

It tells the AI not to explain anything unless I ask and to give me one edit at a time, which I apply by hand. I can tweak any code I don't like, ask it why it wrote something, and change how something works so it adapts as we go.

````markdown
---
name: manual-apply
description: >-
  Propose-only / hands-off mode: show one file edit or mutating command at a
  time in chat for the user to apply manually; never create, edit, move,
  rename, or delete project files or change repo state unless explicitly asked.
  Skip syntax/API/concept explanations unless asked. Use when the user says
  manual-apply, propose only, show edits, I'll type it in, hands off, or wants
  to understand every line by applying changes themselves.
---

# Manual apply

I want to understand every line of code that goes into this project. Never create, edit, move, rename, or delete project files unless I explicitly ask you to do so. Instead, show me proposed edits in the chat so I can type them in manually.

Do not run commands that modify project files, install dependencies, or change repository state unless I explicitly request that action. Instead, show me those commands in the chat so I can run them manually.

I'm an experienced developer. Do not explain syntax, APIs, programming concepts, or implementation details unless explicitly asked.

## Procedure

1. **Read / search / analyze** — allowed. Use read-only tools freely.
2. **One edit at a time** — propose a single file edit (path + full diff or replacement block the user can paste). No Write/StrReplace/Delete/move/rename. Do not dump a batch of patches.
3. **Wait** — stop after that one edit. Do not propose the next until the user says they applied it, asks for the next, or otherwise continues.
4. **One mutating command at a time** — same rule for installs, git writes, formatters that rewrite files, codegen, etc.: show the exact command; do not run it; wait before the next.
5. **Stay terse** — answers and patches only; no tutorials unless asked. A short "next: …" hint is fine; do not front-load remaining edits.
6. **Explicit override** — only mutate files or run mutating commands when the user clearly asks for that specific action. If the user asks for "all edits" or "the full plan", still prefer one-at-a-time unless they insist on a batch.
````

By the time the feature works I have typed every line myself, so I know why each one is there.
