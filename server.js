const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 15000,
  pingInterval: 5000
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

const TEAM_COLORS = ['#ff2752','#00e5ff','#ffe600','#00ff88','#ff7a00','#cc44ff','#ff88bb','#44ffdd'];
const TEAM_EMOJIS = ['🔥','⚡','💎','🌟','🍸','🎯','🎭','🚀'];

function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function getPlayers(code) {
  return rooms[code] ? Object.values(rooms[code].players) : [];
}

function getTeams(code) {
  return rooms[code] ? rooms[code].teams : [];
}

function broadcastAll(code, event, data) {
  io.to(code).emit(event, data);
}

io.on('connection', (socket) => {

  // HOST creates room (is the master screen)
  socket.on('create_room', ({ name }, cb) => {
    let code;
    do { code = genCode(); } while (rooms[code]);
    rooms[code] = {
      code,
      players: {
        [socket.id]: {
          id: socket.id, name: (name||'HOST').substring(0,14).toUpperCase(),
          color: '#ffffff', emoji: '👑', score: 0,
          teamId: null, host: true, isScreen: true
        }
      },
      teams: [],
      started: false,
      eveningScores: {}, // teamId → total points for the evening
      currentGame: null,
      judgeId: socket.id
    };
    socket.join(code);
    socket.data.roomCode = code;
    cb({ ok: true, code, playerId: socket.id });
    broadcastAll(code, 'room_update', { players: getPlayers(code), teams: getTeams(code), code });
  });

  // PLAYER joins room
  socket.on('join_room', ({ name, code }, cb) => {
    code = (code||'').toUpperCase().trim();
    if (!rooms[code]) { cb({ ok: false, error: 'Stanza non trovata' }); return; }
    const count = Object.keys(rooms[code].players).length;
    if (count >= 32) { cb({ ok: false, error: 'Stanza piena' }); return; }
    rooms[code].players[socket.id] = {
      id: socket.id, name: (name||'PLAYER').substring(0,14).toUpperCase(),
      color: TEAM_COLORS[count % TEAM_COLORS.length],
      emoji: TEAM_EMOJIS[count % TEAM_EMOJIS.length],
      score: 0, teamId: null, host: false, isScreen: false
    };
    socket.join(code);
    socket.data.roomCode = code;
    cb({ ok: true, code, playerId: socket.id, player: rooms[code].players[socket.id] });
    broadcastAll(code, 'room_update', { players: getPlayers(code), teams: getTeams(code), code });
  });

  // HOST creates team
  socket.on('create_team', ({ name, color, emoji }, cb) => {
    const code = socket.data.roomCode;
    if (!rooms[code]) return;
    const id = 't_' + Date.now();
    rooms[code].teams.push({ id, name: name.toUpperCase(), color, emoji, score: 0, eveningScore: 0, members: [] });
    cb && cb({ ok: true, id });
    broadcastAll(code, 'room_update', { players: getPlayers(code), teams: getTeams(code), code });
  });

  // Assign player to team
  socket.on('join_team', ({ teamId, playerId }, cb) => {
    const code = socket.data.roomCode;
    if (!rooms[code]) return;
    const pid = playerId || socket.id;
    const p = rooms[code].players[pid];
    if (!p) return;
    // Remove from old team
    rooms[code].teams.forEach(t => { t.members = t.members.filter(m => m !== pid); });
    // Add to new team
    const team = rooms[code].teams.find(t => t.id === teamId);
    if (team) { team.members.push(pid); p.teamId = teamId; p.color = team.color; }
    cb && cb({ ok: true });
    broadcastAll(code, 'room_update', { players: getPlayers(code), teams: getTeams(code), code });
  });

  // Game message relay
  socket.on('game_msg', (msg) => {
    const code = socket.data.roomCode;
    if (!rooms[code]) return;
    msg.sid = socket.id;
    socket.to(code).emit('game_msg', msg);
  });

  // Host starts a game
  socket.on('start_game', ({ gameId, seed, config }) => {
    const code = socket.data.roomCode;
    if (!rooms[code]) return;
    rooms[code].started = true;
    rooms[code].currentGame = gameId;
    // Reset round scores
    Object.values(rooms[code].players).forEach(p => p.score = 0);
    rooms[code].teams.forEach(t => t.score = 0);
    broadcastAll(code, 'game_start', { gameId, seed, config, players: getPlayers(code), teams: getTeams(code) });
  });

  // Update player score
  socket.on('update_score', ({ score }) => {
    const code = socket.data.roomCode;
    if (!rooms[code]?.players[socket.id]) return;
    rooms[code].players[socket.id].score = score;
    // Also update team score
    const p = rooms[code].players[socket.id];
    if (p.teamId) {
      const team = rooms[code].teams.find(t => t.id === p.teamId);
      if (team) {
        team.score = rooms[code].teams.find(t=>t.id===p.teamId)?.members
          .reduce((sum, mid) => sum + (rooms[code].players[mid]?.score||0), 0);
      }
    }
    broadcastAll(code, 'scores_update', { players: getPlayers(code), teams: getTeams(code) });
  });

  // Host awards points manually (judge mode)
  socket.on('judge_award', ({ teamId, playerId, pts, reason }) => {
    const code = socket.data.roomCode;
    if (!rooms[code]) return;
    if (teamId) {
      const team = rooms[code].teams.find(t => t.id === teamId);
      if (team) { team.score += pts; team.eveningScore += pts; }
    }
    if (playerId) {
      const p = rooms[code].players[playerId];
      if (p) p.score += pts;
    }
    broadcastAll(code, 'judge_award', { teamId, playerId, pts, reason });
    broadcastAll(code, 'scores_update', { players: getPlayers(code), teams: getTeams(code) });
  });

  // End game — add to evening totals
  socket.on('game_over', ({ winners }) => {
    const code = socket.data.roomCode;
    if (!rooms[code]) return;
    // Add round points to evening totals
    rooms[code].teams.forEach(t => { t.eveningScore += t.score; });
    rooms[code].started = false;
    broadcastAll(code, 'game_over', {
      players: getPlayers(code),
      teams: getTeams(code),
      winners: winners || []
    });
  });

  socket.on('leave', () => handleDisconnect(socket));
  socket.on('disconnect', () => handleDisconnect(socket));

  function handleDisconnect(s) {
    const code = s.data?.roomCode;
    if (!code || !rooms[code]) return;
    const wasHost = rooms[code].players[s.id]?.host;
    // Remove from teams
    rooms[code].teams.forEach(t => { t.members = t.members.filter(m => m !== s.id); });
    delete rooms[code].players[s.id];
    if (Object.keys(rooms[code].players).length === 0) { delete rooms[code]; return; }
    if (wasHost) {
      const newId = Object.keys(rooms[code].players)[0];
      rooms[code].players[newId].host = true;
      rooms[code].judgeId = newId;
    }
    broadcastAll(code, 'room_update', { players: getPlayers(code), teams: getTeams(code), code });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('BarNight server on port', PORT));
