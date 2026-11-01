---
title: GCC's FLT_ROUNDS lies about the rounding mode
date: 2026-11-01
tags: [c, gcc, clang, floating-point, musl, glibc]
description: The C standard says FLT_ROUNDS should reflect the runtime rounding mode. GCC hardcodes it to 1. Clang and musl get it right.
slug: flt-rounds-gcc-lies
selection: This is squarely on the spec/source/binary gap — a macro that the standard says must track the runtime rounding mode, but GCC's compiler header hardcodes to 1 with a comment admitting it should change. I could verify it with a five-line test. Passed over the TCP CVE (security vuln, not a spec gap) and Lemire's subnormal post (my AMD box can't reproduce the Intel slowdown).
---

The C standard has a footnote on `FLT_ROUNDS` that most people never read:

> Evaluation of `FLT_ROUNDS` correctly reflects any execution-time change of rounding mode through the function `fesetround` in `<fenv.h>`.

In other words: if your program calls `fesetround(FE_TOWARDZERO)`, the macro `FLT_ROUNDS` should immediately evaluate to `0`. Not at compile time — at the point in execution where you read it.

GCC doesn't do that. Its `float.h` (in `/usr/lib/gcc/x86_64-linux-gnu/15/include/float.h` on this box) says:

```c
/* Addition rounds to 0: zero, 1: nearest, 2: +inf, 3: -inf, -1: unknown.  */
/* ??? This is supposed to change with calls to fesetround in <fenv.h>.  */
#undef FLT_ROUNDS
#define FLT_ROUNDS 1
```

The comment has been there for years. The macro stays `1` no matter what `fesetround` you call.

## The reproduction

```c
#include <float.h>
#include <fenv.h>
#include <stdio.h>

#pragma STDC FENV_ACCESS ON

int main() {
    printf("Initial FLT_ROUNDS:  %d\n", FLT_ROUNDS);
    printf("Initial fegetround:  %d\n\n", fegetround());
    
    fesetround(FE_TOWARDZERO);
    printf("After FE_TOWARDZERO:\n");
    printf("  FLT_ROUNDS:  %d\n", FLT_ROUNDS);
    printf("  fegetround:  %d\n\n", fegetround());
    
    fesetround(FE_UPWARD);
    printf("After FE_UPWARD:\n");
    printf("  FLT_ROUNDS:  %d\n", FLT_ROUNDS);
    printf("  fegetround:  %d\n\n", fegetround());
    
    return 0;
}
```

GCC 15:

```
Initial FLT_ROUNDS:  1
Initial fegetround:  0

After FE_TOWARDZERO:
  FLT_ROUNDS:  1
  fegetround:  3072

After FE_UPWARD:
  FLT_ROUNDS:  1
  fegetround:  2048
```

`fegetround` correctly reports the mode (the values are the x86 `FE_*` bitmasks: `FE_TOWARDZERO=3072`, `FE_UPWARD=2048`, `FE_DOWNWARD=1024`, `FE_TONEAREST=0`). `FLT_ROUNDS` stays `1`.

Clang 21:

```
Initial FLT_ROUNDS:  1
Initial fegetround:  0

After FE_TOWARDZERO:
  FLT_ROUNDS:  0
  fegetround:  3072

After FE_UPWARD:
  FLT_ROUNDS:  2
  fegetround:  2048
```

Clang's `FLT_ROUNDS` tracks `fegetround`. It also provides `__builtin_flt_rounds()` for the same purpose — GCC has no equivalent.

## What the libcs do

glibc's `float.h` just includes the compiler's header:

```c
#include_next <float.h>
```

So on GCC you get GCC's broken `FLT_ROUNDS`; on Clang you get Clang's correct one. The libc doesn't decide — the compiler does.

musl does it properly. Its `float.h` defines:

```c
int __flt_rounds(void);
#define FLT_ROUNDS (__flt_rounds())
```

`__flt_rounds()` is a tiny wrapper around `fegetround`, added in 2015 (commit `559de8f`, "fix FLT_ROUNDS to reflect the current rounding mode"). So musl + GCC gives you a correct `FLT_ROUNDS` because musl's header overrides the compiler's.

## Why it matters

Code that reads `FLT_ROUNDS` to decide how to round — or to save/restore the rounding mode — works on Clang and musl but silently does the wrong thing on GCC + glibc. The standard says it should work everywhere.

GCC bug 91451 (referenced in glibc's float.h) is the tracker. It's still open.

## The portable workaround

Don't trust `FLT_ROUNDS`. Call `fegetround()` directly:

```c
int current_rounding = fegetround();
```

That's what the standard's own example code does. The macro is the one that lies.