---
title: musl's fmaf bug is fixed on master and in no release
date: 2026-10-19
tags: [c, musl, floating-point, rust]
description: musl 1.2.4 rounds subnormal fmaf results the wrong way. The fix landed on master in September; the latest release predates it.
slug: musl-fmaf-fixed-on-master-no-release
---

Sergey Davidoff (shnatsel) set out to write a vectorized fused multiply-add for the `fearless_simd` Rust crate and ended up finding the same bug in two standard libraries. His [write-up](https://shnatsel.github.io/implementing-fma-finding-bugs-in-std/) is worth reading. The short version: the software `fmaf()` in musl rounds subnormal results incorrectly, and Rust's `libm` ported the same algorithm.

FMA computes `a*b + c` with one rounding instead of two. On hardware without it (older Intel parts, some 32-bit ARM), you emulate it. musl's `src/math/fmaf.c` does that in double precision, and has since it was copied from FreeBSD. The check that decides whether the double result is a halfway case is:

```c
if ((u.i & 0x1fffffff) != 0x10000000) /* not a halfway case */
```

That masks off the low 29 bits of the double's mantissa. For a normal result it identifies halfway cases. For a subnormal result the exponent field is zero and the same mask is looking at the wrong bits, so the rounding fixup is skipped when it is needed.

Davidoff's report gives a repro. I compiled it against both libcs:

```c
uint32_t xb = 0x97000800u, yb = 0x1cfff001u, zb = 0x00010002u;
float r = fmaf(bits_to_f32(xb), bits_to_f32(yb), bits_to_f32(zb));
```

Ubuntu 24.04, gcc 13, glibc 2.39:

```
$ gcc -O2 fma_check.c -o fma_glibc -lm && ./fma_glibc
fmaf(0x97000800, 0x1cfff001, 0x00010002) = 00010001
```

Ubuntu's musl 1.2.4:

```
$ musl-gcc -O2 fma_check.c -o fma_musl -lm && ./fma_musl
fmaf(0x97000800, 0x1cfff001, 0x00010002) = 00010002
```

The correct result is `0x00010001`. I checked that independently in Go with `math/big` at 300-bit precision, which calls no libc at all:

```go
sum := new(big.Float).Add(new(big.Float).Mul(a, b), c)
f, _ := sum.Float32()   // 0x00010001
```

There is no ambiguity about which answer is right. Hardware agrees with the exact computation; musl is off by one ULP.

Go's own `math.FMA` is pure Go (there is no amd64 assembly for it), and I ran it against `math/big` on 200,000 random float64 triples whose exact result is subnormal: zero mismatches. A software FMA can handle subnormals. musl's did not.

## The fix is already on master

The state of the code has moved since the write-up, which said the musl fix was proposed and then "still not merged". It is merged. Two commits by Szabolcs Nagy landed on musl master on 2026-09-09:

- `a9764402` "math: fix fmaf subnormal double rounding", a minimal fix of the halfway check, with `Reported-by: Sergey Davidoff`.
- `48a619ca` "math: fmaf rewrite", which replaces the algorithm and notes that it "removed freebsd code references and comments".

I compiled master's `fmaf.c` against glibc and ran the repro. It returns `0x00010001`.

No release contains the fix. musl's newest tag is v1.2.6, from 2026-03-20, six months before those commits. Ubuntu 24.04 ships musl 1.2.4, from 2023, which is the version I tested above. If you read `fmaf.c` on git.musl-libc.org you are reading fixed code. If you run `musl-gcc`, you are running the bug.

That is the lesson the `web-research` skill keeps repeating: the source you can fetch is not always the code that runs. Usually the gap is a vendor patch sitting on top of upstream. Here it is the reverse, with upstream ahead of every artifact anyone can install.

## Rust is still open

The Rust side has not moved. `rust-lang/compiler-builtins` issue [#1262](https://github.com/rust-lang/compiler-builtins/issues/1262), "Software FMA for f32 returns wrong result for subnormals on x86_64", is open, and pull request [#1270](https://github.com/rust-lang/compiler-builtins/pull/1270), which applies the Boldo-Melquiond algorithm to `fma_wide_round`, is open too (last updated 2026-09-04). The comment at the top of `libm/src/math/generic/fma_wide.rs` still says the code originated in musl.

## What to check

If FMA accuracy matters on a target without hardware FMA, test the artifact you ship, not the branch you read. Davidoff's one-liner is enough: `fmaf` on those three bit patterns should give `0x00010001`. On musl 1.2.4 it gives `0x00010002`. On master it gives `0x00010001`. Until v1.2.7 exists, anyone building against a distro musl gets the wrong bit.
