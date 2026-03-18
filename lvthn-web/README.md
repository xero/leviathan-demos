# lvthn-web

A single-file, offline-capable web app for Serpent-256 encryption. Open `lvthn.html` in any
modern browser — no server, no install, no network required.

## Usage

Open `lvthn.html` in a browser. No server needed.

### Encrypt

1. Select **ENCRYPT** mode (default)
2. Type or paste your message in the **TEXT** tab, or switch to **FILE** to upload any file
3. Choose a key method:
   - **PASSPHRASE** — enter a passphrase (shown with strength indicator)
   - **KEYFILE** — upload a raw keyfile (16, 24, or 32 bytes)
   - **GENERATE KEY** — generate a fresh random key; download or copy it before encrypting
4. Click **ENCRYPT**
5. Copy the armored output or download as `.txt` / `.lvthn`

### Decrypt

1. Select **DECRYPT** mode
2. Paste the armored message in the **TEXT** tab, or upload a `.lvthn` binary in **FILE**
3. Provide the same key used to encrypt (passphrase or keyfile)
4. Click **DECRYPT**

Wrong key or tampered data produces "authentication failed" — by design this message is the
same for both cases (no oracle).

## Build

Prerequisites: [Bun](https://bun.sh)

```sh
bun install

# Build lvthn.html (bundles leviathan-crypto and inlines into template)
bun run build.ts

# Lint
bun run lint

# Run smoke tests (requires Playwright Chromium browser)
bunx playwright install chromium   # first time only
bunx playwright test
```

## About this demo

lvthn-web serves two purposes:

**Proof of concept** — a working single-file, offline-capable Serpent-256
encryption tool, showing that leviathan-crypto's symmetric primitives and
Argon2id key derivation can be composed into a real application that runs
entirely in the browser with no server or install required.

**Implementation reference** — the code is written to be read. The patterns
shown here are appropriate for production use and are intentional examples
worth copying:
- Encrypt-then-MAC using `SerpentCbc` + `HMAC_SHA256` with `constantTimeEqual`
- HMAC computed over `header_with_hmac_zeroed + ciphertext` (not just ciphertext)
- Argon2id for passphrase key derivation with OWASP 2023 minimum parameters
- Fresh IV per encryption via `crypto.getRandomValues`
- `{ dangerUnauthenticated: true }` is the correct flag when you are handling
  authentication yourself via Encrypt-then-MAC — the warning is for callers who
  skip MAC entirely, not for this pattern

The **security details panel** is educational. It documents the construction,
what it protects, and what it does not. A production app could include similar
documentation without exposing internals — explaining your threat model to users
is good practice, not an anti-pattern.

## Format

### Binary (LVWB)

```
[ magic:   4 bytes  ] "LVWB" (0x4c 0x56 0x57 0x42)
[ version: 1 byte   ] 0x01
[ kdf:     1 byte   ] 0x02=keyfile  0x03=argon2id-passphrase
[ keysize: 1 byte   ] 16, 24, or 32
[ salt:    32 bytes ] Argon2id salt (zeroed for keyfile mode)
[ iv:      16 bytes ] Serpent-CBC IV (random per encryption)
[ hmac:    32 bytes ] HMAC-SHA256 over (header_with_hmac_zeroed + ciphertext)
[ cipher:  N bytes  ] Serpent-256-CBC-PKCS7
```

Total header: 87 bytes.

### Armored (text)

```
-----BEGIN LVTHN ENCRYPTED MESSAGE-----
<base64, 64 chars/line>
-----END LVTHN ENCRYPTED MESSAGE-----
```

## Security

| Property | Value |
|----------|-------|
| Cipher | Serpent-256-CBC with PKCS7 padding |
| Integrity | HMAC-SHA256 over full blob (HMAC field zeroed) |
| Key derivation | Argon2id — 19 MiB RAM, 2 passes, 1 thread (OWASP 2023) |
| IV | 128-bit, fresh per encryption via `window.crypto.getRandomValues` |
| HMAC comparison | `constantTimeEqual` — no timing oracle |

### Argon2id key derivation

Passphrase mode uses Argon2id (RFC 9106) via the
[argon2id](https://www.npmjs.com/package/argon2id) npm package (WASM-backed).
Serpent-CBC and HMAC-SHA256 use
[leviathan-crypto](https://github.com/xero/leviathan-crypto) (WASM-backed).

Argon2id forces each password guess to allocate and fill 19 MiB of RAM,
making GPU/ASIC parallel attacks orders of magnitude more expensive than
CPU-only KDFs like PBKDF2. Parameters follow the OWASP 2023 minimum:

| Parameter | Value |
|-----------|-------|
| Memory | 19,456 KiB (19 MiB) |
| Passes | 2 |
| Parallelism | 1 thread |
| Salt | 256-bit, random per encryption |
| Output | 256-bit key |

HMAC is verified **before** decryption. Wrong key and tampered data both produce the same
error message.

All cryptographic operations are local. The page makes zero network requests.

## Limitations

- Files are processed entirely in memory — not suitable for very large files (hundreds of MB)
- No key stretching for keyfile mode — key must be high-entropy (random bytes, not text)
