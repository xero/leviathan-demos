# leviathan kyber

> [!NOTE]
> A standalone browser demo for ML-KEM post-quantum key establishment, built on
> [leviathan-crypto](https://github.com/xero/leviathan-crypto). It runs entirely
> client-side in one HTML file using `MlKem512`, `MlKem768`, `MlKem1024`,
> `HKDF_SHA256`, and `XChaCha20Poly1305`. No server, no runtime dependencies.

> ### Table of Contents
> - [What it demonstrates](#what-it-demonstrates)
> - [How it works](#how-it-works)
> - [Build and run](#build-and-run)
> - [Source layout](#source-layout)
> - [Protocol](#protocol)
> - [Security notes](#security-notes)
> - [Related](#related)
> - [License](#license)

---

## What it demonstrates

ML-KEM (formerly Kyber) is a key encapsulation mechanism, not an encryption
scheme. Two parties establish a shared secret across an asymmetric boundary
without ever transmitting it. This demo makes that boundary visible.

The page simulates Alice and Bob as two browser-side clients. A wire at the top
logs everything that crosses the channel in real time. The shared secret never
appears in the wire. That absence is the whole point.

---

## How it works

Alice runs `keygen()` and sends her encapsulation key. Bob encapsulates against
it, producing a ciphertext and a shared secret; he sends back the ciphertext.
Alice decapsulates the ciphertext with her private decapsulation key and
recovers the identical shared secret. The decapsulation key never leaves Alice,
and the shared secret never crosses the wire.

Both sides then derive a symmetric key from the shared secret with HKDF-SHA256
(RFC 5869, HMAC-based key derivation). Bidirectional messaging uses
XChaCha20-Poly1305 with the sender label bound in as authenticated data. Every
message frame in the wire is expandable, showing the nonce, ciphertext body,
Poly1305 tag, and AAD.

Security levels 512, 768, and 1024 are selectable. Alice chooses before keygen,
and the selection locks for the duration of the ceremony.

---

## Build and run

Requires [Bun](https://bun.sh).

```sh
bun install
bun bake
# → dist/index.html
```

Open `dist/index.html` in any modern browser. No server required.

`bake` runs `build.ts`, which bundles `leviathan.kyber-entry.ts` with Bun, then
inlines that bundle, `src/style.css`, and `src/app.js` into `src/template.html`.
The entry file loads the `mlkem`, `sha3`, `chacha20`, and `sha2` WASM modules
and re-exports the classes the page needs.

---

## Source layout

```
kyber/
├── src/
│   ├── template.html          # page structure and markup
│   ├── style.css              # all styles
│   └── app.js                 # ceremony logic and messaging
├── leviathan.kyber-entry.ts   # leviathan-crypto bundle entry
├── build.ts                   # build script
└── dist/
    └── index.html             # built output
```

---

## Protocol

```
alice                            wire                             bob
─────                            ────                             ───
keygen()
  └─ encapsulationKey  ─────────── ek → ──────────────────────► receive ek
     decapsulationKey (never leaves alice)                        encapsulate(ek)
                        ◄──────── ct ← ──────────────────────── ciphertext
decapsulate(dk, ct)
  └─ sharedSecret ───────── [not transmitted] ────────────────── sharedSecret
HKDF(ss) → key                                                   HKDF(ss) → key
```

---

## Security notes

> [!IMPORTANT]
> The shared secret is never sent over the wire. Only the encapsulation key and
> the ciphertext cross the channel; both sides compute the secret independently.

- **Forward boundary.** The decapsulation key stays on Alice's side for the whole
  ceremony. Capturing the wire reveals the public key and ciphertext, neither of
  which recovers the secret.
- **Key derivation.** The raw ML-KEM shared secret is run through HKDF-SHA256
  before use, producing a uniformly distributed, domain-separated message key.
- **Message encryption.** XChaCha20-Poly1305 uses a fresh random 24-byte nonce
  per message, with the sender label bound in as authenticated data.

---

## Related

- [leviathan-crypto](https://github.com/xero/leviathan-crypto): the underlying library
- [web demo](../web/README.md), [tamper demo](../tamper/README.md), [jwt demo](../jwt/README.md), [cli tool](../cli/README.md)
- [covcom](https://github.com/xero/covcom): a production secure messenger built on the same library
- [ML-KEM wiki](https://github.com/xero/leviathan-crypto/wiki/kyber): API reference
- [XChaCha20-Poly1305 wiki](https://github.com/xero/leviathan-crypto/wiki/chacha20#xchacha20poly1305): messaging cipher reference
- Live demo: [leviathan.3xi.club/kyber](https://leviathan.3xi.club/kyber)

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
