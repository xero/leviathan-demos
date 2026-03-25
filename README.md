# leviathan-demos

Demo applications and reference implementations built on
[leviathan-crypto](https://github.com/xero/leviathan-crypto) — a
zero-dependency WebAssembly cryptography library for TypeScript.

Each project in this repository is a working application that can be used
directly or read as an implementation reference. The teaching artifacts
(`lvthncli-serpent`, `lvthncli-chacha`) are kept as separate packages
so the crypto layer diff is minimal and legible.

---

## Projects

### `lvthncli` — file encryption CLI

**The tool to install if you just want something to use.**

Supports Serpent-256-CTR+HMAC-SHA256 and XChaCha20-Poly1305 behind a
`--cipher` flag. A keyfile generated with `lvthn keygen` works with either
cipher. Files are interoperable — the cipher byte in the header drives
decryption automatically.

```sh
npm install -g lvthncli   # or: bun install -g lvthncli
lvthn encrypt -p "correct horse battery" secret.txt
lvthn decrypt -p "correct horse battery" secret.enc
```

→ [lvthncli/README.md](./lvthncli/README.md)

---

### `lvthn-web` — browser encryption tool

A single self-contained HTML file. Open it locally, encrypt text or files
with Serpent-256-CBC and Argon2id key derivation, and share the armored
output. No server, no install, no network required after the first load.

```sh
cd lvthn-web && bun install && bun run build.ts
open lvthn.html
```

→ [lvthn-web/README.md](./lvthn-web/README.md)

---

### `lvthn-chat` — end-to-end encrypted chat

A two-party chat demo using X25519 key exchange (SubtleCrypto) and
XChaCha20-Poly1305 (leviathan-crypto WASM) for message encryption. The
relay server is a dumb WebSocket pipe — it never sees plaintext.

```sh
cd lvthn-chat && bun install
cd server && bun run server.ts &
open client/lvthn-chat.html
```

→ [lvthn-chat/README.md](./lvthn-chat/README.md)

---

### `lvthncli-serpent` — teaching artifact

Serpent-256-CTR + HMAC-SHA256 CLI, structurally identical to
`lvthncli-chacha`. Diff the two packages to see exactly what changes when
you swap ciphers — it is confined to `src/pool.ts` and `src/worker.ts`.

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

All projects require [Bun](https://bun.sh). The published `lvthncli`
package also installs cleanly with npm or any Node-compatible package
manager.

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
├── site/                # project website
├── package.json         # workspace root (lint only)
└── tsconfig.base.json   # shared TypeScript base config
```

---

## License

MIT — see individual package `package.json` files for details.
