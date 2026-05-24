// lvthn-web UI controller.
// Wire format is LVTHNCLI v3, byte-compatible with the lvthn CLI. See
// cli/FORMAT.md for the on-disk layout. Crypto helpers live in
// format.js / crypto.js / cipher-suites.js, all inlined into the same
// <script type="module"> as this file via build.ts.

// ── DOM helper ─────────────────────────────────────────────
function $(i) { return document.getElementById(i); }

// ── Application state ─────────────────────────────────────
const state = {
	mode:     'encrypt',     // 'encrypt' | 'decrypt'
	revealed: false,

	inputType: 'text',       // 'text' | 'file'
	keyType:   'passphrase', // 'passphrase' | 'keyfile' | 'generate'
	cipher:    'serpent',    // 'serpent' | 'chacha' | 'aes' (encrypt only; decrypt reads from header)

	inputText:  '',
	inputFile:  null,

	passphrase:   '',
	keyfileData:  null,       // { name, bytes }
	keyInputMode: 'file',     // 'file' | 'hex'
	keyHexInput:  '',
	keyHexError:  '',

	keygenBytes: null,        // Uint8Array (32 bytes)

	outputBlob:     null,
	outputArmored:  '',
	outputText:     '',
	outputFilename: '',
	outputSrcSize:  0,

	status:   'idle',         // 'idle' | 'working' | 'done' | 'error'
	errorMsg: '',
	showPP:   false,
	dlFormat: 'armored',      // 'armored' | 'binary'
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
	if (h.length !== 64) return { error: `expected 64 hex chars (32 bytes), got ${h.length}` };
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

// Returns the raw 32-byte key for keyfile mode, throwing on invalid input.
// Accepts either raw 32-byte buffer or LVTHNCLI armored key (PEM).
function resolveKeyfileBytes(bytes) {
	let raw = bytes;
	if (isArmoredKey(bytes)) {
		raw = dearmorKey(new TextDecoder().decode(bytes));
	}
	if (raw.length !== 32) {
		throw new Error(`invalid keyfile size: ${raw.length} bytes (expected 32)`);
	}
	return raw;
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

	$('mode-select').classList.toggle('hidden', state.revealed);
	$('workspace').classList.toggle('hidden', !state.revealed);

	$('btn-encrypt').classList.toggle('active', enc);
	$('btn-decrypt').classList.toggle('active', !enc);

	// Generate Key option: only in encrypt mode
	$('lbl-gen').classList.toggle('hidden', !enc);
	if (!enc && state.keyType === 'generate') {
		state.keyType = 'passphrase';
		document.querySelector('input[name=ktype][value=passphrase]').checked = true;
	}

	// Cipher panel: encrypt mode only
	$('sec-cipher').classList.toggle('hidden', !enc);
	document.querySelectorAll('.cipher-radio-label').forEach(lbl => {
		const val = lbl.querySelector('input').value;
		lbl.classList.toggle('checked', val === state.cipher);
	});

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

	$('input-text').placeholder = enc ? 'paste text or type message...' : 'paste encrypted message...';

	// Key sections
	$('sec-passphrase').classList.toggle('hidden', state.keyType !== 'passphrase');
	$('sec-keyfile').classList.toggle('hidden', state.keyType !== 'keyfile');
	$('sec-generate').classList.toggle('hidden', state.keyType !== 'generate');

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

	$('kf-tab-file').classList.toggle('active', state.keyInputMode === 'file');
	$('kf-tab-hex').classList.toggle('active',  state.keyInputMode === 'hex');
	$('kf-file-section').classList.toggle('hidden', state.keyInputMode !== 'file');
	$('kf-hex-section').classList.toggle('hidden',  state.keyInputMode !== 'hex');

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

	const hexStatusEl = $('kf-hex-status');
	if (state.keyInputMode === 'hex') {
		if (state.keyHexError) {
			hexStatusEl.textContent = state.keyHexError;
			hexStatusEl.className = 'strength weak';
		} else if (state.keyfileData) {
			hexStatusEl.textContent = '✓ 256-bit key loaded';
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

	let pool = null;
	try {
		const plaintext = state.inputType === 'text'
			? new TextEncoder().encode(state.inputText)
			: state.inputFile.bytes;

		let key, kdf, salt;
		if (state.keyType === 'passphrase') {
			kdf = KDF_SCRYPT;
			const derived = deriveKey(state.passphrase);
			key  = derived.key;
			salt = derived.salt;
		} else if (state.keyType === 'generate') {
			if (!state.keygenBytes) throw new Error('generate a key first');
			kdf  = KDF_KEYFILE;
			salt = new Uint8Array(32);
			key  = state.keygenBytes;
		} else {
			kdf  = KDF_KEYFILE;
			salt = new Uint8Array(32);
			key  = resolveKeyfileBytes(state.keyfileData.bytes);
		}

		const suite      = cipherSuiteFor(state.cipher);
		const wasm       = wasmFor(state.cipher);
		const cipherByte = cipherByteFor(state.cipher);

		pool = await SealStreamPool.create(suite, key, { wasm, chunkSize: 65536, workers: 1 });
		const poolOutput = await pool.seal(plaintext);
		const blob = encodeBlob(
			{ version: FORMAT_VERSION, cipher: cipherByte, kdf, flags: 0x00, salt },
			poolOutput,
		);

		state.outputBlob     = blob;
		state.outputArmored  = armor(blob);
		state.outputFilename = state.inputType === 'file'
			? (state.inputFile.name + '.lvthn')
			: 'encrypted.lvthn';
		state.outputSrcSize = plaintext.length;
		state.status = 'done';
	} catch (e) {
		state.errorMsg = `${e.message}`;
		state.status   = 'error';
	} finally {
		if (pool) {
			try { pool.destroy(); } catch (_) { /* ignore */ }
		}
	}
	render();
}

// ── Decrypt ────────────────────────────────────────────────
async function doDecrypt() {
	state.status = 'working'; state.errorMsg = '';
	render();
	await new Promise(r => setTimeout(r, 0));

	let pool = null;
	try {
		let inputBytes;
		if (state.inputType === 'text') {
			inputBytes = new TextEncoder().encode(state.inputText.trim());
		} else {
			inputBytes = state.inputFile.bytes;
		}

		const blob = isArmored(inputBytes)
			? dearmor(new TextDecoder().decode(inputBytes))
			: inputBytes;
		const { header, poolOutput } = decodeBlob(blob);

		if (header.kdf === KDF_SCRYPT && state.keyType !== 'passphrase')
			throw new Error('passphrase required for this file');
		if (header.kdf === KDF_KEYFILE && state.keyType === 'passphrase')
			throw new Error('keyfile required for this file');

		let key;
		if (header.kdf === KDF_SCRYPT) {
			const derived = deriveKey(state.passphrase, header.salt);
			key = derived.key;
		} else if (state.keyType === 'generate') {
			if (!state.keygenBytes) throw new Error('keyfile required for this file');
			key = state.keygenBytes;
		} else {
			key = resolveKeyfileBytes(state.keyfileData.bytes);
		}

		const cipherName = cipherNameFromByte(header.cipher);
		const suite      = cipherSuiteFor(cipherName);
		const wasm       = wasmFor(cipherName);

		pool = await SealStreamPool.create(suite, key, { wasm, chunkSize: 65536, workers: 1 });
		const plaintext = await pool.open(poolOutput);

		state.outputBlob = plaintext;
		if (state.inputType === 'file') {
			state.outputFilename = state.inputFile.name.replace(/\.lvthn$/i, '') || 'decrypted';
		} else {
			state.outputText = new TextDecoder().decode(plaintext);
		}
		state.status = 'done';
	} catch (e) {
		const msg = e.message || '';
		if (e instanceof AuthenticationError) {
			state.errorMsg = 'authentication failed: wrong key or tampered data';
		} else if (msg.includes('magic') || msg.includes('LVTHN') || msg.includes('armor') || msg.includes('version') || msg.includes('cipher') || msg.includes('KDF')) {
			state.errorMsg = `unrecognized format: ${msg}`;
		} else {
			state.errorMsg = msg;
		}
		state.status = 'error';
	} finally {
		if (pool) {
			try { pool.destroy(); } catch (_) { /* ignore */ }
		}
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
	function clearOutput() {
		state.status = 'idle';
		state.outputBlob = null;
		state.outputArmored = '';
		state.outputText = '';
		state.errorMsg = '';
	}

	$('btn-encrypt').addEventListener('click', () => {
		state.revealed = true;
		if (state.mode === 'encrypt') { render(); return; }
		state.mode = 'encrypt';
		clearOutput();
		state.keyInputMode = 'file'; state.keyHexInput = ''; state.keyHexError = '';
		render();
	});
	$('btn-decrypt').addEventListener('click', () => {
		state.revealed = true;
		if (state.mode === 'decrypt') { render(); return; }
		state.mode = 'decrypt';
		clearOutput();
		state.keyInputMode = 'file'; state.keyHexInput = ''; state.keyHexError = '';
		render();
	});
	$('hero-encrypt').addEventListener('click', () => $('btn-encrypt').click());
	$('hero-decrypt').addEventListener('click', () => $('btn-decrypt').click());

	$('tab-text').addEventListener('click', () => {
		if (state.inputType === 'text') return;
		state.inputType = 'text'; state.inputFile = null;
		clearOutput();
		render();
	});
	$('tab-file').addEventListener('click', () => {
		if (state.inputType === 'file') return;
		state.inputType = 'file'; state.inputText = '';
		clearOutput();
		$('input-text').value = '';
		render();
	});

	$('input-text').addEventListener('input', e => {
		state.inputText = e.target.value;
		$('char-count').textContent = e.target.value.length;
		if (state.status !== 'idle') clearOutput();
		render();
	});

	setupDropZone('drop-zone', 'file-picker', data => {
		state.inputFile = data;
		clearOutput();
		render();
	});
	$('clear-file').addEventListener('click', () => {
		state.inputFile = null; clearOutput(); render();
	});

	// Cipher selector
	document.querySelectorAll('input[name=cipher]').forEach(radio => {
		radio.addEventListener('change', () => {
			state.cipher = radio.value;
			clearOutput();
			render();
		});
	});

	document.querySelectorAll('input[name=ktype]').forEach(radio => {
		radio.addEventListener('change', () => {
			state.keyType = radio.value;
			clearOutput();
			render();
		});
	});

	$('pp-input').addEventListener('input', e => {
		state.passphrase = e.target.value;
		if (state.status !== 'idle') clearOutput();
		render();
	});
	$('btn-show-pp').addEventListener('click', () => {
		state.showPP = !state.showPP; render();
	});

	setupDropZone('kf-drop', 'kf-picker', data => {
		state.keyfileData = data;
		clearOutput();
		render();
	});
	$('clear-kf').addEventListener('click', () => {
		state.keyfileData = null; clearOutput(); render();
	});

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
		if (state.status !== 'idle') clearOutput();
		render();
	});

	$('btn-clear-hex').addEventListener('click', () => {
		state.keyHexInput  = '';
		state.keyHexError  = '';
		state.keyfileData  = null;
		$('kf-hex-input').value = '';
		state.status = 'idle';
		render();
	});

	// Generate key: 32 random bytes (256-bit), matches CLI keyfile size
	$('btn-gen').addEventListener('click', () => {
		try {
			state.keygenBytes = generateKey();
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

	$('action-btn').addEventListener('click', () => {
		state.mode === 'encrypt' ? doEncrypt() : doDecrypt();
	});

	render();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', setupApp);
} else {
	setupApp();
}
