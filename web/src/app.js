// Initialize leviathan-crypto WASM modules + argon2id WASM
await init(['serpent', 'sha2']);
const hashArgon2id = await loadArgon2id();

// Argon2id OWASP 2023 minimum: 19 MiB, 2 passes, 1 thread
const ARGON2_MEMORY      = 19456;
const ARGON2_PASSES      = 2;
const ARGON2_PARALLELISM = 1;

// ============================================================
// LVTHN WEB FORMAT v2 SPECIFICATION
// ===================================
// Binary blob layout:
//   [ magic:   4 bytes ] "LVWB" (0x4c, 0x56, 0x57, 0x42)
//   [ version: 1 byte  ] 0x02
//   [ kdf:     1 byte  ] 0x02=keyfile, 0x03=argon2id-passphrase
//   [ salt:    32 bytes] Argon2id salt (zeroed for keyfile mode)
//   [ sealed:  N bytes ] SerpentSeal output — IV(16) || ciphertext || HMAC(32)
//
// Header size: 38 bytes (4+1+1+32). No separate IV or HMAC fields — SerpentSeal owns those.
//
// Key derivation:
//   Passphrase  → Argon2id → 64 bytes (tagLength: 64)
//   Keyfile     → HKDF-SHA256(keyfileBytes, salt=zero32, info="lvthn-v2-key") → 64 bytes
//   Generate    → 64 random bytes from WebCrypto
//
// Armored (text) output:
//   -----BEGIN LVTHN ENCRYPTED MESSAGE-----
//   <base64, 64 chars/line>
//   -----END LVTHN ENCRYPTED MESSAGE-----
//
// File output: raw binary blob, .lvthn extension
// ============================================================

// ── Format constants ──────────────────────────────────────
const HEADER_SIZE    = 38;
const OFF_MAGIC      = 0;   // 4 bytes
const OFF_VERSION    = 4;   // 1 byte
const OFF_KDF        = 5;   // 1 byte
const OFF_SALT       = 6;   // 32 bytes
const OFF_SEALED     = 38;  // N bytes — SerpentSeal output

const MAGIC          = [0x4c, 0x56, 0x57, 0x42]; // "LVWB"
const FORMAT_VERSION = 0x02;
const KDF_KEYFILE    = 0x02;
const KDF_ARGON2ID   = 0x03;

const ARMOR_BEGIN = '-----BEGIN LVTHN ENCRYPTED MESSAGE-----';
const ARMOR_END   = '-----END LVTHN ENCRYPTED MESSAGE-----';

// ── DOM Helper ────────────────────────────────────────────
function $(i) { return document.getElementById(i); }

// ── Format encode/decode ──────────────────────────────────
function encodeBlob(kdf, salt, sealed) {
	const buf = new Uint8Array(HEADER_SIZE + sealed.length);
	buf[OFF_MAGIC]   = MAGIC[0]; buf[1] = MAGIC[1]; buf[2] = MAGIC[2]; buf[3] = MAGIC[3];
	buf[OFF_VERSION] = FORMAT_VERSION;
	buf[OFF_KDF]     = kdf;
	buf.set(salt,   OFF_SALT);
	buf.set(sealed, OFF_SEALED);
	return buf;
}

function decodeBlob(blob) {
	if (blob.length < HEADER_SIZE) throw new Error('file too short to be a valid LVTHN file');
	if (blob[0] !== MAGIC[0] || blob[1] !== MAGIC[1] || blob[2] !== MAGIC[2] || blob[3] !== MAGIC[3]) {
		throw new Error('not an LVTHN file (magic bytes mismatch)');
	}
	if (blob[OFF_VERSION] !== FORMAT_VERSION) throw new Error('unsupported format version');
	const kdf = blob[OFF_KDF];
	if (kdf !== KDF_KEYFILE && kdf !== KDF_ARGON2ID) throw new Error('unsupported KDF');
	return {
		kdf,
		salt:   blob.slice(OFF_SALT,   OFF_SALT + 32),
		sealed: blob.slice(OFF_SEALED),
	};
}

function isArmored(data) {
	const prefix = new TextDecoder().decode(data.slice(0, ARMOR_BEGIN.length));
	return prefix === ARMOR_BEGIN;
}

// Chunk-based btoa to avoid call-stack overflow on large inputs
function uint8ToBase64(bytes) {
	let binary = '';
	const chunk = 8192;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

function armorBlob(blob) {
	const b64 = uint8ToBase64(blob);
	const lines = [];
	for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
	return `${ARMOR_BEGIN}\n${lines.join('\n')}\n${ARMOR_END}\n`;
}

function dearmorBlob(text) {
	const lines = text.trim().split('\n');
	if (lines[0].trim() !== ARMOR_BEGIN) throw new Error('missing armor header');
	const endIdx = lines.findIndex(l => l.trim() === ARMOR_END);
	if (endIdx === -1) throw new Error('missing armor footer');
	const b64 = lines.slice(1, endIdx).join('');
	const binary = atob(b64);
	const result = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
	return result;
}

// ── Crypto ───────────────────────────────────────────────
// SerpentSeal: Serpent-256-CBC + HMAC-SHA256 (Encrypt-then-MAC), 64-byte key
function sealEncrypt(key64, plaintext) {
	const s = new SerpentSeal();
	try { return s.encrypt(key64, plaintext); }
	finally { s.dispose(); }
}
function sealDecrypt(key64, sealed) {
	const s = new SerpentSeal();
	try { return s.decrypt(key64, sealed); }
	finally { s.dispose(); }
}

// HKDF-SHA256: expand any keyfile to 64 bytes
function deriveKeyfileKey(keyfileBytes) {
	const h = new HKDF_SHA256();
	try {
		return h.derive(keyfileBytes, new Uint8Array(32), utf8ToBytes('lvthn-v2-key'), 64);
	} finally {
		h.dispose();
	}
}

// ── Application state ─────────────────────────────────────
const state = {
	mode:     'encrypt',    // 'encrypt' | 'decrypt'
	revealed: false,         // false = initial hero; true = workspace

	inputType:  'text',       // 'text' | 'file'
	keyType:    'passphrase', // 'passphrase' | 'keyfile' | 'generate'

	inputText:  '',
	inputFile:  null,

	passphrase:   '',
	keyfileData:  null,       // { name, bytes }
	keyInputMode: 'file',    // 'file' | 'hex'
	keyHexInput:  '',
	keyHexError:  '',

	keygenBytes: null,        // Uint8Array (64 bytes)

	outputBlob:    null,
	outputArmored: '',
	outputText:    '',
	outputFilename: '',
	outputSrcSize:  0,

	status:   'idle',        // 'idle' | 'working' | 'done' | 'error'
	errorMsg: '',
	showPP:   false,
	dlFormat: 'armored',     // 'armored' | 'binary'
};

// ── Helpers ───────────────────────────────────────────────
function fmtSize(n) {
	if (n < 1024) return `${n} B`;
	if (n < 1048576) return `${(n/1024).toFixed(1)} KB`;
	return `${(n/1048576).toFixed(1)} MB`;
}

function parseKeyHex(hex) {
	const h = hex.trim().toLowerCase();
	if (h.length === 0) return { error: 'empty' };
	if (h.length % 2 !== 0) return { error: 'odd number of hex characters' };
	if (!/^[0-9a-f]+$/.test(h)) return { error: 'invalid hex characters' };
	return { bytes: hexToBytes(h) };
}

function readFileBytes(file) {
	return new Promise((res, rej) => {
		const fr = new FileReader();
		fr.onload = () => res(new Uint8Array(fr.result));
		fr.onerror = rej;
		fr.readAsArrayBuffer(file);
	});
}

function downloadBytes(bytes, filename, mime = 'application/octet-stream') {
	const blob = new Blob([bytes], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url; a.download = filename; a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(text, filename) {
	const blob = new Blob([text], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url; a.download = filename; a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text, btn) {
	try {
		await navigator.clipboard.writeText(text);
		const orig = btn.textContent;
		btn.textContent = 'COPIED ✓';
		setTimeout(() => { btn.textContent = orig; }, 2000);
	} catch (_) {
		btn.textContent = 'COPY FAILED';
		setTimeout(() => { btn.textContent = 'COPY'; }, 2000);
	}
}

// ── Validation ─────────────────────────────────────────────
function getActionHint() {
	const noInput = state.inputType === 'text' ? !state.inputText.trim() : !state.inputFile;
	if (noInput) return 'no input';
	if (state.keyType === 'passphrase' && !state.passphrase) return 'no key';
	if (state.keyType === 'keyfile' && !state.keyfileData) return 'no key';
	if (state.keyType === 'generate' && !state.keygenBytes) return 'click generate first';
	return null;
}

// ── Render ────────────────────────────────────────────────
function render() {
	const enc = state.mode === 'encrypt';

	// Progressive reveal
	$('mode-select').classList.toggle('hidden', state.revealed);
	$('workspace').classList.toggle('hidden', !state.revealed);

	// Mode buttons (compact header toggle)
	$('btn-encrypt').classList.toggle('active', enc);
	$('btn-decrypt').classList.toggle('active', !enc);

	// Generate Key option: only in encrypt mode
	$('lbl-gen').classList.toggle('hidden', !enc);
	if (!enc && state.keyType === 'generate') {
		state.keyType = 'passphrase';
		document.querySelector('input[name=ktype][value=passphrase]').checked = true;
	}

	// Key radio labels styling
	document.querySelectorAll('.key-radio-label').forEach(lbl => {
		const val = lbl.querySelector('input').value;
		lbl.classList.toggle('checked', val === state.keyType);
	});

	// Input sections
	$('sec-text-input').classList.toggle('hidden', state.inputType !== 'text');
	$('sec-file-input').classList.toggle('hidden', state.inputType !== 'file');
	$('tab-text').classList.toggle('active', state.inputType === 'text');
	$('tab-file').classList.toggle('active', state.inputType === 'file');

	// Textarea placeholder
	$('input-text').placeholder = enc ? 'paste text or type message...' : 'paste encrypted message...';

	// Key sections
	$('sec-passphrase').classList.toggle('hidden', state.keyType !== 'passphrase');
	$('sec-keyfile').classList.toggle('hidden', state.keyType !== 'keyfile');
	$('sec-generate').classList.toggle('hidden', state.keyType !== 'generate');

	// Passphrase show/hide
	const ppField = $('pp-input');
	ppField.type = state.showPP ? 'text' : 'password';
	$('btn-show-pp').textContent = state.showPP ? '[hide]' : '[show]';

	// Passphrase strength (encrypt only)
	const strengthEl = $('pp-strength');
	if (enc && state.keyType === 'passphrase' && state.passphrase.length > 0) {
		const len = state.passphrase.length;
		if (len < 12)      { strengthEl.textContent = '⚠ weak';   strengthEl.className = 'strength weak'; }
		else if (len < 20) { strengthEl.textContent = '· fair';   strengthEl.className = 'strength fair'; }
		else               { strengthEl.textContent = '✓ strong'; strengthEl.className = 'strength strong'; }
	} else {
		strengthEl.textContent = '';
		strengthEl.className = 'strength';
	}

	// File info display (input)
	const dropZone = $('drop-zone');
	const fileInfo = $('file-info');
	if (state.inputFile) {
		dropZone.classList.add('hidden');
		fileInfo.classList.remove('hidden');
		$('input-fname').textContent = state.inputFile.name;
		$('input-fsize').textContent = fmtSize(state.inputFile.size);
	} else {
		dropZone.classList.remove('hidden');
		fileInfo.classList.add('hidden');
	}

	// FILE/HEX tab active state
	$('kf-tab-file').classList.toggle('active', state.keyInputMode === 'file');
	$('kf-tab-hex').classList.toggle('active',  state.keyInputMode === 'hex');
	$('kf-file-section').classList.toggle('hidden', state.keyInputMode !== 'file');
	$('kf-hex-section').classList.toggle('hidden',  state.keyInputMode !== 'hex');

	// Keyfile drop zone
	const kfDrop = $('kf-drop');
	const kfInfo = $('kf-info');
	if (state.keyInputMode === 'file' && state.keyfileData) {
		kfDrop.classList.add('hidden');
		kfInfo.classList.remove('hidden');
		$('kf-fname').textContent = state.keyfileData.name;
		$('kf-fsize').textContent = fmtSize(state.keyfileData.bytes.length);
	} else if (state.keyInputMode === 'file') {
		kfDrop.classList.remove('hidden');
		kfInfo.classList.add('hidden');
	}

	// Hex status
	const hexStatusEl = $('kf-hex-status');
	if (state.keyInputMode === 'hex') {
		if (state.keyHexError) {
			hexStatusEl.textContent = state.keyHexError;
			hexStatusEl.className = 'strength weak';
		} else if (state.keyfileData) {
			const bits = state.keyfileData.bytes.length * 8;
			hexStatusEl.textContent = '✓ ' + bits + '-bit key (→ HKDF-SHA256 → 64 bytes)';
			hexStatusEl.className = 'strength strong';
		} else {
			hexStatusEl.textContent = '';
			hexStatusEl.className = 'strength';
		}
	}

	// Action button
	const hint = getActionHint();
	const actionBtn = $('action-btn');
	const actionHint = $('action-hint');
	actionBtn.disabled = !!hint || state.status === 'working';
	if (state.status === 'working') {
		actionBtn.textContent = enc ? 'ENCRYPTING...' : 'DECRYPTING...';
		actionHint.textContent = '';
	} else {
		actionBtn.textContent = enc ? 'ENCRYPT' : 'DECRYPT';
		actionHint.textContent = hint || '';
	}

	// Output panel
	renderOutput();
}

function renderOutput() {
	const body  = $('output-body');
	const panel = $('output-panel');
	const enc   = state.mode === 'encrypt';

	if (state.status === 'idle' || state.status === 'working') {
		panel.classList.add('hidden');
		panel.classList.remove('error');
		return;
	}
	panel.classList.remove('hidden');
	if (state.status === 'error') {
		panel.classList.add('error');
		body.innerHTML = `<div class="output-error">${escHtml(state.errorMsg)}</div>`;
		return;
	}
	panel.classList.remove('error');

	// Done
	if (enc) {
		if (state.inputType === 'text') {
			body.innerHTML = `
				<div class="textarea-wrap">
					<textarea readonly id="out-text">${escHtml(state.outputArmored)}</textarea>
				</div>
				<div class="output-actions">
					<button class="btn primary" id="btn-copy">COPY</button>
					<button class="btn" id="btn-dl">DOWNLOAD</button>
					<div class="dl-toggle seg-group" style="margin-left:auto">
						<button class="dl-toggle-btn ${state.dlFormat==='armored'?'active':''}" data-fmt="armored">TXT</button>
						<button class="dl-toggle-btn ${state.dlFormat==='binary'?'active':''}" data-fmt="binary">BIN</button>
					</div>
				</div>`;
			$('btn-copy').addEventListener('click', e => copyText(state.outputArmored, e.currentTarget));
			$('btn-dl').addEventListener('click', () => {
				if (state.dlFormat === 'armored') downloadText(state.outputArmored, 'encrypted.txt');
				else downloadBytes(state.outputBlob, 'encrypted.lvthn');
			});
			document.querySelectorAll('.dl-toggle-btn').forEach(b => b.addEventListener('click', () => {
				state.dlFormat = b.dataset.fmt;
				renderOutput();
			}));
		} else {
			const srcSize = fmtSize(state.outputSrcSize);
			const encSize = fmtSize(state.outputBlob.length);
			body.innerHTML = `
				<div class="output-ok">
					<p class="output-meta">${escHtml(state.outputFilename)} &nbsp;·&nbsp; ${srcSize} → ${encSize}</p>
					<div class="output-actions">
						<button class="btn primary" id="btn-dl-file">DOWNLOAD ${escHtml(state.outputFilename)}</button>
					</div>
				</div>`;
			$('btn-dl-file').addEventListener('click', () => downloadBytes(state.outputBlob, state.outputFilename));
		}
	} else {
		if (state.inputType === 'file') {
			const label = state.outputFilename || 'decrypted';
			body.innerHTML = `
				<div class="output-ok">
					<div class="output-actions">
						<button class="btn primary" id="btn-dl-dec">DOWNLOAD ${escHtml(label)}</button>
					</div>
				</div>`;
			$('btn-dl-dec').addEventListener('click', () => downloadBytes(state.outputBlob, label));
		} else {
			const text = state.outputText;
			body.innerHTML = `
				<div class="textarea-wrap">
					<textarea readonly id="out-text">${escHtml(text)}</textarea>
				</div>
				<div class="output-actions">
					<button class="btn primary" id="btn-copy">COPY</button>
				</div>`;
			$('btn-copy').addEventListener('click', e => copyText(text, e.currentTarget));
		}
	}
}

function escHtml(s) {
	return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Encrypt ────────────────────────────────────────────────
async function doEncrypt() {
	state.status = 'working'; state.errorMsg = '';
	render();
	await new Promise(r => setTimeout(r, 0));

	try {
		const plaintext = state.inputType === 'text'
			? new TextEncoder().encode(state.inputText)
			: state.inputFile.bytes;

		let key64, kdf, salt;
		if (state.keyType === 'passphrase') {
			kdf  = KDF_ARGON2ID;
			salt = crypto.getRandomValues(new Uint8Array(32));
			key64 = hashArgon2id({
				password:    new TextEncoder().encode(state.passphrase),
				salt,
				parallelism: ARGON2_PARALLELISM,
				passes:      ARGON2_PASSES,
				memorySize:  ARGON2_MEMORY,
				tagLength:   64,
			});
		} else if (state.keyType === 'generate') {
			if (!state.keygenBytes) throw new Error('generate a key first');
			kdf   = KDF_KEYFILE;
			salt  = new Uint8Array(32);
			key64 = deriveKeyfileKey(state.keygenBytes);
		} else {
			// keyfile — HKDF expand to 64 bytes
			kdf   = KDF_KEYFILE;
			salt  = new Uint8Array(32);
			key64 = deriveKeyfileKey(state.keyfileData.bytes);
		}

		const sealed = sealEncrypt(key64, plaintext);
		const blob   = encodeBlob(kdf, salt, sealed);

		state.outputBlob     = blob;
		state.outputArmored  = armorBlob(blob);
		state.outputFilename = state.inputType === 'file'
			? (state.inputFile.name + '.lvthn')
			: 'encrypted.lvthn';
		state.outputSrcSize = plaintext.length;
		state.status = 'done';
	} catch (e) {
		state.errorMsg = `${e.message}`;
		state.status   = 'error';
	}
	render();
}

// ── Decrypt ────────────────────────────────────────────────
async function doDecrypt() {
	state.status = 'working'; state.errorMsg = '';
	render();
	await new Promise(r => setTimeout(r, 0));

	try {
		let inputBytes;
		if (state.inputType === 'text') {
			inputBytes = new TextEncoder().encode(state.inputText.trim());
		} else {
			inputBytes = state.inputFile.bytes;
		}

		const blob = isArmored(inputBytes) ? dearmorBlob(new TextDecoder().decode(inputBytes)) : inputBytes;
		const { kdf, salt, sealed } = decodeBlob(blob);

		let key64;
		if (kdf === KDF_ARGON2ID) {
			if (!state.passphrase) throw new Error('passphrase required for this file');
			key64 = hashArgon2id({
				password:    new TextEncoder().encode(state.passphrase),
				salt,
				parallelism: ARGON2_PARALLELISM,
				passes:      ARGON2_PASSES,
				memorySize:  ARGON2_MEMORY,
				tagLength:   64,
			});
		} else {
			if (!state.keyfileData) throw new Error('keyfile required for this file');
			key64 = deriveKeyfileKey(state.keyfileData.bytes);
		}

		// sealDecrypt throws on authentication failure — no manual HMAC needed
		const plaintext = sealDecrypt(key64, sealed);

		state.outputBlob = plaintext;
		if (state.inputType === 'file') {
			state.outputFilename = state.inputFile.name.replace(/\.lvthn$/i, '') || 'decrypted';
		} else {
			state.outputText = new TextDecoder().decode(plaintext);
		}
		state.status = 'done';
	} catch (e) {
		const msg = e.message;
		if (msg.includes('authentication failed') || msg.includes('Authentication')) {
			state.errorMsg = 'authentication failed — wrong key or tampered data';
		} else if (msg.includes('magic') || msg.includes('format') || msg.includes('LVTHN') || msg.includes('armor') || msg.includes('version')) {
			state.errorMsg = 'unrecognized format — not a leviathan encrypted file';
		} else {
			state.errorMsg = `${msg}`;
		}
		state.status = 'error';
	}
	render();
}

// ── File drop/pick helpers ─────────────────────────────────
function setupDropZone(dropId, pickId, onFile) {
	const drop = $(dropId);
	const pick = $(pickId);

	drop.addEventListener('click', () => pick.click());
	drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') pick.click(); });
	drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
	drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
	drop.addEventListener('drop', e => {
		e.preventDefault(); drop.classList.remove('drag-over');
		const f = e.dataTransfer?.files[0];
		if (f) handleFile(f, onFile);
	});
	pick.addEventListener('change', () => {
		if (pick.files[0]) handleFile(pick.files[0], onFile);
		pick.value = '';
	});
}

async function handleFile(file, callback) {
	const bytes = await readFileBytes(file);
	callback({ name: file.name, size: file.size, bytes });
}

// ── Event wiring ───────────────────────────────────────────
function setupApp() {
	// Mode toggle
	$('btn-encrypt').addEventListener('click', () => {
		state.revealed = true;
		if (state.mode === 'encrypt') { render(); return; }
		state.mode = 'encrypt'; state.status = 'idle';
		state.outputBlob = null; state.outputArmored = ''; state.outputText = ''; state.errorMsg = '';
		state.keyInputMode = 'file'; state.keyHexInput = ''; state.keyHexError = '';
		render();
	});
	$('btn-decrypt').addEventListener('click', () => {
		state.revealed = true;
		if (state.mode === 'decrypt') { render(); return; }
		state.mode = 'decrypt'; state.status = 'idle';
		state.outputBlob = null; state.outputArmored = ''; state.outputText = ''; state.errorMsg = '';
		state.keyInputMode = 'file'; state.keyHexInput = ''; state.keyHexError = '';
		render();
	});
	$('hero-encrypt').addEventListener('click', () => $('btn-encrypt').click());
	$('hero-decrypt').addEventListener('click', () => $('btn-decrypt').click());

	// Input type toggle
	$('tab-text').addEventListener('click', () => {
		if (state.inputType === 'text') return;
		state.inputType = 'text'; state.inputFile = null;
		state.status = 'idle'; state.outputBlob = null; state.outputArmored = ''; state.outputText = ''; state.errorMsg = '';
		render();
	});
	$('tab-file').addEventListener('click', () => {
		if (state.inputType === 'file') return;
		state.inputType = 'file'; state.inputText = '';
		state.status = 'idle'; state.outputBlob = null; state.outputArmored = ''; state.outputText = ''; state.errorMsg = '';
		$('input-text').value = '';
		render();
	});

	// Text input
	$('input-text').addEventListener('input', e => {
		state.inputText = e.target.value;
		$('char-count').textContent = e.target.value.length;
		if (state.status !== 'idle') { state.status = 'idle'; state.outputBlob = null; }
		render();
	});

	// File input drop zone
	setupDropZone('drop-zone', 'file-picker', data => {
		state.inputFile = data;
		state.status = 'idle'; state.outputBlob = null; state.errorMsg = '';
		render();
	});
	$('clear-file').addEventListener('click', () => {
		state.inputFile = null; state.status = 'idle'; render();
	});

	// Key type radio
	document.querySelectorAll('input[name=ktype]').forEach(radio => {
		radio.addEventListener('change', () => {
			state.keyType = radio.value;
			state.status = 'idle'; state.outputBlob = null; state.errorMsg = '';
			render();
		});
	});

	// Passphrase input
	$('pp-input').addEventListener('input', e => {
		state.passphrase = e.target.value;
		if (state.status !== 'idle') { state.status = 'idle'; state.outputBlob = null; }
		render();
	});
	$('btn-show-pp').addEventListener('click', () => {
		state.showPP = !state.showPP; render();
	});

	// Keyfile drop zone
	setupDropZone('kf-drop', 'kf-picker', data => {
		state.keyfileData = data;
		state.status = 'idle'; state.outputBlob = null; state.errorMsg = '';
		render();
	});
	$('clear-kf').addEventListener('click', () => {
		state.keyfileData = null; state.status = 'idle'; render();
	});

	// FILE/HEX tab toggle
	$('kf-tab-file').addEventListener('click', () => {
		if (state.keyInputMode === 'file') return;
		state.keyInputMode = 'file';
		state.keyHexInput  = '';
		state.keyHexError  = '';
		render();
	});
	$('kf-tab-hex').addEventListener('click', () => {
		if (state.keyInputMode === 'hex') return;
		state.keyInputMode = 'hex';
		state.keyfileData  = null;
		render();
	});

	// Hex input
	$('kf-hex-input').addEventListener('input', e => {
		state.keyHexInput = e.target.value;
		const result = parseKeyHex(state.keyHexInput);
		if (state.keyHexInput.trim() === '') {
			state.keyfileData = null;
			state.keyHexError = '';
		} else if (result.error) {
			state.keyfileData = null;
			state.keyHexError = result.error;
		} else {
			state.keyfileData = { name: 'hex key', bytes: result.bytes };
			state.keyHexError = '';
		}
		if (state.status !== 'idle') { state.status = 'idle'; state.outputBlob = null; }
		render();
	});

	// Clear hex
	$('btn-clear-hex').addEventListener('click', () => {
		state.keyHexInput  = '';
		state.keyHexError  = '';
		state.keyfileData  = null;
		$('kf-hex-input').value = '';
		state.status = 'idle';
		render();
	});

	// Generate key — 64 random bytes (512-bit), SerpentSeal requires 64 bytes
	$('btn-gen').addEventListener('click', () => {
		try {
			state.keygenBytes = randomBytes(64);
			$('key-hex').value = bytesToHex(state.keygenBytes);
			$('gen-output').classList.remove('hidden');
			render();
		} catch (e) {
			state.errorMsg = `key generation failed: ${e.message}`;
			state.status = 'error';
			render();
		}
	});

	$('btn-copy-hex').addEventListener('click', e => copyText($('key-hex').value, e.currentTarget));
	$('btn-dl-key').addEventListener('click', () => {
		if (state.keygenBytes) downloadBytes(state.keygenBytes, 'leviathan.key');
	});

	// Action button
	$('action-btn').addEventListener('click', () => {
		state.mode === 'encrypt' ? doEncrypt() : doDecrypt();
	});

	render();
}

// Initialise on DOM ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', setupApp);
} else {
	setupApp();
}
