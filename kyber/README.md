# leviathan kyber

> [!NOTE]
> A standalone browser demo for ML-KEM post-quantum key establishment using [leviathan-crypto](https://github.com/xero/leviathan-crypto). No server. No runtime dependencies. Everything runs client-side in a single HTML file.

---

## What it demonstrates

ML-KEM (formerly Kyber) is a key encapsulation mechanism, not an encryption scheme. Two parties establish a shared secret across an asymmetric boundary without transmitting it. This demo makes that boundary visible.

The page simulates Alice and Bob as two browser-side clients. A wire at the top logs everything that crosses the channel in real time. The shared secret never appears in the wire. That absence is the whole point.

After the key ceremony completes, both sides derive a symmetric key from the shared secret using HKDF-SHA256. Bidirectional messaging then uses XChaCha20-Poly1305 with the sender label as AAD. Every message frame in the wire is expandable, showing the nonce, ciphertext body, Poly1305 tag, and AAD.

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

Security levels 512, 768, and 1024 are selectable. Alice chooses before keygen. The selection locks for the duration of the ceremony.

---

## Stack

- **[leviathan-crypto](https://github.com/xero/leviathan-crypto) v2** — `MlKem512`, `MlKem768`, `MlKem1024`, `HKDF_SHA256`, `XChaCha20Poly1305`
- **Bun** — build and bundle
- **Vanilla JS** — no framework
- Single `dist/index.html` with inlined CSS and JS

---

## Build

```sh
bun i
bun bake
```

Output: `dist/index.html`

The build script (`build.ts`) bundles `leviathan.kyber-entry.ts` via Bun, then inlines the bundle, `src/style.css`, and `src/app.js` into `src/template.html`.

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

## Live demo

[leviathan.3xi.club](https://leviathan.3xi.club)

---

## Related

- [leviathan-crypto](https://github.com/xero/leviathan-crypto) — the underlying library
- [ML-KEM wiki](https://github.com/xero/leviathan-crypto/wiki/kyber) — API reference
- [XChaCha20-Poly1305 wiki](https://github.com/xero/leviathan-crypto/wiki/chacha20#xchacha20poly1305) — messaging cipher reference

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
