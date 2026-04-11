// ../../../leviathan-crypto/dist/ct-wasm.js
var CT_WASM = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 8, 1, 96, 3, 127, 127, 127, 1, 127, 2, 16, 1, 3, 101, 110, 118, 6, 109, 101, 109, 111, 114, 121, 2, 1, 1, 1, 3, 2, 1, 0, 7, 20, 2, 7, 99, 111, 109, 112, 97, 114, 101, 0, 0, 6, 109, 101, 109, 111, 114, 121, 2, 0, 10, 111, 1, 109, 2, 3, 127, 1, 123, 3, 64, 32, 3, 65, 16, 106, 34, 4, 32, 2, 76, 4, 64, 32, 6, 32, 0, 32, 3, 106, 253, 0, 4, 0, 32, 1, 32, 3, 106, 253, 0, 4, 0, 253, 81, 253, 80, 33, 6, 32, 4, 33, 3, 12, 1, 11, 11, 3, 64, 32, 2, 32, 3, 74, 4, 64, 32, 5, 32, 0, 32, 3, 106, 45, 0, 0, 32, 1, 32, 3, 106, 45, 0, 0, 115, 114, 33, 5, 32, 3, 65, 1, 106, 33, 3, 12, 1, 11, 11, 32, 6, 253, 83, 4, 64, 65, 0, 15, 11, 32, 5, 69, 11]);

// ../../../leviathan-crypto/dist/utils.js
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
    return;
  if (rem === 2)
    b64 += "==";
  if (rem === 3)
    b64 += "=";
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64))
    return;
  let strlen = b64.length / 4 * 3;
  if (b64.charAt(b64.length - 1) === "=")
    strlen--;
  if (b64.charAt(b64.length - 2) === "=")
    strlen--;
  if (typeof atob !== "undefined") {
    try {
      return new Uint8Array(atob(b64).split("").map((c) => c.charCodeAt(0)));
    } catch {
      return;
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
var CT_MAX_BYTES = 32768;
function _initCt() {
  if (_ctInit)
    return _ctCompare !== null;
  _ctInit = true;
  try {
    if (!hasSIMD())
      return false;
    _ctMem = new WebAssembly.Memory({ initial: 1, maximum: 1 });
    const buf = CT_WASM.buffer.slice(CT_WASM.byteOffset, CT_WASM.byteOffset + CT_WASM.byteLength);
    const mod = new WebAssembly.Module(buf);
    const inst = new WebAssembly.Instance(mod, { env: { memory: _ctMem } });
    _ctCompare = inst.exports.compare;
    return true;
  } catch {
    return false;
  }
}
var constantTimeEqual = (a, b) => {
  if (a.length !== b.length)
    return false;
  if (a.length > CT_MAX_BYTES)
    throw new RangeError(`constantTimeEqual: max ${CT_MAX_BYTES} bytes (got ${a.length})`);
  if (_initCt() && _ctMem && _ctCompare) {
    const mem = new Uint8Array(_ctMem.buffer);
    mem.set(a, 0);
    mem.set(b, a.length);
    try {
      return _ctCompare(0, a.length, a.length) === 1;
    } finally {
      mem.fill(0, 0, a.length * 2);
    }
  }
  let diff = 0;
  for (let i = 0;i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
};
var randomBytes = (n) => {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
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

// ../../../leviathan-crypto/dist/loader.js
function makeImports() {
  return { env: { memory: new WebAssembly.Memory({ initial: 3, maximum: 3 }) } };
}
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
  if (!compressed)
    throw new Error("leviathan-crypto: corrupt embedded WASM — base64 decode failed");
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
async function loadWasm(source) {
  if (typeof source === "string") {
    if (source.length === 0)
      throw new TypeError("leviathan-crypto: invalid WasmSource — empty string");
    return (await WebAssembly.instantiate(toArrayBuffer(await decodeWasm(source)), makeImports())).instance;
  }
  if (source instanceof URL)
    return (await WebAssembly.instantiateStreaming(fetch(source.href), makeImports())).instance;
  if (source instanceof ArrayBuffer)
    return (await WebAssembly.instantiate(source, makeImports())).instance;
  if (source instanceof Uint8Array)
    return (await WebAssembly.instantiate(toArrayBuffer(source), makeImports())).instance;
  if (source instanceof WebAssembly.Module)
    return WebAssembly.instantiate(source, makeImports());
  if (typeof Response !== "undefined" && source instanceof Response)
    return (await WebAssembly.instantiateStreaming(source, makeImports())).instance;
  if (source != null && typeof source.then === "function")
    return (await WebAssembly.instantiateStreaming(source, makeImports())).instance;
  throw new TypeError(`leviathan-crypto: invalid WasmSource — got ${source === null ? "null" : typeof source}`);
}

// ../../../leviathan-crypto/dist/init.js
var ALIASES = { keccak: "sha3" };
function resolve(mod) {
  return ALIASES[mod] ?? mod;
}
var instances = new Map;
async function initModule(mod, source) {
  const resolved = resolve(mod);
  if (instances.has(resolved))
    return;
  if ((resolved === "serpent" || resolved === "chacha20" || resolved === "kyber") && !hasSIMD())
    throw new Error("leviathan-crypto: serpent, chacha20, and kyber require WebAssembly SIMD — " + "this runtime does not support it");
  instances.set(resolved, await loadWasm(source));
}
function getInstance(mod) {
  const inst = instances.get(resolve(mod));
  if (!inst) {
    throw new Error(`leviathan-crypto: call init({ ${mod}: ... }) before using this class`);
  }
  return inst;
}

// ../../../leviathan-crypto/dist/errors.js
class AuthenticationError extends Error {
  constructor(cipher) {
    super(`${cipher}: authentication failed`);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

// ../../../leviathan-crypto/dist/sha2/index.js
async function sha2Init(source) {
  return initModule("sha2", source);
}

// ../../../leviathan-crypto/dist/serpent/index.js
async function serpentInit(source) {
  return initModule("serpent", source);
}

// ../../../leviathan-crypto/dist/chacha20/ops.js
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
  x.chachaLoadKey();
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

// ../../../leviathan-crypto/dist/chacha20/index.js
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
    if (key.length !== 32)
      throw new RangeError(`key must be 32 bytes (got ${key.length})`);
    if (nonce.length !== 24)
      throw new RangeError(`XChaCha20 nonce must be 24 bytes (got ${nonce.length})`);
    const result = xcEncrypt(this.x, key, nonce, plaintext, aad);
    this._used = true;
    return result;
  }
  decrypt(key, nonce, ciphertext, aad = new Uint8Array(0)) {
    if (key.length !== 32)
      throw new RangeError(`key must be 32 bytes (got ${key.length})`);
    if (nonce.length !== 24)
      throw new RangeError(`XChaCha20 nonce must be 24 bytes (got ${nonce.length})`);
    if (ciphertext.length < 16)
      throw new RangeError(`ciphertext too short — must include 16-byte tag (got ${ciphertext.length})`);
    return xcDecrypt(this.x, key, nonce, ciphertext, aad);
  }
  dispose() {
    this.x.wipeBuffers();
  }
}

// ../../../leviathan-crypto/dist/sha3/index.js
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
  constructor() {
    this.x = getExports2();
    this.x.shake128Init();
  }
  reset() {
    this.x.shake128Init();
    this._squeezing = false;
    this._block.fill(0);
    this._blockPos = this._rate;
    return this;
  }
  absorb(msg) {
    if (this._squeezing)
      throw new Error("SHAKE128: cannot absorb after squeeze — call reset() first");
    absorb(this.x, msg);
    return this;
  }
  squeeze(n) {
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
    if (outputLength < 1)
      throw new RangeError(`outputLength must be >= 1 (got ${outputLength})`);
    this.reset();
    this.absorb(msg);
    return this.squeeze(outputLength);
  }
  dispose() {
    this._block.fill(0);
    this.x.wipeBuffers();
  }
}

class SHAKE256 {
  x;
  _rate = 136;
  _squeezing = false;
  _block = new Uint8Array(136);
  _blockPos = 136;
  constructor() {
    this.x = getExports2();
    this.x.shake256Init();
  }
  reset() {
    this.x.shake256Init();
    this._squeezing = false;
    this._block.fill(0);
    this._blockPos = this._rate;
    return this;
  }
  absorb(msg) {
    if (this._squeezing)
      throw new Error("SHAKE256: cannot absorb after squeeze — call reset() first");
    absorb(this.x, msg);
    return this;
  }
  squeeze(n) {
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
    if (outputLength < 1)
      throw new RangeError(`outputLength must be >= 1 (got ${outputLength})`);
    this.reset();
    this.absorb(msg);
    return this.squeeze(outputLength);
  }
  dispose() {
    this._block.fill(0);
    this.x.wipeBuffers();
  }
}

// ../../../leviathan-crypto/dist/keccak/index.js
async function keccakInit(source) {
  return initModule("keccak", source);
}

// ../../../leviathan-crypto/dist/kyber/index.js
async function kyberInit(source) {
  return initModule("kyber", source);
}
// ../../../leviathan-crypto/dist/index.js
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

// ../../../leviathan-crypto/dist/embedded/chacha20.js
var WASM_GZ_BASE64 = "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";
// ../../../leviathan-crypto/dist/embedded/sha2.js
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
