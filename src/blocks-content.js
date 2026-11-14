/* =====================================================================
   Block programs as Blockly XML: the example programs for Blocks mode, and the
   Blocks lesson track (PRIMM). Plain strings, so the tests can read them too.
   Blocks mode itself (the Blockly editor and the Arduino translator) is src/blocks.js.
   ===================================================================== */
const X = {
  nx: n => (n ? `<next>${n}</next>` : ''),
  num: n => `<shadow type="math_number"><field name="NUM">${n}</field></shadow>`,
  numB: n => `<block type="math_number"><field name="NUM">${n}</field></block>`,
  move: (d, s, next = '') => `<block type="dowee_move"><field name="DIR">${d}</field><value name="SPEED">${typeof s === 'number' ? X.num(s) : s}</value>${X.nx(next)}</block>`,
  motors: (l, r, next = '') => `<block type="dowee_motors"><value name="L">${typeof l === 'number' ? X.num(l) : l}</value><value name="R">${typeof r === 'number' ? X.num(r) : r}</value>${X.nx(next)}</block>`,
  wait: (s, next = '') => `<block type="dowee_wait"><value name="SEC">${X.num(s)}</value>${X.nx(next)}</block>`,
  stop: (next = '') => `<block type="dowee_stop">${X.nx(next)}</block>`,
  led: (on, next = '') => `<block type="dowee_led"><field name="ON">${on}</field>${X.nx(next)}</block>`,
  toggle: (next = '') => `<block type="dowee_led_toggle">${X.nx(next)}</block>`,
  print: (v, next = '') => `<block type="dowee_print"><value name="V">${v}</value>${X.nx(next)}</block>`,
  black: pin => `<block type="dowee_black"><field name="PIN">${pin}</field></block>`,
  dist: () => '<block type="dowee_distance"></block>',
  linePos: () => '<block type="dowee_line_pos"></block>',
  not: inner => `<block type="logic_negate"><value name="BOOL">${inner}</value></block>`,
  or: (a, b) => `<block type="logic_operation"><field name="OP">OR</field><value name="A">${a}</value><value name="B">${b}</value></block>`,
  cmp: (op, a, b) => `<block type="logic_compare"><field name="OP">${op}</field><value name="A">${a}</value><value name="B">${typeof b === 'number' ? X.num(b) : b}</value></block>`,
  lt: (a, n) => X.cmp('LT', a, n),
  arith: (op, a, b) => `<block type="math_arithmetic"><field name="OP">${op}</field><value name="A">${typeof a === 'number' ? X.num(a) : a}</value><value name="B">${typeof b === 'number' ? X.num(b) : b}</value></block>`,
  bt: c => `<block type="dowee_bt_is"><field name="CMD">${c}</field></block>`,
  btRead: (next = '') => `<block type="dowee_bt_read">${X.nx(next)}</block>`,
  ifs: (pairs, els, next = '') => `<block type="controls_if"><mutation elseif="${pairs.length - 1}"${els ? ' else="1"' : ''}></mutation>${pairs.map(([c, d], i) => `<value name="IF${i}">${c}</value><statement name="DO${i}">${d}</statement>`).join('')}${els ? `<statement name="ELSE">${els}</statement>` : ''}${X.nx(next)}</block>`,
  repeat: (n, body, next = '') => `<block type="controls_repeat_ext"><value name="TIMES">${X.num(n)}</value><statement name="DO">${body}</statement>${X.nx(next)}</block>`,
  every: (ms, body, next = '') => `<block type="dowee_every"><value name="MS">${X.num(ms)}</value><statement name="DO">${body}</statement>${X.nx(next)}</block>`,
  tone: (hz, ms, next = '') => `<block type="dowee_tone"><field name="PIN">4</field><value name="HZ">${X.num(hz)}</value><value name="MS">${X.num(ms)}</value>${X.nx(next)}</block>`,
  // variables: [id, name, type] where type is int, float, bool or list
  // the type of every variable id used below (block fields must carry it)
  vt: new Map([['vc', 'int'], ['vb', 'int'], ['ve', 'int'], ['vt', 'float'], ['vd', 'int'], ['vs', 'int'],
    ['kp', 'float'], ['kd', 'float'], ['bs', 'int'], ['le', 'float'], ['er', 'float'], ['tu', 'float'], ['mn', 'list'], ['mx', 'list'], ['vv', 'int'], ['st', 'long'], ['tt', 'long'], ['ww', 'int'], ['to', 'int'],
    ['ts', 'int'], ['tm', 'int'], ['cm', 'int']]),
  vars: list => (list.length ? `<variables>${list.map(([id, name, type]) => `<variable type="${type || ''}" id="${id}">${name}</variable>`).join('')}</variables>` : ''),
  f: (id, name) => `<field name="VAR" id="${id}" variabletype="${X.vt.get(id) || ''}">${name}</field>`,
  get: (id, name) => `<block type="dowee_var_get">${X.f(id, name)}</block>`,
  set: (id, name, val, next = '') => `<block type="dowee_var_set">${X.f(id, name)}<value name="VALUE">${typeof val === 'number' ? X.num(val) : val}</value>${X.nx(next)}</block>`,
  change: (id, name, by, next = '') => `<block type="dowee_var_change">${X.f(id, name)}<value name="DELTA">${X.num(by)}</value>${X.nx(next)}</block>`,
  defn: (name, body, y = 360) => `<block type="procedures_defnoreturn" x="20" y="${y}"><field name="NAME">${name}</field><statement name="STACK">${body}</statement></block>`,
  call: (name, next = '') => `<block type="procedures_callnoreturn"><mutation name="${name}"></mutation>${X.nx(next)}</block>`,
  prog: (start, forever, opts = {}) => `<xml xmlns="https://developers.google.com/blockly/xml">${X.vars(opts.vars || [])}${opts.extra || ''}<block type="dowee_start" x="20" y="20">${start ? `<statement name="DO">${start}</statement>` : ''}</block><block type="dowee_forever" x="20" y="${start ? 220 : 120}">${forever ? `<statement name="DO">${forever}</statement>` : ''}</block></xml>`,
};
// Any block: B(type, { f: fields, v: values (numbers become number shadows), s: statements, m: mutation }, next)
const B = (type, o = {}, next = '') => `<block type="${type}">${o.m || ''}${Object.entries(o.f || {}).map(([k, x]) => (k === 'VAR' ? x : `<field name="${k}">${x}</field>`)).join('')}${Object.entries(o.v || {}).map(([k, x]) => `<value name="${k}">${typeof x === 'number' ? X.num(x) : x}</value>`).join('')}${Object.entries(o.s || {}).map(([k, x]) => `<statement name="${k}">${x}</statement>`).join('')}${X.nx(next)}</block>`;
// statement blocks one after another
const seq = (...bs) => bs.filter(Boolean).reduceRight((next, b) => (next ? b.replace(/<\/block>$/, `<next>${next}</next></block>`) : b), '');
const XB = {
  forI: (id, from, to, body) => B('controls_for', { f: { VAR: X.f(id, 'i') }, v: { FROM: from, TO: to, BY: 1 }, s: { DO: body } }),
  item: (id, nm, i) => B('dowee_list_get', { f: { VAR: X.f(id, nm) }, v: { I: i } }),
  setItem: (id, nm, i, val) => B('dowee_list_set', { f: { VAR: X.f(id, nm) }, v: { I: i, V: val } }),
  sensorN: i => B('dowee_sensor_n', { v: { N: i } }),
  ms: n => B('dowee_wait_ms', { v: { MS: n } }),
  millis: () => B('dowee_millis'),
  and: (a, b) => `<block type="logic_operation"><field name="OP">AND</field><value name="A">${a}</value><value name="B">${b}</value></block>`,
  defr: (name, args, body, ret, y) => `<block type="procedures_defreturn" x="20" y="${y}"><mutation>${args.map(([id, n]) => `<arg name="${n}" varid="${id}"></arg>`).join('')}</mutation><field name="NAME">${name}</field>${body ? `<statement name="STACK">${body}</statement>` : ''}<value name="RETURN">${ret}</value></block>`,
  callr: (name, args) => `<block type="procedures_callreturn"><mutation name="${name}">${args.map(([n]) => `<arg name="${n}"></arg>`).join('')}</mutation>${args.map(([, x], i) => `<value name="ARG${i}">${x}</value>`).join('')}</block>`,
  pin: p => B('dowee_pin', { f: { PIN: p } }),
  hl: v => B('dowee_hilo', { f: { V: v } }),
  print: v => B('dowee_print_inline', { v: { V: v } }),
  text: t => `<block type="text"><field name="TEXT">${t}</field></block>`,
};
// The PID line follower with calibration, the same program as the text example (line/pid), made of blocks.
function pidBlocks() {
  const g = (id, nm) => X.get(id, nm), i = g('i', 'i'), n = g('pn', 'n');
  const mn = k => XB.item('mn', 'minV', k), mx = k => XB.item('mx', 'maxV', k);
  const calibrate = X.defn('calibrate', seq(
    XB.forI('i', 1, 5, seq(XB.setItem('mn', 'minV', i, 1023), XB.setItem('mx', 'maxV', i, 0))),
    X.led('HIGH'),
    X.set('st', 'start', XB.millis()),
    B('controls_whileUntil', { f: { MODE: 'WHILE' }, v: { BOOL: X.lt(X.arith('MINUS', XB.millis(), g('st', 'start')), 2000) }, s: { DO: seq(
      X.set('tt', 't', X.arith('MINUS', XB.millis(), g('st', 'start'))),
      X.ifs([[X.or(X.or(X.lt(g('tt', 't'), 250), XB.and(X.cmp('GTE', g('tt', 't'), 750), X.lt(g('tt', 't'), 1250))), X.cmp('GTE', g('tt', 't'), 1750)), X.motors(-120, 120)]], X.motors(120, -120)),
      XB.forI('i', 1, 5, seq(
        X.set('vv', 'v', XB.sensorN(i)),
        X.ifs([[X.lt(g('vv', 'v'), mn(i)), XB.setItem('mn', 'minV', i, g('vv', 'v'))]]),
        X.ifs([[X.cmp('GT', g('vv', 'v'), mx(i)), XB.setItem('mx', 'maxV', i, g('vv', 'v'))]]))),
    ) } }),
    X.stop(),
    XB.forI('i', 1, 5, X.ifs([[X.lt(X.arith('MINUS', mx(i), mn(i)), 100), XB.setItem('mx', 'maxV', i, X.arith('ADD', mn(i), 100))]])),
    X.led('LOW'),
    XB.ms(300)), 520);
  const readSensor = XB.defr('readSensor', [['pn', 'n']], '', B('math_constrain', { v: { VALUE: B('dowee_map', { v: { V: XB.sensorN(n), FL: mn(n), FH: mx(n), TL: 0, TH: 1000 } }), LOW: 0, HIGH: 1000 } }), 1180);
  const readLine = XB.defr('readLine', [], seq(
    X.set('ww', 'weighted', 0), X.set('to', 'total', 0),
    XB.forI('i', 1, 5, seq(
      X.set('vv', 'v', XB.callr('readSensor', [['n', i]])),
      X.ifs([[X.lt(g('vv', 'v'), 100), X.set('vv', 'v', 0)]]),
      B('dowee_var_change', { f: { VAR: X.f('ww', 'weighted') }, v: { DELTA: X.arith('MULTIPLY', g('vv', 'v'), X.arith('MINUS', i, 3)) } }),
      B('dowee_var_change', { f: { VAR: X.f('to', 'total') }, v: { DELTA: g('vv', 'v') } }))),
    // line lost: keep turning the way we last saw it
    B('procedures_ifreturn', { m: '<mutation value="1"></mutation>', v: { CONDITION: X.lt(g('to', 'total'), 300), VALUE: B('logic_ternary', { v: { IF: X.cmp('GT', g('le', 'lastError'), 0), THEN: 2000, ELSE: -2000 } }) } })),
    X.arith('MULTIPLY', X.arith('DIVIDE', g('ww', 'weighted'), g('to', 'total')), 1000), 1300);
  return X.prog(
    seq(X.set('kp', 'Kp', 0.08), X.set('kd', 'Kd', 1.5), X.set('bs', 'baseSpeed', 150), X.call('calibrate')),
    seq(X.set('er', 'error', XB.callr('readLine', [])),
      X.set('tu', 'turn', X.arith('ADD', X.arith('MULTIPLY', g('kp', 'Kp'), g('er', 'error')), X.arith('MULTIPLY', g('kd', 'Kd'), X.arith('MINUS', g('er', 'error'), g('le', 'lastError'))))),
      X.set('le', 'lastError', g('er', 'error')),
      X.motors(X.arith('ADD', g('bs', 'baseSpeed'), g('tu', 'turn')), X.arith('MINUS', g('bs', 'baseSpeed'), g('tu', 'turn'))),
      XB.ms(2)),
    { vars: [['kp', 'Kp', 'float'], ['kd', 'Kd', 'float'], ['bs', 'baseSpeed', 'int'], ['le', 'lastError', 'float'], ['er', 'error', 'float'], ['tu', 'turn', 'float'], ['mn', 'minV', 'list'], ['mx', 'maxV', 'list'],
      ['i', 'i', ''], ['vv', 'v', 'int'], ['st', 'start', 'long'], ['tt', 't', 'long'], ['ww', 'weighted', 'int'], ['to', 'total', 'int'], ['pn', 'n', '']], extra: calibrate + readSensor + readLine });
}
const BX = {
  rc: () => X.prog('', X.btRead(X.ifs([[X.bt('F'), X.move('F', 220)], [X.bt('B'), X.move('B', 220)], [X.bt('L'), X.move('SL', 130)], [X.bt('R'), X.move('SR', 130)], [X.bt('G'), X.move('TL', 220)], [X.bt('I'), X.move('TR', 220)], [X.bt('S'), X.stop()]]))),
  follow2: (s = 150) => X.prog('', X.ifs([[X.black('A1'), X.move('TL', s)], [X.black('A3'), X.move('TR', s)]], X.move('F', s))),
};
// Example programs per playground. `starter` is the one classroom students always get.
const BLOCK_EXAMPLES = {
  lab: {
    meter: { name: 'Drive 1 metre and stop', starter: true, xml: () => X.prog(X.led('HIGH', X.move('F', 180, X.wait(1.5, X.stop(X.led('LOW'))))), '') },
    blink: { name: 'Blink the light', xml: () => X.prog('', X.led('HIGH', X.wait(0.5, X.led('LOW', X.wait(0.5))))) },
    square: { name: 'Drive a square (repeat)', xml: () => X.prog(X.repeat(4, X.move('F', 180, X.wait(1, X.move('SR', 150, X.wait(0.3)))), X.stop()), '') },
    count: { name: 'Count in the Serial monitor (variable)', xml: () => X.prog(X.set('vc', 'count', 1), X.print(X.get('vc', 'count'), X.change('vc', 'count', 1, X.wait(0.5))), { vars: [['vc', 'count', 'int']] }) },
    turn: { name: 'Turn 90 degrees', xml: () => X.prog(seq(X.set('ts', 'turnSpeed', 150), X.set('tm', 'turnTime', 400),
      X.motors(X.get('ts', 'turnSpeed'), B('math_single', { f: { OP: 'NEG' }, v: { NUM: X.get('ts', 'turnSpeed') } })), B('dowee_wait_ms', { v: { MS: X.get('tm', 'turnTime') } }), X.stop()), '', { vars: [['ts', 'turnSpeed', 'int'], ['tm', 'turnTime', 'int']] }) },
    pins: { name: 'Drive with the motor driver pins (L298N)', xml: () => X.prog(seq(
      B('dowee_comment', { f: { T: 'Left motor: IN1 (7) and IN2 (8) pick the direction, ENA (5) the speed' } }),
      B('dowee_dwrite', { v: { PIN: XB.pin('7'), V: XB.hl('HIGH') } }), B('dowee_dwrite', { v: { PIN: XB.pin('8'), V: XB.hl('LOW') } }), B('dowee_awrite', { v: { PIN: XB.pin('5'), V: 180 } }),
      B('dowee_comment', { f: { T: 'Right motor: IN3 (9) and IN4 (10) pick the direction, ENB (6) the speed' } }),
      B('dowee_dwrite', { v: { PIN: XB.pin('9'), V: XB.hl('HIGH') } }), B('dowee_dwrite', { v: { PIN: XB.pin('10'), V: XB.hl('LOW') } }), B('dowee_awrite', { v: { PIN: XB.pin('6'), V: 180 } }),
      X.wait(1.5), B('dowee_awrite', { v: { PIN: XB.pin('5'), V: 0 } }), B('dowee_awrite', { v: { PIN: XB.pin('6'), V: 0 } })), '') },
    tune: { name: 'Play a tune (tone)', xml: () => X.prog(X.tone(262, 300, X.wait(0.35, X.tone(330, 300, X.wait(0.35, X.tone(392, 300, X.wait(0.35, X.tone(523, 600))))))), '') },
  },
  line: {
    follow2: { name: 'Follow the line with 2 sensors', starter: true, xml: () => BX.follow2() },
    follow3: { name: 'Smoother: 3 sensors', xml: () => X.prog('', X.ifs([[X.black('A2'), X.move('F', 170)], [X.black('A1'), X.move('TL', 150)], [X.black('A3'), X.move('TR', 150)]])) },
    pfollow: { name: 'Steer by line position (P control)', xml: () => X.prog(X.set('vb', 'baseSpeed', 140), X.set('ve', 'error', X.linePos(), X.set('vt', 'turn', X.arith('MULTIPLY', X.get('ve', 'error'), 0.02), X.motors(X.arith('ADD', X.get('vb', 'baseSpeed'), X.get('vt', 'turn')), X.arith('MINUS', X.get('vb', 'baseSpeed'), X.get('vt', 'turn'))))), { vars: [['vb', 'baseSpeed', 'int'], ['ve', 'error', 'int'], ['vt', 'turn', 'float']] }) },
    pid: { name: 'PID line follower with calibration', xml: pidBlocks },
    print: { name: 'Print sensor values (for the Plotter)', xml: () => X.prog('', seq(
      XB.forI('i', 1, 5, seq(XB.print(XB.sensorN(X.get('i', 'i'))), X.ifs([[X.lt(X.get('i', 'i'), 5), XB.print(XB.text(','))]]))),
      X.print(XB.text('')), XB.ms(50)), { vars: [['i', 'i', '']] }) },
    blinkfollow: { name: 'Blink while following (every N ms)', xml: () => X.prog('', X.every(250, X.toggle(), X.ifs([[X.black('A1'), X.move('TL', 150)], [X.black('A3'), X.move('TR', 150)]], X.move('F', 150)))) },
  },
  maze: {
    avoid: { name: 'Avoid obstacles', starter: true, xml: () => X.prog('', X.ifs([[X.lt(X.dist(), 25), X.move('B', 160, X.wait(0.2, X.move('SL', 170, X.wait(0.4))))]], X.move('F', 200))) },
    cautious: { name: 'Slow down near walls (map)', xml: () => X.prog('', X.set('vd', 'd', X.dist(), X.ifs([[X.lt(X.get('vd', 'd'), 22), X.move('SL', 170, X.wait(0.35))]], X.move('F', `<block type="dowee_map"><value name="V"><block type="math_constrain"><value name="VALUE">${X.get('vd', 'd')}</value><value name="LOW">${X.num(20)}</value><value name="HIGH">${X.num(100)}</value></block></value><value name="FL">${X.num(20)}</value><value name="FH">${X.num(100)}</value><value name="TL">${X.num(110)}</value><value name="TH">${X.num(240)}</value></block>`))), { vars: [['vd', 'd', 'int']] }) },
  },
  sumo: {
    basic: { name: 'Sumo: stay in, find, push', starter: true, xml: () => X.prog(X.wait(5), X.ifs([[X.or(X.not(X.black('A0')), X.not(X.black('A4'))), X.move('B', 220, X.wait(0.3, X.move('SR', 200, X.wait(0.25))))], [X.lt(X.dist(), 60), X.move('F', 255)]], X.move('SL', 130))) },
  },
  race: {
    rc: { name: 'Bluetooth remote control', starter: true, xml: BX.rc },
    rcswitch: { name: 'Remote control with "check" (switch)', xml: () => X.prog('', X.ifs([[B('dowee_serial_has'), seq(
      X.set('cm', 'command', B('dowee_serial_read', { f: { OP: 'read' } })),
      B('dowee_switch', { v: { VALUE: X.get('cm', 'command') }, s: { CASES: seq(
        B('dowee_case', { f: { N: 'F' }, s: { DO: X.move('F', 220) } }), B('dowee_case', { f: { N: 'B' }, s: { DO: X.move('B', 220) } }),
        B('dowee_case', { f: { N: 'L' }, s: { DO: X.move('SL', 130) } }), B('dowee_case', { f: { N: 'R' }, s: { DO: X.move('SR', 130) } }),
        B('dowee_case', { f: { N: 'S' }, s: { DO: X.stop() } })) } }))]]), { vars: [['cm', 'command', 'int']] }) },
  },
  soccer: { rc: { name: 'Bluetooth remote control', starter: true, xml: BX.rc } },
};
const blockStarterOf = a => { const ex = BLOCK_EXAMPLES[a] || BLOCK_EXAMPLES.lab; return Object.keys(ex).find(k => ex[k].starter) || Object.keys(ex)[0]; };

/* ---------------- the Blocks lesson track ---------------- */
const BQ = {
  still: W => { const r = W.robots[0]; return Math.hypot(r.vx, r.vy) < 0.005 && Math.abs(r.w) < 0.02; },
  deg: W => Math.abs(W.robots[0].headingAcc * 180 / Math.PI),
  rate: (W, m, count, after = 1000, span = 2000) => { if (W.time < after) return null; if (m.t0 == null) { m.t0 = W.time; m.n0 = count(W); return null; } if (W.time - m.t0 < span) return null; return (count(W) - m.n0) / (W.time - m.t0) * 1000; },
  maxDist: (W, m) => { const r = W.robots[0]; m.max = Math.max(m.max || 0, Math.hypot(r.x - r.start.x, r.y - r.start.y)); return m.max; },
  onLine: ms => (W, m) => { const s = W.state, r = W.robots[0]; if (!s || !s.lap) return false; const ok = !s.lap.lost && s.lap.lastErr < 0.02 && Math.hypot(r.vx, r.vy) > 0.05; if (!ok) { m.since = null; return false; } if (m.since == null) m.since = W.time; return W.time - m.since >= ms; },
};
const BLOCK_STEPS = run => [run, 'Look at the code beside the blocks: click a block to see which lines it wrote.'];
const BLOCK_LESSONS = [
  { id: 'b-blink', title: 'Blocks 2: Blink forever', arena: 'lab', variant: 'lab', toolbox: 'beginner',
    intro: 'The <b>forever</b> block repeats everything inside it again and again, just like <code class="k">loop()</code> in Arduino code.',
    blocksXml: () => X.prog('', X.led('HIGH', X.wait(1, X.led('LOW', X.wait(1))))),
    steps: BLOCK_STEPS('Press <b>Upload &amp; run</b> and watch the light on Dowee\'s Arduino board.'),
    predict: { q: 'What will the light on Dowee do?', options: ['Blink on and off, again and again', 'Turn on once and stay on', 'Nothing at all'], answer: 0, why: 'Forever repeats: on, wait 1 second, off, wait 1 second, on again…' },
    investigate: [{ q: 'What does the <b>forever</b> block do?', options: ['Runs the blocks inside again and again', 'Runs them once', 'Waits forever'], answer: 0, why: 'Forever is the same as loop() in Arduino code.' }],
    modify: [
      { text: 'Make it blink <b>faster</b>: use smaller waits.', check: (W, m) => { const r = BQ.rate(W, m, W => W.robots[0].board.ledToggles); return r != null && r >= 1.8; } },
      { text: 'Make it blink <b>super fast</b>: about 5 blinks every second.', check: (W, m) => { const r = BQ.rate(W, m, W => W.robots[0].board.ledToggles); return r != null && r >= 8; } },
    ],
    goal: 'Blink the LED 10 times', check: W => W.robots[0].board.ledToggles >= 20 },
  { id: 'b-square', title: 'Blocks 3: Drive a square (repeat)', arena: 'lab', variant: 'lab', toolbox: 'beginner',
    intro: 'A square is 4 times the same thing: drive a side, then turn a corner. The <b>repeat</b> block does that for you.',
    blocksXml: () => X.prog(X.repeat(2, X.move('F', 180, X.wait(1, X.move('SR', 150, X.wait(0.3)))), X.stop()), ''),
    steps: BLOCK_STEPS('Press <b>Upload &amp; run</b>. Turn on <b>Trail</b> in the View menu to see the path.'),
    predict: { q: 'Look at the number in the <b>repeat</b> block. What will Dowee drive?', options: ['Half a square (2 sides)', 'A whole square', 'A circle'], answer: 0, why: 'repeat 2 times: 2 sides and 2 corners. A square needs 4.' },
    investigate: [{ q: 'Which blocks happen again on every trip round the repeat?', options: ['The ones inside it', 'All the blocks', 'Only the stop block'], answer: 0, why: 'Only the blocks inside the repeat\'s mouth are repeated. Stop runs once, after it.' }],
    modify: [
      { text: 'Make it a whole square: change the repeat to <b>4</b>.', check: W => BQ.deg(W) > 330 && BQ.still(W) && W.time > 2000 },
      { text: 'Make a <b>bigger</b> square: drive longer on each side.', check: (W, m) => BQ.maxDist(W, m) > 0.85 && BQ.deg(W) > 330 },
    ],
    goal: 'Turn 360° (±25°) in total and stop', check: W => W.time > 2000 && BQ.still(W) && Math.abs(BQ.deg(W) - 360) < 25 },
  { id: 'b-count', title: 'Blocks 4: Count with a variable', arena: 'lab', variant: 'lab', toolbox: 'beginner',
    intro: 'A <b>variable</b> is a box with a name that holds a number. Here the box is called <b>count</b>.',
    blocksXml: () => X.prog(X.set('vc', 'count', 1), X.print(X.get('vc', 'count'), X.change('vc', 'count', 1, X.wait(1))), { vars: [['vc', 'count', 'int']] }),
    steps: BLOCK_STEPS('Press <b>Upload &amp; run</b> and open the <b>Serial</b> tab.'),
    predict: { q: 'What will the Serial monitor show?', options: ['1, 2, 3, 4 … counting up', '1, 1, 1, 1 …', 'Nothing'], answer: 0, why: 'Every trip round forever prints count, then adds 1 to it.' },
    investigate: [{ q: 'What does <b>change count by 1</b> do?', options: ['Adds 1 to the number in count', 'Sets count to 1', 'Prints 1'], answer: 0, why: 'In the code it becomes <code class="k">count += 1;</code>' }],
    modify: [{ text: 'Count <b>faster</b>: 4 numbers a second.', check: (W, m) => { const r = BQ.rate(W, m, W => W.robots[0].board.serialLines, 500, 2000); return r != null && r >= 3.5; } }],
    goal: 'Count to 10 and then stop counting (Serial shows exactly 10 numbers)', check: W => W.time > 12000 && W.robots[0].board.serialLines === 10 },
  { id: 'b-follow', title: 'Blocks 5: Follow the line with if / else', arena: 'line', variant: 'oval', toolbox: 'beginner',
    intro: 'An <b>if</b> block asks a question. If the answer is yes, it runs the blocks inside. <b>else</b> is for when the answer is no.',
    blocksXml: () => X.prog('', X.move('F', 150)),
    steps: BLOCK_STEPS('Press <b>Upload &amp; run</b> on the Oval.'),
    predict: { q: 'There is no <b>if</b> yet, only drive forward. What will Dowee do?', options: ['Drive straight off the line', 'Follow the line', 'Spin'], answer: 0, why: 'Nothing looks at the sensors, so Dowee never turns.' },
    investigate: [{ q: 'Sensor 2 (left) sees black. Which way should Dowee turn?', options: ['Left, towards the line', 'Right', 'Straight on'], answer: 0, why: 'The line is on the left, so turning left brings Dowee back to it.' }],
    modify: [{ text: 'Use <b>if</b> / <b>else if</b> / <b>else</b> with sensors 2 and 4 so Dowee stays on the line for 5 seconds.', check: BQ.onLine(5000) }],
    goal: 'Complete one full lap', check: W => W.state.laps && W.state.laps.length >= 1 },
  { id: 'b-avoid', title: 'Blocks 6: Don\'t bump (distance and if)', arena: 'maze', variant: 'room1', toolbox: 'beginner',
    intro: 'The ultrasonic sensor sends out a beep too high to hear and times the echo. The <b>distance in cm</b> block gives the answer.',
    blocksXml: () => X.prog('', X.move('F', 200)),
    steps: BLOCK_STEPS('Press <b>Upload &amp; run</b>. Turn on <b>Sensor view</b> in the View menu to see the sound beam.'),
    predict: { q: 'Dowee only drives forward. What happens at the wall?', options: ['It bumps into the wall', 'It stops just before', 'It turns away'], answer: 0, why: 'Nothing checks the distance, so Dowee keeps going.' },
    investigate: [{ q: 'Which block can tell Dowee a wall is close?', options: ['distance in cm &lt; 25', 'wait 1 seconds', 'turn LED on'], answer: 0, why: 'distance in cm gets smaller as Dowee gets closer to the wall.' }],
    modify: [{ text: 'Add an <b>if</b>: when the distance is less than 25, turn away. Drive 1.5 m without a bump.', check: W => W.robots[0].odo > 1.5 && !W.bumps && Math.abs(W.robots[0].headingAcc) > 1 }],
    goal: 'Drive 3 metres in total without bumping into anything', check: W => W.robots[0].odo > 3 && !W.bumps },
  { id: 'b-rc', title: 'Blocks 7: Bluetooth remote', arena: 'race', variant: 'none', toolbox: 'beginner',
    intro: 'Your keyboard (or a phone) sends a letter over Bluetooth: F for forward, B for back, L and R to turn, S to stop.',
    blocksXml: () => X.prog('', X.btRead(X.ifs([[X.bt('F'), X.move('F', 220)], [X.bt('S'), X.stop()]]))),
    steps: BLOCK_STEPS('Press <b>Upload &amp; run</b> and drive with the arrow keys (or W A S D).'),
    predict: { q: 'Only F and S are handled. You press the <b>down</b> arrow. What happens?', options: ['Nothing changes', 'Dowee drives backwards', 'Dowee spins'], answer: 0, why: 'No if asks about the letter B yet.' },
    investigate: [{ q: 'Which letter arrives when you let go of all the keys?', options: ['S', 'F', 'Nothing'], answer: 0, why: 'Open the Serial tab and watch. S means stop.' }],
    modify: [
      { text: 'Add <b>B</b>: drive backwards.', check: W => forwardOf(W.robots[0]) < -0.2 },
      { text: 'Add <b>L</b> and <b>R</b>: spin left and right.', check: (W, m) => { const h = W.robots[0].headingAcc; m.lo = Math.min(m.lo ?? 0, h); m.hi = Math.max(m.hi ?? 0, h); return m.hi - m.lo > 3; } },
    ],
    goal: 'Drive 1 metre forward, then stop', check: W => forwardOf(W.robots[0]) > 1 && Math.hypot(W.robots[0].vx, W.robots[0].vy) < 0.005 },
  { id: 'b-func', title: 'Blocks 8: Make your own block', arena: 'lab', variant: 'lab', toolbox: 'full',
    intro: 'A <b>function</b> is a block you make yourself. Give a few blocks a name, then use that name as one block, as often as you like.',
    blocksXml: () => X.prog(X.move('F', 180, X.wait(1, X.call('turnAround', X.stop()))), '', { extra: X.defn('turnAround', X.move('SR', 150, X.wait(0.62, X.stop()))) }),
    steps: BLOCK_STEPS('Press <b>Upload &amp; run</b>. Find the purple <b>to turnAround</b> block: that is the function.'),
    predict: { q: 'What will Dowee do?', options: ['Drive forward, then turn round', 'Only turn round', 'Only drive forward'], answer: 0, why: 'The start blocks drive forward, then call turnAround.' },
    investigate: [{ q: 'In the Arduino code, what did <b>to turnAround</b> become?', options: ['<code class="k">void turnAround() { … }</code>', '<code class="k">int turnAround = 0;</code>', 'Nothing'], answer: 0, why: 'A function in Arduino code starts with void, then its name and ().' }],
    modify: [{ text: 'Drive back to the start: after turnAround, drive forward again for the same time.', check: W => W.robots[0].odo > 0.8 && Math.hypot(W.robots[0].x - W.robots[0].start.x, W.robots[0].y - W.robots[0].start.y) < 0.2 && BQ.still(W) }],
    goal: 'Use turnAround twice: turn at least 360° in total', check: W => BQ.deg(W) > 340 && BQ.still(W) },
  { id: 'b-every', title: 'Blocks 9: Two things at once (every … ms)', arena: 'line', variant: 'oval', toolbox: 'full',
    intro: 'While a <b>wait</b> block waits, Dowee does nothing else. The <b>every … ms</b> block checks the clock instead, so Dowee can follow the line <i>and</i> blink.',
    blocksXml: () => X.prog('', X.led('HIGH', X.wait(0.5, X.led('LOW', X.wait(0.5, X.ifs([[X.black('A1'), X.move('TL', 150)], [X.black('A3'), X.move('TR', 150)]], X.move('F', 150))))))),
    steps: BLOCK_STEPS('Press <b>Upload &amp; run</b> on the Oval.'),
    predict: { q: 'The light blinks with wait blocks. What happens to the line following?', options: ['Dowee misses the turns', 'It follows perfectly', 'Dowee stops'], answer: 0, why: 'During each wait Dowee keeps driving without looking at the line.' },
    investigate: [{ q: 'What does <b>every 500 ms</b> do?', options: ['Runs its blocks when 500 ms have passed, without waiting', 'Waits 500 ms', 'Repeats 500 times'], answer: 0, why: 'It checks millis() each time round forever, and only runs when it is time.' }],
    modify: [{ text: 'Swap the waits for an <b>every 500 ms</b> block with <b>toggle the LED</b> inside.', check: W => W.robots[0].board.ledToggles >= 6 && W.state.lap && !W.state.lap.lost && W.state.lap.progress() > 0.4 }],
    goal: 'Lap the Oval while the LED blinks', check: W => W.state.laps && W.state.laps.length >= 1 && W.robots[0].board.ledToggles >= 10 },
  { id: 'b-tocode', title: 'Blocks 10: From blocks to code', arena: 'line', variant: 'oval', toolbox: 'full',
    intro: 'Every block is already Arduino code. Now you change the code itself: press <b>Turn into code</b> in the code bar\'s ⋯ menu. Your blocks are kept, so you can go back any time.',
    blocksXml: () => X.prog(X.set('vs', 'speed', 150), X.ifs([[X.black('A1'), X.move('TL', X.get('vs', 'speed'))], [X.black('A3'), X.move('TR', X.get('vs', 'speed'))]], X.move('F', X.get('vs', 'speed'))), { vars: [['vs', 'speed', 'int']] }),
    steps: ['Run the blocks once on the Oval.', 'Open the ⋯ menu and press <b>Turn into code</b>.', 'Find <code class="k">int speed = 0;</code> and the line that sets speed in setup(). Make speed bigger, for example 170.', 'Press <b>Upload &amp; run</b>.'],
    predict: { q: 'When you press <b>Turn into code</b>, what happens to your blocks?', options: ['They are kept: you can switch back to Blocks', 'They are deleted', 'They turn into a picture'], answer: 0, why: 'Code and blocks are saved separately. Switch back with the Blocks button.' },
    investigate: [{ q: 'Your <b>drive forward at speed</b> block. What is it in the code?', options: ['<code class="k">drive(speed, speed);</code>', '<code class="k">delay(speed);</code>', '<code class="k">digitalWrite(13, HIGH);</code>'], answer: 0, why: 'drive(left, right) sets both wheels. Forward means both get the same speed.' }],
    modify: [{ text: 'In the typed code, make <code class="k">speed</code> bigger and lap the Oval in under 25 seconds.', check: W => W.state.laps && W.state.laps.some(l => l.time < 25) }],
    goal: 'Lap the Oval in under 24 seconds', check: W => W.state.laps && W.state.laps.some(l => l.time < 24) },
];
for (const L of BLOCK_LESSONS) LESSONS.push({ ...L, level: 'Blocks', blocks: true });
{
  const first = LESSONS.find(l => l.id === 'blocks');
  if (first) { first.title = 'Blocks 1: Your first blocks program'; first.toolbox = 'beginner'; first.blocksXml = BLOCK_EXAMPLES.lab.meter.xml; first.steps = first.steps.map(s => s.replace('Open <b>Arduino code made by your blocks</b> to see the code your blocks wrote.', 'Click a block: its lines light up in the Arduino code beside the blocks.').replace('press <b>Turn into code</b>', 'press <b>Turn into code</b> in the ⋯ menu')); }
  const start = LESSON_PATH.find(p => p.name === 'Start here');
  if (start) { start.ids = start.ids.filter(id => id !== 'blocks'); start.about = 'Your first typed Arduino program: a blinking light.'; }
  LESSON_PATH.unshift({ name: 'Blocks', about: 'Snap blocks together. Every block is real Arduino code, shown beside it. Best for ages 9–12.', ids: ['blocks', ...BLOCK_LESSONS.map(l => l.id)] });
}
if (typeof module !== 'undefined') Object.assign(module.exports, { X, BLOCK_EXAMPLES, BLOCK_LESSONS, blockStarterOf });
