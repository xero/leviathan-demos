# `lvthn` leviathan-crypto cli tool

> [!NOTE]
> A command-line file encryption tool supporting Serpent-256-CBC+HMAC-SHA256
> and XChaCha20-Poly1305. Built on [leviathan-crypto](https://github.com/xero/leviathan-crypto).

---

## Install

Installs the `lvthn` command globally.

```sh
bun add -g lvthn
# or
npm install -g lvthn
```

---

## Build from source

Requires [Bun](https://bun.sh).

```sh
bun i
bun bake
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

On decrypt, the `--cipher` flag is not needed. The cipher byte in the file
header tells `lvthn` which algorithm was used.

---

## Ciphers

| Flag | Cipher | Authentication | Throughput |
|------|--------|----------------|------------|
| `--cipher serpent` (default) | Serpent-256-CBC | HMAC-SHA256 per chunk | ~135 MB/s |
| `--cipher chacha` | XChaCha20 | Poly1305 per chunk | ~565 MB/s |

Serpent has a larger security margin (32 rounds vs 20) at the cost of speed.
ChaCha20-Poly1305 is the choice of TLS 1.3 and WireGuard. Both are good. Pick
based on your threat model and throughput requirements.

Throughput figures are approximate, measured pre-SIMD on Apple Silicon.
leviathan-crypto v1.2.0+ includes SIMD-accelerated paths for both ciphers;
actual numbers will be higher on SIMD-capable hardware and vary by platform.

Both ciphers use the same outer format, the same scrypt key derivation, and
the same keyfiles. A key generated with `lvthn keygen` works with either cipher.

---

## Shell completions

`lvthn` ships completion support for bash, zsh, fish, and PowerShell.

```sh
# zsh
echo 'source <(lvthn completion zsh)' >> ~/.zshrc
# or drop into a fpath directory
lvthn completion zsh > $(brew --prefix)/share/zsh/site-functions/_lvthn

# bash
lvthn completion bash > /usr/local/etc/bash_completion.d/lvthn

# fish
lvthn completion fish > ~/.config/fish/completions/lvthn.fish

# PowerShell
lvthn completion pwsh >> $PROFILE
```

Completions cover subcommands, flags, cipher values, and file paths. The
`--passphrase` and `--keyfile` flags are mutually exclusive; once one is used
the other is suppressed from suggestions.

---

## Security

**Key derivation.** Passphrases go through scrypt (N=32768, r=8, p=1) with a
fresh random 32-byte salt per encryption, producing a 32-byte master key.
Keyfiles are read directly as 32 raw bytes.

**Parallelism.** Encryption and decryption distribute 64KB chunks across a
worker pool sized to `hardwareConcurrency`. Each worker owns an isolated WASM
instance with no shared memory between workers.

**Format.** LVTHNCLI v2 binary format. The cipher byte at offset 9 of the
header drives decryption automatically. See [`FORMAT.md`](./FORMAT.md) for the
full wire format specification.

**Integrity.** Any modification to a ciphertext chunk causes that chunk's
authentication to fail. The entire decryption is rejected; no partial plaintext
is produced.
