// node_modules/leviathan-crypto/dist/ct-wasm.js
var CT_WASM = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 8, 1, 96, 3, 127, 127, 127, 1, 127, 2, 16, 1, 3, 101, 110, 118, 6, 109, 101, 109, 111, 114, 121, 2, 1, 1, 1, 3, 2, 1, 0, 7, 20, 2, 7, 99, 111, 109, 112, 97, 114, 101, 0, 0, 6, 109, 101, 109, 111, 114, 121, 2, 0, 10, 111, 1, 109, 2, 3, 127, 1, 123, 3, 64, 32, 3, 65, 16, 106, 34, 4, 32, 2, 76, 4, 64, 32, 6, 32, 0, 32, 3, 106, 253, 0, 4, 0, 32, 1, 32, 3, 106, 253, 0, 4, 0, 253, 81, 253, 80, 33, 6, 32, 4, 33, 3, 12, 1, 11, 11, 3, 64, 32, 2, 32, 3, 74, 4, 64, 32, 5, 32, 0, 32, 3, 106, 45, 0, 0, 32, 1, 32, 3, 106, 45, 0, 0, 115, 114, 33, 5, 32, 3, 65, 1, 106, 33, 3, 12, 1, 11, 11, 32, 6, 253, 83, 4, 64, 65, 0, 15, 11, 32, 5, 69, 11]);

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
var wipe = (data) => {
  data.fill(0);
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

// node_modules/leviathan-crypto/dist/loader.js
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

// node_modules/leviathan-crypto/dist/init.js
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
function isInitialized(mod) {
  return instances.has(resolve(mod));
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
  constructor() {
    this.x = getExports3();
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
    this.x = getExports3();
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
  const h = sha3_256Hash(sx, ekCpa);
  try {
    const dk = new Uint8Array(params.dkBytes);
    dk.set(skCpa, 0);
    dk.set(ekCpa, params.skCpaBytes);
    dk.set(h, params.skCpaBytes + params.ekBytes);
    dk.set(z, params.skCpaBytes + params.ekBytes + 32);
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
    return kyberMem.slice(kPrimeOff, kPrimeOff + 32);
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
  const skOff = kx.getSkOffset();
  const pvecOff = kx.getPolyvecSlot0();
  kyberMem.set(ek.subarray(0, k * 384), pkOff);
  kx.polyvec_frombytes(pvecOff, pkOff, k);
  kx.polyvec_tobytes(skOff, pvecOff, k);
  const mismatch = kx.ct_verify(pkOff, skOff, k * 384);
  return mismatch === 0;
}
function checkDecapsulationKey(kx, sx, params, dk) {
  if (dk.length !== params.dkBytes)
    return false;
  const { skCpaBytes, ekBytes } = params;
  const ek = dk.slice(skCpaBytes, skCpaBytes + ekBytes);
  const h = dk.slice(skCpaBytes + ekBytes, skCpaBytes + ekBytes + 32);
  const hComputed = sha3_256Hash(sx, ek);
  if (!constantTimeEqual(hComputed, h))
    return false;
  return checkEncapsulationKey(kx, params, ek);
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
    if (ek.length !== this.params.ekBytes)
      throw new RangeError(`encapsulation key must be ${this.params.ekBytes} bytes (got ${ek.length})`);
    if (m.length !== 32)
      throw new RangeError(`randomness m must be 32 bytes (got ${m.length})`);
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
    if (dk.length !== this.params.dkBytes)
      throw new RangeError(`decapsulation key must be ${this.params.dkBytes} bytes (got ${dk.length})`);
    if (c.length !== this.params.ctBytes)
      throw new RangeError(`ciphertext must be ${this.params.ctBytes} bytes (got ${c.length})`);
    return kemDecapsulate(this.kx, this.sx, this.params, dk, c);
  }
  checkEncapsulationKey(ek) {
    return checkEncapsulationKey(this.kx, this.params, ek);
  }
  checkDecapsulationKey(dk) {
    return checkDecapsulationKey(this.kx, this.sx, this.params, dk);
  }
  dispose() {
    this.kx.wipeBuffers();
    this.sx.wipeBuffers();
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
