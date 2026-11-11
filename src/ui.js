/* =====================================================================
   RoboBench UI
   ===================================================================== */
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const store = {
  get(k, d) { try { const v = localStorage.getItem('robobench:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('robobench:' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
};
const DEFAULT_VARIANT = { line: 'oval', race: 'none', soccer: 'medium', sumo: 'hunter', maze: 'room1', lab: 'lab' };

const S = {
  arena: ARENAS[store.get('arena', 'line')] ? store.get('arena', 'line') : 'line',
  variant: store.get('variant', {}), start: store.get('start', 'facing'),
  robot: 'A', W: null, running: false, paused: false, speed: 1, simTarget: 0, last: 0,
  trail: true, sensorsView: true, sound: false, customTrack: store.get('customTrack', null),
  drawing: null, bestTrail: null, bestLap: Infinity, runLog: [], runN: 0, lesson: null, lessonDone: store.get('lessonsDone', {}),
  compiled: {}, plot: { series: new Map(), t0: 0 }, serialBuf: { A: '', B: '' }, slow: false, rcKeys: { A: new Set(), B: new Set() }, rcSent: { A: '', B: '' },
  error: null, tips: [],
  realism: ['ideal', 'real', 'tough'].includes(store.get('realism', 'real')) ? store.get('realism', 'real') : 'real',
  unit: store.get('unit', null) || (() => { const u = 1000 + Math.floor(Math.random() * 9000); store.set('unit', u); return u; })(),
  battery: store.get('battery', 1),
};
for (const k of Object.keys(ARENAS)) if (!S.variant[k] || !ARENAS[k].variants[S.variant[k]]) S.variant[k] = DEFAULT_VARIANT[k];

/* ---------------- code buffers ---------------- */
function defaultCode(arena, robot) {
  const ex = EXAMPLES[arena];
  if (robot === 'B') { if (arena === 'sumo') return EXAMPLES.sumo.basic.code; return EXAMPLES.race.rc.code; }
  return ex[DEFAULT_EXAMPLE[arena]].code;
}
const codeKey = (a, r) => `code:${a}:${r}`;
function getCode(a, r) {
  if (typeof modeOf === 'function' && modeOf(a, r) === 'blocks') { const bc = store.get(`blockcode:${a}:${r}`, null); if (bc) return bc; }
  return store.get(codeKey(a, r), null) ?? defaultCode(a, r);
}
// Load text into the Code editor from outside (examples, lessons, other teams): switches that robot to Code mode.
function putCode(a, r, src) { store.set(`mode:${a}:${r}`, 'code'); setCode(a, r, src); }
function setCode(a, r, src) { store.set(codeKey(a, r), src); }

/* ---------------- robot configs ---------------- */
// One standard robot for every arena. Students can still adjust it to match their real build.
function cfgFor() { return makeCfg('dowee', store.get('cfg:dowee', null) || undefined); }
function saveCfg(arena, cfg) { store.set('cfg:dowee', cfg); }

/* ---------------- editor ---------------- */
const ta = $('#code'), hl = $('#hl'), gutter = $('#gutter'), lineflag = $('#lineflag');
const HL_RE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(^[ \t]*#[^\n]*)|\b(0x[0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?[fFuUlL]*)\b|\b(if|else|while|for|do|switch|case|default|break|continue|return|const|static|volatile|unsigned|signed|true|false)\b|\b(void|int|float|double|long|short|char|bool|boolean|byte|word|String|uint8_t|int8_t|uint16_t|int16_t|uint32_t|int32_t|size_t)\b|\b(HIGH|LOW|INPUT_PULLUP|INPUT|OUTPUT|LED_BUILTIN|A[0-7]|PI|Serial)\b|\b([A-Za-z_]\w*)(?=\s*\()/gm;
function highlight(src) {
  let out = '', last = 0;
  src.replace(HL_RE, (m, com, str, pp, num, kw, ty, k, fn, off) => {
    out += esc(src.slice(last, off));
    const cls = com ? 't-com' : str ? 't-str' : pp ? 't-pp' : num ? 't-num' : kw ? 't-kw' : ty ? 't-ty' : k ? 't-k' : 't-fn';
    out += `<span class="${cls}">${esc(m)}</span>`;
    last = off + m.length;
    return m;
  });
  out += esc(src.slice(last));
  return out + '\n ';
}
let errLine = 0;
function renderEditor() {
  const src = ta.value;
  hl.innerHTML = highlight(src);
  const n = src.split('\n').length;
  let g = '';
  for (let i = 1; i <= n; i++) g += (i === errLine ? `<span class="err">${i}</span>` : i) + '\n';
  gutter.innerHTML = g;
  syncScroll();
}
function syncScroll() {
  hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop;
  if (errLine) { const lh = parseFloat(getComputedStyle(ta).lineHeight); lineflag.style.top = (12 + (errLine - 1) * lh - ta.scrollTop) + 'px'; lineflag.hidden = false; } else lineflag.hidden = true;
}
function insertText(t) {
  ta.focus();
  if (!document.execCommand || !document.execCommand('insertText', false, t)) { ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
}
ta.addEventListener('input', () => { if (errLine) { errLine = 0; } renderEditor(); setCode(S.arena, S.robot, ta.value); });
ta.addEventListener('scroll', syncScroll);
ta.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); toast('Saved in this browser'); return; }
  if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); insertText('  '); return; }
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    const v = ta.value, p = ta.selectionStart, ls = v.lastIndexOf('\n', p - 1) + 1, line = v.slice(ls, p);
    const ind = (line.match(/^[ \t]*/) || [''])[0] + (/\{\s*$/.test(line) ? '  ' : '');
    e.preventDefault(); insertText('\n' + ind); return;
  }
  if (e.key === '}') {
    const v = ta.value, p = ta.selectionStart, ls = v.lastIndexOf('\n', p - 1) + 1, line = v.slice(ls, p);
    if (/^ {2,}$/.test(line) && ta.selectionStart === ta.selectionEnd) { e.preventDefault(); ta.setSelectionRange(p - 2, p); insertText('}'); }
  }
});
function loadEditor() { ta.value = store.get(codeKey(S.arena, S.robot), null) ?? defaultCode(S.arena, S.robot); errLine = 0; renderEditor(); ta.scrollTop = 0; if (window.__blkReady) { fillExamples(); applyMode(); } }
function gotoLine(n) {
  const lines = ta.value.split('\n'); let pos = 0;
  for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  ta.focus(); ta.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
  const lh = parseFloat(getComputedStyle(ta).lineHeight); ta.scrollTop = Math.max(0, (n - 4) * lh); syncScroll();
}

/* ---------------- messages ---------------- */
const msgs = $('#msgs');
function renderMsgs() {
  const items = [];
  if (S.error) items.push(`<div class="msg err" ${S.error.line ? `data-line="${S.error.line}"` : ''}><span class="tag">${S.error.kind}</span><span>${S.error.line ? `<b>Line ${S.error.line}${S.error.robot === 'B' ? ' (Dowee B)' : ''}:</b> ` : ''}${esc(S.error.msg)}</span>${S.error.hint ? `<span class="hint">${esc(S.error.hint)}</span>` : ''}</div>`);
  for (const t of S.tips.slice(-6)) items.push(`<div class="msg ${t.ok ? 'ok' : 'tip'}" ${t.line ? `data-line="${t.line}"` : ''}><span class="tag">${t.ok ? 'OK' : 'Tip'}</span><span>${t.line ? `<b>Line ${t.line}:</b> ` : ''}${esc(t.msg)}</span></div>`);
  msgs.innerHTML = items.join('');
}
msgs.addEventListener('click', e => { const m = e.target.closest('[data-line]'); if (m) gotoLine(+m.dataset.line); });
function addTip(msg, line, ok) { if (S.tips.some(t => t.msg === msg)) return; S.tips.push({ msg, line, ok }); renderMsgs(); }
function setError(kind, e, robot) {
  S.error = { kind, msg: e.message, line: e.line, hint: e.hint, robot };
  if (robot === S.robot || !robot) { errLine = e.line || 0; renderEditor(); if (e.line) gotoLine(e.line); }
  renderMsgs();
}
function clearMsgs() { S.error = null; S.tips = []; errLine = 0; renderEditor(); renderMsgs(); }

/* ---------------- toast & banner ---------------- */
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2200); }
let bannerT;
function banner(title, sub, ms = 2600) {
  const el = $('#banner'); el.innerHTML = esc(title) + (sub ? `<small>${esc(sub)}</small>` : ''); el.hidden = false;
  clearTimeout(bannerT); if (ms) bannerT = setTimeout(() => (el.hidden = true), ms);
}

/* ---------------- arena selection ---------------- */
const DOWEE_ICON = '<svg viewBox="0 0 48 48" aria-hidden="true"><polygon points="8,14 40,14 44,22 40,38 8,38 4,22" fill="#f8cf3f"/><polygon points="40,14 44,22 24,14" fill="#f39a3b"/><polygon points="4,22 8,38 24,38" fill="#f39a3b"/><rect x="11" y="20" width="26" height="12" rx="6" fill="#2e2a4f"/><circle cx="18" cy="26" r="3.2" fill="#a3dcea"/><circle cx="30" cy="26" r="3.2" fill="#a3dcea"/></svg>';
const allowed = id => !S.allowedArenas || S.allowedArenas.includes(id);
function buildArenaTabs() {
  const meet = S.view === 'meet';
  $('#arenaTabs').innerHTML = `<button role="tab" class="meet-tab" data-a="meet" aria-selected="${meet}">${DOWEE_ICON}Meet Dowee</button><span class="sep" aria-hidden="true"></span>`
    + Object.entries(ARENAS).filter(([k]) => allowed(k)).map(([k, a]) => `<button role="tab" data-a="${k}" aria-selected="${!meet && k === S.arena}">${a.name}</button>`).join('');
}
$('#arenaTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.a === 'meet') { showMeet(); return; }
  if (b.dataset.a !== S.arena) setArena(b.dataset.a);
  showWork();
});
// Two main views: the Meet Dowee page, and the workspace (code + arena + instruments).
function showMeet() {
  if (S.running && !S.paused) { S.paused = true; S.pausedByMeet = true; setState(); }
  S.view = 'meet'; store.set('view', 'meet');
  $('.work').hidden = true; $('#meetPage').hidden = false;
  buildArenaTabs(); buildRobotPanel();
}
function showWork() {
  const was = S.view;
  S.view = 'arena'; store.set('view', 'arena');
  $('.work').hidden = false; $('#meetPage').hidden = true;
  if (S.pausedByMeet) { S.pausedByMeet = false; S.paused = false; S.last = performance.now(); setState(); }
  buildArenaTabs();
  if (was === 'meet') { fit(); draw(); if (typeof BK !== 'undefined' && BK.ws && !$('#blkWrap').hidden) Blockly.svgResize(BK.ws); }
}
function needsB() { const v = S.variant[S.arena]; return v === 'code' || v === 'p2'; }
function setArena(id, keepCode) {
  if (!allowed(id)) { toast(S.lockedArena ? 'Your teacher has locked the class to one activity' : `This class doesn't use ${ARENAS[id].name}. Pick one of the playgrounds at the top.`); return false; }
  stop();
  if (S.arena !== id) S.compiled = {};
  S.arena = id; store.set('arena', id);
  buildArenaTabs();
  const A = ARENAS[id];
  $('#variantLbl').textContent = A.variantLabel;
  $('#variantSel').innerHTML = Object.entries(A.variants).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('#variantSel').value = S.variant[id];
  $('#startSel').hidden = !A.starts;
  if (A.starts) { $('#startSel').innerHTML = Object.entries(A.starts).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''); $('#startSel').value = S.start; }
  $('#btnDraw').hidden = id !== 'line';
  S.robot = 'A'; updateRobotTabs();
  fillExamples();
  if (!keepCode) loadEditor();
  S.bestTrail = null; S.bestLap = Infinity;
  clearMsgs(); resetWorld(); buildRobotPanel(); buildWiring(); buildTune();
  if (typeof renderClass === 'function' && window.__clReady) renderClass();
  return true;
}
function updateRobotTabs() {
  $('#tabB').hidden = !needsB();
  if (!needsB() && S.robot === 'B') S.robot = 'A';
  $('#tabA').setAttribute('aria-pressed', S.robot === 'A'); $('#tabB').setAttribute('aria-pressed', S.robot === 'B');
}
$('#robotTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.dataset.r === S.robot) return; S.robot = b.dataset.r; updateRobotTabs(); loadEditor(); renderMsgs(); });
$('#variantSel').addEventListener('change', e => {
  S.variant[S.arena] = e.target.value; store.set('variant', S.variant);
  if (S.arena === 'line' && e.target.value === 'custom' && !(S.customTrack && S.customTrack.length >= 4)) { startDraw(); }
  stop(); updateRobotTabs(); S.bestTrail = null; S.bestLap = Infinity; resetWorld(); buildWiring();
});
$('#startSel').addEventListener('change', e => { S.start = e.target.value; store.set('start', S.start); stop(); resetWorld(); });
function fillExamples() {
  if (typeof modeOf === 'function' && modeOf(S.arena, S.robot) === 'blocks') {
    $('#exampleSel').innerHTML = '<option value="">Load starter blocks…</option>' + Object.entries(BLOCK_STARTERS).filter(([k]) => allowed(k)).map(([k, v]) => `<option value="blk:${k}">${esc(ARENAS[k].name)}: ${esc(v.name)}</option>`).join('');
    return;
  }
  const ex = EXAMPLES[S.arena];
  $('#exampleSel').innerHTML = '<option value="">Load an example…</option>' + Object.entries(ex).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('') + (Object.keys(EXAMPLES).filter(allowed).length > 1 ? '<option value="__all">More from other arenas…</option>' : '');
}
$('#exampleSel').addEventListener('change', e => {
  const k = e.target.value; e.target.value = '';
  if (!k) return;
  if (k.startsWith('blk:')) { loadBlockStarter(k.slice(4)); return; }
  if (k === '__all') {
    const all = [];
    for (const [a, ex] of Object.entries(EXAMPLES)) for (const [kk, v] of Object.entries(ex)) all.push(`${a}/${kk}: ${v.name}`);
    $('#exampleSel').innerHTML = '<option value="">Load an example…</option>' + Object.entries(EXAMPLES).filter(([a]) => allowed(a)).flatMap(([a, ex]) => Object.entries(ex).map(([kk, v]) => `<option value="${a}/${kk}">${esc(ARENAS[a].name)}: ${esc(v.name)}</option>`)).join('');
    return;
  }
  const [a, kk] = k.includes('/') ? k.split('/') : [S.arena, k];
  const src = EXAMPLES[a][kk].code;
  ta.focus(); ta.select(); insertText(src); ta.scrollTop = 0; syncScroll();
  toast('Example loaded. Undo with Ctrl+Z.');
  fillExamples();
});

/* ---------------- world & run ---------------- */
const cv = $('#cv'), ctx = cv.getContext('2d');
let view = { s: 100, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 }, floorCache = null;
function oppMode() { const v = S.variant[S.arena]; return ['line', 'maze', 'lab'].includes(S.arena) ? 'none' : v; }
function resetWorld() {
  const cfg = cfgFor(S.arena);
  const battle = !!S.classMatch;
  S.W = buildWorld(S.arena, S.variant[S.arena], {
    customTrack: S.customTrack, start: S.start, seed: S.runN + 1,
    realism: S.realism, tableSeed: 11,
    unitA: battle ? 101 : S.unit, unitB: battle ? 202 : S.unit * 7 + 3,
    batteryA: battle ? 1 : S.battery, runSeed: battle ? 4242 : (Date.now() & 0xffff) + 1,
  }, cfg, makeCfg(ARENAS[S.arena].preset), oppMode());
  S.W.robots.forEach(r => wireBoard(r));
  floorCache = null; fit(); draw(); updateHud(); buildSensors(); setState();
  $('#rcpad').hidden = !ARENAS[S.arena].rc;
  S.rcSent = { A: '', B: '' };
}
function wireBoard(r) {
  const who = r.team;
  r.board.onSerial = s => { r.board.serialLines += (s.match(/\n/g) || []).length; serialIn(who, s); };
  r.board.onHint = (msg, line) => addTip(msg, line);
  r.board.onError = e => { setError('Crash', e, who); r.board.mode.fill(0); setState(); };
  r.board.onTone = (f, d) => tone(who, f, d);
}
function compileFor(robot, r) {
  const src = robot === S.robot && modeOf(S.arena, robot) === 'code' ? ta.value : getCode(S.arena, robot);
  try {
    const comp = compileArduino(src, r.board);
    comp.warnings.forEach(w => addTip(w.msg, w.line));
    prepareGlobals(comp, robot === 'A' && !S.classMatch);   // a class battle runs students' programs exactly as handed in
    return comp;
  } catch (e) {
    if (e instanceof CError) { if (robot !== S.robot) { S.robot = robot; updateRobotTabs(); loadEditor(); } setError('Error', e, robot); return null; }
    throw e;
  }
}
function verify() {
  clearMsgs();
  const r = new Robot(cfgFor(S.arena), 'tmp', '#000');
  const comp = compileFor(S.robot, r);
  if (comp) { addTip(`Compiled. ${comp.funcs.size} functions, ${comp.globals.length} global variables. Ready to upload.`, 0, true); buildTune(comp); }
}
function run() {
  if (modeOf(S.arena, S.robot) === 'code') setCode(S.arena, S.robot, ta.value);
  clearMsgs();
  resetWorld();
  const W = S.W;
  let ok = true;
  for (const r of W.robots) {
    if (r.ai) continue;
    const comp = compileFor(r.team, r);
    if (!comp) { ok = false; break; }
    S.compiled[r.team] = comp;
  }
  if (!ok) { setState(); return; }
  W.robots.forEach(r => { if (!r.ai) r.board.load(S.compiled[r.team], 0); });
  buildTune(S.compiled.A);
  S.lessonDoneNow = null;
  if (window.__clReady) hostAttempt();
  S.running = true; S.paused = false; S.simTarget = 0; S.last = performance.now(); S.runN++;
  S.plot.series.clear(); S.plot.t0 = 0;
  serialSys(`Uploaded to ${W.robots.filter(r => !r.ai).map(r => r.name).join(' and ')} — ${new Date().toLocaleTimeString()}`);
  $('#banner').hidden = true;
  setState();
}
function stop() { S.running = false; S.paused = false; for (const k of ['A', 'B']) stopTone(k); setState(); }
function setState() {
  const chip = $('#stateChip');
  const crashed = S.W && S.W.robots.some(r => r.board.state === 'error');
  chip.className = 'state-chip' + (crashed ? ' err' : S.running && !S.paused ? ' run' : '');
  chip.textContent = crashed ? 'Crashed' : S.running ? (S.paused ? 'Paused' : 'Running') : 'Stopped';
  $('#btnRun').innerHTML = (S.running ? '<svg viewBox="0 0 16 16"><path d="M8 2a6 6 0 1 0 6 6h-2a4 4 0 1 1-1.2-2.8L9 7h5V2l-1.8 1.8A6 6 0 0 0 8 2z" fill="currentColor"/></svg>Restart' : '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>Upload &amp; run');
  $('#btnPause').disabled = !S.running; $('#btnPause').textContent = S.paused ? 'Resume' : 'Pause';
  if (typeof sendStatus === 'function' && window.__clReady) setTimeout(() => sendStatus(false), 0);
}
$('#btnRun').addEventListener('click', run);
$('#btnPause').addEventListener('click', () => { if (!S.running) return; S.paused = !S.paused; S.last = performance.now(); if (S.paused) { stopTone('A'); stopTone('B'); } setState(); });
$('#btnReset').addEventListener('click', () => { stop(); resetWorld(); $('#banner').hidden = true; });
$('#btnCheck').addEventListener('click', verify);
$('#speedSel').addEventListener('change', e => { S.speed = +e.target.value; });
$('#realSel').value = S.realism;
$('#realSel').addEventListener('change', e => { S.realism = e.target.value; store.set('realism', S.realism); stop(); resetWorld(); buildRobotPanel(); toast({ ideal: 'Ideal world: perfect motors, sensors and floor', real: 'Realistic: every motor, sensor and floor is a little different', tough: 'Competition day: worn tape, sunlight, dust and a tired battery' }[S.realism]); });
$('#optTrail').addEventListener('change', e => { S.trail = e.target.checked; draw(); });
$('#optSensors').addEventListener('change', e => { S.sensorsView = e.target.checked; draw(); });
$('#optSound').addEventListener('change', e => { S.sound = e.target.checked; if (!S.sound) { stopTone('A'); stopTone('B'); } });
$('#btnCopy').addEventListener('click', () => {
  const txt = ta.value;
  const fallback = () => { ta.focus(); ta.select(); toast('Code selected — press Ctrl+C to copy'); };
  try { navigator.clipboard.writeText(txt).then(() => toast('Copied — paste it into the Arduino IDE'), fallback); } catch (e) { fallback(); }
});
$('#fileIn').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { ta.focus(); ta.select(); insertText(String(rd.result)); ta.scrollTop = 0; syncScroll(); toast(`Opened ${f.name}`); };
  rd.readAsText(f); e.target.value = '';
});

/* ---------------- main loop ---------------- */
function frame(now) {
  const W = S.W;
  if (S.running && !S.paused && W) {
    const dt = Math.min(0.1, (now - S.last) / 1000);
    S.simTarget += dt * 1000 * S.speed;
    const t0 = performance.now();
    while (W.time < S.simTarget) {
      W.step();
      if (performance.now() - t0 > 28) { S.simTarget = W.time; if (!S.slow) { S.slow = true; } break; }
    }
    pollGamepads();
    handleEvents();
    if (S.lesson && now - (S.lastCheck || 0) > 200) { S.lastCheck = now; checkLesson(); }
  }
  S.last = now;
  draw();
  if (now - (S.lastUi || 0) > 120) { S.lastUi = now; trackBattery(); updateHud(); updateSensors(); updateTuneLive(); if (!$('#p-plot').hidden) drawPlot(); }
  requestAnimationFrame(frame);
}
function handleEvents() {
  const W = S.W;
  while (W.events.length) {
    const e = W.events.shift();
    classOnEvent(e);
    if (e.type === 'lap') {
      const extra = e.lap.rms !== undefined && S.arena === 'line' ? `Wobble ${e.lap.rms.toFixed(0)} mm` : '';
      banner(`${e.robot ? e.robot + ' — ' : ''}Lap ${e.n}: ${e.lap.time.toFixed(2)} s`, extra, 1800);
      if (S.arena === 'line') {
        logRun(`Lap ${e.n}`, `${e.lap.time.toFixed(2)} s`, e.lap.time, `${e.lap.rms.toFixed(0)} mm`);
        if (e.lap.time < S.bestLap) { S.bestLap = e.lap.time; const r = W.robots[0], pts = Math.round(e.lap.time * 50) * 2; S.bestTrail = r.trail.slice(-pts); }
      } else if (!e.robot || e.robot === 'Dowee A') logRun(`Lap ${e.n}`, `${e.lap.time.toFixed(2)} s`, e.lap.time, '');
    } else if (e.type === 'finish') {
      banner(`${e.robot} finished ${['1st', '2nd'][e.place - 1] || ''}!`, `${e.time.toFixed(2)} s for ${W.arena.raceLaps} laps`, 0);
    } else if (e.type === 'goal') {
      banner(`GOAL for ${e.team === 'A' ? 'Dowee A' : 'Dowee B'}!`, `A ${e.score[0]} – ${e.score[1]} B`, 1600);
    } else if (e.type === 'over') {
      banner(e.text, 'Press Restart to play again', 0);
      logRun('Result', e.text, null, '');
      if (S.arena === 'sumo' || S.arena === 'maze') setTimeout(() => { if (S.W === W) stop(); }, 1200);
    } else if (e.type === 'note') { banner(e.text, '', 2600); addTip(e.text, 0); }
  }
}

/* ---------------- drawing ---------------- */
function themeColor(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function fit() {
  const st = $('#stage'), r = st.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!S.W || r.width < 10) return;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const A = S.W.arena, pad = 14;
  const s = Math.min((r.width - pad * 2) / A.w, (r.height - pad * 2) / A.h);
  view = { s, ox: (r.width - A.w * s) / 2, oy: (r.height + A.h * s) / 2, dpr, w: r.width, h: r.height };
  floorCache = null;
}
new ResizeObserver(() => { fit(); draw(); }).observe($('#stage'));
function worldTf(c) { c.setTransform(view.s * view.dpr, 0, 0, -view.s * view.dpr, view.ox * view.dpr, view.oy * view.dpr); }
function buildFloor() {
  const A = S.W.arena, F = A.floor, s = view.s * view.dpr;
  const oc = document.createElement('canvas');
  oc.width = Math.max(1, Math.round(A.w * s)); oc.height = Math.max(1, Math.round(A.h * s));
  const c = oc.getContext('2d');
  c.setTransform(s, 0, 0, -s, 0, oc.height);
  c.fillStyle = F.color; c.fillRect(0, 0, A.w, A.h);
  if (A.id === 'sumo') { c.fillStyle = '#5d6168'; c.fillRect(0, 0, A.w, A.h); }
  if (A.grid) {
    for (let x = 0; x <= A.w + 1e-6; x += 0.1) { c.strokeStyle = Math.round(x * 10) % 5 ? 'rgba(40,60,50,.10)' : 'rgba(40,60,50,.28)'; c.lineWidth = 1 / s; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, A.h); c.stroke(); }
    for (let y = 0; y <= A.h + 1e-6; y += 0.1) { c.strokeStyle = Math.round(y * 10) % 5 ? 'rgba(40,60,50,.10)' : 'rgba(40,60,50,.28)'; c.lineWidth = 1 / s; c.beginPath(); c.moveTo(0, y); c.lineTo(A.w, y); c.stroke(); }
  }
  for (const L of F.layers) {
    c.fillStyle = c.strokeStyle = L.color;
    if (L.k === 'poly') {
      const P = L.path.pts; c.lineWidth = L.hw * 2; c.lineJoin = 'round'; c.lineCap = 'round';
      c.setLineDash(L.dashed ? [0.08, 0.08] : []);
      c.beginPath(); c.moveTo(P[0].x, P[0].y); for (const p of P) c.lineTo(p.x, p.y); if (L.path.closed) c.closePath(); c.stroke(); c.setLineDash([]);
    } else if (L.k === 'disc') { c.beginPath(); c.arc(L.cx, L.cy, L.r, 0, Math.PI * 2); c.fill(); }
    else if (L.k === 'ring') { c.lineWidth = L.r2 - L.r1; c.beginPath(); c.arc(L.cx, L.cy, (L.r1 + L.r2) / 2, 0, Math.PI * 2); c.stroke(); }
    else if (L.k === 'rect') { c.fillRect(L.x0, L.y0, L.x1 - L.x0, L.y1 - L.y0); }
  }
  const mark = A.startMark;
  if (mark && mark.checker) {
    const nx = -Math.sin(mark.th), ny = Math.cos(mark.th), tx = Math.cos(mark.th), ty = Math.sin(mark.th), sq = mark.width / 8;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      c.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      const ox = mark.x + nx * (-mark.width / 2 + i * sq) + tx * j * sq, oy = mark.y + ny * (-mark.width / 2 + i * sq) + ty * j * sq;
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + nx * sq, oy + ny * sq); c.lineTo(ox + nx * sq + tx * sq, oy + ny * sq + ty * sq); c.lineTo(ox + tx * sq, oy + ty * sq); c.closePath(); c.fill();
    }
  } else if (mark) {
    const nx = -Math.sin(mark.th), ny = Math.cos(mark.th);
    c.strokeStyle = '#d23b3b'; c.lineWidth = 0.012;
    c.beginPath(); c.moveTo(mark.x + nx * 0.04, mark.y + ny * 0.04); c.lineTo(mark.x + nx * 0.09, mark.y + ny * 0.09); c.stroke();
    c.beginPath(); c.moveTo(mark.x - nx * 0.04, mark.y - ny * 0.04); c.lineTo(mark.x - nx * 0.09, mark.y - ny * 0.09); c.stroke();
  }
  if (A.lines) {
    const L = A.lines; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.012;
    c.strokeRect(L.x0 + 0.03, L.y0 + 0.03, L.x1 - L.x0 - 0.06, L.y1 - L.y0 - 0.06);
    c.beginPath(); c.moveTo(A.w / 2, L.y0 + 0.03); c.lineTo(A.w / 2, L.y1 - 0.03); c.stroke();
    c.beginPath(); c.arc(A.w / 2, A.h / 2, 0.25, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(47,111,235,.35)'; c.fillRect(L.x0 - L.gd, L.gy0, L.gd, L.gy1 - L.gy0);
    c.fillStyle = 'rgba(226,85,47,.35)'; c.fillRect(L.x1, L.gy0, L.gd, L.gy1 - L.gy0);
  }
  if (A.ring) { c.strokeStyle = '#8a5a2b'; c.lineWidth = 0.02; for (const sx of [-0.1, 0.1]) { c.beginPath(); c.moveTo(A.ring.cx + sx, A.ring.cy - 0.1); c.lineTo(A.ring.cx + sx, A.ring.cy + 0.1); c.stroke(); } }
  floorCache = oc;
}
function drawText(t, x, y, opts = {}) {
  const [sx, sy] = [view.ox + x * view.s, view.oy - y * view.s];
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.font = `${opts.weight || 800} ${opts.size || 12}px Nunito, system-ui, sans-serif`;
  ctx.fillStyle = opts.color || '#000'; ctx.textAlign = opts.align || 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t, sx + (opts.dx || 0), sy + (opts.dy || 0));
}
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function draw() {
  const W = S.W; if (!W || !view.w) return;
  if (!floorCache) buildFloor();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = themeColor('--panel-2'); ctx.fillRect(0, 0, cv.width, cv.height);
  const A = W.arena;
  ctx.drawImage(floorCache, Math.round(view.ox * view.dpr), Math.round((view.oy - A.h * view.s) * view.dpr), Math.round(A.w * view.s * view.dpr), Math.round(A.h * view.s * view.dpr));
  if (A.marks) A.marks.forEach((x, i) => { worldTf(ctx); ctx.strokeStyle = 'rgba(11,122,86,.55)'; ctx.lineWidth = 2 / view.s; ctx.setLineDash([0.03, 0.03]); ctx.beginPath(); ctx.moveTo(x, 0.7); ctx.lineTo(x, A.h - 0.05); ctx.stroke(); ctx.setLineDash([]); drawText(i === 0 ? 'start' : `${i} m`, x, A.h - 0.03, { color: '#0b7a56', size: 11, dy: 6 }); });
  if (A.goal) drawText('GOAL', (A.goal.x0 + A.goal.x1) / 2, (A.goal.y0 + A.goal.y1) / 2, { color: '#1b5e3d', size: 13 });
  worldTf(ctx);
  ctx.lineCap = 'round';
  for (const s of W.walls) { ctx.strokeStyle = A.id === 'race' ? '#c94a3c' : '#56606b'; ctx.lineWidth = Math.max(s.r * 2, 2.5 / view.s); ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); }
  for (const b of W.boxes) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.th); ctx.fillStyle = '#b98a55'; ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 2 / view.s; ctx.fillRect(-b.hl, -b.hw, b.hl * 2, b.hw * 2); ctx.strokeRect(-b.hl, -b.hw, b.hl * 2, b.hw * 2); ctx.restore(); }
  if (S.trail) {
    if (S.bestTrail && S.bestTrail.length > 4) { ctx.strokeStyle = 'rgba(233,154,23,.85)'; ctx.lineWidth = 2 / view.s; ctx.setLineDash([0.02, 0.015]); ctx.beginPath(); ctx.moveTo(S.bestTrail[0], S.bestTrail[1]); for (let i = 2; i < S.bestTrail.length; i += 2) ctx.lineTo(S.bestTrail[i], S.bestTrail[i + 1]); ctx.stroke(); ctx.setLineDash([]); }
    for (const r of W.robots) {
      if (r.trail.length < 4) continue;
      ctx.strokeStyle = r.team === 'A' ? 'rgba(47,111,235,.55)' : 'rgba(226,85,47,.55)'; ctx.lineWidth = 2 / view.s;
      ctx.beginPath(); const T = r.trail, from = Math.max(0, T.length - 3000); ctx.moveTo(T[from], T[from + 1]); for (let i = from + 2; i < T.length; i += 2) ctx.lineTo(T[i], T[i + 1]); ctx.stroke();
    }
  }
  if (W.ball) { const b = W.ball; ctx.fillStyle = '#ff8c1a'; ctx.strokeStyle = '#a34f00'; ctx.lineWidth = 1.5 / view.s; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  for (const r of W.robots) drawRobot(r);
  if (S.drawing) {
    worldTf(ctx);
    const pts = S.drawing;
    if (pts.length >= 2) { const sp = pts.length >= 3 ? catmull(pts, pts.length >= 4, 16) : pts; ctx.strokeStyle = 'rgba(23,25,28,.75)'; ctx.lineWidth = 0.025; ctx.lineJoin = ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sp[0].x, sp[0].y); for (const p of sp) ctx.lineTo(p.x, p.y); if (pts.length >= 4) ctx.closePath(); ctx.stroke(); }
    pts.forEach((p, i) => { ctx.fillStyle = i === 0 ? '#0b7a56' : '#e99a17'; ctx.beginPath(); ctx.arc(p.x, p.y, 0.02, 0, Math.PI * 2); ctx.fill(); });
  }
}
// Dowee, seen from above, in the robot's own frame (metres, x forward, y left).
// opts: px = pixels per metre (for hairlines), sensorsOn(i), led, team
const DOWEE_COLORS = { A: ['#f8cf3f', '#f6e27a', '#f39a3b', '#e8b62c'], B: ['#8c5bc4', '#b18be0', '#6f43a8', '#c64f9a'] };
function polyPath(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); }
function drawDowee(c, cfg, opts) {
  const hl = cfg.length / 2, lw = 1 / opts.px, col = DOWEE_COLORS[opts.team] || DOWEE_COLORS.A;
  const wl = 0.0325, ww = 0.024;
  // wheels with tread
  for (const sg of [1, -1]) {
    const y = sg * cfg.track / 2;
    c.fillStyle = '#26232f'; rrect(c, cfg.axle - wl, y - ww / 2, wl * 2, ww, 0.004); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = lw;
    for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(cfg.axle + k * 0.009, y - ww / 2 + 0.002); c.lineTo(cfg.axle + k * 0.009, y + ww / 2 - 0.002); c.stroke(); }
  }
  // low-poly acrylic chassis plate
  const py = Math.max(0.03, cfg.track / 2 - ww / 2 - 0.003), x0 = -hl, x1 = hl - 0.012, ch = 0.018;
  const P = [[x0 + ch, -py], [x1 - ch, -py], [x1, -py + ch], [x1, py - ch], [x1 - ch, py], [x0 + ch, py], [x0, py - ch], [x0, -py + ch]];
  c.fillStyle = col[0]; polyPath(c, P); c.fill();
  for (let i = 0; i < P.length; i++) { c.fillStyle = col[1 + (i % 3)]; c.globalAlpha *= 0.55; polyPath(c, [[0.006, 0.004], P[i], P[(i + 1) % P.length]]); c.fill(); c.globalAlpha /= 0.55; }
  c.strokeStyle = '#2e2a4f'; c.lineWidth = 1.6 * lw; polyPath(c, P); c.stroke();
  // ball caster
  c.fillStyle = '#b9bccb'; c.beginPath(); c.arc(x0 + 0.004, 0, 0.007, 0, Math.PI * 2); c.fill();
  // battery holder: 2 x 18650
  c.fillStyle = '#26232f'; c.fillRect(x0 + 0.006, -0.034, 0.038, 0.068);
  c.fillStyle = '#e07b2a'; c.fillRect(x0 + 0.009, -0.031, 0.015, 0.062); c.fillRect(x0 + 0.026, -0.031, 0.015, 0.062);
  // Arduino Uno
  c.fillStyle = '#1d86a8'; rrect(c, -0.04, -0.0265, 0.062, 0.053, 0.003); c.fill();
  c.fillStyle = '#16232e'; c.fillRect(-0.036, 0.021, 0.05, 0.0035); c.fillRect(-0.03, -0.0245, 0.044, 0.0035); c.fillRect(-0.016, -0.006, 0.02, 0.009);
  c.fillStyle = '#c9ced8'; c.fillRect(-0.042, 0.004, 0.012, 0.012);
  // LED 13
  const led = !!opts.led;
  c.fillStyle = led ? '#ffb020' : '#6b5a2c';
  if (led) { c.shadowColor = '#ffb020'; c.shadowBlur = 16; }
  c.beginPath(); c.arc(0.012, 0.012, 0.0035, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
  // L298N motor driver with heatsink
  c.fillStyle = '#c7343a'; c.fillRect(0.025, -0.021, 0.033, 0.042);
  c.fillStyle = '#1e1c26'; for (let k = 0; k < 5; k++) c.fillRect(0.029 + k * 0.0045, -0.016, 0.0028, 0.03);
  c.fillStyle = '#2f6fd0'; c.fillRect(0.052, -0.019, 0.005, 0.01); c.fillRect(0.052, 0.009, 0.005, 0.01);
  // HC-05 Bluetooth
  c.fillStyle = '#2f5fb8'; c.fillRect(-0.036, -py + 0.004, 0.026, 0.012);
  // wires
  c.lineWidth = 1.2 * lw; c.lineCap = 'round';
  [['#e9467e', 0.018], ['#86bf4f', 0.006], ['#3f74c9', -0.006], ['#f39a3b', -0.018]].forEach(([wc, y]) => { c.strokeStyle = wc; c.beginPath(); c.moveTo(0.02, y * 0.8); c.bezierCurveTo(0.024, y, 0.024, y, 0.027, y * 0.9); c.stroke(); });
  // HC-SR04 ultrasonic
  if (cfg.sonar) {
    c.fillStyle = '#2b62b8'; c.fillRect(x1 - 0.02, -0.0225, 0.016, 0.045);
    for (const sg of [1, -1]) { c.fillStyle = '#d9dde6'; c.strokeStyle = '#6d7180'; c.lineWidth = lw; c.beginPath(); c.arc(x1 - 0.012, sg * 0.013, 0.0078, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#9aa0ae'; c.beginPath(); c.arc(x1 - 0.012, sg * 0.013, 0.004, 0, Math.PI * 2); c.fill(); }
  }
  // IR line sensor array
  if (cfg.sensors > 0) {
    const y0 = ((cfg.sensors - 1) / 2) * cfg.spacing + 0.009;
    c.fillStyle = '#123f30'; rrect(c, cfg.sensorFwd - 0.0065, -y0, 0.013, y0 * 2, 0.002); c.fill();
    for (let i = 0; i < cfg.sensors; i++) {
      const y = ((cfg.sensors - 1) / 2 - i) * cfg.spacing, on = opts.sensorsOn ? opts.sensorsOn(i) : false;
      c.fillStyle = on ? '#ff3b30' : '#3a3a44';
      if (on) { c.shadowColor = '#ff3b30'; c.shadowBlur = 8; }
      c.beginPath(); c.arc(cfg.sensorFwd, y, 0.0045, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    }
  }
}
function drawRobot(r) {
  const c = r.cfg, W = S.W;
  worldTf(ctx);
  ctx.save();
  ctx.translate(r.x, r.y); ctx.rotate(r.th);
  if (r.fallen) { const k = Math.max(0.35, 1 - r.fallT * 1.5); ctx.scale(k, k); ctx.globalAlpha = Math.max(0.25, 1 - r.fallT); }
  if (S.sensorsView && c.sonar && r.lastSonar !== undefined && W.time > 0) {
    const d = Math.min(r.lastSonar, 4), half = c.sonarCone * Math.PI / 180;
    ctx.fillStyle = r.lastSonar < 4 ? 'rgba(233,70,126,.16)' : 'rgba(233,70,126,.06)';
    ctx.beginPath(); ctx.moveTo(r.hl, 0); ctx.arc(r.hl, 0, Math.min(d, 1.2), -half, half); ctx.closePath(); ctx.fill();
  }
  drawDowee(ctx, c, { px: view.s, team: r.team, led: !r.ai && r.board.out[13] && r.board.mode[13] === 1, sensorsOn: i => { const refl = r.reflect(i); return refl === null || refl < 0.5; } });
  ctx.restore();
  const lx = r.x - Math.sin(0) * 0, ly = r.y + r.rad + 0.02;
  drawText(r.team, lx, ly, { color: '#2e2a4f', size: 12 });
}

function trackBattery() {
  const W = S.W; if (!W || !S.running || S.classMatch || S.realism === 'ideal') return;
  const r = W.robots[0]; if (!r) return;
  if (Math.abs(r.battery - S.battery) > 0.0005) { S.battery = r.battery; if (now2() - (S.batSaved || 0) > 3000) { S.batSaved = now2(); store.set('battery', S.battery); } }
  if (S.battery < 0.25 && !S.lowBatWarned) { S.lowBatWarned = true; addTip('Dowee\'s battery is getting low, so the motors are weaker than before. Charge it in the Meet Dowee tab, or re-tune your speeds.', 0); }
}
const now2 = () => performance.now();

/* ---------------- HUD ---------------- */
function updateHud() {
  const W = S.W; if (!W) return;
  const rows = W.arena.hud ? W.arena.hud(W) : [];
  $('#hud').innerHTML = rows.map(([k, v, cls]) => `<div class="${cls || ''}"><b>${esc(k)}</b>${esc(v)}</div>`).join('') + (S.slow ? '<div class="bad"><b>Note</b>Running slower than real time</div>' : '');
  S.slow = false;
}

/* ---------------- serial monitor & plotter ---------------- */
const serialOutEl = $('#serialOut');
let serialLines = [];
function serialPush(html) {
  serialLines.push(html);
  if (serialLines.length > 400) serialLines.splice(0, serialLines.length - 400);
  S.serialDirty = true;
}
setInterval(() => {
  if (!S.serialDirty) return; S.serialDirty = false;
  serialOutEl.innerHTML = serialLines.join('\n');
  if ($('#serialAuto').checked) serialOutEl.scrollTop = serialOutEl.scrollHeight;
}, 100);
function serialSys(t) { serialPush(`<span class="sys">${esc(t)}</span>`); }
function serialIn(who, s) {
  S.serialBuf[who] += s;
  const parts = S.serialBuf[who].split('\n');
  S.serialBuf[who] = parts.pop();
  if (S.serialBuf[who].length > 300) { parts.push(S.serialBuf[who]); S.serialBuf[who] = ''; }
  const tm = $('#serialTime').checked ? `${(S.W.time / 1000).toFixed(3)} → ` : '';
  for (const line of parts) {
    const clean = line.replace(/\r$/, '');
    serialPush(who === 'B' ? `<span class="b">B› ${esc(tm + clean)}</span>` : esc(tm + clean));
    if (who === 'A') plotLine(clean);
  }
}
$('#serialClear').addEventListener('click', () => { serialLines = []; S.serialDirty = true; });
function sendSerial() {
  const v = $('#serialIn').value; if (!v || !S.W) return;
  const r = S.W.robots.find(x => x.team === S.robot) || S.W.robots[0];
  r.board.send(v + '\n'); serialPush(`<span class="sys">→ sent "${esc(v)}" to ${r.name}</span>`); $('#serialIn').value = '';
}
$('#serialSend').addEventListener('click', sendSerial);
$('#serialIn').addEventListener('keydown', e => { if (e.key === 'Enter') sendSerial(); });

const PLOT_COLORS = ['#e9467e', '#3f74c9', '#f39a3b', '#8c5bc4', '#4a9e3a', '#0f8a87', '#d4a514', '#2e2a4f'];
function plotLine(line) {
  if ($('#plotHold').checked) return;
  const toks = line.trim().split(/[\s,\t]+/).filter(Boolean);
  if (!toks.length) return;
  let idx = 0;
  const t = S.W.time;
  for (const tk of toks) {
    let name, val;
    const m = tk.match(/^([^:]+):(-?[\d.eE+-]+)$/);
    if (m) { name = m[1]; val = parseFloat(m[2]); } else { val = parseFloat(tk); name = 'value ' + (idx + 1); if (!/^-?[\d.]+(e[+-]?\d+)?$/i.test(tk)) continue; }
    idx++;
    if (!Number.isFinite(val)) continue;
    let s = S.plot.series.get(name);
    if (!s) { if (S.plot.series.size >= 8) continue; s = []; S.plot.series.set(name, s); }
    s.push(t, val); if (s.length > 4000) s.splice(0, 2);
  }
}
$('#plotClear').addEventListener('click', () => { S.plot.series.clear(); drawPlot(); });
function drawPlot() {
  const c = $('#plotCv'), wrap = c.parentElement, r = wrap.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (r.width < 10) return;
  c.width = r.width * dpr; c.height = r.height * dpr;
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ink = themeColor('--muted'), line = themeColor('--line');
  const series = [...S.plot.series.entries()];
  $('#legend').innerHTML = series.length ? series.map(([n], i) => `<span><i style="background:${PLOT_COLORS[i]}"></i>${esc(n)}</span>`).join('') : '<span style="color:var(--muted)">Print numbers with Serial.println — separate several with commas, or label them like speed:120</span>';
  if (!series.length) return;
  const tMax = Math.max(...series.map(([, s]) => s[s.length - 2] || 0)), tMin = tMax - 10000;
  let lo = Infinity, hi = -Infinity;
  for (const [, s] of series) for (let i = 0; i < s.length; i += 2) if (s[i] >= tMin) { lo = Math.min(lo, s[i + 1]); hi = Math.max(hi, s[i + 1]); }
  if (!Number.isFinite(lo)) return;
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const padv = (hi - lo) * 0.08; lo -= padv; hi += padv;
  const L = 52, R = 10, T = 8, B = 20, w = r.width - L - R, h = r.height - T - B;
  const X = t => L + (t - tMin) / 10000 * w, Y = v => T + (1 - (v - lo) / (hi - lo)) * h;
  g.font = '11px JetBrains Mono, monospace'; g.fillStyle = ink; g.strokeStyle = line; g.lineWidth = 1;
  for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, y = Y(v); g.beginPath(); g.moveTo(L, y); g.lineTo(L + w, y); g.stroke(); g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2), L - 6, y); }
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (let k = 0; k <= 5; k++) { const t = tMin + k * 2000; g.fillText(Math.max(0, t / 1000).toFixed(0) + ' s', X(t), T + h + 4); }
  series.forEach(([, s], i) => {
    g.strokeStyle = PLOT_COLORS[i]; g.lineWidth = 1.6; g.beginPath(); let started = false;
    for (let j = 0; j < s.length; j += 2) { if (s[j] < tMin) continue; const x = X(s[j]), y = Y(s[j + 1]); if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y); }
    g.stroke();
  });
}

/* ---------------- sensors panel ---------------- */
function buildSensors() {
  const r = S.W.robots[0], c = r.cfg;
  let html = '';
  if (c.sensors) html += `<div class="card"><h4><span>Line / edge sensors</span><span>${pinName(c.pins.s0)}–${pinName(c.pins.s0 + c.sensors - 1)}</span></h4><div class="irs" id="irs">${Array.from({ length: c.sensors }, (_, i) => `<div class="ir"><em>${pinName(c.pins.s0 + i)}</em><div class="bar"><i></i><s></s></div><small>0</small></div>`).join('')}</div></div>`;
  html += `<div class="card"><h4><span>Motors</span><span>-255 … 255</span></h4>
    <div class="motor"><span>Left</span><div class="mbar" id="mL"><b></b><i></i><u></u></div><span id="mLv">0</span></div>
    <div class="motor"><span>Right</span><div class="mbar" id="mR"><b></b><i></i><u></u></div><span id="mRv">0</span></div>
    <div class="kv"><span>Shaded zone</span><span>too weak to move</span></div></div>`;
  html += `<div class="card"><h4><span>Robot</span><span>${esc(c.label || '')}</span></h4><div class="kv" id="kv"></div></div>`;
  html += `<div class="card"><h4><span>Arduino pins</span><span>green = OUTPUT</span></h4><div class="pins" id="pins">${[...Array(14).keys(), 14, 15, 16, 17, 18, 19].map(p => `<div class="pin" data-p="${p}"><b>${pinName(p)}</b><span>·</span></div>`).join('')}</div></div>`;
  $('#sensorsBox').innerHTML = html;
  const db = (c.deadband / 255) * 50;
  for (const id of ['mL', 'mR']) { const b = $(`#${id} b`); b.style.left = (50 - db) + '%'; b.style.width = (db * 2) + '%'; }
}
function updateSensors() {
  if ($('#p-sensors').hidden || !S.W) return;
  const r = S.W.robots[0], c = r.cfg, bd = r.board;
  const irs = $$('#irs .ir');
  irs.forEach((el, i) => {
    const v = r.irAnalog(i);
    el.querySelector('i').style.height = (v / 1023 * 100) + '%';
    el.querySelector('small').textContent = v;
    el.classList.toggle('on', v > 512);
  });
  const mb = (id, d) => { const i = $(`#${id} i`), p = Math.abs(d) * 50; i.style.left = d >= 0 ? '50%' : (50 - p) + '%'; i.style.width = p + '%'; $(`#${id}v`).textContent = Math.round(d * 255); };
  mb('mL', r.dutyL); mb('mR', r.dutyR);
  const sp = Math.hypot(r.vx, r.vy);
  const loopsPerS = S._lastLoops !== undefined ? ((bd.loops - S._lastLoops) / Math.max(1e-3, (S.W.time - S._lastT) / 1000)) : 0;
  S._lastLoops = bd.loops; S._lastT = S.W.time;
  $('#kv').innerHTML = [
    ['Speed', (sp * 100).toFixed(1) + ' cm/s'], ['Left wheel', (r.wl * 100).toFixed(1) + ' cm/s'], ['Right wheel', (r.wr * 100).toFixed(1) + ' cm/s'],
    ['Heading', ((r.th * 180 / Math.PI) % 360).toFixed(0) + '°'], ['Driven', (r.odo * 100).toFixed(0) + ' cm'],
    ['Ultrasonic', c.sonar ? (r.lastSonar !== undefined && r.lastSonar < 4 ? (r.lastSonar * 100).toFixed(1) + ' cm' : 'nothing') : 'off'],
    ['loop() speed', bd.state === 'run' && Number.isFinite(loopsPerS) && loopsPerS > 0 ? Math.round(loopsPerS) + ' per s' : '—'],
    ['Wheels slipping', r.slip ? 'yes' : 'no'], ['Battery', S.realism === 'ideal' ? 'ideal' : Math.round(r.battery * 100) + '%'], ['Line', bd.state === 'run' ? String(bd.line) : '—'],
  ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  $$('#pins .pin').forEach(el => {
    const p = +el.dataset.p, out = bd.mode[p] === 1, pwm = bd.pwm[p];
    el.className = 'pin' + (out ? ' out' : '') + (pwm != null && out ? ' pwm' : (out && bd.out[p] ? ' hi' : ''));
    if (pwm != null) el.style.setProperty('--p', (pwm / 255 * 100) + '%');
    el.lastChild.textContent = out ? (pwm != null ? pwm : bd.out[p] ? 'H' : 'L') : bd.mode[p] === 2 ? 'PU' : '·';
  });
}

/* ---------------- tune panel ----------------
   Every global number variable gets a slider. Moving it changes the running program at once,
   and the change is kept across Restart until the number in the code itself changes.
   Ranges follow what the Arduino and Dowee can really do (PWM 0–255, analogRead 0–1023, …). */
const TYPE_BOUNDS = { bool: [0, 1], uint8: [0, 255], char: [-128, 127], int8: [-128, 127], int16: [-32768, 32767], uint16: [0, 65535], int32: [-2147483648, 2147483647], uint32: [0, 4294967295] };
const niceUp = x => { if (x <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(x))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= x) return m * p; return 10 * p; };
// What a variable is for, guessed from its name, and the range that makes sense on real hardware.
function tuneRange(g, v) {
  const n = g.name.toLowerCase(), isF = g.type === 'float', a = Math.abs(v);
  const tb = TYPE_BOUNDS[g.type] || [-1e9, 1e9];
  const fit = (lo, hi, step, hint, hard) => [Math.max(lo, tb[0]), Math.min(hi, tb[1]), step, hint, !!hard];
  if (g.type === 'bool') return [0, 1, 1, 'true / false', true];
  if (/time|delay|duration|interval|period|timeout|(^|_)ms$|millis/.test(n)) return fit(0, Math.max(2000, niceUp(a * 3)), isF ? 1 : 10, 'milliseconds');
  if (/speed|pwm|power|motor|throttle|cruise|attack|turn|base|left|right|max|min/.test(n) && !isF && a <= 255) return fit(v < 0 ? -255 : 0, 255, 1, 'PWM: 0–255 is all a motor pin can take', true);
  if (/limit|thresh|black|white|edge|level|line|sensor|light/.test(n) && a <= 1023) return fit(0, 1023, 1, 'sensor reading: analogRead gives 0–1023', true);
  if (/dist|range|cm|safe|near|far|gap/.test(n) && a <= 400) return fit(0, 400, isF ? 0.5 : 1, 'centimetres: the HC-SR04 sees 2–400 cm', true);
  if (/angle|deg/.test(n)) return fit(v < 0 ? -360 : 0, 360, 1, 'degrees');
  if (isF) { const hi = niceUp(Math.max(a * 4, a < 0.01 ? 1 : 0)); return [v < 0 ? -hi : 0, hi, hi / 400, '']; }
  const hi = Math.max(10, niceUp(a * 2.5)); return fit(v < 0 ? -hi : 0, hi, 1, '');
}
const fmtTune = (g, v) => (g.type === 'float' ? String(+Number(v).toFixed(4)) : String(v));
let tuneGlobals = [];
S.tune = store.get('tune', {});            // { arena: { name: { v: tuned value, base: value in the code } } }
function tuneStore() { return (S.tune[S.arena] = S.tune[S.arena] || {}); }
function saveTune() { store.set('tune', S.tune); }
// Give a freshly compiled program its starting values right away, then apply the student's tuned values.
function prepareGlobals(comp, applyTuned) {
  let sync = true;
  for (const p of comp.initG) { if (p.s) { try { p.s(null); } catch (e) { sync = false; } } else sync = false; }
  comp.initDone = sync;
  comp.codeValues = {};
  for (const g of comp.globals) if (!g.dims && g.type !== 'string') comp.codeValues[g.name] = comp.G[g.slot];
  if (!applyTuned || !sync) return;
  const t = tuneStore();
  for (const g of comp.globals) {
    const o = t[g.name]; if (!o || g.dims || g.isConst || g.type === 'string') continue;
    if (o.base !== comp.codeValues[g.name]) { delete t[g.name]; continue; }   // the code changed: the code wins
    comp.G[g.slot] = WRAP[g.type](o.v);
  }
  saveTune();
}
function buildTune(comp) {
  const box = $('#tuneBox');
  comp = comp || S.compiled.A;
  if (!comp) {
    box.innerHTML = `<h3 class="sec">Live tuning</h3><p class="empty">Press <b>Upload &amp; run</b> or <b>Verify</b>. Every global number variable (like <code class="k">float Kp = 0.09;</code> above setup) gets a slider here. Move it while the robot drives to fine-tune it, just like a real tuning session.</p>${logTable()}`;
    return;
  }
  tuneGlobals = comp.globals.filter(g => !g.dims && g.type !== 'string' && !g.isConst);
  const consts = comp.globals.filter(g => !g.dims && g.isConst).length, t = tuneStore();
  const blocks = modeOf(S.arena, 'A') === 'blocks';
  const rows = tuneGlobals.map((g, i) => {
    const code = comp.codeValues ? comp.codeValues[g.name] : comp.G[g.slot];
    const o = t[g.name] && t[g.name].base === code ? t[g.name] : null;
    const v = o ? WRAP[g.type](o.v) : (comp.G[g.slot] ?? 0);
    const [lo, hi, step, hint, hard] = tuneRange(g, typeof code === 'number' ? code : 0);
    return `<div class="tune-row ${o ? 'tuned' : ''}" data-i="${i}" data-hard="${hard ? 1 : ''}">
      <label title="${esc(g.name)}">${esc(g.name)}<small>${TNAME[g.type]}${hint ? ' · ' + esc(hint) : ''}</small></label>
      <div class="tune-slide"><input type="range" min="${lo}" max="${hi}" step="${step}" value="${v}" aria-label="${esc(g.name)}"><span class="tune-scale"><span>${lo}</span><span>${hi}</span></span></div>
      <div class="tune-num"><input type="number" min="${lo}" max="${hi}" step="${step}" value="${fmtTune(g, v)}" aria-label="${esc(g.name)} value"><span class="tune-code">${o ? `code: ${fmtTune(g, code)} <button class="btn small" data-reset="${i}" title="Go back to the value in the code">Reset</button>` : 'same as code'}</span></div>
    </div>`;
  }).join('');
  box.innerHTML = `<h3 class="sec">Live tuning</h3>
    ${tuneGlobals.length ? `<p class="note" style="margin:0 0 6px">Changes apply instantly while the robot runs and are kept when you press Restart. ${blocks ? 'In Blocks mode, type the final numbers into your blocks.' : 'When you are happy, press <b>Write values into code</b>.'}</p><div>${rows}</div>
      <div class="row" style="margin-top:8px">${blocks ? '' : '<button class="btn" id="tuneWrite">Write values into code</button>'}<button class="btn" id="tuneResetAll">Reset all to the code</button><span class="empty" style="padding:0">${consts ? `${consts} const value${consts > 1 ? 's are' : ' is'} hidden (pins and fixed numbers).` : ''}</span></div>`
      : `<p class="empty">No global number variables found. Put tunable values above setup(), for example <code class="k">int baseSpeed = 150;</code> — without <code class="k">const</code>.</p>`}
    ${logTable()}`;
  $$('#tuneBox .tune-row').forEach(row => {
    const g = tuneGlobals[+row.dataset.i], [rg, num] = row.querySelectorAll('input');
    const tb = TYPE_BOUNDS[g.type];
    const apply = (raw, fromSlider) => {
      let v = parseFloat(raw); if (!Number.isFinite(v)) return;
      if (tb) v = clamp(g.type === 'float' ? v : Math.round(v), tb[0], tb[1]);
      if (row.dataset.hard) {
        // a real hardware limit (PWM 255, analogRead 1023, HC-SR04 400 cm): don't go past it
        const lo = +rg.min, hi = +rg.max;
        if (v > hi || v < lo) { v = clamp(v, lo, hi); if (!fromSlider) { num.value = fmtTune(g, v); toast(`${g.name} can only go from ${lo} to ${hi}: ${row.querySelector('small').textContent.split(' · ')[1] || 'that is the hardware limit'}`); } }
      } else if (v > +rg.max || v < +rg.min) { rg.max = Math.max(+rg.max, niceUp(Math.abs(v) * 1.5)); if (v < 0) rg.min = Math.min(+rg.min, -niceUp(Math.abs(v) * 1.5)); row.querySelector('.tune-scale').innerHTML = `<span>${rg.min}</span><span>${rg.max}</span>`; }
      const conv = WRAP[g.type](v);
      rg.value = conv; if (!fromSlider || document.activeElement !== num) num.value = fmtTune(g, conv);
      const r = S.W && S.W.robots.find(x => x.team === 'A');
      if (r && r.board.G && r.board.G === comp.G) r.board.G[g.slot] = conv;   // the running program sees it at once
      comp.G[g.slot] = conv;
      const code = comp.codeValues ? comp.codeValues[g.name] : conv, tt = tuneStore();
      if (conv === code) delete tt[g.name]; else tt[g.name] = { v: conv, base: code };
      clearTimeout(S.tuneSaveT); S.tuneSaveT = setTimeout(saveTune, 300);
      row.classList.toggle('tuned', conv !== code);
      const tag = row.querySelector('.tune-code');
      if (conv !== code && !tag.querySelector('button')) tag.innerHTML = `code: ${fmtTune(g, code)} <button class="btn small" data-reset="${row.dataset.i}" title="Go back to the value in the code">Reset</button>`;
      if (conv === code) tag.textContent = 'same as code';
    };
    row.applyValue = apply;
    rg.addEventListener('input', () => apply(rg.value, true));
    num.addEventListener('change', () => apply(num.value, false));   // on Enter or leaving the box, so half-typed numbers never reach the robot
    num.addEventListener('keydown', e => { if (e.key === 'Enter') num.blur(); });
    rg.addEventListener('pointerdown', () => (row.dataset.drag = '1'));
    for (const ev of ['pointerup', 'pointercancel', 'change', 'blur']) rg.addEventListener(ev, () => (row.dataset.drag = ''));
  });
  box.onclick = e => {
    const b = e.target.closest('[data-reset]');
    if (b) { const row = b.closest('.tune-row'), g = tuneGlobals[+row.dataset.i]; row.applyValue(comp.codeValues[g.name]); return; }
    if (e.target.id === 'tuneResetAll') { $$('#tuneBox .tune-row').forEach(row => { const g = tuneGlobals[+row.dataset.i]; row.applyValue(comp.codeValues[g.name]); }); toast('All sliders are back to the values in your code'); }
  };
  const wb = $('#tuneWrite'); if (wb) wb.addEventListener('click', writeTuneToCode);
}
// While the robot runs, show values the program changes by itself (counters, lastError, …).
function updateTuneLive() {
  if ($('#p-tune').hidden || !S.running || !S.W) return;
  const r = S.W.robots.find(x => x.team === 'A'); if (!r || !r.board.G) return;
  $$('#tuneBox .tune-row').forEach(row => {
    if (row.dataset.drag || (document.activeElement && row.contains(document.activeElement))) return;
    const g = tuneGlobals[+row.dataset.i], v = r.board.G[g.slot];
    const [rg, num] = row.querySelectorAll('input');
    const shown = fmtTune(g, v);
    if (num.value !== shown) {
      if (!row.dataset.hard && (v > +rg.max || v < +rg.min)) { rg.max = Math.max(+rg.max, niceUp(Math.abs(v) * 1.5)); if (v < 0) rg.min = Math.min(+rg.min, -niceUp(Math.abs(v) * 1.5)); row.querySelector('.tune-scale').innerHTML = `<span>${rg.min}</span><span>${rg.max}</span>`; }
      num.value = shown; rg.value = v;
    }
  });
}
function currentTuneSnapshot() {
  const r = S.W && S.W.robots.find(x => x.team === 'A');
  if (!r || !r.board.G || !tuneGlobals.length) return '';
  return tuneGlobals.slice(0, 5).map(g => `${g.name}=${fmtTune(g, r.board.G[g.slot])}`).join('  ');
}
function writeTuneToCode() {
  if (S.robot !== 'A') { S.robot = 'A'; updateRobotTabs(); loadEditor(); }
  let src = ta.value, n = 0;
  $$('#tuneBox .tune-row').forEach(row => {
    const g = tuneGlobals[+row.dataset.i], v = row.querySelectorAll('input')[1].value;
    const re = new RegExp(`(^[ \\t]*[\\w ]*?\\b${g.name}\\s*=\\s*)(-?[0-9]*\\.?[0-9]+(?:[eE][-+]?\\d+)?[fFlLuU]*)`, 'm');
    if (re.test(src)) { src = src.replace(re, (m, a) => a + (g.type === 'float' && !String(v).includes('.') ? v + '.0' : v)); n++; }
  });
  ta.focus(); ta.select(); insertText(src);
  S.tune[S.arena] = {}; saveTune();   // the code now holds the tuned values
  const comp = S.compiled.A; if (comp) { for (const g of tuneGlobals) comp.codeValues[g.name] = comp.G[g.slot]; buildTune(comp); }
  toast(`Updated ${n} value${n === 1 ? '' : 's'} in the code`);
}
function logRun(what, result, score, extra) {
  S.runLog.unshift({ run: S.runN, arena: ARENAS[S.arena].name, what, result, score, extra, params: currentTuneSnapshot() });
  if (S.runLog.length > 60) S.runLog.pop();
  if (!$('#p-tune').hidden) { const t = $('#logWrap'); if (t) t.outerHTML = logTable(); }
}
function logTable() {
  if (!S.runLog.length) return `<div id="logWrap"><h3 class="sec">Experiment log</h3><p class="empty">Lap times, race results and sumo rounds appear here with the tuning values you used, so you can compare runs.</p></div>`;
  const scores = S.runLog.filter(l => l.score != null).map(l => l.score), best = scores.length ? Math.min(...scores) : null;
  return `<div id="logWrap"><h3 class="sec">Experiment log</h3><div class="tablewrap"><table class="log"><thead><tr><th>Run</th><th>Event</th><th>Result</th><th>Wobble</th><th>Values used</th></tr></thead><tbody>${S.runLog.map(l => `<tr class="${l.score != null && l.score === best ? 'best' : ''}"><td>${l.run}</td><td>${esc(l.what)}</td><td>${esc(l.result)}</td><td>${esc(l.extra || '')}</td><td class="mono">${esc(l.params)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------------- robot setup panel ---------------- */
const CFG_FIELDS = [
  ['Body', [['length', 'Length', 'm', 0.08, 0.3, 0.005], ['width', 'Width', 'm', 0.08, 0.3, 0.005], ['mass', 'Mass', 'kg', 0.1, 5, 0.05]]],
  ['Motors', [['vmax', 'Top speed at 255', 'm/s', 0.1, 3, 0.05], ['stall', 'Push force per wheel', 'N', 0.2, 40, 0.1], ['deadband', 'Minimum PWM to move', '', 0, 150, 1], ['mismatch', 'Right motor weaker by', '%', -30, 30, 1], ['invertL', 'Left motor wires swapped', 'bool'], ['invertR', 'Right motor wires swapped', 'bool']]],
  ['Wheels', [['track', 'Wheel spacing', 'm', 0.05, 0.3, 0.005], ['axle', 'Axle position (+ forward)', 'm', -0.1, 0.1, 0.005], ['grip', 'Tyre grip', '', 0.2, 1.5, 0.05]]],
  ['Line sensors', [['sensors', 'How many', '', 0, 8, 1], ['spacing', 'Spacing', 'm', 0.005, 0.2, 0.001], ['sensorFwd', 'Distance ahead of centre', 'm', 0, 0.2, 0.005], ['sensorRadius', 'Spot size (height)', 'm', 0.002, 0.02, 0.001], ['noise', 'Noise', '%', 0, 10, 0.5], ['irMode', 'digitalRead on black', ['high-on-black', 'low-on-black']]]],
  ['Ultrasonic', [['sonar', 'HC-SR04 fitted', 'bool'], ['sonarCone', 'Beam half-angle', '°', 2, 40, 1]]],
  ['Pins', [['pins.ena', 'ENA (left speed)', 'pin'], ['pins.in1', 'IN1', 'pin'], ['pins.in2', 'IN2', 'pin'], ['pins.enb', 'ENB (right speed)', 'pin'], ['pins.in3', 'IN3', 'pin'], ['pins.in4', 'IN4', 'pin'], ['pins.trig', 'TRIG', 'pin'], ['pins.echo', 'ECHO', 'pin'], ['pins.s0', 'First line sensor', 'pin']]],
];
const pinOpts = sel => [...Array(14).keys(), 14, 15, 16, 17, 18, 19].map(p => `<option value="${p}" ${p === sel ? 'selected' : ''}>${pinName(p)}${PWM_PINS.has(p) ? ' (PWM)' : ''}</option>`).join('');
function buildRobotPanel() {
  const cfg = cfgFor(S.arena);
  const get = k => k.startsWith('pins.') ? cfg.pins[k.slice(5)] : cfg[k];
  const fs = CFG_FIELDS.map(([title, fields]) => `<fieldset><legend>${title}</legend>${fields.map(([k, label, unit, lo, hi, step]) => {
    const v = get(k);
    let input;
    if (unit === 'bool') input = `<input type="checkbox" data-k="${k}" ${v ? 'checked' : ''}>`;
    else if (unit === 'pin') input = `<select data-k="${k}">${pinOpts(v)}</select>`;
    else if (Array.isArray(unit)) input = `<select data-k="${k}">${unit.map(o => `<option ${o === v ? 'selected' : ''} value="${o}">${o === 'high-on-black' ? 'HIGH' : 'LOW'}</option>`).join('')}</select>`;
    else input = `<input type="number" data-k="${k}" value="${v}" min="${lo}" max="${hi}" step="${step}">`;
    return `<label class="field"><span>${label}${unit && typeof unit === 'string' && !['bool', 'pin'].includes(unit) ? ` <small style="display:inline">(${unit})</small>` : ''}</span>${input}</label>`;
  }).join('')}</fieldset>`).join('');
  const changed = JSON.stringify({ ...cfg, label: 0 }) !== JSON.stringify({ ...makeCfg('dowee'), label: 0 });
  const p = cfg.pins, ct = classTypeInfo(), focus = new Set(ct ? ct.focus : []);
  const part = (n, label, chip, cls, text) => `<span class="no ${focus.has(n) ? 'focus' : ''}">${n}</span><dt>${label}</dt><dd class="${focus.has(n) ? 'focus' : ''}"><span class="chip ${cls}">${chip}</span> ${text}${focus.has(n) ? '<span class="tag-focus">used a lot here</span>' : ''}</dd>`;
  const first = S.allowedArenas ? S.allowedArenas.find(x => x !== 'lab') || S.allowedArenas[0] : S.arena;
  const goArena = allowed(S.arena) && S.arena !== 'lab' ? S.arena : first;
  $('#robotBox').innerHTML = `<div class="meet-wrap">
    ${ct ? `<div class="class-banner">${DOWEE_ICON.replace('<svg', '<svg width="44" height="44"')}<div><b>${esc(ct.title)}</b><span>${esc(ct.text)}</span></div></div>` : ''}
    <div class="meet-grid">
      <div class="meet-pic"><canvas id="doweeCv" width="900" height="900" aria-label="Dowee seen from above, with its parts numbered"></canvas></div>
      <div>
        <h1>Meet Dowee</h1>
        <p class="lede">Dowee is the class robot. It's a real Arduino robot you can build, and the code you write here also runs on the real one. The numbers match the picture.</p>
        <dl class="parts">
          ${part(1, 'Brain', 'Arduino Uno', 'b', 'ATmega328P, 16 MHz, 2 KB of memory. It runs your program.')}
          ${part(2, 'Motor driver', 'L298N', 'p', `Gives the motors power. ENA ${pinName(p.ena)} · IN1 ${pinName(p.in1)} · IN2 ${pinName(p.in2)} · ENB ${pinName(p.enb)} · IN3 ${pinName(p.in3)} · IN4 ${pinName(p.in4)}`)}
          ${part(3, 'Motors', '2 × TT gear motor', 'y', '1:48 gearbox, 65 mm wheels, ball caster at the back.')}
          ${part(4, 'Line sensors', '5-channel IR array', 'g', `TCRT5000 on ${pinName(p.s0)}–${pinName(p.s0 + cfg.sensors - 1)}, ${Math.round(cfg.spacing * 1000)} mm apart. Black ≈ 950, white ≈ 100.`)}
          ${part(5, 'Distance', 'HC-SR04', 'v', `Ultrasonic "eyes": TRIG ${pinName(p.trig)} · ECHO ${pinName(p.echo)}, 2–400 cm.`)}
          ${part(6, 'Bluetooth', 'HC-05', 'b', 'On D0 / D1. Talks to a phone or keyboard remote at 9600.')}
          ${part(7, 'Light', 'LED 13', 'y', 'The LED_BUILTIN on the Arduino board.')}
          ${part(8, 'Power', '2 × 18650', 'p', '7.4 V battery pack.')}
        </dl>
        <p class="note" style="margin:0 0 12px">${Math.round(cfg.length * 100)} × ${Math.round(cfg.width * 100)} cm · ${Math.round(cfg.mass * 1000)} g · about ${Math.round(cfg.vmax * 100)} cm/s at full power · needs a PWM of at least ${cfg.deadband} to start moving.</p>
        <div class="start-row"><button class="btn primary" id="startProg">Start programming: ${esc(ARENAS[goArena].name)} →</button><span class="note">The <b>Wiring</b> tab shows how every part connects.</span></div>
        ${unitHtml()}
        ${changed ? '<p class="note" style="margin-top:10px"><b>This Dowee has been changed</b> to match a real build. <button class="btn small" id="doweeReset">Reset to standard Dowee</button></p>' : ''}
      </div>
    </div>
    <details class="adv"${changed ? ' open' : ''}><summary>Match your real robot (advanced)</summary>
      <p class="note">Built your own Dowee? Measure it, weigh it, test its motors and copy your wiring here, so the simulator behaves like your robot. Changes apply when you press Reset or run again.</p>
      <div class="form">${fs}</div>
    </details>
  </div>`;
  $('#startProg').addEventListener('click', () => { if (goArena !== S.arena) { if (setArena(goArena) === false) return; } showWork(); });
  const dr = $('#doweeReset'); if (dr) dr.addEventListener('click', () => { store.set('cfg:dowee', null); buildRobotPanel(); stop(); resetWorld(); buildWiring(); toast('Dowee is back to standard'); });
  drawDoweePortrait();
  const nb = $('#newUnit'); if (nb) nb.addEventListener('click', () => { S.unit = 1000 + Math.floor(Math.random() * 9000); store.set('unit', S.unit); stop(); resetWorld(); buildRobotPanel(); toast(`You got Dowee #${S.unit}. It has its own quirks: calibrate again!`); });
  const cb = $('#chargeBat'); if (cb) cb.addEventListener('click', () => { S.battery = 1; store.set('battery', 1); S.lowBatWarned = false; stop(); resetWorld(); buildRobotPanel(); toast('Battery charged to 100%'); });
  $$('#robotBox [data-k]').forEach(el => el.addEventListener('change', () => {
    const c = cfgFor(S.arena), k = el.dataset.k;
    let v = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' && k !== 'irMode' ? +el.value : el.type === 'number' ? parseFloat(el.value) : el.value;
    if (typeof v === 'number' && !Number.isFinite(v)) return;
    if (el.type === 'number') v = clamp(v, +el.min, +el.max);
    if (k === 'sensors') v = Math.round(v);
    if (k.startsWith('pins.')) c.pins[k.slice(5)] = v; else c[k] = v;
    saveCfg(S.arena, c);
    if (!S.running) resetWorld();
    buildWiring(); buildRobotPanel();
  }));
}
function unitHtml() {
  if (S.realism === 'ideal') return `<p class="note" style="margin-top:10px">The <b>Ideal world</b> setting is on, so this Dowee is perfect: identical motors and sensors, a perfect floor and a battery that never runs down. Switch the <b>World</b> menu to <b>Realistic</b> to drive a real-feeling robot.</p>`;
  const q = makeQuirks(S.unit, S.realism, 5), cfg = cfgFor();
  const pct = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
  const stronger = q.gainL * 1 > q.gainR ? 'left' : 'right', diff = Math.abs(q.gainL - q.gainR) / Math.min(q.gainL, q.gainR);
  const offs = q.sOff.slice(0, cfg.sensors).map((o, i) => `${i + 1}: ${o >= 0 ? '+' : ''}${o}`).join(', ');
  const bat = Math.round(S.battery * 100);
  return `<div class="card" style="margin-top:12px">
    <h4><span>Your Dowee unit #${S.unit}</span><span>${S.realism === 'tough' ? 'competition day' : 'realistic'}</span></h4>
    <p class="note" style="margin:0 0 6px">No two real robots are the same. Your unit has its own small differences, so the best settings for your Dowee are not the same as your classmates'. Calibrate and tune it!</p>
    <div class="row" style="align-items:center;margin-bottom:6px"><b>Battery</b><div class="mbar" style="flex:1;max-width:220px"><i style="left:0;width:${bat}%;background:${bat > 35 ? 'var(--green)' : 'var(--orange)'}"></i></div><span>${bat}% · ${(6.6 + 1.6 * S.battery).toFixed(1)} V</span><button class="btn small" id="chargeBat">Charge</button></div>
    <details><summary style="cursor:pointer;font-weight:800">Reveal this unit's quirks (try to find them by testing first!)</summary>
      <dl class="spec" style="margin-top:6px">
        <dt>Motors</dt><dd>The ${stronger} motor is ${(diff * 100).toFixed(1)}% stronger, so Dowee drifts when you drive "straight".</dd>
        <dt>Start-up PWM</dt><dd>Left needs about ${cfg.deadband + q.dbL + q.stiction}, right about ${cfg.deadband + q.dbR + q.stiction} to start from standstill (less once moving).</dd>
        <dt>Backwards</dt><dd>Gearboxes are ${Math.round((1 - q.revL) * 100)}% / ${Math.round((1 - q.revR) * 100)}% weaker in reverse.</dd>
        <dt>Spin-up time</dt><dd>${Math.round(q.tau * 1000)} ms for the motors to reach speed.</dd>
        <dt>IR sensors</dt><dd>Offsets ${offs}. Sensor height ${(q.height * 1000).toFixed(1)} mm. The bar is mounted ${(q.barY * 1000).toFixed(1)} mm off centre.</dd>
        <dt>Ultrasonic</dt><dd>Reads ${(q.sonarBias * 100).toFixed(1)} cm off, and misses walls hit at more than about 40°.</dd>
      </dl>
    </details>
    <div class="row" style="margin-top:8px"><button class="btn small" id="newUnit">Get a different Dowee</button></div>
  </div>`;
}
// What each class is about, and which numbered parts matter most for it.
const CLASS_TYPES = {
  line: { title: 'This is a line follower class', text: 'Dowee uses its 5 IR sensors (4) to see the black line and steers with its two motors (3).', focus: [3, 4] },
  sumo: { title: 'This is a sumo robot class', text: 'Dowee finds its opponent with the ultrasonic sensor (5), pushes with its motors (3) and uses the IR sensors (4) to stay inside the ring.', focus: [3, 4, 5] },
  rc: { title: 'This is an RC robot class', text: 'You drive Dowee from a phone or keyboard. The commands arrive through the HC-05 Bluetooth module (6).', focus: [3, 6] },
  obstacle: { title: 'This is an obstacle avoider class', text: 'Dowee measures the distance ahead with its ultrasonic sensor (5) and turns before it bumps into things.', focus: [3, 5] },
};
function classTypeInfo() { const t = typeof HOST !== 'undefined' && HOST.on ? ((HOST.state && HOST.state.robot) || (HOST.info && HOST.info.robot)) : null; return CLASS_TYPES[t] || null; }
function drawDoweePortrait() {
  const cv2 = $('#doweeCv'); if (!cv2) return;
  const g = cv2.getContext('2d'), cfg = cfgFor(), W2 = cv2.width, s = W2 / Math.max(0.26, cfg.length + 0.07, cfg.width + 0.07);
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W2, W2);
  g.setTransform(s, 0, 0, -s, W2 / 2, W2 / 2); g.rotate(Math.PI / 2);
  drawDowee(g, cfg, { px: s, team: 'A', led: true, sensorsOn: i => i === 2 });
  // numbered badges on the parts (robot frame: x forward, y left; forward points up on screen)
  const hl = cfg.length / 2, py = Math.max(0.03, cfg.track / 2 - 0.015), focus = new Set((classTypeInfo() || {}).focus || []);
  const spots = [[1, -0.012, -0.006], [2, 0.042, -0.012], [3, cfg.axle, cfg.track / 2], [4, cfg.sensorFwd, ((cfg.sensors - 1) / 2) * cfg.spacing + 0.004], [5, hl - 0.024, 0.013], [6, -0.023, -py + 0.01], [7, 0.012, 0.012], [8, -hl + 0.026, 0.02]];
  g.setTransform(1, 0, 0, 1, 0, 0);
  const r = W2 * 0.026;
  for (const [n, x, y] of spots) {
    const sx = W2 / 2 - s * y, sy = W2 / 2 - s * x, f = focus.has(n);
    g.beginPath(); g.arc(sx, sy, r * (f ? 1.25 : 1), 0, Math.PI * 2);
    g.fillStyle = f ? '#e9467e' : '#2e2a4f'; g.fill();
    g.lineWidth = r * 0.22; g.strokeStyle = '#fffaf1'; g.stroke();
    g.fillStyle = '#fffaf1'; g.font = `800 ${Math.round(r * 1.15)}px Nunito, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), sx, sy + 1);
  }
}

/* ---------------- wiring diagram ---------------- */
function buildWiring() {
  const c = cfgFor(S.arena), p = c.pins, rc = true;
  const devs = [
    { name: 'L298N motor driver', color: '#e9467e', pins: [['ENA', p.ena], ['IN1', p.in1], ['IN2', p.in2], ['IN3', p.in3], ['IN4', p.in4], ['ENB', p.enb]] },
  ];
  if (c.sensors) devs.push({ name: c.sensors > 2 ? `IR line sensor array (${c.sensors})` : 'IR edge sensors (2)', color: '#4a9e3a', pins: Array.from({ length: c.sensors }, (_, i) => [`OUT${i + 1}${i === 0 ? ' left' : i === c.sensors - 1 ? ' right' : ''}`, p.s0 + i]) });
  if (c.sonar) devs.push({ name: 'HC-SR04 ultrasonic', color: '#8c5bc4', pins: [['TRIG', p.trig], ['ECHO', p.echo]] });
  if (rc) devs.push({ name: 'HC-05 Bluetooth', color: '#3f74c9', pins: [['TXD', 0], ['RXD', 1]] });
  const used = [...new Set(devs.flatMap(d => d.pins.map(x => x[1])))].sort((a, b) => a - b);
  const rowH = 22, top = 46, boardX = 16, boardW = 150, devX = 430, devW = 220;
  const pinY = {}; used.forEach((pn, i) => (pinY[pn] = top + i * rowH));
  let y = 16, devSvg = '', wires = '';
  for (const d of devs) {
    const h = 30 + d.pins.length * rowH;
    devSvg += `<rect class="dev" x="${devX}" y="${y}" width="${devW}" height="${h}" rx="9"/><text x="${devX + 12}" y="${y + 20}">${esc(d.name)}</text>`;
    d.pins.forEach(([lab, pn], i) => {
      const py = y + 30 + i * rowH + 10;
      devSvg += `<circle cx="${devX}" cy="${py}" r="4" fill="${d.color}"/><text class="muted" x="${devX + 12}" y="${py + 4}">${esc(lab)}</text>`;
      const sy = pinY[pn];
      wires += `<path d="M${boardX + boardW} ${sy} C ${boardX + boardW + 120} ${sy}, ${devX - 120} ${py}, ${devX} ${py}" fill="none" stroke="${d.color}" stroke-width="2.2" opacity=".85"/>`;
    });
    y += h + 12;
  }
  const boardH = Math.max(top + used.length * rowH + 8, 80);
  const H = Math.max(y, boardH + 20);
  let board = `<rect class="board" x="${boardX}" y="16" width="${boardW}" height="${boardH}" rx="10" stroke-width="1.5"/><text x="${boardX + 12}" y="36">Arduino Uno</text>`;
  used.forEach(pn => { board += `<text class="muted" x="${boardX + boardW - 12}" y="${pinY[pn] + 4}" text-anchor="end">${pn === 0 ? 'D0 (RX)' : pn === 1 ? 'D1 (TX)' : pn >= 14 ? pinName(pn) : 'D' + pn}${PWM_PINS.has(pn) ? ' ~' : ''}</text><circle cx="${boardX + boardW}" cy="${pinY[pn]}" r="4" fill="var(--accent)"/>`; });
  const clash = used.length < devs.reduce((n, d) => n + d.pins.length, 0);
  $('#wiringBox').innerHTML = `<h3 class="sec">How Dowee is wired</h3>
    ${clash ? '<p class="msg err" style="border-radius:8px"><span class="tag">Check</span><span>Two devices share the same Arduino pin. Change one of them in Robot setup.</span></p>' : ''}
    <div class="tablewrap"><svg viewBox="0 0 ${devX + devW + 10} ${H}" role="img" aria-label="Wiring diagram">${wires}${board}${devSvg}</svg></div>
    <ul>
      <li>Pins marked <b>~</b> can do PWM (<code class="k">analogWrite</code>). ENA and ENB must be on PWM pins for speed control.</li>
      <li>Remove the ENA/ENB jumpers on the L298N so the Arduino controls speed.</li>
      <li>Connect <b>all GNDs together</b>: Arduino, motor driver, sensors and the battery.</li>
      <li>Motors get power from the battery (7–12 V) through the L298N, never from the Arduino 5 V pin.</li>
      ${rc ? '<li>HC-05: TXD → D0, RXD → D1 through a voltage divider (1 kΩ + 2 kΩ). Unplug it while uploading code.</li>' : ''}
      ${c.sonar ? '<li>HC-SR04: VCC → 5 V, GND → GND. It measures 2 cm to 400 cm.</li>' : ''}
    </ul>`;
}

/* ---------------- lessons ---------------- */
function buildLessons() {
  const acts = (typeof hostActivities === 'function' ? hostActivities().map(activityToLesson) : []).filter(l => allowed(l.arena));
  const lessons = LESSONS.filter(l => allowed(l.arena));
  const all = [...acts, ...lessons];
  const L = (S.lessonView && all.find(l => l.id === S.lessonView)) || (S.lesson && all.find(l => l.id === S.lesson)) || all[0];
  const isDone = l => (l.actId ? activityDone(l) : S.lessonDone[l.id]);
  const item = (l, i) => `<button data-id="${l.id}" aria-current="${l === L}" class="${isDone(l) ? 'done' : ''}"><span class="num">${isDone(l) ? '✓' : i + 1}</span><b>${esc(l.title)}</b><small>${esc(l.actId ? (ARENAS[l.arena] ? ARENAS[l.arena].name : '') : l.level)}</small></button>`;
  $('#lessonBox').innerHTML = `<div class="lesson-list">${acts.length ? `<p class="lbl" style="margin:0 0 2px">From your teacher</p>${acts.map(item).join('')}<p class="lbl" style="margin:10px 0 2px">All lessons</p>` : ''}${lessons.map(item).join('')}</div>
  <div class="lesson-body"><h3>${esc(L.title)}</h3><p>${L.intro}</p><ol>${L.steps.map(s => `<li>${s}</li>`).join('')}</ol>
  <div class="goal ${isDone(L) && S.lesson === L.id ? 'done' : ''}" id="goalBox"><span>Goal: ${esc(L.goal)}${isDone(L) ? ' — done!' : ''}</span><button class="btn primary" id="lessonStart">${S.lesson === L.id ? 'Restart lesson' : 'Start this lesson'}</button></div></div>`;
  $$('#lessonBox .lesson-list button').forEach(b => b.addEventListener('click', () => { S.lessonView = b.dataset.id; const l = all.find(x => x.id === b.dataset.id); showLesson(l); }));
  $('#lessonStart').addEventListener('click', () => startLesson(L));
}
function showLesson(L) { S.lessonView = L.id; buildLessons(); }
function startLesson(L) {
  if (!allowed(L.arena)) { toast(S.lockedArena ? 'Your teacher has locked the class to one activity' : `This class doesn't use ${ARENAS[L.arena].name}`); return; }
  S.lesson = L.id; S.lessonView = L.id;
  if (L.variant && ARENAS[L.arena].variants[L.variant]) { S.variant[L.arena] = L.variant; store.set('variant', S.variant); }
  if (L.realism) { S.realism = L.realism; store.set('realism', S.realism); $('#realSel').value = S.realism; }
  setArena(L.arena, true);
  S.robot = 'A'; updateRobotTabs();
  // classroom activities can bring their own starter program
  const st = L.starter, base = L.base || L;
  if (st && st.kind === 'none') { loadEditor(); }
  else if (st && st.kind === 'code' && st.code) { putCode(L.arena, 'A', st.code); loadEditor(); }
  else if (st && st.kind === 'blocks' && st.xml) { store.set(`mode:${L.arena}:A`, 'blocks'); store.set(`blocks:${L.arena}:A`, st.xml); loadEditor(); }
  else if (st && st.kind === 'example' && EXAMPLES[L.arena][st.example]) { putCode(L.arena, 'A', EXAMPLES[L.arena][st.example].code); loadEditor(); }
  else if (base.blocks) { store.set(`mode:${L.arena}:A`, 'blocks'); store.set(`blocks:${L.arena}:A`, null); loadEditor(); }
  else if (base.code || base.example) { putCode(L.arena, 'A', base.code || EXAMPLES[L.arena][base.example].code); loadEditor(); }
  else loadEditor();
  buildLessons(); showWork();
  toast(`Lesson: ${L.title}`);
}
function checkLesson() {
  const L = findLesson(S.lesson); if (!L || L.arena !== S.arena) return;
  let ok = false; try { ok = L.check(S.W); } catch (e) { ok = false; }
  if (ok && !S.lessonDoneNow) {
    S.lessonDoneNow = L.id; S.lessonDone[L.id] = true; store.set('lessonsDone', S.lessonDone);
    banner('Goal complete!', L.goal, 4000); addTip(`Lesson goal complete: ${L.goal}.`, 0, true);
    if (L.actId) hostLessonDone(L);
    buildLessons();
  }
  if (!ok && S.lessonDoneNow === L.id && S.W.time < 500) S.lessonDoneNow = null;
}

/* ---------------- dock tabs ---------------- */
$('#dockTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#dockTabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  $$('.dock-body .panel').forEach(p => (p.hidden = p.id !== 'p-' + b.dataset.p));
  store.set('dock', b.dataset.p);
  if (b.dataset.p === 'plot') drawPlot();
  if (b.dataset.p === 'tune') buildTune();
  if (b.dataset.p === 'lessons') buildLessons();
  if (b.dataset.p === 'class') renderClass(true);
  if (b.dataset.p === 'sensors') updateSensors();
});

/* ---------------- remote control ---------------- */
const KEYMAP_A = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', Space: 'stop' };
const KEYMAP_ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
function rcChar(set) {
  const u = set.has('up'), d = set.has('down'), l = set.has('left'), r = set.has('right');
  if (set.has('stop')) return 'S';
  if (u && l) return 'G'; if (u && r) return 'I'; if (d && l) return 'H'; if (d && r) return 'J';
  if (u) return 'F'; if (d) return 'B'; if (l) return 'L'; if (r) return 'R';
  return 'S';
}
function rcUpdate(team) {
  if (!S.W) return;
  const ch = rcChar(S.rcKeys[team]);
  if (ch === S.rcSent[team]) return;
  S.rcSent[team] = ch;
  const r = S.W.robots.find(x => x.team === team && !x.ai);
  if (r && S.running) { S.W.deliver(r.board, ch); serialPush(`<span class="sys">${team === 'B' ? 'B ' : ''}controller → '${ch}'</span>`); }
  if (team === 'A') $$('#rcpad [data-k]').forEach(b => b.classList.toggle('on', S.rcKeys.A.has(b.dataset.k)));
}
function isTyping(e) { const t = e.target; return t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' && t.type === 'text' || t.tagName === 'SELECT'); }
window.addEventListener('keydown', e => {
  if (isTyping(e) || !ARENAS[S.arena].rc || e.ctrlKey || e.metaKey) return;
  const p2 = S.variant[S.arena] === 'p2';
  let team = null, k = KEYMAP_A[e.code];
  if (k) team = 'A'; else if ((k = KEYMAP_ARROWS[e.code])) team = p2 ? 'B' : 'A';
  if (!team) return;
  e.preventDefault(); if (!S.rcKeys[team].has(k)) { S.rcKeys[team].add(k); rcUpdate(team); }
});
window.addEventListener('keyup', e => {
  const p2 = S.variant[S.arena] === 'p2';
  let team = null, k = KEYMAP_A[e.code];
  if (k) team = 'A'; else if ((k = KEYMAP_ARROWS[e.code])) team = p2 ? 'B' : 'A';
  if (!team) return;
  S.rcKeys[team].delete(k); rcUpdate(team);
});
window.addEventListener('blur', () => { for (const t of ['A', 'B']) { S.rcKeys[t].clear(); rcUpdate(t); } });
$$('#rcpad [data-k]').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); S.rcKeys.A.add(k); rcUpdate('A'); });
  const up = () => { S.rcKeys.A.delete(k); rcUpdate('A'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
});
$('#rcSpeed').addEventListener('input', e => { const v = +e.target.value; const ch = v >= 10 ? 'q' : String(v); const r = S.W && S.W.robots.find(x => x.team === 'A' && !x.ai); if (r && S.running) { S.W.deliver(r.board, ch); serialPush(`<span class="sys">controller → '${ch}' (speed)</span>`); } });
function pollGamepads() {
  if (!ARENAS[S.arena].rc || !navigator.getGamepads) return;
  let pads; try { pads = navigator.getGamepads(); } catch (e) { return; }
  [...pads].filter(Boolean).slice(0, 2).forEach((gp, i) => {
    const team = i === 0 ? 'A' : (S.variant[S.arena] === 'p2' ? 'B' : null); if (!team) return;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, bt = n => gp.buttons[n] && gp.buttons[n].pressed;
    const set = new Set();
    if (ay < -0.4 || bt(12) || bt(7)) set.add('up'); if (ay > 0.4 || bt(13) || bt(6)) set.add('down');
    if (ax < -0.4 || bt(14)) set.add('left'); if (ax > 0.4 || bt(15)) set.add('right');
    const key = [...set].sort().join();
    if (key !== S['gp' + i]) { S['gp' + i] = key; S.rcKeys[team] = set; rcUpdate(team); }
  });
}

/* ---------------- custom track drawing ---------------- */
function startDraw() {
  stop(); S.drawing = []; $('#drawbar').hidden = false; $('#drawInfo').textContent = 'Click on the floor to place points (at least 4)'; draw();
}
function endDraw(use) {
  if (use) {
    if (S.drawing.length < 4) { toast('Place at least 4 points'); return; }
    S.customTrack = S.drawing.map(p => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) })); store.set('customTrack', S.customTrack);
    S.variant.line = 'custom'; store.set('variant', S.variant); $('#variantSel').value = 'custom';
  } else if (S.variant.line === 'custom' && !(S.customTrack && S.customTrack.length >= 4)) { S.variant.line = 'oval'; $('#variantSel').value = 'oval'; }
  S.drawing = null; $('#drawbar').hidden = true; S.bestTrail = null; S.bestLap = Infinity; resetWorld();
}
$('#btnDraw').addEventListener('click', startDraw);
$('#drawUndo').addEventListener('click', () => { if (S.drawing) { S.drawing.pop(); draw(); } });
$('#drawCancel').addEventListener('click', () => endDraw(false));
$('#drawDone').addEventListener('click', () => endDraw(true));
cv.addEventListener('pointerdown', e => {
  if (!S.drawing) return;
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left - view.ox) / view.s, y = (view.oy - (e.clientY - r.top)) / view.s;
  const A = S.W.arena; if (x < 0.15 || y < 0.15 || x > A.w - 0.15 || y > A.h - 0.15) { toast('Keep the track at least 15 cm from the edge'); return; }
  S.drawing.push({ x, y }); $('#drawInfo').textContent = `${S.drawing.length} point${S.drawing.length > 1 ? 's' : ''} — the track closes into a loop`; draw();
});

/* ---------------- sound ---------------- */
let actx = null; const osc = {};
function tone(team, f, d) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    stopTone(team);
    if (!f) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'square'; o.frequency.value = clamp(f, 31, 8000); g.gain.value = 0.04;
    o.connect(g).connect(actx.destination); o.start(); osc[team] = o;
    if (d > 0) setTimeout(() => { if (osc[team] === o) stopTone(team); }, d / Math.max(0.25, S.speed));
  } catch (e) { /* audio unavailable */ }
}
function stopTone(team) { if (osc[team]) { try { osc[team].stop(); } catch (e) { /* already stopped */ } osc[team] = null; } }

/* ---------------- Blocks mode (Blockly) ----------------
   Younger students snap blocks together; the blocks write real Arduino code for Dowee,
   which is what actually runs (and what they can copy to a real robot).
   Blockly is loaded from the CDN only the first time someone opens Blocks. */
const BLK_URLS = ['https://cdn.jsdelivr.net/npm/blockly@10.4.3/blockly_compressed.js', 'https://cdn.jsdelivr.net/npm/blockly@10.4.3/blocks_compressed.js', 'https://cdn.jsdelivr.net/npm/blockly@10.4.3/msg/en.js'];
const modeKey = (a, r) => `mode:${a}:${r}`;
function modeOf(a, r) { return store.get(modeKey(a, r), 'code'); }
function setMode(a, r, m) { store.set(modeKey(a, r), m); }
const BK = { ws: null, loading: null, gen: null, suppress: false, arena: null, robot: null };

function loadBlockly() {
  if (window.Blockly && window.Blockly.Msg && window.Blockly.Msg.CONTROLS_IF_MSG_IF) return Promise.resolve();
  if (BK.loading) return BK.loading;
  const one = src => new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = () => bad(new Error('load')); document.head.appendChild(sc); });
  const local = BLK_URLS.map(u => '/vendor/blockly/' + u.split('blockly@10.4.3/')[1]);
  const chain = list => list.reduce((p, u) => p.then(() => one(u)), Promise.resolve());
  BK.loading = (/^https?:$/.test(location.protocol) ? chain(local).catch(() => chain(BLK_URLS)) : chain(BLK_URLS)).catch(e => { BK.loading = null; throw e; });
  return BK.loading;
}

const C = { start: '#e9467e', move: '#f39a3b', sense: '#4a9e3a', light: '#c9a21a', control: '#3f74c9', logic: '#5a86d6', math: '#8c5bc4', vars: '#0f8a87', text: '#86bf4f' };
const SENSOR_OPTS = [['1 (far left)', 'A0'], ['2 (left)', 'A1'], ['3 (middle)', 'A2'], ['4 (right)', 'A3'], ['5 (far right)', 'A4']];
function defineDoweeBlocks() {
  if (Blockly.Blocks.dowee_start) return;
  Blockly.defineBlocksWithJsonArray([
    { type: 'dowee_start', message0: 'when Dowee starts %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.start, tooltip: 'Runs once when the robot turns on (setup).', hat: 'cap' },
    { type: 'dowee_forever', message0: 'forever %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.start, tooltip: 'Repeats again and again (loop).' },
    { type: 'dowee_move', message0: 'drive %1 at speed %2', args0: [{ type: 'field_dropdown', name: 'DIR', options: [['forward', 'F'], ['backward', 'B'], ['turning left', 'TL'], ['turning right', 'TR'], ['spin left', 'SL'], ['spin right', 'SR']] }, { type: 'input_value', name: 'SPEED', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.move, tooltip: 'Speed goes from 0 to 255. Dowee needs about 60 to start moving.' },
    { type: 'dowee_motors', message0: 'set motors left %1 right %2', args0: [{ type: 'input_value', name: 'L', check: 'Number' }, { type: 'input_value', name: 'R', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.move, tooltip: '-255 (full backward) to 255 (full forward) for each wheel.' },
    { type: 'dowee_stop', message0: 'stop', previousStatement: null, nextStatement: null, colour: C.move },
    { type: 'dowee_wait', message0: 'wait %1 seconds', args0: [{ type: 'input_value', name: 'SEC', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.control, tooltip: 'Keep doing the same thing for a while.' },
    { type: 'dowee_led', message0: 'turn LED %1', args0: [{ type: 'field_dropdown', name: 'ON', options: [['on', 'HIGH'], ['off', 'LOW']] }], previousStatement: null, nextStatement: null, colour: C.light },
    { type: 'dowee_print', message0: 'show in Serial monitor %1', args0: [{ type: 'input_value', name: 'V' }], previousStatement: null, nextStatement: null, colour: C.light },
    { type: 'dowee_sensor', message0: 'line sensor %1', args0: [{ type: 'field_dropdown', name: 'PIN', options: SENSOR_OPTS }], output: 'Number', colour: C.sense, tooltip: 'Black ≈ 950, white ≈ 100.' },
    { type: 'dowee_black', message0: 'sensor %1 sees black', args0: [{ type: 'field_dropdown', name: 'PIN', options: SENSOR_OPTS }], output: 'Boolean', colour: C.sense },
    { type: 'dowee_distance', message0: 'distance in cm', output: 'Number', colour: C.sense, tooltip: 'From the ultrasonic sensor. 999 means nothing is in front.' },
    { type: 'dowee_bt_read', message0: 'read Bluetooth command', previousStatement: null, nextStatement: null, colour: C.sense, tooltip: 'Gets the newest letter from the remote control.' },
    { type: 'dowee_bt_is', message0: 'Bluetooth command is %1', args0: [{ type: 'field_dropdown', name: 'CMD', options: [['F forward', 'F'], ['B back', 'B'], ['L left', 'L'], ['R right', 'R'], ['S stop', 'S'], ['G forward-left', 'G'], ['I forward-right', 'I'], ['H back-left', 'H'], ['J back-right', 'J']] }], output: 'Boolean', colour: C.sense },
    { type: 'dowee_time', message0: 'seconds since start', output: 'Number', colour: C.sense },
  ]);
}

const O = { ATOMIC: 0, UNARY: 2, MULT: 5, ADD: 6, REL: 8, EQ: 9, AND: 13, OR: 14, COND: 15, NONE: 99 };
const C_RESERVED = new Set([...TYPE_WORDS, ...KEYWORDS, ...Object.keys(BUILTINS), ...Object.keys(CONSTS), 'drive', 'readDistanceCm', 'setup', 'loop', 'Serial', 'btCommand', 'ENA', 'ENB', 'IN1', 'IN2', 'IN3', 'IN4', 'TRIG', 'ECHO', 'i']);
function varName(ws, id) {
  const v = ws.getVariableById(id); let n = (v ? v.name : 'x').replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z_]/.test(n)) n = 'v_' + n;
  if (C_RESERVED.has(n)) n += '_';
  return n;
}
function makeGenerator() {
  const g = new (Blockly.CodeGenerator || Blockly.Generator)('Arduino');
  g.INDENT = '  ';
  g.scrub_ = (block, code, thisOnly) => { const next = block.nextConnection && block.nextConnection.targetBlock(); return code + (thisOnly ? '' : g.blockToCode(next)); };
  g.used = new Set(); g.loopN = 0;
  const v = (b, name, ord, def = '0') => g.valueToCode(b, name, ord) || def;
  const st = (b, name) => g.statementToCode(b, name);
  const F = g.forBlock;
  F.dowee_start = () => ''; F.dowee_forever = () => '';
  F.dowee_move = b => {
    const s = v(b, 'SPEED', O.UNARY, '150'), d = b.getFieldValue('DIR');
    const m = { F: [s, s], B: ['-' + s, '-' + s], TL: ['0', s], TR: [s, '0'], SL: ['-' + s, s], SR: [s, '-' + s] }[d];
    return `drive(${m[0]}, ${m[1]});\n`;
  };
  F.dowee_motors = b => `drive(${v(b, 'L', O.NONE)}, ${v(b, 'R', O.NONE)});\n`;
  F.dowee_stop = () => 'drive(0, 0);\n';
  F.dowee_wait = b => { const sec = v(b, 'SEC', O.MULT, '1'); return /^\d+(\.\d+)?$/.test(sec) ? `delay(${Math.round(parseFloat(sec) * 1000)});\n` : `delay(${sec} * 1000);\n`; };
  F.dowee_led = b => `digitalWrite(LED_BUILTIN, ${b.getFieldValue('ON')});\n`;
  F.dowee_print = b => `Serial.println(${v(b, 'V', O.NONE, '""')});\n`;
  F.dowee_sensor = b => [`analogRead(${b.getFieldValue('PIN')})`, O.ATOMIC];
  F.dowee_black = b => [`analogRead(${b.getFieldValue('PIN')}) > 500`, O.REL];
  F.dowee_distance = () => { g.used.add('distance'); return ['readDistanceCm()', O.ATOMIC]; };
  F.dowee_bt_read = () => { g.used.add('bt'); return 'if (Serial.available() > 0) {\n  btCommand = Serial.read();\n}\n'; };
  F.dowee_bt_is = b => { g.used.add('bt'); return [`btCommand == '${b.getFieldValue('CMD')}'`, O.EQ]; };
  F.dowee_time = () => ['millis() / 1000.0', O.MULT];
  F.controls_if = b => {
    let n = 0, code = '';
    while (b.getInput('IF' + n)) { code += (n ? ' else if (' : 'if (') + v(b, 'IF' + n, O.NONE, 'false') + ') {\n' + st(b, 'DO' + n) + '}'; n++; }
    if (b.getInput('ELSE')) code += ' else {\n' + st(b, 'ELSE') + '}';
    return code + '\n';
  };
  F.controls_repeat_ext = b => { const i = 'i' + (++g.loopN); return `for (int ${i} = 0; ${i} < ${v(b, 'TIMES', O.REL)}; ${i}++) {\n${st(b, 'DO')}}\n`; };
  F.controls_whileUntil = b => { const c = v(b, 'BOOL', O.NONE, 'false'); return b.getFieldValue('MODE') === 'UNTIL' ? `while (!(${c})) {\n${st(b, 'DO')}}\n` : `while (${c}) {\n${st(b, 'DO')}}\n`; };
  F.controls_flow_statements = b => (b.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n');
  F.logic_compare = b => { const op = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[b.getFieldValue('OP')]; const ord = op === '==' || op === '!=' ? O.EQ : O.REL; return [`${v(b, 'A', ord)} ${op} ${v(b, 'B', ord)}`, ord]; };
  F.logic_operation = b => { const and = b.getFieldValue('OP') === 'AND', ord = and ? O.AND : O.OR; return [`${v(b, 'A', ord, 'false')} ${and ? '&&' : '||'} ${v(b, 'B', ord, 'false')}`, ord]; };
  F.logic_negate = b => [`!${v(b, 'BOOL', O.UNARY, 'false')}`, O.UNARY];
  F.logic_boolean = b => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOMIC];
  F.math_number = b => { const n = Number(b.getFieldValue('NUM')); return [String(n), n < 0 ? O.UNARY : O.ATOMIC]; };
  F.math_arithmetic = b => {
    const op = b.getFieldValue('OP');
    if (op === 'POWER') return [`pow(${v(b, 'A', O.NONE)}, ${v(b, 'B', O.NONE)})`, O.ATOMIC];
    const [sym, ord] = { ADD: ['+', O.ADD], MINUS: ['-', O.ADD], MULTIPLY: ['*', O.MULT], DIVIDE: ['/', O.MULT] }[op];
    return [`${v(b, 'A', ord)} ${sym} ${v(b, 'B', ord + 0.5)}`, ord];
  };
  F.math_random_int = b => [`random(${v(b, 'FROM', O.NONE)}, ${v(b, 'TO', O.ADD)} + 1)`, O.ATOMIC];
  F.math_change = b => `${varName(b.workspace, b.getFieldValue('VAR'))} += ${v(b, 'DELTA', O.NONE, '1')};\n`;
  F.variables_get = b => [varName(b.workspace, b.getFieldValue('VAR')), O.ATOMIC];
  F.variables_set = b => `${varName(b.workspace, b.getFieldValue('VAR'))} = ${v(b, 'VALUE', O.NONE)};\n`;
  F.text = b => [JSON.stringify(b.getFieldValue('TEXT') || ''), O.ATOMIC];
  return g;
}
function blocksToArduino(ws) {
  const g = BK.gen; g.init(ws); g.used = new Set(); g.loopN = 0;
  const tops = ws.getTopBlocks(true);
  const body = type => tops.filter(b => b.type === type && b.isEnabled()).map(b => g.statementToCode(b, 'DO')).join('');
  const setupBody = body('dowee_start'), loopBody = body('dowee_forever');
  const vars = ws.getAllVariables().map(x => varName(ws, x.getId()));
  const dist = g.used.has('distance'), bt = g.used.has('bt');
  const lines = [
    '// Made with blocks in RoboBench. This is real Arduino code for Dowee:',
    '// copy it into the Arduino IDE to run it on the real robot.',
    MOTOR_SETUP,
    dist ? 'const int TRIG = 11;\nconst int ECHO = 12;' : '',
    bt ? "char btCommand = 'S';   // last letter from the Bluetooth remote" : '',
    vars.length ? vars.map(n => `float ${n} = 0;`).join('\n') : '',
    '',
    DRIVE_FN,
    dist ? `\nlong readDistanceCm() {\n  digitalWrite(TRIG, LOW);\n  delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long duration = pulseIn(ECHO, HIGH, 30000);\n  if (duration == 0) return 999;\n  return duration * 0.034 / 2;\n}` : '',
    '',
    'void setup() {',
    PINMODES,
    '  pinMode(LED_BUILTIN, OUTPUT);',
    dist ? '  pinMode(TRIG, OUTPUT);\n  pinMode(ECHO, INPUT);' : '',
    '  Serial.begin(9600);',
    setupBody.replace(/\s+$/, ''),
    '}',
    '',
    'void loop() {',
    loopBody.replace(/\s+$/, ''),
    '}',
    '',
  ];
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n').replace(/\n{3,}/g, '\n\n');
}

const TOOLBOX = () => {
  const num = n => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
  return { kind: 'categoryToolbox', contents: [
    { kind: 'category', name: 'Start', colour: C.start, contents: [{ kind: 'block', type: 'dowee_start' }, { kind: 'block', type: 'dowee_forever' }] },
    { kind: 'category', name: 'Move', colour: C.move, contents: [
      { kind: 'block', type: 'dowee_move', inputs: { SPEED: num(150) } }, { kind: 'block', type: 'dowee_stop' },
      { kind: 'block', type: 'dowee_motors', inputs: { L: num(150), R: num(150) } }, { kind: 'block', type: 'dowee_wait', inputs: { SEC: num(1) } }] },
    { kind: 'category', name: 'Sensors', colour: C.sense, contents: [
      { kind: 'block', type: 'dowee_black', fields: { PIN: 'A2' } }, { kind: 'block', type: 'dowee_sensor', fields: { PIN: 'A2' } }, { kind: 'block', type: 'dowee_distance' },
      { kind: 'block', type: 'dowee_bt_read' }, { kind: 'block', type: 'dowee_bt_is' }, { kind: 'block', type: 'dowee_time' }] },
    { kind: 'category', name: 'Light & messages', colour: C.light, contents: [
      { kind: 'block', type: 'dowee_led' }, { kind: 'block', type: 'dowee_print', inputs: { V: { shadow: { type: 'text', fields: { TEXT: 'Hello!' } } } } }, { kind: 'block', type: 'text' }] },
    { kind: 'category', name: 'Control', colour: C.control, contents: [
      { kind: 'block', type: 'controls_if' }, { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
      { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: num(4) } }, { kind: 'block', type: 'controls_whileUntil' },
      { kind: 'block', type: 'dowee_wait', inputs: { SEC: num(1) } }, { kind: 'block', type: 'controls_flow_statements' }] },
    { kind: 'category', name: 'Logic', colour: C.logic, contents: [
      { kind: 'block', type: 'logic_compare', inputs: { A: num(0), B: num(30) }, fields: { OP: 'LT' } }, { kind: 'block', type: 'logic_operation' }, { kind: 'block', type: 'logic_negate' }, { kind: 'block', type: 'logic_boolean' }] },
    { kind: 'category', name: 'Math', colour: C.math, contents: [
      { kind: 'block', type: 'math_number' }, { kind: 'block', type: 'math_arithmetic', inputs: { A: num(1), B: num(1) } }, { kind: 'block', type: 'math_random_int', inputs: { FROM: num(1), TO: num(10) } }] },
    { kind: 'category', name: 'Variables', colour: C.vars, custom: 'VARIABLE' },
  ] };
};

/* starter programs (Blockly XML) */
const X = {
  num: n => `<shadow type="math_number"><field name="NUM">${n}</field></shadow>`,
  move: (d, s, next = '') => `<block type="dowee_move"><field name="DIR">${d}</field><value name="SPEED">${X.num(s)}</value>${next ? `<next>${next}</next>` : ''}</block>`,
  wait: (s, next = '') => `<block type="dowee_wait"><value name="SEC">${X.num(s)}</value>${next ? `<next>${next}</next>` : ''}</block>`,
  stop: (next = '') => `<block type="dowee_stop">${next ? `<next>${next}</next>` : ''}</block>`,
  led: (on, next = '') => `<block type="dowee_led"><field name="ON">${on}</field>${next ? `<next>${next}</next>` : ''}</block>`,
  black: pin => `<block type="dowee_black"><field name="PIN">${pin}</field></block>`,
  not: inner => `<block type="logic_negate"><value name="BOOL">${inner}</value></block>`,
  or: (a, b) => `<block type="logic_operation"><field name="OP">OR</field><value name="A">${a}</value><value name="B">${b}</value></block>`,
  lt: (a, n) => `<block type="logic_compare"><field name="OP">LT</field><value name="A">${a}</value><value name="B">${X.num(n)}</value></block>`,
  bt: c => `<block type="dowee_bt_is"><field name="CMD">${c}</field></block>`,
  ifs: (pairs, els) => `<block type="controls_if"><mutation elseif="${pairs.length - 1}"${els ? ' else="1"' : ''}></mutation>${pairs.map(([c, d], i) => `<value name="IF${i}">${c}</value><statement name="DO${i}">${d}</statement>`).join('')}${els ? `<statement name="ELSE">${els}</statement>` : ''}</block>`,
  prog: (start, forever) => `<xml xmlns="https://developers.google.com/blockly/xml"><block type="dowee_start" x="20" y="20">${start ? `<statement name="DO">${start}</statement>` : ''}</block><block type="dowee_forever" x="20" y="${start ? 200 : 110}">${forever ? `<statement name="DO">${forever}</statement>` : ''}</block></xml>`,
};
const RC_BLOCKS = () => X.prog('', `<block type="dowee_bt_read"><next>${X.ifs([[X.bt('F'), X.move('F', 220)], [X.bt('B'), X.move('B', 220)], [X.bt('L'), X.move('SL', 130)], [X.bt('R'), X.move('SR', 130)], [X.bt('G'), X.move('TL', 220)], [X.bt('I'), X.move('TR', 220)], [X.bt('S'), X.stop()]])}</next></block>`);
const BLOCK_STARTERS = {
  lab: { name: 'Drive 1 metre and stop', xml: () => X.prog(X.led('HIGH', X.move('F', 180, X.wait(1.5, X.stop(X.led('LOW'))))), '') },
  line: { name: 'Follow the line with 2 sensors', xml: () => X.prog('', X.ifs([[X.black('A1'), X.move('TL', 150)], [X.black('A3'), X.move('TR', 150)]], X.move('F', 150))) },
  race: { name: 'Bluetooth remote control', xml: RC_BLOCKS },
  soccer: { name: 'Bluetooth remote control', xml: RC_BLOCKS },
  sumo: { name: 'Sumo: stay in, find, push', xml: () => X.prog(X.wait(5), X.ifs([[X.or(X.not(X.black('A0')), X.not(X.black('A4'))), X.move('B', 220, X.wait(0.3, X.move('SR', 200, X.wait(0.25))))], [X.lt('<block type="dowee_distance"></block>', 60), X.move('F', 255)]], X.move('SL', 130))) },
  maze: { name: 'Avoid obstacles', xml: () => X.prog('', X.ifs([[X.lt('<block type="dowee_distance"></block>', 25), X.move('B', 160, X.wait(0.2, X.move('SL', 170, X.wait(0.4))))]], X.move('F', 200))) },
};
const blkKey = (a, r) => `blocks:${a}:${r}`, blkCodeKey = (a, r) => `blockcode:${a}:${r}`;

async function showBlocks() {
  $('#editor').hidden = true; $('#blkWrap').hidden = false; $('#btnToCode').hidden = false;
  const msg = $('#blkMsg');
  try { msg.hidden = false; msg.textContent = 'Loading blocks…'; await loadBlockly(); msg.hidden = true; }
  catch (e) { msg.hidden = false; msg.textContent = 'The blocks could not load. Check the internet connection, or switch back to Code.'; return; }
  defineDoweeBlocks();
  if (!BK.gen) BK.gen = makeGenerator();
  if (!BK.ws) {
    const theme = Blockly.Theme.defineTheme('dowee', {
      base: Blockly.Themes.Classic,
      blockStyles: { logic_blocks: { colourPrimary: C.logic }, loop_blocks: { colourPrimary: C.control }, math_blocks: { colourPrimary: C.math }, variable_blocks: { colourPrimary: C.vars }, text_blocks: { colourPrimary: C.text } },
      componentStyles: { workspaceBackgroundColour: '#fffdf8', toolboxBackgroundColour: '#eef8f6', toolboxForegroundColour: '#2e2a4f', flyoutBackgroundColour: '#e2f3f0', flyoutOpacity: 0.96, scrollbarColour: '#c9d9d5', insertionMarkerColour: '#2e2a4f' },
      fontStyle: { family: 'Nunito, system-ui, sans-serif', weight: '800', size: 12 },
      startHats: true,
    });
    BK.ws = Blockly.inject($('#blocklyDiv'), { toolbox: TOOLBOX(), theme, sounds: false, trashcan: false, renderer: 'zelos', zoom: { controls: false, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.4 }, grid: { spacing: 24, length: 2, colour: '#e6efe9', snap: true }, move: { scrollbars: true, drag: true, wheel: false } });
    BK.ws.addChangeListener(e => { if (BK.suppress || e.isUiEvent) return; saveBlocks(); });
    new ResizeObserver(() => { if (BK.ws && !$('#blkWrap').hidden) Blockly.svgResize(BK.ws); }).observe($('#blocklyDiv'));
  }
  loadWorkspace(S.arena, S.robot);
  Blockly.svgResize(BK.ws);
}
function loadWorkspace(a, r) {
  BK.suppress = true;
  BK.ws.clear();
  const saved = store.get(blkKey(a, r), null);
  const xml = saved || (BLOCK_STARTERS[a] || BLOCK_STARTERS.lab).xml();
  try { Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), BK.ws); } catch (e) { Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(BLOCK_STARTERS.lab.xml()), BK.ws); }
  BK.arena = a; BK.robot = r; BK.suppress = false;
  saveBlocks();
  BK.ws.scrollCenter();
}
function saveBlocks() {
  if (!BK.ws || BK.arena !== S.arena || BK.robot !== S.robot) return;
  const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(BK.ws));
  const code = blocksToArduino(BK.ws);
  store.set(blkKey(BK.arena, BK.robot), xml); store.set(blkCodeKey(BK.arena, BK.robot), code);
  $('#blkCode').textContent = code;
  if (S.tuneFromBlocks) buildTune();
}
function blocksCode(a, r) { return store.get(blkCodeKey(a, r), null); }
function showCode() { $('#editor').hidden = false; $('#blkWrap').hidden = true; $('#btnToCode').hidden = true; renderEditor(); }
function applyMode() {
  const m = modeOf(S.arena, S.robot);
  $$('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
  if (m === 'blocks') showBlocks(); else showCode();
}
$('#modeSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (modeOf(S.arena, S.robot) === 'code') setCode(S.arena, S.robot, ta.value);
  setMode(S.arena, S.robot, b.dataset.m);
  fillExamples(); applyMode();
});
$('#btnToCode').addEventListener('click', () => {
  if (!BK.ws) return;
  const code = blocksToArduino(BK.ws);
  setMode(S.arena, S.robot, 'code');
  setCode(S.arena, S.robot, code);
  fillExamples(); applyMode(); loadEditor();
  toast('Your blocks are now Arduino code. Your blocks are saved: switch back to Blocks any time.');
});
function loadBlockStarter(a) {
  if (!BK.ws) return;
  BK.suppress = true; BK.ws.clear();
  Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(BLOCK_STARTERS[a].xml()), BK.ws);
  BK.suppress = false; saveBlocks(); BK.ws.scrollCenter();
  toast('Starter blocks loaded');
}

/* ---------------- class: teams, submissions, leaderboards, battles ----------------
   Shared data (db capability):
     teams/<viewer id>   one doc per student/team: { team, members, entries: { <arena>: { code, at, best } } }
     class/settings      teacher only: { challenge }
     class/matches       teacher only: { list: [ { arena, aId, bId, a, b, winner, text, at } ] }
   Battles run on each computer from the saved programs. The simulator is deterministic,
   so the same two programs always give the same result. */
const CL = { db: null, user: null, uid: null, teacher: false, canWrite: null, teams: new Map(), settings: {}, matches: [], status: 'loading', err: '', saving: false, names: {}, readOnly: false };
S.best = store.get('best', {});
function noteBest(arena, key, val) {
  S.best[arena] = S.best[arena] || {};
  const cur = S.best[arena][key];
  if (cur === undefined || val < cur) { S.best[arena][key] = +val.toFixed(2); store.set('best', S.best); hostBest(arena, key, +val.toFixed(2)); }
}
const BEST_LABEL = {
  line: k => (LINE_TRACKS[k] ? LINE_TRACKS[k].name.replace(/ \(.*\)/, '') : 'My track') + ' lap',
  maze: k => (ARENAS.maze.variants[k] || k) + ' finish',
  race: () => 'Race lap',
};
function classOnEvent(e) {
  const W = S.W, a = S.arena, v = S.variant[a];
  if (e.type === 'lap' && a === 'line') noteBest('line', v, e.lap.time);
  if (e.type === 'lap' && a === 'race' && (!e.robot || e.robot === 'Dowee A')) noteBest('race', 'lap', e.lap.time);
  if (e.type === 'over' && a === 'maze' && typeof W.state.done === 'number') noteBest('maze', v, W.state.done);
  if (e.type === 'over' && S.classMatch && S.classMatch.arena === a) saveMatch(e);
}
async function saveMatch(e) {
  const m = S.classMatch; S.classMatch = null;
  if (m.host) { hostSaveMatch(m, e); return; }
  if (!CL.db || !CL.teacher) { renderClass(); return; }
  const list = [{ arena: m.arena, aId: m.aId, bId: m.bId, a: m.a, b: m.b, winner: e.winner || null, text: e.text, at: Date.now() }, ...CL.matches].slice(0, 120);
  try { await CL.db.doc('class/matches').set({ list }); toast('Match result saved for the class'); } catch (err) { toast('Could not save the result: ' + (err.code || 'error')); }
}

async function initClass() {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') { CL.status = 'offline'; renderClass(); return; }
  let db = null, user = null;
  try { [db, user] = await Promise.all([c.use('db'), c.use('user')]); } catch (e) { db = null; }
  if (!db) { CL.status = 'offline'; renderClass(); return; }
  CL.db = db; CL.user = user;
  if (user) { CL.uid = await user.id(); CL.teacher = await user.canEdit(); CL.canWrite = await user.can('data.write'); }
  if (CL.canWrite === false) CL.readOnly = true;
  renderClass();
  const timer = setTimeout(() => { if (CL.status === 'loading') { CL.status = 'slow'; renderClass(); } }, 10000);
  db.collection('teams').onSnapshot(snap => {
    if (!snap.metadata.fromCache) clearTimeout(timer);
    CL.teams = new Map(snap.docs.map(d => [d.id, d.data()]));
    CL.status = 'ready'; renderClass();
  }, err => { clearTimeout(timer); CL.status = 'error'; CL.err = err.code; renderClass(); });
  db.doc('class/settings').onSnapshot(d => { CL.settings = d.exists ? d.data() : {}; renderClass(); }, () => {});
  db.doc('class/matches').onSnapshot(d => { CL.matches = d.exists && Array.isArray(d.data().list) ? d.data().list : []; renderClass(); }, () => {});
}

function classVisible() { return !$('#p-class').hidden; }
function renderClass(force) {
  const box = $('#classBox'); if (!box) return;
  if (HOST.on) { if (!force && (!classVisible() || box.contains(document.activeElement) && document.activeElement.matches('input, textarea, select'))) return; renderHostClass(); return; }
  if (!force && (!classVisible() || box.contains(document.activeElement) && document.activeElement.matches('input, textarea, select'))) { CL.dirty = true; return; }
  CL.dirty = false;
  const a = S.arena, aName = ARENAS[a].name;
  if (CL.status === 'offline') {
    box.innerHTML = `<h3 class="sec">Class</h3><p class="empty">Class features work when this page is opened on claude.ai and shared with your class.<br>Teacher: open the page's Share menu and give students <b>Contributor</b> access. Then each team can join, submit Dowee programs, see the leaderboards and battle each other.</p>`;
    return;
  }
  const me = CL.uid ? CL.teams.get(CL.uid) : null;
  const teams = [...CL.teams.entries()].filter(([, t]) => t && t.team);
  const challenge = CL.settings.challenge ? `<div class="challenge"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><polygon points="11,1 21,8 17,21 5,21 1,8" fill="#e9467e"/><polygon points="11,1 21,8 11,11" fill="#f39a3b"/><polygon points="1,8 11,11 5,21" fill="#8c5bc4"/></svg><div><b>Today's challenge</b><div>${esc(CL.settings.challenge)}</div></div></div>` : '';
  const status = CL.status === 'loading' ? '<p class="note">Loading the class…</p>' : CL.status === 'slow' ? '<p class="note">The class list can\'t be reached yet. It will appear when the connection comes back.</p>' : CL.status === 'error' ? `<p class="note">The class list stopped updating (${esc(CL.err)}). Reload the page to try again.</p>` : '';

  // my team
  let mine;
  if (!CL.uid) mine = `<p class="note">Sign in to claude.ai to join the class.</p>`;
  else if (CL.readOnly) mine = `<p class="note">You can watch the class, but you can't submit. Ask your teacher for <b>Contributor</b> access.</p>${me ? `<p><b>${esc(me.team)}</b></p>` : ''}`;
  else if (!me || CL.editTeam) mine = `<form id="teamForm"><label class="fld">Team name<input id="teamName" maxlength="40" required value="${esc(me ? me.team : '')}" placeholder="e.g. The Line Hunters"></label><label class="fld">Members<input id="teamMembers" maxlength="120" value="${esc(me ? me.members || '' : '')}" placeholder="First names"></label><div class="row"><button class="btn primary" type="submit">${me ? 'Save' : 'Join the class'}</button>${me ? '<button class="btn" type="button" id="teamCancel">Cancel</button>' : ''}</div></form>`;
  else {
    const subs = Object.entries(me.entries || {}).map(([k, e]) => `<span class="chip ${k === a ? 'p' : ''}">${esc(ARENAS[k] ? ARENAS[k].name : k)} · ${new Date(e.at).toLocaleDateString()}</span>`).join('') || '<span class="note">Nothing submitted yet.</span>';
    const best = S.best[a] ? Object.entries(S.best[a]).map(([k, v]) => `${(BEST_LABEL[a] || (() => k))(k)}: ${v.toFixed(2)} s`).join(' · ') : '';
    mine = `<div class="row" style="justify-content:space-between"><div><b style="font-family:var(--font-display);font-size:18px">${esc(me.team)}</b><div class="note">${esc(me.members || '')}</div></div><button class="btn small" id="teamEdit">Edit</button></div>
      <div class="chips" style="margin:8px 0">${subs}</div>
      <button class="btn primary" id="submitBtn" ${CL.saving ? 'disabled' : ''}>Submit my ${esc(aName)} program</button>
      <p class="note">Sends the code in the editor${best ? ` and your best times here (${esc(best)})` : ''}. Submit again any time to update it.</p>`;
  }

  // leaderboard for this arena
  const rows = [];
  for (const [id, t] of teams) {
    const e = t.entries && t.entries[a]; if (!e || !e.best) continue;
    for (const [k, v] of Object.entries(e.best)) if (typeof v === 'number') rows.push({ id, team: t.team, key: k, v });
  }
  let board;
  if (a === 'sumo' || a === 'soccer') {
    const wins = {};
    for (const m of CL.matches) if (m.arena === a && m.winner) { const id = m.winner === 'A' ? m.aId : m.bId, nm = m.winner === 'A' ? m.a : m.b; wins[id] = wins[id] || { team: nm, w: 0 }; wins[id].w++; }
    const list = Object.values(wins).sort((x, y) => y.w - x.w).slice(0, 10);
    board = list.length ? list.map((r, i) => `<div class="board-row"><span class="rank">${i + 1}</span><span>${esc(r.team)}</span><span class="t">${r.w} win${r.w > 1 ? 's' : ''}</span></div>`).join('') : '<p class="note">Wins from class battles the teacher runs will appear here.</p>';
  } else {
    const keys = [...new Set(rows.map(r => r.key))];
    const curKey = a === 'race' ? 'lap' : S.variant[a];
    const key = keys.includes(curKey) ? curKey : keys[0];
    const list = rows.filter(r => r.key === key).sort((x, y) => x.v - y.v).slice(0, 10);
    board = key ? `<p class="note" style="margin:0 0 4px">${esc((BEST_LABEL[a] || (k => k))(key))}</p>` + list.map((r, i) => `<div class="board-row"><span class="rank">${i + 1}</span><span>${esc(r.team)}</span><span class="t">${r.v.toFixed(2)} s</span></div>`).join('') : `<p class="note">${a === 'lab' ? 'The test lab has no leaderboard. Use it to calibrate.' : 'No times yet. Finish a run, then press Submit.'}</p>`;
  }

  // battles
  const withCode = teams.filter(([, t]) => t.entries && t.entries[a] && t.entries[a].code);
  const canBattle = a === 'sumo' || a === 'soccer';
  const opts = withCode.map(([id, t]) => `<option value="${esc(id)}">${esc(t.team)}</option>`).join('');
  const battle = canBattle
    ? (withCode.length >= 2 ? `<label class="fld">Dowee A (yellow)<select id="batA">${opts}</select></label><label class="fld">Dowee B (purple)<select id="batB">${opts}</select></label><button class="btn primary" id="batGo">Start the battle</button>
        <p class="note">${CL.teacher ? 'You are the teacher, so results are saved to the class leaderboard.' : 'You can watch any battle. Only battles the teacher runs count on the leaderboard.'}</p>`
      : `<p class="note">At least two teams need to submit a ${esc(aName)} program first.</p>`)
    : `<p class="note">Battles are for Sumo and Robot soccer. Switch to one of those arenas.</p>`;
  const recent = CL.matches.filter(m => m.arena === a).slice(0, 6).map(m => `<div class="board-row" style="grid-template-columns:1fr"><span><b>${esc(m.a)}</b> vs <b>${esc(m.b)}</b> — ${esc(m.text)}</span></div>`).join('');

  // class programs
  const progs = teams.map(([id, t]) => {
    const e = t.entries && t.entries[a];
    return `<div class="board-row" style="grid-template-columns:1fr auto"><span><b>${esc(t.team)}</b> <span class="note" data-uid="${esc(id)}"></span><br><span class="note">${e ? 'Submitted ' + new Date(e.at).toLocaleString() : 'No ' + esc(aName) + ' program'}</span></span><span class="row">${e ? `<button class="btn small" data-open="${esc(id)}" data-r="A">Open in A</button>${canBattle ? `<button class="btn small" data-open="${esc(id)}" data-r="B">Open in B</button>` : ''}` : ''}${CL.teacher && id !== CL.uid ? `<button class="btn small" data-del="${esc(id)}">Remove</button>` : ''}</span></div>`;
  }).join('') || '<p class="note">No teams have joined yet.</p>';

  const teacher = CL.teacher ? `<div class="card"><h4><span>Teacher</span><span>only you see this</span></h4>
      <form id="chForm"><label class="fld">Today's challenge (everyone sees it)<textarea id="chText" rows="2" maxlength="300" placeholder="e.g. Lap the Snake track in under 14 s">${esc(CL.settings.challenge || '')}</textarea></label><button class="btn" type="submit">Post challenge</button></form>
      <p class="note">Share this page with students as <b>Contributor</b> so they can join and submit. Viewers can watch but not submit.</p></div>` : '';

  box.innerHTML = `${challenge}${status}
    ${S.backupFor ? `<p class="note">You opened another team's program. <button class="btn small" id="restoreMine">Restore my own code</button></p>` : ''}
    <div class="class-grid" style="margin-top:10px">
      <div class="card"><h4><span>My team</span><span>${esc(aName)}</span></h4>${mine}</div>
      <div class="card"><h4><span>Leaderboard</span><span>${esc(aName)}</span></h4>${board}</div>
      <div class="card"><h4><span>Class battle</span><span>${esc(aName)}</span></h4>${battle}${recent ? '<div style="margin-top:8px">' + recent + '</div>' : ''}</div>
      <div class="card"><h4><span>Class programs</span><span>${teams.length} team${teams.length === 1 ? '' : 's'}</span></h4>${progs}</div>
      ${teacher}
    </div>`;
  wireClass();
  resolveNames(teams.map(([id]) => id));
}
async function resolveNames(ids) {
  if (!CL.user || !ids.length) return;
  const ps = await CL.user.profiles(ids);
  $$('#classBox [data-uid]').forEach(el => { const p = ps[el.dataset.uid]; el.textContent = p && p.name ? '· ' + p.name : ''; });
}
function wireClass() {
  const tf = $('#teamForm');
  if (tf) tf.addEventListener('submit', async e => {
    e.preventDefault();
    const team = $('#teamName').value.trim().slice(0, 40), members = $('#teamMembers').value.trim().slice(0, 120);
    if (!team) return;
    const cur = CL.teams.get(CL.uid) || {};
    await writeMine({ ...cur, team, members, entries: cur.entries || {} });
    CL.editTeam = false; renderClass(true);
  });
  const tc = $('#teamCancel'); if (tc) tc.addEventListener('click', () => { CL.editTeam = false; renderClass(true); });
  const te = $('#teamEdit'); if (te) te.addEventListener('click', () => { CL.editTeam = true; renderClass(true); });
  const sb = $('#submitBtn'); if (sb) sb.addEventListener('click', submitProgram);
  const bg = $('#batGo'); if (bg) {
    const sa = $('#batA'), sbb = $('#batB'); if (sbb.options.length > 1) sbb.selectedIndex = 1;
    bg.addEventListener('click', () => { if (sa.value === sbb.value) { toast('Pick two different teams'); return; } startBattle(sa.value, sbb.value); });
  }
  $$('#classBox [data-open]').forEach(b => b.addEventListener('click', () => openTeamCode(b.dataset.open, b.dataset.r)));
  $$('#classBox [data-del]').forEach(b => b.addEventListener('click', async () => {
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Click again to remove'; return; }
    try { await CL.db.doc('teams/' + b.dataset.del).delete(); toast('Team removed'); } catch (err) { toast('Could not remove: ' + (err.code || 'error')); }
  }));
  const ch = $('#chForm'); if (ch) ch.addEventListener('submit', async e => {
    e.preventDefault();
    try { await CL.db.doc('class/settings').set({ challenge: $('#chText').value.trim().slice(0, 300) }); toast('Challenge posted'); } catch (err) { toast('Could not post: ' + (err.code || 'error')); }
  });
  const rm = $('#restoreMine'); if (rm) rm.addEventListener('click', restoreMine);
}
async function writeMine(doc) {
  if (CL.saving) return false;
  CL.saving = true;
  try { await CL.db.doc('teams/' + CL.uid).set(doc); return true; }
  catch (err) {
    if (err.code === 'invalid_argument') { CL.readOnly = true; toast('You can\'t save to this class. Ask your teacher for Contributor access.'); }
    else if (err.code === 'quota_exceeded') toast('The class storage is full. Ask your teacher to remove old teams.');
    else toast('Could not save: ' + (err.code || 'error'));
    return false;
  } finally { CL.saving = false; renderClass(true); }
}
async function submitProgram() {
  const me = CL.teams.get(CL.uid); if (!me) return;
  if (modeOf(S.arena, S.robot) === 'code') setCode(S.arena, S.robot, ta.value);
  const code = getCode(S.arena, 'A');
  if (code.length > 30000) { toast('This program is too long to submit'); return; }
  const prev = (me.entries && me.entries[S.arena]) || {};
  const best = { ...(prev.best || {}) };
  for (const [k, v] of Object.entries(S.best[S.arena] || {})) if (best[k] === undefined || v < best[k]) best[k] = v;
  const ok = await writeMine({ ...me, entries: { ...(me.entries || {}), [S.arena]: { code, at: Date.now(), best } } });
  if (ok) toast(`Submitted your ${ARENAS[S.arena].name} program`);
}
function backupMine() {
  if (S.backupFor === S.arena) return;
  store.set('backup:' + S.arena, { A: store.get(codeKey(S.arena, 'A'), null) ?? defaultCode(S.arena, 'A'), B: store.get(codeKey(S.arena, 'B'), null) ?? defaultCode(S.arena, 'B'), mA: modeOf(S.arena, 'A'), mB: modeOf(S.arena, 'B') });
  S.backupFor = S.arena;
}
function restoreMine() {
  const b = store.get('backup:' + S.arena, null);
  if (b) { setCode(S.arena, 'A', b.A); setCode(S.arena, 'B', b.B); setMode(S.arena, 'A', b.mA || 'code'); setMode(S.arena, 'B', b.mB || 'code'); }
  S.backupFor = null; S.classMatch = null; loadEditor(); renderClass(true); toast('Your own code is back');
}
function openTeamCode(id, robot) {
  const t = CL.teams.get(id), e = t && t.entries && t.entries[S.arena]; if (!e) return;
  backupMine();
  putCode(S.arena, robot, e.code);
  if (robot === 'B') { S.variant[S.arena] = 'code'; store.set('variant', S.variant); $('#variantSel').value = 'code'; resetWorld(); }
  S.robot = robot; updateRobotTabs(); loadEditor(); renderClass(true);
  toast(`Opened ${t.team}'s program in Dowee ${robot}`);
}
function startBattle(aId, bId) {
  const ta2 = CL.teams.get(aId), tb = CL.teams.get(bId), a = S.arena;
  backupMine();
  putCode(a, 'A', ta2.entries[a].code); putCode(a, 'B', tb.entries[a].code);
  S.variant[a] = 'code'; store.set('variant', S.variant);
  setArena(a, false);
  S.classMatch = { arena: a, aId, bId, a: ta2.team, b: tb.team };
  renderClass(true);
  run();
  banner(`${ta2.team} vs ${tb.team}`, 'Class battle', 2500);
}

/*@HOST@*/
/* ---------------- boot ---------------- */
const dock = store.get('dock', 'serial');
const startTab = $(`#dockTabs [data-p="${dock}"]`) || $('#dockTabs button');
setArena(S.arena);
startTab.click();
serialSys('Welcome! Pick an arena above, then press "Upload & run". Your code is saved in this browser.');
buildLessons();
window.__clReady = true;
window.__blkReady = true; fillExamples(); applyMode();
if (store.get('view', 'meet') === 'meet') showMeet(); else showWork();
initHost().then(on => { if (!on) initClass(); else { buildLessons(); renderClass(); } });
requestAnimationFrame(t => { S.last = t; requestAnimationFrame(frame); });
})();
