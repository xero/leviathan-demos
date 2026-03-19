# SRPT256S Encrypted File Format

Version: 3 (0x03)

This document is the authoritative specification for the binary format produced and
consumed by `lvthn` v3. All implementations must follow this spec exactly. When armored
output (`--armor`) is requested, the binary blob described here is base64-encoded and
wrapped in ASCII headers (see §3 Armored Output).

---

## 1. Binary Format

All encrypted output (binary or armored) shares the same internal structure:

```
Offset  Size   Field        Description
------  ----   -----        -----------
0       8      magic        ASCII "SRPT256S" (0x53 0x52 0x50 0x54 0x32 0x35 0x36 0x53)
8       1      version      Format version: 0x03
9       1      flags        Reserved, must be 0x00
10      1      kdf          Key derivation method:
                              0x01 = passphrase/scrypt
                              0x02 = keyfile (raw 32 bytes)
11      1      reserved     Must be 0x00
12      32     salt         KDF salt (random); zeroed when kdf=0x02
44      N      pool_output  SerpentStream wire format (see §1.1)
```

Total outer header size: **44 bytes**

### §1.1 Pool Output (SerpentStream wire format)

The pool output begins at byte 44 and contains a self-describing stream:

```
Offset  Size   Field        Description
------  ----   -----        -----------
0       16     nonce        Stream nonce (random per encryption)
16      4      chunk_size   Chunk size (u32be, always 65536)
20      8      chunk_count  Number of chunks (u64be)
28      ...    chunks       One record per chunk (see §1.2)
```

### §1.2 Chunk Records

Each chunk record is:

```
ciphertext (up to 65536 bytes) || HMAC-SHA256 tag (32 bytes)
```

All chunks except the last are exactly `chunk_size + 32` bytes. The last chunk
contains the remaining plaintext bytes (possibly fewer than `chunk_size`) followed
by its 32-byte tag. There is no padding.

---

## 2. Authentication

Authentication is per-chunk using HMAC-SHA256. Each chunk's tag covers only that
chunk's ciphertext — there is no outer HMAC over the entire file.

Per-chunk key derivation (HKDF-SHA256, domain `SerpentStream-v1`):

```
info = domain_bytes(17) || stream_nonce(16) || chunk_size_u32be(4) ||
       chunk_count_u64be(8) || chunk_index_u64be(8) || is_last_byte(1)
       = 54 bytes total

derived(64) = HKDF-SHA256(masterKey, stream_nonce, info, 64)
enc_key = derived[0..31]   (32 bytes)
mac_key = derived[32..63]  (32 bytes)
```

Note: `domain_bytes` is the 16-byte UTF-8 encoding of `SerpentStream-v1` stored in
a 17-byte field (byte 16 is zero — reserved for future versioning).

Per-chunk encrypt-then-MAC:

```
ciphertext = Serpent-256-CTR(enc_key, zero_nonce, counter=1, plaintext_chunk)
tag        = HMAC-SHA256(mac_key, ciphertext)
wire       = ciphertext || tag
```

On decryption, the HMAC is verified before decryption. If verification fails,
an error is thrown immediately and no plaintext is produced. Binding chunk index
and count into the key derivation prevents reordering and truncation attacks.

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
included. The encoder processes input in 8 KiB chunks to avoid call-stack overflow on
large files.

### Auto-detection on Decrypt

The `decrypt` command automatically detects whether its input is armored or binary:

- If the input begins with the ASCII string `-----BEGIN SRPT256S` → armored input;
  strip the header and footer lines and base64-decode the content before parsing.
- Otherwise → binary input; parse directly.

No `--armor` flag is required or recognized on the `decrypt` command.

---

## 4. Keyfile Format

Keyfiles contain exactly 32 raw random bytes (256-bit key). Armored keyfiles are
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

### Passphrase mode — scrypt (kdf = 0x01)

```
key = scrypt(
  password = UTF-8 encoded passphrase,
  salt     = header[12..43]  (32 random bytes),
  N        = 32768,           // 2^15 — CPU/memory cost
  r        = 8,               // block size
  p        = 1,               // parallelism
  dkLen    = 32               // 32-byte master key
  maxmem   = 67108864         // 64 MiB
)
```

A fresh 32-byte random salt is generated for every encryption and stored in the header.

### Keyfile mode (kdf = 0x02)

```
key = keyfile_bytes[0..31]   // exactly 32 bytes
```

The keyfile must contain exactly 32 bytes. The `salt` field in the header is set to all
zeros.

---

## 6. Encryption Algorithm

- **Cipher:** Serpent-256-CTR (zero nonce, counter starts at 1 per chunk, WASM-accelerated)
- **Authentication:** HMAC-SHA256 per chunk (Encrypt-then-MAC)
- **Key derivation:** HKDF-SHA256, domain `SerpentStream-v1`, per chunk
- **Master key:** 32 bytes (passphrase → scrypt dkLen=32; keyfile → 32 raw bytes)

Encryption and authentication are parallelised across CPU cores using a worker pool.
Each worker holds its own isolated WASM instances (no shared memory between workers).
The main thread holds the HKDF instance and derives per-chunk keys before dispatching.

---

## 7. Format Versioning

The `version` field (byte 8) allows the format to evolve. Implementations must:
- Accept files with `version = 0x03` and `flags = 0x00`.
- Reject files with unknown version or non-zero flags with exit code 5.

v3 files are not compatible with v2 — the header layout and cryptographic construction
are different. The version byte check ensures v2 files are rejected cleanly.

---

## 8. Exit Codes

| Code | Meaning                                        |
|------|------------------------------------------------|
| 0    | Success                                        |
| 1    | Authentication failure (tampered/corrupt data) |
| 2    | Usage error or key derivation failure          |
| 3    | Input file not found                           |
| 4    | Output file already exists (use --force)       |
| 5    | Invalid file format                            |

---

## 9. Example Header (hex dump)

Passphrase-mode file:

```
Offset  Hex                                              ASCII
000000  53 52 50 54 32 35 36 53                          SRPT256S  (magic)
000008  03                                               .         (version 3)
000009  00                                               .         (flags = 0)
00000A  01                                               .         (kdf = scrypt)
00000B  00                                               .         (reserved)
00000C  [32 bytes of random salt]
00002C  [pool output: 16-byte nonce | 4-byte chunk_size | 8-byte chunk_count | chunks...]
```

Keyfile-mode file:

```
Offset  Hex                                              ASCII
000000  53 52 50 54 32 35 36 53                          SRPT256S  (magic)
000008  03                                               .         (version 3)
000009  00                                               .         (flags = 0)
00000A  02                                               .         (kdf = keyfile)
00000B  00                                               .         (reserved)
00000C  [32 zero bytes — salt unused]
00002C  [pool output: 16-byte nonce | 4-byte chunk_size | 8-byte chunk_count | chunks...]
```
