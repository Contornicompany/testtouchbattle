const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 10000,
  pingInterval: 3000
});

app.use(express.static(path.join(__dirname, 'public')));

// ── Stanze in memoria ──
// rooms[code] = { code, players: { socketId: {id, name, color, emoji, score, ready, host} }, started: bool }
const rooms = {};
const COLORS = ['#ff2752','#00e5ff','#ffe600','#00ff88','#ff7a00','#cc44ff','#ff88aa','#44ffcc'];
const EMOJIS = ['🔥','⚡','💎','🌟','👾','🚀','🎯','💥'];

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function getRoomPlayers(code) {
  return rooms[code] ? Object.values(rooms[code].players) : [];
}

function broadcastRoom(code, event, data, excludeId = null) {
  if (!rooms[code]) return;
  Object.keys(rooms[code].players).forEach(sid => {
    if (sid !== excludeId) {
      io.to(sid).emit(event, data);
    }
  });
}

function broadcastRoomAll(code, event, data) {
  if (!rooms[code]) return;
  io.to(code).emit(event, data);
}

io.on('connection', (socket) => {
  console.log('Connect:', socket.id);

  // ── Crea stanza ──
  socket.on('create_room', ({ name }, cb) => {
    let code;
    do { code = genCode(); } while (rooms[code]);

    const idx = 0;
    rooms[code] = {
      code,
      players: {
        [socket.id]: {
          id: socket.id,
          name: (name || 'PLAYER').substring(0, 12).toUpperCase(),
          color: COLORS[idx],
          emoji: EMOJIS[idx],
          score: 0,
          ready: true,
          host: true
        }
      },
      started: false
    };

    socket.join(code);
    socket.data.roomCode = code;
    console.log('Room created:', code, 'by', name);

    cb({ ok: true, code, player: rooms[code].players[socket.id] });
    broadcastRoomAll(code, 'players_update', getRoomPlayers(code));
  });

  // ── Entra in stanza ──
  socket.on('join_room', ({ name, code }, cb) => {
    code = (code || '').toUpperCase().trim();
    if (!rooms[code]) { cb({ ok: false, error: 'Stanza non trovata: ' + code }); return; }
    if (Object.keys(rooms[code].players).length >= 8) { cb({ ok: false, error: 'Stanza piena (max 8)' }); return; }
    if (rooms[code].started) { cb({ ok: false, error: 'Partita già iniziata' }); return; }

    const idx = Object.keys(rooms[code].players).length;
    rooms[code].players[socket.id] = {
      id: socket.id,
      name: (name || 'PLAYER').substring(0, 12).toUpperCase(),
      color: COLORS[idx % COLORS.length],
      emoji: EMOJIS[idx % EMOJIS.length],
      score: 0,
      ready: false,
      host: false
    };

    socket.join(code);
    socket.data.roomCode = code;
    console.log('Joined:', code, 'by', name);

    cb({ ok: true, code, player: rooms[code].players[socket.id] });
    broadcastRoomAll(code, 'players_update', getRoomPlayers(code));
  });

  // ── Pronto ──
  socket.on('set_ready', ({ ready }) => {
    const code = socket.data.roomCode;
    if (!rooms[code]?.players[socket.id]) return;
    rooms[code].players[socket.id].ready = ready;
    broadcastRoomAll(code, 'players_update', getRoomPlayers(code));
  });

  // ── Avvia gioco (solo host) ──
  socket.on('start_game', ({ gameId, seed }) => {
    const code = socket.data.roomCode;
    if (!rooms[code]) return;
    const p = rooms[code].players[socket.id];
    if (!p?.host) return;
    rooms[code].started = true;
    // Reset scores
    Object.values(rooms[code].players).forEach(pl => pl.score = 0);
    broadcastRoomAll(code, 'game_start', { gameId, seed });
    console.log('Game started:', code, gameId);
  });

  // ── Messaggi di gioco (relay generico) ──
  socket.on('game_msg', (msg) => {
    const code = socket.data.roomCode;
    if (!rooms[code]) return;
    msg.sid = socket.id;
    // Relay a tutti gli altri nella stanza
    socket.to(code).emit('game_msg', msg);
  });

  // ── Aggiorna score ──
  socket.on('update_score', ({ score }) => {
    const code = socket.data.roomCode;
    if (!rooms[code]?.players[socket.id]) return;
    rooms[code].players[socket.id].score = score;
    socket.to(code).emit('score_update', { id: socket.id, score });
  });

  // ── Fine gioco ──
  socket.on('game_over', () => {
    const code = socket.data.roomCode;
    if (!rooms[code]) return;
    const p = rooms[code].players[socket.id];
    if (!p?.host) return;
    rooms[code].started = false;
    broadcastRoomAll(code, 'game_over', getRoomPlayers(code));
  });

  // ── Disconnessione ──
  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code || !rooms[code]) return;
    const wasHost = rooms[code].players[socket.id]?.host;
    delete rooms[code].players[socket.id];
    console.log('Disconnect:', socket.id, 'from', code);

    if (Object.keys(rooms[code].players).length === 0) {
      delete rooms[code];
      console.log('Room deleted:', code);
      return;
    }

    // Passa host al prossimo
    if (wasHost) {
      const newHostId = Object.keys(rooms[code].players)[0];
      rooms[code].players[newHostId].host = true;
    }

    broadcastRoomAll(code, 'players_update', getRoomPlayers(code));
  });
});

// Pulizia stanze vecchie ogni 30 minuti
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach(code => {
    if (Object.keys(rooms[code].players).length === 0) delete rooms[code];
  });
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Touch Battle server on port', PORT));
