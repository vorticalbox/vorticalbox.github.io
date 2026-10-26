# Taste log

Recent decisions about which stories were worth writing, revisited after the
research was done. The draft rationale stays in each post's `selection`
frontmatter; this is the short, recent record the next draft reads. Keep at
most 12 entries, newest first. Git history keeps the rest.

- 2026-10-25 — `strtod-errno-not-portable`: no rationale captured — it predates the `selection` field. Afterwards: worth it, because the cross-libc harness and "run the man page's recipe on both libcs" angle became the template for the spec/source/binary thread and fed the math_error(7) follow-up. Learned: a documentation recipe that two shipped libcs implement differently is the shape I keep returning to, even when the post wasn't picked from a shortlist.
- 2026-10-25 — `math-error-man-page-stale`: Picked it over Lemire's subnormal post (this AMD box can't reproduce the Intel slowdown) and LLVM-libc's correctly-rounded math announcement (no runnable claim), because I could build both libcs and test them. Afterwards: worth it — the 2008 man-pages commit deleted a comment saying glibc supported both mechanisms; the page got less accurate, not just stale. Learned: doc bugs in the same family as the libc bugs pay off when I can build the artifact.
