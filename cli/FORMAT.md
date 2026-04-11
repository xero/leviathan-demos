# LVTHNCLI Encrypted File Format

> [!NOTE]
> Version 2 (0x02). This document specifies the binary format produced and consumed by `lvthn`. The cipher byte at offset 9 determines which cryptographic scheme was used; `lvthn decrypt` reads it automatically and selects the correct pool.

> ### Table of Contents
> - [Outer header](#outer-header-44-bytes)
> - [Compatibility](#compatibility)
> - [Key derivation](#key-derivation)
>   - [scrypt](#scrypt-kdf--0x01)
>   - [keyfile](#keyfile-kdf--0x02)
> - [Pool output](#pool-output-starts-at-offset-44)
>   - [Preamble](#preamble-20-bytes)
>   - [Counter nonce](#counter-nonce-12-bytes)
> - [Cipher 0x01: Serpent-256-CBC + HMAC-SHA256](#cipher-0x01-serpent-256-cbc--hmac-sha256)
> - [Cipher 0x02: XChaCha20-Poly1305](#cipher-0x02-xchacha20-poly1305)
> - [Armor format](#armor-format)
> - [Keyfiles](#keyfiles)
> - [Exit codes](#exit-codes)

---

## Outer header (44 bytes)

```
Offset  Size  Field    Description
------  ----  -----    -----------
0       8     magic    "LVTHNCLI" (0x4c 0x56 0x54 0x48 0x4e 0x43 0x4c 0x49)
8       1     version  0x02
9       1     cipher   0x01 = Serpent-256-CBC + HMAC-SHA256
                       0x02 = XChaCha20-Poly1305
10      1     kdf      0x01 = scrypt
                       0x02 = keyfile
11      1     flags    0x00 (reserved, must be zero)
12      32    salt     random 32 bytes; all-zero for keyfile mode
44+          payload  pool output (see below)
```

On encrypt, `--cipher serpent` (default) writes `0x01`; `--cipher chacha` writes `0x02`. On decrypt, the cipher byte is read and the correct pool is selected automatically. The `--cipher` flag is not needed and is ignored on decrypt.

---

## Compatibility

Version 2 files are not compatible with version 1. `lvthn` v2 rejects any file whose version byte is not `0x02` with exit code 5:

```
unsupported format version 0x01 — this file was encrypted with an older version of lvthn
```

---

## Key derivation

### scrypt (kdf = 0x01)

Parameters: N=32768, r=8, p=1, dkLen=32

- Input: UTF-8 passphrase and the 32-byte random salt from the header
- Output: 32-byte master key

### keyfile (kdf = 0x02)

- Raw 32 bytes read directly from the keyfile
- Salt field in the header is zeroed
- Keyfiles work with any cipher; cipher selection happens at encrypt time

---

## Pool output (starts at offset 44)

The pool output is the raw output of `SealStreamPool.seal()` from leviathan-crypto v2. It consists of a 20-byte preamble followed by a sequence of ciphertext chunks.

### Preamble (20 bytes)

```
Offset  Size  Field     Description
------  ----  -----     -----------
0       1     format    bit 7 = framed flag (always 0); bits 0-5 = cipher format ID
                        0x01 = XChaCha20-Poly1305
                        0x02 = Serpent-256-CBC + HMAC-SHA256
1       16    nonce     random 16-byte HKDF salt
17      3     chunkSz   u24 big-endian plaintext chunk size; always 65536 (0x010000)
20+           chunks    cipher-specific chunk stream
```

> [!NOTE]
> The cipher format IDs in the pool preamble (0x01=XChaCha20, 0x02=Serpent) are defined by the leviathan-crypto cipher suite and are the reverse of the outer LVTHNCLI header's cipher byte values (0x01=Serpent, 0x02=XChaCha20). The outer header byte controls pool selection; the preamble format byte is validated internally by the library.

`lvthn` always writes with `framed: false`, so bit 7 of the format byte is `0` and chunks carry no length prefixes.

In version 1, the pool header was 28 bytes (streamNonce, chunkSize u32be, chunkCount u64be). Version 2 uses a 20-byte preamble. There is no chunkCount; the final chunk is identified by the `TAG_FINAL` flag in its counter nonce.

### Counter nonce (12 bytes)

Each chunk is encrypted with a unique 12-byte counter nonce:

```
Offset  Size  Field    Description
------  ----  -----    -----------
0       11    counter  11-byte big-endian monotonic counter; starts at 0
11      1     tag      0x00 = TAG_DATA; 0x01 = TAG_FINAL
```

The counter increments with each chunk. The final chunk uses `TAG_FINAL`. A data chunk at counter N and a final chunk at counter N produce distinct nonces, so the scheme never reuses a nonce. Reordered or duplicated chunks fail authentication because the counter does not match.

---

## Cipher 0x01: Serpent-256-CBC + HMAC-SHA256

Each chunk: `ciphertext(padded_N) || HMAC-SHA256-tag(32)`

**Key derivation (HKDF-SHA-256, once per stream):**
```
PRK              = HMAC-SHA256(salt=nonce, ikm=masterKey)
info             = "serpent-sealstream-v2"
[enc_key  0:32,
 mac_key 32:64,
 iv_key  64:96] = HKDF-Expand(PRK, info, 96)
```

**Per-chunk CBC IV:**
```
IV = HMAC-SHA256(iv_key, counterNonce)[0:16]
```

The IV is derived deterministically from the counter nonce on both sides and is never transmitted.

Plaintext is padded with PKCS7 to the next 16-byte boundary before encryption. A full 65536-byte chunk produces 65552 bytes of ciphertext (65536 bytes plus one full 16-byte padding block). Encryption is Serpent-256-CBC(enc_key, IV, padded_plaintext). Authentication is HMAC-SHA256(mac_key, ciphertext), computed encrypt-then-MAC. Tag mismatch causes immediate failure with no plaintext produced.

---

## Cipher 0x02: XChaCha20-Poly1305

Each chunk: `ciphertext(N) || Poly1305-tag(16)`

**Key derivation (HKDF-SHA-256, once per stream):**
```
PRK       = HMAC-SHA256(salt=nonce, ikm=masterKey)
info      = "xchacha20-sealstream-v2"
streamKey = HKDF-Expand(PRK, info, 32)
subkey    = HChaCha20(streamKey, nonce[0:16])
```

`streamKey` is wiped immediately after the HChaCha20 step. `subkey` is used for all chunk encryption.

Each chunk is encrypted with XChaCha20-Poly1305(subkey, counterNonce). XChaCha20-Poly1305 provides confidentiality and authentication in a single pass. A reordered chunk fails authentication because its counter nonce does not match. Tag mismatch causes immediate failure with no plaintext produced.

---

## Armor format

Both `encrypt` and `decrypt` support PEM-style ASCII armor.

### Encrypted message

```
-----BEGIN LVTHNCLI ENCRYPTED MESSAGE-----
<base64, 64-character lines>
-----END LVTHNCLI ENCRYPTED MESSAGE-----
```

### Keyfile

```
-----BEGIN LVTHNCLI KEY-----
<base64, single line>
-----END LVTHNCLI KEY-----
```

`decrypt` auto-detects armored vs binary input; no flag is needed.

---

## Keyfiles

A keyfile contains exactly 32 raw bytes of key material. The same keyfile can be used with any cipher; cipher selection happens at encrypt time only.

---

## Exit codes

| Code | Meaning                                      |
|------|----------------------------------------------|
| 0    | Success                                      |
| 1    | Authentication failure (possible tampering)  |
| 2    | Bad arguments or invalid key                 |
| 3    | Input file not found                         |
| 4    | Output file already exists (use --force)     |
| 5    | Format error / unsupported version or cipher |
