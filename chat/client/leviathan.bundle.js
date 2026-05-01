// ../node_modules/leviathan-crypto/dist/ct-wasm.js
var CT_WASM = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 8, 1, 96, 3, 127, 127, 127, 1, 127, 3, 2, 1, 0, 5, 4, 1, 1, 1, 1, 7, 20, 2, 7, 99, 111, 109, 112, 97, 114, 101, 0, 0, 6, 109, 101, 109, 111, 114, 121, 2, 0, 10, 133, 1, 1, 130, 1, 3, 2, 127, 1, 126, 1, 123, 3, 64, 32, 3, 65, 16, 106, 34, 4, 32, 2, 76, 4, 64, 32, 6, 32, 0, 32, 3, 106, 253, 0, 4, 0, 32, 1, 32, 3, 106, 253, 0, 4, 0, 253, 81, 253, 80, 33, 6, 32, 4, 33, 3, 12, 1, 11, 11, 3, 64, 32, 2, 32, 3, 74, 4, 64, 32, 5, 32, 0, 32, 3, 106, 49, 0, 0, 32, 1, 32, 3, 106, 49, 0, 0, 133, 132, 33, 5, 32, 3, 65, 1, 106, 33, 3, 12, 1, 11, 11, 66, 0, 32, 5, 32, 6, 253, 29, 0, 32, 6, 253, 29, 1, 132, 132, 34, 5, 125, 32, 5, 132, 66, 63, 135, 66, 127, 133, 167, 65, 1, 113, 11]);

// ../node_modules/leviathan-crypto/dist/utils.js
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
var bytesToBase64 = (bytes, url = false) => {
  if (typeof btoa !== "undefined") {
    const raw = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
    return url ? raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "") : raw;
  }
  const table = url ? "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";
  for (let i = 0;i < bytes.length; ) {
    const a = i < bytes.length ? bytes[i] : 0;
    i++;
    const b = i < bytes.length ? bytes[i] : 0;
    i++;
    const c = i < bytes.length ? bytes[i] : 0;
    i++;
    const triple = (a << 16) + (b << 8) + c;
    base64 += table.charAt(triple >>> 18 & 63);
    base64 += table.charAt(triple >>> 12 & 63);
    base64 += i < bytes.length + 2 ? table.charAt(triple >>> 6 & 63) : url ? "" : "=";
    base64 += i < bytes.length + 1 ? table.charAt(triple & 63) : url ? "" : "=";
  }
  return base64;
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

// ../node_modules/leviathan-crypto/dist/loader.js
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

// ../node_modules/leviathan-crypto/dist/init.js
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

// ../node_modules/leviathan-crypto/dist/errors.js
class AuthenticationError extends Error {
  constructor(cipher) {
    super(`${cipher}: authentication failed`);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

// ../node_modules/leviathan-crypto/dist/sha2/index.js
async function sha2Init(source) {
  return initModule("sha2", source);
}

// ../node_modules/leviathan-crypto/dist/serpent/index.js
async function serpentInit(source) {
  return initModule("serpent", source);
}

// ../node_modules/leviathan-crypto/dist/chacha20/ops.js
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

// ../node_modules/leviathan-crypto/dist/chacha20/index.js
async function chacha20Init(source) {
  return initModule("chacha20", source);
}
function getExports() {
  return getInstance("chacha20").exports;
}
class XChaCha20Poly1305 {
  x;
  _used = false;
  constructor() {
    this.x = getExports();
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

// ../node_modules/leviathan-crypto/dist/sha3/index.js
async function sha3Init(source) {
  return initModule("sha3", source);
}
function getExports2() {
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
    this.x = getExports2();
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
    this.x = getExports2();
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

// ../node_modules/leviathan-crypto/dist/keccak/index.js
async function keccakInit(source) {
  return initModule("keccak", source);
}

// ../node_modules/leviathan-crypto/dist/kyber/index.js
async function kyberInit(source) {
  return initModule("kyber", source);
}
// ../node_modules/leviathan-crypto/dist/index.js
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

// ../node_modules/leviathan-crypto/dist/embedded/chacha20.js
var WASM_GZ_BASE64 = "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";
// ../node_modules/leviathan-crypto/dist/embedded/sha2.js
var WASM_GZ_BASE642 = "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";
// leviathan.chat-entry.ts
await init({ chacha20: WASM_GZ_BASE64, sha2: WASM_GZ_BASE642 });
export {
  randomBytes,
  WASM_GZ_BASE64 as chacha20Wasm,
  bytesToHex,
  bytesToBase64,
  base64ToBytes,
  XChaCha20Poly1305
};
