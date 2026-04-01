# LVTHNCLI Encrypted File Format — XChaCha20-Poly1305

Version: 1 (0x01), Cipher: 0x02

This document specifies the binary format produced and consumed by
`lvthn-chacha`. The outer header is identical to `lvthn-cli` — both tools
share the same `LVTHNCLI` container. The cipher byte distinguishes them.

---

## Outer header (44 bytes)

```
Offset  Size  Field    Description
------  ----  -----    -----------
0       8     magic    "LVTHNCLI" (0x4c 0x56 0x54 0x48 0x4e 0x43 0x4c 0x49)
8       1     version  0x01
9       1     cipher   0x02 = XChaCha20-Poly1305
                       (0x01 = Serpent-256-CTR+HMAC-SHA256, used by lvthn-cli)
10      1     kdf      0x01 = scrypt
                       0x02 = keyfile
11      1     flags    0x00 (reserved, must be zero)
12      32    salt     random 32 bytes; all-zero for keyfile mode
44+          payload  pool output (see below)
```

`lvthn-chacha` rejects files with cipher ≠ 0x02 with exit code 5.

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

```
Offset  Size       Field
------  ---------  -----
0       16         streamNonce  random per-message nonce
16      4          chunkSize    u32be; always 65536 (0x00010000)
20      8          chunkCount   u64be; number of chunks
28+                chunks       variable-length chunk array
```

Each chunk is `ciphertext || Poly1305-tag`:

```
ciphertext  up to 65536 bytes  XChaCha20-encrypted plaintext
tag         16 bytes           Poly1305 authentication tag
```

The final chunk may be shorter than 65536 bytes.

---

## Per-chunk nonce

Each chunk gets a unique 24-byte XChaCha20 nonce constructed from the
stream nonce and the chunk index:

```
xcnonce(24) = streamNonce(16) || u64be(chunkIndex)(8)
```

No HKDF is required — XChaCha20-Poly1305 is an AEAD; nonce uniqueness
is sufficient to guarantee both confidentiality and authentication per chunk.

Compare with `lvthn-cli`, which uses HKDF-SHA256 to derive separate
encryption and MAC keys for each chunk (Serpent-CTR is not an AEAD).

---

## Encryption and authentication (XChaCha20-Poly1305)

XChaCha20-Poly1305 is a single-pass AEAD construction:

1. **HChaCha20** derives a 32-byte subkey from `masterKey` and the first
   16 bytes of `xcnonce`
2. **ChaCha20** encrypts the plaintext using the subkey and the remaining
   8 bytes of `xcnonce` (inner nonce), counter starting at 1
3. **Poly1305** generates the authentication tag over the ciphertext,
   using the keystream block at counter 0

Authentication is verified before decryption. A tag mismatch causes
immediate failure with no plaintext produced (exit code 1).

No AAD is used. The chunk nonce construction binds each chunk to its
position in the stream — a reordered chunk will fail authentication.

---

## Armor format

Binary blobs may be wrapped in PEM-style ASCII armor for text-safe transport.
Both `lvthn-cli` and `lvthn-chacha` use identical armor headers.

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

Keyfiles are interchangeable between `lvthn-cli` and `lvthn-chacha` —
both use 32-byte keys. A file encrypted with one tool cannot be decrypted
by the other (cipher byte mismatch), but the same keyfile can be used.

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
