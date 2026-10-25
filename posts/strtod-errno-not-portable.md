---
title: The strtod error check the man page recommends isn't portable
date: 2026-10-12
tags: [c, musl, portability, plain text]
description: The Linux man page says to set errno to 0 and check it after strtod. On Alpine that means something different than on Ubuntu, and C23 quietly changed the rule.
slug: strtod-errno-not-portable
---

The `strtod(3)` man page has a NOTES section that hands you a recipe:

> Since 0 can legitimately be returned on both success and failure, the calling program should set `errno` to 0 before the call, and then determine if an error occurred by checking whether `errno` has a nonzero value after the call.

I ran that recipe against the two libcs that matter on Linux. It gives different answers for the same input.

## The reproduction

```c
errno = 0;
char *end;
double x = strtod(s, &end);
printf("strtod(\"%s\") -> %-5g  errno=%-2d  endptr==nptr=%d\n",
       s, x, errno, end == s);
```

glibc 2.39 (Ubuntu 24.04), gcc 13:

```
math_errhandling = 3
strtod("x")     -> 0    errno=0   endptr==nptr=1
strtod("")      -> 0    errno=0   endptr==nptr=1
strtod("1e999") -> inf  errno=34  endptr==nptr=0
strtod("1e-999")-> 0    errno=34  endptr==nptr=0
```

musl 1.2.6 (Alpine), same source, same flags:

```
math_errhandling = 2
strtod("x")     -> 0    errno=22  endptr==nptr=1
strtod("")      -> 0    errno=22  endptr==nptr=1
strtod("1e999") -> inf  errno=34  endptr==nptr=0
strtod("1e-999")-> 0    errno=34  endptr==nptr=0
```

The only difference is the first two lines — invalid input. glibc leaves `errno` at 0; musl sets it to 22 (`EINVAL`). So the man page's recipe, `errno = 0; strtod(...); if (errno != 0) fail`, rejects `"x"` on Alpine and accepts it as a perfectly good `0.0` on Ubuntu. Same code, opposite verdicts. The man page's ERRORS section lists only `ERANGE`.

## Why they differ

musl sets `EINVAL` on purpose. It's in `src/internal/floatscan.c`, the parser behind `strtod`, three times. The man page never mentions it.

POSIX permits it: "If no conversion could be performed, 0 shall be returned, and `errno` may be set to `[EINVAL]`." The *may* is doing the work. C11 doesn't require it — 7.22.1.3p10 says only "If no conversion could be performed, zero is returned", and 7.5p3 allows a library to set `errno` to nonzero "whether or not there is an error, provided the use of `errno` is not documented in the description of the function". Since `strtod`'s description *does* document `errno` (for `ERANGE`), musl's `EINVAL` sits outside the letter of C11. musl is POSIX-first, and POSIX allows it. Both libcs are defensible; that is the problem.

## C23 moved the goalposts

It gets better. In C11, overflow stores `ERANGE` in `errno`, full stop. C23 reworded the `strtod` family to gate that on `math_errhandling`:

> if the integer expression `math_errhandling & MATH_ERRNO` is nonzero, the integer expression `errno` acquires the value of `ERANGE`; if the integer expression `math_errhandling & MATH_ERREXCEPT` is nonzero, the "overflow" floating-point exception is raised.

musl defines `math_errhandling` as 2 — `MATH_ERREXCEPT` only, no `MATH_ERRNO`. You can see it in the output above. So the C23 wording says musl needn't set `errno` on overflow at all. It does anyway, because POSIX requires it. The macro that is supposed to tell you which mechanism to use is not the macro that predicts what musl does.

## This has been known for years

It isn't new. In June 2017, Xiaowei Zhan posted to the musl list with `strtod("NA023", NULL)` and the two different `errno` values. In February 2024, Marian Buschsieweke hit it in ngspice, which parses numeric-or-string tokens and assumed the glibc behaviour. Markus Wichmann's reply on the list is the whole answer: "ngspice assuming it doesn't happen is just wrong. The correct way to test if any conversion happened is to compare the final value of `endp` with the first argument, because if no conversion could happen, `endp` *must* be set to the first argument."

And the `errno` path has holes even where it's supposed to work. In April 2025, Lénárd Szolnoki reported a hex float just above `DBL_MAX`:

```
strtod("0x1.fffffffffffff8p+1023")
  glibc: -> inf  errno=34 (ERANGE)
  musl:  -> inf  errno=0  (not ERANGE)
```

The `FE_OVERFLOW` exception does fire on musl, so the `fetestexcept` path catches it — but branch on `errno` and you miss it. A musl maintainer agreed the hex-float overflow check "should be fixed". It still isn't in 1.2.6, the version Alpine ships.

## What actually works

- **Invalid input:** check `endptr == nptr`. That is the only portable test. `errno` is not one.
- **Overflow/underflow:** branch on `math_errhandling` — `errno == ERANGE` or `fetestexcept(FE_OVERFLOW | FE_UNDERFLOW)` — or skip both and compare the result against `HUGE_VAL` or `0.0`, accepting that underflow is not required to be reported at all. C11 says whether underflow sets `ERANGE` is implementation-defined.
- **The man page's recipe:** don't. It compiles everywhere and means something different on each libc.

The thing that is wrong here is the man page. It documents `ERANGE`, recommends the `errno` recipe in NOTES, and never says that the two libcs under it disagree about `EINVAL`, or that C23 changed the overflow rule out from under the advice. A one-line warning — "`EINVAL` is set by some implementations when no conversion is performed; use `endptr` to detect this portably" — would have saved ngspice a bug report and me an afternoon. The page's `math_errhandling` NOTES have the same problem: they still say glibc does not support the macro, an eighteen-year-old claim about glibc 2.8. I checked that one against the artifact too — [the man page still describes glibc 2.8](/posts/math-error-man-page-stale/).
