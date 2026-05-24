// ─── leviathan jwt demo ─────────────────────────────────────────────────────
//
// Every algorithm runs through the same three calls on the leviathan sign
// suite abstraction, with no per-alg branching:
//   suite.keygen()                                  -> { pk, sk }
//   Sign.signDetached(suite, sk, msgBytes, ctx)     -> raw signature bytes
//   Sign.verifyDetached(suite, pk, msgBytes, sig, ctx) -> boolean
//
// JWT signing input is ascii `base64url(header) . base64url(payload)`; the
// token is that input plus `. base64url(signature)`. ctx is always empty;
// JWT carries no signature context.

const EMPTY = new Uint8Array(0);

const enc    = s => utf8ToBytes(s);
const b64url = bytes => bytesToBase64(bytes, true);
const trunc  = (hex, n = 48) => hex.length > n ? hex.slice(0, n) + '…' : hex;

// human file size: bytes under 1 kb, kb above (like a file manager)
const fmtSize = n => n < 1024 ? `${n} B` : `${(n / 1024).toFixed(2)} KB`;

// alg id -> suite. ml-dsa / slh-dsa ids track the in-progress ietf jose/cose
// pqc drafts; hybrid ids are leviathan-defined and experimental.
const REGISTRY = {
	'EdDSA':              Ed25519Suite,
	'ES256':             EcdsaP256Suite,
	'ML-DSA-44':          MlDsa44Suite,
	'ML-DSA-65':          MlDsa65Suite,
	'ML-DSA-87':          MlDsa87Suite,
	'SLH-DSA-SHAKE-128f': SlhDsa128fSuite,
	'SLH-DSA-SHAKE-192f': SlhDsa192fSuite,
	'SLH-DSA-SHAKE-256f': SlhDsa256fSuite,
	'MLDSA44-SLHDSA128f': MlDsa44SlhDsa128fSuite,
	'MLDSA65-SLHDSA192f': MlDsa65SlhDsa192fSuite,
	'MLDSA87-SLHDSA256f': MlDsa87SlhDsa256fSuite,
};

const DEFAULT_PAYLOAD = {
	sub: '1234567890',
	name: 'ada lovelace',
	admin: false,
	iat: 1516239022,
};

// ─── state ──────────────────────────────────────────────────────────────────

let currentAlg = 'EdDSA';
let suite      = REGISTRY[currentAlg];
let keypair    = null;   // { pk, sk }
let lastToken  = null;

// ─── dom refs ─────────────────────────────────────────────────────────────────

const algSelect    = document.getElementById('alg-select');
const sizeInfo     = document.getElementById('size-info');
const keygenBtn    = document.getElementById('keygen-btn');
const pkRow        = document.getElementById('pk-row');
const pkVal        = document.getElementById('pk-val');
const skWrap       = document.getElementById('sk-wrap');
const skToggle     = document.getElementById('sk-toggle');
const skRedacted   = document.getElementById('sk-redacted');
const skHex        = document.getElementById('sk-hex');
const headerInput  = document.getElementById('header-input');
const payloadInput = document.getElementById('payload-input');
const signBtn      = document.getElementById('sign-btn');
const signError    = document.getElementById('sign-error');
const tokenEmpty   = document.getElementById('token-empty');
const tokenOut     = document.getElementById('token-out');
const tokenSizes   = document.getElementById('token-sizes');
const sizeNote     = document.getElementById('size-note');
const copyBtn      = document.getElementById('copy-btn');
const verifyInput  = document.getElementById('verify-input');
const verifyBtn    = document.getElementById('verify-btn');
const tamperBtn    = document.getElementById('tamper-btn');
const verdict      = document.getElementById('verdict');
const decodeError  = document.getElementById('decode-error');
const decoded      = document.getElementById('decoded');
const decHeader    = document.getElementById('decoded-header');
const decPayload   = document.getElementById('decoded-payload');
const decSigSize   = document.getElementById('decoded-sig-size');

// ─── sizes panel ────────────────────────────────────────────────────────────

function row(dt, dd) {
	return `<dt>${dt}</dt><dd>${dd}</dd>`;
}

function renderSizeInfo() {
	sizeInfo.innerHTML =
		row('public key', `${suite.pkSize} B`) +
		row('secret key', `${suite.skSize} B`) +
		row('signature',  `${suite.sigMaxSize} B`);
}

// ─── algorithm selection ──────────────────────────────────────────────────────

function setAlg(alg) {
	currentAlg = alg;
	suite = REGISTRY[alg];
	renderSizeInfo();

	// keys are alg-specific: clear them and force a fresh keygen before signing
	keypair = null;
	pkRow.classList.add('hidden');
	skWrap.classList.add('hidden');
	signBtn.disabled = true;
	resetToken();

	// keep header.alg in sync with the picker
	try {
		const h = JSON.parse(headerInput.value);
		h.alg = alg;
		if (!('typ' in h)) h.typ = 'JWT';
		headerInput.value = JSON.stringify(h, null, '\t');
	} catch {
		headerInput.value = JSON.stringify({ alg, typ: 'JWT' }, null, '\t');
	}
}

algSelect.addEventListener('change', () => setAlg(algSelect.value));

// ─── keypair ──────────────────────────────────────────────────────────────────

keygenBtn.addEventListener('click', () => {
	keypair = suite.keygen();

	pkVal.textContent = `${trunc(bytesToHex(keypair.pk))}  (${suite.pkSize} B)`;
	pkRow.classList.remove('hidden');

	skHex.textContent = `${trunc(bytesToHex(keypair.sk))}  (${suite.skSize} B)`;
	skHex.classList.add('hidden');
	skRedacted.classList.remove('hidden');
	skWrap.classList.remove('hidden');

	signBtn.disabled = false;
});

skToggle.addEventListener('click', () => {
	const hiding = !skHex.classList.contains('hidden');
	skRedacted.classList.toggle('hidden', !hiding);
	skHex.classList.toggle('hidden', hiding);
	skToggle.querySelector('.eye-btn')
		.setAttribute('aria-label', hiding ? 'show secret key' : 'hide secret key');
});

// ─── sign ─────────────────────────────────────────────────────────────────────

function showSignError(msg) {
	signError.textContent = msg;
	signError.classList.remove('hidden');
}

signBtn.addEventListener('click', () => {
	signError.classList.add('hidden');
	if (!keypair) return showSignError('generate a keypair first.');

	let header, payload;
	try {
		header = JSON.parse(headerInput.value);
	} catch {
		return showSignError('header is not valid json.');
	}
	try {
		payload = JSON.parse(payloadInput.value);
	} catch {
		return showSignError('payload is not valid json.');
	}

	// the header alg is authoritative for verification; force it to match
	header.alg = currentAlg;
	headerInput.value = JSON.stringify(header, null, '\t');

	const headerB64  = b64url(enc(JSON.stringify(header)));
	const payloadB64 = b64url(enc(JSON.stringify(payload)));
	const signingInput = `${headerB64}.${payloadB64}`;

	const sig = Sign.signDetached(suite, keypair.sk, enc(signingInput), EMPTY);
	const sigB64 = b64url(sig);
	lastToken = `${signingInput}.${sigB64}`;

	renderToken(headerB64, payloadB64, sigB64, sig.length);

	verifyInput.value = lastToken;
	tamperBtn.disabled = false;
});

function renderToken(h, p, s, sigLen) {
	tokenEmpty.classList.add('hidden');
	tokenOut.innerHTML =
		`<span class="seg seg-h">${h}</span>` +
		'<span class="seg-dot">.</span>' +
		`<span class="seg seg-p">${p}</span>` +
		'<span class="seg-dot">.</span>' +
		`<span class="seg seg-s">${s}</span>`;
	tokenOut.classList.remove('hidden');

	const total = lastToken.length;
	tokenSizes.innerHTML =
		row('<span class="seg-h-label">header</span>',    fmtSize(h.length)) +
		row('<span class="seg-p-label">payload</span>',   fmtSize(p.length)) +
		row('<span class="seg-s-label">signature</span>', fmtSize(s.length)) +
		row('token total', fmtSize(total));
	tokenSizes.classList.remove('hidden');

	sizeNote.textContent =
		`signature is ${sigLen} raw bytes → ${s.length} base64url chars. `
		+ (sigLen > 1000
			? 'post-quantum signatures are large. that size is the cost of quantum resistance.'
			: 'classical signatures stay compact.');
	sizeNote.classList.remove('hidden');

	copyBtn.classList.remove('hidden');
}

function resetToken() {
	lastToken = null;
	tokenOut.classList.add('hidden');
	tokenSizes.classList.add('hidden');
	sizeNote.classList.add('hidden');
	copyBtn.classList.add('hidden');
	tokenEmpty.classList.remove('hidden');
	tamperBtn.disabled = true;
}

copyBtn.addEventListener('click', async () => {
	if (!lastToken) return;
	await navigator.clipboard.writeText(lastToken);
	copyBtn.textContent = 'copied';
	setTimeout(() => { copyBtn.textContent = 'copy'; }, 1200);
});

// ─── verify & decode ──────────────────────────────────────────────────────────

function showVerdict(ok, text) {
	verdict.textContent = text;
	verdict.classList.remove('hidden', 'ok', 'bad');
	verdict.classList.add(ok ? 'ok' : 'bad');
}

function pretty(bytes) {
	try {
		return JSON.stringify(JSON.parse(bytesToUtf8(bytes)), null, '\t');
	} catch {
		return bytesToUtf8(bytes);
	}
}

verifyBtn.addEventListener('click', () => doVerify(verifyInput.value.trim()));

function doVerify(token) {
	decodeError.classList.add('hidden');
	verdict.classList.add('hidden');
	decoded.classList.add('hidden');

	const parts = token.split('.');
	if (parts.length !== 3)
		return fail('malformed token: expected three dot-separated segments.');

	let headerBytes, payloadBytes, sig;
	try {
		headerBytes  = base64ToBytes(parts[0]);
		payloadBytes = base64ToBytes(parts[1]);
		sig          = base64ToBytes(parts[2]);
	} catch {
		return fail('a token segment is not valid base64url.');
	}

	let header;
	try {
		header = JSON.parse(bytesToUtf8(headerBytes));
	} catch {
		return fail('token header is not valid json.');
	}

	const tokenSuite = REGISTRY[header.alg];
	if (!tokenSuite)
		return fail(`unknown alg "${header.alg}" in token header.`);
	if (!keypair || header.alg !== currentAlg)
		return fail(`select "${header.alg}" and generate a keypair to verify this token.`);

	// always render the decoded segments, valid or not
	decHeader.textContent  = pretty(headerBytes);
	decPayload.textContent = pretty(payloadBytes);
	decSigSize.textContent = `${sig.length} bytes (${tokenSuite.formatName})`;
	decoded.classList.remove('hidden');

	const signingInput = `${parts[0]}.${parts[1]}`;
	const ok = Sign.verifyDetached(tokenSuite, keypair.pk, enc(signingInput), sig, EMPTY);

	if (ok) showVerdict(true, '✓ signature valid');
	else showVerdict(false, '✗ signature invalid. the token was altered, or signed by a different key');

	function fail(msg) {
		decodeError.textContent = msg;
		decodeError.classList.remove('hidden');
	}
}

// flip a privileged claim and re-verify without re-signing: the classic jwt
// tamper. the signature is over the original bytes, so verification fails.
tamperBtn.addEventListener('click', () => {
	if (!lastToken) return;
	const parts = lastToken.split('.');

	let payload;
	try {
		payload = JSON.parse(bytesToUtf8(base64ToBytes(parts[1])));
	} catch {
		payload = {};
	}
	payload.admin = true;
	payload.sub = 'attacker';

	const tamperedPayloadB64 = b64url(enc(JSON.stringify(payload)));
	const tampered = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

	verifyInput.value = tampered;
	doVerify(tampered);
});

// ─── init ───────────────────────────────────────────────────────────────────

headerInput.value  = JSON.stringify({ alg: currentAlg, typ: 'JWT' }, null, '\t');
payloadInput.value = JSON.stringify(DEFAULT_PAYLOAD, null, '\t');
algSelect.value    = currentAlg;
renderSizeInfo();
