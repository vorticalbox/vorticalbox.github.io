---
name: check-repetition
description: >
  Find repeated words and phrases in blog posts under posts/. Use when
  reviewing a draft for overused wording, repeated exposition, accidental
  phrase reuse, or verbal tics. Report findings. Do not rewrite unless the
  user explicitly asks for edits.
---

# Check repetition

Run the bundled analyzer on post source, then interpret the results. Counts are candidates, not defects. Names, tool names, and a repeated term that is the subject of the post can stay.

The script skips YAML frontmatter and fenced code blocks. A pasted spec or sample should not inflate the counts. Pass `--raw` only when the user wants those included.

## Workflow

1. Scan the post the user named. If they did not name one, scan `posts/`. Do not point the script at the repo root, `dist/`, `AGENTS.md`, or this skill.
2. Run:

   ```bash
   python3 .agents/skills/check-repetition/scripts/check_repetition.py posts/<post>.md \
     --word-min 4 --phrase-min 2
   ```

   For every post at once, raise the bar so shared ordinary words do not dominate:

   ```bash
   python3 .agents/skills/check-repetition/scripts/check_repetition.py posts/ \
     --word-min 8 --phrase-min 3
   ```

3. For a known word or phrase, use `--find` once per query:

   ```bash
   python3 .agents/skills/check-repetition/scripts/check_repetition.py posts/<post>.md \
     --find "worktree"
   ```

4. Read the cited lines before judging them. Rank a hit by whether it repeats information or emphasis, not by the count alone.
5. Report the file path and line numbers. Split likely problems from repetition that earns its place.
6. Do not edit the post unless the user asks.

## Useful options

- `--mode all|words|phrases`: select report sections.
- `--word-min N`: minimum count for a single word. Use `4` on one post, `8` on `posts/`.
- `--phrase-min N`: minimum count for a phrase. Use `2` on one post, `3` on `posts/`.
- `--min-words N`, `--max-words N`: phrase length range. Defaults are `3` and `8`.
- `--min-gap-lines N`: ignore a repeat that starts within this many lines of the previous hit.
- `--include GLOB` / `--exclude GLOB`: file filters. Default include is `*.md` and `*.txt`.
- `--raw`: also count frontmatter and fenced code.
- `--stopwords FILE`: extra words to drop from the word list, one per line.
- `--max-results N`: cap each section. Default `50`.
- `--max-locations N`: cap printed locations per hit. Default `12`. The count stays exact.
- `--json`: machine-readable output.

The script never modifies the posts.
