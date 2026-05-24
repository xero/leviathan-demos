# leviathan cli (`lvthn`)

> [!NOTE]
> Command-line file encryption with paranoid-grade ciphers, powered by
> [leviathan-crypto](https://github.com/xero/leviathan-crypto). Serpent-256-CBC,
> XChaCha20-Poly1305, and AES-256-GCM-SIV, WASM-SIMD accelerated, distributed
> across a worker pool.

> ### Table of Contents
> - [What it does](#what-it-does)
> - [Install](#install)
> - [Usage](#usage)
> - [Ciphers](#ciphers)
> - [Build from source](#build-from-source)
> - [Shell completions](#shell-completions)
> - [Wire format](#wire-format)
> - [Security notes](#security-notes)
> - [Related](#related)
> - [License](#license)

---

## What it does

`lvthn` encrypts and decrypts files and pipes from the command line. One keyfile
works with all three ciphers; the header byte chooses the algorithm on decrypt
automatically. Encryption and decryption distribute 64KB chunks across a worker
pool sized to `hardwareConcurrency`, and each worker owns an isolated WASM
instance with no shared memory between workers. Output is byte-compatible with
the [web demo](../web/README.md).

---

## Install

Installs the `lvthn` command globally.

```sh
bun add -g lvthn
# or
npm install -g lvthn
```

---

## Usage

```sh
# Encrypt with a passphrase (Serpent by default)
lvthn encrypt -p "correct horse battery" secret.txt

# Encrypt with XChaCha20-Poly1305
lvthn encrypt --cipher chacha -p "correct horse battery" secret.txt

# Encrypt with AES-256-GCM-SIV
lvthn encrypt --cipher aes -p "correct horse battery" secret.txt

# Encrypt with a keyfile
lvthn encrypt -k my.key secret.txt secret.enc

# Encrypt from stdin, armored output
cat secret.txt | lvthn encrypt -k my.key --armor > secret.enc

# Decrypt (cipher is detected automatically from the file)
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
| `--cipher aes` | AES-256-GCM-SIV | POLYVAL per chunk + key commitment | hardware-dependent |

Serpent has a larger security margin (32 rounds versus 20) at the cost of speed.
ChaCha20-Poly1305 is the choice of TLS 1.3 and WireGuard. AES-GCM-SIV (RFC 8452)
is nonce-misuse-resistant and benefits from hardware AES instructions where
available. All three are good; pick based on your threat model and throughput
requirements.

Throughput figures are approximate, measured pre-SIMD on Apple Silicon. Current
leviathan-crypto releases include SIMD-accelerated paths for both ciphers, so
actual numbers run higher on SIMD-capable hardware and vary by platform.

All three ciphers share the same outer format, the same scrypt key derivation,
and the same keyfiles. A key generated with `lvthn keygen` works with any cipher.

---

## Build from source

Requires [Bun](https://bun.sh).

```sh
bun install
bun bake
# → dist/lvthn
```

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
`--passphrase` and `--keyfile` flags are mutually exclusive; once one is used the
other is suppressed from suggestions.

---

## Wire format

LVTHN v3 binary format, shared with the web demo. The cipher byte at offset 6 of
the header drives decryption automatically. See [FORMAT.md](./FORMAT.md) for the
full wire specification, including the pool preamble layout and the counter-nonce
scheme.

---

## Security notes

- **Key derivation.** Passphrases go through scrypt (N=32768, r=8, p=1) with a
  fresh random 32-byte salt per encryption, producing a 32-byte master key.
  Keyfiles are read directly as 32 raw bytes.
- **Parallelism.** Encryption and decryption distribute 64KB chunks across a
  worker pool sized to `hardwareConcurrency`. Each worker owns an isolated WASM
  instance with no shared memory between workers.
- **Integrity.** Any modification to a ciphertext chunk fails that chunk's
  authentication. The entire decryption is rejected; no partial plaintext is
  produced.

---

## Related

- [leviathan-crypto](https://github.com/xero/leviathan-crypto): the underlying library
- [web demo](../web/README.md), [tamper demo](../tamper/README.md), [kyber demo](../kyber/README.md), [jwt demo](../jwt/README.md)
- [FORMAT.md](./FORMAT.md): LVTHN wire format specification
- [npmjs.org/package/lvthn](https://www.npmjs.com/package/lvthn): published package

---

## License

Leviathan and its demos are written under the [MIT license](http://www.opensource.org/licenses/MIT).

```
                ▄▄▄▄▄▄▄▄▄▄
         ▄████████████████████▄▄
      ▄██████████████████████ ▀████▄
    ▄█████████▀▀▀     ▀███████▄▄███████▌
   ▐████████▀   ▄▄▄▄     ▀████████▀██▀█▌
   ████████      ███▀▀     ████▀  █▀ █▀
   ███████▌    ▀██▀         ██
    ███████   ▀███           ▀██ ▀█▄
     ▀██████   ▄▄██            ▀▀  ██▄
       ▀█████▄   ▄██▄             ▄▀▄▀
          ▀████▄   ▄██▄
            ▐████   ▐███
     ▄▄██████████    ▐███         ▄▄
  ▄██▀▀▀▀▀▀▀▀▀▀     ▄████      ▄██▀
▄▀  ▄▄█████████▄▄  ▀▀▀▀▀     ▄███
 ▄██████▀▀▀▀▀▀██████▄ ▀▄▄▄▄████▀
████▀    ▄▄▄▄▄▄▄ ▀████▄ ▀█████▀  ▄▄▄▄
█████▄▄█████▀▀▀▀▀▀▄ ▀███▄      ▄███▀
▀██████▀             ▀████▄▄▄████▀
                        ▀█████▀
```
