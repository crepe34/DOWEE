#!/usr/bin/env node
// Blocks mode checks. They need a browser, because the block → Arduino translator runs inside
// Blockly. Uses Playwright if it is installed (it is a dev tool only, the app never needs it);
// otherwise prints "skipped". Run after `npm run build`.
//   1. Golden tests: small block programs must turn into exactly the expected Arduino lines.
//   2. Every Blocks example compiles and does its job in the simulator.
//   3. Every Blocks lesson: the starter ticks no Modify step, each reference ticks its own,
//      and the finished reference reaches the lesson goal.
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nBlocks checks skipped (Playwright is not installed)'); process.exit(0); }
const M = require('../dist/core-all.js');
const { X } = M;
let failed = 0;
const ok = (name, msg) => console.log(`  ok    ${name}${msg ? ' — ' + msg : ''}`);
const bad = (name, msg) => { failed++; console.log(`  FAIL  ${name} — ${msg}`); };

// a small program with one "show in Serial monitor" of an expression, to test how values are written
const show = (expr, opts) => X.prog(X.print(expr), '', opts);
const n = X.numB;
const GOLDEN = [
  ['a − (b − c) keeps its brackets', show(X.arith('MINUS', n(10), X.arith('MINUS', n(4), n(3)))), 'Serial.println(10 - (4 - 3));'],
  ['(a − b) − c needs none', show(X.arith('MINUS', X.arith('MINUS', n(10), n(4)), n(3))), 'Serial.println(10 - 4 - 3);'],
  ['a ÷ (b × c) keeps its brackets, and divides like a calculator', show(X.arith('DIVIDE', n(12), X.arith('MULTIPLY', n(2), n(3)))), 'Serial.println(12.0 / (2 * 3));'],
  ['7 ÷ 2 is 3.5, not 3', show(X.arith('DIVIDE', n(7), n(2))), 'Serial.println(7 / 2.0);'],
  ['a × (b + c)', show(X.arith('MULTIPLY', n(2), X.arith('ADD', n(3), n(4)))), 'Serial.println(2 * (3 + 4));'],
  ['a + (b + c) needs none', show(X.arith('ADD', n(2), X.arith('ADD', n(3), n(4)))), 'Serial.println(2 + 3 + 4);'],
  ['comparison of a sum', show(X.cmp('LT', X.arith('ADD', n(1), n(2)), n(4))), 'Serial.println(1 + 2 < 4);'],
  ['text is escaped for C', show(`<block type="text"><field name="TEXT">say "hi" \\ é</field></block>`), 'Serial.println("say \\"hi\\" \\\\ ?");'],
  ['whole-number divide', show(`<block type="dowee_intdiv"><value name="A">${n(7)}</value><value name="B">${n(2)}</value></block>`), 'Serial.println((long)(7) / (long)(2));'],
  ['a typed whole-number variable is an int', X.prog(X.set('vc', 'count', 1, X.print(X.get('vc', 'count'))), '', { vars: [['vc', 'count', 'int']] }), 'int count = 0;'],
  ['an untyped variable that gets a decimal is a float', X.prog(`<block type="variables_set"><field name="VAR" id="u1">size</field><value name="VALUE">${X.num(2.5)}</value></block>`, '', { vars: [['u1', 'size', '']] }), 'float size = 0;'],
  ['an untyped variable that only gets whole numbers is an int', X.prog(`<block type="variables_set"><field name="VAR" id="u2">laps</field><value name="VALUE">${X.num(3)}</value></block>`, '', { vars: [['u2', 'laps', '']] }), 'int laps = 0;'],
  ['names that clash get a number', X.prog(`<block type="variables_set"><field name="VAR" id="u3">my speed</field><value name="VALUE">${X.num(1)}</value><next><block type="variables_set"><field name="VAR" id="u4">my_speed</field><value name="VALUE">${X.num(2)}</value></block></next></block>`, '', { vars: [['u3', 'my speed', ''], ['u4', 'my_speed', '']] }), 'my_speed2 = 2;'],
  ['a name that is an Arduino word is changed', X.prog(`<block type="variables_set"><field name="VAR" id="u5">delay</field><value name="VALUE">${X.num(1)}</value></block>`, '', { vars: [['u5', 'delay', '']] }), 'delay_ = 1;'],
  ['list items count from 1', X.prog(`<block type="dowee_list_set"><field name="VAR" id="l1" variabletype="list">nums</field><value name="I">${X.num(1)}</value><value name="V">${X.num(5)}</value></block>`, '', { vars: [['l1', 'nums', 'list']] }), 'nums[0] = 5;'],
  ['a function with a return value gets the right types', X.prog(X.print(`<block type="procedures_callreturn"><mutation name="twice"><arg name="x"></arg></mutation><value name="ARG0">${X.num(3)}</value></block>`), '', { vars: [['p1', 'x', '']], extra: `<block type="procedures_defreturn" x="300" y="20"><mutation><arg name="x" varid="p1"></arg></mutation><field name="NAME">twice</field><value name="RETURN"><block type="math_arithmetic"><field name="OP">MULTIPLY</field><value name="A"><block type="variables_get"><field name="VAR" id="p1">x</field></block></value><value name="B">${X.num(2)}</value></block></value></block>` }), 'int twice(int x) {'],
  ['every N ms is a non-blocking timer', X.prog('', X.every(250, X.toggle())), 'if (millis() - everyTimer1 >= 250) {'],
  ['repeat with a decimal count', X.prog(`<block type="controls_repeat_ext"><value name="TIMES">${X.num(2.5)}</value></block>`, ''), 'for (int i1 = 0; i1 < (int)(2.5); i1++) {'],
  ['a loose block does not get into the code', X.prog(X.led('HIGH'), '', { extra: X.move('B', 150) }), null, code => !/drive\(-150/.test(code)],
  ['a wait with an expression is still a whole number of ms', X.prog(`<block type="dowee_wait"><value name="SEC">${X.arith('ADD', n(1), n(0.5))}</value></block>`, ''), 'delay((unsigned long)((1 + 0.5) * 1000));'],
  ['only what is used is set up', X.prog(X.led('HIGH'), ''), null, code => !code.includes('pinMode(IN1') && !code.includes('Serial.begin') && code.includes('pinMode(LED_BUILTIN, OUTPUT);')],
];

// Run Arduino code in the simulator, polling checks every 200 ms like the app does.
function sim(arena, variant, code, ms, checks = [], opts = {}) {
  const opp = opts.opp || (arena === 'sumo' ? variant : 'none');
  const W = M.buildWorld(arena, variant, { realism: 'ideal', unitA: 1, runSeed: 7 }, M.makeCfg('dowee'), M.makeCfg('dowee'), opp);
  const r = W.robots[0];
  r.board.onSerial = s => { r.board.serialLines += (s.match(/\n/g) || []).length; };
  let err = null; r.board.onError = e => { err = e; };
  r.board.load(M.compileArduino(code, r.board), 0);
  const memo = checks.map(() => ({})), hit = checks.map(() => false);
  for (let i = 0; i < ms; i++) {
    W.step(); if (opts.onStep) opts.onStep(W, i);
    if (err) throw new Error(`program crashed: ${err.message} (line ${err.line})`);
    if (i % 200 === 0) checks.forEach((c, k) => { if (!hit[k]) { try { hit[k] = !!c(W, memo[k]); } catch (e) { /* not yet */ } } });
    if (opts.until && opts.until(W)) break;
  }
  checks.forEach((c, k) => { if (!hit[k]) { try { hit[k] = !!c(W, memo[k]); } catch (e) { /* no */ } } });
  return { W, r, hit };
}
const keys = (...ks) => (W, i) => { for (const [t, k] of ks) if (i === t) W.deliver(W.robots[0].board, k); };
const lap = W => W.state.laps && W.state.laps.length >= 1;
const still = W => { const r = W.robots[0]; return Math.hypot(r.vx, r.vy) < 0.005 && Math.abs(r.w) < 0.02; };
const deg = W => Math.abs(W.robots[0].headingAcc * 180 / Math.PI);
// What each example must do: [variant, ms, check, opts]
const EXPECT = {
  lab: {
    meter: ['lab', 4000, W => still(W) && Math.hypot(W.robots[0].x - W.robots[0].start.x, W.robots[0].y - W.robots[0].start.y) > 0.5],
    blink: ['lab', 6000, W => W.robots[0].board.ledToggles >= 10],
    square: ['lab', 9000, W => still(W) && Math.abs(deg(W) - 360) < 40],
    count: ['lab', 3200, W => W.robots[0].board.serialLines >= 5],
    tune: ['lab', 3000, W => W.time >= 2999],
  },
  line: { follow2: ['oval', 60000, lap], follow3: ['oval', 60000, lap], pfollow: ['oval', 60000, lap], blinkfollow: ['oval', 60000, W => lap(W) && W.robots[0].board.ledToggles >= 10] },
  maze: { avoid: ['room1', 40000, W => W.robots[0].odo > 3], cautious: ['room1', 40000, W => W.robots[0].odo > 2] },
  sumo: { basic: ['statue', 60000, W => W.state.result === 'A', { until: W => W.state.over }] },
  race: { rc: ['none', 6000, W => W.robots[0].odo > 0.3, { onStep: keys([3500, 'F']) }] },
  soccer: { rc: ['easy', 3000, W => W.robots[0].odo > 0.3, { onStep: keys([500, 'F']) }] },
};
// The finished version of each Blocks lesson, one per Modify step (the last one also reaches the goal unless `goal` is given).
const LV = { vc: ['vc', 'count', 'int'], vs: ['vs', 'speed', 'int'] };
const followSpeed = s => X.prog(X.set('vs', 'speed', s), X.ifs([[X.black('A1'), X.move('TL', X.get('vs', 'speed'))], [X.black('A3'), X.move('TR', X.get('vs', 'speed'))]], X.move('F', X.get('vs', 'speed'))), { vars: [LV.vs] });
const turnDef = X.defn('turnAround', X.move('SR', 150, X.wait(0.62, X.stop())));
const REF = {
  blocks: { mods: [X.prog(X.led('HIGH', X.move('F', 180, X.wait(0.5, X.stop(X.led('LOW'))))), ''), X.prog(X.move('B', 180, X.wait(1.5, X.stop())), '')], goal: X.prog(X.led('HIGH', X.move('F', 180, X.wait(2.15, X.stop(X.led('LOW'))))), ''), ms: 5000 },
  'b-blink': { mods: [X.prog('', X.led('HIGH', X.wait(0.5, X.led('LOW', X.wait(0.5))))), X.prog('', X.led('HIGH', X.wait(0.1, X.led('LOW', X.wait(0.1)))))], ms: 12000 },
  'b-square': { mods: [X.prog(X.repeat(4, X.move('F', 180, X.wait(1, X.move('SR', 150, X.wait(0.3)))), X.stop()), ''), X.prog(X.repeat(4, X.move('F', 180, X.wait(1.6, X.move('SR', 150, X.wait(0.3)))), X.stop()), '')], ms: 14000 },
  'b-count': { mods: [X.prog(X.set('vc', 'count', 1), X.print(X.get('vc', 'count'), X.change('vc', 'count', 1, X.wait(0.25))), { vars: [LV.vc] })],
    goal: X.prog(X.set('vc', 'count', 1), X.ifs([[X.cmp('LTE', X.get('vc', 'count'), 10), X.print(X.get('vc', 'count'), X.change('vc', 'count', 1, X.wait(0.25)))]]), { vars: [LV.vc] }), ms: 14000 },
  'b-follow': { mods: [BX_follow()], ms: 60000 },
  'b-avoid': { mods: [null], ms: 60000 },
  'b-rc': { mods: [M.BLOCK_EXAMPLES.race.rc.xml(), M.BLOCK_EXAMPLES.race.rc.xml()], opts: [{ onStep: keys([3500, 'B']) }, { onStep: keys([3500, 'L'], [6500, 'R']) }], goalOpts: { onStep: keys([3500, 'F'], [7000, 'S']) }, ms: 14000 },
  'b-func': { mods: [X.prog(X.move('F', 180, X.wait(1, X.call('turnAround', X.move('F', 180, X.wait(1, X.stop()))))), '', { extra: turnDef })], goal: X.prog(X.call('turnAround', X.call('turnAround')), '', { extra: turnDef }), ms: 8000 },
  'b-every': { mods: [X.prog('', X.every(500, X.toggle(), X.ifs([[X.black('A1'), X.move('TL', 150)], [X.black('A3'), X.move('TR', 150)]], X.move('F', 150))))], ms: 60000 },
  'b-tocode': { mods: [followSpeed(170)], goal: followSpeed(175), ms: 60000 },
};
function BX_follow() { return X.prog('', X.ifs([[X.black('A1'), X.move('TL', 150)], [X.black('A3'), X.move('TR', 150)]], X.move('F', 150))); }
REF['b-avoid'].mods = [M.BLOCK_EXAMPLES.maze.avoid.xml()];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  await ctx.route(/^https?:\/\//, r => r.abort());   // Blocks mode must work with no network
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'app', 'index.html'));
  await p.waitForFunction(() => window.__doweeBlocks);
  const toCode = xml => p.evaluate(x => window.__doweeBlocks.toCode(x).catch(e => 'ERROR: ' + e.message), xml);

  console.log('\nBlocks → Arduino translator');
  for (const [name, xml, want, test, skip] of GOLDEN) {
    if (skip) continue;
    const code = await toCode(xml);
    if (code.startsWith('ERROR')) { bad(name, code); continue; }
    try { sim('lab', 'lab', code, 5); } catch (e) { bad(name, `does not compile: ${e.message} (line ${e.line})\n${code}`); continue; }
    if (want && !code.split('\n').some(l => l.trim() === want)) bad(name, `expected the line  ${want}\n${code}`);
    else if (test && !test(code)) bad(name, `unexpected code:\n${code}`);
    else ok(name);
  }

  console.log('\nBlocks examples');
  for (const [a, list] of Object.entries(M.BLOCK_EXAMPLES)) for (const [k, ex] of Object.entries(list)) {
    const name = `${a}/${k}: ${ex.name}`, e = EXPECT[a] && EXPECT[a][k];
    if (!e) { bad(name, 'no expectation in tools/blocks-check.js'); continue; }
    const code = await toCode(ex.xml());
    try { const { hit, W } = sim(a, e[0], code, e[1], [e[2]], e[3] || {}); hit[0] ? ok(name, `${(W.time / 1000).toFixed(1)} s`) : bad(name, 'did not do its job'); }
    catch (err) { bad(name, err.message); }
  }

  console.log('\nBlocks lessons');
  for (const L of M.LESSONS.filter(l => l.blocks)) {
    const R = REF[L.id], mods = L.modify || [];
    if (!R) { bad(L.id, 'no reference solution in tools/blocks-check.js'); continue; }
    try {
      const start = await toCode(L.blocksXml());
      const s = sim(L.arena, L.variant, start, Math.min(R.ms, 20000), mods.map(m => m.check), (R.opts && R.opts[0]) || R.goalOpts || {});
      if (s.hit.some(Boolean)) { bad(L.id, `the starter already ticks Modify ${s.hit.indexOf(true) + 1}`); continue; }
      let good = true;
      for (let k = 0; k < mods.length; k++) {
        const r = sim(L.arena, L.variant, await toCode(R.mods[k]), R.ms, mods.map(m => m.check), (R.opts && R.opts[k]) || R.goalOpts || {});
        if (!r.hit[k]) { bad(L.id, `reference ${k + 1} does not tick "${mods[k].text.replace(/<[^>]+>/g, '')}"`); good = false; }
      }
      const g = sim(L.arena, L.variant, await toCode(R.goal || R.mods[R.mods.length - 1]), R.ms, [L.check], R.goalOpts || (R.opts && R.opts[R.opts.length - 1]) || {});
      if (!g.hit[0]) { bad(L.id, `the reference does not reach the goal: ${L.goal}`); good = false; }
      if (good) ok(`${L.id}: ${L.title}`, `${mods.length} Modify step(s) and the goal`);
    } catch (err) { bad(L.id, err.message); }
  }
  if (errs.length) bad('page', errs.join('; '));
  await b.close();
  console.log(failed ? `\n${failed} blocks check(s) failed` : '\nAll blocks checks passed');
  process.exit(failed ? 1 : 0);
})();
