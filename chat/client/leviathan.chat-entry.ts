import { init, } from 'leviathan-crypto';
import { chacha20Wasm } from 'leviathan-crypto/chacha20/embedded';
import { sha2Wasm } from 'leviathan-crypto/sha2/embedded';

await init({ chacha20: chacha20Wasm, sha2: sha2Wasm });

export { chacha20Wasm };
export { XChaCha20Poly1305, bytesToHex, bytesToBase64, base64ToBytes, randomBytes } from 'leviathan-crypto';
