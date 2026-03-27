# LVTHNCLI Encrypted File Format

Version: 1 (0x01)

This document is the authoritative specification for the binary format produced
and consumed by `lvthn-cli`. Future tools (`lvthn-chacha`, `lvthn`) share the
same outer header and pool output layout.

---

## Outer header (44 bytes)

```
Offset  Size  Field    Description
------  ----  -----    -----------
0       8     magic    "LVTHNCLI" (0x4c 0x56 0x54 0x48 0x4e 0x43 0x4c 0x49)
8       1     version  0x01
9       1     cipher   0x01 = Serpent-256-CTR + HMAC-SHA256
                       0x02 = XChaCha20-Poly1305 (reserved, future use)
10      1     kdf      0x01 = scrypt
                       0x02 = keyfile
11      1     flags    0x00 (reserved, must be zero)
12      32    salt     random 32 bytes; all-zero for keyfile mode
44+          payload  pool output (see below)
```

---

## Key derivation

### scrypt (kdf = 0x01)

Parameters: N=32768, r=8, p=1, dkLen=32

- Input: UTF-8 passphrase + 32-byte random salt from header
- Output: 32-byte master key

### keyfile (kdf = 0x02)

- Raw 32 bytes read directly from the keyfile
- Salt field in header is zeroed

---

## Pool output (starts at offset 44)

The pool output is the wire format produced by `SealPool.seal()` and consumed
by `SealPool.open()`. Its layout:

```
Offset  Size       Field
------  ---------  -----
0       16         streamNonce  random per-message nonce
16      4          chunkSize    u32be; always 65536 (0x00010000)
20      8          chunkCount   u64be; number of chunks
28+                chunks       variable-length chunk array
```

Each chunk is a concatenated `ciphertext || tag`:

```
ciphertext  up to 65536 bytes  Serpent-256-CTR encrypted plaintext chunk
tag         32 bytes           HMAC-SHA256 over the ciphertext bytes
```

The final chunk may be shorter than 65536 bytes (last chunk of the plaintext).

---

## Per-chunk key derivation (HKDF-SHA256)

Each chunk uses unique encryption and MAC keys derived via HKDF-SHA256
(RFC 5869):

```
PRK        = HMAC-SHA256(salt=streamNonce, ikm=masterKey)
info       = buildInfo(streamNonce, chunkCount, index, isLast)  // 54 bytes
encKey     = HKDF-Expand T(1) = HMAC-SHA256(PRK, info || 0x01)
macKey     = HKDF-Expand T(2) = HMAC-SHA256(PRK, T(1) || info || 0x02)
```

### Info buffer layout (54 bytes)

```
Offset  Size  Field
------  ----  -----
0       16    domain   "SerpentStream-v1" (ASCII, no null terminator)
16      1     gap      0x00 (intentional zero byte)
17      16    streamNonce
33      4     chunkSize  u32be (65536)
37      8     chunkCount u64be
45      8     index      u64be (0-based chunk index)
53      1     isLast     0x01 if final chunk, 0x00 otherwise
```

---

## Encryption (Serpent-256-CTR)

- Key: 32-byte `encKey`
- Nonce: 16 zero bytes (key uniqueness is guaranteed by HKDF per chunk)
- Counter reset to zero for each chunk
- Output: same length as input

## Authentication (HMAC-SHA256)

- Key: 32-byte `macKey`
- Input: ciphertext bytes only (encrypt-then-MAC)
- Output: 32-byte tag appended after ciphertext in the chunk

Authentication is verified before decryption. If the tag does not match,
decryption fails immediately and no plaintext is produced.

---

## Armor format

Binary blobs may be wrapped in PEM-style ASCII armor for text-safe transport.

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

---

## Keyfiles

A keyfile contains exactly 32 raw bytes of key material. When stored as
armor (`--armor`), the 32 bytes are base64-encoded within `LVTHNCLI KEY`
headers. The tool auto-detects armored vs raw keyfiles on read.

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
