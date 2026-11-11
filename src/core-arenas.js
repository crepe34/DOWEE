/* =====================================================================
   RoboBench arenas: floors, walls, rules and scoring.
   ===================================================================== */
const P = (x, y) => ({ x, y });
function wallLoop(pts, r = 0.012, closed = true) {
  const out = [];
  for (let i = 0; i < (closed ? pts.length : pts.length - 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, r }); }
  return out;
}
function boxWalls(w, h, r = 0.015) { return wallLoop([P(0, 0), P(w, 0), P(w, h), P(0, h)], r); }

const LINE_TRACKS = {
  oval: { name: 'Oval (beginner)', make: () => { const pts = []; const cx = 1.3, cy = 0.85, L = 0.55, R = 0.5; for (let i = 0; i <= 20; i++) pts.push(P(cx - L + (2 * L * i) / 20, cy - R)); for (let i = 1; i < 40; i++) { const a = -Math.PI / 2 + Math.PI * i / 40; pts.push(P(cx + L + R * Math.cos(a), cy + R * Math.sin(a))); } for (let i = 0; i <= 20; i++) pts.push(P(cx + L - (2 * L * i) / 20, cy + R)); for (let i = 1; i < 40; i++) { const a = Math.PI / 2 + Math.PI * i / 40; pts.push(P(cx - L + R * Math.cos(a), cy + R * Math.sin(a))); } return { pts: pts.slice(10).concat(pts.slice(0, 10)), smooth: false }; } },
  snake: { name: 'Snake (medium)', make: () => ({ pts: [P(0.55, 0.3), P(1.3, 0.25), P(1.75, 0.55), P(2.15, 0.3), P(2.4, 0.65), P(2.25, 1.25), P(1.85, 1.42), P(1.45, 1.05), P(1.05, 1.45), P(0.55, 1.4), P(0.25, 0.95), P(0.28, 0.5)], smooth: true }) },
  figure8: { name: 'Figure 8 (crossing)', make: () => { const pts = []; for (let i = 0; i < 160; i++) { const t = (i / 160) * Math.PI * 2, s = Math.sin(t), d = 1 + s * s; pts.push(P(1.3 + 1.05 * Math.cos(t) / d, 0.85 + 1.25 * Math.sin(t) * Math.cos(t) / d)); } return { pts, smooth: false }; } },
  sharp: { name: 'Sharp turns (expert)', make: () => ({ pts: [P(1.0, 0.25), P(2.35, 0.25), P(2.35, 0.85), P(2.0, 0.85), P(1.75, 1.45), P(1.5, 0.85), P(1.25, 1.45), P(0.95, 0.9), P(0.25, 1.45), P(0.25, 0.25)], smooth: false }) },
};

const SUMO_OPP = { none: 'No opponent', statue: 'Statue (does not move)', wander: 'Wanderer', hunter: 'Hunter', bulldozer: 'Bulldozer (strong)', code: 'Dowee B code', p2: 'Player 2 (arrow keys)' };
const SOCCER_OPP = { none: 'No opponent', easy: 'AI easy', medium: 'AI medium', hard: 'AI hard', code: 'Dowee B code', p2: 'Player 2 (arrow keys)' };
const RACE_OPP = { none: 'Solo time trial', easy: 'AI easy', medium: 'AI medium', hard: 'AI hard', p2: 'Player 2 (arrow keys)' };

const ARENAS = {
  line: { name: 'Line following', preset: 'dowee', variants: Object.fromEntries(Object.entries(LINE_TRACKS).map(([k, v]) => [k, v.name]).concat([['custom', 'My drawn track']])), variantLabel: 'Track' },
  race: { name: 'RC race', preset: 'dowee', variants: RACE_OPP, variantLabel: 'Opponent', rc: true },
  soccer: { name: 'Robot soccer', preset: 'dowee', variants: SOCCER_OPP, variantLabel: 'Opponent', rc: true },
  sumo: { name: 'Sumo', preset: 'dowee', variants: SUMO_OPP, variantLabel: 'Opponent', starts: { facing: 'Facing each other', back: 'Back to back', side: 'Side by side', random: 'Random' } },
  maze: { name: 'Obstacle room', preset: 'dowee', variants: { room1: 'Room 1', room2: 'Room 2 (tighter)' }, variantLabel: 'Room' },
  lab: { name: 'Test lab', preset: 'dowee', variants: { lab: 'Measuring floor' }, variantLabel: 'Floor' },
};

function buildArena(id, variant, opts = {}) {
  const A = { id, variant, ...ARENAS[id] };
  const fmt = s => s.toFixed(2);
  if (id === 'line') {
    A.w = 2.6; A.h = 1.7;
    let pts, smooth;
    if (variant === 'custom' && opts.customTrack && opts.customTrack.length >= 4) { pts = opts.customTrack.map(p => P(p.x, p.y)); smooth = true; }
    else { const t = (LINE_TRACKS[variant] || LINE_TRACKS.oval).make(); pts = t.pts; smooth = t.smooth; }
    const path = new Path(smooth ? catmull(pts, true, 24) : pts, true, 0.01);
    A.path = path;
    A.floor = new Floor(A.w, A.h, 0.92, '#f4f2ec').poly(path, 0.025, 0.05, '#17191c');
    const t0 = path.tangent(0), p0 = path.pts[0];
    A.startMark = { x: p0.x, y: p0.y, th: t0 };
    A.spawns = [{ x: p0.x - Math.cos(t0) * 0.09, y: p0.y - Math.sin(t0) * 0.09, th: t0 }];
    A.walls = boxWalls(A.w, A.h);
    A.start = W => { W.state = { lap: new LapTracker(path, 0.12), laps: [], startAt: 0 }; };
    A.update = W => {
      if (W.time % 10) return;
      const r = W.robots[0], s = W.state, c = r.cfg;
      const p = r.worldPoint(c.sensorFwd, 0);
      const lap = s.lap.update(p.x, p.y, W.time);
      if (lap) { s.laps.push(lap); W.events.push({ type: 'lap', lap, n: s.laps.length }); }
    };
    A.hud = W => {
      const s = W.state; if (!s.lap) return [];
      const best = s.laps.length ? Math.min(...s.laps.map(l => l.time)) : null, cur = (W.time - s.lap.lapStart) / 1000;
      return [['Lap', String(s.laps.length + 1)], ['Lap time', cur.toFixed(2) + ' s'], ['Best', best ? best.toFixed(2) + ' s' : '—'], ['Off-line', (s.lap.lastErr * 1000).toFixed(0) + ' mm'], ...(s.lap.lost ? [['Status', 'Lost the line!', 'bad']] : [])];
    };
  }
  else if (id === 'race') {
    A.w = 4.2; A.h = 2.8;
    const center = catmull([P(0.85, 0.5), P(2.1, 0.47), P(3.35, 0.55), P(3.72, 1.35), P(3.4, 2.2), P(2.75, 2.33), P(2.1, 2.0), P(1.45, 2.33), P(0.8, 2.22), P(0.45, 1.38)], true, 30);
    const path = new Path(center, true, 0.01);
    A.path = path;
    const roadW = 0.6;
    A.floor = new Floor(A.w, A.h, 0.32, '#5f8f4e').poly(path, roadW + 0.06, 0.9, '#f2f2ee').poly(path, roadW, 0.14, '#3b3f45').poly(path, 0.012, 0.85, '#d9d2a6', { dashed: true, visualOnly: true });
    const smooth = (pts, k) => { for (let it = 0; it < k; it++) pts = pts.map((p, i) => { const n = pts.length; let x = 0, y = 0; for (let d = -3; d <= 3; d++) { const q = pts[(i + d + n) % n]; x += q.x; y += q.y; } return P(x / 7, y / 7); }); return pts; };
    const outer = new Path(smooth(path.offset(roadW / 2 + 0.12), 12), true, 0.04), inner = new Path(smooth(path.offset(-(roadW / 2 + 0.12)), 4), true, 0.04);
    A.walls = [...wallLoop(outer.pts, 0.015), ...wallLoop(inner.pts, 0.015), ...boxWalls(A.w, A.h)];
    const p0 = path.pts[0], t0 = path.tangent(0);
    A.startMark = { x: p0.x, y: p0.y, th: t0, width: roadW, checker: true };
    const nx = -Math.sin(t0), ny = Math.cos(t0);
    A.spawns = [{ x: p0.x - Math.cos(t0) * 0.15 + nx * 0.13, y: p0.y - Math.sin(t0) * 0.15 + ny * 0.13, th: t0 }, { x: p0.x - Math.cos(t0) * 0.15 - nx * 0.13, y: p0.y - Math.sin(t0) * 0.15 - ny * 0.13, th: t0 }];
    A.raceLaps = 3;
    A.start = W => { W.state = { trackers: W.robots.map(() => new LapTracker(path, roadW)), laps: W.robots.map(() => []), done: W.robots.map(() => null), countdown: true }; };
    A.update = W => {
      const s = W.state;
      s.countdown = W.time < 3000;
      if (W.time % 10) return;
      if (W.time === 3000) s.trackers.forEach(t => t.reset(3000));
      if (s.countdown) return;
      W.robots.forEach((r, i) => {
        if (s.done[i] !== null) return;
        const lap = s.trackers[i].update(r.x, r.y, W.time);
        if (lap) { s.laps[i].push(lap); W.events.push({ type: 'lap', lap, n: s.laps[i].length, robot: r.name }); if (s.laps[i].length >= A.raceLaps) { s.done[i] = (W.time - 3000) / 1000; W.events.push({ type: 'finish', robot: r.name, time: s.done[i], place: s.done.filter(x => x !== null).length }); } }
      });
    };
    A.hud = W => {
      const s = W.state; if (!s.trackers) return [];
      if (s.countdown) return [['Start in', Math.max(0, 3 - Math.floor(W.time / 1000)) + '', 'big']];
      const rows = [];
      W.robots.forEach((r, i) => {
        const lapN = Math.min(s.laps[i].length + 1, A.raceLaps);
        rows.push([r.name, s.done[i] !== null ? 'Finished ' + s.done[i].toFixed(2) + ' s' : `Lap ${lapN}/${A.raceLaps} · ${((W.time - s.trackers[i].lapStart) / 1000).toFixed(1)} s`]);
      });
      const best = [].concat(...s.laps).map(l => l.time); if (best.length) rows.push(['Best lap', Math.min(...best).toFixed(2) + ' s']);
      return rows;
    };
  }
  else if (id === 'soccer') {
    A.w = 2.6; A.h = 1.8;
    const x0 = 0.15, x1 = 2.45, y0 = 0.05, y1 = 1.75, gy0 = 0.6, gy1 = 1.2, gd = 0.12;
    A.goalLeftX = x0; A.goalRightX = x1;
    A.floor = new Floor(A.w, A.h, 0.3, '#2f8a4c').rect(x0 + 0.02, y0 + 0.02, x1 - 0.02, y1 - 0.02, 0.3, '#2f8a4c');
    A.lines = { x0, x1, y0, y1, gy0, gy1, gd };
    A.walls = [
      { x1: x0, y1: y0, x2: x1, y2: y0, r: 0.015 }, { x1: x0, y1: y1, x2: x1, y2: y1, r: 0.015 },
      { x1: x0, y1: y0, x2: x0, y2: gy0, r: 0.015 }, { x1: x0, y1: gy1, x2: x0, y2: y1, r: 0.015 },
      { x1: x1, y1: y0, x2: x1, y2: gy0, r: 0.015 }, { x1: x1, y1: gy1, x2: x1, y2: y1, r: 0.015 },
      ...wallLoop([P(x0, gy0), P(x0 - gd, gy0), P(x0 - gd, gy1), P(x0, gy1)], 0.012, false),
      ...wallLoop([P(x1, gy0), P(x1 + gd, gy0), P(x1 + gd, gy1), P(x1, gy1)], 0.012, false),
    ];
    A.ball = P(1.3, 0.9);
    A.spawns = [{ x: 0.75, y: 0.9, th: 0 }, { x: 1.85, y: 0.9, th: Math.PI }];
    A.matchMs = 180000;
    A.start = W => { W.state = { score: [0, 0], pause: 0, over: false, kickT: 0 }; };
    A.kickoff = W => { W.state.kickT = W.time; W.ball.place(1.3, 0.9); W.robots.forEach((r, i) => { const s = A.spawns[i]; Object.assign(r, { x: s.x, y: s.y, th: s.th, vx: 0, vy: 0, w: 0 }); }); };
    A.update = W => {
      const s = W.state, b = W.ball;
      if (s.over) return;
      if (s.pause) { s.pause -= 1; if (s.pause === 0) A.kickoff(W); return; }
      if (W.time >= A.matchMs) { s.over = true; const wn = s.score[0] === s.score[1] ? null : s.score[0] > s.score[1] ? 'A' : 'B'; W.events.push({ type: 'over', winner: wn, text: wn ? `Dowee ${wn} wins ${Math.max(...s.score)}–${Math.min(...s.score)}` : `Draw ${s.score[0]}–${s.score[1]}` }); return; }
      if (b.x < x0 - b.r) { s.score[1]++; s.pause = 1500; W.events.push({ type: 'goal', team: 'B', score: s.score.slice() }); }
      else if (b.x > x1 + b.r) { s.score[0]++; s.pause = 1500; W.events.push({ type: 'goal', team: 'A', score: s.score.slice() }); }
    };
    A.hud = W => { const s = W.state; if (!s.score) return []; const left = Math.max(0, A.matchMs - W.time) / 1000; return [['Score', `A ${s.score[0]} – ${s.score[1]} B`, 'big'], ['Time', `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`]]; };
  }
  else if (id === 'sumo') {
    A.w = 2.0; A.h = 2.0;
    const R = 0.77, cx = 1, cy = 1;
    A.ring = { cx, cy, R };
    A.floor = new Floor(A.w, A.h, 0.5, '#8a8f96').disc(cx, cy, R, 0.04, '#141518').ring(cx, cy, R - 0.05, R, 0.95, '#f5f5f2');
    A.floor.outside = (x, y) => Math.hypot(x - cx, y - cy) > R;
    A.walls = [];
    const st = opts.start || 'facing', d = 0.28;
    let s0, s1;
    if (st === 'back') { s0 = { x: cx - d, y: cy, th: Math.PI }; s1 = { x: cx + d, y: cy, th: 0 }; }
    else if (st === 'side') { s0 = { x: cx - d, y: cy, th: Math.PI / 2 }; s1 = { x: cx + d, y: cy, th: -Math.PI / 2 }; }
    else if (st === 'random') { const rng = mulberry32((opts.seed || 1) * 7919); const a = rng() * Math.PI * 2; s0 = { x: cx - d, y: cy, th: a }; s1 = { x: cx + d, y: cy, th: rng() * Math.PI * 2 }; }
    else { s0 = { x: cx - d, y: cy, th: 0 }; s1 = { x: cx + d, y: cy, th: Math.PI }; }
    A.spawns = [s0, s1];
    A.start = W => { W.state = { startAt: 0, over: false, falseStart: false, result: null }; };
    A.update = W => {
      const s = W.state; if (s.over) return;
      const [a, b] = W.robots;
      if (W.time < 5000 && !s.falseStart && Math.hypot(a.x - a.start.x, a.y - a.start.y) > 0.03) { s.falseStart = true; W.events.push({ type: 'note', text: 'False start! Sumo robots must wait 5 seconds before moving.' }); }
      for (const r of W.robots) {
        if (!r.fallen && Math.hypot(r.x - cx, r.y - cy) > R) { r.fallen = true; r.vx = r.vy = r.w = 0; }
      }
      if (W.time % 10) return;
      const fa = a.fallen, fb = b && b.fallen;
      if (fa || fb || W.time >= 183000) {
        s.over = true;
        let text, winner;
        if (fa && fb) { text = 'Both robots fell out — draw'; winner = null; }
        else if (fa) { text = b ? `${b.name} wins! ${a.name} left the ring.` : `${a.name} drove out of the ring.`; winner = b ? 'B' : null; }
        else if (fb) { text = `${a.name} wins! ${b.name} was pushed out.`; winner = 'A'; }
        else { text = 'Time is up — draw'; winner = null; }
        s.result = winner; W.events.push({ type: 'over', text, winner, time: W.time / 1000 });
      }
    };
    A.hud = W => {
      const s = W.state; if (!('over' in s)) return [];
      const t = W.time / 1000;
      const rows = t < 5 ? [['Wait', (5 - t).toFixed(1) + ' s', 'big']] : [['Fight', t.toFixed(1) + ' s']];
      const a = W.robots[0];
      rows.push(['Distance to edge', Math.max(0, (R - Math.hypot(a.x - cx, a.y - cy)) * 100).toFixed(0) + ' cm']);
      if (s.falseStart) rows.push(['Rule', 'False start', 'bad']);
      return rows;
    };
  }
  else if (id === 'maze') {
    A.w = 2.6; A.h = 1.8;
    A.goal = { x0: 2.15, y0: 1.3, x1: 2.55, y1: 1.75 };
    A.floor = new Floor(A.w, A.h, 0.9, '#efede6').rect(A.goal.x0, A.goal.y0, A.goal.x1, A.goal.y1, 0.5, '#7fd3a3');
    A.walls = boxWalls(A.w, A.h);
    const box = (x, y, w, h, th = 0) => ({ x, y, hl: w / 2, hw: h / 2, th });
    A.boxes = variant === 'room2'
      ? [box(0.8, 0.45, 0.12, 0.9), box(0.8, 1.55, 0.12, 0.5), box(1.45, 1.1, 0.12, 1.4), box(2.05, 0.45, 0.12, 0.9), box(2.2, 1.1, 0.5, 0.1)]
      : [box(0.9, 0.5, 0.3, 0.3), box(1.4, 1.25, 0.25, 0.4, 0.4), box(1.9, 0.6, 0.35, 0.2, -0.3), box(0.6, 1.35, 0.2, 0.2), box(2.2, 1.05, 0.4, 0.08)];
    A.spawns = [{ x: 0.25, y: 0.25, th: 0 }];
    A.start = W => { W.state = { done: null }; };
    A.update = W => {
      const s = W.state, r = W.robots[0]; if (s.done !== null || W.time % 10) return;
      const g = A.goal; if (r.x > g.x0 && r.x < g.x1 && r.y > g.y0 && r.y < g.y1) { s.done = W.time / 1000; W.events.push({ type: 'over', text: `Goal reached in ${s.done.toFixed(2)} s with ${W.bumps} bumps`, winner: 'A' }); }
    };
    A.hud = W => { const s = W.state; if (!('done' in s)) return []; return [['Time', (s.done ?? W.time / 1000).toFixed(1) + ' s'], ['Bumps', String(W.bumps), W.bumps ? 'bad' : ''], ['Sonar', W.robots[0].lastSonar < 4 ? (W.robots[0].lastSonar * 100).toFixed(0) + ' cm' : '—']]; };
  }
  else {
    A.w = 3.0; A.h = 2.0;
    const tape = new Path([P(0.3, 0.45), P(2.7, 0.45)], false, 0.01);
    A.floor = new Floor(A.w, A.h, 0.92, '#f4f2ec').poly(tape, 0.025, 0.05, '#17191c');
    A.grid = true;
    A.walls = boxWalls(A.w, A.h);
    A.spawns = [{ x: 0.5, y: 1.2, th: 0 }];
    A.marks = [0.5, 1.5, 2.5];
    A.start = W => { W.state = {}; };
    A.hud = W => { const r = W.robots[0]; const d = Math.hypot(r.x - r.start.x, r.y - r.start.y); return [['Distance', (d * 100).toFixed(1) + ' cm'], ['Turned', (r.headingAcc * 180 / Math.PI).toFixed(1) + '°'], ['Speed', (Math.hypot(r.vx, r.vy) * 100).toFixed(0) + ' cm/s'], ['Time', (W.time / 1000).toFixed(2) + ' s']]; };
  }
  A.events = [];
  return A;
}

function buildWorld(arenaId, variant, opts, cfgA, cfgB, oppMode) {
  const A = buildArena(arenaId, variant, opts);
  const W = new World(A);
  W.variant = variant;
  W.events = [];
  const level = opts.realism || 'ideal';
  W.env = makeEnv(level, opts.tableSeed || 11, arenaId);
  A.floor.env = W.env;
  W.rng = mulberry32(level === 'ideal' ? 7 : (opts.runSeed || 7));   // the Ideal robot: same code, same result
  if (W.env.k && (arenaId === 'line' || arenaId === 'lab')) {
    // Hand-laid electrical tape: it wanders a few millimetres and its edges are not perfectly straight.
    const L0 = A.floor.layers.find(L => L.k === 'poly');
    if (L0) { const P0 = L0.path, sd = (opts.tableSeed || 11) + 21; L0.path = new Path(P0.pts.map((p, i) => { const t = P0.tangent(i), m = 0.0025 * W.env.k * vnoise(i * 0.02, 0.5, sd) + 0.0008 * W.env.k * vnoise(i * 0.25, 1.5, sd); return P(p.x - Math.sin(t) * m, p.y + Math.cos(t) * m); }), P0.closed, 0.01); L0.hw *= 1 + 0.04 * W.env.k * vnoise(3.3, 7.1, sd); }
  }
  if (W.env.k && arenaId === 'line' && A.path) {
    // a few scuffs and dust marks on the mat, some of them right on the line
    const rng = mulberry32((opts.tableSeed || 11) * 13 + 1), P = A.path.pts, n = Math.round(4 * W.env.k);
    for (let i = 0; i < n; i++) { const p = P[Math.floor(rng() * P.length)]; A.floor.disc(p.x + (rng() - 0.5) * 0.06, p.y + (rng() - 0.5) * 0.06, 0.008 + 0.015 * rng(), 0.55 + 0.2 * rng(), 'rgba(150,140,120,.45)'); }
  }
  const ra = W.add(new Robot(cfgA, 'Dowee A', '#f8cf3f'));
  ra.q = makeQuirks(opts.unitA || 1, level, cfgA.sensors); ra.battery = opts.batteryA ?? 1;
  const s0 = A.spawns[0]; ra.place(s0.x, s0.y, s0.th); ra.team = 'A';
  if (oppMode && oppMode !== 'none' && A.spawns[1]) {
    const rb = W.add(new Robot(cfgB, 'Dowee B', '#8c5bc4'));
    const s1 = A.spawns[1]; rb.place(s1.x, s1.y, s1.th); rb.team = 'B';
    rb.q = makeQuirks(opts.unitB || 2, level, cfgB.sensors);
    if (arenaId === 'sumo' && ['statue', 'wander', 'hunter', 'bulldozer'].includes(oppMode)) { rb.ai = makeSumoAI(oppMode); if (oppMode === 'bulldozer') rb.setCfg({ ...cfgB, stall: 3.6, grip: 1.05, mass: 0.85 }); if (oppMode === 'hunter') rb.setCfg({ ...cfgB, stall: 2.2 }); }
    if (arenaId === 'soccer' && ['easy', 'medium', 'hard'].includes(oppMode)) rb.ai = makeSoccerAI(oppMode);
    if (arenaId === 'race' && ['easy', 'medium', 'hard'].includes(oppMode)) rb.ai = makeRaceAI(oppMode);
  }
  A.start && A.start(W);
  return W;
}

if (typeof module !== 'undefined') module.exports = { makeQuirks, makeEnv, compileArduino, Board, Robot, World, buildWorld, buildArena, makeCfg, PRESETS, ARENAS, CError, RTError, LapTracker };
