# lvthn-web Smoke Test Results

All 31 Playwright tests pass. Run with: `bunx playwright test --reporter=list`

## Environment

| Item | Value |
|------|-------|
| Test framework | `@playwright/test` 1.58.2 |
| Browser | Chromium 145.0.7632.6 (headless) |
| Runtime | Bun |
| Output | `lvthn.html` (75.7 KB single-file app) |

## Results

```
Running 31 tests using 1 worker

  ✓  1  UI initial state › page loads without errors (709ms)
  ✓  2  UI initial state › ENCRYPT mode is active by default (74ms)
  ✓  3  UI initial state › action button is disabled with no input (61ms)
  ✓  4  UI initial state › action button shows no key hint when input provided but no passphrase (72ms)
  ✓  5  Mode toggle › ENCRYPT/DECRYPT toggle works (85ms)
  ✓  6  Mode toggle › switching mode clears output (143ms)
  ✓  7  Mode toggle › GENERATE KEY option hidden in decrypt mode (71ms)
  ✓  8  TEXT + PASSPHRASE — encrypt › encrypts text and produces armored output (109ms)
  ✓  9  TEXT + PASSPHRASE — encrypt › produces different ciphertext each time (fresh IV) (180ms)
  ✓ 10  TEXT + PASSPHRASE — decrypt round-trip › decrypts back to original text (180ms)
  ✓ 11  TEXT + PASSPHRASE — decrypt round-trip › wrong passphrase → authentication failed error (161ms)
  ✓ 12  TEXT + PASSPHRASE — decrypt round-trip › tampered ciphertext → authentication failed (180ms)
  ✓ 13  GENERATE KEY flow › generates a key on click (84ms)
  ✓ 14  GENERATE KEY flow › generates different key each click (101ms)
  ✓ 15  GENERATE KEY flow › 128-bit generates 32 hex chars (97ms)
  ✓ 16  GENERATE KEY flow › 192-bit generates 48 hex chars (104ms)
  ✓ 17  GENERATE KEY + encrypt/decrypt round-trip › encrypts with generated key (116ms)
  ✓ 18  Passphrase strength indicator › shows weak for short passphrase (65ms)
  ✓ 19  Passphrase strength indicator › shows fair for medium passphrase (62ms)
  ✓ 20  Passphrase strength indicator › shows strong for long passphrase (56ms)
  ✓ 21  Passphrase strength indicator › strength hidden in decrypt mode (70ms)
  ✓ 22  Security details panel › is collapsed by default (46ms)
  ✓ 23  Security details panel › expands on click (66ms)
  ✓ 24  Security details panel › collapses again on second click (81ms)
  ✓ 25  Show/hide passphrase › password field starts hidden (51ms)
  ✓ 26  Show/hide passphrase › toggle reveals passphrase (63ms)
  ✓ 27  Show/hide passphrase › toggle button text changes (62ms)
  ✓ 28  TEXT/FILE tab toggle › FILE tab switches to file input (66ms)
  ✓ 29  TEXT/FILE tab toggle › switching tab clears output (120ms)
  ✓ 30  Invalid format › gibberish input → unrecognized format error (104ms)
  ✓ 31  Offline capability › page works without network (no external fetches) (531ms)

  31 passed (5.0s)
```

## Issues Encountered and Fixed

### Bundle minification renames class variables

**Symptom:** Building with `bun build ... --format esm --minify` renamed `Serpent_CBC_PKCS7` → `w`,
`HMAC_SHA256` → `C`, `constantTimeEqual` → `E` in the bundle output. The bundle's `export{}`
statement used the original names as export aliases, but the in-scope variable names were the
mangled short names. App code after the bundle (in the same `<script type="module">`) referenced
the original names, causing `ReferenceError` / parse failures reported as "Unexpected token '{'".

**Fix:** Rebuild bundle without `--minify`. Class names are preserved; the export statement
uses the same identifiers that are in scope.

### EventEmitter polyfill used ES2021 `??=` operator

**Initial investigation (v1 attempt):** Removing the `Random` export from `leviathan.web-entry.ts`
eliminated the `events` (Node.js EventEmitter) polyfill from the bundle, which contained `??=`
(nullish assignment) — an ES2021 operator. This was a red herring: the actual Chromium version
(145) supports `??=`. The real bug was the minification renaming above.

### `new Random()` reference after removing Random from bundle

**Symptom:** The keygen button handler called `new Random()` (leviathan's Fortuna CSPRNG),
but `Random` was removed from the bundle entry point to eliminate the EventEmitter polyfill.

**Fix:** Replaced `new Random()` with `crypto.getRandomValues(new Uint8Array(...))` directly.
The browser's WebCrypto CSPRNG is cryptographically strong and the correct primitive here —
`window.crypto.getRandomValues` is the standard browser API for this purpose.

## Verdict

**PASS.** The application is functionally correct:

- Encryption produces valid armored LVTHN output with fresh IV each time
- Decryption round-trips correctly back to original plaintext
- Wrong passphrase and tampered ciphertext are both detected before decryption
- Key generation produces the correct number of random bytes at each size
- All UI interactions (mode toggle, tab toggle, show/hide passphrase, strength indicator,
  security details panel) work correctly
- No external network requests are made (fully offline-capable)
