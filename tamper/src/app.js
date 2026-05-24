// ==================== APP CODE ====================
// init, XChaCha20Poly1305, X25519, HKDF_SHA256, wipe, bytesToHex,
// bytesToBase64, base64ToBytes, randomBytes are in scope from the
// inlined bundle above. Every cryptographic primitive used here comes
// from leviathan-crypto.

// Context label binding the derived key to this demo's purpose. Both
// peers feed the identical label into HKDF, so the session key matches.
const HKDF_INFO = new TextEncoder().encode("lvthn-tamper/x25519-xchacha20");


// ── Helpers ────────────────────────────────────────────────────
function hexStr(bytes) {
  return bytesToHex(bytes);
}
function mustB64(s, field) {
  const b = base64ToBytes(s);
  if (!b) throw new Error("invalid base64 in " + field);
  return b;
}
function wrapHex(h, cols = 32) {
  const lines = [];
  for (let i = 0; i < h.length; i += cols)
    lines.push(h.slice(i, i + cols));
  return lines.join("\n");
}
function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── State ───────────────────────────────────────────────────────
let myKeys = null; // { secretKey: Uint8Array(32), pkBytes: Uint8Array(32) }
let sharedKey = null; // Uint8Array(32), XChaCha20Poly1305 key
let roomCode = "";
let myName = "";
let wsConn = null;
let mySendSeq = 0;
let peerName = "";
let peerSeqSeen = 0;
let peerPk = null;
let lastRelayBlob = null; // raw payload string, for replay demo
let keyExchangeDone = false;

// ── Phase management ────────────────────────────────────────────
function showPhase(name) {
  ["setup", "exchange", "chat"].forEach((p) => {
    const el = document.getElementById("phase-" + p);
    el.hidden = p !== name;
  });
}

// ── Phase 1: Connect ────────────────────────────────────────────
async function connect() {
  myName = document.getElementById("inp-name").value.trim();
  if (!myName) {
    setStatus("enter a display name", "err");
    return;
  }

  const joining = document.getElementById("mode-join").checked;
  const joinCode = joining
    ? document.getElementById("inp-code").value.trim().toUpperCase()
    : "";
  if (joining && joinCode.length !== 6) {
    setStatus("enter a 6-character room code", "err");
    return;
  }

  // Generate an ephemeral X25519 keypair via leviathan-crypto
  try {
    const x = new X25519();
    const kp = x.keygen(); // { publicKey: 32B, secretKey: 32B }
    x.dispose();
    myKeys = { secretKey: kp.secretKey, pkBytes: kp.publicKey };
  } catch (err) {
    setStatus("keypair generation failed: " + err.message, "err");
    return;
  }

  // Show public key
  const pkEl = document.getElementById("pub-key-display");
  pkEl.textContent = hexStr(myKeys.pkBytes);
  pkEl.classList.remove("empty");

  // Connect to relay server
  document.getElementById("btn-connect").disabled = true;
  setStatus("connecting...", "");

  const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
  const wsHost = location.host || "localhost:3000";
  wsConn = new WebSocket(`${wsProto}//${wsHost}/relay`);

  wsConn.onopen = () => {
    wsConn.send(JSON.stringify({ type: "join", room: joinCode }));
  };

  wsConn.onmessage = (evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }
    handleServerMessage(msg);
  };

  wsConn.onerror = () => {
    setStatus(
      "connection error, is the server running? (cd server && bun start)",
      "err",
    );
    document.getElementById("btn-connect").disabled = false;
  };

  wsConn.onclose = () => {
    if (keyExchangeDone) onPeerLeft();
  };
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case "joined":
      onJoined(msg.room, msg.peerCount);
      break;
    case "peer_joined":
      onPeerJoined();
      break;
    case "relay":
      onRelay(msg.payload);
      break;
    case "peer_left":
      onPeerLeft();
      break;
    case "error":
      setStatus("server: " + msg.message, "err");
      break;
  }
}

function onJoined(room, peerCount) {
  roomCode = room;
  if (peerCount === 1) {
    document.getElementById("room-code-display").textContent = room;
    document.getElementById("room-code-section").hidden = false;
    setStatus("waiting for peer...", "");
  }
  // peerCount === 2 means we joined an existing room; peer_joined follows immediately
}

// ── Phase 2: Key Exchange ───────────────────────────────────────
function onPeerJoined() {
  showPhase("exchange");
  document.getElementById("exc-room-code").textContent = roomCode;
  document.getElementById("exc-my-pk").textContent = hexStr(
    myKeys.pkBytes,
  );

  setExchangeStep(1, true, "✓ your keypair generated");
  setExchangeStep(2, true, "✓ peer connected");

  // Send our public key to the peer
  sendPubkey();
}

function sendPubkey() {
  const zeros24 = new Uint8Array(24);
  const zeros16 = new Uint8Array(16);
  const payload = btoa(
    JSON.stringify({
      msgType: "pubkey",
      nonce: bytesToBase64(zeros24),
      tag: bytesToBase64(zeros16),
      ciphertext: bytesToBase64(myKeys.pkBytes),
      aad: "",
    }),
  );
  wsConn.send(JSON.stringify({ type: "relay", room: roomCode, payload }));
}

async function onRelay(payload) {
  let encMsg;
  try {
    encMsg = JSON.parse(atob(payload));
  } catch {
    if (keyExchangeDone)
      appendSystemMsg(
        "⚠ received malformed message (parse error), discarded",
      );
    return;
  }
  if (encMsg.msgType === "pubkey") {
    await onPubkey(encMsg);
  } else if (encMsg.msgType === "chat") {
    onChat(encMsg, payload);
  } else {
    if (keyExchangeDone)
      appendSystemMsg(
        "⚠ unknown message type: " + String(encMsg.msgType),
      );
  }
}

async function onPubkey(encMsg) {
  try {
    // Public keys are not secret; skip tag verification for pubkey messages
    peerPk = mustB64(encMsg.ciphertext, "pubkey");

    document.getElementById("exc-peer-pk").textContent = hexStr(peerPk);
    setExchangeStep(3, true, "✓ public keys exchanged");

    // X25519 Diffie-Hellman via leviathan-crypto. dh() rejects an
    // all-zero shared secret (small-order peer key) by throwing.
    const x = new X25519();
    const dh = x.dh(myKeys.secretKey, peerPk);
    x.dispose();

    // Don't use the raw DH output as the key directly; run it through
    // HKDF-SHA256 (salt-less is fine for a fresh ephemeral exchange) so
    // the symmetric key is uniformly distributed and domain-separated.
    const hk = new HKDF_SHA256();
    sharedKey = hk.derive(dh, null, HKDF_INFO, 32);
    hk.dispose();
    wipe(dh);

    setExchangeStep(4, true, "✓ shared secret derived");
    document.getElementById("exc-secret-status").textContent =
      "✓ ESTABLISHED";
    document.getElementById("exc-secret-note").hidden = false;

    keyExchangeDone = true;

    // Auto-advance to Phase 3 after 1.5 seconds
    setTimeout(startChat, 1500);
  } catch {
    appendSystemMsg(
      "⚠ key exchange failed, invalid public key (discarded)",
    );
  }
}

function setExchangeStep(n, done, text) {
  const el = document.getElementById("exc-step-" + n);
  el.className = "exc-step " + (done ? "done" : "pending");
  el.querySelector(".exc-step-icon").textContent = done ? "✓" : "◌";
  el.querySelector(".exc-step-text").textContent = text;
}

// ── Phase 3: Chat ───────────────────────────────────────────────
function startChat() {
  document.getElementById("chat-room-code").textContent = roomCode;
  document.getElementById("chat-my-name").textContent = myName;
  showPhase("chat");
  const inp = document.getElementById("inp-message");
  inp.disabled = false;
  inp.placeholder = "type a message... (Enter to send)";
  inp.focus();
  document.getElementById("btn-send").disabled = false;
}

function sendMessage() {
  if (!sharedKey || !wsConn || wsConn.readyState !== 1) return;
  const inp = document.getElementById("inp-message");
  const text = inp.value.trim();
  if (!text) return;

  mySendSeq++;
  const aadObj = {
    sender: myName,
    sequence: mySendSeq,
    timestamp: Date.now(),
    roomCode,
  };
  const aadBytes = new TextEncoder().encode(JSON.stringify(aadObj));
  const plainBytes = new TextEncoder().encode(text);
  const nonce = randomBytes(24);

  const _cipher = new XChaCha20Poly1305();
  const sealed = _cipher.encrypt(sharedKey, nonce, plainBytes, aadBytes);
  _cipher.dispose();
  const ciphertext = sealed.slice(0, -16);
  const tag = sealed.slice(-16);

  const payload = btoa(
    JSON.stringify({
      msgType: "chat",
      nonce: bytesToBase64(nonce),
      tag: bytesToBase64(tag),
      ciphertext: bytesToBase64(ciphertext),
      aad: bytesToBase64(aadBytes),
    }),
  );

  wsConn.send(JSON.stringify({ type: "relay", room: roomCode, payload }));
  appendMessage(myName, text, aadObj.timestamp, true);
  inp.value = "";
  inp.focus();
}

function onChat(encMsg, rawPayload) {
  // Store for replay demo
  lastRelayBlob = rawPayload;

  let nonce, tag, ciphertext, aadBytes;
  try {
    nonce = mustB64(encMsg.nonce, "nonce");
    tag = mustB64(encMsg.tag, "tag");
    ciphertext = mustB64(encMsg.ciphertext, "ciphertext");
    aadBytes = mustB64(encMsg.aad, "aad");
  } catch {
    appendSystemMsg(
      "⚠ message authentication failed, malformed fields (discarded)",
    );
    return;
  }

  let aadObj;
  try {
    aadObj = JSON.parse(new TextDecoder().decode(aadBytes));
  } catch {
    appendSystemMsg(
      "⚠ message authentication failed, invalid AAD (discarded)",
    );
    return;
  }

  // Verify tag and decrypt; XChaCha20Poly1305.decrypt() always verifies before returning
  const _decipher = new XChaCha20Poly1305();
  let plaintext;
  try {
    const sealedForDecrypt = new Uint8Array(
      ciphertext.length + tag.length,
    );
    sealedForDecrypt.set(ciphertext, 0);
    sealedForDecrypt.set(tag, ciphertext.length);
    plaintext = _decipher.decrypt(
      sharedKey,
      nonce,
      sealedForDecrypt,
      aadBytes,
    );
  } catch {
    appendSystemMsg("⚠ message authentication failed, discarded");
    _decipher.dispose();
    return;
  }
  _decipher.dispose();

  // Replay detection: check sequence number per sender.
  // Two cases:
  //   1. Message claiming to be from ME (self-replay): seq <= mySendSeq
  //   2. Message from peer replayed again: seq <= peerSeqSeen
  const seq = Number(aadObj.sequence);
  const isSelfMsg = aadObj.sender === myName;
  const isReplay = isSelfMsg ? seq <= mySendSeq : seq <= peerSeqSeen;
  const currentSeq = isSelfMsg ? mySendSeq : peerSeqSeen;

  if (isReplay) {
    appendReplayMsg(aadObj, seq, currentSeq);
    updateInspector(
      encMsg,
      aadObj,
      nonce,
      tag,
      ciphertext,
      rawPayload,
      true,
    );
    return;
  }
  if (!isSelfMsg) {
    peerSeqSeen = seq;
    if (!peerName && aadObj.sender) peerName = aadObj.sender;
  }

  const text = new TextDecoder().decode(plaintext);
  appendMessage(aadObj.sender, text, aadObj.timestamp);
  updateInspector(
    encMsg,
    aadObj,
    nonce,
    tag,
    ciphertext,
    rawPayload,
    false,
  );
}

function replayLastMessage() {
  if (!lastRelayBlob || !wsConn || wsConn.readyState !== 1) return;
  wsConn.send(
    JSON.stringify({
      type: "relay",
      room: roomCode,
      payload: lastRelayBlob,
    }),
  );
}

// ── Inspector ───────────────────────────────────────────────────
function updateInspector(
  encMsg,
  aadObj,
  nonce,
  tag,
  ciphertext,
  rawPayload,
  isReplay,
) {
  document.getElementById("insp-empty").hidden = true;
  document.getElementById("insp-content").hidden = false;

  document.getElementById("insp-nonce").textContent = wrapHex(
    hexStr(nonce),
  );
  document.getElementById("insp-aad").textContent = JSON.stringify(
    aadObj,
    null,
    2,
  );
  document.getElementById("insp-tag").textContent = wrapHex(hexStr(tag));

  const ctHex = hexStr(ciphertext);
  const ctDisplay =
    ctHex.length > 64 ? ctHex.slice(0, 64) + "..." : ctHex;
  document.getElementById("insp-ct").textContent = ctDisplay;
  document.getElementById("insp-ct-len").textContent =
    "(" + ciphertext.length + " bytes)";

  // Show what the server saw (the JSON relay frame with payload truncated for display)
  const truncPl =
    rawPayload.length > 40 ? rawPayload.slice(0, 40) + "..." : rawPayload;
  document.getElementById("insp-server-saw").textContent = JSON.stringify(
    { type: "relay", room: roomCode, payload: truncPl },
  );

  document.getElementById("insp-replay-badge").hidden = !isReplay;
  const statusEl = document.getElementById("insp-status");
  statusEl.textContent = isReplay
    ? "✓ tag verified · ⚠ replayed sequence, discarded"
    : "✓ tag verified · ✓ decrypted";
  statusEl.className = "insp-status " + (isReplay ? "warn" : "ok");

  document.getElementById("btn-replay").disabled = false;
}

// ── Message panel helpers ───────────────────────────────────────
function appendMessage(sender, text, timestamp, isOwn = false) {
  const t = new Date(timestamp).toTimeString().slice(0, 8);
  const el = document.createElement("div");
  el.className = isOwn ? "msg msg-own" : "msg";
  el.innerHTML =
    `<span class="msg-time">[${t}]</span>` +
    `<span class="msg-sender">${escHtml(sender)}</span>` +
    `<span class="msg-text">${escHtml(text)}</span>`;
  document.getElementById("msg-list").appendChild(el);
  scrollToBottom();
}

function appendSystemMsg(text) {
  const el = document.createElement("div");
  el.className = "msg msg-sys";
  el.textContent = text;
  document.getElementById("msg-list").appendChild(el);
  scrollToBottom();
}

function appendReplayMsg(aadObj, seq, currentSeq) {
  const el = document.createElement("div");
  el.className = "msg msg-replay";
  el.innerHTML =
    `<div class="replay-warn">⚠ REPLAY ATTACK DETECTED</div>` +
    `<div class="replay-detail">sequence ${seq} already seen (current: ${currentSeq})</div>` +
    `<div class="replay-detail">tag verified, message is authentic but was already processed</div>` +
    `<div class="replay-detail">discarded</div>`;
  document.getElementById("msg-list").appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  const list = document.getElementById("msg-list");
  list.scrollTop = list.scrollHeight;
}

// ── Disconnection ───────────────────────────────────────────────
function onPeerLeft() {
  if (!keyExchangeDone) return;
  appendSystemMsg("── peer disconnected ──");
  const inp = document.getElementById("inp-message");
  const send = document.getElementById("btn-send");
  inp.disabled = true;
  send.disabled = true;
  inp.placeholder = "peer disconnected";
  document.getElementById("reconnect-section").hidden = false;
  // Wipe key material and WASM cipher state.
  // Safe to dispose here: reconnect calls location.reload() which creates a fresh instance.
  if (sharedKey) {
    sharedKey.fill(0);
    sharedKey = null;
  }
}

function setStatus(msg, type) {
  const el = document.getElementById("setup-status");
  el.textContent = msg;
  el.className = "setup-status" + (type ? " " + type : "");
}

// ── Event wiring ────────────────────────────────────────────────
document.getElementById("btn-connect").addEventListener("click", connect);
document
  .getElementById("btn-send")
  .addEventListener("click", sendMessage);
document
  .getElementById("inp-message")
  .addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
document
  .getElementById("btn-replay")
  .addEventListener("click", replayLastMessage);
document
  .getElementById("btn-new-session")
  .addEventListener("click", () => location.reload());

// Show/hide room code input based on mode selection
document.querySelectorAll("input[name=mode]").forEach((radio) => {
  radio.addEventListener("change", () => {
    document.getElementById("join-code-row").hidden =
      !document.getElementById("mode-join").checked;
  });
});
