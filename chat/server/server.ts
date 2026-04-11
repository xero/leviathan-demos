// /////////////////////////////////////////////////////////////////////////////
// lvthn-chat relay server
//
// A dumb WebSocket relay: accepts connections, assigns room codes, forwards
// encrypted blobs between the two clients in a room.
//
// SECURITY CONTRACT:
//   - The server never parses or logs payload content.
//   - All crypto happens in the browser — the server cannot read plaintext.
//   - Room codes provide routing, not security.
// /////////////////////////////////////////////////////////////////////////////

// Room code alphabet — no ambiguous characters (O, 0, 1, I removed)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 6;

interface WsData {
  roomCode: string;
  slot:     0 | 1;  // which slot in the room (0 = first, 1 = second)
}

// rooms[code] = [slot0_ws, slot1_ws | null]
const rooms = new Map<string, [{ data: WsData; send(msg: string): number; }, { data: WsData; send(msg: string): number; } | null]>();

function generateRoomCode(): string {
	let code = '';
	const bytes = new Uint8Array(CODE_LEN);
	crypto.getRandomValues(bytes);
	for (let i = 0; i < CODE_LEN; i++) {
		code += ALPHABET[bytes[i] % ALPHABET.length];
	}
	// Retry on collision (extremely rare)
	return rooms.has(code) ? generateRoomCode() : code;
}

function send(ws: { data: WsData; send(msg: string): number; }, obj: object): void {
	ws.send(JSON.stringify(obj));
}

function getPeer(ws: { data: WsData; send(msg: string): number; }): { data: WsData; send(msg: string): number; } | null {
	const room = rooms.get(ws.data.roomCode);
	if (!room) return null;
	return room[ws.data.slot === 0 ? 1 : 0] ?? null;
}

const server = Bun.serve<WsData>({
	port: 3000,

	fetch(req, server) {
		const upgraded = server.upgrade(req, { data: { roomCode: '', slot: 0 } });
		if (upgraded) return;
		return new Response('lvthn-chat relay server — connect via WebSocket', { status: 200 });
	},

	websocket: {
		data: {} as WsData,

		open(_ws) {
			// Nothing to do yet — wait for 'join' message
		},

		message(ws, raw) {
			let msg: { type: string; room?: string; payload?: string };
			try {
				msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
			} catch {
				send(ws, { type: 'error', message: 'invalid JSON' });
				return;
			}

			switch (msg.type) {
			case 'join': {
				const requestedCode = (msg.room ?? '').trim().toUpperCase();

				if (requestedCode === '') {
					// Create a new room
					const code = generateRoomCode();
					rooms.set(code, [ws, null]);
					ws.data.roomCode = code;
					ws.data.slot = 0;
					send(ws, { type: 'joined', room: code, peerCount: 1 });
					console.log(`[room ${code}] created`);
				} else {
					// Join an existing room
					const room = rooms.get(requestedCode);
					if (!room) {
						send(ws, { type: 'error', message: 'room not found' });
						return;
					}
					if (room[1] !== null) {
						send(ws, { type: 'error', message: 'room is full' });
						return;
					}
					room[1] = ws;
					ws.data.roomCode = requestedCode;
					ws.data.slot = 1;
					// Notify both
					send(ws,     { type: 'joined',     room: requestedCode, peerCount: 2 });
					send(room[0], { type: 'peer_joined' });
					send(ws,     { type: 'peer_joined' });
					console.log(`[room ${requestedCode}] peer joined — session ready`);
				}
				break;
			}

			case 'relay': {
				const peer = getPeer(ws);
				if (!peer) {
					send(ws, { type: 'error', message: 'no peer connected' });
					return;
				}
				// relay only — never log payload
				peer.send(JSON.stringify({ type: 'relay', payload: msg.payload }));
				break;
			}

			default:
				send(ws, { type: 'error', message: `unknown message type: ${msg.type}` });
			}
		},

		close(ws) {
			const { roomCode, slot } = ws.data;
			if (!roomCode) return;

			const room = rooms.get(roomCode);
			if (!room) return;

			const peer = room[slot === 0 ? 1 : 0];

			if (peer) {
				// Notify the remaining peer
				send(peer, { type: 'peer_left' });
				// Remove disconnected slot; keep room alive for the remaining peer
				if (slot === 0) {
					// Promote peer to slot 0 so getPeer() still works
					rooms.set(roomCode, [peer, null]);
					peer.data.slot = 0;
				} else {
					rooms.set(roomCode, [room[0], null]);
				}
				console.log(`[room ${roomCode}] one peer left — room open`);
			} else {
				// Last client — delete the room
				rooms.delete(roomCode);
				console.log(`[room ${roomCode}] all peers left — room closed`);
			}
		},
	},
});

console.log('lvthn-chat relay server');
console.log(`listening on ws://localhost:${server.port}`);
console.log('server sees only encrypted blobs — plaintext never leaves the browser');
