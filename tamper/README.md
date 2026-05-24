# leviathan tamper

> [!NOTE]
> A crypto attack-resilience demo built on
> [leviathan-crypto](https://github.com/xero/leviathan-crypto). It runs a real
> two-party encrypted channel, then lets you attack it. Key exchange uses X25519,
> messages use XChaCha20-Poly1305, and a dumb WebSocket relay routes ciphertext
> without ever seeing plaintext.

> [!TIP]
> This is a teaching demo, not a messenger. For a production-ready secure
> messenger built on the same library, see
> [covcom](https://github.com/xero/covcom).

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

The point is not the chat; the point is watching the cryptography catch an
attacker in real time. Forge a replay and the sequence check rejects it. Tamper
with a frame and the Poly1305 tag fails. The inspector shows the tag verifying
while the message is still rejected, which is the distinction between
authenticity and freshness made visible.

As an implementation reference, the client shows how to compose leviathan-crypto
primitives into a working channel: X25519 key agreement, HKDF-SHA256 key
derivation, nonce management, AEAD with authenticated metadata, and
sequence-based replay protection. It is minimal but correct.

---

## How it works

Each window generates a fresh X25519 keypair on load. Sharing the connection
code pairs two windows through the relay, and a Diffie-Hellman exchange
establishes a shared secret. HKDF-SHA256 derives the message key from that
secret with a fixed context label, so both peers arrive at the same key.

Messages are encrypted with XChaCha20-Poly1305 using a fresh random 24-byte
nonce. The sender name and a monotonic sequence number are bound in as
authenticated data, which is what makes replay detection work: a replayed frame
still has a valid tag, but its sequence number has already been seen, so the
receiver rejects it.

---

## Build and run

Requires [Bun](https://bun.sh).

```sh
bun install
bun bake
# → dist/index.html
```

Start the relay in one terminal:

```sh
cd server
bun run server.ts
# Listening on ws://localhost:3000
```

Open `dist/index.html` in a browser, then open it again in a second window or
tab. Share the connection code from the first window with the second to
establish the encrypted session. Messages are encrypted before leaving the
browser; the relay holds no keys and cannot read the conversation.

> [!NOTE]
> The build does not minify the bundle. Bun's minifier renames class internal
> properties, which breaks leviathan code that reads named properties on its own
> instances.

---

## Source layout

```
tamper/
├── src/
│   ├── template.html           # page structure and markup
│   ├── style.css               # all styles
│   └── app.js                  # protocol, chat, and attack controls
├── server/
│   └── server.ts               # WebSocket relay (dumb pipe)
├── leviathan.tamper-entry.ts   # leviathan-crypto bundle entry
├── build.ts                    # build script
├── PROTOCOL.md                 # wire protocol specification
└── dist/
    └── index.html              # built output
```

---

## Protocol

X25519 key exchange, HKDF-SHA256 derivation, and XChaCha20-Poly1305 messaging
with authenticated sender and sequence metadata. The relay is a content-blind
pipe that routes frames between the two clients in a room. See
[PROTOCOL.md](./PROTOCOL.md) for the full wire specification and
[SMOKE_TEST.md](./SMOKE_TEST.md) for the manual two-window test walkthrough.

---

## Security notes

> [!IMPORTANT]
> The relay sees only encrypted blobs and session identifiers. It cannot read,
> modify, or inject messages without detection.

- **Key exchange.** `X25519.dh()` rejects an all-zero shared secret, which blocks
  small-order peer keys per RFC 7748 §7 (Security Considerations).
- **Key derivation.** The raw Diffie-Hellman output is run through HKDF-SHA256
  (RFC 5869) with a fixed context label before use, never used directly.
- **Replay protection.** Sequence numbers are bound in as authenticated data. A
  replayed message is rejected even though its Poly1305 tag still verifies.

---

## Related

- [leviathan-crypto](https://github.com/xero/leviathan-crypto): the underlying library
- [web demo](../web/README.md), [kyber demo](../kyber/README.md), [jwt demo](../jwt/README.md), [cli tool](../cli/README.md)
- [covcom](https://github.com/xero/covcom): a production secure messenger built on the same library
- [PROTOCOL.md](./PROTOCOL.md): wire protocol specification
- Live demo: [leviathan.3xi.club/tamper](https://leviathan.3xi.club/tamper)

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
