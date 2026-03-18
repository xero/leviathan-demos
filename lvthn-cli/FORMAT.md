# SRPT256S Encrypted File Format

Version: 2 (0x02)

This document is the authoritative specification for the binary format produced and
consumed by `lvthn` v2. All implementations must follow this spec exactly. When armored
output (`--armor`) is requested, the binary blob described here is base64-encoded and
wrapped in ASCII headers (see §3 Armored Output).

---

## 1. Binary Format

All encrypted output (binary or armored) shares the same internal structure:

```
Offset  Size   Field               Description
------  ----   -----               -----------
0       8      magic               ASCII "SRPT256S" (0x53 0x52 0x50 0x54 0x32 0x35 0x36 0x53)
8       1      version             Format version: 0x02
9       1      flags               Reserved, must be 0x00
10      1      kdf                 Key derivation method:
                                     0x01 = passphrase/scrypt (current)
                                     0x02 = keyfile (raw 64 bytes)
11      1      reserved            Must be 0x00
12      32     salt                KDF salt (random); zeroed when kdf=0x02
44      20     stream_header       SerpentStreamSealer header:
                                     bytes 0–15: stream nonce (16 bytes)
                                     bytes 16–19: chunk size (u32 big-endian)
64      N      ciphertext          SerpentStreamSealer chunked output
```

Total header size: **64 bytes**

### Field Descriptions

#### `magic` (bytes 0–7)
The eight ASCII bytes `S`, `R`, `P`, `T`, `2`, `5`, `6`, `S` (0x53 0x52 0x50 0x54 0x32
0x35 0x36 0x53). Used to identify the format. Any file not beginning with these bytes
must be rejected with exit code 5 (invalid file format).

#### `version` (byte 8)
Format version number. Currently 0x02. Implementations must reject files with unknown
version numbers with exit code 5.

#### `flags` (byte 9)
Reserved for future use. Must be written as 0x00. Implementations should treat any
non-zero flags value as an unsupported format version and reject with exit code 5.

#### `kdf` (byte 10)
Identifies the key derivation method:
- `0x01` — Passphrase mode (scrypt). The key is derived using scrypt with N=32768,
  r=8, p=1, dkLen=64. New encryptions always use this value.
- `0x02` — Keyfile mode. The key is the raw 64 bytes of the keyfile. The `salt` field
  is zeroed.

Unrecognized KDF values must be rejected with exit code 5.

#### `reserved` (byte 11)
Must be 0x00. Reserved for future use.

#### `salt` (bytes 12–43)
32 random bytes used as the scrypt salt when `kdf=0x01`. Must be filled with zeros
when `kdf=0x02`. A fresh random salt must be generated for every encryption operation
in passphrase mode.

#### `stream_header` (bytes 44–63)
The 20-byte header produced by `SerpentStreamSealer.header()`:
- **Bytes 0–15** (offset 44–59): 16-byte stream nonce. Freshly generated at random
  for every encryption operation.
- **Bytes 16–19** (offset 60–63): Chunk size as a big-endian unsigned 32-bit integer.
  Currently always 65536 (0x00010000).

#### `ciphertext` (bytes 64–end)
The chunked output of `SerpentStreamSealer`. Each chunk contains:
- 16-byte CBC IV (per-chunk, randomly generated)
- Serpent-256-CBC ciphertext with PKCS7 padding
- 32-byte HMAC-SHA256 tag (per-chunk authentication)

Authentication is per-chunk — there is no outer HMAC field.

---

## 2. Authentication

Unlike format v1, there is **no outer HMAC** covering the entire file. Authentication
is handled per-chunk by `SerpentStreamSealer` / `SerpentStreamOpener`:

1. Each chunk derives unique encryption and MAC keys via HKDF-SHA256 from the master
   key, stream nonce, chunk index, and a last-chunk flag.
2. Each chunk's HMAC-SHA256 covers the chunk's IV and ciphertext.
3. On decryption, `SerpentStreamOpener.open()` verifies the HMAC before decrypting.
   If any chunk fails authentication, an error is thrown and no plaintext is produced.

This satisfies the [Cryptographic Doom Principle](https://moxie.org/2011/12/13/the-cryptographic-doom-principle.html):
decryption is unreachable if authentication fails. The per-chunk model also enables
future streaming decryption — each chunk can be authenticated and decrypted
independently.

---

## 3. Armored Output

When the `--armor` flag is passed to `encrypt`, the binary blob described above is
base64-encoded and wrapped in ASCII PEM-like headers:

```
-----BEGIN SRPT256S ENCRYPTED MESSAGE-----
<base64 content, 64 characters per line>
-----END SRPT256S ENCRYPTED MESSAGE-----
```

The base64 encoding uses the standard alphabet (RFC 4648 §4). Line length is exactly 64
characters, except for the last line which may be shorter. Padding characters (`=`) are
included.

### Auto-detection on Decrypt

The `decrypt` command automatically detects whether its input is armored or binary:

- If the input begins with the ASCII string `-----BEGIN SRPT256S` → armored input;
  strip the header and footer lines and base64-decode the content before parsing.
- Otherwise → binary input; parse directly.

No `--armor` flag is required or recognized on the `decrypt` command.

---

## 4. Keyfile Format

Keyfiles contain exactly 64 raw random bytes (512-bit key). Armored keyfiles are
base64-encoded and wrapped:

```
-----BEGIN SRPT256S KEY-----
<base64>
-----END SRPT256S KEY-----
```

Keyfiles do not use the SRPT256S encrypted format — they are not encrypted. Store
keyfiles securely (e.g. mode 0600, encrypted filesystem, hardware key storage).

---

## 5. Key Derivation

### Passphrase mode — scrypt (kdf = 0x01) — current

```
key = scrypt(
  password = UTF-8 encoded passphrase,
  salt     = header[12..43]  (32 random bytes),
  N        = 32768,          // 2^15 — CPU/memory cost
  r        = 8,              // block size
  p        = 1,              // parallelism
  dkLen    = 64              // always 64 bytes
  maxmem   = 67108864        // 64 MiB
)
```

New encryptions always use `kdf = 0x01`. A fresh 32-byte random salt is generated for
every encryption and stored in the header.

### Keyfile mode (kdf = 0x02)

```
key = keyfile_bytes[0..63]   // exactly 64 bytes
```

The keyfile must contain exactly 64 bytes. The `salt` field in the header is set to all
zeros.

---

## 6. Encryption Algorithm

`SerpentStreamSealer` from leviathan-crypto provides:
- **Serpent-256-CBC** with PKCS7 padding (per-chunk, WASM-accelerated)
- **HMAC-SHA256** per-chunk authentication
- **HKDF-SHA256** per-chunk key derivation from the 64-byte master key

The 64-byte master key and stream nonce are combined via HKDF to derive unique
32-byte encryption and 32-byte MAC keys for each chunk. Chunk indices and a
last-chunk flag are bound into the key derivation, preventing reordering and
truncation attacks.

---

## 7. Format Versioning

The `version` field (byte 8) allows the format to evolve. Implementations must:
- Accept files with `version = 0x02` and `flags = 0x00`.
- Reject files with unknown version or non-zero flags with exit code 5.

v2 files are not compatible with v1 — the magic bytes, header layout, and
cryptographic construction are all different.

---

## 8. Example Header (hex dump)

Passphrase-mode file:

```
Offset  Hex                                              ASCII
000000  53 52 50 54 32 35 36 53                          SRPT256S  (magic)
000008  02                                               .         (version 2)
000009  00                                               .         (flags = 0)
00000A  01                                               .         (kdf = scrypt)
00000B  00                                               .         (reserved)
00000C  [32 bytes of random salt]
00002C  [16 bytes of stream nonce]  [4 bytes chunk size]
000040  [N bytes of chunked ciphertext]
```

Keyfile-mode file:

```
Offset  Hex                                              ASCII
000000  53 52 50 54 32 35 36 53                          SRPT256S  (magic)
000008  02                                               .         (version 2)
000009  00                                               .         (flags = 0)
00000A  02                                               .         (kdf = keyfile)
00000B  00                                               .         (reserved)
00000C  [32 zero bytes — salt unused]
00002C  [16 bytes of stream nonce]  [4 bytes chunk size]
000040  [N bytes of chunked ciphertext]
```
