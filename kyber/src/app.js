// ─── helpers ──────────────────────────────────────────────────────────────────

const enc   = s => new TextEncoder().encode(s)
const trunc = (hex, n = 32) => hex.length > n ? hex.slice(0, n) + '…' : hex
const delay = ms => new Promise(r => setTimeout(r, ms))

const SIZES = {
	512:  { ek: 800,  ct: 768,  ss: 32 },
	768:  { ek: 1184, ct: 1088, ss: 32 },
	1024: { ek: 1568, ct: 1568, ss: 32 },
}

// ─── state ────────────────────────────────────────────────────────────────────

let selectedLevel = 768
let kem           = null
let ekBytes       = null
let dkBytes       = null
let ctBytes       = null
let keyBytes      = null
let bobKeyBytes   = null

// ─── dom refs ─────────────────────────────────────────────────────────────────

const wireFrames     = document.getElementById('wire-frames')
const wireEmpty      = document.getElementById('wire-empty')
const aliceKeygen    = document.getElementById('alice-keygen')
const aliceEkRow     = document.getElementById('alice-ek-row')
const aliceEkVal     = document.getElementById('alice-ek-val')
const aliceDkWrap    = document.getElementById('alice-dk-wrap')
const aliceDkRedact  = document.getElementById('alice-dk-redacted')
const aliceDkHex     = document.getElementById('alice-dk-hex')
const aliceDkBtn     = document.getElementById('alice-dk-btn')
const aliceStatus    = document.getElementById('alice-status')
const aliceSsRow     = document.getElementById('alice-ss-row')
const aliceSsVal     = document.getElementById('alice-ss-val')
const aliceKeyRow    = document.getElementById('alice-key-row')
const aliceKeyVal    = document.getElementById('alice-key-val')
const aliceMsgArea   = document.getElementById('alice-msg-area')
const aliceLog       = document.getElementById('alice-log')
const aliceInput     = document.getElementById('alice-input')
const aliceSend      = document.getElementById('alice-send')
const bobIdle        = document.getElementById('bob-idle')
const bobEkRow       = document.getElementById('bob-ek-row')
const bobEkVal       = document.getElementById('bob-ek-val')
const bobStatus      = document.getElementById('bob-status')
const bobSsRow       = document.getElementById('bob-ss-row')
const bobSsVal       = document.getElementById('bob-ss-val')
const bobKeyRow      = document.getElementById('bob-key-row')
const bobKeyVal      = document.getElementById('bob-key-val')
const bobMsgArea     = document.getElementById('bob-msg-area')
const bobLog         = document.getElementById('bob-log')
const bobInput       = document.getElementById('bob-input')
const bobSend        = document.getElementById('bob-send')

// ─── level selector ───────────────────────────────────────────────────────────

document.querySelectorAll('.lvl-btn').forEach(btn => {
	btn.addEventListener('click', () => {
		if (btn.disabled) return
		selectedLevel = parseInt(btn.dataset.level, 10)
		document.querySelectorAll('.lvl-btn').forEach(b => {
			b.classList.toggle('active', b === btn)
			b.setAttribute('aria-pressed', String(b === btn))
		})
	})
})

// ─── dk eye toggle ────────────────────────────────────────────────────────────

aliceDkBtn.addEventListener('click', () => {
	const hiding = !aliceDkHex.classList.contains('hidden')
	aliceDkRedact.classList.toggle('hidden', !hiding)
	aliceDkHex.classList.toggle('hidden', hiding)
	aliceDkBtn.setAttribute('aria-label', hiding ? 'show decapsulation key' : 'hide decapsulation key')
})

// ─── wire ─────────────────────────────────────────────────────────────────────

function addFrame(type, bytes, dir, sender) {
	wireEmpty.classList.add('hidden')

	if (type === 'null') {
		addNullFrame(bytes)
		return
	}

	const hex   = bytesToHex(bytes)
	const sizes = SIZES[selectedLevel] || SIZES[768]
	let label, sizeStr, annotation, detail

	if (type === 'ek') {
		label      = 'ek'
		sizeStr    = sizes.ek + 'b'
		annotation = 'encapsulation key (public, safe to transmit)'
		detail     = buildEkDetail(hex, sizes.ek)
	} else if (type === 'ct') {
		label      = 'ct'
		sizeStr    = sizes.ct + 'b'
		annotation = 'ciphertext (public, quantum-resistant)'
		detail     = buildCtDetail(hex, sizes.ct)
	} else {
		// msg: bytes is nonce || ct
		const ctLen = bytes.length - 24
		label      = 'msg'
		sizeStr    = ctLen + 'b'
		annotation = 'encrypted message'
		detail     = buildMsgDetail(bytes, sender)
	}

	const frame = document.createElement('div')
	frame.className = 'wire-frame'
	frame.innerHTML = `
		<div class="wire-frame-head">
			<span class="wire-dir">${dir}</span>
			<span class="wire-label">${label}</span>
			<span class="wire-size">${sizeStr}</span>
			<span class="wire-annotation">${annotation}</span>
		</div>
		<div class="wire-frame-body">${detail}</div>
	`
	frame.querySelector('.wire-frame-head').addEventListener('click', () => {
		frame.classList.toggle('expanded')
	})
	wireFrames.appendChild(frame)
	wireFrames.scrollLeft = wireFrames.scrollWidth
}

function addNullFrame(ssBytes) {
	const hex = bytesToHex(ssBytes)
	const frame = document.createElement('div')
	frame.className = 'wire-frame null-frame'
	frame.innerHTML = `
		<div class="wire-frame-head">
			<span class="wire-dir">&nbsp;</span>
			<span class="wire-label">ss</span>
			<span class="wire-size">-</span>
			<span class="wire-annotation">shared secret (derived independently, never transmitted)</span>
		</div>
		<div class="wire-frame-body">
			<div class="frame-detail">
				<span class="detail-key">type</span>
				<span class="detail-val">shared secret (ml-kem ${selectedLevel})</span>
			</div>
			<div class="frame-detail">
				<span class="detail-key">transmitted</span>
				<span class="detail-val detail-err">no (that's the point)</span>
			</div>
			<div class="frame-detail detail-hex short">${hex}</div>
		</div>
	`
	frame.querySelector('.wire-frame-head').addEventListener('click', () => {
		frame.classList.toggle('expanded')
	})
	wireFrames.appendChild(frame)
	wireFrames.scrollLeft = wireFrames.scrollWidth
}

function buildEkDetail(hex, size) {
	return `
		<div class="frame-detail">
			<span class="detail-key">type</span>
			<span class="detail-val">encapsulation key (ml-kem ${selectedLevel})</span>
		</div>
		<div class="frame-detail">
			<span class="detail-key">size</span>
			<span class="detail-val">${size} bytes</span>
		</div>
		<div class="frame-detail">
			<span class="detail-key">public</span>
			<span class="detail-val detail-ok">yes</span>
		</div>
		<div class="frame-detail">
			<span class="detail-key">attacker learns</span>
			<span class="detail-val">nothing (opaque polynomial structure)</span>
		</div>
		<div class="frame-detail detail-hex short">${hex}</div>
	`
}

function buildCtDetail(hex, size) {
	return `
		<div class="frame-detail">
			<span class="detail-key">type</span>
			<span class="detail-val">ciphertext (ml-kem ${selectedLevel})</span>
		</div>
		<div class="frame-detail">
			<span class="detail-key">size</span>
			<span class="detail-val">${size} bytes</span>
		</div>
		<div class="frame-detail">
			<span class="detail-key">public</span>
			<span class="detail-val detail-ok">yes</span>
		</div>
		<div class="frame-detail">
			<span class="detail-key">attacker learns</span>
			<span class="detail-val">nothing without dk (quantum-resistant)</span>
		</div>
		<div class="frame-detail detail-hex short">${hex}</div>
	`
}

function buildMsgDetail(blob, sender) {
	const nonce  = blob.slice(0, 24)
	const ct     = blob.slice(24)
	const ctBody = ct.slice(0, ct.length - 16)
	const tag    = ct.slice(ct.length - 16)
	return `
		<div class="frame-detail">
			<span class="detail-key">nonce</span>
			<span class="detail-val">24b &nbsp; ${bytesToHex(nonce)}</span>
		</div>
		<div class="frame-detail">
			<span class="detail-key">ct</span>
			<span class="detail-val">${ctBody.length}b</span>
		</div>
		<div class="frame-detail">
			<span class="detail-key">hex</span>
			<span class="detail-val detail-hex short">${bytesToHex(ctBody)}</span>
		</div>
		<div class="frame-detail">
			<span class="detail-key">tag</span>
			<span class="detail-val">16b &nbsp; ${bytesToHex(tag)}</span>
		</div>
		<div class="frame-detail">
			<span class="detail-key">aad</span>
			<span class="detail-val">"${sender}"</span>
		</div>
	`
}

// ─── ceremony ─────────────────────────────────────────────────────────────────

aliceKeygen.addEventListener('click', step1)

async function step1() {
	aliceKeygen.disabled = true
	document.querySelectorAll('.lvl-btn').forEach(b => { b.disabled = true })

	const KemClass = selectedLevel === 512 ? MlKem512 : selectedLevel === 1024 ? MlKem1024 : MlKem768
	kem = new KemClass()
	const { encapsulationKey, decapsulationKey } = kem.keygen()
	ekBytes = encapsulationKey
	dkBytes = decapsulationKey

	const ekHex = bytesToHex(ekBytes)
	const dkHex = bytesToHex(dkBytes)

	aliceEkVal.textContent = trunc(ekHex)
	aliceEkRow.classList.remove('hidden')

	aliceDkHex.textContent = dkHex
	aliceDkWrap.classList.remove('hidden')

	aliceKeygen.classList.add('hidden')

	addFrame('ek', ekBytes, '→')

	setTimeout(step2, 300)
}

async function step2() {
	bobIdle.classList.add('hidden')
	bobEkVal.textContent = trunc(bytesToHex(ekBytes))
	bobEkRow.classList.remove('hidden')

	bobStatus.innerHTML = 'encapsulating... <span class="spinner">&#x2587;</span>'
	bobStatus.classList.remove('hidden')

	await delay(1500)

	const { ciphertext, sharedSecret: bobSs } = kem.encapsulate(ekBytes)
	ctBytes = ciphertext

	bobStatus.classList.add('hidden')

	addFrame('ct', ctBytes, '←')

	setTimeout(() => step3(bobSs), 300)
}

async function step3(bobSs) {
	aliceStatus.innerHTML = 'decapsulating... <span class="spinner">&#x2587;</span>'
	aliceStatus.classList.remove('hidden')

	await delay(1500)

	const aliceSs = kem.decapsulate(dkBytes, ctBytes)
	kem.dispose()
	kem = null

	// HKDF_SHA256.derive(ikm, salt, info, length)
	const hkdf1 = new HKDF_SHA256()
	keyBytes = hkdf1.derive(aliceSs, new Uint8Array(32), enc('leviathan-kyber-demo'), 32)
	hkdf1.dispose()

	const hkdf2 = new HKDF_SHA256()
	bobKeyBytes = hkdf2.derive(bobSs, new Uint8Array(32), enc('leviathan-kyber-demo'), 32)
	hkdf2.dispose()

	aliceStatus.classList.add('hidden')

	aliceSsVal.textContent  = bytesToHex(aliceSs)
	bobSsVal.textContent    = bytesToHex(bobSs)
	aliceKeyVal.textContent = bytesToHex(keyBytes)
	bobKeyVal.textContent   = bytesToHex(bobKeyBytes)

	// reveal ss rows (hidden → opacity 0 → opacity 1 via transition)
	aliceSsRow.classList.remove('hidden')
	bobSsRow.classList.remove('hidden')
	aliceKeyRow.classList.remove('hidden')
	bobKeyRow.classList.remove('hidden')

	// two rAF to ensure layout before triggering transition
	requestAnimationFrame(() => requestAnimationFrame(() => {
		aliceSsRow.classList.add('visible')
		bobSsRow.classList.add('visible')
	}))

	addFrame('null', aliceSs, null)

	unlockMessaging()
}

// ─── messaging ────────────────────────────────────────────────────────────────

function unlockMessaging() {
	aliceMsgArea.classList.remove('hidden')
	bobMsgArea.classList.remove('hidden')
	aliceInput.disabled = false
	aliceSend.disabled  = false
	bobInput.disabled   = false
	bobSend.disabled    = false
}

function sendMsg(sender) {
	const input = sender === 'alice' ? aliceInput : bobInput
	const key   = sender === 'alice' ? keyBytes : bobKeyBytes
	const msg   = input.value.trim()
	if (!msg) return

	const nonce = randomBytes(24)
	const aead  = new XChaCha20Poly1305()
	const ct    = aead.encrypt(key, nonce, enc(msg), enc(sender))
	aead.dispose()

	// wire blob: nonce || ct
	const blob = new Uint8Array(24 + ct.length)
	blob.set(nonce, 0)
	blob.set(ct, 24)

	addFrame('msg', blob, sender === 'alice' ? '→' : '←', sender)

	appendBubble(sender, msg, 'sent')

	const receiver = sender === 'alice' ? 'bob' : 'alice'
	try {
		const aead2 = new XChaCha20Poly1305()
		const pt    = aead2.decrypt(key, nonce, ct, enc(sender))
		aead2.dispose()
		appendBubble(receiver, new TextDecoder().decode(pt), 'received')
	} catch {
		appendBubble(receiver, '[decrypt failed]', 'received')
	}

	input.value = ''
}

function appendBubble(panel, text, kind) {
	const log    = panel === 'alice' ? aliceLog : bobLog
	const bubble = document.createElement('div')
	bubble.className = 'bubble bubble-' + kind
	bubble.textContent = text
	log.appendChild(bubble)
	log.classList.remove('hidden')
	log.scrollTop = log.scrollHeight
}

aliceSend.addEventListener('click', () => sendMsg('alice'))
bobSend.addEventListener('click',   () => sendMsg('bob'))

aliceInput.addEventListener('keydown', e => {
	if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg('alice') }
})
bobInput.addEventListener('keydown', e => {
	if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg('bob') }
})

// ─── detail-hex expand ────────────────────────────────────────────────────────

wireFrames.addEventListener('click', e => {
	const el = e.target.closest('.detail-hex')
	if (el) el.classList.toggle('short')
})
