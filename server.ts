// server.ts — unified server for leviathan.3xi.club
//
// Routes:
//   GET  /        → library landing page
//   GET  /demos   → demos landing page
//   GET  /web     → lvthn-web (Serpent-256 encryption tool)
//   GET  /chat    → lvthn-chat client
//   GET  /relay   → WebSocket relay for lvthn-chat
//
// SECURITY CONTRACT (relay):
//   - The server never parses or logs payload content.
//   - All crypto happens in the browser — plaintext never leaves the client.
//   - Room codes provide routing, not security.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN  = 6;

interface WsData {
  roomCode: string;
  slot:     0 | 1;
}

const rooms = new Map<string, [
  { data: WsData; send(msg: string): number },
  { data: WsData; send(msg: string): number } | null
]>();

function generateRoomCode(): string {
  let code = '';
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < CODE_LEN; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return rooms.has(code) ? generateRoomCode() : code;
}

function send(ws: { data: WsData; send(msg: string): number }, obj: object): void {
  ws.send(JSON.stringify(obj));
}

function getPeer(ws: { data: WsData; send(msg: string): number }) {
  const room = rooms.get(ws.data.roomCode);
  if (!room) return null;
  return room[ws.data.slot === 0 ? 1 : 0] ?? null;
}

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

const server = Bun.serve<WsData>({
  port: PORT,

  async fetch(req, server) {
    const { pathname } = new URL(req.url);

    // WebSocket upgrade — relay only
    if (pathname === '/relay') {
      const ok = server.upgrade(req, { data: { roomCode: '', slot: 0 } });
      if (ok) return undefined;
      return new Response('WebSocket endpoint — connect via ws://', { status: 200 });
    }

    // Static routes
    const routes: Record<string, string> = {
      '/':      './public/index.html',
      '/demos': './public/demos.html',
      '/web':   './public/lvthn.html',
      '/chat':  './public/lvthn-chat.html',
    };

    const file = routes[pathname];
    if (file) {
      const f = Bun.file(file);
      if (await f.exists()) {
        return new Response(f, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },

  websocket: {
    data: {} as WsData,

    open(_ws) {},

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
            const code = generateRoomCode();
            rooms.set(code, [ws, null]);
            ws.data.roomCode = code;
            ws.data.slot = 0;
            send(ws, { type: 'joined', room: code, peerCount: 1 });
            console.log(`[room ${code}] created`);
          } else {
            const room = rooms.get(requestedCode);
            if (!room) { send(ws, { type: 'error', message: 'room not found' }); return; }
            if (room[1] !== null) { send(ws, { type: 'error', message: 'room is full' }); return; }
            room[1] = ws;
            ws.data.roomCode = requestedCode;
            ws.data.slot = 1;
            send(ws,      { type: 'joined',      room: requestedCode, peerCount: 2 });
            send(room[0], { type: 'peer_joined' });
            send(ws,      { type: 'peer_joined' });
            console.log(`[room ${requestedCode}] peer joined — session ready`);
          }
          break;
        }
        case 'relay': {
          const peer = getPeer(ws);
          if (!peer) { send(ws, { type: 'error', message: 'no peer connected' }); return; }
          peer.send(JSON.stringify({ type: 'relay', payload: msg.payload }));
          break;
        }
        default:
          send(ws, { type: 'error', message: `unknown type: ${msg.type}` });
      }
    },

    close(ws) {
      const { roomCode, slot } = ws.data;
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;
      const peer = room[slot === 0 ? 1 : 0];
      if (peer) {
        send(peer, { type: 'peer_left' });
        if (slot === 0) { rooms.set(roomCode, [peer, null]); peer.data.slot = 0; }
        else            { rooms.set(roomCode, [room[0], null]); }
        console.log(`[room ${roomCode}] one peer left — room open`);
      } else {
        rooms.delete(roomCode);
        console.log(`[room ${roomCode}] all peers left — room closed`);
      }
    },
  },
});

console.log(`leviathan server listening on port ${PORT}`);
console.log('routes: / /demos /web /chat /relay');
