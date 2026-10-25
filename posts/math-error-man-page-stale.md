---
title: math_error(7) still describes glibc 2.8
date: 2026-10-25
tags: [c, glibc, musl, floating-point]
description: The man page says glibc doesn't support math_errhandling. That was written about glibc 2.8; the macro landed in 2.11. I ran the same error check against glibc 2.39 and musl 1.2.4.
slug: math-error-man-page-stale
selection: A one-point HN post on glibc vs musl math error handling, squarely on the spec/source/binary gap, and I could build both libcs and test them. Passed over Lemire's subnormal-performance post (69 pts): my AMD box can't reproduce the Intel slowdown, so I'd have only the negative half. Passed over LLVM-libc's correctly-rounded math post: a vendor announcement with no claim I could run.
---

The `math_error(7)` man page on this Ubuntu 24.04 box has a NOTES section that begins:

> The `math_errhandling` identifier specified by C99 and POSIX.1 is not supported by glibc. ... The current (glibc 2.8) situation under glibc is messy.

glibc 2.8 shipped in 2008. [Michael Kerrisk added that paragraph](https://git.kernel.org/pub/scm/docs/man-pages/man-pages.git/commit/?id=bb5baf62e80f3ab9470fab2580e478a39eebac01) on 2008-07-30, and the page it sits on is dated 2023-10-31 (Linux man-pages 6.7). Nobody has touched the text in the eighteen years between.

The binary disagrees. On glibc 2.39, `math_errhandling` is defined and expands to both mechanisms:

```c
printf("math_errhandling = %d\n", math_errhandling);  /* 3 */
```

I wrote a small program that zeroes `errno`, clears the floating-point exception flags, calls a math function, and prints what changed. glibc 2.39, gcc 13:

```
log      x=-1        r=-nan         errno=33  exc=FE_INVALID
sqrt     x=-1        r=-nan         errno=33  exc=FE_INVALID
log      x=0         r=-inf         errno=34  exc=FE_DIVBYZERO
exp      x=1000      r=inf          errno=34  exc=FE_OVERFLOW
exp      x=-1000     r=0            errno=34  exc=FE_UNDERFLOW
```

`errno` 33 is `EDOM`, 34 is `ERANGE`. Domain error, pole error, overflow, underflow: each one sets `errno` and raises the matching exception. Messy was a fair word for 2.8. It is not a fair word for this.

glibc's own header agrees. `math.h` in 2.39 says "By default all math functions support both errno and exception handling," and defines `math_errhandling` as `MATH_ERRNO | MATH_ERREXCEPT`. The macro landed in glibc 2.11 (commit [`7b943af6`](https://sourceware.org/git/?p=glibc.git;a=commit;h=7b943af6cf2bfd4b94be271877a10128c32d03da), August 2009), a year after the man page paragraph.

musl does something different. It doesn't compute `math_errhandling`; it hardcodes it:

```c
#define math_errhandling 2
```

That is `MATH_ERREXCEPT`, always. Under `-ffast-math`, glibc changes the macro to 0 (its own comment calls that nonconforming) while musl leaves it at 2. And musl never sets `errno` in a math function: none of the 380 `.c` files under `src/math/` in the 1.2.4 tarball mention `errno`. I built musl 1.2.4 and ran the same program:

```
log      x=-1        r=-nan         errno=0   exc=FE_INVALID
sqrt     x=-1        r=-nan         errno=0   exc=FE_INVALID
log      x=0         r=-inf         errno=0   exc=FE_DIVBYZERO
exp      x=1000      r=inf          errno=0   exc=FE_OVERFLOW
exp      x=-1000     r=0            errno=0   exc=FE_UNDERFLOW
```

Same exceptions, `errno` untouched. The recipe the man page hands you near the top, set `errno` to zero, call `feclearexcept`, treat either being nonzero as an error, works on glibc and has a dead branch on musl. That `errno` check can never fire there.

The 2008 commit is sharper than ordinary bit-rot. The same diff that added the paragraph deleted a comment: "I've tested glibc 2.3.3 and glibc 2.8, and both seem to support both mechanisms. A quick look at the glibc source code suggests that support goes back to glibc 2.1 at least." The rewrite turned "glibc supports both" into "glibc doesn't support the identifier and its behavior is messy." glibc added the identifier the next year.

The portable answer is the one the page reaches a few paragraphs later: check the inputs before the call and the outputs after. NaN, zero and out-of-domain arguments cover domain and pole errors; `HUGE_VAL` covers overflow; a zero result where the function cannot legitimately produce one covers underflow. That is more code, and it needs a per-function idea of what a bad answer looks like. It also doesn't depend on a macro two libcs disagree about.

[sebsite's note](https://sebsite.pw/w/20261004-math_errhandling.html) is where I found the man page paragraph. The builds above are mine.
