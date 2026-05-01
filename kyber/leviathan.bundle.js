// node_modules/leviathan-crypto/dist/ct-wasm.js
var CT_WASM = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 8, 1, 96, 3, 127, 127, 127, 1, 127, 3, 2, 1, 0, 5, 4, 1, 1, 1, 1, 7, 20, 2, 7, 99, 111, 109, 112, 97, 114, 101, 0, 0, 6, 109, 101, 109, 111, 114, 121, 2, 0, 10, 133, 1, 1, 130, 1, 3, 2, 127, 1, 126, 1, 123, 3, 64, 32, 3, 65, 16, 106, 34, 4, 32, 2, 76, 4, 64, 32, 6, 32, 0, 32, 3, 106, 253, 0, 4, 0, 32, 1, 32, 3, 106, 253, 0, 4, 0, 253, 81, 253, 80, 33, 6, 32, 4, 33, 3, 12, 1, 11, 11, 3, 64, 32, 2, 32, 3, 74, 4, 64, 32, 5, 32, 0, 32, 3, 106, 49, 0, 0, 32, 1, 32, 3, 106, 49, 0, 0, 133, 132, 33, 5, 32, 3, 65, 1, 106, 33, 3, 12, 1, 11, 11, 66, 0, 32, 5, 32, 6, 253, 29, 0, 32, 6, 253, 29, 1, 132, 132, 34, 5, 125, 32, 5, 132, 66, 63, 135, 66, 127, 133, 167, 65, 1, 113, 11]);

// node_modules/leviathan-crypto/dist/utils.js
var bytesToHex = (bytes) => {
  const lut = "0123456789abcdef";
  let str = "";
  for (const b of bytes)
    str += lut.charAt(b >>> 4 & 15) + lut.charAt(b & 15);
  return str;
};
var base64ToBytes = (b64) => {
  b64 = b64.replace(/-/g, "+").replace(/_/g, "/").replace(/%3d/gi, "=");
  const rem = b64.length % 4;
  if (rem === 1)
    throw new RangeError("base64ToBytes: invalid base64 input");
  if (rem === 2)
    b64 += "==";
  if (rem === 3)
    b64 += "=";
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64))
    throw new RangeError("base64ToBytes: invalid base64 input");
  let strlen = b64.length / 4 * 3;
  if (b64.charAt(b64.length - 1) === "=")
    strlen--;
  if (b64.charAt(b64.length - 2) === "=")
    strlen--;
  if (typeof atob !== "undefined") {
    try {
      return new Uint8Array(atob(b64).split("").map((c) => c.charCodeAt(0)));
    } catch {
      throw new RangeError("base64ToBytes: invalid base64 input");
    }
  }
  const decodingTable = new Int8Array([
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    62,
    -1,
    62,
    -1,
    63,
    52,
    53,
    54,
    55,
    56,
    57,
    58,
    59,
    60,
    61,
    -1,
    -1,
    -1,
    -2,
    -1,
    -1,
    -1,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    -1,
    -1,
    -1,
    -1,
    63,
    -1,
    26,
    27,
    28,
    29,
    30,
    31,
    32,
    33,
    34,
    35,
    36,
    37,
    38,
    39,
    40,
    41,
    42,
    43,
    44,
    45,
    46,
    47,
    48,
    49,
    50,
    51,
    -1,
    -1,
    -1,
    -1,
    -1
  ]);
  let p = 0;
  const bin = new Uint8Array(strlen);
  for (let i = 0;i < b64.length; ) {
    const a = b64.charAt(i) === "=" || b64.charCodeAt(i) > 122 ? 0 : decodingTable[b64.charCodeAt(i)];
    i++;
    const b = b64.charAt(i) === "=" || b64.charCodeAt(i) > 122 ? 0 : decodingTable[b64.charCodeAt(i)];
    i++;
    const c = b64.charAt(i) === "=" || b64.charCodeAt(i) > 122 ? 0 : decodingTable[b64.charCodeAt(i)];
    i++;
    const d = b64.charAt(i) === "=" || b64.charCodeAt(i) > 122 ? 0 : decodingTable[b64.charCodeAt(i)];
    i++;
    const triple = (a << 18) + (b << 12) + (c << 6) + d;
    if (b64.charAt(i - 3) !== "=")
      bin[p++] = triple >>> 16 & 255;
    if (b64.charAt(i - 2) !== "=")
      bin[p++] = triple >>> 8 & 255;
    if (b64.charAt(i - 1) !== "=")
      bin[p++] = triple & 255;
  }
  return bin;
};
var _ctCompare = null;
var _ctMem = null;
var _ctInit = false;
var _ctInitError = null;
var CT_MAX_BYTES = 32768;
function _initCt() {
  if (_ctInit) {
    if (_ctInitError)
      throw _ctInitError;
    return;
  }
  _ctInit = true;
  if (!hasSIMD()) {
    _ctInitError = new Error("leviathan-crypto: constantTimeEqual requires WebAssembly SIMD — " + "this runtime does not support it");
    throw _ctInitError;
  }
  try {
    const buf = CT_WASM.buffer.slice(CT_WASM.byteOffset, CT_WASM.byteOffset + CT_WASM.byteLength);
    const mod = new WebAssembly.Module(buf);
    const inst = new WebAssembly.Instance(mod);
    const exports = inst.exports;
    _ctMem = exports.memory;
    _ctCompare = exports.compare;
  } catch (cause) {
    _ctInitError = new Error(`leviathan-crypto: ct WASM module failed to instantiate: ${cause.message}`);
    throw _ctInitError;
  }
}
var constantTimeEqual = (a, b) => {
  if (a.length !== b.length)
    return false;
  if (a.length > CT_MAX_BYTES)
    throw new RangeError(`constantTimeEqual: max ${CT_MAX_BYTES} bytes (got ${a.length})`);
  _initCt();
  const memObj = _ctMem;
  const compare = _ctCompare;
  if (!memObj || !compare)
    throw new Error("leviathan-crypto: ct init invariant violated");
  const mem = new Uint8Array(memObj.buffer);
  mem.set(a, 0);
  mem.set(b, a.length);
  try {
    return compare(0, a.length, a.length) === 1;
  } finally {
    mem.fill(0, 0, a.length * 2);
  }
};
var wipe = (data) => {
  data.fill(0);
};
var randomBytes = (n) => {
  if (typeof globalThis.crypto === "undefined" || typeof globalThis.crypto.getRandomValues !== "function")
    throw new Error("leviathan-crypto: crypto.getRandomValues is required — " + "this runtime does not expose the Web Crypto API");
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return buf;
};
var _simd = null;
function hasSIMD() {
  if (_simd !== null)
    return _simd;
  if (typeof WebAssembly === "undefined" || typeof WebAssembly.validate !== "function") {
    _simd = false;
    return _simd;
  }
  try {
    _simd = WebAssembly.validate(new Uint8Array([
      0,
      97,
      115,
      109,
      1,
      0,
      0,
      0,
      1,
      5,
      1,
      96,
      0,
      1,
      123,
      3,
      2,
      1,
      0,
      10,
      10,
      1,
      8,
      0,
      65,
      0,
      253,
      15,
      253,
      98,
      11
    ]));
  } catch {
    _simd = false;
  }
  return _simd;
}

// node_modules/leviathan-crypto/dist/loader.js
function toArrayBuffer(bytes) {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength)
    return bytes.buffer;
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}
async function decodeWasm(b64) {
  if (typeof DecompressionStream === "undefined")
    throw new Error("leviathan-crypto: DecompressionStream not available — " + "use a URL, ArrayBuffer, or WebAssembly.Module source in this runtime");
  const compressed = base64ToBytes(b64);
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  const writePromise = writer.write(compressed).then(() => writer.close());
  const chunks = [];
  let done, value;
  while ({ done, value } = await reader.read(), !done)
    if (value)
      chunks.push(value);
  await writePromise;
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
var MAX_THENABLE_DEPTH = 3;
async function compileWasm(source, _depth = 0) {
  if (_depth > MAX_THENABLE_DEPTH)
    throw new TypeError(`leviathan-crypto: thenable nesting too deep (max ${MAX_THENABLE_DEPTH})`);
  if (typeof source === "string") {
    if (source.length === 0)
      throw new TypeError("leviathan-crypto: invalid WasmSource — empty string");
    return WebAssembly.compile(toArrayBuffer(await decodeWasm(source)));
  }
  if (source instanceof URL)
    return WebAssembly.compileStreaming(fetch(source.href));
  if (source instanceof ArrayBuffer)
    return WebAssembly.compile(source);
  if (source instanceof Uint8Array)
    return WebAssembly.compile(toArrayBuffer(source));
  if (source instanceof WebAssembly.Module)
    return source;
  if (typeof Response !== "undefined" && source instanceof Response)
    return WebAssembly.compileStreaming(source);
  if (source != null && typeof source.then === "function") {
    const resolved = await source;
    return compileWasm(resolved, _depth + 1);
  }
  throw new TypeError(`leviathan-crypto: invalid WasmSource — got ${source === null ? "null" : typeof source}`);
}
async function loadWasm(source) {
  const mod = await compileWasm(source);
  return WebAssembly.instantiate(mod);
}

// node_modules/leviathan-crypto/dist/init.js
var ALIASES = { keccak: "sha3" };
function resolve(mod) {
  return ALIASES[mod] ?? mod;
}
var instances = new Map;
var pending = new Map;
var owners = new Map;
async function initModule(mod, source) {
  const resolved = resolve(mod);
  if (instances.has(resolved))
    return;
  const inflight = pending.get(resolved);
  if (inflight) {
    await inflight;
    return;
  }
  if ((resolved === "serpent" || resolved === "chacha20" || resolved === "kyber") && !hasSIMD())
    throw new Error("leviathan-crypto: serpent, chacha20, and kyber require WebAssembly SIMD — " + "this runtime does not support it");
  const p = loadWasm(source);
  pending.set(resolved, p);
  try {
    instances.set(resolved, await p);
  } finally {
    pending.delete(resolved);
  }
}
function getInstance(mod) {
  const r = resolve(mod);
  const inst = instances.get(r);
  if (!inst) {
    throw new Error(`leviathan-crypto: call init({ ${mod}: ... }) before using this class`);
  }
  if (owners.has(r)) {
    throw new Error(`leviathan-crypto: another stateful instance is using the '${r}' WASM module — ` + "call dispose() on it before constructing a new one");
  }
  return inst;
}
function isInitialized(mod) {
  return instances.has(resolve(mod));
}
function _acquireModule(mod) {
  const r = resolve(mod);
  if (owners.has(r))
    throw new Error(`leviathan-crypto: another stateful instance is using the '${r}' WASM module — ` + "call dispose() on it before constructing a new one");
  const tok = Symbol(r);
  owners.set(r, tok);
  return tok;
}
function _releaseModule(mod, tok) {
  const r = resolve(mod);
  if (owners.get(r) === tok)
    owners.delete(r);
}
function _assertNotOwned(mod) {
  const r = resolve(mod);
  if (owners.has(r))
    throw new Error(`leviathan-crypto: another stateful instance is using the '${r}' WASM module — ` + "call dispose() on it before constructing a new one");
}

// node_modules/leviathan-crypto/dist/errors.js
class AuthenticationError extends Error {
  constructor(cipher) {
    super(`${cipher}: authentication failed`);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

// node_modules/leviathan-crypto/dist/sha2/hkdf.js
class HKDF_SHA256 {
  hmac;
  constructor() {
    this.hmac = new HMAC_SHA256;
  }
  extract(salt, ikm) {
    const s = !salt || salt.length === 0 ? new Uint8Array(32) : salt;
    return this.hmac.hash(s, ikm);
  }
  expand(prk, info, length) {
    if (prk.length !== 32)
      throw new RangeError("HKDF expand: PRK must be 32 bytes");
    if (length < 1)
      throw new RangeError("HKDF expand: length must be at least 1");
    if (length > 255 * 32)
      throw new RangeError(`HKDF expand: length exceeds maximum (${255 * 32} bytes)`);
    const N = Math.ceil(length / 32);
    const okm = new Uint8Array(N * 32);
    let prev = new Uint8Array(0);
    for (let i = 1;i <= N; i++) {
      const buf = new Uint8Array(prev.length + info.length + 1);
      buf.set(prev, 0);
      buf.set(info, prev.length);
      buf[prev.length + info.length] = i;
      const oldPrev = prev;
      prev = this.hmac.hash(prk, buf);
      okm.set(prev, (i - 1) * 32);
      buf.fill(0);
      oldPrev.fill(0);
    }
    prev.fill(0);
    const result = okm.slice(0, length);
    okm.fill(0);
    return result;
  }
  derive(ikm, salt, info, length) {
    const prk = this.extract(salt, ikm);
    const okm = this.expand(prk, info, length);
    prk.fill(0);
    return okm;
  }
  dispose() {
    this.hmac.dispose();
  }
}
// node_modules/leviathan-crypto/dist/sha2/index.js
async function sha2Init(source) {
  return initModule("sha2", source);
}
function getExports() {
  return getInstance("sha2").exports;
}
function feedHash(x, msg, inputOff, chunkSize, updateFn) {
  const mem = new Uint8Array(x.memory.buffer);
  let pos = 0;
  while (pos < msg.length) {
    const n = Math.min(msg.length - pos, chunkSize);
    mem.set(msg.subarray(pos, pos + n), inputOff);
    updateFn(n);
    pos += n;
  }
}
class HMAC_SHA256 {
  x;
  constructor() {
    this.x = getExports();
  }
  hash(key, msg) {
    _assertNotOwned("sha2");
    let k = key;
    if (k.length > 64) {
      this.x.sha256Init();
      feedHash(this.x, k, this.x.getSha256InputOffset(), 64, this.x.sha256Update);
      this.x.sha256Final();
      const mem2 = new Uint8Array(this.x.memory.buffer);
      k = mem2.slice(this.x.getSha256OutOffset(), this.x.getSha256OutOffset() + 32);
    }
    const mem = new Uint8Array(this.x.memory.buffer);
    mem.set(k, this.x.getSha256InputOffset());
    this.x.hmac256Init(k.length);
    feedHash(this.x, msg, this.x.getSha256InputOffset(), 64, this.x.hmac256Update);
    this.x.hmac256Final();
    const out = new Uint8Array(this.x.memory.buffer);
    return out.slice(this.x.getSha256OutOffset(), this.x.getSha256OutOffset() + 32);
  }
  dispose() {
    _assertNotOwned("sha2");
    this.x.wipeBuffers();
  }
}

// node_modules/leviathan-crypto/dist/serpent/index.js
async function serpentInit(source) {
  return initModule("serpent", source);
}

// node_modules/leviathan-crypto/dist/chacha20/ops.js
function polyFeed(x, data) {
  if (data.length === 0)
    return;
  const mem = new Uint8Array(x.memory.buffer);
  const msgOff = x.getPolyMsgOffset();
  let pos = 0;
  while (pos < data.length) {
    const chunk = Math.min(64, data.length - pos);
    mem.set(data.subarray(pos, pos + chunk), msgOff);
    x.polyUpdate(chunk);
    pos += chunk;
  }
}
function lenBlock(aadLen, ctLen) {
  const b = new Uint8Array(16);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, aadLen >>> 0, true);
  dv.setUint32(4, Math.floor(aadLen / 4294967296) >>> 0, true);
  dv.setUint32(8, ctLen >>> 0, true);
  dv.setUint32(12, Math.floor(ctLen / 4294967296) >>> 0, true);
  return b;
}
function aeadEncrypt(x, key, nonce, plaintext, aad) {
  const maxChunk = x.getChunkSize();
  if (plaintext.length > maxChunk)
    throw new RangeError(`plaintext exceeds ${maxChunk} bytes — split into smaller chunks`);
  const mem = new Uint8Array(x.memory.buffer);
  mem.set(key, x.getKeyOffset());
  mem.set(nonce, x.getChachaNonceOffset());
  x.chachaLoadKey();
  x.chachaGenPolyKey();
  x.polyInit();
  polyFeed(x, aad);
  const aadPad = (16 - aad.length % 16) % 16;
  if (aadPad > 0)
    polyFeed(x, new Uint8Array(aadPad));
  x.chachaSetCounter(1);
  mem.set(plaintext, x.getChunkPtOffset());
  x.chachaEncryptChunk_simd(plaintext.length);
  const ctOff = x.getChunkCtOffset();
  const ciphertext = new Uint8Array(x.memory.buffer).slice(ctOff, ctOff + plaintext.length);
  polyFeed(x, ciphertext);
  const ctPad = (16 - plaintext.length % 16) % 16;
  if (ctPad > 0)
    polyFeed(x, new Uint8Array(ctPad));
  polyFeed(x, lenBlock(aad.length, plaintext.length));
  x.polyFinal();
  const tagOff = x.getPolyTagOffset();
  const tag = new Uint8Array(x.memory.buffer).slice(tagOff, tagOff + 16);
  return { ciphertext, tag };
}
function aeadDecrypt(x, key, nonce, ciphertext, tag, aad, cipherName = "chacha20-poly1305") {
  const maxChunk = x.getChunkSize();
  if (ciphertext.length > maxChunk)
    throw new RangeError(`ciphertext exceeds ${maxChunk} bytes — split into smaller chunks`);
  const mem = new Uint8Array(x.memory.buffer);
  mem.set(key, x.getKeyOffset());
  mem.set(nonce, x.getChachaNonceOffset());
  x.chachaLoadKey();
  x.chachaGenPolyKey();
  x.polyInit();
  polyFeed(x, aad);
  const aadPad = (16 - aad.length % 16) % 16;
  if (aadPad > 0)
    polyFeed(x, new Uint8Array(aadPad));
  polyFeed(x, ciphertext);
  const ctPad = (16 - ciphertext.length % 16) % 16;
  if (ctPad > 0)
    polyFeed(x, new Uint8Array(ctPad));
  polyFeed(x, lenBlock(aad.length, ciphertext.length));
  x.polyFinal();
  const tagOff = x.getPolyTagOffset();
  const expectedTag = new Uint8Array(x.memory.buffer).slice(tagOff, tagOff + 16);
  if (!constantTimeEqual(expectedTag, tag)) {
    const ctOff = x.getChunkCtOffset();
    mem.fill(0, ctOff, ctOff + maxChunk);
    const blockOff = x.getChachaBlockOffset();
    mem.fill(0, blockOff, blockOff + 64);
    const polyKeyOff = x.getPolyKeyOffset();
    mem.fill(0, polyKeyOff, polyKeyOff + 32);
    throw new AuthenticationError(cipherName);
  }
  x.chachaSetCounter(1);
  x.chachaLoadKey();
  new Uint8Array(x.memory.buffer).set(ciphertext, x.getChunkPtOffset());
  x.chachaEncryptChunk_simd(ciphertext.length);
  const ptOff = x.getChunkCtOffset();
  return new Uint8Array(x.memory.buffer).slice(ptOff, ptOff + ciphertext.length);
}
function deriveSubkey(x, key, nonce) {
  const mem = new Uint8Array(x.memory.buffer);
  mem.set(key, x.getKeyOffset());
  mem.set(nonce.subarray(0, 16), x.getXChaChaNonceOffset());
  x.hchacha20();
  const off = x.getXChaChaSubkeyOffset();
  return new Uint8Array(x.memory.buffer).slice(off, off + 32);
}
function innerNonce(nonce) {
  const n = new Uint8Array(12);
  n.set(nonce.subarray(16, 24), 4);
  return n;
}
function xcEncrypt(x, key, nonce, plaintext, aad) {
  const subkey = deriveSubkey(x, key, nonce);
  const inner = innerNonce(nonce);
  const { ciphertext, tag } = aeadEncrypt(x, subkey, inner, plaintext, aad);
  const result = new Uint8Array(ciphertext.length + 16);
  result.set(ciphertext);
  result.set(tag, ciphertext.length);
  return result;
}
function xcDecrypt(x, key, nonce, ciphertext, aad) {
  const ct = ciphertext.subarray(0, ciphertext.length - 16);
  const tag = ciphertext.subarray(ciphertext.length - 16);
  const subkey = deriveSubkey(x, key, nonce);
  const inner = innerNonce(nonce);
  return aeadDecrypt(x, subkey, inner, ct, tag, aad, "xchacha20-poly1305");
}

// node_modules/leviathan-crypto/dist/chacha20/index.js
async function chacha20Init(source) {
  return initModule("chacha20", source);
}
function getExports2() {
  return getInstance("chacha20").exports;
}
class XChaCha20Poly1305 {
  x;
  _used = false;
  constructor() {
    this.x = getExports2();
  }
  encrypt(key, nonce, plaintext, aad = new Uint8Array(0)) {
    if (this._used)
      throw new Error("leviathan-crypto: encrypt() already called on this instance. " + "Create a new instance for each encryption to prevent nonce reuse.");
    this._used = true;
    _assertNotOwned("chacha20");
    if (key.length !== 32)
      throw new RangeError(`key must be 32 bytes (got ${key.length})`);
    if (nonce.length !== 24)
      throw new RangeError(`XChaCha20 nonce must be 24 bytes (got ${nonce.length})`);
    return xcEncrypt(this.x, key, nonce, plaintext, aad);
  }
  decrypt(key, nonce, ciphertext, aad = new Uint8Array(0)) {
    _assertNotOwned("chacha20");
    if (key.length !== 32)
      throw new RangeError(`key must be 32 bytes (got ${key.length})`);
    if (nonce.length !== 24)
      throw new RangeError(`XChaCha20 nonce must be 24 bytes (got ${nonce.length})`);
    if (ciphertext.length < 16)
      throw new RangeError(`ciphertext too short — must include 16-byte tag (got ${ciphertext.length})`);
    return xcDecrypt(this.x, key, nonce, ciphertext, aad);
  }
  dispose() {
    _assertNotOwned("chacha20");
    this.x.wipeBuffers();
  }
}

// node_modules/leviathan-crypto/dist/sha3/index.js
async function sha3Init(source) {
  return initModule("sha3", source);
}
function getExports3() {
  return getInstance("sha3").exports;
}
function absorb(x, msg) {
  const mem = new Uint8Array(x.memory.buffer);
  const inputOff = x.getInputOffset();
  let pos = 0;
  while (pos < msg.length) {
    const chunk = Math.min(msg.length - pos, 168);
    mem.set(msg.subarray(pos, pos + chunk), inputOff);
    x.keccakAbsorb(chunk);
    pos += chunk;
  }
}
class SHAKE128 {
  x;
  _rate = 168;
  _squeezing = false;
  _block = new Uint8Array(168);
  _blockPos = 168;
  _tok;
  constructor() {
    this.x = getExports3();
    this._tok = _acquireModule("sha3");
    try {
      this.x.shake128Init();
    } catch (e) {
      _releaseModule("sha3", this._tok);
      this._tok = undefined;
      throw e;
    }
  }
  reset() {
    if (this._tok === undefined)
      throw new Error("SHAKE128: instance has been disposed");
    this.x.shake128Init();
    this._squeezing = false;
    this._block.fill(0);
    this._blockPos = this._rate;
    return this;
  }
  absorb(msg) {
    if (this._tok === undefined)
      throw new Error("SHAKE128: instance has been disposed");
    if (this._squeezing)
      throw new Error("SHAKE128: cannot absorb after squeeze — call reset() first");
    absorb(this.x, msg);
    return this;
  }
  squeeze(n) {
    if (this._tok === undefined)
      throw new Error("SHAKE128: instance has been disposed");
    if (n < 1)
      throw new RangeError(`squeeze length must be >= 1 (got ${n})`);
    if (!this._squeezing) {
      this.x.shakePad();
      this._squeezing = true;
      this._blockPos = this._rate;
    }
    const out = new Uint8Array(n);
    let pos = 0;
    while (pos < n) {
      if (this._blockPos >= this._rate) {
        this.x.shakeSqueezeBlock();
        const mem = new Uint8Array(this.x.memory.buffer);
        const off = this.x.getOutOffset();
        this._block.set(mem.subarray(off, off + this._rate));
        this._blockPos = 0;
      }
      const take = Math.min(n - pos, this._rate - this._blockPos);
      out.set(this._block.subarray(this._blockPos, this._blockPos + take), pos);
      this._blockPos += take;
      pos += take;
    }
    return out;
  }
  hash(msg, outputLength) {
    if (this._tok === undefined)
      throw new Error("SHAKE128: instance has been disposed");
    if (outputLength < 1)
      throw new RangeError(`outputLength must be >= 1 (got ${outputLength})`);
    this.reset();
    this.absorb(msg);
    return this.squeeze(outputLength);
  }
  dispose() {
    if (this._tok === undefined)
      return;
    this._block.fill(0);
    try {
      this.x.wipeBuffers();
    } finally {
      _releaseModule("sha3", this._tok);
      this._tok = undefined;
    }
  }
}

class SHAKE256 {
  x;
  _rate = 136;
  _squeezing = false;
  _block = new Uint8Array(136);
  _blockPos = 136;
  _tok;
  constructor() {
    this.x = getExports3();
    this._tok = _acquireModule("sha3");
    try {
      this.x.shake256Init();
    } catch (e) {
      _releaseModule("sha3", this._tok);
      this._tok = undefined;
      throw e;
    }
  }
  reset() {
    if (this._tok === undefined)
      throw new Error("SHAKE256: instance has been disposed");
    this.x.shake256Init();
    this._squeezing = false;
    this._block.fill(0);
    this._blockPos = this._rate;
    return this;
  }
  absorb(msg) {
    if (this._tok === undefined)
      throw new Error("SHAKE256: instance has been disposed");
    if (this._squeezing)
      throw new Error("SHAKE256: cannot absorb after squeeze — call reset() first");
    absorb(this.x, msg);
    return this;
  }
  squeeze(n) {
    if (this._tok === undefined)
      throw new Error("SHAKE256: instance has been disposed");
    if (n < 1)
      throw new RangeError(`squeeze length must be >= 1 (got ${n})`);
    if (!this._squeezing) {
      this.x.shakePad();
      this._squeezing = true;
      this._blockPos = this._rate;
    }
    const out = new Uint8Array(n);
    let pos = 0;
    while (pos < n) {
      if (this._blockPos >= this._rate) {
        this.x.shakeSqueezeBlock();
        const mem = new Uint8Array(this.x.memory.buffer);
        const off = this.x.getOutOffset();
        this._block.set(mem.subarray(off, off + this._rate));
        this._blockPos = 0;
      }
      const take = Math.min(n - pos, this._rate - this._blockPos);
      out.set(this._block.subarray(this._blockPos, this._blockPos + take), pos);
      this._blockPos += take;
      pos += take;
    }
    return out;
  }
  hash(msg, outputLength) {
    if (this._tok === undefined)
      throw new Error("SHAKE256: instance has been disposed");
    if (outputLength < 1)
      throw new RangeError(`outputLength must be >= 1 (got ${outputLength})`);
    this.reset();
    this.absorb(msg);
    return this.squeeze(outputLength);
  }
  dispose() {
    if (this._tok === undefined)
      return;
    this._block.fill(0);
    try {
      this.x.wipeBuffers();
    } finally {
      _releaseModule("sha3", this._tok);
      this._tok = undefined;
    }
  }
}

// node_modules/leviathan-crypto/dist/keccak/index.js
async function keccakInit(source) {
  return initModule("keccak", source);
}

// node_modules/leviathan-crypto/dist/kyber/params.js
var MLKEM512 = {
  k: 2,
  eta1: 3,
  eta2: 2,
  du: 10,
  dv: 4,
  ekBytes: 800,
  dkBytes: 1632,
  ctBytes: 768,
  skCpaBytes: 768
};
var MLKEM768 = {
  k: 3,
  eta1: 2,
  eta2: 2,
  du: 10,
  dv: 4,
  ekBytes: 1184,
  dkBytes: 2400,
  ctBytes: 1088,
  skCpaBytes: 1152
};
var MLKEM1024 = {
  k: 4,
  eta1: 2,
  eta2: 2,
  du: 11,
  dv: 5,
  ekBytes: 1568,
  dkBytes: 3168,
  ctBytes: 1568,
  skCpaBytes: 1536
};

// node_modules/leviathan-crypto/dist/kyber/indcpa.js
function sha3Absorb(sx, msg) {
  const mem = new Uint8Array(sx.memory.buffer);
  const inOff = sx.getInputOffset();
  let pos = 0;
  while (pos < msg.length) {
    const chunk = Math.min(msg.length - pos, 168);
    mem.set(msg.subarray(pos, pos + chunk), inOff);
    sx.keccakAbsorb(chunk);
    pos += chunk;
  }
}
function sha3_512Hash(sx, msg) {
  sx.sha3_512Init();
  sha3Absorb(sx, msg);
  sx.sha3_512Final();
  const mem = new Uint8Array(sx.memory.buffer);
  const off = sx.getOutOffset();
  return mem.slice(off, off + 64);
}
function sha3_256Hash(sx, msg) {
  sx.sha3_256Init();
  sha3Absorb(sx, msg);
  sx.sha3_256Final();
  const mem = new Uint8Array(sx.memory.buffer);
  const off = sx.getOutOffset();
  return mem.slice(off, off + 32);
}
function shake256Hash(sx, msg, n) {
  const rate = 136;
  sx.shake256Init();
  sha3Absorb(sx, msg);
  sx.shakePad();
  const sha3Mem = new Uint8Array(sx.memory.buffer);
  const outOff = sx.getOutOffset();
  const out = new Uint8Array(n);
  let pos = 0;
  while (pos < n) {
    sx.shakeSqueezeBlock();
    const take = Math.min(n - pos, rate);
    out.set(sha3Mem.subarray(outOff, outOff + take), pos);
    pos += take;
  }
  return out;
}
function genMatrixRow(kx, sx, k, rho, transposed, pvecSlot, rowI) {
  const xofPrfOff = kx.getXofPrfOffset();
  const kyberMem = new Uint8Array(kx.memory.buffer);
  const sha3Mem = new Uint8Array(sx.memory.buffer);
  const outOff = sx.getOutOffset();
  const xofSeed = new Uint8Array(34);
  xofSeed.set(rho, 0);
  for (let j = 0;j < k; j++) {
    if (!transposed) {
      xofSeed[32] = j;
      xofSeed[33] = rowI;
    } else {
      xofSeed[32] = rowI;
      xofSeed[33] = j;
    }
    sx.shake128Init();
    sha3Absorb(sx, xofSeed);
    sx.shakePad();
    const polyOff = pvecSlot + j * 512;
    let ctr = 0;
    while (ctr < 256) {
      sx.shakeSqueezeBlock();
      kyberMem.set(sha3Mem.subarray(outOff, outOff + 168), xofPrfOff);
      ctr += kx.rej_uniform(polyOff, ctr, xofPrfOff, 168);
    }
  }
}
function noisePolyvec(kx, sx, pvSlot, k, sigma, nonceStart, eta) {
  const xofPrfOff = kx.getXofPrfOffset();
  const kyberMem = new Uint8Array(kx.memory.buffer);
  const sha3Mem = new Uint8Array(sx.memory.buffer);
  const outOff = sx.getOutOffset();
  const prfLen = eta * 64;
  const rate = 136;
  const prfInput = new Uint8Array(33);
  prfInput.set(sigma, 0);
  try {
    for (let i = 0;i < k; i++) {
      prfInput[32] = nonceStart + i;
      sx.shake256Init();
      sha3Absorb(sx, prfInput);
      sx.shakePad();
      let pos = 0;
      while (pos < prfLen) {
        sx.shakeSqueezeBlock();
        const take = Math.min(prfLen - pos, rate);
        kyberMem.set(sha3Mem.subarray(outOff, outOff + take), xofPrfOff + pos);
        pos += take;
      }
      kx.poly_getnoise(pvSlot + i * 512, xofPrfOff, eta);
    }
  } finally {
    wipe(prfInput);
  }
}
function noisePoly(kx, sx, polyOff, sigma, nonce, eta) {
  const xofPrfOff = kx.getXofPrfOffset();
  const kyberMem = new Uint8Array(kx.memory.buffer);
  const sha3Mem = new Uint8Array(sx.memory.buffer);
  const outOff = sx.getOutOffset();
  const prfLen = eta * 64;
  const rate = 136;
  const prfInput = new Uint8Array(33);
  prfInput.set(sigma, 0);
  prfInput[32] = nonce;
  try {
    sx.shake256Init();
    sha3Absorb(sx, prfInput);
    sx.shakePad();
    let pos = 0;
    while (pos < prfLen) {
      sx.shakeSqueezeBlock();
      const take = Math.min(prfLen - pos, rate);
      kyberMem.set(sha3Mem.subarray(outOff, outOff + take), xofPrfOff + pos);
      pos += take;
    }
    kx.poly_getnoise(polyOff, xofPrfOff, eta);
  } finally {
    wipe(prfInput);
  }
}
function indcpaKeypairDerand(kx, sx, params, d) {
  const { k, eta1 } = params;
  const gInput = new Uint8Array(33);
  gInput.set(d, 0);
  gInput[32] = k;
  const gOut = sha3_512Hash(sx, gInput);
  const rho = gOut.slice(0, 32);
  const sigma = gOut.slice(32, 64);
  const pvec0 = kx.getPolyvecSlot0();
  const pvec1 = kx.getPolyvecSlot1();
  const pvec2 = kx.getPolyvecSlot2();
  const pvec3 = kx.getPolyvecSlot3();
  const pkOff = kx.getPkOffset();
  const skOff = kx.getSkOffset();
  try {
    noisePolyvec(kx, sx, pvec1, k, sigma, 0, eta1);
    noisePolyvec(kx, sx, pvec2, k, sigma, k, eta1);
    kx.polyvec_ntt(pvec1, k);
    kx.polyvec_ntt(pvec2, k);
    const kyberMem = new Uint8Array(kx.memory.buffer);
    for (let i = 0;i < k; i++) {
      genMatrixRow(kx, sx, k, rho, false, pvec0, i);
      kx.polyvec_basemul_acc_montgomery(pvec3 + i * 512, pvec0, pvec1, k);
      kx.poly_tomont(pvec3 + i * 512);
    }
    kx.polyvec_add(pvec3, pvec3, pvec2, k);
    kx.polyvec_reduce(pvec3, k);
    kx.polyvec_tobytes(pkOff, pvec3, k);
    kyberMem.set(rho, pkOff + k * 384);
    kx.polyvec_tobytes(skOff, pvec1, k);
    return {
      ekCpa: kyberMem.slice(pkOff, pkOff + params.ekBytes),
      skCpa: kyberMem.slice(skOff, skOff + params.skCpaBytes)
    };
  } finally {
    wipe(sigma);
    wipe(gOut);
  }
}
function indcpaEncrypt(kx, sx, params, ek, m, coins) {
  const { k, eta1, eta2, du, dv } = params;
  const kyberMem = new Uint8Array(kx.memory.buffer);
  const pvec0 = kx.getPolyvecSlot0();
  const pvec1 = kx.getPolyvecSlot1();
  const pvec2 = kx.getPolyvecSlot2();
  const pvec3 = kx.getPolyvecSlot3();
  const pvec4 = kx.getPolyvecSlot4();
  const poly1 = kx.getPolySlot1();
  const poly2 = kx.getPolySlot2();
  const poly3 = kx.getPolySlot3();
  const pkOff = kx.getPkOffset();
  const ctOff = kx.getCtOffset();
  const msgOff = kx.getMsgOffset();
  kyberMem.set(ek, pkOff);
  kx.polyvec_frombytes(pvec4, pkOff, k);
  const rho = ek.slice(k * 384, k * 384 + 32);
  noisePolyvec(kx, sx, pvec1, k, coins, 0, eta1);
  noisePolyvec(kx, sx, pvec2, k, coins, k, eta2);
  noisePoly(kx, sx, poly1, coins, 2 * k, eta2);
  kx.polyvec_ntt(pvec1, k);
  for (let i = 0;i < k; i++) {
    genMatrixRow(kx, sx, k, rho, true, pvec0, i);
    kx.polyvec_basemul_acc_montgomery(pvec3 + i * 512, pvec0, pvec1, k);
  }
  kx.polyvec_invntt(pvec3, k);
  kx.polyvec_add(pvec3, pvec3, pvec2, k);
  kx.polyvec_reduce(pvec3, k);
  kx.polyvec_basemul_acc_montgomery(poly2, pvec4, pvec1, k);
  kx.poly_invntt(poly2);
  kyberMem.set(m, msgOff);
  kx.poly_frommsg(poly3, msgOff);
  kx.poly_add(poly2, poly2, poly1);
  kx.poly_add(poly2, poly2, poly3);
  kx.poly_reduce(poly2);
  const pvecCompBytes = k * du * 32;
  kx.polyvec_compress(ctOff, pvec3, k, du);
  kx.poly_compress(ctOff + pvecCompBytes, poly2, dv);
  return kyberMem.slice(ctOff, ctOff + params.ctBytes);
}
function indcpaDecrypt(kx, params, skCpa, ct) {
  const { k, du, dv } = params;
  const kyberMem = new Uint8Array(kx.memory.buffer);
  const pvec0 = kx.getPolyvecSlot0();
  const pvec1 = kx.getPolyvecSlot1();
  const poly0 = kx.getPolySlot0();
  const poly1 = kx.getPolySlot1();
  const poly2 = kx.getPolySlot2();
  const ctOff = kx.getCtOffset();
  const skOff = kx.getSkOffset();
  const msgOff = kx.getMsgOffset();
  kyberMem.set(ct, ctOff);
  kyberMem.set(skCpa, skOff);
  const pvecCompBytes = k * du * 32;
  kx.polyvec_decompress(pvec0, ctOff, k, du);
  kx.poly_decompress(poly0, ctOff + pvecCompBytes, dv);
  kx.polyvec_frombytes(pvec1, skOff, k);
  kx.polyvec_ntt(pvec0, k);
  kx.polyvec_basemul_acc_montgomery(poly1, pvec1, pvec0, k);
  kx.poly_invntt(poly1);
  kx.poly_sub(poly2, poly0, poly1);
  kx.poly_reduce(poly2);
  kx.poly_tomsg(msgOff, poly2);
  return kyberMem.slice(msgOff, msgOff + 32);
}

// node_modules/leviathan-crypto/dist/kyber/kem.js
function kemKeypairDerand(kx, sx, params, d, z) {
  const { ekCpa, skCpa } = indcpaKeypairDerand(kx, sx, params, d);
  const kyberMem = new Uint8Array(kx.memory.buffer);
  kyberMem.fill(0, kx.getSkOffset(), kx.getSkOffset() + params.skCpaBytes);
  kyberMem.fill(0, kx.getPolyvecSlot1(), kx.getPolyvecSlot1() + 2048);
  kyberMem.fill(0, kx.getPolyvecSlot2(), kx.getPolyvecSlot2() + 2048);
  kyberMem.fill(0, kx.getXofPrfOffset(), kx.getXofPrfOffset() + 1024);
  const h = sha3_256Hash(sx, ekCpa);
  try {
    const dk = new Uint8Array(params.dkBytes);
    dk.set(skCpa, 0);
    dk.set(ekCpa, params.skCpaBytes);
    dk.set(h, params.skCpaBytes + params.ekBytes);
    dk.set(z, params.skCpaBytes + params.ekBytes + 32);
    sx.wipeBuffers();
    return {
      encapsulationKey: ekCpa,
      decapsulationKey: dk
    };
  } finally {
    wipe(skCpa);
    wipe(h);
  }
}
function kemEncapsulateDerand(kx, sx, params, ek, m) {
  const h = sha3_256Hash(sx, ek);
  let gInput;
  let gOut;
  let r;
  try {
    gInput = new Uint8Array(64);
    gInput.set(m, 0);
    gInput.set(h, 32);
    gOut = sha3_512Hash(sx, gInput);
    const K = gOut.slice(0, 32);
    r = gOut.slice(32, 64);
    const c = indcpaEncrypt(kx, sx, params, ek, m, r);
    const kyberMem = new Uint8Array(kx.memory.buffer);
    kyberMem.fill(0, kx.getMsgOffset(), kx.getMsgOffset() + 32);
    kyberMem.fill(0, kx.getPolyvecSlot1(), kx.getPolyvecSlot1() + 2048);
    kyberMem.fill(0, kx.getPolyvecSlot2(), kx.getPolyvecSlot2() + 2048);
    kyberMem.fill(0, kx.getPolyvecSlot3(), kx.getPolyvecSlot3() + 2048);
    kyberMem.fill(0, kx.getPolySlot1(), kx.getPolySlot1() + 512);
    kyberMem.fill(0, kx.getPolySlot2(), kx.getPolySlot2() + 512);
    kyberMem.fill(0, kx.getPolySlot3(), kx.getPolySlot3() + 512);
    kyberMem.fill(0, kx.getXofPrfOffset(), kx.getXofPrfOffset() + 1024);
    sx.wipeBuffers();
    return { ciphertext: c, sharedSecret: K };
  } finally {
    if (gInput)
      wipe(gInput);
    if (gOut)
      wipe(gOut);
    if (r)
      wipe(r);
  }
}
function kemDecapsulate(kx, sx, params, dk, c) {
  const { skCpaBytes, ekBytes, ctBytes } = params;
  const skCpa = dk.slice(0, skCpaBytes);
  const ek = dk.slice(skCpaBytes, skCpaBytes + ekBytes);
  const h = dk.slice(skCpaBytes + ekBytes, skCpaBytes + ekBytes + 32);
  const z = dk.slice(skCpaBytes + ekBytes + 32, skCpaBytes + ekBytes + 64);
  let mPrime;
  let gInput;
  let gOut;
  let kPrime;
  let rPrime;
  let jInput;
  let kBar;
  let cPrime;
  try {
    mPrime = indcpaDecrypt(kx, params, skCpa, c);
    gInput = new Uint8Array(64);
    gInput.set(mPrime, 0);
    gInput.set(h, 32);
    gOut = sha3_512Hash(sx, gInput);
    kPrime = gOut.slice(0, 32);
    rPrime = gOut.slice(32, 64);
    jInput = new Uint8Array(32 + ctBytes);
    jInput.set(z, 0);
    jInput.set(c, 32);
    kBar = shake256Hash(sx, jInput, 32);
    cPrime = indcpaEncrypt(kx, sx, params, ek, mPrime, rPrime);
    const kyberMem = new Uint8Array(kx.memory.buffer);
    const ctOff = kx.getCtOffset();
    const ctPrimeOff = kx.getCtPrimeOffset();
    kyberMem.set(c, ctOff);
    kyberMem.set(cPrime, ctPrimeOff);
    const kPrimeOff = kx.getPolySlot0();
    const kBarOff = kx.getPolySlot1();
    kyberMem.set(kPrime, kPrimeOff);
    kyberMem.set(kBar, kBarOff);
    const fail = kx.ct_verify(ctOff, ctPrimeOff, ctBytes);
    kx.ct_cmov(kPrimeOff, kBarOff, 32, fail);
    const sharedSecret = kyberMem.slice(kPrimeOff, kPrimeOff + 32);
    kyberMem.fill(0, kx.getMsgOffset(), kx.getMsgOffset() + 32);
    kyberMem.fill(0, kPrimeOff, kPrimeOff + 32);
    kyberMem.fill(0, kBarOff, kBarOff + 512);
    kyberMem.fill(0, kx.getPolySlot2(), kx.getPolySlot2() + 512);
    kyberMem.fill(0, kx.getPolySlot3(), kx.getPolySlot3() + 512);
    kyberMem.fill(0, kx.getPolyvecSlot1(), kx.getPolyvecSlot1() + 2048);
    kyberMem.fill(0, kx.getPolyvecSlot2(), kx.getPolyvecSlot2() + 2048);
    kyberMem.fill(0, kx.getPolyvecSlot3(), kx.getPolyvecSlot3() + 2048);
    kyberMem.fill(0, kx.getXofPrfOffset(), kx.getXofPrfOffset() + 1024);
    kyberMem.fill(0, kx.getSkOffset(), kx.getSkOffset() + skCpaBytes);
    sx.wipeBuffers();
    return sharedSecret;
  } finally {
    if (mPrime)
      wipe(mPrime);
    if (gInput)
      wipe(gInput);
    if (gOut)
      wipe(gOut);
    if (kPrime)
      wipe(kPrime);
    if (rPrime)
      wipe(rPrime);
    if (jInput)
      wipe(jInput);
    if (kBar)
      wipe(kBar);
    if (cPrime)
      wipe(cPrime);
    wipe(skCpa);
    wipe(ek);
    wipe(h);
    wipe(z);
  }
}

// node_modules/leviathan-crypto/dist/kyber/validate.js
function checkEncapsulationKey(kx, params, ek) {
  if (ek.length !== params.ekBytes)
    return false;
  const { k } = params;
  const kyberMem = new Uint8Array(kx.memory.buffer);
  const pkOff = kx.getPkOffset();
  const pvecOff = kx.getPolyvecSlot0();
  kyberMem.set(ek.subarray(0, k * 384), pkOff);
  kx.polyvec_frombytes(pvecOff, pkOff, k);
  return kx.polyvec_modulus_check(pvecOff, k) === 0;
}
function checkDecapsulationKey(kx, sx, params, dk) {
  if (dk.length !== params.dkBytes)
    return false;
  const { skCpaBytes, ekBytes } = params;
  const ek = dk.slice(skCpaBytes, skCpaBytes + ekBytes);
  const h = dk.slice(skCpaBytes + ekBytes, skCpaBytes + ekBytes + 32);
  try {
    const hComputed = sha3_256Hash(sx, ek);
    if (!constantTimeEqual(hComputed, h))
      return false;
    return checkEncapsulationKey(kx, params, ek);
  } finally {
    sx.wipeBuffers();
  }
}

// node_modules/leviathan-crypto/dist/kyber/index.js
async function kyberInit(source) {
  return initModule("kyber", source);
}
function assertLayout(kx, p) {
  const pk = kx.getPkOffset();
  const sk = kx.getSkOffset();
  const ct = kx.getCtOffset();
  const ctPrime = kx.getCtPrimeOffset();
  const xof = kx.getXofPrfOffset();
  if (pk + p.ekBytes > sk)
    throw new Error("leviathan-crypto: kyber buffer overflow — ek overflows into SK region");
  if (sk + p.skCpaBytes > ct)
    throw new Error("leviathan-crypto: kyber buffer overflow — sk overflows into CT region");
  if (ct + p.ctBytes > ctPrime)
    throw new Error("leviathan-crypto: kyber buffer overflow — ct overflows into CT_PRIME region");
  if (ctPrime + p.ctBytes > xof)
    throw new Error("leviathan-crypto: kyber buffer overflow — ct_prime overflows into XOF region");
}

class MlKemBase {
  params;
  constructor(params) {
    if (!isInitialized("kyber"))
      throw new Error("leviathan-crypto: call init({ kyber: ... }) before using MlKem classes");
    if (!isInitialized("sha3"))
      throw new Error("leviathan-crypto: call init({ sha3: ... }) before using MlKem classes");
    this.params = params;
    assertLayout(this.kx, params);
  }
  get kx() {
    return getInstance("kyber").exports;
  }
  get sx() {
    return getInstance("sha3").exports;
  }
  keygenDerand(d, z) {
    _assertNotOwned("sha3");
    _assertNotOwned("kyber");
    if (d.length !== 32)
      throw new RangeError(`d seed must be 32 bytes (got ${d.length})`);
    if (z.length !== 32)
      throw new RangeError(`z seed must be 32 bytes (got ${z.length})`);
    return kemKeypairDerand(this.kx, this.sx, this.params, d, z);
  }
  keygen() {
    const d = randomBytes(32);
    const z = randomBytes(32);
    try {
      return this.keygenDerand(d, z);
    } finally {
      wipe(d);
      wipe(z);
    }
  }
  encapsulateDerand(ek, m) {
    _assertNotOwned("sha3");
    _assertNotOwned("kyber");
    if (ek.length !== this.params.ekBytes)
      throw new RangeError(`encapsulation key must be ${this.params.ekBytes} bytes (got ${ek.length})`);
    if (m.length !== 32)
      throw new RangeError(`randomness m must be 32 bytes (got ${m.length})`);
    if (!checkEncapsulationKey(this.kx, this.params, ek))
      throw new RangeError("leviathan-crypto: encapsulation key failed FIPS 203 §7.2 validity check");
    return kemEncapsulateDerand(this.kx, this.sx, this.params, ek, m);
  }
  encapsulate(ek) {
    const m = randomBytes(32);
    try {
      return this.encapsulateDerand(ek, m);
    } finally {
      wipe(m);
    }
  }
  decapsulate(dk, c) {
    _assertNotOwned("sha3");
    _assertNotOwned("kyber");
    if (dk.length !== this.params.dkBytes)
      throw new RangeError(`decapsulation key must be ${this.params.dkBytes} bytes (got ${dk.length})`);
    if (c.length !== this.params.ctBytes)
      throw new RangeError(`ciphertext must be ${this.params.ctBytes} bytes (got ${c.length})`);
    if (!checkDecapsulationKey(this.kx, this.sx, this.params, dk))
      throw new RangeError("leviathan-crypto: decapsulation key failed FIPS 203 §7.3 validity check");
    return kemDecapsulate(this.kx, this.sx, this.params, dk, c);
  }
  checkEncapsulationKey(ek) {
    _assertNotOwned("sha3");
    _assertNotOwned("kyber");
    return checkEncapsulationKey(this.kx, this.params, ek);
  }
  checkDecapsulationKey(dk) {
    _assertNotOwned("sha3");
    _assertNotOwned("kyber");
    return checkDecapsulationKey(this.kx, this.sx, this.params, dk);
  }
  dispose() {
    this.kx.wipeBuffers();
  }
}

class MlKem512 extends MlKemBase {
  constructor() {
    super(MLKEM512);
  }
}

class MlKem768 extends MlKemBase {
  constructor() {
    super(MLKEM768);
  }
}

class MlKem1024 extends MlKemBase {
  constructor() {
    super(MLKEM1024);
  }
}
// node_modules/leviathan-crypto/dist/index.js
var _dispatchers = {
  serpent: serpentInit,
  chacha20: chacha20Init,
  sha2: sha2Init,
  sha3: sha3Init,
  keccak: keccakInit,
  kyber: kyberInit
};
async function init(sources) {
  const entries = Object.entries(sources);
  if ((("serpent" in sources) || ("chacha20" in sources) || ("kyber" in sources)) && !hasSIMD())
    throw new Error("leviathan-crypto: serpent, chacha20, and kyber require WebAssembly SIMD — " + "this runtime does not support it");
  for (const [mod, src] of entries) {
    if (!Object.hasOwn(_dispatchers, mod))
      throw new Error(`leviathan-crypto: unknown module "${mod}" — expected one of: ${Object.keys(_dispatchers).join(", ")}`);
    if (src == null)
      throw new TypeError(`leviathan-crypto: source for "${mod}" is null or undefined`);
  }
  await Promise.all(entries.map(([mod, src]) => _dispatchers[mod](src)));
}

// node_modules/leviathan-crypto/dist/embedded/kyber.js
var WASM_GZ_BASE64 = "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";
// node_modules/leviathan-crypto/dist/embedded/sha3.js
var WASM_GZ_BASE642 = "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";
// node_modules/leviathan-crypto/dist/embedded/chacha20.js
var WASM_GZ_BASE643 = "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";
// node_modules/leviathan-crypto/dist/embedded/sha2.js
var WASM_GZ_BASE644 = "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";
// leviathan.kyber-entry.ts
await init({ kyber: WASM_GZ_BASE64, sha3: WASM_GZ_BASE642, chacha20: WASM_GZ_BASE643, sha2: WASM_GZ_BASE644 });
export {
  randomBytes,
  bytesToHex,
  XChaCha20Poly1305,
  MlKem768,
  MlKem512,
  MlKem1024,
  HKDF_SHA256
};
