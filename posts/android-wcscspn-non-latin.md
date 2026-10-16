---
title: Android 17's wcscspn treats every non-Latin character as a match
date: 2026-10-16
tags: [c, libc, android, reverse-engineering]
description: The public AOSP source implements wcscspn as a plain loop and is correct. The September Pixel build doesn't, and the branch that would explain the difference isn't published.
slug: android-wcscspn-non-latin
---

On Android 17 builds from September 2026, `wcscspn()` and `wcspbrk()` stop at the first wide character at or above U+0100 whenever the reject set has two or more characters that are all below U+0100. The character is reported as a match even though it is not in the set. Any code scanning a wide string for an ASCII delimiter breaks as soon as the text contains an emoji, CJK, Cyrillic, or Greek. The report is [android/ndk#2260](https://github.com/android/ndk/issues/2260), opened by francisdb on 12 October.

I read the source the report points at. The AOSP `android17-release` branch builds `wcscspn` from `external/llvm-libc`, and the shared implementation is a plain nested loop:

```c
LIBC_INLINE static size_t wcsspn(const wchar_t *s1, const wchar_t *s2,
                                 bool not_match_set) {
  size_t i = 0;
  for (; s1[i]; ++i) {
    bool in_set = internal::wcschr(s2, s1[i]);
    if (in_set == not_match_set)
      return i;
  }
  return i;
}
```

`wcscspn` calls it with `not_match_set = true`, `wcsspn` with false. The same file on upstream LLVM's `main` is identical. There is no table, no branch on the size of the set, and nothing special about U+00FF.

The shipped binary is not this code. Disassembling `wcscspn` in `/apex/com.android.runtime/lib64/bionic/libc.so` on `CP3A.260905.009`, the reporter found three paths chosen by the set: a plain compare loop for one character; a 256-byte `bool` table for two or more characters below U+0100, with a fallback to `wcschr` if any set member is U+0100 or above; and, inside the table path, this:

```
a2564:  ldrb  w8, [x9, x8]        ; table[c]
a2568:  tbnz  w8, #0, a2578       ; in set -> stop
a256c:  ldr   w8, [x22, #0x4]!    ; next character
a2570:  cmp   w8, #0x100
a2574:  b.lo  a2564               ; c < 0x100 -> keep scanning
a2578:  ...                       ; c >= 0x100 -> STOP, reported as a match
```

A character at or above U+0100 cannot be in a set whose members are all below U+0100, so `wcscspn` has to keep scanning past it. The loop stops instead and returns its index. `wcsspn` has the same shape, and stopping is the correct answer there, which is why only the complement functions are broken; `wcspbrk` calls `wcscspn` and inherits it.

I ran the reporter's input against glibc, where `s = {'a', 0x1F680, 0x100, 'b', 'x', '\n', 0}`:

```
reporter input: wcscspn(s,L"x\n") = 4 (reporter: expected 4, Pixel got 1)
reporter input: wcspbrk -> index 4 (expected 4)
```

Four characters pass before `'x'`, so 4 is the answer. The Pixel returns 1, the index of the first emoji.

I compiled the public source for `aarch64-linux-android30` with clang `-O2` to check whether the compiler had rewritten the loop. It hadn't: the generated `wcscspn` is the nested loop, with no U+0100 compare and no table. The shipped code is a different implementation, not a reinterpretation of the same one.

There was already a test for `wcscspn`, and it is wrong. A bionic collaborator (`enh-google`) pasted the failure:

```
Expected equality of these values:
  2u
  wcscspn(L"he\ufffelo", L"lo")
    Which is: 3
```

The function is right. U+FFFE is not in `"lo"`, so 3 is correct, and glibc returns 3 on the same input. The test asserted 2, which is exactly what the broken table path returns: it stops at the U+FFFE at index 2. The test encodes the bug it was meant to catch, so it would pass on the broken build and fail on a correct one.

Why do the readable source and the shipped binary differ? The readable source is the June release. `android-latest-release` is a manifest that points at `android17-release`, and the public manifest has exactly two Android 17 branches: `android17-release` and `android17-security-release`. There is no `android17-qpr1-release`; Android 16 has both `android16-qpr1-release` and `android16-qpr2-release`. The September Pixel build is QPR1. The same collaborator wrote that `android-latest-release` "seems to still be too old to have any of these changes from april," and a Google engineer (`zenczykowski`) asked in the thread, without an answer, where the source for Android 17 QPR1 actually is.

The breakage is not hypothetical. Visual Pinball on Android stopped loading tables whose VBScript source had an emoji in a comment; its lexer uses `wcspbrk(ptr, L"\n\r")` to find the end of the comment, got the emoji's index instead, and reported "Invalid character". The downstream fix replaces the calls with a plain loop ([vpinball/libwinevbs#41](https://github.com/vpinball/libwinevbs/pull/41)). The Android issue is still open; the collaborator says he will add the missing test, fix the broken one, and run the tests against another libc so a wrong expectation is harder to check in.

The bug is in a table, but the more useful thing is what it says about "read the source" as a first answer. The source you can fetch is correct; the binary is not. Finding that out meant disassembling `libc.so`, and confirming the source was irrelevant meant fetching it and seeing it never had a table.
