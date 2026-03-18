# lvthn — Serpent-256 File Encryption CLI

A standalone command-line encryption tool built as a demo for the
[leviathan-crypto](https://github.com/xero/leviathan-crypto) library (WASM-accelerated).

**Under the hood:**
- Encryption: SerpentStreamSealer (Serpent-CBC + HMAC-SHA256 per chunk, HKDF key derivation)
- Integrity: per-chunk HMAC-SHA256 via SerpentStreamSealer — auth verified before any plaintext is produced
- Key derivation: scrypt (N=32768, r=8, p=1) → 64-byte key
- Key generation: Fortuna CSPRNG (leviathan-crypto)
- Random: Web Crypto getRandomValues (via leviathan-crypto)
- Runtime: [Bun](https://bun.sh) — compiled to a single self-contained binary

---

## Building from Source

Requires [Bun](https://bun.sh) ≥ 1.0.

```bash
cd demos/lvthn-cli
bun install
bun run build       # produces dist/lvthn
```

The build script compiles `src/main.ts` into a standalone binary using Bun's
bundler. No Bun installation is required to run the resulting binary.

---

## Commands

```
lvthn <command> [options] [input] [output]
```

### `lvthn encrypt`

Encrypt a file or stdin.

```
Options:
  -p, --passphrase <phrase>   Encrypt using passphrase (scrypt key derivation)
  -k, --keyfile <path>        Encrypt using a keyfile
      --armor                 Output base64 armored text instead of binary
  -o, --output <path>         Output file path
      --force                 Overwrite output file if it exists

Arguments:
  input    File to encrypt (omit or use - for stdin)
  output   Output file (omit for stdout, or use -o flag)
```

```bash
# Encrypt a file with a passphrase
lvthn encrypt -p "correct horse battery" secret.txt

# Encrypt with a keyfile to a named output
lvthn encrypt -k my.key secret.txt secret.enc

# Encrypt to armored (base64) output
lvthn encrypt -p "passphrase" --armor < message.txt > message.asc

# Pipe encryption
cat secret.txt | lvthn encrypt -k my.key --armor
```

### `lvthn decrypt`

Decrypt a file or stdin. Armored vs binary input is **auto-detected** — no
`--armor` flag needed.

```
Options:
  -p, --passphrase <phrase>   Passphrase for decryption
  -k, --keyfile <path>        Keyfile for decryption
  -o, --output <path>         Output file path (default: stdout)
      --force                 Overwrite output file if it exists
```

```bash
lvthn decrypt -p "correct horse battery" secret.enc
lvthn decrypt -k my.key secret.enc decrypted.txt
cat message.asc | lvthn decrypt -p "passphrase"
```

### `lvthn keygen`

Generate a cryptographically secure random keyfile using Fortuna CSPRNG.
Always produces a 64-byte (512-bit) key.

```
Options:
  -o, --output <path> Output path (default: leviathan.key)
      --armor         Output base64 armored keyfile
```

```bash
lvthn keygen                        # 512-bit key → leviathan.key
lvthn keygen -o my.key
lvthn keygen --armor -o my.key      # armored (base64) keyfile
```

Keyfiles are 64 raw random bytes. Armored keyfiles use PEM-like headers:
```
-----BEGIN SRPT256S KEY-----
<base64>
-----END SRPT256S KEY-----
```

Both formats are accepted transparently by `encrypt` and `decrypt`.

### `lvthn help`

Print help. Also triggered by `-h`, `--help`, or no arguments.

---

## Encrypted Format

Every encrypted file — binary or armored — uses the same internal structure: a
64-byte header followed by the chunked ciphertext.

**What is protected:**
Each chunk of ciphertext is individually authenticated with HMAC-SHA256.
Per-chunk keys are derived via HKDF from the master key, stream nonce, chunk
index, and a last-chunk flag — preventing reordering and truncation attacks.
Authentication is verified before any plaintext is produced.

**What "authentication failed" means:**
Either the key/passphrase is wrong, or the file has been corrupted or tampered
with. There is intentionally no distinction between these cases.

See [FORMAT.md](FORMAT.md) for the full byte-level format specification.

---

## Pipe and Redirect Examples

```bash
# Encrypt stdin → stdout (binary)
echo "secret" | lvthn encrypt -k my.key > out.enc

# Encrypt stdin → stdout (armored)
echo "secret" | lvthn encrypt -k my.key --armor > out.asc

# Decrypt stdin → stdout (auto-detects armored or binary)
cat out.enc | lvthn decrypt -k my.key
cat out.asc | lvthn decrypt -k my.key

# Full pipe round-trip
echo "hello" | lvthn encrypt -k my.key | lvthn decrypt -k my.key
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0    | Success |
| 1    | Authentication failure (wrong key/passphrase or tampered data) |
| 2    | Bad arguments or missing required flags |
| 3    | File not found or not readable |
| 4    | Output file already exists (use `--force` to overwrite) |
| 5    | Invalid or unrecognized file format |

---

## Limitations

- **In-memory only.** Files are read entirely into memory before processing.
  The wire format is stream-capable (chunked), but this CLI reads the full file
  before encrypting/decrypting. This is suitable for files up to a few hundred
  MB; a future version could process chunks incrementally for larger files.

- **Passphrase security.** The strength of passphrase-based encryption depends
  entirely on passphrase quality. scrypt with N=32768 significantly slows
  brute-force attacks but does not eliminate them against weak passphrases.

- **Timing caveats.** The Serpent cipher runs as WASM (leviathan-crypto),
  which has more predictable timing than pure JS but is not formally
  constant-time. This tool is a demo; production use in adversarial
  timing environments should use a native constant-time implementation.

- **Armor memory cost.** The `armor()` function uses `String.fromCharCode(...data)`
  which may hit call stack limits for very large payloads. For large files,
  use binary (non-armored) output.
