# LVTHNCLI Encrypted File Format — Unified

Version: 1 (0x01)

This document specifies the binary format produced and consumed by `lvthn`.
The format is identical to `lvthn-cli` and `lvthn-chacha` — all three tools
share the same `LVTHNCLI` container and can decrypt each other's output.

The cipher byte at offset 9 determines which cryptographic scheme was used.
`lvthn decrypt` selects the correct pool automatically from the file header.

---

## Outer header (44 bytes)

```
Offset  Size  Field    Description
------  ----  -----    -----------
0       8     magic    "LVTHNCLI" (0x4c 0x56 0x54 0x48 0x4e 0x43 0x4c 0x49)
8       1     version  0x01
9       1     cipher   0x01 = Serpent-256-CTR + HMAC-SHA256
                       0x02 = XChaCha20-Poly1305
10      1     kdf      0x01 = scrypt
                       0x02 = keyfile
11      1     flags    0x00 (reserved, must be zero)
12      32    salt     random 32 bytes; all-zero for keyfile mode
44+          payload  pool output (see below)
```

On encrypt, `--cipher serpent` (default) writes `0x01`; `--cipher chacha`
writes `0x02`. On decrypt, the cipher byte is read and the correct pool is
selected automatically — `--cipher` is not needed and is ignored.

---

## Key derivation

### scrypt (kdf = 0x01)

Parameters: N=32768, r=8, p=1, dkLen=32

- Input: UTF-8 passphrase + 32-byte random salt from header
- Output: 32-byte master key

### keyfile (kdf = 0x02)

- Raw 32 bytes read directly from the keyfile
- Salt field in header is zeroed
- Keyfiles are interchangeable between all three tools

---

## Pool output (starts at offset 44)

Both ciphers use the same pool output header:

```
Offset  Size       Field
------  ---------  -----
0       16         streamNonce  random per-message nonce
16      4          chunkSize    u32be; always 65536 (0x00010000)
20      8          chunkCount   u64be; number of chunks
28+                chunks       variable-length chunk array
```

---

## Cipher 0x01: Serpent-256-CTR + HMAC-SHA256

Each chunk: `ciphertext(N) || HMAC-SHA256-tag(32)`

**Per-chunk key derivation (HKDF-SHA256):**
```
PRK    = HMAC-SHA256(salt=streamNonce, ikm=masterKey)
info   = domain(16) || 0x00 || streamNonce(16) || chunkSize_u32be(4) ||
         chunkCount_u64be(8) || index_u64be(8) || isLast(1)
encKey = HKDF-Expand T(1)
macKey = HKDF-Expand T(2)
```

Domain is `"SerpentStream-v1"` (16 bytes). The zero byte at position 16
is an intentional gap — part of the info buffer layout.

Encryption is Serpent-256-CTR (counter reset per chunk, zero nonce).
Authentication is HMAC-SHA256(macKey, ciphertext) — encrypt-then-MAC.
Tag mismatch causes immediate failure with no plaintext produced.

---

## Cipher 0x02: XChaCha20-Poly1305

Each chunk: `ciphertext(N) || Poly1305-tag(16)`

**Per-chunk nonce:**
```
xcnonce(24) = streamNonce(16) || u64be(chunkIndex)(8)
```

No HKDF — nonce uniqueness is sufficient for XChaCha20-Poly1305 (AEAD).
The master key is used directly for every chunk.

XChaCha20-Poly1305 provides both confidentiality and authentication in a
single pass. A reordered chunk will fail authentication (nonce is bound to
chunk index). Tag mismatch causes immediate failure.

---

## Armor format

Both encrypt and decrypt support PEM-style ASCII armor.

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

Decrypt auto-detects armored vs binary input — no flag needed.

---

## Keyfiles

A keyfile contains exactly 32 raw bytes of key material. The same keyfile
can be used with any cipher — cipher selection is at encrypt time only.

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
