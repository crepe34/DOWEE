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
