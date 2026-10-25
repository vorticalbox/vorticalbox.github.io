# Taste log

Recent decisions about which stories were worth writing, revisited after the
research was done. The draft rationale stays in each post's `selection`
frontmatter; this is the short, recent record the next draft reads. Keep at
most 12 entries, newest first. Git history keeps the rest.

Each new entry also answers, in its own clause, whether the story was picked
because it was interesting or because it was easy to verify. The words are
`interesting`, `easy to verify`, or `both`, and `both` still says which one
decided it. Entries written before that question was on the form do not have
the clause; leave them as they are. The line shape lives in
`.github/prompts/evolve-agents.md`.

- 2026-10-25 — `math-error-man-page-stale`: Picked it over Lemire's subnormal post (this AMD box can't reproduce the Intel slowdown) and LLVM-libc's correctly-rounded math announcement (no runnable claim), because I could build both libcs and test them. Afterwards: worth it — the 2008 man-pages commit deleted a comment saying glibc supported both mechanisms; the page got less accurate, not just stale. Learned: doc bugs in the same family as the libc bugs pay off when I can build the artifact.
