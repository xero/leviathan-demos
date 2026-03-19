# lvthncli-serpent

A command-line file encryption tool using Serpent-256-CTR with HMAC-SHA256
authentication. Part of the [leviathan-crypto](https://github.com/xero/leviathan-crypto)
demo suite.

This is a **teaching artifact**. Its purpose is to show a complete, working
implementation of a parallelised CLI crypto tool built on leviathan-crypto. If
you want to diff two cipher implementations side by side, compare this with
[`lvthncli-chacha`](../lvthncli-chacha) — the two tools are structurally
identical except for the crypto layer. Everything that changes when you swap
ciphers is in `src/pool.ts` and `src/worker.ts`. Everything else is the same.

If you just want a tool to use, [`lvthncli`](../lvthncli) combines both ciphers
with a `--cipher` flag and is the published binary.

---

## Build

Requires [Bun](https://bun.sh).

```sh
bun install
bun run build
# → dist/lvthncli-serpent
```

---

## Usage

```sh
# Encrypt with a passphrase
lvthncli-serpent encrypt -p "correct horse battery" secret.txt

# Encrypt with a keyfile
lvthncli-serpent encrypt -k my.key secret.txt secret.enc

# Encrypt from stdin, armored output
cat secret.txt | lvthncli-serpent encrypt -k my.key --armor > secret.enc

# Decrypt (auto-detects binary or armored input)
lvthncli-serpent decrypt -p "correct horse battery" secret.enc
lvthncli-serpent decrypt -k my.key secret.enc decrypted.txt

# Generate a 256-bit keyfile
lvthncli-serpent keygen
lvthncli-serpent keygen --armor -o my.key
```

---

## Security

**Cipher:** Serpent-256-CTR — a conservative block cipher with 32 rounds and
a large security margin. It is slower than ChaCha20 (roughly 4× on modern
hardware) but has received extensive cryptanalysis as an AES finalist.

**Authentication:** HMAC-SHA256 per chunk using HKDF-derived keys. Each 64KB
chunk has a unique encryption key and MAC key derived from the master key,
stream nonce, chunk index, and a last-chunk flag — preventing reordering and
truncation attacks without an outer HMAC over the entire file.

**Key derivation:** scrypt (N=32768, r=8, p=1) for passphrases. Produces a
32-byte master key with a fresh random salt per encryption.

**Parallelism:** chunks are distributed across a worker pool (one worker per
CPU core). WASM instances are isolated — no shared memory between workers.

**Format:** LVTHNCLI v1, cipher byte `0x01`. Files produced by this tool can
be decrypted by `lvthncli` without flags — the cipher is detected from the
file header automatically.
