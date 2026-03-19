# lvthn-web

A single-file, offline-capable browser encryption tool using Serpent-256-CBC
with HMAC-SHA256 and Argon2id key derivation. Part of the
[leviathan-crypto](https://github.com/xero/leviathan-crypto) demo suite.

Open `lvthn.html` in any modern browser. No server, no install, no network
required after the initial page load. All cryptographic operations run locally
via WebAssembly.

---

## Build

Requires [Bun](https://bun.sh).

```sh
bun install
bun run build.ts
# → lvthn.html (self-contained, ready to open or distribute)
```

The build step bundles leviathan-crypto and the Argon2id WASM module directly
into the HTML file. The output is a single file you can open, email, or host
statically.

---

## Usage

### Encrypt

1. Select **ENCRYPT** mode (default)
2. Enter text in the **TEXT** tab, or switch to **FILE** to upload any file
3. Choose a key method:
   - **PASSPHRASE** — enter a passphrase (strength indicator shown)
   - **KEYFILE** — upload a raw binary keyfile (16, 24, or 32 bytes)
   - **GENERATE KEY** — generate a fresh random key and download it before encrypting
4. Click **ENCRYPT**
5. Copy the armored output or download as `.txt` (armored) or `.lvthn` (binary)

### Decrypt

1. Select **DECRYPT** mode
2. Paste an armored message in **TEXT**, or upload a `.lvthn` file in **FILE**
3. Provide the same key used to encrypt
4. Click **DECRYPT**

A wrong key or tampered file produces "authentication failed." By design, this
message is the same for both cases — there is no oracle distinguishing them.

---

## Security

**Cipher:** Serpent-256-CBC with PKCS7 padding.

**Authentication:** HMAC-SHA256 covers the header and ciphertext. Verification
happens before decryption (Encrypt-then-MAC). The `{ dangerUnauthenticated: true }`
flag on `SerpentCbc` is the correct option when you are handling authentication
yourself — the warning is for callers who skip MAC entirely, not for this pattern.

**Key derivation:** Argon2id (19 MiB RAM, 2 passes, 1 thread — OWASP 2023
minimum) for passphrases. A fresh 32-byte random salt is generated per
encryption. Raw keyfiles bypass KDF entirely.

**Locality:** nothing leaves the browser. No network calls are made after
page load. The page can be saved and used fully offline.

---

## About this demo

lvthn-web serves two purposes. As a **proof of concept**, it shows that
leviathan-crypto's symmetric primitives can be composed into a real,
usable application that runs entirely in the browser with no backend.

As an **implementation reference**, the code in `index.template.html` is
written to be read. The Encrypt-then-MAC construction, HMAC input
(header with HMAC field zeroed + ciphertext), and Argon2id parameters are
all intentional examples worth copying.
