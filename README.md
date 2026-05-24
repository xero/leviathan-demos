# Leviathan Crypto Library Demos

# https://leviathan.3xi.club

<img src="https://github.com/xero/leviathan-crypto/raw/main/docs/logo.svg" alt="Leviathan logo" width="400" >

> [!NOTE]
> This repo contains demo applications and reference implementations built
> using [leviathan-crypto](https://github.com/xero/leviathan-crypto), a
> zero-dependency WebAssembly cryptography library for TypeScript that's
> tree-shakeable, side-effect free, with vector verified primitives.
>
> Each project in this repository is a working application that can be used
> directly or read as an implementation reference.

> [!NOTE]
> Each demo's wire format tracks the matching version of leviathan-crypto.
> A demo's release version always corresponds to the leviathan-crypto release
> it was built against.

## Projects

### `cli`
#### file encryption command line interface

**The tool to install if you just want something to use.**

Supports Serpent-256-CBC+HMAC-SHA256, XChaCha20-Poly1305, and AES-256-GCM-SIV,
selectable via the `--cipher` flag. A single keyfile is compatible with all
three ciphers; the header byte determines decryption automatically. Encryption
and decryption distribute 64KB chunks across a worker pool sized to
`hardwareConcurrency`. Each worker owns an isolated WASM instance with no
shared memory between workers.

```sh
bun add -g lvthn # or npm install -g lvthn

# passphrases
lvthn encrypt -p "correct horse battery" secret.txt
lvthn decrypt -p "correct horse battery" secret.enc

# keyfiles and unix pipes
lvthn keygen --armor -o my.key
cat secret.txt | lvthn encrypt -k my.key --armor > secret.enc
```

→ [cli/README.md](./cli/README.md)

→ [npmjs.org/package/lvthn](https://www.npmjs.com/package/lvthn)

---

### `kyber`
#### ml-kem post-quantum key establishment demo

**The demo to show someone who asks why post-quantum cryptography matters today.**

Simulates a complete ML-KEM key encapsulation ceremony between two browser-side
clients. A live wire at the top of the page logs every value that crosses the
channel; importantly, the shared secret never appears in the wire. After the
ceremony completes, both sides independently derive a symmetric key using
HKDF-SHA256 and exchange messages encrypted with XChaCha20-Poly1305. Each wire
frame is expandable, revealing the raw nonce, ciphertext, Poly1305 tag, and
AAD.


```sh
cd kyber && bun install && bun bake
open dist/index.html
```

→ [kyber/README.md](./kyber/README.md)

→ [browser demo](https://leviathan.3xi.club/kyber)

---

### `web`
#### browser-based encryption tool

A single, self-contained HTML file powers this demo. Encrypt text or files
using Serpent-256-CBC and scrypt key derivation, then share the armored
output. No server, installation, or network connection required after initial
load. The code is written to be read. The Encrypt-then-MAC construction, HMAC
input (header with HMAC field zeroed + ciphertext), and scrypt parameters are
all intentional examples worth reading.

```sh
cd web && bun install && bun bake
open dist/index.html
```

→ [web/README.md](./web/README.md)

→ [browser demo](https://leviathan.3xi.club/web)

---

### `tamper`
#### crypto attack-resilience demo

A working two-party encrypted channel that you then attack. Forge a replay and
watch the sequence check reject it. Tamper with a frame and watch the Poly1305
tag fail. The demo deconstructs the protocol step by step, with visual feedback
for injection and replay attacks, so you see the cryptography catch an attacker
in real time. Key exchange uses X25519 with HKDF-SHA256, message encryption uses
XChaCha20-Poly1305, and the relay server is a dumb WebSocket pipe that never
sees plaintext. Every primitive comes from leviathan-crypto, with no external
dependency.

> [!TIP]
> This is a teaching demo. For a real, production-ready secure messenger built
> on the same library, see [covcom](https://github.com/xero/covcom).

```sh
cd tamper && bun install && bun bake
bun run server/server.ts &
open dist/index.html
```

→ [tamper/README.md](./tamper/README.md)

→ [browser demo](https://leviathan.3xi.club/tamper)

---

### `jwt`
#### classical and post-quantum json web token signing demo

**The demo to show someone who wants to know what post-quantum signatures cost.**

A single, self-contained HTML file signs and verifies JSON Web Tokens across
eleven algorithms: classical EdDSA and ES256, post-quantum ML-DSA and SLH-DSA,
and the leviathan hybrid composites. The same claims signed with Ed25519 produce
a token of about 220 bytes; signed with SLH-DSA-SHAKE-256f, the same token runs
past 66 kilobytes. Pick an algorithm, generate a keypair, edit the claims, and
sign. The token renders with its three segments color-coded and a live byte
readout. Then tamper with the payload and watch verification reject it. Every
algorithm runs through one uniform path on the leviathan `Sign` suite API.

```sh
cd jwt && bun install && bun bake
open dist/index.html
```

→ [jwt/README.md](./jwt/README.md)

→ [browser demo](https://leviathan.3xi.club/jwt)

---

## Prerequisites

All projects require [Bun](https://bun.sh) to build.

> [!NOTE]
> The published `lvthn` cli tool also installs cleanly
> with npm or any nodejs-compatible package manager.

```sh
curl -fsSL https://bun.sh/install | bash
```

---

## Repository layout

```
leviathan-demos/
├── cli/                 # published CLI tool (npm: lvthn)
├── kyber/               # ML-KEM post-quantum key establishment demo
├── web/                 # single-file browser encryption tool
├── tamper/              # crypto attack-resilience demo
├── jwt/                 # classical and post-quantum JWT signing demo
├── package.json         # workspace root (lint tools only)
└── tsconfig.base.json   # shared TypeScript base config
```

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
