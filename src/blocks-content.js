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
    ['ts', 'int'], ['tm', 'int'], ['cm', 'int'], ['tx', 'String'], ['sp', 'int'], ['pe', 'float'],
    ['ki', 'float'], ['smp', 'int'], ['sb', 'int'], ['ol', 'list'], ['sn', 'int'], ['ps', 'float'], ['ig', 'float'], ['ls', 'int'], ['lp', 'long'], ['wl', 'long'], ['tl', 'long'],
    ['lf', 'int'], ['rt', 'int'], ['el', 'int'], ['ar', 'int'], ['ss', 'int'], ['dl', 'long'], ['sd', 'int'], ['cr', 'int'], ['dt', 'int'], ['ch', 'int']]),
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
// Type commands in the Serial monitor: "go 150", "back 120", "stop", "led on", "led off". Uses the text blocks.
function commandBlocks() {
  const cmd = () => X.get('tx', 'command'), t = XB.text;
  const starts = s => B('dowee_text_compare', { f: { OP: 'startsWith' }, v: { A: cmd(), B: t(s) } });
  const same = s => B('dowee_text_compare', { f: { OP: 'equals' }, v: { A: cmd(), B: t(s) } });
  const numberAfter = k => B('dowee_text_num', { f: { OP: 'toInt' }, v: { T: B('dowee_text_sub', { v: { A: k, B: B('dowee_text_length', { v: { T: cmd() } }), T: cmd() } }) } });
  const join = (a, b) => `<block type="text_join"><mutation items="2"></mutation><value name="ADD0">${a}</value><value name="ADD1">${b}</value></block>`;
  return X.prog(X.print(t('Type a command: go 150, back 120, stop, led on, led off')),
    X.ifs([[B('dowee_serial_has'), seq(
      X.set('tx', 'command', B('dowee_serial_text', { f: { OP: 'line' } })),
      X.ifs([
        [starts('go '), seq(X.set('sp', 'speed', numberAfter(4)), X.move('F', X.get('sp', 'speed')), X.print(join(t('Going forward at '), X.get('sp', 'speed'))))],
        [starts('back '), seq(X.set('sp', 'speed', numberAfter(6)), X.move('B', X.get('sp', 'speed')), X.print(join(t('Going back at '), X.get('sp', 'speed'))))],
        [same('stop'), seq(X.stop(), X.print(t('Stopped')))],
        [same('led on'), X.led('HIGH')],
        [same('led off'), X.led('LOW')]],
        X.print(join(t('I don\'t know this command: '), cmd()))))]]),
    { vars: [['tx', 'command', 'String'], ['sp', 'speed', 'int']] });
}
// Complete block translations of the text samples (same variables, same steps, same behaviour).
// tools/blocks-check.js runs each next to its text sample (SAME) and checks they do the same thing.
const neg = x => B('math_single', { f: { OP: 'NEG' }, v: { NUM: x } });
const idiv = (a, b) => B('dowee_intdiv', { v: { A: a, B: b } });
const and2 = (a, b) => `<block type="logic_operation"><field name="OP">AND</field><value name="A">${a}</value><value name="B">${b}</value></block>`;
const FULL = {
  // lab/meter: drive for driveTime ms at speed, then stop and say "Done!"
  meter: () => X.prog(seq(X.set('sp', 'speed', 180), X.set('dt', 'driveTime', 1500), X.led('HIGH'), X.motors(X.get('sp', 'speed'), X.get('sp', 'speed')),
    B('dowee_wait_ms', { v: { MS: X.get('dt', 'driveTime') } }), X.stop(), X.led('LOW'), X.print(XB.text('Done!'))), '', { vars: [['sp', 'speed', 'int'], ['dt', 'driveTime', 'int']] }),
  // line/bang: the two middle sensors against the threshold
  bang: () => {
    const sees = pin => B('logic_ternary', { v: { IF: X.black(pin), THEN: 1, ELSE: 0 } }), eq = (id, nm, v) => X.cmp('EQ', X.get(id, nm), v), sp = () => X.get('sp', 'speed');
    return X.prog(X.set('sp', 'speed', 150), seq(
      X.set('lf', 'left', sees('A1')), X.set('rt', 'right', sees('A3')),
      X.ifs([[and2(eq('lf', 'left', 1), eq('rt', 'right', 0)), X.motors(0, sp())], [and2(eq('rt', 'right', 1), eq('lf', 'left', 0)), X.motors(sp(), 0)]], X.motors(sp(), sp()))),
      { vars: [['sp', 'speed', 'int'], ['lf', 'left', 'int'], ['rt', 'right', 'int']] });
  },
  // race/rc and soccer/rc: switch on the letter, speed keys 0-9 and q
  rc: () => {
    const sp = () => X.get('sp', 'speed'), cmd = () => X.get('ch', 'cmd'), L = c => B('dowee_char', { f: { L: c } });
    const is = (c, body) => B('dowee_case', { f: { N: c }, s: { DO: body } });
    return X.prog(X.set('sp', 'speed', 220), X.ifs([[B('dowee_serial_has'), seq(
      X.set('ch', 'cmd', B('dowee_serial_read', { f: { OP: 'read' } })),
      B('dowee_switch', { v: { VALUE: cmd() }, s: { CASES: seq(
        is('F', X.motors(sp(), sp())), is('B', X.motors(neg(sp()), neg(sp()))),
        is('L', X.motors(neg(idiv(sp(), 2)), idiv(sp(), 2))), is('R', X.motors(idiv(sp(), 2), neg(idiv(sp(), 2)))),
        is('G', X.motors(idiv(sp(), 3), sp())), is('I', X.motors(sp(), idiv(sp(), 3))),
        is('H', X.motors(neg(idiv(sp(), 3)), neg(sp()))), is('J', X.motors(neg(sp()), neg(idiv(sp(), 3)))),
        is('S', X.stop()), is('q', X.set('sp', 'speed', 255)),
        B('dowee_case_default', { s: { DO: X.ifs([[and2(X.cmp('GTE', cmd(), L('0')), X.cmp('LTE', cmd(), L('9'))),
          X.set('sp', 'speed', B('dowee_map', { v: { V: X.arith('MINUS', cmd(), L('0')), FL: 0, FH: 9, TL: 60, TH: 240 } }))]]) } })) } }))]]),
      { vars: [['sp', 'speed', 'int'], ['ch', 'cmd', 'int']] });
  },
  // sumo/basic: wait 5 s blinking, back away from the edge, charge when close, else spin to search
  sumo: () => {
    const g = (id, nm) => X.get(id, nm), lim = () => g('el', 'edgeLimit');
    return X.prog(seq(X.set('el', 'edgeLimit', 400), X.set('ar', 'attackRange', 70), X.set('ss', 'searchSpeed', 130),
      B('dowee_comment', { f: { T: 'Sumo rule: wait 5 seconds after the start. Blink while waiting.' } }),
      X.repeat(5, seq(X.led('HIGH'), X.wait(0.5), X.led('LOW'), X.wait(0.5)))),
    seq(X.set('lf', 'left', B('dowee_sensor', { f: { PIN: 'A0' } })), X.set('rt', 'right', B('dowee_sensor', { f: { PIN: 'A4' } })),
      X.ifs([[X.or(X.lt(g('lf', 'left'), lim()), X.lt(g('rt', 'right'), lim())), seq(
        X.motors(-220, -220), XB.ms(250), X.ifs([[X.lt(g('lf', 'left'), lim()), X.motors(200, -200)]], X.motors(-200, 200)), XB.ms(220))]],
      seq(X.set('dl', 'd', X.dist()), X.ifs([[X.lt(g('dl', 'd'), g('ar', 'attackRange')), seq(X.led('HIGH'), X.motors(255, 255))]],
        seq(X.led('LOW'), X.motors(g('ss', 'searchSpeed'), neg(g('ss', 'searchSpeed')))))))),
    { vars: [['el', 'edgeLimit', 'int'], ['ar', 'attackRange', 'int'], ['ss', 'searchSpeed', 'int'], ['lf', 'left', 'int'], ['rt', 'right', 'int'], ['dl', 'd', 'long']] });
  },
  // maze/avoid: print the distance, back up and turn left for a random time when something is close
  avoid: () => {
    const g = (id, nm) => X.get(id, nm);
    return X.prog(seq(X.set('sd', 'safeDistance', 25), X.set('cr', 'cruise', 200)), seq(
      X.set('dl', 'd', X.dist()), X.print(g('dl', 'd')),
      X.ifs([[X.lt(g('dl', 'd'), g('sd', 'safeDistance')), seq(X.motors(-150, -150), XB.ms(200), X.motors(-170, 170),
        B('dowee_wait_ms', { v: { MS: B('math_random_int', { v: { FROM: 250, TO: 499 } }) } }))]], X.motors(g('cr', 'cruise'), g('cr', 'cruise'))),
      XB.ms(30)), { vars: [['sd', 'safeDistance', 'int'], ['cr', 'cruise', 'int'], ['dl', 'd', 'long']] });
  },
};
// The PID line follower: the same program as the text example (line/pid), made of blocks.
// "calibrate the line sensors", "read the line sensors", "line position" and "sensor … is on the line" write the same code as the text.
function pidBlocks() {
  const g = (id, nm) => X.get(id, nm), set = (id, nm, v) => X.set(id, nm, v);
  const L = c => B('dowee_char', { f: { L: c } }), eq = (a, b) => X.cmp('EQ', a, b), and2 = (a, b) => XB.and(a, b);
  const on = pin => B('dowee_on_line', { f: { PIN: pin } }), not = x => X.not(x), read = () => B('dowee_read_line');
  const err = () => X.arith('MINUS', B('dowee_line_pos'), 3), ts = () => g('ts', 'turnSpeed');
  return X.prog(
    seq(set('kp', 'Kp', 70), set('ki', 'Ki', 0), set('kd', 'Kd', 1000), set('bs', 'baseSpeed', 240), set('ts', 'turnSpeed', 140), set('ls', 'lostSide', L('s')), B('dowee_calibrate')),
    seq(read(),
      // remember which edge sensor saw the line last
      X.ifs([[and2(on('A0'), not(on('A4'))), set('ls', 'lostSide', L('l'))]]),
      X.ifs([[and2(on('A4'), not(on('A0'))), set('ls', 'lostSide', L('r'))]]),
      // line lost (a sharp corner): spin on the spot towards where it was last seen, until a middle sensor finds it
      X.ifs([[and2(eq(B('dowee_line_seen'), 0), X.cmp('NEQ', g('ls', 'lostSide'), L('s'))), seq(
        X.ifs([[eq(g('ls', 'lostSide'), L('r')), X.motors(ts(), neg(ts()))]], X.motors(neg(ts()), ts())),
        B('controls_whileUntil', { f: { MODE: 'WHILE' }, v: { BOOL: and2(and2(not(on('A1')), not(on('A2'))), not(on('A3'))) }, s: { DO: read() } }),
        set('le', 'lastError', err()))]]),
      set('er', 'error', err()),
      set('ig', 'integral', B('math_constrain', { v: { VALUE: X.arith('ADD', g('ig', 'integral'), g('er', 'error')), LOW: -40, HIGH: 40 } })),
      set('tu', 'turn', X.arith('ADD', X.arith('ADD', X.arith('MULTIPLY', g('kp', 'Kp'), g('er', 'error')), X.arith('MULTIPLY', g('ki', 'Ki'), g('ig', 'integral'))),
        X.arith('MULTIPLY', g('kd', 'Kd'), X.arith('MINUS', g('er', 'error'), g('le', 'lastError'))))),
      set('le', 'lastError', g('er', 'error')),
      X.motors(X.arith('ADD', g('bs', 'baseSpeed'), g('tu', 'turn')), X.arith('MINUS', g('bs', 'baseSpeed'), g('tu', 'turn'))),
      B('dowee_wait_ms', { v: { MS: 10 } })),
    { vars: [['kp', 'Kp', 'float'], ['ki', 'Ki', 'float'], ['kd', 'Kd', 'float'], ['bs', 'baseSpeed', 'int'], ['ts', 'turnSpeed', 'int'], ['ls', 'lostSide', 'int'],
      ['le', 'lastError', 'float'], ['ig', 'integral', 'float'], ['er', 'error', 'float'], ['tu', 'turn', 'float']] });
}
const BX = {
  rc: () => X.prog('', X.btRead(X.ifs([[X.bt('F'), X.move('F', 220)], [X.bt('B'), X.move('B', 220)], [X.bt('L'), X.move('SL', 130)], [X.bt('R'), X.move('SR', 130)], [X.bt('G'), X.move('TL', 220)], [X.bt('I'), X.move('TR', 220)], [X.bt('S'), X.stop()]]))),
  follow2: (s = 150) => X.prog('', X.ifs([[X.black('A1'), X.move('TL', s)], [X.black('A3'), X.move('TR', s)]], X.move('F', s))),
};
// Example programs per playground. `starter` is the one classroom students always get.
const BLOCK_EXAMPLES = {
  lab: {
    meterfull: { name: 'Drive 1 metre, then stop', xml: FULL.meter },
    meter: { name: 'Drive 1 metre and stop (simple)', starter: true, xml: () => X.prog(X.led('HIGH', X.move('F', 180, X.wait(1.5, X.stop(X.led('LOW'))))), '') },
    blink: { name: 'Blink the light', xml: () => X.prog('', X.led('HIGH', X.wait(0.5, X.led('LOW', X.wait(0.5))))) },
    square: { name: 'Drive a square (repeat)', xml: () => X.prog(X.repeat(4, X.move('F', 180, X.wait(1, X.move('SR', 150, X.wait(0.3)))), X.stop()), '') },
    count: { name: 'Count in the Serial monitor (variable)', xml: () => X.prog(X.set('vc', 'count', 1), X.print(X.get('vc', 'count'), X.change('vc', 'count', 1, X.wait(0.5))), { vars: [['vc', 'count', 'int']] }) },
    turn: { name: 'Turn 90 degrees', xml: () => X.prog(seq(X.set('ts', 'turnSpeed', 150), X.set('tm', 'turnTime', 400),
      X.motors(X.get('ts', 'turnSpeed'), B('math_single', { f: { OP: 'NEG' }, v: { NUM: X.get('ts', 'turnSpeed') } })), B('dowee_wait_ms', { v: { MS: X.get('tm', 'turnTime') } }), X.stop()), '', { vars: [['ts', 'turnSpeed', 'int'], ['tm', 'turnTime', 'int']] }) },
    commands: { name: 'Type commands in the Serial monitor (text)', xml: commandBlocks },
    pins: { name: 'Drive with the motor driver pins (L298N)', xml: () => X.prog(seq(
      B('dowee_comment', { f: { T: 'Left motor: IN1 (7) and IN2 (8) pick the direction, ENA (5) the speed' } }),
      B('dowee_dwrite', { v: { PIN: XB.pin('7'), V: XB.hl('HIGH') } }), B('dowee_dwrite', { v: { PIN: XB.pin('8'), V: XB.hl('LOW') } }), B('dowee_awrite', { v: { PIN: XB.pin('5'), V: 180 } }),
      B('dowee_comment', { f: { T: 'Right motor: IN3 (9) and IN4 (10) pick the direction, ENB (6) the speed' } }),
      B('dowee_dwrite', { v: { PIN: XB.pin('9'), V: XB.hl('HIGH') } }), B('dowee_dwrite', { v: { PIN: XB.pin('10'), V: XB.hl('LOW') } }), B('dowee_awrite', { v: { PIN: XB.pin('6'), V: 180 } }),
      X.wait(1.5), B('dowee_awrite', { v: { PIN: XB.pin('5'), V: 0 } }), B('dowee_awrite', { v: { PIN: XB.pin('6'), V: 0 } })), '') },
    tune: { name: 'Play a tune (tone)', xml: () => X.prog(X.tone(262, 300, X.wait(0.35, X.tone(330, 300, X.wait(0.35, X.tone(392, 300, X.wait(0.35, X.tone(523, 600))))))), '') },
  },
  line: {
    follow2: { name: 'Follow the line with 2 sensors (simple)', starter: true, xml: () => BX.follow2() },
    bang: { name: 'Simple 2-sensor follower', xml: FULL.bang },
    follow3: { name: 'Smoother: 3 sensors', xml: () => X.prog('', X.ifs([[X.black('A2'), X.move('F', 170)], [X.black('A1'), X.move('TL', 150)], [X.black('A3'), X.move('TR', 150)]])) },
    pfollow: { name: 'Steer by line position (P control)', xml: () => X.prog(X.set('vb', 'baseSpeed', 150), seq(
      X.set('pe', 'error', X.arith('MINUS', X.linePos(), 3)),
      X.set('vt', 'turn', X.arith('MULTIPLY', X.get('pe', 'error'), 15)),
      X.motors(X.arith('ADD', X.get('vb', 'baseSpeed'), X.get('vt', 'turn')), X.arith('MINUS', X.get('vb', 'baseSpeed'), X.get('vt', 'turn'))),
      B('dowee_wait_ms', { v: { MS: 10 } })), { vars: [['vb', 'baseSpeed', 'int'], ['pe', 'error', 'float'], ['vt', 'turn', 'float']] }) },
    pid: { name: 'PID line follower with calibration', xml: pidBlocks },
    print: { name: 'Print sensor values (for the Plotter)', xml: () => X.prog('', seq(
      XB.forI('i', 1, 5, seq(XB.print(XB.sensorN(X.get('i', 'i'))), X.ifs([[X.lt(X.get('i', 'i'), 5), XB.print(XB.text(','))]]))),
      X.print(XB.text('')), XB.ms(50)), { vars: [['i', 'i', '']] }) },
    blinkfollow: { name: 'Blink while following (every N ms)', xml: () => X.prog('', X.every(250, X.toggle(), X.ifs([[X.black('A1'), X.move('TL', 150)], [X.black('A3'), X.move('TR', 150)]], X.move('F', 150)))) },
  },
  maze: {
    avoidfull: { name: 'Avoid obstacles with ultrasonic', xml: FULL.avoid },
    avoid: { name: 'Avoid obstacles (simple)', starter: true, xml: () => X.prog('', X.ifs([[X.lt(X.dist(), 25), X.move('B', 160, X.wait(0.2, X.move('SL', 170, X.wait(0.4))))]], X.move('F', 200))) },
    cautious: { name: 'Slow down near walls (map)', xml: () => X.prog('', X.set('vd', 'd', X.dist(), X.ifs([[X.lt(X.get('vd', 'd'), 22), X.move('SL', 170, X.wait(0.35))]], X.move('F', `<block type="dowee_map"><value name="V"><block type="math_constrain"><value name="VALUE">${X.get('vd', 'd')}</value><value name="LOW">${X.num(20)}</value><value name="HIGH">${X.num(100)}</value></block></value><value name="FL">${X.num(20)}</value><value name="FH">${X.num(100)}</value><value name="TL">${X.num(110)}</value><value name="TH">${X.num(240)}</value></block>`))), { vars: [['vd', 'd', 'int']] }) },
  },
  sumo: {
    full: { name: 'Sumo: search, attack, stay in', xml: FULL.sumo },
    basic: { name: 'Sumo: stay in, find, push (simple)', starter: true, xml: () => X.prog(X.wait(5), X.ifs([[X.or(X.not(X.black('A0')), X.not(X.black('A4'))), X.move('B', 220, X.wait(0.3, X.move('SR', 200, X.wait(0.25))))], [X.lt(X.dist(), 60), X.move('F', 255)]], X.move('SL', 130))) },
  },
  race: {
    rc: { name: 'Bluetooth remote control (simple)', starter: true, xml: BX.rc },
    rcfull: { name: 'Bluetooth RC car', xml: FULL.rc },
    rcswitch: { name: 'Remote control with "check" (switch)', xml: () => X.prog('', X.ifs([[B('dowee_serial_has'), seq(
      X.set('cm', 'command', B('dowee_serial_read', { f: { OP: 'read' } })),
      B('dowee_switch', { v: { VALUE: X.get('cm', 'command') }, s: { CASES: seq(
        B('dowee_case', { f: { N: 'F' }, s: { DO: X.move('F', 220) } }), B('dowee_case', { f: { N: 'B' }, s: { DO: X.move('B', 220) } }),
        B('dowee_case', { f: { N: 'L' }, s: { DO: X.move('SL', 130) } }), B('dowee_case', { f: { N: 'R' }, s: { DO: X.move('SR', 130) } }),
        B('dowee_case', { f: { N: 'S' }, s: { DO: X.stop() } })) } }))]]), { vars: [['cm', 'command', 'int']] }) },
  },
  soccer: { rc: { name: 'Bluetooth remote control (simple)', starter: true, xml: BX.rc }, rcfull: { name: 'Bluetooth RC (soccer)', xml: FULL.rc } },
};
/* ---------------- block versions of the line lessons (the line follower seminar) ----------------
   Each lesson gets a block starter with the same TODOs as its text starter (as 💬 comment blocks), and the
   finished program. Programs that build their own calibrate() and readLine() use the same names as the text
   (minV, maxV, threshold, onLine, seen, position), so the lesson goals and the Advanced PID guide can read them.
   tools/blocks-check.js: every starter misses the goal, every solution reaches it and matches its text solution. */
const LB = (() => {
  [['qmn', 'list'], ['qmx', 'list'], ['qth', 'int'], ['qon', 'list'], ['qse', 'int'], ['qpo', 'float'], ['qsu', 'int'], ['qv', 'int'], ['qst', 'long'],
    ['qws', 'long'], ['qbs', 'long'], ['qaw', 'int'], ['qab', 'int'], ['qer', 'float'], ['qch', 'float'], ['qtu', 'float'], ['qle', 'float'], ['qkp', 'float'],
    ['qki', 'float'], ['qkd', 'float'], ['qsp', 'int'], ['qts', 'int'], ['qls', 'int'], ['qig', 'float'], ['qil', 'float'], ['qt', 'long'], ['qwe', 'long'], ['qto', 'long'], ['qdk', 'long']]
    .forEach(([id, t]) => X.vt.set(id, t));
  const VARS = { minV: ['qmn', 'list'], maxV: ['qmx', 'list'], threshold: ['qth', 'int'], onLine: ['qon', 'list'], seen: ['qse', 'int'], position: ['qpo', 'float'], sum: ['qsu', 'int'],
    v: ['qv', 'int'], start: ['qst', 'long'], whiteSum: ['qws', 'long'], blackSum: ['qbs', 'long'], avgWhite: ['qaw', 'int'], avgBlack: ['qab', 'int'], error: ['qer', 'float'],
    change: ['qch', 'float'], turn: ['qtu', 'float'], lastError: ['qle', 'float'], Kp: ['qkp', 'float'], Ki: ['qki', 'float'], Kd: ['qkd', 'float'], baseSpeed: ['qsp', 'int'],
    turnSpeed: ['qts', 'int'], lostSide: ['qls', 'int'], integral: ['qig', 'float'], iLimit: ['qil', 'float'], t: ['qt', 'long'], weighted: ['qwe', 'long'], total: ['qto', 'long'], dark: ['qdk', 'long'], i: ['i', ''] };
  const id = n => VARS[n][0];
  const g = n => X.get(id(n), n), set = (n, x) => X.set(id(n), n, x);
  const add = (n, x) => B('dowee_var_change', { f: { VAR: X.f(id(n), n) }, v: { DELTA: x } });
  const item = (n, i = g('i')) => XB.item(id(n), n, i), setItem = (n, i, x) => XB.setItem(id(n), n, i, x);
  const fill = (n, items) => B('dowee_list_fill', { f: { VAR: X.f(id(n), n), ITEMS: items } });
  const todo = t => B('dowee_comment', { f: { T: t } });
  const A = (op, a, b) => X.arith(op, a, b), cmp = X.cmp, ms = n => XB.ms(n);
  const forEachSensor = body => XB.forI('i', 1, 5, body);
  const whileDo = (c, body) => B('controls_whileUntil', { f: { MODE: 'WHILE' }, v: { BOOL: c }, s: { DO: body } });
  const L = c => B('dowee_char', { f: { L: c } });
  const ARGS = { sweep: [['qa1', 'left'], ['qa2', 'right'], ['qa3', 'ms']] };
  const def = (name, body, y) => `<block type="procedures_defnoreturn" x="20" y="${y}"><mutation>${(ARGS[name] || []).map(([i, n]) => `<arg name="${n}" varid="${i}"></arg>`).join('')}</mutation><field name="NAME">${name}</field>${body ? `<statement name="STACK">${body}</statement>` : ''}</block>`;
  const call = (name, ...vals) => `<block type="procedures_callnoreturn"><mutation name="${name}">${(ARGS[name] || []).map(([, n]) => `<arg name="${n}"></arg>`).join('')}</mutation>${vals.map((x, i) => `<value name="ARG${i}">${typeof x === 'number' ? X.num(x) : x}</value>`).join('')}</block>`;
  const arg = n => X.get(ARGS.sweep.find(a => a[1] === n)[0], n);
  const varList = names => [...names.map(n => [id(n), n, VARS[n][1]]), ...ARGS.sweep.map(([i, n]) => [i, n, ''])];
  const bs = () => g('baseSpeed'), wheels = () => X.motors(A('ADD', bs(), g('turn')), A('MINUS', bs(), g('turn')));

  // the line globals, as the first blocks of "when Dowee starts"
  const lineStart = th => [fill('minV', '1023, 1023, 1023, 1023, 1023'), fill('maxV', '0, 0, 0, 0, 0'), set('threshold', th), set('seen', 0), set('position', 3)];
  // sweep(left, right, ms): turn while remembering each sensor's whitest and blackest reading
  const sweepDef = done => def('sweep', seq(X.motors(arg('left'), arg('right')), set('start', XB.millis()),
    whileDo(X.lt(A('MINUS', XB.millis(), g('start')), arg('ms')), forEachSensor(seq(set('v', XB.sensorN(g('i'))),
      ...(done ? [X.ifs([[X.lt(g('v'), item('minV')), setItem('minV', g('i'), g('v'))]]), X.ifs([[cmp('GT', g('v'), item('maxV')), setItem('maxV', g('i'), g('v'))]])]
        : [todo('TODO 1: remember this sensor\'s whitest and blackest reading. If v is smaller than item i of minV, put v in item i of minV. If v is bigger than item i of maxV, put v in item i of maxV.')]))))), 760);
  // calibrate(): sweep over the line, then the threshold halfway between the average white and the average black
  const calibrateDef = done => def('calibrate', seq(X.led('HIGH'),
    call('sweep', -120, 120, 250), call('sweep', 120, -120, 500), call('sweep', -120, 120, 500), call('sweep', 120, -120, 500), call('sweep', -120, 120, 250), X.motors(0, 0),
    set('whiteSum', 0), set('blackSum', 0), forEachSensor(seq(add('whiteSum', item('minV')), add('blackSum', item('maxV')))),
    set('avgWhite', idiv(g('whiteSum'), 5)), set('avgBlack', idiv(g('blackSum'), 5)),
    ...(done ? [set('threshold', idiv(A('ADD', g('avgWhite'), g('avgBlack')), 2))]
      : [todo('TODO 2: the threshold is halfway between the average white and the average black: (avgWhite + avgBlack) whole-number ÷ 2.'), set('threshold', 0)]),
    XB.print(XB.text('white ')), XB.print(g('avgWhite')), XB.print(XB.text('  black ')), XB.print(g('avgBlack')), XB.print(XB.text('  threshold ')), X.print(g('threshold')),
    X.led('LOW'), ms(300)), 1180);
  // readLine(): which sensors see the line (onLine), how many (seen), and where it is (position, 1 to 5)
  const readLineDef = done => def('readLine', seq(set('sum', 0), set('seen', 0),
    forEachSensor(done ? seq(setItem('onLine', g('i'), B('logic_ternary', { v: { IF: cmp('GT', XB.sensorN(g('i')), g('threshold')), THEN: 1, ELSE: 0 } })),
      add('seen', item('onLine')), add('sum', A('MULTIPLY', item('onLine'), g('i'))))
      : seq(todo('TODO 1: does sensor i see the line? Set item i of onLine to 1 if line sensor i reads more than threshold, else 0.'), setItem('onLine', g('i'), 0),
        todo('TODO 2: count it: change seen by item i of onLine, and change sum by item i of onLine × i.'))),
    done ? X.ifs([[cmp('GT', g('seen'), 0), set('position', A('DIVIDE', g('sum'), g('seen')))]])
      : todo('TODO 3: if seen is more than 0, set position to sum ÷ seen (the average). If no sensor sees the line, keep the last position.')), 520);
  const prog = (start, loop, names, defs) => X.prog(seq(...start), seq(...loop), { vars: varList(names), extra: defs.join('') });
  const KIT = ['minV', 'maxV', 'threshold', 'onLine', 'seen', 'position', 'sum', 'v', 'start', 'whiteSum', 'blackSum', 'avgWhite', 'avgBlack', 'i'];
  const half = () => idiv(bs(), 4), on = (n, v = 1) => cmp('EQ', item('onLine', n), v);

  const pid1 = done => prog([...lineStart(done ? 500 : 0), set('baseSpeed', 150), call('calibrate')],
    [call('readLine'), todo('Simple steering with the sensors. In PID 2 you work out exactly where the line is.'),
      X.ifs([[on(3), X.motors(bs(), bs())], [X.or(on(2), on(1)), X.motors(half(), bs())], [X.or(on(4), on(5)), X.motors(bs(), half())]])],
    [...KIT, 'baseSpeed'], [sweepDef(done), readLineDef(true), calibrateDef(done)]);
  const pid2 = done => prog([...lineStart(500), set('baseSpeed', 150), call('calibrate')],
    [call('readLine'), set('error', A('MINUS', g('position'), 3)), X.print(g('error')), todo('Simple steering for now. In PID 3 you make it smooth.'),
      X.ifs([[cmp('GT', g('error'), 0.5), X.motors(bs(), half())], [X.lt(g('error'), -0.5), X.motors(half(), bs())]], X.motors(bs(), bs()))],
    [...KIT, 'baseSpeed', 'error'], [sweepDef(true), readLineDef(done), calibrateDef(true)]);
  // PID 3 and 4 give calibrate() and readLine() ready-made, so their blocks use the ready-made line blocks
  const pid3 = done => X.prog(seq(set('Kp', 15), set('baseSpeed', 150), B('dowee_calibrate')), seq(B('dowee_read_line'), set('error', A('MINUS', B('dowee_line_pos'), 3)),
    todo('P = proportional: the farther the line, the harder Dowee steers.'),
    ...(done ? [set('turn', A('MULTIPLY', g('Kp'), g('error'))), wheels()]
      : [todo('TODO 1: work out how hard to turn: Kp × error'), set('turn', 0), todo('TODO 2: speed up one wheel and slow the other: left gets baseSpeed + turn, right gets baseSpeed − turn'), X.motors(bs(), bs())]),
    ms(10)), { vars: varList(['Kp', 'baseSpeed', 'error', 'turn']) });
  const onL = pin => B('dowee_on_line', { f: { PIN: pin } }), err = () => A('MINUS', B('dowee_line_pos'), 3), ts = () => g('turnSpeed'), and = XB.and;
  const pid4 = done => X.prog(seq(set('Kp', 70), set('Kd', 1000), set('turnSpeed', 140), set('baseSpeed', 240), set('lastError', 0), set('lostSide', L('s')), B('dowee_calibrate')),
    seq(B('dowee_read_line'),
      todo('Remember which edge sensor saw the line last'),
      X.ifs([[and(onL('A0'), X.not(onL('A4'))), set('lostSide', L('l'))]]), X.ifs([[and(onL('A4'), X.not(onL('A0'))), set('lostSide', L('r'))]]),
      todo('Line lost (a sharp corner): spin on the spot towards where it was last seen, until a middle sensor finds it'),
      X.ifs([[and(cmp('EQ', B('dowee_line_seen'), 0), cmp('NEQ', g('lostSide'), L('s'))), seq(
        X.ifs([[cmp('EQ', g('lostSide'), L('r')), X.motors(ts(), neg(ts()))]], X.motors(neg(ts()), ts())),
        whileDo(and(and(X.not(onL('A1')), X.not(onL('A2'))), X.not(onL('A3'))), B('dowee_read_line')),
        set('lastError', err()))]]),
      set('error', err()),
      todo('D = derivative: how much did the error change since the last loop?'), set('change', A('MINUS', g('error'), g('lastError'))),
      ...(done ? [set('turn', A('ADD', A('MULTIPLY', g('Kp'), g('error')), A('MULTIPLY', g('Kd'), g('change'))))]
        : [set('turn', A('MULTIPLY', g('Kp'), g('error'))), todo('TODO: add the D part to turn: Kd × change')]),
      set('lastError', g('error')), wheels(), ms(10)),
    { vars: varList(['Kp', 'Kd', 'turnSpeed', 'baseSpeed', 'lastError', 'lostSide', 'error', 'change', 'turn']) });

  // Advanced PID: the globals of PID_GLOBALS, and the loop of PIDI_FULL (P, I with a limit, D)
  const pidStart = (kp, ki, kd, speed, th) => [set('Kp', kp), set('Ki', ki), set('Kd', kd), set('baseSpeed', speed), set('iLimit', 40), ...lineStart(th), set('error', 0), set('lastError', 0), set('integral', 0), call('calibrate')];
  const PIDV = [...KIT, 'Kp', 'Ki', 'Kd', 'baseSpeed', 'iLimit', 'error', 'lastError', 'integral', 'change', 'turn'];
  const pidLoop = () => [call('readLine'), set('error', A('MINUS', g('position'), 3)), set('change', A('MINUS', g('error'), g('lastError'))),
    set('integral', B('math_constrain', { v: { VALUE: A('ADD', g('integral'), g('error')), LOW: neg(g('iLimit')), HIGH: g('iLimit') } })),
    set('turn', A('ADD', A('ADD', A('MULTIPLY', g('Kp'), g('error')), A('MULTIPLY', g('Ki'), g('integral'))), A('MULTIPLY', g('Kd'), g('change')))),
    wheels(), set('lastError', g('error')), ms(10)];
  // apid3: the guided template (its calibrate() is one 2-second sweep timed with millis), and the finished racer (step 5)
  const guidedCal = done => def('calibrate', seq(set('start', XB.millis()),
    whileDo(X.lt(A('MINUS', XB.millis(), g('start')), 2000), done ? seq(set('t', A('MINUS', XB.millis(), g('start'))),
      X.ifs([[X.or(X.or(X.lt(g('t'), 250), and(cmp('GTE', g('t'), 750), X.lt(g('t'), 1250))), cmp('GTE', g('t'), 1750)), X.motors(-120, 120)]], X.motors(120, -120)),
      forEachSensor(seq(set('v', XB.sensorN(g('i'))), X.ifs([[X.lt(g('v'), item('minV')), setItem('minV', g('i'), g('v'))]]), X.ifs([[cmp('GT', g('v'), item('maxV')), setItem('maxV', g('i'), g('v'))]]))))
      : seq(todo('TODO: spin one way, then the other. (millis − start tells you how long you have been sweeping.)'), todo('TODO: for each sensor i, update item i of minV and item i of maxV.'))),
    X.motors(0, 0),
    ...(done ? [set('whiteSum', 0), set('blackSum', 0), forEachSensor(seq(add('whiteSum', item('minV')), add('blackSum', item('maxV')))),
      set('threshold', idiv(A('ADD', idiv(g('whiteSum'), 5), idiv(g('blackSum'), 5)), 2))]
      : [todo('TODO: average the minV values, average the maxV values, and set the threshold halfway between them.')])), 1180);
  const apid3 = done => prog([...pidStart(70, 0, 1000, done ? 220 : 150, 0)],
    done ? pidLoop() : [call('readLine'), set('error', A('MINUS', g('position'), 3)),
      todo('Simple steering for now, so you can test step 2. In STEP 3 you replace it with P and D. STEP 4: add I, with an anti-windup limit.'),
      set('turn', 0), X.ifs([[cmp('GT', g('error'), 0.5), set('turn', 50)]]), X.ifs([[X.lt(g('error'), -0.5), set('turn', -50)]]), set('lastError', g('error')), wheels(), ms(10)],
    [...PIDV, 't'], [done ? readLineDef(true) : def('readLine', todo('TODO: like in PID 2.'), 520), guidedCal(done)]);
  // apid4: shades of grey. The finished on/off PID, plus the weighting by how dark each sensor sees the floor
  const greyRead = done => def('readLine', seq(set('sum', 0), set('seen', 0),
    forEachSensor(seq(setItem('onLine', g('i'), B('logic_ternary', { v: { IF: cmp('GT', XB.sensorN(g('i')), g('threshold')), THEN: 1, ELSE: 0 } })), add('seen', item('onLine')), add('sum', A('MULTIPLY', item('onLine'), g('i'))))),
    ...(done ? [set('weighted', 0), set('total', 0), forEachSensor(seq(
      set('dark', B('math_constrain', { v: { VALUE: B('dowee_map', { v: { V: XB.sensorN(g('i')), FL: item('minV'), FH: item('maxV'), TL: 0, TH: 1000 } }), LOW: 0, HIGH: 1000 } })),
      add('weighted', A('MULTIPLY', g('dark'), g('i'))), add('total', g('dark')))),
      X.ifs([[cmp('GT', g('seen'), 0), set('position', A('DIVIDE', g('weighted'), g('total')))]])]
      : [X.ifs([[cmp('GT', g('seen'), 0), set('position', A('DIVIDE', g('sum'), g('seen')))]]),
        todo('TODO: on/off only knows "on the line" or "not". A sensor half over the line reads grey, and that tells you more. Weight each sensor by how dark it is:'),
        todo('for each sensor i: set dark to constrain(map(line sensor i, item i of minV, item i of maxV, 0, 1000), 0, 1000). Change weighted by dark × i, and total by dark.'),
        todo('then, if seen is more than 0: set position to weighted ÷ total.')])), 520);
  const apid4 = done => prog([...pidStart(70, 0, 1000, 220, 500)], pidLoop(), [...PIDV, 'weighted', 'total', 'dark'], [sweepDef(true), greyRead(done), calibrateDef(true)]);
  // follow (classroom TODO version): the 2-sensor follower with the if / else as TODOs
  const followTodo = () => X.prog(X.set('sp', 'speed', 150), seq(
    X.set('lf', 'left', B('logic_ternary', { v: { IF: X.black('A1'), THEN: 1, ELSE: 0 } })), X.set('rt', 'right', B('logic_ternary', { v: { IF: X.black('A3'), THEN: 1, ELSE: 0 } })),
    todo('TODO 1: if left is 1 and right is 0, the line is on the left: turn left with set wheels left 0, right speed.'),
    todo('TODO 2: else if right is 1 and left is 0, the line is on the right: turn right.'),
    todo('TODO 3: else (both see the same thing) go straight.')), { vars: [['sp', 'speed', 'int'], ['lf', 'left', 'int'], ['rt', 'right', 'int']] });
  return { pid1, pid2, pid3, pid4, apid3, apid4, followTodo };
})();
// Lesson id → its block versions: starter (what the lesson opens with), todo (the classroom TODO version, when the
// text has one), solution (the finished program, used by the tests).
const LESSON_BLOCKS = {
  see: { starter: BLOCK_EXAMPLES.line.print.xml, solution: BLOCK_EXAMPLES.line.print.xml },
  follow: { starter: FULL.bang, todo: LB.followTodo, solution: FULL.bang },
  pid1: { starter: () => LB.pid1(false), solution: () => LB.pid1(true) },
  pid2: { starter: () => LB.pid2(false), solution: () => LB.pid2(true) },
  pid3: { starter: () => LB.pid3(false), solution: () => LB.pid3(true) },
  pid: { starter: () => LB.pid4(false), solution: () => LB.pid4(true) },
  apid3: { starter: () => LB.apid3(false), solution: () => LB.apid3(true) },
  apid4: { starter: () => LB.apid4(false), solution: () => LB.apid4(true) },
};
for (const L of LESSONS) if (LESSON_BLOCKS[L.id]) L.blockVersions = LESSON_BLOCKS[L.id];
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
if (typeof module !== 'undefined') Object.assign(module.exports, { X, BLOCK_EXAMPLES, BLOCK_LESSONS, LESSON_BLOCKS, blockStarterOf });
