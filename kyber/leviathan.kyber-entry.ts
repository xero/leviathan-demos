// leviathan.kyber-entry.ts: leviathan-crypto exports for leviathan-kyber-demo bundle.

import { init, MlKem512, MlKem768, MlKem1024, HKDF_SHA256,
	XChaCha20Poly1305, randomBytes, bytesToHex } from 'leviathan-crypto';
import { mlkemWasm }    from 'leviathan-crypto/mlkem/embedded';
import { sha3Wasm }     from 'leviathan-crypto/sha3/embedded';
import { chacha20Wasm } from 'leviathan-crypto/chacha20/embedded';
import { sha2Wasm }     from 'leviathan-crypto/sha2/embedded';

await init({ mlkem: mlkemWasm, sha3: sha3Wasm, chacha20: chacha20Wasm, sha2: sha2Wasm });

export { MlKem512, MlKem768, MlKem1024, HKDF_SHA256, XChaCha20Poly1305, randomBytes, bytesToHex };
