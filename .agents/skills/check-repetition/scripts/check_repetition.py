#!/usr/bin/env python3
"""Report repeated words and phrases in blog posts without modifying them."""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


WORD_RE = re.compile(r"[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*")
DEFAULT_STOPWORDS = {
    "a", "about", "after", "again", "against", "all", "also", "am", "an",
    "and", "any", "are", "as", "at", "be", "because", "been", "before",
    "being", "between", "both", "but", "by", "can", "could", "did", "do",
    "does", "doing", "down", "each", "even", "for", "from", "had", "has",
    "have", "having", "he", "her", "here", "hers", "herself", "him", "himself",
    "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself",
    "just", "me", "more", "most", "my", "myself", "no", "not", "now", "of",
    "off", "on", "once", "only", "or", "other", "our", "ours", "out", "over",
    "own", "said", "same", "she", "should", "so", "some", "such", "than",
    "that", "the", "their", "them", "themselves", "then", "there", "these",
    "they", "this", "those", "through", "to", "too", "under", "up", "very",
    "was", "we", "were", "what", "when", "where", "which", "while", "who",
    "why", "will", "with", "would", "you", "your", "yours",
}


@dataclass(frozen=True)
class Token:
    text: str
    path: Path
    line: int
    block: int


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path, help="Files or directories to scan")
    parser.add_argument("--mode", choices=("all", "words", "phrases"), default="all")
    parser.add_argument("--word-min", type=positive_int, default=8)
    parser.add_argument("--phrase-min", type=positive_int, default=3)
    parser.add_argument("--min-words", type=positive_int, default=3)
    parser.add_argument("--max-words", type=positive_int, default=8)
    parser.add_argument("--min-gap-lines", type=nonnegative_int, default=0)
    parser.add_argument("--include", action="append", default=[], metavar="GLOB")
    parser.add_argument("--exclude", action="append", default=[], metavar="GLOB")
    parser.add_argument("--stopwords", type=Path, metavar="FILE")
    parser.add_argument("--find", action="append", default=[], metavar="TEXT")
    parser.add_argument("--max-results", type=positive_int, default=50)
    parser.add_argument("--max-locations", type=positive_int, default=12)
    parser.add_argument("--json", action="store_true", dest="as_json")
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Count YAML frontmatter and fenced code blocks too",
    )
    args = parser.parse_args(argv)
    if args.min_words > args.max_words:
        parser.error("--min-words cannot exceed --max-words")
    return args


def positive_int(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return number


def nonnegative_int(value: str) -> int:
    number = int(value)
    if number < 0:
        raise argparse.ArgumentTypeError("must be at least 0")
    return number


def matches_any(path: Path, patterns: Sequence[str]) -> bool:
    text = path.as_posix()
    return any(fnmatch.fnmatch(text, pattern) or fnmatch.fnmatch(path.name, pattern) for pattern in patterns)


def collect_files(paths: Sequence[Path], includes: Sequence[str], excludes: Sequence[str]) -> list[Path]:
    patterns = list(includes) or ["*.md", "*.txt"]
    found: set[Path] = set()
    for supplied in paths:
        path = supplied.expanduser()
        if not path.exists():
            raise FileNotFoundError(path)
        candidates: Iterable[Path] = path.rglob("*") if path.is_dir() else (path,)
        for candidate in candidates:
            if not candidate.is_file():
                continue
            if not matches_any(candidate, patterns) or matches_any(candidate, excludes):
                continue
            found.add(candidate.resolve())
    return sorted(found, key=lambda item: item.as_posix())


def normalize_word(word: str) -> str:
    return word.lower().replace("’", "'")


def prose_lines(text: str, raw: bool) -> Iterable[tuple[int, str]]:
    lines = text.splitlines()
    skip_until = 0
    if not raw and lines and lines[0].strip() == "---":
        for index, line in enumerate(lines[1:], start=1):
            if line.strip() == "---":
                skip_until = index + 1
                break
    in_fence = False
    for line_number, line in enumerate(lines, start=1):
        if line_number <= skip_until:
            continue
        if not raw and line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if not raw and in_fence:
            continue
        yield line_number, line


def tokenize(files: Sequence[Path], raw: bool = False) -> tuple[list[Token], dict[Path, list[Token]]]:
    all_tokens: list[Token] = []
    by_file: dict[Path, list[Token]] = {}
    for path in files:
        file_tokens: list[Token] = []
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError as error:
            raise ValueError(f"{path}: expected UTF-8 text") from error
        block = 0
        for line_number, line in prose_lines(text, raw):
            if not line.strip():
                block += 1
                continue
            for match in WORD_RE.finditer(line):
                file_tokens.append(Token(normalize_word(match.group()), path, line_number, block))
        by_file[path] = file_tokens
        all_tokens.extend(file_tokens)
    return all_tokens, by_file


def load_stopwords(path: Path | None) -> set[str]:
    words = set(DEFAULT_STOPWORDS)
    if path:
        for line in path.read_text(encoding="utf-8").splitlines():
            value = line.strip().lower()
            if value and not value.startswith("#"):
                words.add(normalize_word(value))
    return words


def location(token: Token) -> dict[str, object]:
    return {"file": token.path.as_posix(), "line": token.line}


def separated_locations(tokens: Sequence[Token], min_gap: int) -> list[Token]:
    if min_gap == 0:
        return list(tokens)
    kept: list[Token] = []
    last_line_by_file: dict[Path, int] = {}
    for token in tokens:
        previous = last_line_by_file.get(token.path)
        if previous is None or token.line - previous >= min_gap:
            kept.append(token)
            last_line_by_file[token.path] = token.line
    return kept


def located_result(items: Sequence[Token], max_locations: int) -> dict[str, object]:
    return {
        "count": len(items),
        "locations": [location(item) for item in items[:max_locations]],
        "locations_omitted": max(0, len(items) - max_locations),
    }


def word_results(
    tokens: Sequence[Token], stopwords: set[str], minimum: int, max_locations: int
) -> list[dict[str, object]]:
    occurrences: dict[str, list[Token]] = defaultdict(list)
    for token in tokens:
        if token.text not in stopwords and not token.text.isdigit():
            occurrences[token.text].append(token)
    results = [
        {"word": word, **located_result(items, max_locations)}
        for word, items in occurrences.items()
        if len(items) >= minimum
    ]
    return sorted(results, key=lambda item: (-int(item["count"]), str(item["word"])))


def phrase_results(
    by_file: dict[Path, list[Token]],
    stopwords: set[str],
    min_words: int,
    max_words: int,
    minimum: int,
    min_gap: int,
    max_locations: int,
) -> list[dict[str, object]]:
    occurrences: dict[tuple[str, ...], list[Token]] = defaultdict(list)
    for tokens in by_file.values():
        for size in range(min_words, max_words + 1):
            for index in range(0, len(tokens) - size + 1):
                window = tokens[index:index + size]
                if window[0].block != window[-1].block:
                    continue
                phrase = tuple(token.text for token in window)
                occurrences[phrase].append(tokens[index])

    candidates: list[tuple[tuple[str, ...], list[Token]]] = []
    for phrase, starts in occurrences.items():
        starts = separated_locations(starts, min_gap)
        if len(starts) >= minimum and any(word not in stopwords for word in phrase):
            candidates.append((phrase, starts))

    # Prefer the longest form when a shorter phrase has the same occurrence starts.
    candidates.sort(key=lambda item: (-len(item[0]), -len(item[1]), item[0]))
    kept: list[tuple[tuple[str, ...], list[Token]]] = []
    for phrase, starts in candidates:
        redundant = False
        for longer, longer_starts in kept:
            if len(longer) <= len(phrase):
                continue
            if not contains_subsequence(longer, phrase):
                continue
            if len(starts) == len(longer_starts):
                redundant = True
                break
        if not redundant:
            kept.append((phrase, starts))

    results = [
        {
            "phrase": " ".join(phrase),
            "words": len(phrase),
            **located_result(starts, max_locations),
        }
        for phrase, starts in kept
    ]
    return sorted(
        results,
        key=lambda item: (-int(item["count"]), -int(item["words"]), str(item["phrase"])),
    )


def contains_subsequence(container: Sequence[str], candidate: Sequence[str]) -> bool:
    size = len(candidate)
    return any(tuple(container[index:index + size]) == tuple(candidate) for index in range(len(container) - size + 1))


def find_results(
    by_file: dict[Path, list[Token]], queries: Sequence[str], max_locations: int
) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for raw_query in queries:
        query = tuple(normalize_word(match.group()) for match in WORD_RE.finditer(raw_query))
        starts: list[Token] = []
        if query:
            for tokens in by_file.values():
                for index in range(0, len(tokens) - len(query) + 1):
                    window = tokens[index:index + len(query)]
                    if window[0].block == window[-1].block and tuple(token.text for token in window) == query:
                        starts.append(tokens[index])
        results.append({
            "query": raw_query,
            **located_result(starts, max_locations),
        })
    return results


def compact_locations(locations: Sequence[dict[str, object]]) -> str:
    return ", ".join(f"{item['file']}:{item['line']}" for item in locations)


def print_locations(item: dict[str, object]) -> None:
    if item["locations"]:
        suffix = f" (+{item['locations_omitted']} more)" if item["locations_omitted"] else ""
        print(f"        {compact_locations(item['locations'])}{suffix}")


def print_text(report: dict[str, object], maximum: int) -> None:
    print(f"Scanned {report['file_count']} files, {report['word_count']} words.")
    finds = report.get("finds", [])
    if finds:
        print("\nExact searches")
        for item in finds:
            print(f"  {item['count']:>4}  {item['query']}")
            print_locations(item)
    words = report.get("words", [])
    if words:
        print("\nRepeated words")
        for item in words[:maximum]:
            print(f"  {item['count']:>4}  {item['word']}")
            print_locations(item)
    phrases = report.get("phrases", [])
    if phrases:
        print("\nRepeated phrases")
        for item in phrases[:maximum]:
            print(f"  {item['count']:>4}  {item['phrase']}")
            print_locations(item)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        files = collect_files(args.paths, args.include, args.exclude)
        if not files:
            raise ValueError("no matching files found")
        tokens, by_file = tokenize(files, raw=args.raw)
        stopwords = load_stopwords(args.stopwords)
    except (FileNotFoundError, OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    report: dict[str, object] = {
        "file_count": len(files),
        "word_count": len(tokens),
        "files": [path.as_posix() for path in files],
    }
    if args.find:
        report["finds"] = find_results(by_file, args.find, args.max_locations)
    if args.mode in ("all", "words"):
        report["words"] = word_results(tokens, stopwords, args.word_min, args.max_locations)[:args.max_results]
    if args.mode in ("all", "phrases"):
        report["phrases"] = phrase_results(
            by_file, stopwords, args.min_words, args.max_words, args.phrase_min,
            args.min_gap_lines, args.max_locations
        )[:args.max_results]

    if args.as_json:
        json.dump(report, sys.stdout, indent=2)
        print()
    else:
        print_text(report, args.max_results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
