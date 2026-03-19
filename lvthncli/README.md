# lvthncli · `lvthn`

A command-line file encryption tool supporting Serpent-256-CTR+HMAC-SHA256
and XChaCha20-Poly1305. Built on [leviathan-crypto](https://github.com/xero/leviathan-crypto).

## Install

```sh
# npm
npm install -g lvthncli

# bun
bun install -g lvthncli
```

This installs the `lvthn` command globally.

---

## Build from source

Requires [Bun](https://bun.sh).

```sh
bun install
bun run build
# → dist/lvthn
```

---

## Usage

```sh
# Encrypt with a passphrase (Serpent by default)
lvthn encrypt -p "correct horse battery" secret.txt

# Encrypt with XChaCha20-Poly1305
lvthn encrypt --cipher chacha -p "correct horse battery" secret.txt

# Encrypt with a keyfile
lvthn encrypt -k my.key secret.txt secret.enc

# Encrypt from stdin, armored output
cat secret.txt | lvthn encrypt -k my.key --armor > secret.enc

# Decrypt — cipher is detected automatically from the file
lvthn decrypt -p "correct horse battery" secret.enc
lvthn decrypt -k my.key secret.enc decrypted.txt

# Generate a 256-bit keyfile
lvthn keygen
lvthn keygen --armor -o my.key
```

On decrypt, the `--cipher` flag is not needed — the cipher byte in the file
header tells `lvthn` which algorithm was used.

---

## Ciphers

| Flag | Cipher | Authentication | Throughput |
|------|--------|----------------|------------|
| `--cipher serpent` (default) | Serpent-256-CTR | HMAC-SHA256 per chunk | ~135 MB/s |
| `--cipher chacha` | XChaCha20 | Poly1305 per chunk | ~565 MB/s |

Serpent has a larger security margin (32 rounds vs 20) at the cost of speed.
ChaCha20-Poly1305 is the choice of TLS 1.3 and WireGuard. Both are good. Pick
based on your threat model and throughput requirements.

Both ciphers use the same outer format, the same scrypt key derivation, and
the same keyfiles — a key generated with `lvthn keygen` works with either.

---

## Security

**Key derivation:** scrypt (N=32768, r=8, p=1) for passphrases → 32-byte
master key with a fresh random 32-byte salt per encryption.

**Parallelism:** encryption and decryption distribute 64KB chunks across a
worker pool sized to `hardwareConcurrency`. Each worker owns an isolated WASM
instance — no shared memory between workers.

**Format:** LVTHNCLI v1 binary format. Files are interoperable with
`lvthncli-serpent` and `lvthncli-chacha`. The cipher byte at offset 9 of the
header drives decryption — no flags required on the receiving end.

**Integrity:** any modification to a ciphertext chunk causes that chunk's
authentication to fail. The entire decryption is rejected — no partial plaintext
is produced.
