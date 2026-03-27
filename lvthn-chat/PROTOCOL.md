# lvthn-chat Wire Protocol

Version 1.0

This document specifies the complete wire protocol for lvthn-chat. All
cryptographic processing happens in the browser. The relay server is a dumb
pipe that never inspects message content beyond routing metadata.

---

## Transport

All communication is WebSocket over `ws://localhost:3000`.

The server and clients exchange JSON-encoded text frames. Every frame is a
JSON object with at minimum a `type` field.

---

## Connection Flow

```
1.  Alice opens client → generates X25519 keypair (client-side only)
2.  Alice connects to server → sends { type: 'join', room: '' }
3.  Server creates room → replies { type: 'joined', room: 'X7K2PQ', peerCount: 1 }
4.  Alice displays room code "X7K2PQ" → waits for peer
5.  Bob opens client → generates X25519 keypair
6.  Bob connects to server → sends { type: 'join', room: 'X7K2PQ' }
7.  Server pairs clients → sends both { type: 'peer_joined' }
8.  Alice sends her public key → { type: 'relay', room: 'X7K2PQ', payload: <base64> }
9.  Bob sends his public key → { type: 'relay', room: 'X7K2PQ', payload: <base64> }
10. Server forwards each relay to the other client
11. Alice receives Bob's pubkey → derives shared secret via X25519
12. Bob receives Alice's pubkey → derives shared secret via X25519
13. Both display "✓ secure session established"
14. All subsequent messages are AEAD-encrypted with the shared secret
```

The shared secret is derived independently by each client and never transmitted.
The server sees only opaque base64 blobs from step 8 onward.

---

## Message Types

### Client → Server

#### `join`

Connect to a room. Send immediately after WebSocket connection opens.

```json
{
  "type": "join",
  "room": ""
}
```

Fields:
- `type` — `"join"` (string, required)
- `room` — room code to join, or empty string `""` to create a new room (string, required)

#### `relay`

Send an encrypted payload to the peer. The server forwards the payload verbatim
to the other client in the room without inspecting content.

```json
{
  "type": "relay",
  "room": "X7K2PQ",
  "payload": "<base64>"
}
```

Fields:
- `type` — `"relay"` (string, required)
- `room` — the room code (string, required)
- `payload` — base64-encoded encrypted message (string, required)

---

### Server → Client

#### `joined`

Sent after a successful `join`. Includes the room code (useful when the server
generated it for a new room) and the current peer count.

```json
{
  "type": "joined",
  "room": "X7K2PQ",
  "peerCount": 1
}
```

Fields:
- `type` — `"joined"`
- `room` — the assigned or joined room code
- `peerCount` — number of clients now in the room (1 or 2)

When `peerCount === 2`, a peer was already waiting. Expect a `peer_joined` to
follow immediately, and begin the key exchange.

#### `peer_joined`

Sent to both clients when the second client joins a room.

```json
{ "type": "peer_joined" }
```

Upon receiving this, both clients should initiate the public key exchange by
sending a `relay` message containing their public key.

#### `peer_left`

Sent when the other client disconnects.

```json
{ "type": "peer_left" }
```

The receiving client should disable sending, clear the shared secret from
memory, and offer a "start new session" option.

#### `relay`

A payload forwarded from the peer. The `room` field is omitted — the server
already knows which room this client is in.

```json
{
  "type": "relay",
  "payload": "<base64>"
}
```

Fields:
- `type` — `"relay"`
- `payload` — base64-encoded content from the peer (verbatim, not inspected)

#### `error`

An error condition the server can describe to the client.

```json
{
  "type": "error",
  "message": "room is full"
}
```

Error cases:
- Room not found (client sent `join` with an unknown code)
- Room is full (third client attempted to join a two-client room)

---

## Encrypted Payload Format

All `relay` payloads (both the base64 string in the WebSocket frame and its
decoded content) follow this structure:

```typescript
interface EncryptedMessage {
  msgType:    'pubkey' | 'chat' | 'replay_attack';
  nonce:      string;   // base64, 24 bytes (192 bits)
  tag:        string;   // base64, 16 bytes (128 bits)
  ciphertext: string;   // base64, same length as plaintext
  aad:        string;   // base64 of the UTF-8 JSON-encoded MessageAAD
}
```

The payload transmitted in the WebSocket frame is `btoa(JSON.stringify(EncryptedMessage))`.

---

## AAD (Additional Authenticated Data)

```typescript
interface MessageAAD {
  sender:    string;  // display name chosen by the sender at connect time
  sequence:  number;  // monotonically increasing per-sender counter, starting at 1
  timestamp: number;  // Unix time in milliseconds (Date.now())
  roomCode:  string;  // the 6-character room code
}
```

The AAD is serialised as `JSON.stringify(MessageAAD)` and UTF-8 encoded. This
byte array is passed as the `aad` parameter to `XChaCha20Poly1305.encrypt()`
and `XChaCha20Poly1305.decrypt()`. The encrypted message stores it as
`base64(aad_bytes)` in the `aad` field so the recipient can decode and display
it without re-serialising.

AAD is **authenticated but not encrypted**. It is included in the Poly1305 MAC
computation. Any modification to the sender, sequence, timestamp, or roomCode
fields will cause tag verification to fail. However, an observer with access
to the wire (or the relay server) can read the AAD plaintext.

---

## Replay Attack Prevention

The `sequence` field in AAD is the mechanism for replay protection.

Each sender maintains an independent monotonically increasing counter starting
at 1. The counter increments by 1 for every chat message sent.

Each recipient tracks the highest sequence number seen per sender. Upon
receiving a message:

1. Verify the Poly1305 tag (authentication)
2. If the tag is valid, check: `sequence <= lastSeenSequence[sender]`
3. If step 2 is true: the message is a replay — discard it and display a
   warning. Do not deliver plaintext to the user.
4. Otherwise: update `lastSeenSequence[sender] = sequence` and deliver.

The `roomCode` in AAD binds each message to the specific session. Even if an
attacker replays a message in a different room with the same key (impossible
in practice since keys are ephemeral per-session), the roomCode check would
cause decryption to succeed but the roomCode to mismatch.

---

## Public Key Exchange Messages

The public key exchange uses `msgType: 'pubkey'`. Since no shared secret
exists at this point, the public key message is intentionally unencrypted:

```json
{
  "msgType": "pubkey",
  "nonce":      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
  "tag":        "AAAAAAAAAAAAAAAA",
  "ciphertext": "<base64 of raw 32-byte X25519 public key>",
  "aad":        ""
}
```

- `nonce` is 24 zero bytes (base64: 32 `A`s and `==`)
- `tag` is 16 zero bytes
- `ciphertext` is the raw X25519 public key (32 bytes), base64-encoded without
  any encryption applied
- `aad` is an empty string

**Tag verification is skipped for `pubkey` messages.** Public keys are not
secret — they are designed to be transmitted in the clear. This is by design
and is explicitly documented here. All subsequent messages after key exchange
use full AEAD with tag verification.

---

## AEAD Encryption (Chat Messages)

Algorithm: `XChaCha20Poly1305` from the leviathan library (RFC 8439 +
XChaCha20 draft).

```
key     = X25519_shared_secret(my_sk, peer_pk)  // 32 bytes
nonce   = crypto.getRandomValues(new Uint8Array(24))  // fresh per message
aad     = TextEncoder.encode(JSON.stringify({ sender, sequence, timestamp, roomCode }))
{ ciphertext, tag } = XChaCha20Poly1305.encrypt(key, nonce, plaintext, aad)
```

The shared secret is used directly as the XChaCha20-Poly1305 key. This is
acceptable for this demo because each session uses a fresh ephemeral X25519
keypair. In a production system, the shared secret would be passed through
HKDF to derive separate keys for each direction.

Decryption:
```
plaintext = XChaCha20Poly1305.decrypt(key, nonce, ciphertext, tag, aad)
```

`decrypt()` verifies the Poly1305 tag before returning any plaintext. If the
tag does not match, it throws `'XChaCha20Poly1305: authentication failed'`.

---

## Room Codes

Room codes are 6-character strings drawn from the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
(uppercase, no ambiguous characters: no `O`, `0`, `1`, `I`). They are generated
server-side using `crypto.randomUUID()` as entropy source.

Room codes are short-lived: they exist only as long as at least one client is
connected. When both clients disconnect, the room is deleted.

---

## Server Constraints

The relay server:
- Never parses the `payload` field of `relay` messages
- Never logs payload content (see comment in server.ts: `// relay only — never log payload`)
- Never stores messages (relay only, no persistence)
- Accepts at most 2 clients per room
- Has no authentication — room codes provide only routing, not security
