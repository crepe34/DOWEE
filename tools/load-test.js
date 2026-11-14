#!/usr/bin/env node
// Classroom load test: starts a throwaway classroom server and fakes a class of students.
// Each fake student does what the real page does: loads the page, joins, keeps the live-update
// connection open, sends its status every 15 s and when it changes, hands in code, reports bests,
// stars, PRIMM parts and hints, and raises its hand now and then. The teacher dashboard is connected too.
//
//   node tools/load-test.js [students=50] [seconds=60] [busy=1]
//
// busy multiplies how often students do things (1 = a normal lesson, 3 = everyone clicking a lot).
// It reports request times, how long a raised hand takes to reach the teacher, how long a handout
// takes to reach every student, the Wi-Fi traffic, and the server's CPU and memory.
'use strict';
const http = require('http'), path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');

const N = +(process.argv[2] || 50), SECS = +(process.argv[3] || 60), BUSY = +(process.argv[4] || 1);
const PORT = 18000 + Math.floor(Math.random() * 2000);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'dowee-load-'));
const agent = new http.Agent({ keepAlive: true, maxSockets: Infinity });
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

// The server under test. The class size limit is lifted with DOWEE_MAX_STUDENTS so we can go past it.
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js'), '--no-open', '--port', String(PORT), '--data', DATA], { env: { ...process.env, DOWEE_MAX_STUDENTS: String(Math.max(N, 200)) }, stdio: ['ignore', 'pipe', 'pipe'] });
let srvErr = ''; srv.stderr.on('data', d => { srvErr += d; });

function req(method, p, body, token, extra = {}) {
  return new Promise(ok => {
    const t0 = process.hrtime.bigint(), data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, agent, headers: { 'Content-Type': 'application/json', ...(token ? { 'x-dowee-token': token } : {}), ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...extra } }, res => {
      let n = 0; const chunks = [];
      res.on('data', c => { n += c.length; if (n < 200000) chunks.push(c); });
      res.on('end', () => ok({ code: res.statusCode === 304 ? 200 : res.statusCode, etag: res.headers.etag, ms: Number(process.hrtime.bigint() - t0) / 1e6, bytes: n, text: Buffer.concat(chunks).toString() }));
    });
    r.on('error', e => ok({ code: 0, ms: Number(process.hrtime.bigint() - t0) / 1e6, bytes: 0, error: e.message }));
    if (data) r.write(data); r.end();
  });
}

// Live updates: count the bytes and events each client receives, and let probes watch for an event.
const live = { bytes: 0, teacherBytes: 0, events: 0, conns: 0, drops: 0, biggest: 0 };
function listen(q, onEvent) {
  return new Promise(ok => {
    const r = http.get({ host: '127.0.0.1', port: PORT, path: '/api/events?' + q, agent: false }, res => {
      live.conns++; ok(r); let buf = '';
      res.on('data', c => {
        if (q.startsWith('as=teacher')) live.teacherBytes += c.length; else live.bytes += c.length;
        buf += c;
        let i; while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /^event: (.*)$/m.exec(block); if (!ev) continue;
          if (ev[1] === 'state') live.biggest = Math.max(live.biggest, block.length);
          live.events++; if (onEvent) onEvent(ev[1], block);
        }
      });
      res.on('end', () => { live.conns--; if (!stopping) live.drops++; });
    });
    r.on('error', () => { if (!stopping) live.drops++; ok(r); });
  });
}

const times = {}, errors = {};
const note = (kind, r) => { (times[kind] = times[kind] || []).push(r.ms); if (r.code !== 200) errors[kind] = (errors[kind] || 0) + 1; };
const pct = (a, p) => { if (!a || !a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const fmt = ms => (ms >= 1000 ? (ms / 1000).toFixed(1) + ' s' : Math.round(ms) + ' ms');

function cpuOf(pid) { try { const f = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' '); return +f[11] + +f[12]; } catch (e) { return null; } }
function rssOf(pid) { try { return +/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${pid}/status`, 'utf8'))[1] * 1024; } catch (e) { return null; } }
const TICK = (() => { try { return +require('child_process').execSync('getconf CLK_TCK').toString() || 100; } catch (e) { return 100; } })();

let stopping = false;
const CODE = n => '// a student program\n' + 'void setup() {\n  Serial.begin(9600);\n}\nvoid loop() {\n' + '  drive(150, 150);\n  delay(100);\n'.repeat(n) + '}\n';

async function main() {
  // wait for the server
  for (let i = 0; i < 100; i++) { const r = await req('GET', '/api/info'); if (r.code === 200) break; await new Promise(z => setTimeout(z, 100)); }
  console.log(`\nDOWEE load test: ${N} students, ${SECS} s, busy ×${BUSY}  (server pid ${srv.pid}, port ${PORT})\n`);

  // the teacher dashboard
  let handSeen = null; const handWait = new Map();
  await listen('as=teacher', (ev, block) => {
    if (ev !== 'teacher' || !handWait.size) return;
    const d = JSON.parse(block.slice(block.indexOf('data: ') + 6));
    for (const s of d.active.students) if (s.hand && handWait.has(s.id)) { handSeen(s.id, s.hand.note); }
  });
  const handLag = [];
  handSeen = (id, noteTxt) => { const w = handWait.get(id); if (w && noteTxt === w.note) { handLag.push(Date.now() - w.t); handWait.delete(id); } };

  // 1. everyone opens the page and joins at once (the start of a lesson)
  const t0 = Date.now(), cpu0 = cpuOf(srv.pid);
  // browsers ask for gzip
  const gz = { 'Accept-Encoding': 'gzip, deflate' };
  const pages = await Promise.all(Array.from({ length: N }, () => Promise.all([req('GET', '/', null, null, gz), req('GET', '/styles.css', null, null, gz)])));
  pages.forEach(([a, b]) => { note('page', a); note('page', b); });
  const pageBytes = pages.reduce((s, [a, b]) => s + a.bytes + b.bytes, 0);
  const joins = await Promise.all(Array.from({ length: N }, (_, i) => req('POST', '/api/join', { name: `Student ${i + 1}`, team: '' })));
  joins.forEach(r => note('join', r));
  const students = joins.map(r => { try { const j = JSON.parse(r.text); return { token: j.token, id: j.student.id }; } catch (e) { return null; } }).filter(Boolean);
  const handoutGot = new Map();
  await Promise.all(students.map(s => listen('token=' + encodeURIComponent(s.token), ev => { if (ev === 'handout' && handoutGot.has('t')) handoutGot.get('t').got.push(Date.now()); })));
  const joinSecs = (Date.now() - t0) / 1000;
  const again = await req('GET', '/', null, null, { ...gz, 'If-None-Match': pages[0][0].etag || '' });
  console.log(`Joining: ${students.length} of ${N} joined in ${joinSecs.toFixed(1)} s. Page loads: median ${fmt(pct(times.page, 50))}, slowest ${fmt(pct(times.page, 100))}. Page data: ${(pageBytes / 1e6).toFixed(1)} MB (${(pageBytes / N / 1e3).toFixed(0)} kB each; a reload sends ${again.bytes} bytes).`);
  if (students.length < N) { const why = joins.find(r => r.code !== 200); console.log('  Join refused:', why && why.text); }

  // 2. a lesson: every student acts on their own timer
  const end = Date.now() + SECS * 1000, timers = [];
  const every = (s, mean, fn) => { const go = () => { if (Date.now() > end) return; fn(s); timers.push(setTimeout(go, rnd(0.3, 1.7) * mean * 1000 / BUSY)); }; timers.push(setTimeout(go, rnd(0, mean) * 1000 / BUSY)); };
  const act = (kind, s, body) => req('POST', '/api/' + kind, body, s.token).then(r => note(kind, r));
  const st = s => ({ arena: pick(['line', 'lab']), activity: '', running: Math.random() < 0.5, mode: pick(['code', 'blocks']), crashed: false, realism: 'ideal' });
  for (const s of students) {
    timers.push(setInterval(() => act('status', s, st(s)), 15000));           // the page's heartbeat
    every(s, 20, () => act('status', s, st(s)));                              // start / stop / switch playground
    every(s, 120, () => act('submit', s, { arena: 'line', code: CODE(Math.floor(rnd(20, 200))), mode: 'code', activity: '' }));
    every(s, 60, () => act('best', s, { arena: 'line', key: 'oval', value: rnd(10, 40) }));
    every(s, 60, () => act('primm', s, { lesson: 'follow', done: Math.floor(rnd(1, 5)), total: 5, next: 'm', predictRight: Math.random() < 0.6 }));
    every(s, 180, () => act('stars', s, { arena: 'line', n: Math.floor(rnd(1, 4)) }));
    every(s, 300, () => act('hint', s, { key: 'line:' + Math.floor(rnd(0, 4)) }));
  }
  // probes: a raised hand must reach the teacher; a handout must reach every student
  const probes = [];
  for (let k = 1; k <= Math.max(3, Math.floor(SECS / 10)); k++) probes.push(setTimeout(() => {
    const s = pick(students), noteTxt = 'probe ' + k; handWait.set(s.id, { t: Date.now(), note: noteTxt });
    req('POST', '/api/hand', { up: true, note: noteTxt }, s.token).then(r => note('hand', r));
  }, k * SECS * 1000 / (Math.max(3, Math.floor(SECS / 10)) + 1)));
  let handout = null;
  probes.push(setTimeout(async () => {
    const h = { t: Date.now(), got: [] }; handoutGot.set('t', h);
    const r = await req('POST', '/api/teacher/handout', { target: 'all', arena: 'line', kind: 'code', code: CODE(50), note: 'Load test' }); note('handout', r);
    setTimeout(() => { handout = { reached: h.got.length, last: h.got.length ? Math.max(...h.got) - h.t : null, median: h.got.length ? pct(h.got.map(x => x - h.t), 50) : null }; }, 5000);
  }, SECS * 500));
  // the teacher's own page polls nothing; it only listens. Watch the server's event loop with a cheap request.
  const loopLag = [];
  const lagTimer = setInterval(() => req('GET', '/api/info').then(r => loopLag.push(r.ms)), 500);
  const liveBytes0 = live.bytes, teacherBytes0 = live.teacherBytes, rss = [];
  const rssTimer = setInterval(() => rss.push(rssOf(srv.pid)), 1000);
  const cpuA = cpuOf(srv.pid), tA = Date.now();
  await new Promise(z => setTimeout(z, SECS * 1000 + 6000));
  stopping = true; timers.forEach(t => { clearTimeout(t); clearInterval(t); }); clearInterval(lagTimer); clearInterval(rssTimer);
  const cpuB = cpuOf(srv.pid), tB = Date.now();

  // 3. report
  const kinds = Object.keys(times).filter(k => !['page', 'join'].includes(k));
  const all = kinds.flatMap(k => times[k]);
  const errs = Object.entries(errors);
  console.log(`\nDuring the lesson (${SECS} s):`);
  console.log(`  Requests: ${all.length} (${(all.length / SECS).toFixed(1)}/s). Time: median ${fmt(pct(all, 50))}, 95% under ${fmt(pct(all, 95))}, slowest ${fmt(pct(all, 100))}.`);
  for (const k of kinds) console.log(`    ${k.padEnd(9)} ${String(times[k].length).padStart(5)}   median ${fmt(pct(times[k], 50)).padStart(6)}   95% ${fmt(pct(times[k], 95)).padStart(6)}`);
  console.log(`  Errors: ${errs.length ? errs.map(([k, n]) => `${k} ${n}`).join(', ') : 'none'}. Live connections open: ${live.conns} (dropped: ${live.drops}).`);
  console.log(`  Server responsiveness (a tiny request every 0.5 s): median ${fmt(pct(loopLag, 50))}, slowest ${fmt(pct(loopLag, 100))}.`);
  console.log(`  Raised hand reaches the teacher: ${handLag.length} of ${probes.length - 1} probes, median ${fmt(pct(handLag, 50))}, slowest ${fmt(pct(handLag, 100))}.`);
  console.log(`  Handout reaches students: ${handout ? `${handout.reached} of ${students.length}, median ${fmt(handout.median || 0)}, last ${fmt(handout.last || 0)}` : 'not measured'}.`);
  const liveRate = (live.bytes - liveBytes0) / ((tB - tA) / 1000);
  const teacherRate = (live.teacherBytes - teacherBytes0) / ((tB - tA) / 1000);
  console.log(`  Live updates over the Wi-Fi to students: ${(liveRate / 1e6 * 8).toFixed(1)} Mbit/s (${(liveRate / 1e3 / Math.max(1, students.length)).toFixed(1)} kB/s per student; the class view is ${(live.biggest / 1e3).toFixed(0)} kB).`);
  console.log(`  To the teacher dashboard (on the laptop itself): ${(teacherRate / 1e6 * 8).toFixed(1)} Mbit/s.`);
  if (cpuA != null && cpuB != null) console.log(`  Server CPU: ${((cpuB - cpuA) / TICK / ((tB - tA) / 1000) * 100).toFixed(0)}% of one core. Memory: up to ${(Math.max(...rss.filter(Boolean)) / 1e6).toFixed(0)} MB.`);
  try { console.log(`  Saved class file: ${(fs.statSync(path.join(DATA, 'dowee-classroom.json')).size / 1e3).toFixed(0)} kB.`); } catch (e) { /* named differently */ }
  if (srvErr.trim()) console.log('\nServer errors:\n' + srvErr.trim().split('\n').slice(0, 10).join('\n'));
  srv.kill('SIGTERM'); agent.destroy();
  setTimeout(() => { fs.rmSync(DATA, { recursive: true, force: true }); process.exit(0); }, 500);
}
main().catch(e => { console.error(e); srv.kill(); process.exit(1); });
