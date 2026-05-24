# leviathan web

> [!NOTE]
> A single-file browser encryption tool built on
> [leviathan-crypto](https://github.com/xero/leviathan-crypto). It encrypts text
> and files entirely client-side using Serpent-256-CBC + HMAC-SHA256,
> XChaCha20-Poly1305, or AES-256-GCM-SIV, with scrypt passphrase derivation. No
> server, no installation, and no network connection after the first load.

> ### Table of Contents
> - [What it demonstrates](#what-it-demonstrates)
> - [How it works](#how-it-works)
> - [Build and run](#build-and-run)
> - [Source layout](#source-layout)
> - [Wire format](#wire-format)
> - [Security notes](#security-notes)
> - [Related](#related)
> - [License](#license)

---

## What it demonstrates

This demo encrypts and decrypts in the browser with no server in the loop. Pick
a cipher, supply a passphrase or keyfile, and produce armored text or a binary
`.lvthn` file. The output is byte-compatible with the `lvthn` command-line tool,
so a file encrypted here decrypts with `lvthn decrypt` and the reverse.

The code is written to be read. The Encrypt-then-MAC construction, the HMAC
input layout, and the scrypt parameters are documented inline in `src/app.js`.

---

## How it works

**Ciphers.** Three suites are selectable on encrypt: Serpent-256-CBC with
HMAC-SHA256 (Encrypt-then-MAC), XChaCha20-Poly1305, and AES-256-GCM-SIV. On
decrypt the cipher byte in the file header selects the suite automatically, so
no UI flag is needed. Encryption and decryption run through
leviathan-crypto's `SealStreamPool`, which splits the data into chunks across a
worker pool.

**Passphrase path.** scrypt (N=32768, r=8, p=1, dkLen=32) with a fresh random
32-byte salt, producing a 32-byte master key. The parameters match the `lvthn`
CLI exactly.

**Keyfile path.** The keyfile is read as 32 raw bytes and used directly as the
master key. The keygen panel produces 32 random bytes (256-bit) from WebCrypto;
download it as a binary keyfile or copy the hex. A key generated here or by
`lvthn keygen` works in either tool.

---

## Build and run

Requires [Bun](https://bun.sh).

```sh
bun install
bun bake
# → dist/index.html
```

Open `dist/index.html` in any modern browser. No server required.

`bake` runs `build.ts`, which pre-bundles the cipher pool workers, bundles
`leviathan.web-entry.ts` with Bun, and inlines that bundle, `src/style.css`,
`src/app.js`, and its helper modules into `src/template.html`. The result is a
self-contained HTML file with no external runtime dependencies.

---

## Source layout

```
web/
├── src/
│   ├── template.html          # page structure and markup
│   ├── style.css              # all styles
│   ├── app.js                 # encrypt, decrypt, keygen UI logic
│   ├── crypto.js              # scrypt derivation and key handling
│   ├── format.js              # LVTHN header read/write
│   ├── cipher-suites.js       # pool cipher suite wrappers
│   └── workers/               # generated cipher pool workers
├── leviathan.web-entry.ts     # leviathan-crypto bundle entry
├── build.ts                   # build script
└── dist/
    └── index.html             # built output
```

---

## Wire format

Files use the `LVTHN` v3 format, byte-compatible with the `lvthn` CLI across all
three cipher suites.

```
Offset  Size  Field    Description
------  ----  -----    -----------
0       5     magic    "LVTHN" (0x4c 0x56 0x54 0x48 0x4e)
5       1     version  0x03
6       1     cipher   0x01 = Serpent-256-CBC + HMAC-SHA256
                       0x02 = XChaCha20-Poly1305
                       0x03 = AES-256-GCM-SIV
7       1     kdf      0x01 = scrypt (N=32768, r=8, p=1, dkLen=32)
                       0x02 = keyfile (raw 32 bytes)
8       1     flags    0x00 (reserved)
9       32    salt     scrypt salt; all-zero for keyfile mode
41+     N     payload  SealStreamPool output (20-byte preamble + chunks)
```

The cipher byte at offset 6 selects the pool on decrypt. See
[cli/FORMAT.md](../cli/FORMAT.md) for the full specification, including the pool
preamble layout and the counter-nonce scheme.

---

## Security notes

> [!WARNING]
> Format version 0x03 is not backward compatible with 0x02. The Serpent cipher
> flipped its public byte-order convention in leviathan-crypto v3 to match NIST
> natural byte order, so v2 ciphertexts cannot be decrypted by a v3 build.
> Re-encrypt any persisted v2 files under v3.

- **Encrypt-then-MAC.** The Serpent suite authenticates the header (with the HMAC
  field zeroed) concatenated with the ciphertext, so any modification fails
  before decryption.
- **Authenticated decryption.** Every suite rejects a tampered file rather than
  returning partial plaintext.
- **Client-side only.** Key material never leaves the browser, and nothing is
  sent over the network after the page loads.

---

## Related

- [leviathan-crypto](https://github.com/xero/leviathan-crypto): the underlying library
- [tamper demo](../tamper/README.md), [kyber demo](../kyber/README.md), [jwt demo](../jwt/README.md), [cli tool](../cli/README.md)
- [covcom](https://github.com/xero/covcom): a production secure messenger built on the same library
- [LVTHN wire format](../cli/FORMAT.md): full binary specification
- Live demo: [leviathan.3xi.club/web](https://leviathan.3xi.club/web)

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
