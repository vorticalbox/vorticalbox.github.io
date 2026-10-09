---
title: Only half of Git's SHA-256 transition is runnable today
date: 2026-10-09
tags: [git, hashing, plain text]
description: Everyone's arguing about whether Git 3.0 should default to SHA-256. I went to run the compatibility layer the whole argument depends on, and it refused to start.
slug: git-sha256-transition
---

There's a fight on at the moment about Git 3.0 making SHA-256 the default hash. Scott Chacon [argues](https://blog.gitbutler.com/git-3-sha-256) it will be an "incomprehensibly expensive and ultimately valueless" migration. The Git project [says](https://git-scm.com/docs/BreakingChanges) it's planned — "the default hash function for new repositories will be changed from `sha1` to `sha256`" — with "no planned release date for this breaking version yet."

Both arguments rest on the same assumption: that the compatibility layer between SHA-1 and SHA-256 repositories exists and works. I went to check it myself.

## What `git init` gives you today

```
$ git init def && cd def
$ git rev-parse --show-object-format
sha1
```

Still SHA-1. That part isn't in dispute.

## The new format works

```
$ git init --object-format=sha256 s256 && cd s256
$ git rev-parse --show-object-format
sha256
$ git commit -m first && git rev-parse HEAD
e7a9a570107512aff4399b4eabc0b11a361117d65238ceb0d3cb6c14c5a3fae2
```

64 hex characters instead of 40. This half has worked for years.

## The half the debate is about

The compatibility layer is the machinery in Git's [hash-function-transition](https://git-scm.com/docs/hash-function-transition) doc: dual hashing, a bidirectional translation table between SHA-1 and SHA-256 object names, a new pack index v3, a `loose-object-idx` file. It's what lets a SHA-256 repository talk to a SHA-1 server, and it's what every cost estimate in the argument — refs and links break, forges keep two copies, submodules need two versions — is really about.

You turn it on with one config line. Here's what happened on the git in front of me (2.54.0, a stock macOS build):

```
$ git config extensions.compatObjectFormat sha1
$ git add a.txt
fatal: compatibility hash algorithm support requires Rust
```

That's it. The feature is gated behind a Rust build dependency this build doesn't have. Homebrew [weighed adding it](https://github.com/orgs/Homebrew/discussions/6895) and, as of June, decided the feature was "very experimental" and not worth the dependency. So the translation table — the thing that makes the whole transition tractable — isn't something I can run, and probably isn't something you can either.

## What that does to the argument

The costs Chacon lists are real — but they're the costs of *Git's particular transition design*, not of changing a hash function. Another version-control system did the same thing in a week.

Fossil, the SQLite project's SCM, moved to SHA3-256 [six days](https://fossil-scm.org/home/doc/trunk/www/hundredandone.md) after SHAttered, in March 2017. No repositories rebuilt. No hyperlinks broken. Fossil lets a single repository hold both hash algorithms at once, so old SHA-1 check-ins stay valid and new ones use SHA3-256.

Git can't do that. Its compat design insists on a bijective, one-to-one mapping between SHA-1 and SHA-256 names, which is what forces the all-or-nothing switch: every ref, every submodule, both formats on every forge. The expense lives in that design choice, not in SHA-256. Fossil is the proof that changing hashes doesn't have to cost this.

The forge problem is the same shape. "If forges implement support in a way that makes it painful, it will be painful" is true of every feature a forge has to support — it's not a fact about hashes.

And the security framing is beside the point on both sides. Linus, on why Git picked SHA-1: "as far as Git is concerned, [it] isn't even a security feature. It's purely a consistency check." What's actually driving the change is compliance — organisations and standards that blanket-ban SHA-1 regardless of what it protects. The article spends most of its length demolishing a collision threat that was never the reason.

## Meanwhile, the other default already works

Git 3.0 has a second headline change — reftable as the default ref backend — and it runs today, no wall:

```
$ git init --ref-format=reftable rt && cd rt
$ git rev-parse --show-ref-format
reftable
$ ls .git/reftable
0x000000000001-0x000000000001-cc54897b.ref  tables.list
```

Ready now. Nobody's writing think-pieces about it.

Chacon isn't wrong that Git's migration is expensive. He's wrong that the expense is inherent to switching hashes — Fossil shows it isn't — and he's arguing against a threat that isn't why the change is happening. And the machinery his cost estimate rests on, the compat layer that's meant to make the transition tractable, isn't something you or I can run: the one line that turns it on errors out on a stock build.

The migration everyone is arguing about is two migrations. One is done and you can use it today. The other — the one that decides whether the first was a mistake — still says `requires Rust`.
