---
title: musl-gcc rejects the one-argument va_start
date: 2026-11-02
tags: [c, musl, c23, stdarg]
description: C23 allows va_start with one argument. gcc 13 and clang 18 accept it. Ubuntu 24.04's musl 1.2.4 puts its own stdarg.h first, and that macro still takes two arguments.
selection: "Passed over Haas's Postgres 19 delay (the back-branch commit jump is countable, the claim that LLMs caused it is his reading) and the recovery_prefetch outage (the repro needs a disk with a hard IOPS cap). FLT_ROUNDS is already an open PR. This one compiled here."
---

sebsite's list of ways C as specified and C as shipped disagree includes musl's `va_start`. The claim is one header and one call, so I compiled it.

C23 makes the second argument optional. The summary of ISO/IEC 9899:2024 on cppreference, section 7.16.1.4, gives the macro as `va_start(va_list ap, ...)` since C23, and as `va_start(va_list ap, parmN)` before that. A one-argument call is a valid C23 program. That reading is the spec. The rest of this is what this machine did with it.

```c
#include <stdarg.h>
#include <stdio.h>

int sum(int n, ...) {
  va_list ap;
  va_start(ap);
  int s = 0;
  for (int i = 0; i < n; i++) s += va_arg(ap, int);
  va_end(ap);
  return s;
}

int main(void) {
  printf("%d\n", sum(3, 1, 2, 4));
}
```

`sum(3, 1, 2, 4)` is 7.

gcc 13.3.0 on Ubuntu 24.04, invoked as `gcc -std=c2x`, defines `__STDC_VERSION__` as `202000L`. That is the C2x draft mode, not the finished `202311L`. gcc's own header still treats it as new enough. `/usr/lib/gcc/x86_64-linux-gnu/13/include/stdarg.h` says:

```c
#if defined __STDC_VERSION__ && __STDC_VERSION__ > 201710L
#define va_start(v, ...)	__builtin_va_start(v, 0)
```

That build prints 7. `gcc -H` shows it included that file.

`musl-gcc` is a shell wrapper around the same gcc. It execs `x86_64-linux-gnu-gcc` with `-specs /usr/lib/x86_64-linux-musl/musl-gcc.specs`. The spec passes `-nostdinc` and then lists `/usr/include/x86_64-linux-musl` before gcc's include directory. The header that wins is the one from musl 1.2.4-2:

```c
#define va_start(v,l)   __builtin_va_start(v,l)
```

`musl-gcc -std=c2x` on the same file:

```
va.c:5:14: error: macro "va_start" requires 2 arguments, but only 1 given
```

The note points at line 12 of `/usr/include/x86_64-linux-musl/stdarg.h`. The two-argument call, `va_start(ap, n)`, compiles with `musl-gcc -std=c2x` and prints 7. The values are fine. The new call syntax does not get past the preprocessor.

clang 18.1.3 is an actual C23 compiler on this box. `clang -std=c23` sets `__STDC_VERSION__` to `202311L`, includes `/usr/lib/llvm-18/lib/clang/18/include/__stdarg_va_arg.h`, and prints 7. That header is:

```c
#if defined(__STDC_VERSION__) && __STDC_VERSION__ >= 202311L
#define va_start(ap, ...) __builtin_va_start(ap, 0)
```

The same clang, with `-nostdinc -isystem /usr/include/x86_64-linux-musl` so musl's header is the one it finds, fails with "too few arguments provided to function-like macro invocation". The note is musl's line 12 again.

I fetched `include/stdarg.h` from musl's git for the v1.2.5 tag, the v1.2.6 tag, and master. All three still have `#define va_start(v,l)   __builtin_va_start(v,l)`. Jens Gustedt posted a one-or-two-argument replacement to the musl list in May 2023 ([the message](https://www.openwall.com/lists/musl/2023/05/24/16)). It is not in the tree I fetched.

The compiler here already accepts the call. The libc header that `musl-gcc` installs in front of the compiler's header does not, and the musl releases after 1.2.4 have not changed that line.
