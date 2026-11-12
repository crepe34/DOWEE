#!/usr/bin/env node
// Regression checks: every example must still do its job on the Ideal robot (the default) and in the
// Realistic world, and the Ideal robot must give the same result every run. Exits 1 on any failure.
// Run after `npm run build` (it uses dist/core-all.js).
'use strict';
const M = require('../dist/core-all.js');
const { EXAMPLES } = M;
let failed = 0;
function run(arena, variant, code, ms, opts = {}) {
  const W = M.buildWorld(arena, variant, { realism: opts.lv || 'ideal', unitA: opts.unit || 1, runSeed: opts.seed || 7 }, M.makeCfg('dowee'), M.makeCfg('dowee'), opts.opp || 'none');
  const r = W.robots[0];
  r.board.onError = e => { throw new Error(`program crashed: ${e.message} (line ${e.line})`); };
  r.board.load(M.compileArduino(code, r.board), 0);
  for (let i = 0; i < ms; i++) { W.step(); if (opts.onStep) opts.onStep(W, i); if (opts.until && opts.until(W)) break; }
  return { W, r };
}
function check(name, fn) {
  try { const msg = fn(); console.log(`  ok    ${name}${msg ? ' — ' + msg : ''}`); }
  catch (e) { failed++; console.log(`  FAIL  ${name} — ${e.message}`); }
}
const want = (cond, msg) => { if (!cond) throw new Error(msg); };
const dist = r => Math.hypot(r.x - r.start.x, r.y - r.start.y);

for (const lv of ['ideal', 'real']) {
  console.log(`\n${lv === 'ideal' ? 'Ideal robot (default)' : 'Realistic world'}`);
  for (const track of ['oval', 'snake', 'figure8']) check(`PID line follower laps ${track}`, () => {
    const { W } = run('line', track, EXAMPLES.line.pid.code, 45000, { lv });
    want(W.state.laps.length >= 2, `only ${W.state.laps.length} laps in 45 s`);
    return W.state.laps.map(l => l.time.toFixed(1) + ' s').join(', ');
  });
  check('2-sensor follower laps the oval', () => {
    const { W } = run('line', 'oval', EXAMPLES.line.bang.code, 60000, { lv });
    want(W.state.laps.length >= 1, 'no lap in 60 s');
    return W.state.laps[0].time.toFixed(1) + ' s';
  });
  for (const opp of ['statue', 'hunter']) check(`sumo example beats ${opp}`, () => {
    const { W } = run('sumo', opp, EXAMPLES.sumo.basic.code, 60000, { lv, opp, until: W => W.state.over });
    want(W.state.result === 'A', `result: ${W.state.result || 'no winner in 60 s'}`);
    return `won after ${(W.time / 1000).toFixed(1)} s`;
  });
  check('lab: drive example moves straight and stops', () => {
    const { r } = run('lab', 'lab', EXAMPLES.lab.meter.code, 4000, { lv });
    want(dist(r) > 0.5 && dist(r) < 1.2, `drove ${(dist(r) * 100).toFixed(0)} cm`);
    want(Math.hypot(r.vx, r.vy) < 0.01, 'still moving');
    const drift = Math.abs(r.headingAcc * 180 / Math.PI);
    if (lv === 'ideal') want(drift < 0.5, `ideal robot drifted ${drift.toFixed(1)}°`);
    return `${(dist(r) * 100).toFixed(1)} cm, ${drift.toFixed(1)}° off straight`;
  });
  check('lab: turn example turns and stops', () => {
    const { r } = run('lab', 'lab', EXAMPLES.lab.turn.code, 3000, { lv });
    const a = Math.abs(r.headingAcc * 180 / Math.PI);
    want(a > 45 && a < 300, `turned ${a.toFixed(0)}°`);
    return `${a.toFixed(0)}°`;
  });
  check('RC example drives when it receives F', () => {
    const { r } = run('race', 'none', EXAMPLES.race.rc.code, 5000, { lv, onStep: (W, i) => { if (i === 3200) W.deliver(W.robots[0].board, 'F'); } });
    want(r.odo > 0.3, `moved only ${(r.odo * 100).toFixed(0)} cm`);
    return `${(r.odo * 100).toFixed(0)} cm`;
  });
  if (lv === 'ideal') check('obstacle example reaches the goal in room 1', () => {
    const { W } = run('maze', 'room1', EXAMPLES.maze.avoid.code, 150000, { lv, until: W => W.state.done != null });
    want(W.state.done != null, 'goal not reached in 150 s');
    return `${W.state.done.toFixed(0)} s, ${W.bumps} bumps`;
  });
}

console.log('\nStudent templates');
for (const [a, t] of Object.entries(M.TEMPLATES)) for (const lv of ['guided', 'blank']) check(`${t.name} template (${lv}) compiles and runs`, () => {
  run(a, Object.keys(M.ARENAS[a].variants)[0], t[lv], 3000);
});
// A reference program for each playground must earn every star it can without a human driving.
const REF = { line: [EXAMPLES.line.pid.code, EXAMPLES.line.pid.code.replace('int baseSpeed = 150;', 'int baseSpeed = 180;')], sumo: [EXAMPLES.sumo.basic.code], maze: [EXAMPLES.maze.avoid.code, EXAMPLES.maze.avoid.code.replace('int safeDistance = 25;', 'int safeDistance = 30;').replace('int cruise = 200;', 'int cruise = 255;')],
  lab: [EXAMPLES.lab.meter.code.replace('int driveTime = 1500;', 'int driveTime = 2150;'), EXAMPLES.lab.turn.code.replace('int turnTime = 400;', 'int turnTime = TT;'), EXAMPLES.lab.blink.code] };
for (const [a, codes] of Object.entries(REF)) M.TEMPLATES[a].missions.forEach((m, i) => check(`mission ${a} ${i + 1}: ${m.text}`, () => {
  const g = M.GOAL_TYPES[m.goal.type], v = m.variant || Object.keys(M.ARENAS[a].variants)[0];
  let res = null;
  for (const code of codes) if (!res) for (const tt of (code.includes('TT') ? Array.from({ length: 50 }, (_, k) => 250 + k * 10) : [0])) {
    const x = run(a, v, code.replace('TT', tt), 150000, { opp: a === 'sumo' ? v : 'none', until: W => g.check(W, m.goal) || (W.state && W.state.over) });
    if (g.check(x.W, m.goal)) { res = x; break; }
  }
  want(res, 'not reachable by the reference program');
  return `${(res.W.time / 1000).toFixed(1)} s`;
}));

console.log('\nFix-the-bug challenges');
// The fix for each challenge: [broken text, fixed text]
const FIX = {
  'bug-backwards': [['digitalWrite(IN1, left >= 0 ? LOW : HIGH);\n  digitalWrite(IN2, left >= 0 ? HIGH : LOW);', 'digitalWrite(IN1, left >= 0 ? HIGH : LOW);\n  digitalWrite(IN2, left >= 0 ? LOW : HIGH);'], ['digitalWrite(IN3, right >= 0 ? LOW : HIGH);\n  digitalWrite(IN4, right >= 0 ? HIGH : LOW);', 'digitalWrite(IN3, right >= 0 ? HIGH : LOW);\n  digitalWrite(IN4, right >= 0 ? LOW : HIGH);']],
  'bug-pinmode': [['  pinMode(IN2, OUTPUT);', '  pinMode(IN2, OUTPUT);\n  pinMode(IN3, OUTPUT);\n  pinMode(IN4, OUTPUT);']],
  'bug-semicolon': [['delay(driveTime) ', 'delay(driveTime);']],
  'bug-swapped': [['drive(speed, 0);          // line on the left', 'drive(0, speed);          // line on the left'], ['drive(0, speed);          // line on the right', 'drive(speed, 0);          // line on the right']],
  'bug-equals': [['if (left = HIGH)', 'if (left == HIGH)']],
  'bug-sleepy': [['  delay(400);                 // rest a little', '']],
  'bug-threshold': [['middle < black', 'middle > black'], ['left < black', 'left > black'], ['right < black', 'right > black']],
  'bug-rc': [["case 'f':", "case 'F':"]],
  'bug-sonar': [['if (d > safeDistance) {', 'if (d < safeDistance) {']],
  'bug-edge': [['if (left > edgeLimit || right > edgeLimit) {', 'if (left < edgeLimit || right < edgeLimit) {']],
};
for (const c of M.CHALLENGES) {
  const opts = { opp: c.arena === 'sumo' ? c.variant : 'none', until: W => c.check(W) || (W.state && W.state.over), onStep: c.arena === 'race' ? (W, i) => { if (i % 500 === 100) W.deliver(W.robots[0].board, 'F'); } : null };
  const attempt = code => { try { return c.check(run(c.arena, c.variant, code, 150000, opts).W); } catch (e) { return false; } };
  check(`${c.id}: broken program fails, fixed one passes`, () => {
    want(FIX[c.id], 'no fix listed in tools/check.js');
    want(!attempt(c.code), 'the broken program already reaches the goal');
    let fixed = c.code;
    for (const [a, b] of FIX[c.id]) { want(fixed.includes(a), `fix text not found: ${a.slice(0, 40)}`); fixed = fixed.split(a).join(b); }
    want(attempt(fixed), 'the fixed program does not reach the goal');
  });
}

console.log('\nPID path lessons');
// Each step's starter must fail its goal, and the finished step must pass it.
const PID_FIX = {
  pid1: [['    // TODO 1: add  v * position  to weighted\n', '    weighted += v * position;\n'], ['    // TODO 2: add  v  to total\n', '    total += v;\n'], ['  return 0;\n}', '  return weighted / total;\n}']],
  pid2: [['  int turn = 0;', '  int turn = Kp * error;'], ['  drive(baseSpeed, baseSpeed);\n  delay(2);', '  drive(baseSpeed + turn, baseSpeed - turn);\n  delay(2);']],
  pid3: [['  int turn = Kp * error;   // the P part, from step 2', '  int turn = Kp * error + Kd * change;']],
};
for (const [id, fix] of Object.entries(PID_FIX)) check(`${id}: starter fails, finished step passes`, () => {
  const L = M.LESSONS.find(l => l.id === id);
  const attempt = code => run(L.arena, L.variant, code, 60000, { until: L.check }).W;
  want(!L.check(attempt(L.code)), 'the starter already reaches the goal');
  let code = L.code;
  for (const [a, b] of fix) { want(code.includes(a), `fix text not found: ${a.slice(0, 40)}`); code = code.replace(a, b); }
  const W = attempt(code);
  want(L.check(W), `the finished step does not reach the goal (laps: ${W.state.laps.map(l => l.time.toFixed(1)).join(', ') || 'none'})`);
  return W.state.laps.map(l => `${l.time.toFixed(1)} s, wiggle ${Math.round(l.rms)} mm`).join('; ');
});

console.log('\nAdvanced PID lessons');
{
  const lineRun = (code, variant, mis, ms = 45000) => {
    const W = M.buildWorld('line', variant, { realism: 'ideal', unitA: 1 }, M.makeCfg('dowee', { mismatch: mis || 0 }), M.makeCfg('dowee'), 'none');
    const r = W.robots[0]; r.board.onError = e => { throw new Error(`program crashed: ${e.message} (line ${e.line})`); };
    r.board.load(M.compileArduino(code, r.board), 0);
    const memos = M.PIDI_GUIDE.map(() => ({})), hit = M.PIDI_GUIDE.map(() => false);
    for (let i = 0; i < ms; i++) { W.step(); if (i % 200 === 0) M.PIDI_GUIDE.forEach((g, k) => { if (!hit[k] && g.ok(W, memos[k])) hit[k] = true; }); }
    return { W, hit, laps: W.state.laps.map(l => `${l.time.toFixed(1)} s/${Math.round(l.rms)} mm`).join(', ') };
  };
  check('worksheet: every blank filled with its answer laps the Snake under 16 s', () => {
    const { W, laps } = lineRun(M.fillBlanks(M.PID_BLANKS.map(b => b.a[0])), 'snake');
    want(W.state.laps.some(l => l.time < 16), `laps: ${laps || 'none'}`);
    return laps;
  });
  check('worksheet: answers are checked fairly', () => {
    M.PID_BLANKS.forEach((b, i) => b.a.forEach(a => want(M.blankRight(i, a), `blank ${i + 1} rejects its own answer "${a}"`)));
    want(M.blankRight(7, 'Kd*change + Ki * integral+error*Kp;'), 'the PID formula in another order is rejected');
    want(M.blankRight(1, 'weighted = weighted + position * v'), 'x = x + y form is rejected');
    want(!M.blankRight(4, 'lastError - error'), 'a wrong D part is accepted');
    want(!M.blankRight(8, 'baseSpeed - turn, baseSpeed + turn'), 'swapped wheels are accepted');
  });
  check('in-editor blanks: Upload says a line still has a blank', () => {
    try { M.compileArduino(M.PIDI_EDITOR, new M.Board({ cfg: M.makeCfg('dowee') })); } catch (e) { want(/still has a blank/.test(e.message), e.message); return `line ${e.line}`; }
    want(false, 'the blank version compiled');
  });
  const step = {
    1: c => c.replace(`    // TODO: spin one way, then the other. (millis() - start tells you how long you have been sweeping.)\n\n    // TODO: for each sensor i, update minV[i] and maxV[i].\n\n`, `    unsigned long t = millis() - start;\n    if (t < 250 || (t >= 750 && t < 1250) || t >= 1750) drive(-120, 120); else drive(120, -120);\n    for (int i = 0; i < 5; i++) {\n      int v = analogRead(A0 + i);\n      if (v < minV[i]) minV[i] = v;\n      if (v > maxV[i]) maxV[i] = v;\n    }\n`),
    2: c => c.replace(`  // TODO: map the reading from minV[i]..maxV[i] to 0..1000, then constrain it to 0..1000.\n  return 0;`, `  long v = map(analogRead(A0 + i), minV[i], maxV[i], 0, 1000);\n  return constrain(v, 0, 1000);`)
            .replace(`  // TODO: the weighted average of the five sensors, like in PID 1.\n  // If no sensor sees the line, return 2000 or -2000 (the side you saw it last).\n  return 0;`, `  long weighted = 0;\n  long total = 0;\n  for (int i = 0; i < 5; i++) {\n    int v = readSensor(i);\n    if (v < 100) v = 0;\n    weighted += (long)v * (i - 2) * 1000;\n    total += v;\n  }\n  if (total < 300) return lastError > 0 ? 2000 : -2000;\n  return weighted / total;`),
    3: c => c.replace('  int turn = 0;\n  if (error > 300) turn = 50;\n  if (error < -300) turn = -50;', '  int turn = Kp * error + Kd * (error - lastError);'),
    4: (c, lim = true) => c.replace('  int turn = Kp * error + Kd * (error - lastError);', `  integral += error;\n${lim ? '  integral = constrain(integral, -iLimit, iLimit);\n' : ''}  int turn = Kp * error + Ki * integral + Kd * (error - lastError);`).replace('float Kp = 0.08;', 'float Kp = 0.04;').replace('float Ki = 0.0;', 'float Ki = 0.001;'),
    5: c => c.replace('float Kp = 0.04;', 'float Kp = 0.08;').replace('float Ki = 0.001;', 'float Ki = 0.0002;').replace('int baseSpeed = 150;', 'int baseSpeed = 180;'),
  };
  const G = M.PIDI_GUIDED;
  check('guided template: the empty template runs and ticks nothing', () => { const { hit } = lineRun(G, 'oval', 0, 8000); want(!hit.some(Boolean), `ticked step(s) ${hit.map((h, k) => h ? k + 1 : '').join('')}`); });
  let c = G;
  const where = { 1: ['oval'], 2: ['oval'], 3: ['oval'], 4: ['oval', 30], 5: ['snake'] };
  for (const n of [1, 2, 3, 4, 5]) {
    c = n === 5 ? step[5](c).replace('float Kp = 0.08;', 'float Kp = 0.1;').replace('float Kd = 1.5;', 'float Kd = 2;').replace('int baseSpeed = 180;', 'int baseSpeed = 200;').replace('float Ki = 0.0002;', 'float Ki = 0;') : step[n](c);
    const code = c;
    check(`guided step ${n} (${M.PIDI_GUIDE[n - 1].title}) ticks with the reference solution`, () => { const r = lineRun(code, ...where[n]); want(r.hit[n - 1], `not ticked (laps: ${r.laps || 'none'})`); return r.laps; });
  }
  check('guided step 4 needs I: PD with a gentle Kp does not tick', () => { const r = lineRun(step[3](step[2](step[1](G))).replace('float Kp = 0.08;', 'float Kp = 0.04;'), 'oval', 30); want(!r.hit[3], 'ticked without I'); return r.laps; });
  check('guided step 4 needs the anti-windup limit', () => { const r = lineRun(step[4](step[3](step[2](step[1](G))), false), 'oval', 30); want(!r.hit[3], 'ticked without the limit'); return r.laps || 'no lap: windup'; });
}

console.log('\nPRIMM lessons (Predict, Run, Investigate, Modify, Make)');
{
  const valid = q => q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length && q.q && q.why;
  const inPath = new Set(M.LESSON_PATH.flatMap(p => p.ids));
  check('every built-in lesson has a Predict question and is on the Lessons page', () => {
    const miss = M.LESSONS.filter(l => !l.predict).map(l => l.id), off = M.LESSONS.filter(l => !inPath.has(l.id)).map(l => l.id);
    want(!miss.length, `no Predict: ${miss.join(', ')}`); want(!off.length, `not in LESSON_PATH: ${off.join(', ')}`);
    return `${M.LESSONS.length} lessons`;
  });
  for (const l of M.LESSONS) for (const [tag, P] of [['', l], [' (TODO version)', l.todo && l.todo.predict ? { ...l, ...l.todo } : null]]) if (P && P.predict) check(`${l.id}${tag}: questions have a valid answer`, () => {
    want(valid(P.predict), 'Predict question is incomplete');
    (P.investigate || []).forEach((q, i) => want(valid(q), `Investigate question ${i + 1} is incomplete`));
    (P.modify || []).forEach((m, i) => want(m.text && typeof m.check === 'function', `Modify ${i + 1} is incomplete`));
  });
  // A reference change for every Modify step: [code, opts]. The starter must not tick it; the change must.
  const E = EXAMPLES, L = id => M.LESSONS.find(l => l.id === id);
  const startOf = l => l.code || (l.example && E[l.arena][l.example].code);
  const sub = (code, ...pairs) => { for (let i = 0; i < pairs.length; i += 2) { if (!code.includes(pairs[i])) throw new Error(`text not found: ${pairs[i].slice(0, 40)}`); code = code.split(pairs[i]).join(pairs[i + 1]); } return code; };
  const pidFixed = id => PID_FIX[id].reduce((c, [a, b]) => sub(c, a, b), L(id).code);
  const keys = (...ks) => (W, i) => { for (const [t, k] of ks) if (i === t) W.deliver(W.robots[0].board, k); };
  const EDGE_FIX = sub(L('edge').code, '  // TODO: if left OR right is below 400, the robot is on the white edge!', '  if (left < 400 || right < 400) { drive(-150, -150); delay(300); drive(150, -150); delay(450); }\n  // was the TODO');
  const ws = M.PIDI_FULL.replace(/\{\{(\d+)\}\}/g, (_, n) => M.PID_BLANKS[n - 1].a[0]);
  const MOD = {
    blocks: { start: E.lab.meter.code, refs: [[sub(E.lab.meter.code, 'int driveTime = 1500;', 'int driveTime = 500;')], [sub(E.lab.meter.code, 'int speed = 180;', 'int speed = -180;')]] },
    blink: { refs: [[sub(E.lab.blink.code, 'delay(500);', 'delay(250);')], [sub(E.lab.blink.code, 'delay(500);', 'delay(40);')]] },
    drive: { refs: [[sub(E.lab.meter.code, 'int driveTime = 1500;', 'int driveTime = 750;')], [sub(E.lab.meter.code, 'int speed = 180;', 'int speed = -180;')]] },
    turn: { refs: [[sub(E.lab.turn.code, 'drive(turnSpeed, -turnSpeed);', 'drive(-turnSpeed, turnSpeed);')], [sub(E.lab.turn.code, 'int turnTime = 400;', 'int turnTime = 1300;')]] },
    see: { refs: [[sub(E.line.print.code, 'delay(50);', 'delay(500);')]] },
    follow: { refs: [[sub(E.line.bang.code, 'int speed = 150;', 'int speed = 170;')]], todo: [[E.line.bang.code], [sub(E.line.bang.code, 'int speed = 150;', 'int speed = 170;')]] },
    pid1: { refs: [[pidFixed('pid1')]] }, pid2: { refs: [[pidFixed('pid2')]] }, pid3: { refs: [[pidFixed('pid3')]] },
    pid: { refs: [[sub(E.line.pid.code, 'int baseSpeed = 150;', 'int baseSpeed = 180;')]], todo: [[E.line.pid.code], [sub(E.line.pid.code, 'int baseSpeed = 150;', 'int baseSpeed = 180;')]] },
    rc: { opts: { onStep: keys([500, 'F'], [4000, 'F']) }, ms: 20000, refs: [[sub(E.race.rc.code, 'int speed = 220;', 'int speed = 150;')]],
      todo: [[E.race.rc.code, { onStep: keys([4000, 'B']) }], [E.race.rc.code, { onStep: keys([4000, 'L'], [7000, 'R']) }]] },
    sonar: { ms: 20000, refs: [[sub(E.maze.avoid.code, 'int safeDistance = 25;', 'int safeDistance = 40;')]], todo: [[E.maze.avoid.code], [E.maze.avoid.code]] },
    edge: { ms: 12000, refs: [[EDGE_FIX]] },
    fight: { refs: [[E.sumo.basic.code, { variant: 'statue', opp: 'statue' }]], todo: [[E.sumo.basic.code]] },
    soccer: { refs: [[E.race.rc.code, { onStep: keys([500, 'F'], [2500, 'S']) }]], opts: {} },
    apid1: { start: ws, refs: [[sub(ws, 'float Ki = 0.0002;', 'float Ki = 0.002;')]] },
    apid2: { start: ws, refs: [[sub(ws, 'float Ki = 0.0002;', 'float Ki = 0.002;')]] },
  };
  const modRun = (l, code, o, ms) => {
    const variant = o.variant || l.variant || Object.keys(M.ARENAS[l.arena].variants)[0];
    const W = M.buildWorld(l.arena, variant, { realism: 'ideal', unitA: 1, runSeed: 7 }, M.makeCfg('dowee'), M.makeCfg('dowee'), o.opp || (l.arena === 'sumo' ? variant : 'none'));
    const r = W.robots[0]; r.board.onSerial = s => { r.board.serialLines += (s.match(/\n/g) || []).length; };
    r.board.load(M.compileArduino(code, r.board), 0);
    return W;
  };
  const ticks = (l, mods, code, o = {}, ms = 30000) => {
    const W = modRun(l, code, o, ms), memo = mods.map(() => ({})), hit = mods.map(() => false);
    for (let i = 0; i < ms; i++) {
      W.step(); if (o.onStep) o.onStep(W, i);
      if (i % 200 === 0) mods.forEach((m, k) => { if (!hit[k]) { try { hit[k] = !!m.check(W, memo[k]); } catch (e) { /* not yet */ } } });
      if (hit.every(Boolean)) break;
    }
    return hit;
  };
  for (const l of M.LESSONS) for (const [tag, mods, refs, start] of [['', l.modify, MOD[l.id] && MOD[l.id].refs, (MOD[l.id] && MOD[l.id].start) || startOf(l)], [' (TODO version)', l.todo && l.todo.modify, MOD[l.id] && MOD[l.id].todo, l.todo && l.todo.code]]) {
    if (!mods || !mods.length) continue;
    if (l.blocks && !MOD[l.id]) continue;   // Blocks lessons are checked from their blocks in tools/blocks-check.js
    const spec = MOD[l.id] || {}, ms = spec.ms || 60000;
    check(`${l.id}${tag}: the starter ticks no Modify step, each reference change ticks its own`, () => {
      want(refs && refs.length === mods.length, `tools/check.js needs ${mods.length} reference change(s)`);
      const startHit = ticks(l, mods, start, { ...(spec.opts || {}) }, Math.min(ms, 20000));
      want(!startHit.some(Boolean), `the starter already ticks: ${mods.filter((m, k) => startHit[k]).map(m => m.text.replace(/<[^>]+>/g, '')).join(' / ')}`);
      refs.forEach(([code, o], k) => { const hit = ticks(l, mods, code, { ...(spec.opts || {}), ...(o || {}) }, ms); want(hit[k], `reference change ${k + 1} does not tick "${mods[k].text.replace(/<[^>]+>/g, '')}"`); });
      return `${mods.length} step(s)`;
    });
  }
}

console.log('\nRepeatability');
check('Ideal robot: same code, same result', () => {
  const a = run('line', 'snake', EXAMPLES.line.pid.code, 30000, { seed: 11 }), b = run('line', 'snake', EXAMPLES.line.pid.code, 30000, { seed: 999 });
  const key = x => JSON.stringify([x.W.state.laps, x.r.x.toFixed(9), x.r.y.toFixed(9)]);
  want(key(a) === key(b), 'two ideal runs differ');
  return 'identical laps and final position';
});
check('Ideal robot: every unit is the same', () => {
  const a = run('lab', 'lab', EXAMPLES.lab.meter.code, 3000, { unit: 1 }), b = run('lab', 'lab', EXAMPLES.lab.meter.code, 3000, { unit: 4321 });
  want(a.r.x === b.r.x && a.r.y === b.r.y, 'units differ in the ideal world');
  return 'identical';
});
check('Realistic world: units differ', () => {
  const a = run('lab', 'lab', EXAMPLES.lab.meter.code, 3000, { lv: 'real', unit: 1 }), b = run('lab', 'lab', EXAMPLES.lab.meter.code, 3000, { lv: 'real', unit: 4321 });
  want(a.r.y !== b.r.y, 'two units behave identically');
  return `drift ${(a.r.headingAcc * 57.3).toFixed(1)}° vs ${(b.r.headingAcc * 57.3).toFixed(1)}°`;
});

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
