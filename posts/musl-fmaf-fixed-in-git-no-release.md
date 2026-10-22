---
title: musl fixed fmaf in git and not in any release
date: 2026-10-22
tags: [c, libc, musl, floating-point]
description: One f32 multiply-add input separates a correctly-rounded libc from an emulated one. glibc gets it right, a baseline musl build rounds it wrong, and the fix has been in musl's git since September.
slug: musl-fmaf-fixed-in-git-no-release
---

Sergey Davidoff spent September [implementing fused multiply-add for SIMD](https://shnatsel.github.io/implementing-fma-finding-bugs-in-std/), and in the process found the same wrong-rounding bug in the software FMA inside Rust's standard library and in musl's `fmaf`. He gave a test vector. I ran it.

## The vector

```
a = 0x97000800   b = 0x1cfff001   c = 0x00010002
correctly rounded fmaf(a, b, c) = 0x00010001
```

A C program that bit-casts those into floats, calls `fmaf`, and prints the result as hex:

```c
float fmaf_bits(uint32_t ab, uint32_t bb, uint32_t cb) {
    float a, b, c;
    __builtin_memcpy(&a, &ab, 4);
    __builtin_memcpy(&b, &bb, 4);
    __builtin_memcpy(&c, &cb, 4);
    return fmaf(a, b, c);
}
```

Compile it twice, once with gcc and once with `musl-gcc`, on the same machine (glibc 2.39, Ubuntu 24.04, AMD EPYC 7763 with hardware FMA):

```
glibc 2.39             fmaf = 0x00010001
musl 1.2.4 (baseline)  fmaf = 0x00010002
musl 1.2.4 (-mfma)     fmaf = 0x00010001
```

Same input, same CPU, same musl, different result. musl's x86-64 `fmaf` is a `vfmadd132ss` instruction behind `#if __FMA__`, so it only exists when the library is built with `-mfma`. A baseline build falls through to the generic C file instead, and that is the one that is wrong. glibc dispatches between hardware and software at runtime with an IFUNC, so it uses the instruction on this CPU either way.

The generic file has the actual bug. The correct result is a subnormal, below the smallest normal `float`. Emulating f32 FMA by computing in f64 and rounding once does not work here, and the check musl uses to repair that only recognises halfway cases for normal results. This one is subnormal, the check misses it, and the early return hands back the double-rounded value.

## Why widening fails

The exact value is `9.1837598105687688589875696317168305468946e-41`. Round it to an f64 first and it lands on the wrong side of the f32 boundary. I wrote the check in Go as a control, since Go's runtime does not go through libc on Linux:

```
float32(math.FMA(float64(a), float64(b), float64(c)))
  = 0x00010002     // same wrong answer as musl
```

That is the naive "widen, compute, narrow" path, and it gives the same wrong answer here. Go's `math.FMA` is a correctly-rounded *f64* FMA; the error is introduced when the f64 result is rounded again to f32. The Boldo and Melquiond paper Davidoff followed, [Emulation of FMA and correctly-rounded sums](https://guillaume.melquiond.fr/doc/08-tc.pdf), exists precisely to add the round-to-odd step that survives the second rounding. It comes with a Coq proof.

An exact reference settles the value. Go's `math/big` at 256 bits, no libc involved, computes `a*b + c` and rounds to nearest f32:

```
big.Float exact -> f32 = 0x00010001
```

glibc agrees with the exact arithmetic; the naive double path does not.

## Where the fix is

Davidoff filed [compiler-builtins#1262](https://github.com/rust-lang/compiler-builtins/issues/1262) for Rust and posted to musl's mailing list. The Rust fix is an [open pull request](https://github.com/rust-lang/compiler-builtins/pull/1270) as I write this.

For musl, the article says the patch "is still not merged". I checked musl's git, and that is out of date. Master has the fix: commit [`48a619c` "math: fmaf rewrite"](https://git.musl-libc.org/cgit/musl/commit/?id=48a619cad667c26e868dbaa5e556c4f0280b86a2), authored by Szabolcs Nagy and committed by Rich Felker on 9 September 2026, crediting Davidoff and the round-to-odd paper. The new `fmaf.c` has an explicit `tiny` branch for subnormal results. I pulled that source, compiled it into the same test binary next to glibc, and it returns `0x00010001`.

What never happened is a release. `fmaf.c` in musl 1.2.4 and musl 1.2.6 is byte-identical — I diffed the two files — so every tagged musl, through 1.2.6 (tagged 20 March 2026), still has the bug. The fix exists only in git. The buggy file's header credits FreeBSD's `s_fmaf.c` (copyright 2005–2011), which is why I would expect the same bug to be sitting in other toolchains that copied it.

## Does it matter

Davidoff's own answer is "I have no idea", and I cannot do much better on impact. The error is one ulp, in rare subnormal results, on the software path. When the hardware instruction is actually called it does not happen: glibc on this CPU, or musl built with `-mfma`. The generic fallback is what is wrong, and it gets compiled into baseline x86-64 musl even on a machine that has the instruction, into 32-bit ARM and whatever else lacks hardware FMA, and into Rust's standard library everywhere hardware FMA is missing. The people who care are the ones running the same computation on different machines and expecting it to match, or relying on a documented error bound from a math routine built on FMA.

If you want to check your own libc, it is the short C function above. If `fmaf` returns `0x00010002`, you are running the generic file — what a baseline musl build compiles, and what the Rust standard library's software fallback still uses. It has been fixed in musl's git and in no release.