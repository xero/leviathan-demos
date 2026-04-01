# lvthn-chat

A two-party end-to-end encrypted chat demo using X25519 key exchange and
XChaCha20-Poly1305 AEAD. Part of the
[leviathan-crypto](https://github.com/xero/leviathan-crypto) demo suite.

The relay server is a dumb pipe — it routes WebSocket frames between two
clients without seeing plaintext. All cryptographic operations happen in
the browser.

---

## Build

Requires [Bun](https://bun.sh).

```sh
bun install

# Build the client HTML
cd client && bun run build.ts && cd ..
```

---

## Usage

**Terminal 1 — start the relay:**
```sh
cd server
bun run server.ts
# Listening on ws://localhost:3000
```

**Terminal 2 — open the client:**
```sh
open client/lvthn-chat.html
# or just open the file in your browser
```

Open the same file in a second browser window or tab. Each window generates
a fresh X25519 keypair on load. Share the connection code shown in window 1
with window 2 to establish the encrypted session.

Messages are encrypted before leaving the browser. The relay never holds keys
and has no way to read the conversation.

---

## Security

**Key exchange:** X25519 (Elliptic Curve Diffie-Hellman). Each session
generates a fresh ephemeral keypair. The shared secret is derived using
SubtleCrypto's native X25519 implementation — a deliberate choice to use the
browser's built-in implementation for the asymmetric layer rather than a
third-party WASM module.

**Message encryption:** XChaCha20-Poly1305 from leviathan-crypto (WASM-backed).
Each message uses a fresh random 24-byte nonce.

**Replay protection:** sequence numbers are bound into each message. An
attacker replaying an old message is detected and rejected.

**Relay trust:** the relay server sees only encrypted blobs and session
identifiers. It cannot read, modify, or inject messages without detection.

---

## About this demo

lvthn-chat serves two purposes. As a **proof of concept**, it shows
leviathan-crypto's XChaCha20-Poly1305 used in a realistic protocol alongside
browser-native X25519, demonstrating that the library composes cleanly with
SubtleCrypto.

As an **implementation reference**, the client code shows how to handle
session state, key derivation from a shared secret, nonce management, and
replay protection in a minimal but correct way.
