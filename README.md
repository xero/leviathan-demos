# Leviathan Crypto Library Demos

# https://leviathan.3xi.club

<img src="https://github.com/xero/leviathan-crypto/raw/main/docs/logo.svg" alt="Leviathan logo" width="400" >

>[!NOTE]
> Demo applications and reference implementations built using
> [leviathan-crypto](https://github.com/xero/leviathan-crypto): a
> zero-dependency web-assembly cryptography library for TypeScript that's
> tree-shakeable, side-effect free, with vector verified primitives.
>
> Each project in this repository is a working application that can be used
> directly or read as an implementation reference. The teaching artifacts
> (`lvthncli-serpent`, `lvthncli-chacha`) are kept as separate packages
> keeping the crypto layer diff minimal and legible.

## Projects

### `lvthn-cli` — file encryption CLI

**The tool to install if you just want something to use.**

Supports both Serpent-256 and XChaCha20-Poly1305, selectable via the
`--cipher` flag. A single keyfile is compatible with both ciphers;
the header byte determines decryption automatically. Encryption and
decryption distribute 64KB chunks across a worker pool sized to
hardwareConcurrency. Each worker owns an isolated WASM instance with
no shared memory between workers.

```sh
bun i -g lvthn # or npm install -g lvthn

# pass phrases
lvthn encrypt -p "correct horse battery" secret.txt
lvthn decrypt -p "correct horse battery" secret.enc

# key files and unix pipes
lvthn keygen --armor -o my.key
cat secret.txt | lvthn encrypt -k my.key --armor > secret.enc
```

→ [lvthncli/README.md](./lvthncli/README.md)

→ [npmjs.org/package/lvthn](https://www.npmjs.com/package/lvthn)

---

### `lvthn-web` — browser encryption tool

A single, self-contained HTML file powers this demo. Encrypt text
or files using Serpent-256-CBC and Argon2id key derivation, then
share the armored output. No server, installation, or network connection
required after initial load. The code in is written to be read.
The Encrypt-then-MAC construction, HMAC input (header with HMAC
field zeroed + ciphertext), and Argon2id parameters are all
intentional examples worth reading.

```sh
cd lvthn-web && bun install && bun run build.ts
open lvthn.html
```

→ [lvthn-web/README.md](./lvthn-web/README.md)

→ [browser demo](https://leviathan.3xi.club/web)

---

### `lvthn-chat` — end-to-end encrypted chat


End-to-end encrypted chat featuring two-party messaging over X25519
key exchange and XChaCha20-Poly1305 message encryption. The relay
server functions as a dumb WebSocket pipe that never sees plaintext.
Each message incorporates sequence numbers, which allows the system
to detect and reject replayed messages from an attacker. The demo
deconstructs the protocol step by step, with visual feedback for
both injection and replays.

```sh
cd lvthn-chat && bun install
cd server && bun run server.ts &
open client/lvthn-chat.html
```

→ [lvthn-chat/README.md](./lvthn-chat/README.md)

→ [browser demo](https://leviathan.3xi.club/chat)

---

### `lvthncli-serpent` — teaching artifact

Serpent-256-CTR + HMAC-SHA256 CLI, structurally identical to
`lvthncli-chacha`. Diff the two packages to see exactly what changes when
you swap ciphers. (confined to `src/pool.ts` and `src/worker.ts`)

→ [lvthncli-serpent/README.md](./lvthncli-serpent/README.md)

---

### `lvthncli-chacha` — teaching artifact

XChaCha20-Poly1305 CLI, structurally identical to `lvthncli-serpent`. The
AEAD primitive eliminates the separate HMAC step, which is the main
structural difference between the two packages.

→ [lvthncli-chacha/README.md](./lvthncli-chacha/README.md)

---

### `site` — project website

Static site for leviathan-crypto. Built with Bun and Shiki for syntax
highlighting.

```sh
cd site && bun install && bun run bake && bun run start
```

---

## Prerequisites

All projects require [Bun](https://bun.sh) to build.

>[!NOTE]
> The published `lvthn` cli tool also installs cleanly
> with npm or any nodejs-compatible package manager.

```sh
curl -fsSL https://bun.sh/install | bash
```

---

## Repository layout

```
leviathan-demos/
├── lvthncli/            # published CLI (npm: lvthncli)
├── lvthncli-serpent/    # teaching artifact — Serpent-256-CTR
├── lvthncli-chacha/     # teaching artifact — XChaCha20-Poly1305
├── lvthn-web/           # single-file browser encryption tool
├── lvthn-chat/          # E2E encrypted chat demo
├── site/                # project website (leviathan.3xi.club)
├── package.json         # workspace root (lint tools only)
└── tsconfig.base.json   # shared TypeScript base config
```

---

## License

leviathan and it's demos are written under the [MIT license](http://www.opensource.org/licenses/MIT).

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
