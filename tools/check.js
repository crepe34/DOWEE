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
