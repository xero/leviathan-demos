# lvthn-chat Smoke Test Checklist

Manual verification steps. Run after any change to the client or server.

Prerequisites:
1. `cd server && bun run server.ts` — relay running on ws://localhost:3000
2. `open client/lvthn-chat.html` in two separate browser windows (Window A and Window B)

---

## Phase 1: Setup

- [ ] Page loads without console errors in both windows
- [ ] "Setup" section is visible; "Key Exchange" and "Chat" sections are hidden
- [ ] Private key is hidden by default; clicking eye icon reveals it
- [ ] Public key is displayed (64 hex chars)
- [ ] "Start new session" radio is selected by default; "Join session" radio shows code input when selected
- [ ] Clicking "Connect" in Window A starts a session and shows a 6-character room code
- [ ] Room code uses only characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no O, 0, 1, I)

---

## Phase 2: Key Exchange

- [ ] Window A shows "Waiting for peer..." after connecting
- [ ] Window B: select "Join session", enter the room code from A, click "Connect"
- [ ] Both windows advance to "Key Exchange" phase within ~1 second
- [ ] Exchange checklist shows 4 steps completing in sequence:
  - [ ] ✓ Connected to relay
  - [ ] ✓ Peer joined
  - [ ] ✓ Public keys exchanged
  - [ ] ✓ Shared secret derived
- [ ] Both windows show "✓ secure session established"
- [ ] Chat phase appears; Setup and Key Exchange sections are hidden
- [ ] Room code appears in the chat header

---

## Phase 3: Encrypted Messaging

- [ ] Window A: type "hello" and press Enter (or click Send)
- [ ] Message appears in Window A's message list (right-aligned or labelled with A's name)
- [ ] Same message appears in Window B's message list (left-aligned or labelled with A's name)
- [ ] Window B: type "world" and send
- [ ] Message appears in both windows with correct sender attribution
- [ ] Send button is disabled before key exchange completes (test: reload B, try to send before exchange)

---

## Crypto Inspector

After sending a message (or receiving one), check the panel on the right:

- [ ] Nonce field shows 48 hex characters (24 bytes)
- [ ] Tag field shows 32 hex characters (16 bytes)
- [ ] AAD field shows valid JSON with `sender`, `sequence`, `timestamp`, `roomCode`
- [ ] `sequence` starts at 1 and increments with each message from the same sender
- [ ] Status shows "✓ Tag verified" and "✓ Decrypted"
- [ ] "Server saw" field shows an opaque base64 blob (not plaintext)
- [ ] The base64 blob does not contain the message text in any readable form

---

## Replay Attack Demo

- [ ] Window A sends a message to Window B
- [ ] In Window B, click "Replay last message"
- [ ] Window A shows a "REPLAY ATTACK DETECTED" warning (not the message plaintext)
- [ ] The warning shows the sequence number that was replayed
- [ ] Inspector in Window A shows "REPLAY" badge
- [ ] After the replay attempt, Window A can send a new message normally
- [ ] Window B receives and displays the new message correctly (replay did not break the session)

---

## Disconnection

- [ ] Close Window B (or its tab)
- [ ] Window A shows "Peer disconnected" notice
- [ ] Send button in Window A is disabled
- [ ] "Start new session" button appears in Window A
- [ ] Clicking "Start new session" reloads and returns to Phase 1

---

## Error Cases

- [ ] Third browser window: attempt to join the active room code — server returns error "room is full"
- [ ] Window: enter a nonexistent room code — server returns an error (room not found or similar)
- [ ] Server not running: connect attempt shows a connection error in the UI (not a blank page)

---

## Server Log

Check the relay server terminal during the session:

- [ ] Server prints "server sees only encrypted blobs — plaintext never leaves the browser" on startup
- [ ] Connection and disconnection events are logged
- [ ] No payload content (message text or keys) appears in the server log

---

## Automated Tests

```bash
cd demos/lvthn-chat
npx playwright test
# Expected: 29 passed
```
