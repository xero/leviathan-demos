# leviathan jwt

> [!NOTE]
> A standalone browser demo for signing and verifying JSON Web Tokens with
> classical and post-quantum signatures, built on
> [leviathan-crypto](https://github.com/xero/leviathan-crypto). It runs entirely
> client-side in one HTML file using the `Sign` suite API across eleven
> algorithms. No server, no runtime dependencies.

> ### Table of Contents
> - [What it demonstrates](#what-it-demonstrates)
> - [Algorithms](#algorithms)
> - [How it works](#how-it-works)
> - [Build and run](#build-and-run)
> - [Source layout](#source-layout)
> - [Token structure](#token-structure)
> - [Security notes](#security-notes)
> - [Related](#related)
> - [License](#license)

---

## What it demonstrates

A JWT is three base64url segments joined by dots: a header, a payload, and a
signature over the first two. Swapping the signature algorithm changes nothing
about that structure. It changes the size, and the size is the story.

This demo signs the same claims with eleven different algorithms and shows the
result side by side. An Ed25519 token is about 220 bytes. The same token signed
with SLH-DSA-SHAKE-256f runs past 66 kilobytes. That gap is the cost of quantum
resistance, and you can watch it appear by changing one dropdown.

---

## Algorithms

The signature bytes below are fixed per algorithm. Total token size also depends
on your claims.

| `alg` header | primitive | family | signature bytes |
|---|---|---|---|
| `EdDSA` | Ed25519 | classical | 64 |
| `ES256` | ECDSA P-256 | classical | 64 |
| `ML-DSA-44` | ML-DSA | lattice, post-quantum | 2420 |
| `ML-DSA-65` | ML-DSA | lattice, post-quantum | 3309 |
| `ML-DSA-87` | ML-DSA | lattice, post-quantum | 4627 |
| `SLH-DSA-SHAKE-128f` | SLH-DSA | hash, post-quantum | 17088 |
| `SLH-DSA-SHAKE-192f` | SLH-DSA | hash, post-quantum | 35664 |
| `SLH-DSA-SHAKE-256f` | SLH-DSA | hash, post-quantum | 49856 |
| `MLDSA44-SLHDSA128f` | ML-DSA + SLH-DSA | hybrid composite | 19508 |
| `MLDSA65-SLHDSA192f` | ML-DSA + SLH-DSA | hybrid composite | 38973 |
| `MLDSA87-SLHDSA256f` | ML-DSA + SLH-DSA | hybrid composite | 54483 |

`EdDSA` and `ES256` are standard JOSE identifiers from RFC 8037 (CFRG Curve
Signatures in JOSE) and RFC 7518 (JSON Web Algorithms).

The `ML-DSA-*` and `SLH-DSA-*` identifiers track the in-progress IETF drafts for
post-quantum signatures in JOSE and COSE. They are not finalized, so treat them
as experimental.

The hybrid composite identifiers are defined by leviathan-crypto. They
concatenate an ML-DSA signature with an SLH-DSA signature over the same input,
and both halves must verify. No JOSE standard covers them. They are included to
show the full v3 signing surface.

---

## How it works

Every algorithm runs through the same three calls. There is no per-algorithm
branching in the app.

- **Keygen.** `suite.keygen()` returns a `{ pk, sk }` pair.
- **Sign.** `Sign.signDetached(suite, sk, signingInput, ctx)` returns the raw signature bytes.
- **Verify.** `Sign.verifyDetached(suite, pk, signingInput, sig, ctx)` returns a boolean.

The signing input is the ASCII string `base64url(header).base64url(payload)`.
The context is always empty, because JWT carries no signature context.
`signDetached` returns the bare primitive signature with no leviathan envelope
framing, which is exactly what the JWT wire format needs.

Generate a keypair, sign, then verify. The verdict turns green. Then press
tamper. The demo flips the payload to `admin: true`, re-attaches the original
signature, and re-verifies. The verdict turns red, because the signature covers
the original bytes and any edit to the claims breaks it.

---

## Build and run

Requires [Bun](https://bun.sh).

```sh
bun install
bun bake
# → dist/index.html
```

Open `dist/index.html` in any modern browser. No server required.

`bake` runs `build.ts`, which bundles `leviathan.jwt-entry.ts` with Bun, then
inlines that bundle, `src/style.css`, and `src/app.js` into `src/template.html`.
The entry file loads every WASM module the suites need (`curve25519`, `p256`,
`sha2`, `sha3`, `mldsa`, and `slhdsa`) and re-exports the suites and utilities.

> [!NOTE]
> The page inlines six WASM binaries, including the ML-DSA and SLH-DSA modules,
> so the built `dist/index.html` is a few hundred kilobytes. Everything is
> self-contained and works offline after the first load.

---

## Source layout

```
jwt/
├── src/
│   ├── template.html        # page structure and markup
│   ├── style.css            # all styles
│   └── app.js               # sign, verify, and tamper logic
├── leviathan.jwt-entry.ts   # leviathan-crypto bundle entry
├── build.ts                 # build script
└── dist/
    └── index.html           # built output
```

---

## Token structure

```
header   = {"alg":"EdDSA","typ":"JWT"}
payload  = {"sub":"1234567890","name":"ada lovelace","admin":false,"iat":1516239022}

signingInput = base64url(header) + "." + base64url(payload)
signature    = Sign.signDetached(suite, sk, signingInput, EMPTY)

token = signingInput + "." + base64url(signature)
```

Verification splits the token, reads `alg` from the decoded header to select the
suite, recomputes the signing input from the first two segments, and checks the
signature against the public key.

---

## Security notes

> [!IMPORTANT]
> The signature covers `base64url(header).base64url(payload)`. Any change to the
> header or payload invalidates it. The tamper button proves this: editing a
> claim and reusing the old signature fails verification.

- **No envelope framing.** `signDetached` and `verifyDetached` operate on the
  bare primitive signature, with no leviathan envelope, matching the JWT wire
  format. The raw `verify` path returns a plain boolean.
- **Empty context.** JWT carries no signature context, so the demo passes an
  empty `ctx` on every call.
- **Hybrid composites verify both halves.** A hybrid signature passes only when
  both the ML-DSA and SLH-DSA halves verify against the same input.

---

## Related

- [leviathan-crypto](https://github.com/xero/leviathan-crypto): the underlying library
- [web demo](../web/README.md), [tamper demo](../tamper/README.md), [kyber demo](../kyber/README.md), [cli tool](../cli/README.md)
- [covcom](https://github.com/xero/covcom): a production secure messenger built on the same library
- [sign wiki](https://github.com/xero/leviathan-crypto/wiki/sign): signature suite API reference
- [RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519): JSON Web Token
- Live demo: [leviathan.3xi.club/jwt](https://leviathan.3xi.club/jwt)

---

## License

Leviathan and its demos are written under the [MIT license](http://www.opensource.org/licenses/MIT).

```
                ▄▄▄▄▄▄▄▄▄▄
         ▄████████████████████▄▄
      ▄██████████████████████ ▀████▄
    ▄█████████▀▀▀     ▀███████▄▄███████▌
   ▐████████▀   ▄▄▄▄     ▀████████▀██▀█▌
   ████████      ███▀▀     ████▀  █▀ █▀
   ███████▌    ▀██▀         ██
    ███████   ▀███           ▀██ ▀█▄
     ▀██████   ▄▄██            ▀▀  ██▄
       ▀█████▄   ▄██▄             ▄▀▄▀
          ▀████▄   ▄██▄
            ▐████   ▐███
     ▄▄██████████    ▐███         ▄▄
  ▄██▀▀▀▀▀▀▀▀▀▀     ▄████      ▄██▀
▄▀  ▄▄█████████▄▄  ▀▀▀▀▀     ▄███
 ▄██████▀▀▀▀▀▀██████▄ ▀▄▄▄▄████▀
████▀    ▄▄▄▄▄▄▄ ▀████▄ ▀█████▀  ▄▄▄▄
█████▄▄█████▀▀▀▀▀▀▄ ▀███▄      ▄███▀
▀██████▀             ▀████▄▄▄████▀
                        ▀█████▀
```
