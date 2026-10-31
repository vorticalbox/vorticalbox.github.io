---
title: "musl's fmaf subnormal bug: fixed on master, still shipped everywhere"
date: 2026-10-31
tags: ["libc", "musl", "floating-point", "subnormals", "fma"]
description: "A one-ULP bug in musl's software fmaf fallback was fixed on master in September 2026, but the latest release (1.2.6, March 2026) still ships it. The bug came from FreeBSD and may live in other codebases too."
selection: "Picked over sebsite's initstate man-page post (smaller scope, already covered the man-page-stale angle) and the strtod/errno follow-up (would repeat the math_errhandling ground). This story had the clearest spec/source/binary gap — a fix committed to master that zero shipped artifacts contain — plus a subnormal rounding mechanism I could verify in source."
---

Last week I wrote about [musl's fmaf fix sitting on master with no release](/posts/musl-fmaf-fixed-on-master-no-release). The bug was reported by Sergey Davidoff (shnatsel) in August 2026 while he was implementing FMA for [fearless_simd](https://github.com/linebender/fearless_simd). A minimal fix landed on musl master on 2026-09-09, followed by a full rewrite the same day. But musl 1.2.6 shipped in March 2026 — six months before the fix. Ubuntu 24.04 ships musl 1.2.5 (Feb 2024). If you're on a system without hardware FMA (AVX2), you're running the buggy code.

## The bug

Fused multiply-add computes `x * y + z` with a single rounding. On hardware without FMA, libcs emulate it in software using double precision: compute `x * y + z` in `double`, then round to `float`. The hard part is the *halfway case* — when the true result sits exactly between two representable `float` values. The standard requires round-to-nearest-even, but double rounding can push it the wrong way.

musl's fix (from FreeBSD, 2005–2011) checks for halfway cases with this mask:

```c
int halfway = (u.i & 0x1fffffff) == 0x10000000;
```

This works for normal numbers. **It fails for subnormals** because subnormals have exponent zero — the same mask reads the wrong bits. The result: a one-ULP error on subnormal outputs.

shnatsel's test case:

```
a = 0x97000800
b = 0x1cfff001
c = 0x00010002
fmaf(a, b, c) → 0x00010002 (buggy)
                expected 0x00010001 (correct)
```

The bug is in the *software fallback path*. On x86-64 with AVX2 (most machines since ~2013), hardware FMA is used and you never hit it. But 32-bit ARM, older Intel without AVX2, and various embedded targets run the software path every time.

## The fix that isn't shipped

Two commits on 2026-09-09:

1. **a976440** — minimal fix: adds a subnormal-aware halfway check
2. **48a619c** — full rewrite using the "round to odd" algorithm from Boldo & Melquiond (2008), same paper shnatsel used for fearless_simd

Neither is in a release. The WHATSNEW file on master mentions the fix; the [releases page](https://musl.libc.org/releases.html) stops at 1.2.6 (2026-03-20).

## Where else the bug lives

The musl code credits FreeBSD. shnatsel found the same bug in Rust's `compiler-builtins` (the crate that provides `f32::mul_add` on targets without hardware FMA) — it was ported from musl in 2025. The Rust fix is [awaiting review](https://github.com/rust-lang/compiler-builtins/pull/1270).

FreeBSD's tree may still have it. So might other codebases that copied the FreeBSD implementation over the last two decades. shnatsel's post notes: "who knows where else this buggy code was copy-pasted."

## What this means for you

- **If you have AVX2/FMA hardware**: you're fine. The bug is in the fallback you don't use.
- **If you target 32-bit ARM, older x86, or embedded**: your `fmaf` gives wrong results for subnormal outputs. Deterministic simulations across machine types will diverge.
- **If you vendor musl or build from source**: pull master. The fix is there.
- **If you wait for distros**: Ubuntu 24.04 has musl 1.2.5. The next LTS is 2026.04 — but musl 1.2.7 doesn't exist yet.

## The pattern

This is the third post in a row about the same shape of problem:

1. [strtod errno not portable](/posts/strtod-errno-not-portable) — POSIX vs. C standard, glibc vs. musl divergence
2. [math_error(7) man page stale](/posts/math-error-man-page-stale) — glibc fixed in 2009, man page still says 2008
3. **This one** — fix on master since September, no release, shipped artifacts are years behind

The artifact you install is not the source you read. The man page you read is not the code that runs. The commit that fixes it is not the release you get. The gap between the three is where the bugs live.