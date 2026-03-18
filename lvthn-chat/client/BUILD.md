# Building the Chat Client

The chat client (`lvthn-chat.html`) is a self-contained single HTML file with
the leviathan crypto library inlined. It requires no server to open — use
`open lvthn-chat.html` or drag into a browser tab.

## Quick build

From this directory:
```bash
bun run build.ts
```

This does two things:
1. Bundles `leviathan.chat-entry.ts` → `leviathan.bundle.js` (ESM, ~440 KB with embedded WASM)
2. Inlines the bundle into `lvthn-chat.template.html` → `lvthn-chat.html`

## Manual steps (if you want to do it yourself)

```bash
# Step 1: build the bundle
bun build leviathan.chat-entry.ts \
  --outfile leviathan.bundle.js \
  --target browser \
  --format esm

# Step 2: inline into template
bun run build.ts   # still needed to do the template substitution
```

## What is exported

`leviathan.chat-entry.ts` exports only what the chat client needs:
- `init`              — WASM module loader (called at startup before any crypto)
- `XChaCha20Poly1305` — AEAD encrypt/decrypt (RFC 8439 + XChaCha20 draft)
- `bytesToHex`        — hex encoding for display

X25519 key generation and ECDH are handled by the browser's built-in
`crypto.subtle` API — no library needed. The private key is managed by
SubtleCrypto and is not accessible to JavaScript.

`Fortuna` and `Random` are excluded — the chat client uses
`crypto.getRandomValues()` directly for nonce generation.

## Note on minification

Do NOT use `--minify`. Bun's minifier renames class internal properties, which
breaks leviathan code that accesses named properties on its own instances.
