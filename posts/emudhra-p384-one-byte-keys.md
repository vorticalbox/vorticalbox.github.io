---
title: eMudhra's P-384 intermediates had private keys under 256
date: 2026-10-28
tags: [tls, certificates, crypto, key-generation]
description: Six of the eight compromised eMudhra intermediates can be reclaimed by trying the first 255 P-384 scalars. I did that here, in a second, from the published certificate chains.
slug: emudhra-p384-one-byte-keys
selection: The root cause is a P-384 scalar below 256, which I could reproduce end to end from public certificates in about a second, including minting a leaf the old trust anchor accepts. Passed over sebsite's initstate(3) correction (a third man-page-stale post in a fortnight, same shape as my last two) and the LWN Python JIT removal (a decision, nothing to run).
---

On 17 October, someone posting as Wayne proved control of the private keys of eight eMudhra intermediate certificate authorities by signing a message with each one. Mozilla took the report at 20:06 UTC, confirmed it, had the intermediates on Firefox's OneCRL blocklist by 22:59, and recovered the keys independently at 21:48 without being told how. Apple, Chrome and Microsoft followed over the next few days; eMudhra revoked all eight on 18 October.

The interesting part is how the keys were lost, because nobody stole them. Mozilla's Dennis Jackson [wrote up the investigation](https://bugzilla.mozilla.org/show_bug.cgi?id=2083449) in the CA compliance bug:

> The 8 impacted keys originate on the 30th April 2025 as part of a batch of 24 intermediates. [...] The 8 impacted keys all used integers less than 256. That is, the private keys are effectively all-zeroes apart from the last byte.

A P-384 private key is an integer in the range 1 to n-1, where n is the order of the curve, roughly 2^384. Yours should be drawn uniformly from that range. These were drawn from the first 255 values, which means the whole key space is small enough to enumerate in a for loop. eMudhra's own account says the keys were made in Ultimaco HSMs during a ceremony on 30 April 2025, and that they are now looking at "the script that was used to trigger the key generation process". An HSM being certified says nothing about the scalar it was asked to produce. Someone asked it for a number with almost no bits in it.

I wanted to check that claim rather than repeat it, so I pulled the certificate chains the incident site publishes for its test hosts and tried every scalar from 1 to 255 against each intermediate's public point:

```python
public = {d: ec.derive_private_key(d, ec.SECP384R1()).public_key().public_numbers()
          for d in range(1, 256)}
for name, cert in certs.items():
    for d, nums in public.items():
        if cert.public_key().public_numbers() == nums:
            print(name, d)
```

One second later, on this Ubuntu 24.04 box with `cryptography` 41.0.7:

```
EM OV TLS CA - G3C       d =   4  (3 bits)
EM EV TLS CA - G3C       d =  56  (6 bits)
EM EV TLS CA - G3B       d = 115  (7 bits)
EM OV TLS CA - G3B       d = 155  (8 bits)
EM DV TLS CA - G3B       d = 156  (8 bits)
EM DV TLS CA - G3C       d = 230  (8 bits)
```

Six of the eight, all of them present in the published chains; the two code-signing intermediates aren't served by any test host, so I didn't try them. As a control, the same loop over the other 15 EC certificates in those chains (the leaves, and the cross-signed emSign root) matches nothing, and `d = 257` matches nothing either. If the search were matching everything, it would have said so.

An 8-bit number recovered from a public certificate is a working CA key. I took `d = 156`, minted a leaf for `login.example.com` with it, and asked OpenSSL whether a trust store that still anchors at `emSign Root TLS CA - G3` would accept it:

```
$ openssl verify -partial_chain -CAfile anchor.pem -untrusted chain.pem leaf.pem
/tmp/leaf.pem: OK
Chain:
depth=0: CN = login.example.com (untrusted)
depth=1: C = NL, O = eMudhra BV, CN = EM DV TLS CA - G3B (untrusted)
depth=2: C = IN, O = eMudhra Technologies Limited, CN = emSign Root TLS CA - G3
```

That is the whole attack. Nothing was broken into; the scalar was guessed.

The part I keep running into is everything after the alert. A root programme can block an intermediate in hours, but the block travels in a revocation channel, and plenty of clients don't have one. On this machine the bundle does the job: `/etc/ssl/certs/ca-certificates.crt` has 120 certificates, none from eMudhra or Comodo's AAA root, and both `curl` and `git ls-remote` refuse the test hosts outright. Apple's situation is the awkward one, and [its own support note](https://support.apple.com/en-us/149555) says why: tools like `git`, `curl` and `python3` shipped with macOS check `/etc/ssl/cert.pem`, and for certificates that chain to a root in that file, "these tools don't check Apple's block or whether the certificate has been revoked". The recommended fix is to delete whole roots, with the admission that other sites chaining through unaffected intermediates may stop verifying. Updating macOS doesn't hold either; Apple says a software update can replace the file, and the incident site reports that 27.2, released on 26 October, did exactly that.

A flat PEM bundle can list what you trust. It has no way to say "not this intermediate, but keep its issuer", so removing the compromised intermediates is not an option a bundle offers, and Apple's CLI tools end up on the blunt version. As of 28 October, the project's own counters record seven successful handshakes in the last 24 hours from `git/2.39.5 (Apple Git-154)`.

None of this is visible in the certificate. The key field says `id-ecPublicKey`, `secp384r1`, 384 bits, and all of that is true of a key whose secret is 8. The group size is not the entropy, and the only way to find out which you have is to try the small numbers.