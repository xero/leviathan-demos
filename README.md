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

## Projects

### `cli`
#### file encryption command line interface

**The tool to install if you just want something to use.**

Supports both Serpent-256-CBC+HMAC-SHA256 and XChaCha20-Poly1305, selectable
via the `--cipher` flag. A single keyfile is compatible with both ciphers; the
header byte determines decryption automatically. Encryption and decryption
distribute 64KB chunks across a worker pool sized to `hardwareConcurrency`.
Each worker owns an isolated WASM instance with no shared memory between workers.

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
using Serpent-256-CBC and Argon2id key derivation, then share the armored
output. No server, installation, or network connection required after initial
load. The code is written to be read. The Encrypt-then-MAC construction, HMAC
input (header with HMAC field zeroed + ciphertext), and Argon2id parameters are
all intentional examples worth reading.

```sh
cd web && bun install && bun run build.ts
open dist/index.html
```

→ [web/README.md](./web/README.md)

→ [browser demo](https://leviathan.3xi.club/web)

---

### `chat`
#### end-to-end encrypted chat

End-to-end encrypted chat featuring two-party messaging over X25519 key
exchange and XChaCha20-Poly1305 message encryption. The relay server functions
as a dumb WebSocket pipe that never sees plaintext. Each message incorporates
sequence numbers, which allows the system to detect and reject replayed messages
from an attacker. The demo deconstructs the protocol step by step, with visual
feedback for both injection and replays.

```sh
cd chat && bun install
cd server && bun run server.ts &
open client/lvthn-chat.html
```

→ [chat/README.md](./chat/README.md)

→ [browser demo](https://leviathan.3xi.club/chat)

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
├── chat/                # E2E encrypted chat demo
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
