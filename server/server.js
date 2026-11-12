#!/usr/bin/env node
/* =====================================================================
   DOWEE classroom server
   Runs on the teacher's laptop. Students on the same Wi-Fi open the
   link (or scan the QR code) and use the simulator in their browser.
   No internet and no extra packages needed: only Node.js.

   node server/server.js [--port 8080] [--no-open]
   ===================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');

const VERSION = '1.0.0';
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(__dirname, 'public');
const APP_DIR = path.join(ROOT, 'app');
const APP_FILE = path.join(APP_DIR, 'index.html');
const argv = process.argv.slice(2);
const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const DATA_DIR = process.env.DOWEE_DATA || arg('--data') || path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'dowee-classroom.json');
const START_PORT = +(arg('--port') || process.env.PORT || 8080);

/* ---------------- limits & helpers ---------------- */
const LIM = { body: 300 * 1024, code: 30000, xml: 60000, name: 40, text: 2000, activities: 60, students: 200, matches: 200 };
const ARENAS = ['line', 'race', 'soccer', 'sumo', 'maze', 'lab'];
const REALISM = ['', 'ideal', 'real', 'tough'];
// Each class is about one kind of robot. Students only see these playgrounds; the Test lab is always included.
const ROBOT_TYPES = {
  line: { label: 'Line follower', arenas: ['line', 'lab'], seed: ['drive', 'see', 'follow', 'pid1', 'pid2', 'pid3', 'pid'] },
  sumo: { label: 'Sumo robot', arenas: ['sumo', 'lab'], seed: ['drive', 'turn', 'edge', 'fight'] },
  rc: { label: 'RC robot', arenas: ['race', 'soccer', 'lab'], seed: ['drive', 'rc', 'soccer'] },
  obstacle: { label: 'Obstacle avoider', arenas: ['maze', 'lab'], seed: ['drive', 'turn', 'sonar'] },
  all: { label: 'Everything (free play)', arenas: ['line', 'race', 'soccer', 'sumo', 'maze', 'lab'], seed: ['blocks', 'drive', 'follow'] },
};
const BUILTIN = {
  blocks: ['Blocks 1: Your first blocks program', 'lab', 'lab'], blink: ['Blink the LED', 'lab', 'lab'], drive: ['Drive exactly 1 metre', 'lab', 'lab'], turn: ['Turn 90 degrees', 'lab', 'lab'],
  see: ['See what the sensors see', 'line', 'oval'], follow: ['Follow the line with 2 sensors', 'line', 'oval'], pid1: ['PID 1: Where is the line?', 'line', 'oval'], pid2: ['PID 2: P, steer smoothly', 'line', 'oval'],
  pid3: ['PID 3: D, calm the wiggle', 'line', 'oval'], pid: ['PID 4: Calibrate and race', 'line', 'snake'],
  apid1: ['Advanced PID 1: Fill in the blanks (worksheet)', 'line', 'snake'], apid2: ['Advanced PID 2: Fill in the blanks (in the editor)', 'line', 'snake'], apid3: ['Advanced PID 3: Build your own PID racer', 'line', 'oval'],
  'b-blink': ['Blocks 2: Blink forever', 'lab', 'lab'], 'b-square': ['Blocks 3: Drive a square (repeat)', 'lab', 'lab'], 'b-count': ['Blocks 4: Count with a variable', 'lab', 'lab'],
  'b-follow': ['Blocks 5: Follow the line with if / else', 'line', 'oval'], 'b-avoid': ['Blocks 6: Don\'t bump (distance and if)', 'maze', 'room1'], 'b-rc': ['Blocks 7: Bluetooth remote', 'race', 'none'],
  'b-func': ['Blocks 8: Make your own block', 'lab', 'lab'], 'b-every': ['Blocks 9: Two things at once (every … ms)', 'line', 'oval'], 'b-tocode': ['Blocks 10: From blocks to code', 'line', 'oval'],
  rc: ['Bluetooth RC driver', 'race', 'none'], sonar: ['Ultrasonic eyes', 'maze', 'room1'], edge: ['Stay inside the ring', 'sumo', 'none'], fight: ['Win a sumo match', 'sumo', 'hunter'], soccer: ['Score two goals', 'soccer', 'easy'],
};
const lowerLabel = l => (/^RC/.test(l) ? l : l.charAt(0).toLowerCase() + l.slice(1));
const robotOf = c => (ROBOT_TYPES[c.robot] ? c.robot : 'all');
// The teacher can tick extra playgrounds (or untick some) after making the class: c.arenaPick.
const ARENA_NAMES = { line: 'Line following', race: 'RC race', soccer: 'Robot soccer', sumo: 'Sumo', maze: 'Obstacle room', lab: 'Test lab' };
const cleanPick = v => (Array.isArray(v) && v.length ? ARENAS.filter(a => a === 'lab' || v.includes(a)) : null);
const allowedArenas = c => (Array.isArray(c.arenaPick) && c.arenaPick.length ? ARENAS.filter(a => a === 'lab' || c.arenaPick.includes(a)) : ROBOT_TYPES[robotOf(c)].arenas);
function robotInfo(c) {
  const base = ROBOT_TYPES[robotOf(c)], arenas = allowedArenas(c);
  const custom = arenas.length !== base.arenas.length || arenas.some(a => !base.arenas.includes(a));
  const added = arenas.filter(a => !base.arenas.includes(a)).map(a => ARENA_NAMES[a]), removed = base.arenas.filter(a => !arenas.includes(a)).map(a => ARENA_NAMES[a]);
  const label = !custom ? base.label : `${base.label}${added.length ? ' + ' + added.join(', ') : ''}${removed.length ? ' (no ' + removed.join(', ') + ')' : ''}`;
  return { robot: robotOf(c), robotLabel: label, robotBase: base.label, custom, arenas };
}
function seedActivities(robot) {
  return ROBOT_TYPES[robot].seed.map(id => ({ id: newId(4), title: BUILTIN[id][0], builtin: id, arena: BUILTIN[id][1], variant: BUILTIN[id][2], realism: '', intro: '', steps: [], starter: { kind: 'lesson' }, goal: { type: 'builtin' } }));
}
const newId = (n = 6) => crypto.randomBytes(n).toString('hex');
const newToken = () => crypto.randomBytes(24).toString('base64url');
const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max);
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const now = () => Date.now();
// sample programs per arena (from the build), used to check what a teacher unlocks
let META = null;
function metaJson() { if (!META) { try { META = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'meta.json'), 'utf8')); } catch (e) { META = { examples: {} }; } } return META; }
function examplesMeta() { return metaJson().examples || {}; }
function cleanSettings(v, arenas) {
  v = v && typeof v === 'object' ? v : {};
  const ex = examplesMeta();
  // "arena/example" for code samples, "blk:arena/example" for block samples
  const bex = metaJson().blockExamples || {};
  const unlocked = Array.isArray(v.unlocked) ? [...new Set(v.unlocked.map(x => str(x, 44)))].filter(k => { const blk = k.startsWith('blk:'), [a, e] = (blk ? k.slice(4) : k).split('/'); const set = blk ? bex : ex; return arenas.includes(a) && set[a] && set[a][e]; }).slice(0, 60) : [];
  return { showCode: v.showCode !== false, battles: v.battles !== false, level: v.level === 'blank' ? 'blank' : 'guided', hints: v.hints !== false, toolbox: v.toolbox === 'beginner' ? 'beginner' : 'full', unlocked };
}

/* ---------------- data ---------------- */
function newClass(name, robot) {
  robot = ROBOT_TYPES[robot] ? robot : 'line';
  return {
    id: newId(), name: str(name, 60) || 'My robotics class', robot, created: now(), pin: '', announcement: '',
    lock: null, settings: cleanSettings({}, ROBOT_TYPES[robot].arenas),
    activities: seedActivities(robot),
    students: {}, matches: [], handouts: [],
  };
}
let db;
function load() {
  try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { db = null; }
  if (!db || typeof db !== 'object' || !db.classes) {
    const c = newClass('My robotics class');
    db = { version: 1, teacherKey: newToken(), activeClass: c.id, classes: { [c.id]: c } };
    save(true);
  }
  if (!db.classes[db.activeClass]) db.activeClass = Object.keys(db.classes)[0];
  for (const c of Object.values(db.classes)) {
    if (!ROBOT_TYPES[c.robot]) c.robot = 'all';   // classes saved before robot types existed
    c.settings = cleanSettings(c.settings, allowedArenas(c));   // older classes: guided templates, hints on, nothing unlocked
  }
}
let saveTimer = null;
function save(immediate) {
  clearTimeout(saveTimer);
  const write = () => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) { console.error('Could not save classroom data:', e.message); }
  };
  if (immediate) write(); else saveTimer = setTimeout(write, 800);
}
const cls = () => db.classes[db.activeClass];

/* ---------------- network info ---------------- */
let PORT = START_PORT;
function lanUrls() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push({ name, url: `http://${a.address}:${PORT}/` });
  }
  return out;
}

/* ---------------- who is calling ---------------- */
const isLoopback = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
function cookies(req) { const o = {}; (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
function isTeacher(req) { return isLoopback(req) || cookies(req).dowee_teacher === db.teacherKey; }
function studentFrom(req, url) {
  const t = req.headers['x-dowee-token'] || url.searchParams.get('token');
  if (!t) return null;
  const c = cls();
  return Object.values(c.students).find(s => s.token === t || (s.alias || []).includes(t)) || null;
}

/* ---------------- live updates (Server-Sent Events) ---------------- */
const clients = new Set(); // { res, role, sid }
function sse(res, event, data) { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) { /* client gone */ } }
let bcastTimer = null;
function broadcast() {
  clearTimeout(bcastTimer);
  bcastTimer = setTimeout(() => {
    const c = cls();
    for (const cl of clients) {
      if (cl.role === 'teacher') sse(cl.res, 'teacher', teacherState());
      else { const s = cl.sid && c.students[cl.sid]; if (cl.sid && !s) { sse(cl.res, 'removed', {}); continue; } sse(cl.res, 'state', publicState(s)); }
    }
  }, 250);
}
function pushTo(target, event, data) {
  for (const cl of clients) if (cl.role === 'student' && (target === 'all' || cl.sid === target)) sse(cl.res, event, data);
}
setInterval(() => { for (const cl of clients) { try { cl.res.write(': ping\n\n'); } catch (e) { /* gone */ } } }, 20000);
const onlineIds = () => new Set([...clients].filter(c => c.sid).map(c => c.sid));

/* ---------------- state views ---------------- */
function leaderboards(c) {
  const lb = {};
  for (const s of Object.values(c.students)) for (const [arena, keys] of Object.entries(s.bests || {})) for (const [key, value] of Object.entries(keys)) {
    ((lb[arena] = lb[arena] || {})[key] = lb[arena][key] || []).push({ id: s.id, name: s.name, team: s.team, value });
  }
  for (const a of Object.values(lb)) for (const k of Object.keys(a)) a[k] = a[k].sort((x, y) => x.value - y.value).slice(0, 10);
  const wins = {};
  for (const m of c.matches) if (m.winner) { const id = m.winner === 'A' ? m.aId : m.bId; const s = c.students[id]; if (!s) continue; const w = ((wins[m.arena] = wins[m.arena] || {})[id] = wins[m.arena][id] || { id, name: s.name, team: s.team, value: 0 }); w.value++; }
  for (const [arena, map] of Object.entries(wins)) { (lb[arena] = lb[arena] || {}).wins = Object.values(map).sort((a, b) => b.value - a.value).slice(0, 10); }
  return lb;
}
function publicState(me) {
  const c = cls(), on = onlineIds();
  return {
    classId: c.id, name: c.name, ...robotInfo(c), announcement: c.announcement, lock: c.lock, settings: c.settings, activities: c.activities,
    roster: Object.values(c.students).map(s => ({ id: s.id, name: s.name, team: s.team, online: on.has(s.id), subs: Object.keys(s.subs || {}) })),
    leaderboard: leaderboards(c),
    matches: c.matches.slice(0, 20).map(m => ({ arena: m.arena, a: m.a, b: m.b, winner: m.winner, text: m.text, at: m.at })),
    me: me ? { id: me.id, name: me.name, team: me.team, hand: !!me.hand, progress: me.progress || {}, stars: me.stars || {}, hints: me.hints || {}, subs: Object.fromEntries(Object.entries(me.subs || {}).map(([k, v]) => [k, { at: v.at, activity: v.activity }])) } : null,
  };
}
function teacherState() {
  const c = cls(), on = onlineIds();
  return {
    version: VERSION, port: PORT, lan: lanUrls(), teacherKey: db.teacherKey, dataFile: DATA_FILE,
    robotTypes: Object.fromEntries(Object.entries(ROBOT_TYPES).map(([k, v]) => [k, { label: v.label, arenas: v.arenas }])),
    classes: Object.values(db.classes).map(k => ({ id: k.id, name: k.name, robotLabel: robotInfo(k).robotLabel, students: Object.keys(k.students).length, created: k.created })),
    active: {
      ...c, ...robotInfo(c),
      students: Object.values(c.students).map(s => ({
        id: s.id, name: s.name, team: s.team, joined: s.joined, lastSeen: s.lastSeen, online: on.has(s.id) || now() - (s.lastSeen || 0) < 30000,
        status: s.status || {}, hand: s.hand || null, progress: s.progress || {}, bests: s.bests || {}, stars: s.stars || {}, hints: s.hints || {}, primm: s.primm || {},
        subs: Object.fromEntries(Object.entries(s.subs || {}).map(([k, v]) => [k, { at: v.at, mode: v.mode, activity: v.activity, size: (v.code || '').length }])),
      })),
      leaderboard: leaderboards(c),
    },
  };
}

/* ---------------- validation ---------------- */
function cleanActivity(a) {
  if (!a || typeof a !== 'object') return null;
  const arena = ARENAS.includes(a.arena) ? a.arena : 'lab';
  const st = a.starter && typeof a.starter === 'object' ? a.starter : {};
  const g = a.goal && typeof a.goal === 'object' ? a.goal : {};
  const goal = { type: str(g.type, 20) || 'none' };
  for (const k of ['n', 'sec', 'cm', 'deg', 'tol']) if (g[k] !== undefined) goal[k] = num(g[k], 0, 100000, 0);
  return {
    id: str(a.id, 16) || newId(4), title: str(a.title, 80) || 'Activity', builtin: a.builtin ? str(a.builtin, 30) : undefined,
    arena, variant: str(a.variant, 20), realism: REALISM.includes(a.realism) ? a.realism : '',
    intro: str(a.intro, LIM.text), steps: Array.isArray(a.steps) ? a.steps.slice(0, 12).map(x => str(x, 400)).filter(Boolean) : [],
    starter: { kind: ['none', 'lesson', 'example', 'code', 'blocks'].includes(st.kind) ? st.kind : 'none', example: st.example ? str(st.example, 30) : undefined, code: st.code ? str(st.code, LIM.code) : undefined, xml: st.xml ? str(st.xml, LIM.xml) : undefined },
    goal,
  };
}

/* ---------------- HTTP plumbing ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
function predictions(s) { const p = Object.values(s.primm || {}).filter(e => e.pr !== null && e.pr !== undefined); return p.length ? `${p.filter(e => e.pr).length} of ${p.length}` : ''; }
function mergeStudent(into, from) {
  // the merged device keeps working: its token now points at the kept record
  into.alias = [...new Set([...(into.alias || []), from.token, ...(from.alias || [])])].slice(-8);
  if (!into.team && from.team) into.team = from.team;
  into.joined = Math.min(into.joined || now(), from.joined || now());
  for (const [id, f] of Object.entries(from.progress || {})) {
    const t = (into.progress[id] = into.progress[id] || { done: false, attempts: 0 });
    t.attempts = (t.attempts || 0) + (f.attempts || 0);
    if (f.done && !t.done) { t.done = true; t.at = f.at; t.result = f.result; }
  }
  for (const [a, keys] of Object.entries(from.bests || {})) { const b = (into.bests[a] = into.bests[a] || {}); for (const [k, v] of Object.entries(keys)) if (b[k] === undefined || v < b[k]) b[k] = v; }
  into.stars = into.stars || {}; for (const [a, n] of Object.entries(from.stars || {})) into.stars[a] = Math.max(into.stars[a] || 0, n);
  into.hints = into.hints || {}; for (const [k, n] of Object.entries(from.hints || {})) into.hints[k] = Math.min(99, (into.hints[k] || 0) + n);
  into.primm = into.primm || {};
  for (const [k, e] of Object.entries(from.primm || {})) { const t = into.primm[k]; if (!t) into.primm[k] = e; else { t.done = Math.max(t.done, e.done); if (t.pr === null) t.pr = e.pr; } }
  into.subs = into.subs || {}; for (const [a, v] of Object.entries(from.subs || {})) if (!into.subs[a] || v.at > into.subs[a].at) into.subs[a] = v;
}
function send(res, code, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const fail = (res, code, message) => send(res, code, { error: message });
function readBody(req) {
  return new Promise((ok, bad) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > LIM.body) { bad(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return ok({}); try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); ok(v && typeof v === 'object' ? v : {}); } catch (e) { bad(new Error('bad json')); } });
    req.on('error', bad);
  });
}
function serveFile(res, file, extraHeaders) {
  fs.readFile(file, (err, data) => {
    if (err) return fail(res, 404, 'Not found');
    send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', { 'Cache-Control': file.includes(`${path.sep}vendor${path.sep}`) ? 'public, max-age=86400' : 'no-cache', ...extraHeaders });
  });
}
function serveStatic(res, rel) {
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return fail(res, 403, 'Forbidden');
  serveFile(res, file);
}
const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/* ---------------- routes ---------------- */
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname, M = req.method;
  const c = cls();

  // pages
  if (M === 'GET' && (p === '/' || p === '/index.html')) return serveFile(res, APP_FILE);
  if (M === 'GET' && p === '/styles.css') return serveFile(res, path.join(APP_DIR, 'styles.css'));
  if (M === 'GET' && p === '/teacher') {
    if (url.searchParams.get('key') === db.teacherKey) {
      res.writeHead(302, { Location: '/teacher', 'Set-Cookie': `dowee_teacher=${encodeURIComponent(db.teacherKey)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000` });
      return res.end();
    }
    if (!isTeacher(req)) return send(res, 403, '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Teacher only</title><body style="font-family:system-ui;padding:40px;max-width:520px;margin:auto;line-height:1.5"><h2>This page is for the teacher</h2><p>Open the dashboard on the laptop running DOWEE. To use another device, open the teacher link shown in the dashboard\'s <b>Settings</b>.</p><p><a href="/">Go to the simulator</a></p>', 'text/html; charset=utf-8');
    return serveStatic(res, 'teacher.html');
  }
  if (M === 'GET' && (p.startsWith('/vendor/') || p === '/teacher.js' || p === '/teacher.css' || p === '/meta.json')) {
    if (p === '/teacher.js' && !isTeacher(req)) return fail(res, 403, 'Teacher only');
    return serveStatic(res, p.slice(1));
  }
  if (!p.startsWith('/api/')) return fail(res, 404, 'Not found');

  // live events
  if (M === 'GET' && p === '/api/events') {
    const s = studentFrom(req, url), teacher = !s && isTeacher(req) && url.searchParams.get('as') === 'teacher';
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const client = { res, role: teacher ? 'teacher' : 'student', sid: s ? s.id : null };
    clients.add(client);
    if (teacher) sse(res, 'teacher', teacherState()); else sse(res, 'state', publicState(s));
    if (s) { s.lastSeen = now(); broadcast(); }
    req.on('close', () => { clients.delete(client); if (s) { s.lastSeen = now(); broadcast(); } });
    return;
  }

  let body = {};
  if (M === 'POST') { try { body = await readBody(req); } catch (e) { return fail(res, 400, 'The request could not be read.'); } }
  const me = studentFrom(req, url);

  // public
  if (M === 'GET' && p === '/api/info') return send(res, 200, { app: 'dowee', version: VERSION, classId: c.id, className: c.name, ...robotInfo(c), pinRequired: !!c.pin });
  if (M === 'GET' && p === '/api/whoami') {
    if (me) return send(res, 200, { role: 'student', student: { id: me.id, name: me.name, team: me.team } });
    return send(res, 200, { role: isTeacher(req) ? 'teacher' : 'guest' });
  }
  if (M === 'GET' && p === '/api/state') return send(res, 200, publicState(me));
  if (M === 'POST' && p === '/api/join') {
    const name = str(body.name, LIM.name).trim(), team = str(body.team, LIM.name).trim();
    if (!name) return fail(res, 400, 'Please type your name.');
    if (c.pin && str(body.pin, 12).trim() !== c.pin) return fail(res, 403, 'That class PIN is not right. Ask your teacher.');
    if (Object.keys(c.students).length >= LIM.students) return fail(res, 403, 'This class is full.');
    const s = { id: newId(), token: newToken(), name, team, joined: now(), lastSeen: now(), status: {}, progress: {}, bests: {}, stars: {}, hints: {}, primm: {}, subs: {}, hand: null };
    c.students[s.id] = s; save(); broadcast();
    return send(res, 200, { token: s.token, student: { id: s.id, name, team } });
  }

  // student
  if (p.startsWith('/api/') && ['/api/leave', '/api/status', '/api/hand', '/api/submit', '/api/best', '/api/progress', '/api/profile', '/api/stars', '/api/hint', '/api/primm'].includes(p)) {
    if (!me) return fail(res, 401, 'Join the class first.');
    me.lastSeen = now();
    if (p === '/api/leave') { delete c.students[me.id]; save(); broadcast(); return send(res, 200, { ok: true }); }
    if (p === '/api/profile') { const n = str(body.name, LIM.name).trim(); if (n) me.name = n; me.team = str(body.team, LIM.name).trim(); save(); broadcast(); return send(res, 200, { ok: true }); }
    if (p === '/api/status') {
      me.status = { arena: ARENAS.includes(body.arena) ? body.arena : '', activity: str(body.activity, 16), running: !!body.running, mode: body.mode === 'blocks' ? 'blocks' : 'code', crashed: !!body.crashed, realism: str(body.realism, 8), at: now() };
      broadcast(); return send(res, 200, { ok: true });
    }
    if (p === '/api/hand') { me.hand = body.up ? { at: now(), note: str(body.note, 200) } : null; broadcast(); return send(res, 200, { ok: true }); }
    const notInClass = () => fail(res, 400, 'Your teacher hasn\'t opened that playground for this class.');
    if (p === '/api/submit') {
      if (!ARENAS.includes(body.arena)) return fail(res, 400, 'Unknown arena.');
      if (!allowedArenas(c).includes(body.arena)) return notInClass();
      const code = str(body.code, LIM.code + 1);
      if (code.length > LIM.code) return fail(res, 413, 'This program is too long to hand in.');
      me.subs[body.arena] = { code, mode: body.mode === 'blocks' ? 'blocks' : 'code', activity: str(body.activity, 16), at: now() };
      save(); broadcast(); return send(res, 200, { ok: true });
    }
    if (p === '/api/best') {
      if (!ARENAS.includes(body.arena)) return fail(res, 400, 'Unknown arena.');
      if (!allowedArenas(c).includes(body.arena)) return notInClass();
      const key = str(body.key, 20), v = num(body.value, 0, 1e6, null);
      if (!key || v === null) return fail(res, 400, 'Bad value.');
      const b = (me.bests[body.arena] = me.bests[body.arena] || {});
      if (b[key] === undefined || v < b[key]) { b[key] = +v.toFixed(2); save(); broadcast(); }
      return send(res, 200, { ok: true });
    }
    if (p === '/api/stars') {
      if (!ARENAS.includes(body.arena)) return fail(res, 400, 'Unknown arena.');
      if (!allowedArenas(c).includes(body.arena)) return notInClass();
      const n = Math.round(num(body.n, 0, 3, 0)), st = (me.stars = me.stars || {});
      if (!(st[body.arena] >= n)) { st[body.arena] = n; save(); broadcast(); }
      return send(res, 200, { ok: true });
    }
    if (p === '/api/hint') {
      if (c.settings.hints === false) return fail(res, 403, 'Your teacher has turned hints off. Raise your hand instead!');
      const key = str(body.key, 40); if (!key) return fail(res, 400, 'Bad hint.');
      const h = (me.hints = me.hints || {}); h[key] = Math.min(99, (h[key] || 0) + 1);
      save(); broadcast(); return send(res, 200, { ok: true });
    }
    if (p === '/api/primm') {
      // How far a student got in a lesson's Predict / Run / Investigate / Modify / Make parts,
      // and whether their first prediction was right.
      const key = str(body.lesson, 40); if (!key) return fail(res, 400, 'Bad lesson.');
      const pm = (me.primm = me.primm || {}), e = (pm[key] = pm[key] || { done: 0, total: 0, pr: null });
      e.done = Math.max(e.done, Math.round(num(body.done, 0, 9, 0))); e.total = Math.round(num(body.total, 0, 9, e.total));
      if (e.pr === null && typeof body.predictRight === 'boolean') e.pr = body.predictRight;
      if (e.done === Math.round(num(body.done, 0, 9, 0))) e.next = str(body.next, 16);
      e.at = now(); save(); broadcast(); return send(res, 200, { ok: true });
    }
    if (p === '/api/progress') {
      const id = str(body.activity, 16);
      if (!c.activities.some(a => a.id === id)) return fail(res, 400, 'Unknown activity.');
      const pr = (me.progress[id] = me.progress[id] || { done: false, attempts: 0 });
      pr.attempts = (pr.attempts || 0) + (body.attempt ? 1 : 0);
      if (body.done && !pr.done) { pr.done = true; pr.at = now(); pr.result = str(body.result, 120); }
      save(); broadcast(); return send(res, 200, { ok: true });
    }
  }
  if (M === 'GET' && p === '/api/code') {
    const s = c.students[url.searchParams.get('student')], arena = url.searchParams.get('arena');
    if (!s || !s.subs[arena]) return fail(res, 404, 'No program handed in.');
    if (!(isTeacher(req) || (me && (me.id === s.id || c.settings.showCode)))) return fail(res, 403, 'Your teacher has hidden other students\' code.');
    return send(res, 200, { code: s.subs[arena].code, mode: s.subs[arena].mode, name: s.name, team: s.team, at: s.subs[arena].at });
  }

  // teacher
  if (p.startsWith('/api/teacher/')) {
    if (!isTeacher(req)) return fail(res, 403, 'Teacher only.');
    if (M === 'GET' && p === '/api/teacher/state') return send(res, 200, teacherState());
    if (M === 'POST' && p === '/api/teacher/class') {
      if (body.name !== undefined) c.name = str(body.name, 60) || c.name;
      if (body.robot !== undefined && ROBOT_TYPES[body.robot] && body.robot !== c.robot) { c.robot = body.robot; c.arenaPick = null; }   // a new robot type starts from its own playgrounds
      if (body.arenas !== undefined) c.arenaPick = cleanPick(body.arenas);
      if (body.robot !== undefined || body.arenas !== undefined) c.settings = cleanSettings(c.settings, allowedArenas(c));
      if (body.pin !== undefined) c.pin = str(body.pin, 12).trim();
      if (body.announcement !== undefined) c.announcement = str(body.announcement, 500);
      if (body.lock !== undefined) c.lock = body.lock && c.activities.some(a => a.id === body.lock) ? body.lock : null;
      if (body.settings && typeof body.settings === 'object') c.settings = cleanSettings({ ...c.settings, ...body.settings }, allowedArenas(c));
      if (Array.isArray(body.activities)) c.activities = body.activities.slice(0, LIM.activities).map(cleanActivity).filter(Boolean);
      // a lock on an activity that no longer exists, or isn't in this class's playgrounds, is lifted
      if (c.lock) { const la = c.activities.find(a => a.id === c.lock); if (!la || !allowedArenas(c).includes(la.arena)) c.lock = null; }
      save(); broadcast(); return send(res, 200, { ok: true });
    }
    if (M === 'POST' && p === '/api/teacher/classes/new') { const k = newClass(body.name, body.robot); if (body.level === 'blank') k.settings.level = 'blank'; if (body.copyFrom && db.classes[body.copyFrom]) k.activities = JSON.parse(JSON.stringify(db.classes[body.copyFrom].activities)); db.classes[k.id] = k; db.activeClass = k.id; save(); broadcast(); return send(res, 200, { ok: true, id: k.id }); }
    if (M === 'POST' && p === '/api/teacher/classes/activate') { if (!db.classes[body.id]) return fail(res, 404, 'No such class.'); db.activeClass = body.id; save(); for (const cl of clients) if (cl.role === 'student') sse(cl.res, 'switched', {}); broadcast(); return send(res, 200, { ok: true }); }
    if (M === 'POST' && p === '/api/teacher/classes/delete') {
      if (!db.classes[body.id]) return fail(res, 404, 'No such class.');
      if (Object.keys(db.classes).length < 2) return fail(res, 400, 'You need at least one class.');
      delete db.classes[body.id]; if (db.activeClass === body.id) db.activeClass = Object.keys(db.classes)[0];
      save(); broadcast(); return send(res, 200, { ok: true });
    }
    if (M === 'POST' && p === '/api/teacher/student/merge') {
      // The same student joined twice (new device, cleared browser): keep one record with everything from both.
      const from = c.students[body.from], into = c.students[body.into];
      if (!from || !into || from === into) return fail(res, 400, 'Pick two different students.');
      if (from.name.trim().toLowerCase() !== into.name.trim().toLowerCase()) return fail(res, 400, 'Only students with the same name can be merged.');
      mergeStudent(into, from); delete c.students[body.from]; save(); broadcast(); return send(res, 200, { ok: true });
    }
    if (M === 'POST' && p === '/api/teacher/student/remove') { if (c.students[body.id]) { delete c.students[body.id]; save(); broadcast(); } return send(res, 200, { ok: true }); }
    if (M === 'POST' && p === '/api/teacher/student/hand') { const s = c.students[body.id]; if (s) { s.hand = null; save(); broadcast(); } return send(res, 200, { ok: true }); }
    if (M === 'POST' && p === '/api/teacher/student/reset') { const s = c.students[body.id]; if (s) { if (body.activity) delete s.progress[body.activity]; else s.progress = {}; save(); broadcast(); } return send(res, 200, { ok: true }); }
    if (M === 'POST' && p === '/api/teacher/handout') {
      if (!allowedArenas(c).includes(body.arena)) return fail(res, 400, 'That playground isn\'t open for this class. Tick it under Settings → Playgrounds first.');
      const h = { id: newId(4), arena: body.arena, kind: body.kind === 'blocks' ? 'blocks' : 'code', code: str(body.code, LIM.code), xml: str(body.xml, LIM.xml), note: str(body.note, 300), target: body.target === 'all' || c.students[body.target] ? body.target : 'all', at: now() };
      c.handouts.unshift(h); c.handouts = c.handouts.slice(0, 20); save();
      pushTo(h.target, 'handout', h); broadcast(); return send(res, 200, { ok: true });
    }
    if (M === 'POST' && p === '/api/teacher/message') { pushTo(body.target === 'all' ? 'all' : str(body.target, 16), 'message', { text: str(body.text, 500), at: now() }); return send(res, 200, { ok: true }); }
    if (M === 'POST' && p === '/api/teacher/match') {
      const m = { arena: ARENAS.includes(body.arena) ? body.arena : 'sumo', aId: str(body.aId, 16), bId: str(body.bId, 16), winner: ['A', 'B'].includes(body.winner) ? body.winner : null, text: str(body.text, 200), at: now() };
      m.a = (c.students[m.aId] || {}).name || 'Dowee A'; m.b = (c.students[m.bId] || {}).name || 'Dowee B';
      c.matches.unshift(m); c.matches = c.matches.slice(0, LIM.matches); save(); broadcast(); return send(res, 200, { ok: true });
    }
    if (M === 'GET' && p === '/api/teacher/export.csv') {
      const acts = c.activities, rows = [['Name', 'Team', ...acts.map(a => a.title), 'Activities done', 'Mission stars', 'Hints used', 'Predictions right', 'Lesson parts done', 'Joined']];
      for (const s of Object.values(c.students)) {
        const pr = s.progress || {};
        rows.push([s.name, s.team, ...acts.map(a => (pr[a.id] && pr[a.id].done ? 'done' + (pr[a.id].result ? ' (' + pr[a.id].result + ')' : '') : (pr[a.id] ? 'tried' : ''))), acts.filter(a => pr[a.id] && pr[a.id].done).length, Object.values(s.stars || {}).reduce((x, y) => x + y, 0), Object.values(s.hints || {}).reduce((x, y) => x + y, 0), predictions(s), Object.values(s.primm || {}).reduce((x, e) => x + (e.done || 0), 0), new Date(s.joined).toLocaleString()]);
      }
      return send(res, 200, '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv; charset=utf-8', { 'Content-Disposition': `attachment; filename="${c.name.replace(/[^\w -]/g, '').trim() || 'class'} results.csv"` });
    }
  }
  return fail(res, 404, 'Not found');
}

/* ---------------- start ---------------- */
load();
const server = http.createServer((req, res) => { handle(req, res).catch(e => { console.error(e); try { fail(res, 500, 'Something went wrong on the teacher laptop.'); } catch (x) { /* already sent */ } }); });
server.on('error', e => {
  if (e.code === 'EADDRINUSE' && PORT < START_PORT + 10) { PORT++; server.listen(PORT, '0.0.0.0'); }
  else { console.error('DOWEE could not start:', e.message); process.exit(1); }
});
server.on('listening', () => {
  const lan = lanUrls();
  console.log('\n  DOWEE classroom is running\n');
  console.log(`  Teacher dashboard:  http://localhost:${PORT}/teacher`);
  console.log(`  Students join at:   ${lan.length ? lan.map(l => l.url).join('  or  ') : '(no Wi-Fi network found — connect this laptop to the class network)'}`);
  console.log(`  Class data is saved in ${DATA_FILE}\n  Press Ctrl+C to stop.\n`);
  if (!argv.includes('--no-open')) {
    const u = `http://localhost:${PORT}/teacher`;
    const cmd = process.platform === 'win32' ? `start "" "${u}"` : process.platform === 'darwin' ? `open "${u}"` : `xdg-open "${u}"`;
    exec(cmd, () => { /* no browser available: the link is printed above */ });
  }
});
server.listen(PORT, '0.0.0.0');
process.on('SIGINT', () => { save(true); process.exit(0); });
process.on('SIGTERM', () => { save(true); process.exit(0); });
module.exports = { server };
