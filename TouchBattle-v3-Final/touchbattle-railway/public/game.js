// ═══════════════════════════════════════════
//  SOCKET.IO
// ═══════════════════════════════════════════
const socket = io({ transports: ['websocket', 'polling'] });
socket.on('connect', () => { setConn(true); toast('✅ Connesso!'); });
socket.on('disconnect', () => { setConn(false); toast('⚠️ Disconnesso...'); });
socket.on('connect_error', () => setConn(false));
socket.on('players_update', pl => { players = {}; pl.forEach(p => players[p.id] = p); renderLobby(); updateMiniLb(); });
socket.on('game_start', ({ gameId, seed }) => { closePicker(); runCountdown(seed, gameId); });
socket.on('game_msg', msg => { if (msg.sid !== socket.id) handleGameMsg(msg); });
socket.on('score_update', ({ id, score }) => { if (players[id]) players[id].score = score; updateMiniLb(); updateRank(); renderFightScores(); renderShakeScores(); renderSlotScores(); renderRhythmScores(); renderMemScores(); });
socket.on('game_over', fp => { if (fp) { players = {}; fp.forEach(p => players[p.id] = p); } showResults(); });
function gMsg(msg) { msg.sid = socket.id; socket.emit('game_msg', msg); }
function setConn(ok) { const d = $('connDot'), l = $('connLbl'); if (d) d.className = 'conn-dot ' + (ok ? 'conn-ok' : 'conn-err'); if (l) l.textContent = ok ? 'server online ✓' : 'disconnesso'; }

// ═══════════════════════════════════════════
//  DATA
// ═══════════════════════════════════════════
const GAMES = [
  { id: 'tb',     name: 'TOUCH BATTLE',  icon: '🔴', desc: 'Cerchi, bombe, bonus classico',       badge: 'CLASSICO',  color: 'var(--r)' },
  { id: 'terr',   name: 'TERRITORIO',    icon: '🗺️', desc: 'Dipingi lo schermo col dito',         badge: 'STRATEGIA', color: 'var(--b)' },
  { id: 'snake',  name: 'SNAKE PvP',     icon: '🐍', desc: 'Mangia mele, evita gli altri',        badge: 'ARCADE',    color: 'var(--g)' },
  { id: 'rhythm', name: 'RHYTHM BATTLE', icon: '🎵', desc: 'Tocca le note al momento giusto',     badge: 'MUSICA',    color: 'var(--p)' },
  { id: 'slot',   name: 'SLOT BATTLE',   icon: '🎰', desc: 'Gira e abbina i simboli',             badge: 'FORTUNA',   color: 'var(--y)' },
  { id: 'memory', name: 'MEMORY SPEED',  icon: '🧠', desc: 'Abbina le coppie più veloce',         badge: 'MEMORIA',   color: 'var(--pk)' },
  { id: 'mine',   name: 'MINE PvP',      icon: '💣', desc: 'Scava il campo senza esplodere',      badge: 'TATTICA',   color: 'var(--o)' },
  { id: 'fight',  name: 'SCONTRO',       icon: '👊', desc: 'Chi tocca prima vince il round',      badge: 'RIFLESSI',  color: 'var(--r)' },
  { id: 'shake',  name: 'SHAKE KING',    icon: '📳', desc: 'Agita più forte (btn iOS safe)',      badge: 'FISICO',    color: 'var(--g)' },
  { id: 'bluff',  name: 'BLUFF QUIZ',    icon: '🎭', desc: 'Trivia a tempo con streak bonus',     badge: 'QUIZ',      color: 'var(--b)' },
  { id: 'airh',   name: 'AIR HOCKEY',    icon: '🏒', desc: 'Campo unificato tra 2 schermi',       badge: '2 PLAYER',  color: '#00aaff' },
  { id: 'auto',   name: 'ROTAZIONE AUTO',icon: '🎲', desc: '5 giochi in sequenza automatica',     badge: 'MARATHON',  color: 'var(--p)' },
];
const QUIZ = [
  { q: "Quante lune ha Marte?",      opts: ["2","1","4","0"],                            a: 0 },
  { q: "Cos'è più veloce?",          opts: ["Luce","Suono","Aereo","Auto"],               a: 0 },
  { q: "Pizza Margherita: anno?",    opts: ["1889","1920","1850","1776"],                 a: 0 },
  { q: "Chitarra: quante corde?",    opts: ["6","5","7","4"],                             a: 0 },
  { q: "Capitale Australia?",        opts: ["Canberra","Sydney","Melbourne","Perth"],     a: 0 },
  { q: "Secondi in un'ora?",         opts: ["3600","1000","7200","600"],                  a: 0 },
  { q: "Anno primo sbarco luna?",    opts: ["1969","1975","1961","1980"],                 a: 0 },
  { q: "Lati di un esagono?",        opts: ["6","5","7","8"],                             a: 0 },
  { q: "Velocità luce km/s?",        opts: ["300.000","150.000","1.000.000","30.000"],    a: 0 },
  { q: "Pianeta più grande?",        opts: ["Giove","Saturno","Urano","Nettuno"],         a: 0 },
];
QUIZ.forEach(q => { const ca = q.opts[q.a]; q.opts = q.opts.sort(() => Math.random() - .5); q.a = q.opts.indexOf(ca); });

const COLORS = ['#ff2752','#00e5ff','#ffe600','#00ff88','#ff7a00','#cc44ff','#ff88aa','#44ffcc'];
const EMOJIS = ['🔥','⚡','💎','🌟','👾','🚀','🎯','💥'];
const OBJ_T = [{ t:'circle',e:'🔴',w:5 },{ t:'bomb',e:'💣',w:2 },{ t:'speed',e:'⚡',w:2 },{ t:'freeze',e:'❄️',w:1 },{ t:'pass',e:'🎁',w:1.5 }];
const SLOT_SYMS = ['🍒','🍋','🍊','🍇','⭐','💎','7️⃣','🔔'];
const MEM_EMOJIS = ['🍕','🎸','🚀','🦄','🍦','🎯','⚡','💎'];

// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
let myId = socket.id, myName = '', isHost = false, roomCode = '', isReady = false;
let players = {}, myScore = 0, currentObjs = {}, gameTimer = null, objTimer = null;
let timeLeft = 60, isFrozen = false, currentGame = 'tb', chaosMode = false;
let fightWaiting = true, fightTimerLeft = 60, fightInterval = null, myFightScore = 0, fightSignalTime = 0, fightRound = 0;
let shakeScore = 0, shakePower = 0, shakeTimeLeft = 30, shakeTimer = null, shakeLastAcc = { x:0,y:0,z:0 }, lastShakeTime = 0;
let bluffScore = 0, bluffStreak = 0, bluffQIdx = 0, bluffAnswered = false, bluffQTimer = null, bluffTimeLeft = 10;
let autoGames = [], autoIdx = 0;
let terrCtx = null, terrTimer = null, terrTimeLeft = 60, terrDrawing = false, terrColor = '#ff2752';
let snakeCtx = null, snakes = {}, snakeFood = [], snakeTimer = null, snakeTimeLeft = 60, mySnakeDir = { x:1,y:0 }, snakeGrid = 20;
let rhythmTimeLeft = 60, rhythmScore = 0, rhythmNotes = [], rhythmTimer = null, rhythmSpawner = null, rhythmBpm = 120;
let slotTimer = null, slotTimeLeft = 60, slotSpinning = false, mySlotScore = 0;
let memCards = [], memFlipped = [], memMatched = [], memLocked = false, memTimer = null, memTimeLeft = 60, memScore = 0;
let mineBoard = [], mineCols = 9, mineRows = 9, mineScore = 0, mineTimer = null, mineTimeLeft = 60, mineLongPress = null;
let proxActive = false, proxInterval = null, holdTimer = null;
let lastTiltB = 0, lastTiltG = 0;

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
const $ = id => document.getElementById(id);
const ss = id => { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); };
let toastT = null;
const toast = m => { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); };
let fxT = null;
const fx = (m, c) => { const b = $('fxb'); b.textContent = m; b.style.color = c; b.style.borderColor = c + '44'; b.classList.add('show'); clearTimeout(fxT); fxT = setTimeout(() => b.classList.remove('show'), 2400); };
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch(e) {} };

let AC = null;
const ga = () => { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; };
const tone = (f, t, d, v = .3) => { try { const c = ga(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = t; o.frequency.value = f; g.gain.setValueAtTime(v, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + d); o.start(); o.stop(c.currentTime + d); } catch(e) {} };
const sHit   = () => { tone(660,'square',.1,.4); tone(880,'square',.08,.3); };
const sBomb  = () => { tone(120,'sawtooth',.3,.5); tone(80,'square',.2,.4); };
const sBonus = () => { [440,554,659,880].forEach((f,i) => setTimeout(() => tone(f,'sine',.15,.25), i*60)); };
const sFreeze= () => { [880,660,440,220].forEach((f,i) => setTimeout(() => tone(f,'triangle',.2,.2), i*80)); };
const sMerge = () => { [220,330,440,660,880,1100].forEach((f,i) => setTimeout(() => tone(f,'sine',.25,.4), i*80)); };
const sWin   = () => { [440,554,659,880,1100].forEach((f,i) => setTimeout(() => tone(f,'sine',.4,.3), i*120)); };

// ═══════════════════════════════════════════
//  ROOM
// ═══════════════════════════════════════════
function showP(p) { $('createPanel').style.display = p==='create' ? 'flex' : 'none'; $('joinPanel').style.display = p==='join' ? 'flex' : 'none'; }
function createRoom() { const n = ($('hName').value.trim()||'PLAYER').substring(0,12).toUpperCase(); myName = n; ss('connecting'); socket.emit('create_room', { name: n }, res => { if (!res.ok) { toast('❌ '+res.error); ss('home'); return; } myId = socket.id; roomCode = res.code; isHost = true; isReady = true; showLobby(); }); }
function joinRoom() { const n = ($('pName').value.trim()||'PLAYER').substring(0,12).toUpperCase(); const c = $('codeIn').value.trim().toUpperCase(); if (c.length !== 4) { toast('⚠️ Codice 4 caratteri'); return; } myName = n; ss('connecting'); socket.emit('join_room', { name: n, code: c }, res => { if (!res.ok) { toast('❌ '+res.error); ss('home'); return; } myId = socket.id; roomCode = res.code; isHost = false; isReady = false; showLobby(); toast('🎮 Connesso a '+c); }); }
function showLobby() { ss('lobby'); $('lobCode').textContent = roomCode; $('startBtn').style.display = isHost ? 'block' : 'none'; renderLobby(); }
function renderLobby() { const pa = Object.values(players); $('pCnt').textContent = 'GIOCATORI '+pa.length+'/8'; $('pList').innerHTML = pa.map(p => `<div class="pitem"><div class="picon" style="background:${p.color}22;color:${p.color};border:2px solid ${p.color}44;">${p.emoji}</div><div class="pname">${p.name}${p.id===myId?' (tu)':''}</div><div class="pbadge ${p.host?'b-host':p.ready?'b-ready':'b-wait'}">${p.host?'HOST':p.ready?'PRONTO':'ATTESA'}</div></div>`).join(''); }
function toggleReady() { isReady = !isReady; if (players[myId]) players[myId].ready = isReady; const b = $('readyBtn'); b.textContent = isReady ? '✓ PRONTO!' : '✓ SONO PRONTO'; b.style.opacity = isReady ? '.6' : '1'; socket.emit('set_ready', { ready: isReady }); renderLobby(); }
function goHome() { clearAllTimers(); stopPhysical(); socket.emit('leave'); players = {}; myScore = 0; isFrozen = false; chaosMode = false; $('chaosBar').style.display = 'none'; $('shakeBtn').classList.remove('visible'); $('createPanel').style.display = 'none'; $('joinPanel').style.display = 'none'; ss('home'); }

// ═══════════════════════════════════════════
//  PICKER
// ═══════════════════════════════════════════
function openPicker() { $('gList').innerHTML = GAMES.map(g => `<div class="grow" onclick="selectGame('${g.id}')" style="border-color:${g.color}33;"><div class="gicon">${g.icon}</div><div class="ginfo"><div class="gname" style="color:${g.color}">${g.name}</div><div class="gdesc">${g.desc}</div></div><div class="gbadge" style="background:${g.color}22;color:${g.color};border:1px solid ${g.color}44;">${g.badge}</div></div>`).join(''); $('picker').classList.add('open'); }
function closePicker() { $('picker').classList.remove('open'); }
function selectGame(id) { if (!isHost) return; closePicker(); currentGame = id; const seed = Math.floor(Math.random() * 100000); socket.emit('start_game', { gameId: id, seed }); }

// ═══════════════════════════════════════════
//  COUNTDOWN
// ═══════════════════════════════════════════
function runCountdown(seed, gameId) {
  const o = $('cdown'), n = $('cdownN'); o.classList.add('on'); n.style.color = 'var(--b)';
  let c = 3; n.textContent = c; tone(440,'sine',.3,.5);
  const iv = setInterval(() => { c--; if (c <= 0) { clearInterval(iv); n.textContent = 'GO!'; n.style.color = 'var(--y)'; sBonus(); n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; setTimeout(() => { o.classList.remove('on'); n.style.color = ''; launchGame(gameId, seed); }, 700); } else { n.textContent = c; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; tone(330,'sine',.3,.5); } }, 900);
}

// ═══════════════════════════════════════════
//  LAUNCH
// ═══════════════════════════════════════════
function launchGame(id, seed) {
  clearAllTimers(); stopPhysical(); myScore = 0; Object.values(players).forEach(p => p.score = 0); $('shakeBtn').classList.remove('visible');
  if (id === 'auto') { startAuto(seed); return; }
  chaosMode = (id === 'chaos'); $('chaosBar').style.display = chaosMode ? 'block' : 'none';
  startPhysical(id);
  const m = { tb: () => startTB(seed), chaos: () => startTB(seed), terr: startTerr, snake: () => startSnake(seed), rhythm: startRhythm, slot: startSlot, memory: startMemory, mine: startMine, fight: startFight, shake: startShake, bluff: startBluff, airh: startAirHockey };
  (m[id] || m.tb)();
}
function startAuto(seed) { autoIdx = 0; autoGames = ['tb','terr','rhythm','slot','memory','mine','fight','shake','bluff']; for (let i = autoGames.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [autoGames[i],autoGames[j]] = [autoGames[j],autoGames[i]]; } autoGames = autoGames.slice(0,5); nextAuto(); }
function nextAuto() { if (autoIdx >= autoGames.length) { socket.emit('game_over'); showResults(); return; } const gid = autoGames[autoIdx++]; fx('🎲 PROSSIMO: '+(GAMES.find(g => g.id === gid)?.name||gid), 'var(--p)'); setTimeout(() => { if (isHost) gMsg({ type:'auto_next', gameId: gid }); launchGame(gid, Date.now()); }, 1200); }

// ═══════════════════════════════════════════
//  PHYSICAL INTERACTIONS
// ═══════════════════════════════════════════
function startPhysical(gameId) {
  proxInterval = setInterval(() => { if (Object.keys(players).length > 1 && Math.random() < .01 && !proxActive) fireProx(); }, 700);
  if (window.DeviceOrientationEvent) window.addEventListener('deviceorientation', onTilt);
  document.addEventListener('touchstart', onHoldStart, { passive: true });
  document.addEventListener('touchend', onHoldEnd, { passive: true });
  if (gameId !== 'shake' && window.DeviceMotionEvent) window.addEventListener('devicemotion', onShakeDetect);
}
function stopPhysical() { clearInterval(proxInterval); window.removeEventListener('deviceorientation', onTilt); window.removeEventListener('devicemotion', onShakeDetect); window.removeEventListener('devicemotion', onMotion); document.removeEventListener('touchstart', onHoldStart); document.removeEventListener('touchend', onHoldEnd); $('holdGlow').classList.remove('on'); }

function fireProx() { proxActive = true; const bar = $('pBar'), badge = $('pBadge'); if (bar) bar.style.transform = 'scaleX(1)'; if (badge) badge.classList.add('show'); myScore += 5; if (players[myId]) players[myId].score = myScore; socket.emit('update_score', { score: myScore }); gMsg({ type:'prox', from: myName }); sBonus(); vib([50,30,100]); fx('📲 PROXIMITY +5', 'var(--p)'); updHUD(); updateMiniLb(); setTimeout(() => { if (bar) bar.style.transform = 'scaleX(0)'; if (badge) badge.classList.remove('show'); proxActive = false; }, 3000); }

function onTilt(e) { const b = e.beta||0, g = e.gamma||0; const db = Math.abs(b-lastTiltB), dg = Math.abs(g-lastTiltG); lastTiltB = b; lastTiltG = g; if (db > 35 || dg > 35) { gMsg({ type:'tilt', intensity: db+dg }); if (currentGame === 'tb' || currentGame === 'chaos') { myScore += 1; if (players[myId]) players[myId].score = myScore; socket.emit('update_score', { score: myScore }); updHUD(); fx('🔄 TILT +1','var(--b)'); } } }

function onHoldStart(e) { if ((e.touches?.length||1) >= 2) { holdTimer = setTimeout(() => { $('holdGlow').classList.add('on'); gMsg({ type:'hold' }); fx('🤝 HOLD POWER! +3','var(--p)'); myScore += 3; if (players[myId]) players[myId].score = myScore; socket.emit('update_score', { score: myScore }); updHUD(); vib([30,20,30,20,80]); }, 1500); } }
function onHoldEnd() { clearTimeout(holdTimer); $('holdGlow').classList.remove('on'); }

let shakeDetLast = { x:0,y:0,z:0 };
function onShakeDetect(e) { const a = e.accelerationIncludingGravity||e.acceleration; if (!a) return; const dx = Math.abs((a.x||0)-shakeDetLast.x), dy = Math.abs((a.y||0)-shakeDetLast.y), dz = Math.abs((a.z||0)-shakeDetLast.z); shakeDetLast = { x:a.x||0,y:a.y||0,z:a.z||0 }; const now = Date.now(); if (dx+dy+dz > 45 && now-lastShakeTime > 1800) { lastShakeTime = now; gMsg({ type:'shake_attack', from: myName }); fx('💥 SHAKEATO!','var(--r)'); vib(80); } }

function manualShake(e) { if (e) e.preventDefault(); const now = Date.now(); if (now-lastShakeTime < 600) return; lastShakeTime = now; if (currentGame === 'shake') { shakePower = Math.min(50, shakePower+12); shakeScore += 10; $('skIco').textContent = ['📱','💥','⚡','🌪️'][Math.floor(Math.random()*4)]; tone(440+Math.random()*200,'square',.1,.2); vib(30); } else { gMsg({ type:'shake_attack', from: myName }); fx('💥 SHAKEATO!','var(--r)'); vib(80); } }

function handleGameMsg(msg) {
  switch (msg.type) {
    case 'spawn':        if (!isHost) spawnFromData(msg.obj); break;
    case 'fight_sig':    onFightSig(msg); break;
    case 'prox':         fx('📲 '+msg.from+' HA AVVICINATO!','var(--p)'); break;
    case 'tilt':         fx('🔄 '+(players[msg.sid]?.name||'?')+' ha tiltato!','var(--b)'); break;
    case 'shake_attack': myScore = Math.max(0,myScore-1); if(players[myId])players[myId].score=myScore; socket.emit('update_score',{score:myScore}); fx('💥 '+msg.from+' TI HA SHAKEATO -1','var(--r)'); vib([100,50,100]); sBomb(); updHUD(); break;
    case 'hold':         fx('🤝 HOLD COMBINATO!','var(--p)'); break;
    case 'bluff_q':      showBluffQ(msg.q); break;
    case 'auto_next':    launchGame(msg.gameId, Date.now()); break;
    case 'merge':        triggerMergeVFX(); break;
    case 'freeze':       triggerFreezeVFX(); break;
    case 'terr_draw':    onTerrDraw(msg); break;
    case 'snake_dir':    if (snakes[msg.sid]) snakes[msg.sid].dir = msg.dir; break;
    case 'slot_spin':    onSlotSpin(msg); break;
    case 'mem_flip':     onMemFlip(msg); break;
    case 'mine_tap':     onMineTap(msg); break;
    case 'ah_paddle':    onAhPaddle(msg); break;
    case 'ah_puck':      onAhPuck(msg); break;
    case 'ah_goal':      onAhGoal(msg); break;
    case 'ah_serve':     onAhServe(msg); break;
  }
}

// ═══════════════════════════════════════════
//  TOUCH BATTLE
// ═══════════════════════════════════════════
function startTB(seed) {
  ss('tb'); timeLeft = 60; currentObjs = {}; isFrozen = false;
  const arena = $('tbA'); arena.innerHTML = '<div class="frz" id="tbFrz"></div><div class="mlb" id="tbLb"></div><div class="prox-bar" id="pBar"></div><div class="prox-badge" id="pBadge">📲 PROSSIMITÀ +5!</div>';
  updHUD(); updateMiniLb();
  let sr = seed; const rng = () => { sr = (sr*1664525+1013904223)&0xffffffff; return (sr>>>0)/0xffffffff; };
  clearInterval(gameTimer); gameTimer = setInterval(() => { timeLeft--; updHUD(); if (timeLeft <= 0) { clearInterval(gameTimer); clearTimeout(objTimer); endGame('tb'); } }, 1000);
  let delay = chaosMode ? 600 : 1100;
  function sched() { clearTimeout(objTimer); if (timeLeft <= 0) return; objTimer = setTimeout(() => { if (timeLeft > 0 && !isFrozen) spawnObj(rng); if (chaosMode && timeLeft > 0 && Math.random() > .5) setTimeout(() => spawnObj(rng), 220); delay = Math.max(chaosMode?180:320, delay-(chaosMode?14:7)); sched(); }, delay+rng()*300); } sched();
}
function spawnObj(rng) { const arena = $('tbA'); if (!arena) return; const tot = OBJ_T.reduce((s,t) => s+t.w, 0); let r = rng()*tot, type = OBJ_T[0]; for (const t of OBJ_T) { r -= t.w; if (r <= 0) { type = t; break; } } const aw = arena.offsetWidth, ah = arena.offsetHeight, pad = 50; const x = pad+rng()*(aw-pad*2), y = pad+rng()*(ah-pad*2); const id = 'o'+Date.now()+'_'+Math.random().toString(36).substr(2,4); const life = chaosMode ? (900+rng()*1400) : (1600+rng()*2000); const obj = { id, t:type.t, e:type.e, x, y, life }; if (isHost) gMsg({ type:'spawn', obj }); spawnFromData(obj); }
function spawnFromData(obj) { const arena = $('tbA'); if (!arena) return; const cls = { circle:'c',bomb:'b',speed:'s',freeze:'f',pass:'pass' }[obj.t]||'c'; const el = document.createElement('div'); el.className = `go go-${cls}`; el.id = obj.id; el.style.left = obj.x+'px'; el.style.top = obj.y+'px'; el.textContent = obj.e; el.addEventListener('touchstart', ev => { ev.preventDefault(); hitObj(obj, el); }, { passive: false }); el.addEventListener('mousedown', () => hitObj(obj, el)); arena.appendChild(el); currentObjs[obj.id] = el; setTimeout(() => removeObj(obj.id), obj.life); }
function removeObj(id) { const el = document.getElementById(id); if (!el) return; el.classList.add('die'); setTimeout(() => { el.remove(); delete currentObjs[id]; }, 250); }
function hitObj(obj, el) { if (el.dataset.hit) return; el.dataset.hit = '1'; let pts = 0, color = '#fff', msg = ''; switch (obj.t) { case 'circle': pts=chaosMode?2:1; color='var(--r)'; msg=chaosMode?'+2':'+1'; sHit(); vib(30); spawnParticles(obj.x,obj.y,'var(--r)',6); break; case 'bomb': pts=-2; color='var(--o)'; msg='-2 💥'; sBomb(); vib([100,50,100]); spawnExpl(obj.x,obj.y); flashScreen(); break; case 'speed': sBonus(); vib(50); fx('⚡ SPEED!','var(--b)'); break; case 'freeze': sFreeze(); vib(80); fx('❄️ FREEZE!','#4488ff'); gMsg({type:'freeze'}); triggerFreezeVFX(); break; case 'pass': pts=3; color='var(--p)'; msg='+3 🎁'; sBonus(); vib(60); spawnParticles(obj.x,obj.y,'var(--p)',10); fx('🎁 +3!','var(--p)'); break; } myScore = Math.max(0, myScore+pts); updHUD(); if (msg) spawnScorePop(obj.x, obj.y, msg, color); if (players[myId]) players[myId].score = myScore; socket.emit('update_score', { score: myScore }); updateMiniLb(); updateRank(); removeObj(obj.id); }
function updHUD() { const t = $('tbT'), s = $('tbS'); if (t) { t.textContent = timeLeft; t.className = 'ht'+(timeLeft<=10?' red':''); } if (s) s.textContent = myScore; }
function updateRank() { const r = Object.values(players).sort((a,b) => b.score-a.score).findIndex(p => p.id === myId)+1; const e = $('tbR'); if (e) e.textContent = '#'+r; }
function updateMiniLb() { const e = $('tbLb'); if (!e) return; e.innerHTML = Object.values(players).sort((a,b) => b.score-a.score).map(p => `<div class="mi"><div class="md" style="background:${p.color}"></div><span style="color:${p.color};font-size:10px;font-family:'DM Mono',monospace;">${p.name.substr(0,7)} ${p.score}</span></div>`).join(''); }
function triggerFreezeVFX() { const f = document.createElement('div'); f.className = 'frz on'; f.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(0,85,255,.18);border:4px solid rgba(0,85,255,.5);pointer-events:none;'; document.body.appendChild(f); isFrozen = true; setTimeout(() => { f.remove(); isFrozen = false; }, 3000); }
function triggerMergeVFX() { const o = $('mergeOv'); $('mergeD').textContent = '+10 punti!'; o.classList.add('on'); sMerge(); vib([50,30,100]); setTimeout(() => o.classList.remove('on'), 2200); fx('🔗 FUSION! +10','var(--y)'); }

// ═══════════════════════════════════════════
//  TERRITORY
// ═══════════════════════════════════════════
function startTerr() {
  ss('terr'); terrTimeLeft = 60;
  const canvas = $('terrCanvas'); const W = canvas.offsetWidth, H = canvas.offsetHeight; canvas.width = W; canvas.height = H;
  terrCtx = canvas.getContext('2d'); terrCtx.fillStyle = '#060608'; terrCtx.fillRect(0,0,W,H);
  terrColor = players[myId]?.color || '#ff2752';
  const draw = e => { const rect = canvas.getBoundingClientRect(); const cx = Math.round(e.clientX-rect.left), cy = Math.round(e.clientY-rect.top); if (cx<0||cy<0||cx>=W||cy>=H) return; terrCtx.beginPath(); terrCtx.arc(cx,cy,22,0,Math.PI*2); terrCtx.fillStyle = terrColor+'cc'; terrCtx.fill(); gMsg({ type:'terr_draw', x:cx, y:cy, color:terrColor }); };
  canvas.addEventListener('touchstart', e => { e.preventDefault(); terrDrawing = true; draw(e.touches[0]); }, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); if (terrDrawing) draw(e.touches[0]); }, { passive: false });
  canvas.addEventListener('touchend', () => terrDrawing = false);
  canvas.addEventListener('mousedown', e => { terrDrawing = true; draw(e); });
  canvas.addEventListener('mousemove', e => { if (terrDrawing) draw(e); });
  canvas.addEventListener('mouseup', () => terrDrawing = false);
  clearInterval(terrTimer); terrTimer = setInterval(() => { terrTimeLeft--; $('terrT').textContent = terrTimeLeft; updateTerrScore(); if (terrTimeLeft <= 0) { clearInterval(terrTimer); endGame('terr'); } }, 1000);
}
function onTerrDraw(m) { if (!terrCtx) return; terrCtx.beginPath(); terrCtx.arc(m.x,m.y,22,0,Math.PI*2); terrCtx.fillStyle = (players[m.sid]?.color||'#888')+'cc'; terrCtx.fill(); }
function updateTerrScore() { const canvas = $('terrCanvas'); if (!canvas||!terrCtx) return; const data = terrCtx.getImageData(0,0,canvas.width,canvas.height).data; const c = terrColor; const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16); let mine=0,total=0; for (let i=0;i<data.length;i+=4) { if (data[i+3]>10) { total++; if (Math.abs(data[i]-r)<40&&Math.abs(data[i+1]-g)<40&&Math.abs(data[i+2]-b)<40) mine++; } } const pct = total>0?Math.round(mine/total*100):0; $('terrMyPct').textContent = pct+'%'; myScore = pct; if (players[myId]) players[myId].score = myScore; socket.emit('update_score', { score: myScore }); }

// ═══════════════════════════════════════════
//  SNAKE PvP
// ═══════════════════════════════════════════
function startSnake(seed) {
  ss('snake-game'); snakeTimeLeft = 60; myScore = 0;
  const canvas = $('snakeCanvas'); const W = canvas.offsetWidth, H = canvas.offsetHeight; canvas.width = W; canvas.height = H;
  snakeCtx = canvas.getContext('2d'); const cols = Math.floor(W/snakeGrid), rows = Math.floor((H-180)/snakeGrid);
  snakes = {}; mySnakeDir = { x:1,y:0 }; snakes[myId] = { body:[{x:2,y:2}], dir:{x:1,y:0}, color:players[myId]?.color||'#ff2752', score:0, alive:true };
  snakeFood = [{ x:Math.floor(cols/2), y:Math.floor(rows/2) }];
  clearInterval(snakeTimer); let tick = 0;
  snakeTimer = setInterval(() => { tick++; if (tick%5===0) { snakeTimeLeft--; $('snakeT').textContent = snakeTimeLeft; if (snakeTimeLeft<=0) { clearInterval(snakeTimer); endGame('snake'); return; } } if (snakes[myId]?.alive) tickSnake(cols,rows); drawSnake(cols,rows); }, 150);
}
function snakeDir(dx, dy) { if (!snakes[myId]) return; const cur = snakes[myId].dir; if (dx!==0&&cur.x!==0) return; if (dy!==0&&cur.y!==0) return; mySnakeDir = { x:dx,y:dy }; snakes[myId].dir = { x:dx,y:dy }; gMsg({ type:'snake_dir', dir:{x:dx,y:dy} }); }
function tickSnake(cols, rows) { const s = snakes[myId]; if (!s||!s.alive) return; s.dir = mySnakeDir; const head = { x:s.body[0].x+s.dir.x, y:s.body[0].y+s.dir.y }; if (head.x<0||head.y<0||head.x>=cols||head.y>=rows) { s.alive=false; vib([200]); fx('💀 FUORI!','var(--r)'); return; } if (s.body.some(b => b.x===head.x&&b.y===head.y)) { s.alive=false; vib([200]); return; } s.body.unshift(head); const fi = snakeFood.findIndex(f => f.x===head.x&&f.y===head.y); if (fi>=0) { snakeFood.splice(fi,1); s.score=(s.score||0)+1; myScore=s.score; if(players[myId])players[myId].score=myScore; socket.emit('update_score',{score:myScore}); $('snakeS').textContent=myScore; sHit(); vib(20); snakeFood.push({x:Math.floor(Math.random()*cols),y:Math.floor(Math.random()*rows)}); } else s.body.pop(); }
function drawSnake(cols, rows) { if (!snakeCtx) return; const W=snakeCtx.canvas.width,H=snakeCtx.canvas.height; snakeCtx.fillStyle='#060608'; snakeCtx.fillRect(0,0,W,H); snakeCtx.strokeStyle='rgba(255,255,255,.04)'; snakeCtx.lineWidth=1; for(let x=0;x<cols;x++){snakeCtx.beginPath();snakeCtx.moveTo(x*snakeGrid,0);snakeCtx.lineTo(x*snakeGrid,H);snakeCtx.stroke();} for(let y=0;y<rows;y++){snakeCtx.beginPath();snakeCtx.moveTo(0,y*snakeGrid);snakeCtx.lineTo(W,y*snakeGrid);snakeCtx.stroke();} snakeFood.forEach(f=>{snakeCtx.font=`${snakeGrid}px serif`;snakeCtx.fillText('🍎',f.x*snakeGrid,f.y*snakeGrid+snakeGrid);}); Object.values(snakes).forEach(s=>{if(!s.alive)snakeCtx.globalAlpha=.3;s.body.forEach((b,i)=>{snakeCtx.fillStyle=i===0?s.color:s.color+'88';snakeCtx.beginPath();snakeCtx.roundRect(b.x*snakeGrid+1,b.y*snakeGrid+1,snakeGrid-2,snakeGrid-2,4);snakeCtx.fill();});snakeCtx.globalAlpha=1;}); $('snakeR').textContent='#'+(Object.values(players).sort((a,b)=>b.score-a.score).findIndex(p=>p.id===myId)+1); }

// ═══════════════════════════════════════════
//  RHYTHM BATTLE
// ═══════════════════════════════════════════
function startRhythm() {
  ss('rhythm'); rhythmTimeLeft=60; rhythmScore=0; rhythmNotes=[]; rhythmBpm=120; renderRhythmScores();
  clearInterval(rhythmTimer); rhythmTimer = setInterval(() => { rhythmTimeLeft--; if(rhythmTimeLeft<=0){clearInterval(rhythmTimer);clearInterval(rhythmSpawner);endGame('rhythm');return;} rhythmBpm=Math.min(180,120+Math.floor((60-rhythmTimeLeft)/10)*10); }, 1000);
  const spawnNote = () => { if(rhythmTimeLeft<=0)return; const track=$('rhythmTrack'); if(!track)return; const W=track.offsetWidth,lanes=4,lane=Math.floor(Math.random()*lanes),x=(lane+.5)*(W/lanes); const cols=['var(--r)','var(--b)','var(--y)','var(--g)']; const note=document.createElement('div'); note.className='rhythm-note'; note.style.cssText=`left:${x}px;top:-30px;width:58px;height:26px;background:${cols[lane]};transform:translateX(-50%);border:2px solid rgba(255,255,255,.3);`; const id='n'+Date.now()+lane; note.id=id; note.addEventListener('touchstart',ev=>{ev.preventDefault();tapNote(id,note,lane,cols[lane]);},{passive:false}); note.addEventListener('mousedown',()=>tapNote(id,note,lane,cols[lane])); track.appendChild(note); rhythmNotes.push({id,lane,el:note}); const dur=1300; note.animate([{top:'-30px'},{top:`${track.offsetHeight+30}px`}],{duration:dur,fill:'forwards'}).onfinish=()=>{note.remove();rhythmNotes=rhythmNotes.filter(n=>n.id!==id);}; };
  clearInterval(rhythmSpawner); rhythmSpawner=setInterval(spawnNote,Math.round(60000/rhythmBpm)); spawnNote();
  setInterval(()=>{const f=$('beatFlash');if(f){f.style.background='rgba(255,255,255,.07)';f.style.opacity='1';setTimeout(()=>f.style.opacity='0',80);}tone(200,'sine',.05,.3);},Math.round(60000/rhythmBpm));
}
function tapNote(id, el, lane, color) { const ni=rhythmNotes.findIndex(n=>n.id===id); if(ni<0)return; const track=$('rhythmTrack'); const hitLine=track.offsetHeight-80; const rect=el.getBoundingClientRect(),trackRect=track.getBoundingClientRect(); const noteY=rect.top-trackRect.top+rect.height/2; const diff=Math.abs(noteY-hitLine); const pts=diff<30?3:diff<70?2:1; el.style.opacity='0'; rhythmNotes.splice(ni,1); rhythmScore+=pts; myScore=rhythmScore; if(players[myId])players[myId].score=myScore; socket.emit('update_score',{score:myScore}); renderRhythmScores(); tone(261+lane*100,'sine',.15,.3); vib(20); if(pts===3)fx('⭐ PERFECT!',color); }
function rhythmTap(e) { e.preventDefault(); }
function renderRhythmScores() { const el=$('rhythmScoreRow'); if(el) el.innerHTML=Object.values(players).sort((a,b)=>b.score-a.score).map(p=>`<div class="rsp"><div class="rsp-n" style="color:${p.color}">${p.name.substr(0,6)}</div><div class="rsp-s" style="color:${p.color}">${p.score}</div></div>`).join(''); }

// ═══════════════════════════════════════════
//  SLOT BATTLE
// ═══════════════════════════════════════════
function startSlot() { ss('slot-game'); slotTimeLeft=60; mySlotScore=0; slotSpinning=false; $('slotTimer').textContent=60; $('slotWin').textContent=''; renderSlotScores(); clearInterval(slotTimer); slotTimer=setInterval(()=>{slotTimeLeft--;$('slotTimer').textContent=slotTimeLeft;if(slotTimeLeft<=0){clearInterval(slotTimer);endGame('slot');}},1000); }
function slotSpin() { if(slotSpinning||slotTimeLeft<=0)return; slotSpinning=true; $('slotBtn').disabled=true; const result=[0,1,2].map(()=>Math.floor(Math.random()*SLOT_SYMS.length)); [0,1,2].forEach((i,idx)=>{const el=$('sr'+i);el.classList.remove('spin');void el.offsetWidth;el.classList.add('spin');setTimeout(()=>el.textContent=SLOT_SYMS[result[idx]],200+idx*150);}); setTimeout(()=>{let pts=0;const msg=$('slotWin');if(result[0]===result[1]&&result[1]===result[2]){pts=10;msg.textContent='🎉 JACKPOT +10!';msg.style.color='var(--y)';sWin();vib([100,50,200]);}else if(result[0]===result[1]||result[1]===result[2]||result[0]===result[2]){pts=3;msg.textContent='⭐ COPPIA +3';msg.style.color='var(--g)';sBonus();}else{pts=0;msg.textContent='Ritenta...';msg.style.color='var(--dim)';}mySlotScore+=pts;myScore=mySlotScore;if(players[myId])players[myId].score=myScore;socket.emit('update_score',{score:myScore});renderSlotScores();gMsg({type:'slot_spin',result,pts});slotSpinning=false;$('slotBtn').disabled=false;if(pts>0)spawnParticles(window.innerWidth/2,window.innerHeight/3,'var(--y)',pts*2);},800); }
function onSlotSpin(m) { [0,1,2].forEach((i,idx)=>{const el=$('sr'+i);if(!el)return;el.classList.remove('spin');void el.offsetWidth;el.classList.add('spin');setTimeout(()=>{if(SLOT_SYMS[m.result[idx]])el.textContent=SLOT_SYMS[m.result[idx]];},200+idx*150);}); }
function renderSlotScores() { const el=$('slotScores'); if(el) el.innerHTML=Object.values(players).sort((a,b)=>b.score-a.score).map(p=>`<div class="slotp" style="border-color:${p.color}44;"><div class="slotp-n" style="color:${p.color}">${p.name.substr(0,8)}</div><div class="slotp-s" style="color:${p.color}">${p.score}</div></div>`).join(''); }

// ═══════════════════════════════════════════
//  MEMORY SPEED
// ═══════════════════════════════════════════
function startMemory() { ss('memory-game'); memTimeLeft=60; memScore=0; memFlipped=[]; memMatched=[]; memLocked=false; const pairs=8; const symbols=[...MEM_EMOJIS.slice(0,pairs),...MEM_EMOJIS.slice(0,pairs)]; memCards=symbols.sort(()=>Math.random()-.5).map((s,i)=>({id:i,sym:s,matched:false,flipped:false})); $('memGrid').style.gridTemplateColumns='repeat(4,1fr)'; renderMemGrid(); renderMemScores(); clearInterval(memTimer); memTimer=setInterval(()=>{memTimeLeft--;$('memT').textContent=memTimeLeft;if(memTimeLeft<=0){clearInterval(memTimer);endGame('memory');}},1000); }
function renderMemGrid() { $('memGrid').innerHTML=memCards.map((c,i)=>`<div class="mem-card ${c.matched?'matched':c.flipped?'flipped':''}" id="mc${i}" onclick="flipCard(${i})" ontouchstart="flipCard(${i})">${c.flipped||c.matched?c.sym:''}</div>`).join(''); }
function flipCard(i) { if(memLocked)return; const c=memCards[i]; if(c.flipped||c.matched)return; c.flipped=true; memFlipped.push(i); renderMemGrid(); sHit(); vib(20); gMsg({type:'mem_flip',idx:i,sym:c.sym}); if(memFlipped.length===2){memLocked=true;const[a,b]=memFlipped;if(memCards[a].sym===memCards[b].sym){memCards[a].matched=memCards[b].matched=true;memMatched.push(a,b);memScore+=5;myScore=memScore;if(players[myId])players[myId].score=myScore;socket.emit('update_score',{score:myScore});sBonus();vib(60);fx('✅ COPPIA! +5','var(--g)');renderMemScores();memFlipped=[];memLocked=false;renderMemGrid();if(memMatched.length===memCards.length){fx('🏆 COMPLETATO!','var(--y)');endGame('memory');}}else{setTimeout(()=>{memCards[a].flipped=memCards[b].flipped=false;memFlipped=[];memLocked=false;renderMemGrid();sBomb();},1000);}} }
function onMemFlip(m) { if(memCards[m.idx]){memCards[m.idx].flipped=true;renderMemGrid();setTimeout(()=>{if(!memCards[m.idx].matched){memCards[m.idx].flipped=false;renderMemGrid();}},1000);} }
function renderMemScores() { const el=$('memSR'); if(el) el.innerHTML=Object.values(players).sort((a,b)=>b.score-a.score).map(p=>`<div class="mem-p"><div class="mem-pn" style="color:${p.color}">${p.name.substr(0,6)}</div><div class="mem-ps" style="color:${p.color}">${p.score}</div></div>`).join(''); }

// ═══════════════════════════════════════════
//  MINESWEEPER PvP
// ═══════════════════════════════════════════
function startMine() { ss('mine-game'); mineScore=0; mineTimeLeft=60; mineBoard=[]; for(let y=0;y<mineRows;y++){mineBoard.push([]);for(let x=0;x<mineCols;x++)mineBoard[y].push({mine:false,revealed:false,flagged:false,adj:0});} let placed=0; while(placed<10){const x=Math.floor(Math.random()*mineCols),y=Math.floor(Math.random()*mineRows);if(!mineBoard[y][x].mine){mineBoard[y][x].mine=true;placed++;}} for(let y=0;y<mineRows;y++)for(let x=0;x<mineCols;x++){if(!mineBoard[y][x].mine){let c=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const ny=y+dy,nx=x+dx;if(ny>=0&&ny<mineRows&&nx>=0&&nx<mineCols&&mineBoard[ny][nx].mine)c++;}mineBoard[y][x].adj=c;}} $('mineScore').textContent='0'; renderMineGrid(); clearInterval(mineTimer); mineTimer=setInterval(()=>{mineTimeLeft--;$('mineTimer').textContent=mineTimeLeft;if(mineTimeLeft<=0){clearInterval(mineTimer);endGame('mine');}},1000); }
function renderMineGrid() { const grid=$('mineGrid'); grid.style.gridTemplateColumns=`repeat(${mineCols},1fr)`; grid.innerHTML=''; for(let y=0;y<mineRows;y++)for(let x=0;x<mineCols;x++){const cell=mineBoard[y][x];const el=document.createElement('div');el.className='mine-cell';if(cell.revealed){el.classList.add('revealed');if(cell.mine){el.classList.add('boom');el.textContent='💥';}else if(cell.adj>0){el.textContent=cell.adj;const ac=['','var(--b)','var(--g)','var(--r)','var(--p)','var(--o)','var(--b)','var(--r)','var(--r)'];el.style.color=ac[cell.adj]||'var(--w)';}}else if(cell.flagged){el.classList.add('flagged');el.textContent='🚩';}el.addEventListener('touchstart',e=>{e.preventDefault();mineLongPress=setTimeout(()=>mineFlag(x,y),500);},{passive:false});el.addEventListener('touchend',e=>{e.preventDefault();clearTimeout(mineLongPress);if(!cell.flagged&&!cell.revealed)mineReveal(x,y);});el.addEventListener('mousedown',e=>{if(e.button===2)mineFlag(x,y);else mineReveal(x,y);});el.addEventListener('contextmenu',e=>{e.preventDefault();mineFlag(x,y);});grid.appendChild(el);} }
function mineReveal(x,y){const cell=mineBoard[y][x];if(cell.revealed||cell.flagged)return;cell.revealed=true;gMsg({type:'mine_tap',x,y,flag:false});if(cell.mine){mineScore=Math.max(0,mineScore-3);$('mineScore').textContent=mineScore;myScore=mineScore;if(players[myId])players[myId].score=myScore;socket.emit('update_score',{score:myScore});sBomb();vib([100,50,100]);flashScreen();fx('💥 MINA! -3','var(--r)');}else{if(cell.adj===0)mineFlood(x,y);mineScore++;$('mineScore').textContent=mineScore;myScore=mineScore;if(players[myId])players[myId].score=myScore;socket.emit('update_score',{score:myScore});sHit();vib(15);}renderMineGrid();}
function mineFlag(x,y){const cell=mineBoard[y][x];if(cell.revealed)return;cell.flagged=!cell.flagged;renderMineGrid();tone(440,'triangle',.1,.2);gMsg({type:'mine_tap',x,y,flag:true,on:cell.flagged});}
function mineFlood(x,y){const stack=[{x,y}];while(stack.length){const{x:cx,y:cy}=stack.pop();for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=cx+dx,ny=cy+dy;if(nx>=0&&ny>=0&&nx<mineCols&&ny<mineRows){const n=mineBoard[ny][nx];if(!n.revealed&&!n.mine){n.revealed=true;if(n.adj===0)stack.push({x:nx,y:ny});}}}}}
function onMineTap(m){const cell=mineBoard[m.y]?.[m.x];if(!cell)return;if(m.flag)cell.flagged=m.on;else{cell.revealed=true;if(cell.adj===0)mineFlood(m.x,m.y);}renderMineGrid();}

// ═══════════════════════════════════════════
//  FIGHT
// ═══════════════════════════════════════════
function startFight(){ss('fight');fightRound=0;myFightScore=0;fightTimerLeft=60;const pa=Object.values(players);$('fN1').textContent=pa[0]?.name||'P1';$('fN2').textContent=pa[1]?.name||'P2';$('fS1').textContent='0';$('fS2').textContent='0';nextFightRound();clearInterval(fightInterval);fightInterval=setInterval(()=>{fightTimerLeft--;$('fT').textContent=fightTimerLeft;if(fightTimerLeft<=0){clearInterval(fightInterval);endGame('fight');}},1000);}
function nextFightRound(){fightWaiting=true;fightRound++;$('fIco').textContent='⏳';$('fHint').textContent='Aspetta il segnale...';$('ftgt').style.background='var(--s2)';setTimeout(()=>{if(fightTimerLeft<=0)return;fightWaiting=false;fightSignalTime=Date.now();$('fIco').textContent='👊';$('ftgt').style.background='rgba(255,39,82,.2)';$('fHint').textContent='TOCCA ORA! 💥';if(isHost)gMsg({type:'fight_sig',signal:true,round:fightRound});tone(880,'square',.1,.5);vib([40,20,40]);setTimeout(()=>{if(!fightWaiting){fightWaiting=true;nextFightRound();}},3000);},1500+Math.random()*3000);}
function fightTap(){if($('fIco').textContent!=='👊'){myFightScore=Math.max(0,myFightScore-1);vib([200]);fx('⚠️ FALSA PARTENZA -1','var(--r)');sBomb();renderFightScores();return;}const rt=Date.now()-fightSignalTime;fightWaiting=true;myFightScore++;sHit();vib(30);spawnParticles(window.innerWidth/2,window.innerHeight/2,'var(--r)',8);fx('💥 HIT! +1 ('+rt+'ms)','var(--y)');myScore=myFightScore;if(players[myId])players[myId].score=myScore;socket.emit('update_score',{score:myScore});gMsg({type:'fight_sig',hit:true,rt,score:myFightScore});renderFightScores();setTimeout(nextFightRound,1200);}
function onFightSig(m){if(m.signal){$('fIco').textContent='👊';$('ftgt').style.background='rgba(255,39,82,.2)';$('fHint').textContent='TOCCA ORA! 💥';fightWaiting=false;fightSignalTime=Date.now();tone(880,'square',.1,.5);vib([40,20,40]);}if(m.hit&&players[m.sid]){players[m.sid].score=m.score;renderFightScores();}}
function renderFightScores(){const pa=Object.values(players);$('fS1').textContent=pa[0]?.score||0;$('fS2').textContent=pa[1]?.score||0;}

// ═══════════════════════════════════════════
//  SHAKE KING
// ═══════════════════════════════════════════
function startShake(){ss('shake-game');shakePower=0;shakeTimeLeft=30;shakeScore=0;myScore=0;$('skVal').textContent='0';$('skBar').style.width='0%';$('shakeBtn').classList.add('visible');renderShakeScores();if(window.DeviceMotionEvent)window.addEventListener('devicemotion',onMotion);clearInterval(shakeTimer);shakeTimer=setInterval(()=>{shakeTimeLeft--;$('skT').textContent=shakeTimeLeft;shakePower=Math.max(0,shakePower*.82);$('skBar').style.width=Math.min(100,shakePower*2)+'%';$('skVal').textContent=Math.round(shakeScore);myScore=Math.round(shakeScore);if(players[myId])players[myId].score=myScore;socket.emit('update_score',{score:myScore});renderShakeScores();if(shakeTimeLeft<=0){clearInterval(shakeTimer);window.removeEventListener('devicemotion',onMotion);$('shakeBtn').classList.remove('visible');endGame('shake');}},1000);}
function onMotion(e){const a=e.accelerationIncludingGravity||e.acceleration;if(!a)return;const dx=Math.abs((a.x||0)-shakeLastAcc.x),dy=Math.abs((a.y||0)-shakeLastAcc.y),dz=Math.abs((a.z||0)-shakeLastAcc.z);shakeLastAcc={x:a.x||0,y:a.y||0,z:a.z||0};const it=dx+dy+dz;// soglia alta >15 per non triggerare col gesto annulla iOS
if(it>15){shakePower=Math.min(50,shakePower+it*.4);shakeScore+=it*.08;$('skIco').style.transform=`rotate(${Math.random()*40-20}deg)`;if(it>25){vib(8);tone(220+it*5,'square',.04,.12);}}}
function renderShakeScores(){const el=$('skScores');if(el)el.innerHTML=Object.values(players).sort((a,b)=>b.score-a.score).map(p=>`<div class="skp" style="border-color:${p.color}44;"><div class="skpn" style="color:${p.color}">${p.name.substr(0,8)}</div><div class="skps" style="color:${p.color}">${p.score}</div></div>`).join('');}

// ═══════════════════════════════════════════
//  BLUFF QUIZ
// ═══════════════════════════════════════════
function startBluff(){ss('bluff');bluffScore=0;bluffStreak=0;bluffQIdx=0;$('bScLbl').textContent='PUNTI: 0';$('bStr').textContent='🔥 0 CORRETTE';if(isHost)nextBluffQ();}
function nextBluffQ(){if(bluffQIdx>=QUIZ.length){endGame('bluff');return;}const q=QUIZ[bluffQIdx++];if(isHost)gMsg({type:'bluff_q',q});showBluffQ(q);}
function showBluffQ(q){bluffAnswered=false;bluffTimeLeft=10;$('bQ').textContent=q.q;$('btFill').style.width='100%';$('bOpts').innerHTML=q.opts.map((o,i)=>`<div class="bopt" onclick="answerBluff(${i},${q.a},this)">${o}</div>`).join('');clearInterval(bluffQTimer);bluffQTimer=setInterval(()=>{bluffTimeLeft--;$('btFill').style.width=(bluffTimeLeft/10*100)+'%';if(bluffTimeLeft<=0){clearInterval(bluffQTimer);if(!bluffAnswered){bluffStreak=0;$('bStr').textContent='💔 TEMPO!';}setTimeout(()=>{if(isHost)nextBluffQ();},1300);}},1000);}
function answerBluff(idx,correct,el){if(bluffAnswered)return;bluffAnswered=true;clearInterval(bluffQTimer);const opts=$('bOpts').querySelectorAll('.bopt');if(idx===correct){el.classList.add('ok');bluffStreak++;const bonus=bluffStreak>=3?3:1;bluffScore+=bonus;myScore=bluffScore;if(players[myId])players[myId].score=myScore;socket.emit('update_score',{score:myScore});$('bStr').textContent='🔥 '+bluffStreak+' CORRETTE'+(bluffStreak>=3?' +'+bonus:'');$('bScLbl').textContent='PUNTI: '+bluffScore;sBonus();vib(50);fx('✅ +'+bonus,'var(--g)');}else{el.classList.add('no');opts[correct].classList.add('ok');bluffStreak=0;$('bStr').textContent='❌ SBAGLIATO';sBomb();vib([100,50,100]);fx('❌','var(--r)');}setTimeout(()=>{if(isHost)nextBluffQ();},1400);}

// ═══════════════════════════════════════════
//  END + RESULTS
// ═══════════════════════════════════════════
function endGame(gid){clearAllTimers();if(currentGame==='auto')nextAuto();else{socket.emit('game_over');showResults();}}
function showResults(){
  clearAllTimers();stopPhysical();$('chaosBar').style.display='none';
  if(players[myId])players[myId].score=myScore;
  const sorted=Object.values(players).sort((a,b)=>b.score-a.score);
  ss('results');$('resT').textContent=(GAMES.find(g=>g.id===currentGame)||GAMES[0]).name;
  const ord=sorted.length>=2?[sorted[1],sorted[0],sorted[2]]:[null,sorted[0],null];
  const hs=[88,118,68],meds=['🥈','🥇','🥉'],cols=['#c0c0c0','#ffd700','#cd7f32'];
  $('pod').innerHTML=ord.map((p,i)=>{if(!p)return`<div class="pi" style="flex:1"></div>`;return`<div class="pi"><div class="pm">${meds[i]}</div><div class="pn" style="color:${p.color}">${p.name}</div><div class="ppts">${p.score} pts</div><div class="pbase" style="background:${cols[i]}33;border:2px solid ${cols[i]}55;height:${hs[i]}px;"><div class="ppos">${i===1?'1':i===0?'2':'3'}</div></div></div>`;}).join('');
  const pm=['🥇','🥈','🥉'];
  $('rList').innerHTML=sorted.map((p,i)=>`<div class="ritem" style="animation-delay:${i*.08}s;border-color:${p.id===myId?p.color+'44':''}"><div class="rpos" style="color:${p.color}">${pm[i]||i+1}</div><div class="picon" style="background:${p.color}22;color:${p.color};border:2px solid ${p.color}44;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">${p.emoji}</div><div class="rname" style="color:${p.id===myId?p.color:''}">${p.name}${p.id===myId?' ★':''}</div><div class="rscore">${p.score} pts</div></div>`).join('');
  if(sorted[0]?.id===myId){sWin();vib([100,50,100,50,200]);}else tone(220,'sawtooth',.5,.4);
}

// ═══════════════════════════════════════════
//  FX UTILS
// ═══════════════════════════════════════════
function spawnScorePop(x,y,txt,color){const el=document.createElement('div');el.className='spop';el.textContent=txt;el.style.color=color;el.style.left=x+'px';el.style.top=y+'px';const a=$('tbA');if(a)a.appendChild(el);setTimeout(()=>el.remove(),900);}
function spawnExpl(x,y){const e=document.createElement('div');e.className='expl';e.style.left=x+'px';e.style.top=y+'px';const a=$('tbA');if(a){a.appendChild(e);setTimeout(()=>e.remove(),400);}}
function flashScreen(){document.body.style.filter='brightness(2)';setTimeout(()=>{document.body.style.filter='';},130);}
function spawnParticles(x,y,color,count){for(let i=0;i<count;i++){const p=document.createElement('div'),a=Math.random()*Math.PI*2,d=30+Math.random()*60;p.className='part';p.style.cssText=`left:${x}px;top:${y}px;width:${4+Math.random()*6}px;height:${4+Math.random()*6}px;background:${color};position:fixed;--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d}px;`;document.body.appendChild(p);setTimeout(()=>p.remove(),1000);}}
function clearAllTimers(){clearInterval(gameTimer);clearTimeout(objTimer);clearInterval(fightInterval);clearInterval(shakeTimer);clearInterval(bluffQTimer);clearInterval(snakeTimer);clearInterval(terrTimer);clearInterval(rhythmTimer);clearInterval(rhythmSpawner);clearInterval(slotTimer);clearInterval(memTimer);clearInterval(mineTimer);clearInterval(proxInterval);clearTimeout(holdTimer);}

// touch guard
let lt=0;
document.addEventListener('touchend',e=>{const n=Date.now();if(n-lt<300)e.preventDefault();lt=n;},{passive:false});
document.addEventListener('keydown',e=>{if(e.key==='Enter'){if($('createPanel')?.style.display!=='none')createRoom();if($('joinPanel')?.style.display!=='none')joinRoom();}});

// ═══════════════════════════════════════════
//  AIR HOCKEY
// ═══════════════════════════════════════════
const AH_WIN = 5;
let ahScores = { me:0, opp:0 };
let ahServingMe = true;
let ahActive = false;
let ahAnimFrame = null;
let ahPuck = { x:0, y:0, vx:0, vy:0, r:22 };
let ahMyPaddle  = { x:0, y:0, r:32, tx:0, ty:0 };
let ahOppPaddle = { x:0, y:0, r:32 };
let ahCW = 0, ahCH = 0, ahCtx = null;
let ahDragging = false;
let ahPaddleVel = { x:0, y:0 };
let ahLastPaddleTime = 0;
let ahInTransit = false;
let ahGoalFlashing = false;

function startAirHockey() {
  ss('airh');
  ahScores = { me:0, opp:0 };
  ahServingMe = isHost;
  ahActive = true;
  ahInTransit = false;
  cancelAnimationFrame(ahAnimFrame);

  const canvas = $('ahCanvas');
  const rink   = $('ahRink');
  ahCW = rink.offsetWidth;
  ahCH = rink.offsetHeight;
  canvas.width  = ahCW;
  canvas.height = ahCH;
  ahCtx = canvas.getContext('2d');

  ahMyPaddle  = { x:ahCW/2, y:ahCH*0.82, r:32, tx:ahCW/2, ty:ahCH*0.82 };
  ahOppPaddle = { x:ahCW/2, y:ahCH*0.18, r:32 };

  const pa = Object.values(players);
  const opp = pa.find(p => p.id !== myId);
  $('ahMyName').textContent  = myName || 'TU';
  $('ahOppName').textContent = opp?.name || 'AVVERSARIO';
  $('ahMyName').style.color  = '#00aaff';
  $('ahOppName').style.color = '#ff3355';

  ahServePuck();
  ahSetupInput();
  ahLoop();
}

function ahServePuck() {
  ahUpdateUI();
  ahInTransit = false;
  if (ahServingMe) {
    ahPuck = { x:ahCW/2, y:ahCH*0.72, vx:0, vy:0, r:22 };
    fx('🏒 TUO SERVIZIO!','#00aaff');
    $('ahMyServe').textContent  = '🏒 SERVI TU';
    $('ahOppServe').textContent = '';
  } else {
    ahPuck = { x:ahCW/2, y:ahCH*0.28, vx:0, vy:0, r:22 };
    fx('🏒 SERVIZIO AVVERSARIO','#ff3355');
    $('ahMyServe').textContent  = '';
    $('ahOppServe').textContent = '🏒 SERVE LUI';
  }
}

function ahSetupInput() {
  const rink = $('ahRink');
  if (!rink) return;
  rink.addEventListener('touchstart', ahTouchStart, { passive:false });
  rink.addEventListener('touchmove',  ahTouchMove,  { passive:false });
  rink.addEventListener('touchend',   ()=>ahDragging=false, { passive:false });
  rink.addEventListener('mousedown',  e => { ahDragging=true; ahMovePaddle(ahGetPos(e)); });
  rink.addEventListener('mousemove',  e => { if(ahDragging) ahMovePaddle(ahGetPos(e)); });
  rink.addEventListener('mouseup',    () => ahDragging=false);
}
function ahTeardownInput() {
  const rink = $('ahRink');
  if (!rink) return;
  rink.removeEventListener('touchstart', ahTouchStart);
  rink.removeEventListener('touchmove',  ahTouchMove);
}
function ahTouchStart(e) { e.preventDefault(); ahDragging=true; ahMovePaddle(ahGetPos(e)); }
function ahTouchMove(e)  { e.preventDefault(); if(ahDragging) ahMovePaddle(ahGetPos(e)); }
function ahGetPos(e) { const rect=$('ahCanvas').getBoundingClientRect(); const t=e.touches?e.touches[0]:e; return {x:t.clientX-rect.left,y:t.clientY-rect.top}; }
function ahMovePaddle(pos) {
  const minY=ahCH/2+ahMyPaddle.r+4, maxY=ahCH-ahMyPaddle.r-4;
  const minX=ahMyPaddle.r+4, maxX=ahCW-ahMyPaddle.r-4;
  const now=Date.now(); const dt=Math.max(1,now-ahLastPaddleTime);
  ahPaddleVel.x=(pos.x-ahMyPaddle.x)/dt*16;
  ahPaddleVel.y=(pos.y-ahMyPaddle.y)/dt*16;
  ahLastPaddleTime=now;
  ahMyPaddle.tx=Math.max(minX,Math.min(maxX,pos.x));
  ahMyPaddle.ty=Math.max(minY,Math.min(maxY,pos.y));
}

function ahLoop() {
  if (!ahActive) return;
  ahUpdate();
  ahDraw();
  gMsg({ type:'ah_paddle', x:ahMyPaddle.x/ahCW, y:ahMyPaddle.y/ahCH });
  ahAnimFrame = requestAnimationFrame(ahLoop);
}

function ahUpdate() {
  if (ahInTransit) return;
  // Smooth paddle
  ahMyPaddle.x += (ahMyPaddle.tx - ahMyPaddle.x) * 0.38;
  ahMyPaddle.y += (ahMyPaddle.ty - ahMyPaddle.y) * 0.38;
  // Move puck
  ahPuck.x += ahPuck.vx;
  ahPuck.y += ahPuck.vy;
  // Friction
  ahPuck.vx *= 0.994;
  ahPuck.vy *= 0.994;
  // Side walls
  if (ahPuck.x - ahPuck.r < 0) { ahPuck.x=ahPuck.r; ahPuck.vx=Math.abs(ahPuck.vx); ahWallSound(); vib(18); }
  if (ahPuck.x + ahPuck.r > ahCW) { ahPuck.x=ahCW-ahPuck.r; ahPuck.vx=-Math.abs(ahPuck.vx); ahWallSound(); vib(18); }

  const gw=ahCW*0.4, gx1=(ahCW-gw)/2, gx2=gx1+gw;

  // Top exit → into opponent net
  if (ahPuck.y - ahPuck.r < 0) {
    if (ahPuck.x > gx1 && ahPuck.x < gx2) { ahHandleGoal(false); }
    else { ahPuck.y=ahPuck.r; ahPuck.vy=Math.abs(ahPuck.vy); ahWallSound(); vib(18); }
    return;
  }
  // Bottom exit → into my net
  if (ahPuck.y + ahPuck.r > ahCH) {
    if (ahPuck.x > gx1 && ahPuck.x < gx2) { ahHandleGoal(true); }
    else { ahPuck.y=ahCH-ahPuck.r; ahPuck.vy=-Math.abs(ahPuck.vy); ahWallSound(); vib(18); }
    return;
  }

  ahCollidePaddle(ahMyPaddle, true);
  ahCollidePaddle(ahOppPaddle, false);
}

function ahCollidePaddle(paddle, isMe) {
  const dx=ahPuck.x-paddle.x, dy=ahPuck.y-paddle.y;
  const dist=Math.sqrt(dx*dx+dy*dy);
  const minD=ahPuck.r+paddle.r;
  if (dist < minD && dist > 0) {
    const nx=dx/dist, ny=dy/dist;
    ahPuck.x+=nx*(minD-dist); ahPuck.y+=ny*(minD-dist);
    const dot=ahPuck.vx*nx+ahPuck.vy*ny;
    ahPuck.vx-=2*dot*nx; ahPuck.vy-=2*dot*ny;
    if (isMe) {
      ahPuck.vx += ahPaddleVel.x*0.55;
      ahPuck.vy += ahPaddleVel.y*0.55;
    }
    const spd=Math.sqrt(ahPuck.vx**2+ahPuck.vy**2);
    if (spd>24) { ahPuck.vx=ahPuck.vx/spd*24; ahPuck.vy=ahPuck.vy/spd*24; }
    ahHitSound(); if(isMe){vib(22);if(isMe)gMsg({type:'ah_puck',x:ahPuck.x/ahCW,y:ahPuck.y/ahCH,vx:ahPuck.vx/ahCW,vy:ahPuck.vy/ahCH});}
  }
}

function ahHandleGoal(oppScored) {
  if (ahInTransit || ahGoalFlashing) return;
  ahInTransit = true; ahGoalFlashing = true;
  ahActive = false;
  cancelAnimationFrame(ahAnimFrame);

  if (oppScored) {
    ahScores.opp++;
    ahShowGoalFlash('🥅 GOL!','#ff3355');
    tone(150,'sawtooth',.4,.5); vib([150,80,150]);
    gMsg({ type:'ah_goal', scorer:'opp' });
  } else {
    ahScores.me++;
    ahShowGoalFlash('⚡ GOL!','#00aaff');
    [440,554,659,880].forEach((f,i)=>setTimeout(()=>tone(f,'sine',.2,.4),i*80));
    vib([80,40,200]);
    gMsg({ type:'ah_goal', scorer:'me' });
  }
  ahUpdateUI();

  if (ahScores.me >= AH_WIN || ahScores.opp >= AH_WIN) {
    setTimeout(() => { ahEndGame(); }, 1600);
    return;
  }
  ahServingMe = !oppScored;
  setTimeout(() => {
    ahGoalFlashing = false; ahActive = true;
    ahServePuck();
    gMsg({ type:'ah_serve', x:ahPuck.x/ahCW, y:ahPuck.y/ahCH, servingMe:ahServingMe });
    ahLoop();
  }, 2000);
}

function ahShowGoalFlash(txt, color) {
  const f=$('ahGoalFlash'),t=$('ahGoalTxt');
  if(!f||!t) return;
  t.textContent=txt; t.style.color=color;
  f.style.opacity='1'; f.style.display='flex';
  setTimeout(()=>{ f.style.opacity='0'; setTimeout(()=>f.style.display='none',400); },1200);
}

function ahEndGame() {
  ahActive = false; ahTeardownInput(); cancelAnimationFrame(ahAnimFrame);
  // Set scores into players for results screen
  myScore = ahScores.me;
  if(players[myId]) players[myId].score = ahScores.me;
  const opp = Object.values(players).find(p=>p.id!==myId);
  if(opp) opp.score = ahScores.opp;
  socket.emit('update_score',{score:ahScores.me});
  socket.emit('game_over');
  showResults();
}

// Incoming msgs
function onAhPaddle(m) { ahOppPaddle.x=m.x*ahCW; ahOppPaddle.y=(1-m.y)*ahCH; }
function onAhPuck(m)   { ahPuck.x=m.x*ahCW; ahPuck.y=(1-m.y)*ahCH; ahPuck.vx=m.vx*ahCW; ahPuck.vy=-m.vy*ahCH; }
function onAhGoal(m) {
  if (m.scorer === 'me') { ahScores.opp++; ahShowGoalFlash('🥅 GOL!','#ff3355'); tone(150,'sawtooth',.4,.5); vib([150,80,150]); }
  else { ahScores.me++; ahShowGoalFlash('⚡ GOL!','#00aaff'); [440,554,659,880].forEach((f,i)=>setTimeout(()=>tone(f,'sine',.2,.4),i*80)); vib([80,40,200]); }
  ahUpdateUI();
  ahServingMe = (m.scorer==='opp');
}
function onAhServe(m) { ahPuck.x=m.x*ahCW; ahPuck.y=(1-m.y)*ahCH; ahPuck.vx=0; ahPuck.vy=0; ahInTransit=false; }

function ahUpdateUI() {
  const ms=$('ahMyScoreN'), os=$('ahOppScoreN');
  if(ms) ms.textContent=ahScores.me;
  if(os) os.textContent=ahScores.opp;
  // Pip indicators
  ahUpdatePips($('ahMyPips'), ahScores.me, '#00aaff');
  ahUpdatePips($('ahOppPips'), ahScores.opp, '#ff3355');
}
function ahUpdatePips(el, score, color) {
  if(!el) return;
  el.innerHTML='';
  for(let i=0;i<AH_WIN;i++){const d=document.createElement('div');d.style.cssText=`width:10px;height:10px;border-radius:50%;background:${i<score?color:'rgba(255,255,255,.15)'};display:inline-block;margin:0 2px;box-shadow:${i<score?'0 0 6px '+color:'none'};`;el.appendChild(d);}
}

// Sounds
function ahHitSound()  { tone(280,'square',.06,.5); }
function ahWallSound() { tone(160,'sine',.08,.3); }

// Draw
function ahDraw() {
  if (!ahCtx) return;
  const c=ahCtx,W=ahCW,H=ahCH;
  c.clearRect(0,0,W,H);

  // Ice background
  const ig=c.createLinearGradient(0,0,0,H);
  ig.addColorStop(0,'#091520'); ig.addColorStop(.5,'#0c1e30'); ig.addColorStop(1,'#091520');
  c.fillStyle=ig; c.fillRect(0,0,W,H);

  // Grid lines
  c.strokeStyle='rgba(255,255,255,.03)'; c.lineWidth=1;
  for(let y=0;y<H;y+=20){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}

  // Center line
  c.setLineDash([14,8]); c.strokeStyle='rgba(255,255,255,.18)'; c.lineWidth=2.5;
  c.beginPath();c.moveTo(0,H/2);c.lineTo(W,H/2);c.stroke();
  c.setLineDash([]);

  // Center circle
  c.strokeStyle='rgba(255,255,255,.14)'; c.lineWidth=2;
  c.beginPath();c.arc(W/2,H/2,Math.min(W,H)*.13,0,Math.PI*2);c.stroke();
  c.fillStyle='rgba(255,255,255,.28)';
  c.beginPath();c.arc(W/2,H/2,5,0,Math.PI*2);c.fill();

  const gw=W*0.4, gh=14, gx=(W-gw)/2;

  // Zone tints
  const tz=c.createLinearGradient(0,0,0,H/2);
  tz.addColorStop(0,'rgba(255,51,85,.07)');tz.addColorStop(1,'transparent');
  c.fillStyle=tz;c.fillRect(0,0,W,H/2);
  const bz=c.createLinearGradient(0,H/2,0,H);
  bz.addColorStop(0,'transparent');bz.addColorStop(1,'rgba(0,170,255,.07)');
  c.fillStyle=bz;c.fillRect(0,H/2,W,H/2);

  // Top goal (opp - red)
  const tg=c.createLinearGradient(gx,0,gx+gw,0);
  tg.addColorStop(0,'rgba(255,51,85,0)');tg.addColorStop(.5,'rgba(255,51,85,.8)');tg.addColorStop(1,'rgba(255,51,85,0)');
  c.fillStyle=tg;c.fillRect(gx,0,gw,gh);
  c.strokeStyle='rgba(255,51,85,.7)';c.lineWidth=3;
  c.beginPath();c.moveTo(gx,gh);c.lineTo(gx,0);c.lineTo(gx+gw,0);c.lineTo(gx+gw,gh);c.stroke();
  // Glow
  if(ahScores.opp>0){c.shadowColor='#ff3355';c.shadowBlur=20;c.stroke();c.shadowBlur=0;}

  // Bottom goal (me - blue)
  const bg=c.createLinearGradient(gx,H-gh,gx+gw,H);
  bg.addColorStop(0,'rgba(0,170,255,0)');bg.addColorStop(.5,'rgba(0,170,255,.8)');bg.addColorStop(1,'rgba(0,170,255,0)');
  c.fillStyle=bg;c.fillRect(gx,H-gh,gw,gh);
  c.strokeStyle='rgba(0,170,255,.7)';c.lineWidth=3;
  c.beginPath();c.moveTo(gx,H-gh);c.lineTo(gx,H);c.lineTo(gx+gw,H);c.lineTo(gx+gw,H-gh);c.stroke();
  if(ahScores.me>0){c.shadowColor='#00aaff';c.shadowBlur=20;c.stroke();c.shadowBlur=0;}

  // Paddles
  ahDrawPaddle(ahOppPaddle.x,ahOppPaddle.y,ahOppPaddle.r,'#ff3355','#ff7788');
  ahDrawPaddle(ahMyPaddle.x, ahMyPaddle.y, ahMyPaddle.r, '#00aaff','#44ccff');

  // Puck
  if (!ahInTransit) ahDrawPuck();
}

function ahDrawPaddle(x,y,r,ca,cb) {
  const c=ahCtx;
  c.save();
  c.shadowColor=ca; c.shadowBlur=22;
  const g=c.createRadialGradient(x-r*.3,y-r*.3,r*.1,x,y,r);
  g.addColorStop(0,cb);g.addColorStop(1,ca);
  c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
  c.shadowBlur=0;
  c.fillStyle='rgba(255,255,255,.15)';
  c.beginPath();c.arc(x-r*.2,y-r*.25,r*.25,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=2.5;
  c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();
  // Inner ring
  c.strokeStyle='rgba(255,255,255,.15)';c.lineWidth=1;
  c.beginPath();c.arc(x,y,r*.6,0,Math.PI*2);c.stroke();
  c.restore();
}

function ahDrawPuck() {
  const c=ahCtx, p=ahPuck;
  c.save();
  c.shadowColor='rgba(255,255,255,.35)'; c.shadowBlur=14;
  const g=c.createRadialGradient(p.x-p.r*.3,p.y-p.r*.3,p.r*.05,p.x,p.y,p.r);
  g.addColorStop(0,'#666');g.addColorStop(1,'#111');
  c.fillStyle=g;c.beginPath();c.arc(p.x,p.y,p.r,0,Math.PI*2);c.fill();
  c.shadowBlur=0;
  c.fillStyle='rgba(255,255,255,.2)';
  c.beginPath();c.arc(p.x-p.r*.25,p.y-p.r*.3,p.r*.3,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=2;
  c.beginPath();c.arc(p.x,p.y,p.r,0,Math.PI*2);c.stroke();
  // Trail
  const spd=Math.sqrt(p.vx**2+p.vy**2);
  if(spd>3){const al=Math.min(.45,spd/28);
    for(let i=1;i<=4;i++){const tx=p.x-(p.vx/spd)*p.r*i*.5,ty=p.y-(p.vy/spd)*p.r*i*.5,tr=p.r*(1-i*.22)*.7;
      if(tr>0){c.fillStyle=`rgba(255,255,255,${al*(1-i*.2)})`;c.beginPath();c.arc(tx,ty,tr,0,Math.PI*2);c.fill();}}}
  c.restore();
}
