```
                  ▄▄▄▄▄▄▄▄▄▄
           ▄████████████████████▄▄          ▒  ▄▀▀ ▒ ▒ █ ▄▀▄ ▀█▀ █ ▒ ▄▀▄ █▀▄
        ▄██████████████████████ ▀████▄      ▓  ▓▀  ▓ ▓ ▓ ▓▄▓  ▓  ▓▀▓ ▓▄▓ ▓ ▓
      ▄█████████▀▀▀     ▀███████▄▄███████▌  ▀▄ ▀▄▄ ▀▄▀ ▒ ▒ ▒  ▒  ▒ █ ▒ ▒ ▒ █
     ▐████████▀   ▄▄▄▄     ▀████████▀██▀█▌
     ████████      ███▀▀     ████▀  █▀ █▀       Leviathan Crypto Library
     ███████▌    ▀██▀         ███
      ███████   ▀███           ▀██ ▀█▄      Repository & Mirror:
       ▀██████   ▄▄██            ▀▀  ██▄    github.com/xero/leviathan-crypto
         ▀█████▄   ▄██▄             ▄▀▄▀    unpkg.com/leviathan-crypto
            ▀████▄   ▄██▄
              ▐████   ▐███                  Author: xero (https://x-e.ro)
       ▄▄██████████    ▐███         ▄▄      License: MIT
    ▄██▀▀▀▀▀▀▀▀▀▀     ▄████      ▄██▀
  ▄▀  ▄▄█████████▄▄  ▀▀▀▀▀     ▄███         This file is provided completely
   ▄██████▀▀▀▀▀▀██████▄ ▀▄▄▄▄████▀          free, "as is", and without
  ████▀    ▄▄▄▄▄▄▄ ▀████▄ ▀█████▀  ▄▄▄▄     warranty of any kind. The author
  █████▄▄█████▀▀▀▀▀▀▄ ▀███▄      ▄████      assumes absolutely no liability
   ▀██████▀             ▀████▄▄▄████▀       for its {ab,mis,}use.
                           ▀█████▀▀
```
# lvthn-chat-demo

A two-party end-to-end encrypted chat demo using X25519 key exchange and
XChaCha20-Poly1305 AEAD from the leviathan cryptography library.

The relay server is a dumb pipe — it routes WebSocket frames between two
clients without ever seeing plaintext. All cryptographic operations happen
in the browser.

---

## Quick start

**Terminal 1 — start the relay server:**
```bash
cd server
bun run server.ts
# Listening on ws://localhost:3000
```

**Browser — open the client:**
```bash
open client/lvthn-chat.html
```

Open the file in two separate browser windows (or two tabs). One window
starts a new session and shares the room code; the other window joins with
that code.

---

## Building the client

The client is a single self-contained HTML file. If you need to rebuild it
(after modifying the template or the leviathan source):

```bash
cd client
bun run build.ts
# Built: ./lvthn-chat.html  (79 KB)
```

See `client/BUILD.md` for details.

---

## About this demo

lvthn-chat serves two purposes:

**Proof of concept** — a working two-party E2E encrypted chat, showing that
leviathan-crypto's AEAD primitives and the browser's SubtleCrypto X25519 key
exchange can be composed into a real application with a minimal relay server.

**Implementation reference** — the code is written to be read. The crypto
patterns shown here are appropriate for production use and are intentional
examples worth copying:
- AAD structure binding messages to sender, sequence, timestamp, and room
- Sequence-based replay detection
- Ephemeral keypairs (fresh per session)
- Key wiping on disconnect

The **crypto inspector panel** is an exception. Surfacing nonces, tags, and
raw ciphertext in the UI is deliberate for educational purposes — it makes the
wire-level behavior of XChaCha20-Poly1305 visible and inspectable. A production
messaging app should not expose these fields to the user. The inspector exists
to help you understand what the library is doing under the hood, not as a
pattern to reproduce.

---

## How it works

### Phase 1: Setup

Each browser tab generates a fresh X25519 keypair using leviathan's
`Curve25519.generateKeys()`. The private key never leaves the browser tab
that generated it.

### Phase 2: Key exchange

When both clients join the same room, each sends their X25519 public key to
the server via a `relay` message. The server forwards each key to the other
client without inspecting it.

Each client then computes the shared secret independently:
```
shared_secret = X25519(my_private_key, peer_public_key)
```

The shared secret is identical on both ends (X25519 is commutative) and is
never transmitted. The server sees only opaque base64 blobs after this point.

### Phase 3: Encrypted chat

Every message is encrypted with `XChaCha20Poly1305`:
```
nonce      = crypto.getRandomValues(24 bytes)   // fresh per message
aad        = JSON({ sender, sequence, timestamp, roomCode })
ciphertext = XChaCha20Poly1305.encrypt(shared_secret, nonce, plaintext, aad)
```

The AAD (Additional Authenticated Data) is authenticated by the Poly1305 MAC
but not encrypted — the server can read sender names, sequence numbers, and
timestamps, but not message content.

### Crypto inspector

The panel on the right shows the wire-level details of the most recently
sent or received message:
- Nonce (24 bytes / 48 hex chars)
- Poly1305 authentication tag (16 bytes / 32 hex chars)
- AAD decoded as JSON
- Verification status
- The raw base64 blob the server actually saw

### Replay attack demo

The **Replay last message** button re-sends the captured wire blob back to
the sender. The receiving client detects the replay via the sequence counter
in AAD and displays a warning instead of delivering the message. The
authentication tag still verifies (the blob is unmodified), but the
sequence number check catches it.

---

## What the server sees

The relay server sees:
- Room codes (routing only)
- Sender display names (in AAD, authenticated but not encrypted)
- Message sequence numbers and timestamps (in AAD)
- Room codes in AAD
- Opaque base64 ciphertext (the actual message content)

The server **never** sees:
- Private keys
- Shared secrets
- Plaintext message content

---

## Limitations (demo scope)

This is a demonstration, not a production messaging system. Known limitations:

- **No forward secrecy** — a single static shared secret is used for the
  entire session. In a production system, a ratchet (e.g. Signal Protocol)
  would derive new keys per message.
- **No HKDF** — the raw X25519 output is used directly as the AEAD key.
  Production use should pass it through HKDF to derive separate keys for
  each direction.
- **No authentication** — room codes provide only routing. Either party
  could be a man-in-the-middle during the key exchange phase. Production
  use requires out-of-band public key verification (e.g. key fingerprint
  comparison over a trusted channel).
- **No persistence** — messages and keys exist only in browser memory.
  Refreshing either tab ends the session.
- **Single-hop relay** — the server supports exactly two clients per room.
  Groups and multi-hop routing are not implemented.
- **localhost only** — no TLS is configured for the WebSocket connection.

---

## Files

```
lvthn-chat/
  PROTOCOL.md         Wire protocol specification
  README.md           This file
  SMOKE_TEST.md       Manual verification checklist

  server/
    server.ts         Bun WebSocket relay server (dumb pipe)
    package.json      Server package (no dependencies)

  client/
    lvthn-chat.html           Built output (open in browser)
    lvthn-chat.template.html  Source template
    leviathan.bundle.js       Leviathan ESM bundle (44 KB)
    leviathan.chat-entry.ts   Bundle entry point
    build.ts                  Build script
    BUILD.md                  Build instructions

  test/
    smoke.test.ts     29 Playwright tests (automated)

  playwright.config.ts
  package.json        Playwright devDependency
```

---

## Running the tests

```bash
# Install Playwright (once)
cd demos/lvthn-chat
npm install
npx playwright install chromium

# Run tests (starts relay server automatically)
npx playwright test

# Run headed (watch the browser)
HEADED=1 npx playwright test
```

29 tests, all passing. See `test/smoke.test.ts` for coverage.
