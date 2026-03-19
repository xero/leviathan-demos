# lvthncli-chacha

A command-line file encryption tool using XChaCha20-Poly1305 AEAD.
Part of the [leviathan-crypto](https://github.com/xero/leviathan-crypto)
demo suite.

This is a **teaching artifact**. Its purpose is to show a complete, working
implementation of a parallelised CLI crypto tool built on leviathan-crypto. If
you want to diff two cipher implementations side by side, compare this with
[`lvthncli-serpent`](../lvthncli-serpent) — the two tools are structurally
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
# → dist/lvthncli-chacha
```

---

## Usage

```sh
# Encrypt with a passphrase
lvthncli-chacha encrypt -p "correct horse battery" secret.txt

# Encrypt with a keyfile
lvthncli-chacha encrypt -k my.key secret.txt secret.enc

# Encrypt from stdin, armored output
cat secret.txt | lvthncli-chacha encrypt -k my.key --armor > secret.enc

# Decrypt (auto-detects binary or armored input)
lvthncli-chacha decrypt -p "correct horse battery" secret.enc
lvthncli-chacha decrypt -k my.key secret.enc decrypted.txt

# Generate a 256-bit keyfile
lvthncli-chacha keygen
lvthncli-chacha keygen --armor -o my.key
```

---

## Security

**Cipher:** XChaCha20-Poly1305 — an authenticated stream cipher with a
192-bit nonce. It is faster than Serpent (roughly 4× on modern hardware)
and is widely deployed in TLS 1.3, WireGuard, and libsodium.

**Authentication:** Poly1305 is built into the AEAD primitive — there is no
separate HMAC step. Each 64KB chunk uses a unique 24-byte nonce derived as
`streamNonce(16) || u64be(chunkIndex)(8)`, ensuring no two chunks ever share
a nonce under the same key.

**Key derivation:** scrypt (N=32768, r=8, p=1) for passphrases. Produces a
32-byte master key with a fresh random salt per encryption.

**Parallelism:** chunks are distributed across a worker pool (one worker per
CPU core). Each worker owns its own WASM instance with isolated linear memory.
Because XChaCha20-Poly1305 is already AEAD, workers need only one WASM module
(`chacha.wasm`) compared to Serpent's two (`serpent.wasm` + `sha2.wasm`).

**Format:** LVTHNCLI v1, cipher byte `0x02`. Files produced by this tool can
be decrypted by `lvthncli` without flags — the cipher is detected from the
file header automatically.
