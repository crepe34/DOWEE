/* ---------------- Blocks mode (Blockly) ----------------
   Younger students snap blocks together; the blocks write real Arduino code for Dowee,
   which is what actually runs (and what they can copy to a real robot). The code is shown
   beside the blocks: clicking a block lights up its lines, and the running block glows.
   Blockly is bundled into the page by the build; the CDN and /vendor are fallbacks.
   Block programs (examples, lessons) are in src/blocks-content.js. */
const BLK_URLS = ['https://cdn.jsdelivr.net/npm/blockly@10.4.3/blockly_compressed.js', 'https://cdn.jsdelivr.net/npm/blockly@10.4.3/blocks_compressed.js', 'https://cdn.jsdelivr.net/npm/blockly@10.4.3/msg/en.js'];
const modeKey = (a, r) => `mode:${a}:${r}`;
function modeOf(a, r) { return store.get(modeKey(a, r), 'code'); }
function setMode(a, r, m) { store.set(modeKey(a, r), m); }
const BK = { ws: null, loading: null, gen: null, suppress: false, arena: null, robot: null, lineMap: [], level: null, glow: null, showCode: store.get('blkShowCode', true) };

function loadBlockly() {
  if (window.Blockly && window.Blockly.Msg && window.Blockly.Msg.CONTROLS_IF_MSG_IF) return Promise.resolve();
  if (BK.loading) return BK.loading;
  const one = src => new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = () => bad(new Error('load')); document.head.appendChild(sc); });
  const local = BLK_URLS.map(u => '/vendor/blockly/' + u.split('blockly@10.4.3/')[1]);
  const chain = list => list.reduce((p, u) => p.then(() => one(u)), Promise.resolve());
  BK.loading = (/^https?:$/.test(location.protocol) ? chain(local).catch(() => chain(BLK_URLS)) : chain(BLK_URLS)).catch(e => { BK.loading = null; throw e; });
  return BK.loading;
}

const C = { start: '#e9467e', move: '#f39a3b', sense: '#4a9e3a', light: '#c9a21a', control: '#3f74c9', logic: '#5a86d6', math: '#8c5bc4', vars: '#0f8a87', text: '#86bf4f', pins: '#d0336f', time: '#2f8fb8', func: '#9a5cc6', list: '#b0703a' };
const SENSOR_OPTS = [['1 (far left)', 'A0'], ['2 (left)', 'A1'], ['3 (middle)', 'A2'], ['4 (right)', 'A3'], ['5 (far right)', 'A4']];
// Pins a student can use freely on Dowee. Motor (5-10), Bluetooth (0, 1) and ultrasonic (11, 12) pins are taken.
const PIN_OUT = [['2', '2'], ['3', '3'], ['4', '4'], ['13 (LED)', '13'], ['A5', 'A5']];
const PIN_IN = [['2', '2'], ['3', '3'], ['4', '4'], ['A5', 'A5'], ['A0 (line 1)', 'A0'], ['A1 (line 2)', 'A1'], ['A2 (line 3)', 'A2'], ['A3 (line 4)', 'A3'], ['A4 (line 5)', 'A4']];
const PIN_AIN = [['A0 (line 1)', 'A0'], ['A1 (line 2)', 'A1'], ['A2 (line 3)', 'A2'], ['A3 (line 4)', 'A3'], ['A4 (line 5)', 'A4'], ['A5', 'A5']];
const PIN_PWM = [['3', '3'], ['5 (left motor!)', '5'], ['6 (right motor!)', '6'], ['9 (motor!)', '9'], ['10 (motor!)', '10'], ['11 (ultrasonic!)', '11']];
const PIN_TONE = [['4', '4'], ['2', '2'], ['3', '3'], ['A5', 'A5']];
const S_ = { previousStatement: null, nextStatement: null };   // a statement block
function defineDoweeBlocks() {
  if (Blockly.Blocks.dowee_start) return;
  const st = (o, colour) => ({ ...S_, colour, ...o });
  Blockly.defineBlocksWithJsonArray([
    { type: 'dowee_start', message0: 'when Dowee starts %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.start, tooltip: 'Runs once when the robot turns on (setup).', hat: 'cap' },
    { type: 'dowee_forever', message0: 'forever %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.start, tooltip: 'Repeats again and again (loop).' },
    // Move
    st({ type: 'dowee_move', message0: 'drive %1 at speed %2', args0: [{ type: 'field_dropdown', name: 'DIR', options: [['forward', 'F'], ['backward', 'B'], ['turning left', 'TL'], ['turning right', 'TR'], ['spin left', 'SL'], ['spin right', 'SR']] }, { type: 'input_value', name: 'SPEED', check: 'Number' }], inputsInline: true, tooltip: 'Speed goes from 0 to 255. Dowee needs about 60 to start moving.' }, C.move),
    st({ type: 'dowee_drive_for', message0: 'drive %1 at speed %2 for %3 seconds, then stop', args0: [{ type: 'field_dropdown', name: 'DIR', options: [['forward', 'F'], ['backward', 'B'], ['spin left', 'SL'], ['spin right', 'SR']] }, { type: 'input_value', name: 'SPEED', check: 'Number' }, { type: 'input_value', name: 'SEC', check: 'Number' }], inputsInline: true }, C.move),
    st({ type: 'dowee_motors', message0: 'set motors left %1 right %2', args0: [{ type: 'input_value', name: 'L', check: 'Number' }, { type: 'input_value', name: 'R', check: 'Number' }], inputsInline: true, tooltip: '-255 (full backward) to 255 (full forward) for each wheel.' }, C.move),
    st({ type: 'dowee_stop', message0: 'stop' }, C.move),
    // Timing
    st({ type: 'dowee_wait', message0: 'wait %1 seconds', args0: [{ type: 'input_value', name: 'SEC', check: 'Number' }], inputsInline: true, tooltip: 'Keep doing the same thing for a while. Dowee does not look at its sensors while it waits.' }, C.control),
    st({ type: 'dowee_wait_ms', message0: 'wait %1 ms', args0: [{ type: 'input_value', name: 'MS', check: 'Number' }], inputsInline: true, tooltip: '1000 ms is 1 second.' }, C.time),
    st({ type: 'dowee_wait_until', message0: 'wait until %1', args0: [{ type: 'input_value', name: 'C', check: 'Boolean' }], tooltip: 'Waits here until the answer is yes.' }, C.time),
    st({ type: 'dowee_every', message0: 'every %1 ms %2 %3', args0: [{ type: 'input_value', name: 'MS', check: 'Number' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], tooltip: 'Runs the blocks inside each time this many milliseconds have passed, without waiting. Use it to do two things at once.' }, C.time),
    { type: 'dowee_millis', message0: 'milliseconds since start', output: 'Number', colour: C.time },
    { type: 'dowee_time', message0: 'seconds since start', output: 'Number', colour: C.sense },
    // Light, sound, messages
    st({ type: 'dowee_led', message0: 'turn LED %1', args0: [{ type: 'field_dropdown', name: 'ON', options: [['on', 'HIGH'], ['off', 'LOW']] }] }, C.light),
    st({ type: 'dowee_led_toggle', message0: 'toggle the LED', tooltip: 'On becomes off, off becomes on.' }, C.light),
    st({ type: 'dowee_print', message0: 'show in Serial monitor %1', args0: [{ type: 'input_value', name: 'V' }], tooltip: 'Prints the value and starts a new line (Serial.println).' }, C.light),
    st({ type: 'dowee_print_inline', message0: 'show %1 without a new line', args0: [{ type: 'input_value', name: 'V' }], tooltip: 'Serial.print: the next value goes on the same line.' }, C.text),
    { type: 'dowee_serial_has', message0: 'Serial has data', output: 'Boolean', colour: C.text, tooltip: 'Serial.available() > 0' },
    { type: 'dowee_serial_num', message0: 'number from Serial', output: 'Number', colour: C.text, tooltip: 'Reads a number someone typed in the Serial monitor (Serial.parseInt).' },
    st({ type: 'dowee_comment', message0: '💬 %1', args0: [{ type: 'field_input', name: 'T', text: 'a note for people' }], tooltip: 'A comment: Dowee ignores it. It becomes // in the code.' }, '#9d9ab4'),
    st({ type: 'dowee_tone', message0: 'play tone on pin %1 at %2 Hz for %3 ms', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN_TONE }, { type: 'input_value', name: 'HZ', check: 'Number' }, { type: 'input_value', name: 'MS', check: 'Number' }], inputsInline: true, tooltip: 'A buzzer on this pin plays a note. 262 Hz is middle C.' }, C.pins),
    st({ type: 'dowee_notone', message0: 'stop the tone on pin %1', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN_TONE }] }, C.pins),
    // Sensors
    { type: 'dowee_sensor', message0: 'line sensor %1', args0: [{ type: 'field_dropdown', name: 'PIN', options: SENSOR_OPTS }], output: 'Number', colour: C.sense, tooltip: 'Black ≈ 950, white ≈ 100.' },
    { type: 'dowee_sensor_n', message0: 'line sensor number %1', args0: [{ type: 'input_value', name: 'N', check: 'Number' }], inputsInline: true, output: 'Number', colour: C.sense, tooltip: 'Sensor 1 (far left) to 5 (far right). Handy in a count loop.' },
    { type: 'dowee_black', message0: 'sensor %1 sees black', args0: [{ type: 'field_dropdown', name: 'PIN', options: SENSOR_OPTS }], output: 'Boolean', colour: C.sense, tooltip: 'True when the reading is above BLACK (500). Change BLACK in the Tune tab.' },
    { type: 'dowee_line_pos', message0: 'line position', output: 'Number', colour: C.sense, tooltip: '-2000 = line under the far-left sensor, 0 = in the middle, 2000 = far right.' },
    { type: 'dowee_distance', message0: 'distance in cm', output: 'Number', colour: C.sense, tooltip: 'From the ultrasonic sensor. 999 means nothing is in front.' },
    st({ type: 'dowee_bt_read', message0: 'read Bluetooth command', tooltip: 'Gets the newest letter from the remote control.' }, C.sense),
    { type: 'dowee_bt_is', message0: 'Bluetooth command is %1', args0: [{ type: 'field_dropdown', name: 'CMD', options: [['F forward', 'F'], ['B back', 'B'], ['L left', 'L'], ['R right', 'R'], ['S stop', 'S'], ['G forward-left', 'G'], ['I forward-right', 'I'], ['H back-left', 'H'], ['J back-right', 'J']] }], output: 'Boolean', colour: C.sense },
    // Pins
    st({ type: 'dowee_pin_write', message0: 'set pin %1 to %2', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN_OUT }, { type: 'field_dropdown', name: 'V', options: [['HIGH (on)', 'HIGH'], ['LOW (off)', 'LOW']] }], tooltip: 'digitalWrite. The pin is set to OUTPUT for you.' }, C.pins),
    { type: 'dowee_pin_read', message0: 'pin %1 is HIGH', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN_IN }], output: 'Boolean', colour: C.pins, tooltip: 'digitalRead. The pin is set to INPUT for you.' },
    { type: 'dowee_analog_read', message0: 'analog read %1', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN_AIN }], output: 'Number', colour: C.pins, tooltip: 'analogRead: 0 (0 V) to 1023 (5 V).' },
    st({ type: 'dowee_analog_write', message0: 'analog write pin %1 value %2', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN_PWM }, { type: 'input_value', name: 'V', check: 'Number' }], inputsInline: true, tooltip: 'analogWrite (PWM): 0 to 255. Only pins 3, 5, 6, 9, 10 and 11 can do this.' }, C.pins),
    { type: 'dowee_pulse_in', message0: 'pulse length on pin %1 (µs)', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN_IN }], output: 'Number', colour: C.pins, tooltip: 'pulseIn(pin, HIGH): how long the pin stays HIGH, in microseconds.' },
    // Math extras
    { type: 'dowee_map', message0: 'map %1 from %2 – %3 to %4 – %5', args0: [{ type: 'input_value', name: 'V', check: 'Number' }, { type: 'input_value', name: 'FL', check: 'Number' }, { type: 'input_value', name: 'FH', check: 'Number' }, { type: 'input_value', name: 'TL', check: 'Number' }, { type: 'input_value', name: 'TH', check: 'Number' }], inputsInline: true, output: 'Number', colour: C.math, tooltip: 'Changes a number from one range to another, like 0–1023 to 0–255.' },
    { type: 'dowee_minmax', message0: '%1 of %2 and %3', args0: [{ type: 'field_dropdown', name: 'OP', options: [['smaller', 'min'], ['bigger', 'max']] }, { type: 'input_value', name: 'A', check: 'Number' }, { type: 'input_value', name: 'B', check: 'Number' }], inputsInline: true, output: 'Number', colour: C.math },
    { type: 'dowee_intdiv', message0: 'whole-number %1 ÷ %2', args0: [{ type: 'input_value', name: 'A', check: 'Number' }, { type: 'input_value', name: 'B', check: 'Number' }], inputsInline: true, output: 'Number', colour: C.math, tooltip: 'Divides and drops the part after the point: 7 ÷ 2 = 3. This is what / does with int in Arduino code.' },
    // Variables that know their type (whole number, decimal, true/false). Blockly's own variable blocks only take untyped ones.
    { type: 'dowee_var_get', message0: '%1', args0: [{ type: 'field_variable', name: 'VAR', variable: 'x', variableTypes: ['', 'int', 'float', 'bool'], defaultType: 'int' }], output: null, colour: C.vars },
    st({ type: 'dowee_var_set', message0: 'set %1 to %2', args0: [{ type: 'field_variable', name: 'VAR', variable: 'x', variableTypes: ['', 'int', 'float', 'bool'], defaultType: 'int' }, { type: 'input_value', name: 'VALUE' }], inputsInline: true }, C.vars),
    st({ type: 'dowee_var_change', message0: 'change %1 by %2', args0: [{ type: 'field_variable', name: 'VAR', variable: 'x', variableTypes: ['', 'int', 'float'], defaultType: 'int' }, { type: 'input_value', name: 'DELTA', check: 'Number' }], inputsInline: true }, C.vars),
    // Lists (arrays)
    st({ type: 'dowee_list_set', message0: 'set item %1 of %2 to %3', args0: [{ type: 'input_value', name: 'I', check: 'Number' }, { type: 'field_variable', name: 'VAR', variable: 'list', variableTypes: ['list'], defaultType: 'list' }, { type: 'input_value', name: 'V', check: 'Number' }], inputsInline: true, tooltip: 'Items count from 1. (In Arduino code they count from 0, so the code says [i - 1].)' }, C.list),
    { type: 'dowee_list_get', message0: 'item %1 of %2', args0: [{ type: 'input_value', name: 'I', check: 'Number' }, { type: 'field_variable', name: 'VAR', variable: 'list', variableTypes: ['list'], defaultType: 'list' }], inputsInline: true, output: 'Number', colour: C.list, tooltip: 'Items count from 1.' },
  ]);
}

/* ---------------- the translator: blocks → Arduino code ---------------- */
// C operator precedence (smaller binds tighter), as Blockly orders.
// Whole numbers only: Blockly rounds orders down. They are spaced by 2 so ±1 can say 'same level is fine' (left side) or 'same level needs brackets' (right side of - * /).
const O = { ATOMIC: 0, UNARY: 4, MULT: 10, ADD: 12, REL: 16, EQ: 18, AND: 26, OR: 28, COND: 30, NONE: 99 };
const C_RESERVED = new Set([...TYPE_WORDS, ...KEYWORDS, ...Object.keys(BUILTINS), ...Object.keys(CONSTS), 'drive', 'readDistanceCm', 'readLinePosition', 'setup', 'loop', 'Serial', 'String', 'btCommand', 'BLACK', 'ENA', 'ENB', 'IN1', 'IN2', 'IN3', 'IN4', 'TRIG', 'ECHO', 'LIST_SIZE']);
const LIST_SIZE = 20;
const isWhole = s => /^-?\d+$/.test(s);
const isNum = s => /^-?\d+(\.\d+)?$/.test(s);
// C string literal: escapes quotes and backslashes; characters Serial can't show become '?'.
const cStr = t => '"' + String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/[^\x20-\x7e\\]/g, '?') + '"';
const TYPE_RANK = { bool: 0, int: 1, long: 2, float: 3 };
const wider = (a, b) => (TYPE_RANK[a] >= TYPE_RANK[b] ? a : b);

function makeGenerator() {
  const g = new (Blockly.CodeGenerator || Blockly.Generator)('Arduino');
  g.INDENT = '  ';
  g.STATEMENT_PREFIX = '/*@B%1@*/\n';   // marks where each block's code starts: becomes the line → block map
  g.scrub_ = (block, code, thisOnly) => {
    const next = block.nextConnection && block.nextConnection.targetBlock();
    const note = block.getCommentText && block.getCommentText();
    const com = note && block.outputConnection == null ? note.split('\n').map(l => `// ${l}\n`).join('') : '';
    return com + code + (thisOnly ? '' : g.blockToCode(next));
  };
  const v = (b, name, ord, def = '0') => g.valueToCode(b, name, ord) || def;
  const st = (b, name) => g.statementToCode(b, name);
  const F = g.forBlock;
  const name = b => g.names.get(b.getFieldValue('VAR'));
  const pinOut = p => g.pins.out.add(p), pinIn = p => g.pins.in.add(p);
  const sec = s => (isNum(s) ? String(Math.round(parseFloat(s) * 1000)) : `(unsigned long)(${s} * 1000)`);
  F.dowee_start = () => ''; F.dowee_forever = () => '';
  const DIRS = s => ({ F: [s, s], B: ['-' + s, '-' + s], TL: ['0', s], TR: [s, '0'], SL: ['-' + s, s], SR: [s, '-' + s] });
  F.dowee_move = b => { const m = DIRS(v(b, 'SPEED', O.UNARY, '150'))[b.getFieldValue('DIR')]; return `drive(${m[0]}, ${m[1]});\n`; };
  F.dowee_drive_for = b => { const m = DIRS(v(b, 'SPEED', O.UNARY, '150'))[b.getFieldValue('DIR')]; return `drive(${m[0]}, ${m[1]});\ndelay(${sec(v(b, 'SEC', O.MULT, '1'))});\ndrive(0, 0);\n`; };
  F.dowee_motors = b => `drive(${v(b, 'L', O.NONE)}, ${v(b, 'R', O.NONE)});\n`;
  F.dowee_stop = () => 'drive(0, 0);\n';
  F.dowee_wait = b => `delay(${sec(v(b, 'SEC', O.MULT, '1'))});\n`;
  F.dowee_wait_ms = b => `delay(${v(b, 'MS', O.NONE, '100')});\n`;
  F.dowee_wait_until = b => `while (!(${v(b, 'C', O.NONE, 'false')})) {\n${g.INDENT}delay(1);\n}\n`;
  F.dowee_every = b => {
    const t = `everyTimer${++g.timerN}`; g.globals.push(`unsigned long ${t} = 0;   // when "every" last ran`);
    return `if (millis() - ${t} >= ${v(b, 'MS', O.ADD, '1000')}) {\n${g.INDENT}${t} = millis();\n${st(b, 'DO')}}\n`;
  };
  F.dowee_millis = () => ['millis()', O.ATOMIC];
  F.dowee_time = () => ['millis() / 1000.0', O.MULT];
  F.dowee_led = b => { g.pins.led = true; return `digitalWrite(LED_BUILTIN, ${b.getFieldValue('ON')});\n`; };
  F.dowee_led_toggle = () => { g.pins.led = true; return 'digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));\n'; };
  F.dowee_print = b => { g.serial = true; return `Serial.println(${v(b, 'V', O.NONE, '""')});\n`; };
  F.dowee_print_inline = b => { g.serial = true; return `Serial.print(${v(b, 'V', O.NONE, '""')});\n`; };
  F.dowee_serial_has = () => { g.serial = true; return ['Serial.available() > 0', O.REL]; };
  F.dowee_serial_num = () => { g.serial = true; return ['Serial.parseInt()', O.ATOMIC]; };
  F.dowee_comment = b => `// ${(b.getFieldValue('T') || '').replace(/\n/g, ' ')}\n`;
  F.dowee_tone = b => { pinOut(b.getFieldValue('PIN')); return `tone(${b.getFieldValue('PIN')}, ${v(b, 'HZ', O.NONE, '440')}, ${v(b, 'MS', O.NONE, '200')});\n`; };
  F.dowee_notone = b => `noTone(${b.getFieldValue('PIN')});\n`;
  F.dowee_sensor = b => [`analogRead(${b.getFieldValue('PIN')})`, O.ATOMIC];
  F.dowee_sensor_n = b => [`analogRead(A0 + ${v(b, 'N', O.ADD, '1')} - 1)`, O.ATOMIC];
  F.dowee_black = b => { g.black = true; return [`analogRead(${b.getFieldValue('PIN')}) > BLACK`, O.REL]; };
  F.dowee_line_pos = () => { g.used.add('linepos'); return ['readLinePosition()', O.ATOMIC]; };
  F.dowee_distance = () => { g.used.add('distance'); return ['readDistanceCm()', O.ATOMIC]; };
  F.dowee_bt_read = () => { g.used.add('bt'); g.serial = true; return 'if (Serial.available() > 0) {\n  btCommand = Serial.read();\n}\n'; };
  F.dowee_bt_is = b => { g.used.add('bt'); return [`btCommand == '${b.getFieldValue('CMD')}'`, O.EQ]; };
  F.dowee_pin_write = b => { const p = b.getFieldValue('PIN'); if (p === '13') g.pins.led = true; else pinOut(p); return `digitalWrite(${p === '13' ? 'LED_BUILTIN' : p}, ${b.getFieldValue('V')});\n`; };
  F.dowee_pin_read = b => { const p = b.getFieldValue('PIN'); if (!/^A[0-4]$/.test(p)) pinIn(p); return [`digitalRead(${p}) == HIGH`, O.EQ]; };
  F.dowee_analog_read = b => [`analogRead(${b.getFieldValue('PIN')})`, O.ATOMIC];
  F.dowee_analog_write = b => { const p = b.getFieldValue('PIN'); pinOut(p); return `analogWrite(${p}, ${v(b, 'V', O.NONE)});\n`; };
  F.dowee_pulse_in = b => { const p = b.getFieldValue('PIN'); if (!/^A[0-4]$/.test(p)) pinIn(p); return [`pulseIn(${p}, HIGH, 30000)`, O.ATOMIC]; };
  F.dowee_map = b => [`map(${['V', 'FL', 'FH', 'TL', 'TH'].map(k => v(b, k, O.NONE)).join(', ')})`, O.ATOMIC];
  F.dowee_minmax = b => [`${b.getFieldValue('OP')}(${v(b, 'A', O.NONE)}, ${v(b, 'B', O.NONE)})`, O.ATOMIC];
  F.dowee_intdiv = b => [`(long)(${v(b, 'A', O.NONE)}) / (long)(${v(b, 'B', O.NONE, '1')})`, O.MULT];
  // Blocks count list items from 1, Arduino arrays from 0.
  const idx = b => { const i = v(b, 'I', O.ADD, '1'); return isWhole(i) ? String(Math.max(0, +i - 1)) : `${i} - 1`; };
  F.dowee_list_set = b => `${name(b)}[${idx(b)}] = ${v(b, 'V', O.NONE)};\n`;
  F.dowee_list_get = b => [`${name(b)}[${idx(b)}]`, O.ATOMIC];
  // control
  F.controls_if = b => {
    let n = 0, code = '';
    while (b.getInput('IF' + n)) { code += (n ? ' else if (' : 'if (') + v(b, 'IF' + n, O.NONE, 'false') + ') {\n' + st(b, 'DO' + n) + '}'; n++; }
    if (b.getInput('ELSE')) code += ' else {\n' + st(b, 'ELSE') + '}';
    return code + '\n';
  };
  F.controls_repeat_ext = b => { const i = g.freshName('i'), n = v(b, 'TIMES', O.REL, '0'); return `for (int ${i} = 0; ${i} < ${isWhole(n) ? n : `(int)(${n})`}; ${i}++) {\n${st(b, 'DO')}}\n`; };
  F.controls_whileUntil = b => { const c = v(b, 'BOOL', O.NONE, 'false'); return b.getFieldValue('MODE') === 'UNTIL' ? `while (!(${c})) {\n${st(b, 'DO')}}\n` : `while (${c}) {\n${st(b, 'DO')}}\n`; };
  F.controls_for = b => {
    const x = name(b), a = v(b, 'FROM', O.NONE, '1'), z = v(b, 'TO', O.NONE, '10'), by = v(b, 'BY', O.NONE, '1');
    if (isNum(a) && isNum(z) && isNum(by)) {
      const down = parseFloat(a) > parseFloat(z), step = Math.abs(parseFloat(by)) || 1;
      return `for (${x} = ${a}; ${x} ${down ? '>=' : '<='} ${z}; ${x} ${down ? '-=' : '+='} ${step}) {\n${st(b, 'DO')}}\n`;
    }
    return `for (${x} = ${a}; ${x} <= ${z}; ${x} += ${by}) {\n${st(b, 'DO')}}\n`;
  };
  F.controls_flow_statements = b => (b.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n');
  // logic
  F.logic_compare = b => { const op = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[b.getFieldValue('OP')]; const ord = op === '==' || op === '!=' ? O.EQ : O.REL; return [`${v(b, 'A', ord - 1)} ${op} ${v(b, 'B', ord - 1)}`, ord]; };
  F.logic_operation = b => { const and = b.getFieldValue('OP') === 'AND', ord = and ? O.AND : O.OR; return [`${v(b, 'A', ord + 1, 'false')} ${and ? '&&' : '||'} ${v(b, 'B', ord + 1, 'false')}`, ord]; };
  F.logic_negate = b => [`!${v(b, 'BOOL', O.UNARY, 'false')}`, O.UNARY];
  F.logic_boolean = b => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOMIC];
  // math. The left operand may share the operator's precedence; the right one of - * / may not.
  F.math_number = b => { const n = Number(b.getFieldValue('NUM')); return [String(n), n < 0 ? O.UNARY : O.ATOMIC]; };
  F.math_arithmetic = b => {
    const op = b.getFieldValue('OP');
    if (op === 'POWER') return [`pow(${v(b, 'A', O.NONE)}, ${v(b, 'B', O.NONE)})`, O.ATOMIC];
    if (op === 'DIVIDE') {
      // Blocks divide like a calculator: 7 ÷ 2 = 3.5. In C, int / int drops the fraction, so make one side a decimal.
      const a = v(b, 'A', O.MULT + 1), d = v(b, 'B', O.MULT - 1, '1');
      if (g.typeOf(b.getInputTargetBlock('A')) === 'float' || g.typeOf(b.getInputTargetBlock('B')) === 'float') return [`${a} / ${d}`, O.MULT];
      if (isWhole(d)) return [`${a} / ${d}.0`, O.MULT];
      if (isWhole(a)) return [`${a}.0 / ${d}`, O.MULT];
      return [`(float)(${v(b, 'A', O.NONE)}) / ${d}`, O.MULT];
    }
    const [sym, ord] = { ADD: ['+', O.ADD], MINUS: ['-', O.ADD], MULTIPLY: ['*', O.MULT] }[op];
    return [`${v(b, 'A', ord + 1)} ${sym} ${v(b, 'B', op === 'ADD' ? ord + 1 : ord - 1)}`, ord];
  };
  F.math_single = b => {
    const op = b.getFieldValue('OP'), x = v(b, 'NUM', O.NONE);
    if (op === 'NEG') return [`-${v(b, 'NUM', O.UNARY)}`, O.UNARY];
    const fn = { ROOT: 'sqrt', ABS: 'abs', LN: 'log', EXP: 'exp', POW10: null, LOG10: null }[op];
    if (op === 'POW10') return [`pow(10, ${x})`, O.ATOMIC];
    if (op === 'LOG10') return [`log(${x}) / log(10)`, O.MULT];
    return [`${fn || 'abs'}(${x})`, O.ATOMIC];
  };
  F.math_round = b => [`${{ ROUND: 'round', ROUNDUP: 'ceil', ROUNDDOWN: 'floor' }[b.getFieldValue('OP')]}(${v(b, 'NUM', O.NONE)})`, O.ATOMIC];
  F.math_modulo = b => [`(long)(${v(b, 'DIVIDEND', O.NONE)}) % (long)(${v(b, 'DIVISOR', O.NONE, '1')})`, O.MULT];
  F.math_constrain = b => [`constrain(${v(b, 'VALUE', O.NONE)}, ${v(b, 'LOW', O.NONE)}, ${v(b, 'HIGH', O.NONE)})`, O.ATOMIC];
  F.math_random_int = b => [`random(${v(b, 'FROM', O.NONE)}, ${v(b, 'TO', O.ADD)} + 1)`, O.ATOMIC];
  F.math_change = b => { g.checkFit(b, name(b), b.getInputTargetBlock('DELTA')); return `${name(b)} += ${v(b, 'DELTA', O.NONE, '1')};\n`; };
  // variables and text
  F.variables_get = F.dowee_var_get = b => [name(b), O.ATOMIC];
  F.dowee_var_change = b => F.math_change(b);
  F.variables_set = F.dowee_var_set = b => { g.checkFit(b, name(b), b.getInputTargetBlock('VALUE')); return `${name(b)} = ${v(b, 'VALUE', O.NONE, g.typeOfVar(b.getFieldValue('VAR')) === 'bool' ? 'false' : '0')};\n`; };
  F.text = b => [cStr(b.getFieldValue('TEXT') || ''), O.ATOMIC];
  F.text_join = b => {
    const parts = []; for (let i = 0; i < (b.itemCount_ || 0); i++) parts.push(v(b, 'ADD' + i, O.ADD + 1, '""'));
    if (!parts.length) return ['""', O.ATOMIC];
    return [`String(${parts[0]})${parts.slice(1).map(p => ' + ' + p).join('')}`, O.ADD];
  };
  // functions ("make your own block")
  const procParams = b => (b.getVars ? b.getVars() : []).map(n => g.names.getByName(n));
  F.procedures_defnoreturn = F.procedures_defreturn = b => {
    const fname = g.procName(b.getFieldValue('NAME')), ret = b.type === 'procedures_defreturn';
    const params = procParams(b).map(p => `${g.typeOfName(p.raw)} ${p.c}`).join(', ');
    let body = st(b, 'STACK');
    if (ret) body += `${g.INDENT}return ${v(b, 'RETURN', O.NONE, '0')};\n`;
    g.defs.push(`${ret ? g.returnType(b) : 'void'} ${fname}(${params}) {\n${body}}`);
    return null;
  };
  F.procedures_callnoreturn = b => `${g.procName(b.getFieldValue('NAME'))}(${(b.arguments_ || []).map((x, i) => v(b, 'ARG' + i, O.NONE)).join(', ')});\n`;
  F.procedures_callreturn = b => [`${g.procName(b.getFieldValue('NAME'))}(${(b.arguments_ || []).map((x, i) => v(b, 'ARG' + i, O.NONE)).join(', ')})`, O.ATOMIC];
  F.procedures_ifreturn = b => `if (${v(b, 'CONDITION', O.NONE, 'false')}) {\n${g.INDENT}return${b.hasReturnValue_ ? ' ' + v(b, 'VALUE', O.NONE, '0') : ''};\n}\n`;
  return g;
}

// Names: block variable names become safe, unique C names that don't clash with Arduino words or each other.
function makeNames(ws) {
  const used = new Set(C_RESERVED), byId = new Map(), byName = new Map();
  const clean = raw => { let n = (raw || 'x').trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'x'; if (!/^[A-Za-z_]/.test(n)) n = 'v_' + n; let m = C_RESERVED.has(n) ? n + '_' : n, k = 2; while (used.has(m)) m = `${n}${k++}`; used.add(m); return m; };
  for (const x of ws.getAllVariables()) { const e = { raw: x.name, c: clean(x.name), type: x.type || '', id: x.getId() }; byId.set(e.id, e); byName.set(x.name, e); }
  return {
    get: id => (byId.get(id) || { c: 'x' }).c,
    getByName: n => byName.get(n) || { raw: n, c: clean(n) },
    all: () => [...byId.values()],
    fresh: base => { let k = 1, m; do m = `${base}${k++}`; while (used.has(m)); used.add(m); return m; },
    clean,
  };
}

// Types: typed variables keep their type; untyped ones become int unless a decimal can end up in them.
function inferTypes(g, ws) {
  const blocks = ws.getAllBlocks(false), vtype = new Map(), ret = new Map();
  for (const e of g.names.all()) vtype.set(e.id, ['int', 'float', 'bool', 'long'].includes(e.type) ? e.type : null);
  const fixed = id => ['int', 'float', 'bool', 'long'].includes((g.names.all().find(e => e.id === id) || {}).type);
  const T = (b, seen = 0) => {
    if (!b || seen > 40) return 'int';
    const t = b.type, k = (n) => T(b.getInputTargetBlock(n), seen + 1);
    if (t === 'math_number') { const s = String(Number(b.getFieldValue('NUM'))); return isWhole(s) ? (Math.abs(+s) > 32767 ? 'long' : 'int') : 'float'; }
    if (t === 'math_arithmetic') { const op = b.getFieldValue('OP'); return op === 'DIVIDE' || op === 'POWER' ? 'float' : wider(k('A'), k('B')); }
    if (t === 'math_single') return b.getFieldValue('OP') === 'ABS' || b.getFieldValue('OP') === 'NEG' ? k('NUM') : 'float';
    if (t === 'math_round' || t === 'math_modulo' || t === 'dowee_intdiv' || t === 'math_random_int' || t === 'dowee_map' || t === 'dowee_sensor' || t === 'dowee_sensor_n' || t === 'dowee_analog_read' || t === 'dowee_line_pos' || t === 'dowee_distance' || t === 'dowee_serial_num' || t === 'dowee_list_get') return t === 'math_modulo' || t === 'dowee_intdiv' || t === 'dowee_distance' || t === 'math_random_int' || t === 'dowee_map' ? 'long' : 'int';
    if (t === 'math_constrain') return wider(k('VALUE'), wider(k('LOW'), k('HIGH')));
    if (t === 'dowee_minmax') return wider(k('A'), k('B'));
    if (t === 'dowee_millis' || t === 'dowee_pulse_in') return 'long';
    if (t === 'dowee_time') return 'float';
    if (/^logic_|dowee_black|dowee_bt_is|dowee_pin_read|dowee_serial_has/.test(t)) return 'bool';
    if (t === 'variables_get' || t === 'dowee_var_get') return vtype.get(b.getFieldValue('VAR')) || 'int';
    if (t === 'procedures_callreturn') return ret.get(b.getFieldValue('NAME')) || 'float';
    return 'int';
  };
  // a few passes are enough for values to flow through variables and functions
  for (let pass = 0; pass < 4; pass++) {
    const seen = new Map();
    const add = (id, t) => { if (!id || fixed(id)) return; seen.set(id, seen.has(id) ? wider(seen.get(id), t) : t); };
    for (const b of blocks) {
      if (b.type === 'variables_set' || b.type === 'dowee_var_set') add(b.getFieldValue('VAR'), T(b.getInputTargetBlock('VALUE')));
      if (b.type === 'math_change' || b.type === 'dowee_var_change') { const id = b.getFieldValue('VAR'); add(id, wider(vtype.get(id) || 'int', T(b.getInputTargetBlock('DELTA')))); }
      if (b.type === 'controls_for') add(b.getFieldValue('VAR'), wider(T(b.getInputTargetBlock('FROM')), wider(T(b.getInputTargetBlock('TO')), T(b.getInputTargetBlock('BY')))));
      if (b.type === 'procedures_callnoreturn' || b.type === 'procedures_callreturn') {
        const def = ws.getAllBlocks(false).find(d => /^procedures_def/.test(d.type) && d.getFieldValue('NAME') === b.getFieldValue('NAME'));
        if (def) (def.getVarModels ? def.getVarModels() : []).forEach((m, i) => add(m.getId(), T(b.getInputTargetBlock('ARG' + i))));
      }
      if (b.type === 'procedures_defreturn') ret.set(b.getFieldValue('NAME'), T(b.getInputTargetBlock('RETURN')));
    }
    for (const [id, t] of seen) vtype.set(id, t === 'bool' && vtype.get(id) && vtype.get(id) !== 'bool' ? vtype.get(id) : t);
  }
  g.typeOf = b => T(b);
  g.typeOfVar = id => vtype.get(id) || 'int';
  g.typeOfName = raw => { const e = g.names.getByName(raw); return vtype.get(e.id) || 'float'; };
  g.returnType = def => { const t = T(def.getInputTargetBlock('RETURN')); return t === 'bool' ? 'bool' : t; };
  // A decimal going into a whole-number variable loses its fraction: say so on the block.
  g.checkFit = (blk, cname, valueBlock) => {
    const want = g.typeOfVar(blk.getFieldValue('VAR')), got = T(valueBlock);
    blk.setWarningText && blk.setWarningText(want !== 'float' && got === 'float' && want !== 'bool' ? `${cname} is a whole-number variable, so the part after the point is dropped (2.7 becomes 2). Use a decimal variable to keep it.` : null);
  };
}

const HELPERS = {
  distance: `long readDistanceCm() {\n  digitalWrite(TRIG, LOW);\n  delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long duration = pulseIn(ECHO, HIGH, 30000);\n  if (duration == 0) return 999;   // nothing seen\n  return duration * 0.034 / 2;\n}`,
  linepos: `// Where is the line? -2000 = under the far-left sensor, 0 = middle, 2000 = far right.\nint readLinePosition() {\n  long weighted = 0, total = 0;\n  for (int k = 0; k < 5; k++) {\n    int v = analogRead(A0 + k) - 100;   // white reads about 100\n    if (v < 0) v = 0;\n    weighted += (long)v * (k - 2) * 1000;\n    total += v;\n  }\n  if (total == 0) return 0;\n  return weighted / total;\n}`,
};
// Turns a workspace into an Arduino sketch. Also fills BK.lineMap (line number → block id) and puts
// warnings on blocks that can't run (not under a hat, a second "when Dowee starts").
function blocksToArduino(ws, opts = {}) {
  if (!BK.gen) BK.gen = makeGenerator();
  const g = BK.gen; g.init(ws);
  g.used = new Set(); g.globals = []; g.defs = []; g.pins = { out: new Set(), in: new Set(), led: false }; g.serial = false; g.black = false; g.timerN = 0;
  g.names = makeNames(ws); g.freshName = g.names.fresh;
  const procNames = new Map(); g.procName = raw => { if (!procNames.has(raw)) procNames.set(raw, g.names.clean(raw)); return procNames.get(raw); };
  inferTypes(g, ws);
  const tops = ws.getTopBlocks(true), loose = [];
  let starts = 0;
  for (const b of tops) {
    if (!b.setWarningText) continue;
    if (b.type === 'dowee_start') { starts++; b.setWarningText(starts > 1 ? 'There is more than one "when Dowee starts". Put all the start blocks in one.' : null); continue; }
    if (b.type === 'dowee_forever' || /^procedures_def/.test(b.type)) { b.setWarningText(null); continue; }
    if (b.outputConnection || b.previousConnection) { b.setWarningText('This block is not connected, so it never runs. Snap it under "when Dowee starts" or "forever".'); loose.push(b); }
  }
  for (const b of tops) if (/^procedures_def/.test(b.type) && b.isEnabled()) g.blockToCode(b);
  const body = type => tops.filter(b => b.type === type && b.isEnabled()).map(b => `/*@B'${b.id}'@*/\n` + g.statementToCode(b, 'DO')).join('');
  const setupBody = body('dowee_start'), loopBody = body('dowee_forever');
  const startId = (tops.find(b => b.type === 'dowee_start') || {}).id, foreverId = (tops.find(b => b.type === 'dowee_forever') || {}).id;
  const decl = g.names.all().map(e => {
    if (e.type === 'list') return `int ${e.c}[LIST_SIZE];   // a list of numbers (items 1 to ${LIST_SIZE})`;
    if (!ws.getAllBlocks(false).some(b => b.getField && b.getField('VAR') && b.getFieldValue('VAR') === e.id)) return '';
    const isParam = ws.getAllBlocks(false).some(b => /^procedures_def/.test(b.type) && (b.getVars ? b.getVars() : []).includes(e.raw));
    if (isParam) return '';
    const t = g.typeOfVar(e.id);
    return `${t} ${e.c} = ${t === 'bool' ? 'false' : '0'};`;
  }).filter(Boolean);
  const dist = g.used.has('distance'), bt = g.used.has('bt'), lists = g.names.all().some(e => e.type === 'list');
  const motors = /\bdrive\(/.test(setupBody + loopBody + g.defs.join('\n'));
  const serial = g.serial || bt;
  const setupLines = [
    motors ? PINMODES : '',
    g.pins.led ? '  pinMode(LED_BUILTIN, OUTPUT);' : '',
    dist ? '  pinMode(TRIG, OUTPUT);\n  pinMode(ECHO, INPUT);' : '',
    ...[...g.pins.out].map(p => `  pinMode(${p}, OUTPUT);`), ...[...g.pins.in].filter(p => !g.pins.out.has(p)).map(p => `  pinMode(${p}, INPUT);`),
    serial ? '  Serial.begin(9600);' : '',
  ].filter(Boolean);
  const lines = [
    '// Made with blocks in DOWEE. This is real Arduino code for Dowee:',
    '// copy it into the Arduino IDE to run it on the real robot.',
    motors ? MOTOR_SETUP : '',
    dist ? 'const int TRIG = 11;\nconst int ECHO = 12;' : '',
    g.black ? 'const int BLACK = 500;   // a line sensor above this sees black' : '',
    lists ? `const int LIST_SIZE = ${LIST_SIZE};` : '',
    bt ? "char btCommand = 'S';   // last letter from the Bluetooth remote" : '',
    ...decl, ...g.globals,
    '',
    motors ? DRIVE_FN : '',
    dist ? '\n' + HELPERS.distance : '',
    g.used.has('linepos') ? '\n' + HELPERS.linepos : '',
    ...g.defs.map(d => '\n' + d),
    '',
    `/*@B'${startId || ''}'@*/`,
    'void setup() {',
    ...setupLines,
    setupBody.replace(/\s+$/, ''),
    '}',
    '',
    `/*@B'${foreverId || ''}'@*/`,
    'void loop() {',
    loopBody.replace(/\s+$/, ''),
    '}',
    '',
  ];
  let src = lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n').replace(/\n{3,}/g, '\n\n');
  // pull the block markers out, remembering which block wrote each line
  const out = [], map = [null]; let cur = null;
  for (const raw of src.split('\n')) {
    const m = raw.match(/^\s*\/\*@B'(.*)'@\*\/\s*$/);
    if (m) { cur = m[1] || null; continue; }
    out.push(raw); map.push(cur);
  }
  if (!opts.noMap) { BK.lineMap = map; BK.loose = loose.length; }
  return out.join('\n');
}

/* ---------------- toolbox (Beginner / Full) ---------------- */
function toolboxLevel() {
  const L = S.lesson && typeof findLesson === 'function' ? findLesson(S.lesson) : null, b = L && (L.base || L);
  if (b && b.toolbox && L.arena === S.arena) return b.toolbox;
  return classSettings().toolbox === 'beginner' ? 'beginner' : 'full';
}
const TOOLBOX = level => {
  const num = n => ({ shadow: { type: 'math_number', fields: { NUM: n } } }), blk = (type, extra = {}) => ({ kind: 'block', type, ...extra });
  const full = level !== 'beginner';
  const cat = (name, colour, contents) => ({ kind: 'category', name, colour, contents });
  return { kind: 'categoryToolbox', contents: [
    cat('Start', C.start, [blk('dowee_start'), blk('dowee_forever')]),
    cat('Move', C.move, [blk('dowee_move', { inputs: { SPEED: num(150) } }), blk('dowee_stop'), blk('dowee_wait', { inputs: { SEC: num(1) } }),
      ...(full ? [blk('dowee_drive_for', { inputs: { SPEED: num(150), SEC: num(1) } })] : []), blk('dowee_motors', { inputs: { L: num(150), R: num(150) } })]),
    cat('Sensors', C.sense, [blk('dowee_black', { fields: { PIN: 'A2' } }), blk('dowee_distance'), blk('dowee_bt_read'), blk('dowee_bt_is'),
      ...(full ? [blk('dowee_sensor', { fields: { PIN: 'A2' } }), blk('dowee_sensor_n', { inputs: { N: num(3) } }), blk('dowee_line_pos'), blk('dowee_time')] : [])]),
    cat('Light & sound', C.light, [blk('dowee_led'), ...(full ? [blk('dowee_led_toggle'), blk('dowee_tone', { inputs: { HZ: num(440), MS: num(200) } }), blk('dowee_notone')] : []),
      blk('dowee_print', { inputs: { V: { shadow: { type: 'text', fields: { TEXT: 'Hello!' } } } } })]),
    cat('Control', C.control, [blk('controls_if'), blk('controls_if', { extraState: { hasElse: true } }), blk('controls_repeat_ext', { inputs: { TIMES: num(4) } }), blk('dowee_wait', { inputs: { SEC: num(1) } }),
      ...(full ? [blk('controls_whileUntil'), blk('controls_for', { inputs: { FROM: num(1), TO: num(5), BY: num(1) } }), blk('controls_flow_statements')] : [])]),
    ...(full ? [cat('Timing', C.time, [blk('dowee_every', { inputs: { MS: num(500) } }), blk('dowee_wait_ms', { inputs: { MS: num(100) } }), blk('dowee_wait_until'), blk('dowee_millis')])] : []),
    cat('Logic', C.logic, [blk('logic_compare', { inputs: { A: num(0), B: num(30) }, fields: { OP: 'LT' } }), blk('logic_operation'), ...(full ? [blk('logic_negate'), blk('logic_boolean')] : [])]),
    cat('Math', C.math, [blk('math_number'), blk('math_arithmetic', { inputs: { A: num(1), B: num(1) } }), blk('math_random_int', { inputs: { FROM: num(1), TO: num(10) } }),
      ...(full ? [blk('dowee_map', { inputs: { V: num(512), FL: num(0), FH: num(1023), TL: num(0), TH: num(255) } }), blk('math_constrain', { inputs: { VALUE: num(50), LOW: num(0), HIGH: num(100) } }),
        blk('dowee_minmax', { inputs: { A: num(1), B: num(2) } }), blk('math_single'), blk('math_round'), blk('math_modulo', { inputs: { DIVIDEND: num(7), DIVISOR: num(2) } }), blk('dowee_intdiv', { inputs: { A: num(7), B: num(2) } })] : [])]),
    ...(full ? [cat('Text & Serial', C.text, [blk('dowee_print', { inputs: { V: { shadow: { type: 'text', fields: { TEXT: 'Hello!' } } } } }), blk('dowee_print_inline', { inputs: { V: { shadow: { type: 'text', fields: { TEXT: 'x = ' } } } } }),
      blk('text'), blk('text_join'), blk('dowee_serial_has'), blk('dowee_serial_num'), blk('dowee_comment')])] : []),
    ...(full ? [cat('Pins', C.pins, [blk('dowee_pin_write'), blk('dowee_pin_read'), blk('dowee_analog_read'), blk('dowee_analog_write', { inputs: { V: num(128) } }), blk('dowee_pulse_in')])] : []),
    { kind: 'category', name: 'Variables', colour: C.vars, custom: 'DOWEE_VARS' },
    ...(full ? [{ kind: 'category', name: 'Lists', colour: C.list, custom: 'DOWEE_LISTS' }, { kind: 'category', name: 'My blocks', colour: C.func, custom: 'PROCEDURE' }] : []),
  ] };
};
// Variables flyout: three ways to make one (whole number, decimal, true/false), then the blocks for each.
const VAR_KINDS = [['int', 'Make a whole-number variable'], ['float', 'Make a decimal variable'], ['bool', 'Make a true/false variable']];
function varsFlyout(ws) {
  const out = VAR_KINDS.map(([t, text]) => ({ kind: 'button', text, callbackKey: 'mkvar-' + t }));
  const vars = ws.getAllVariables().filter(x => x.type !== 'list').sort((a, b) => a.name.localeCompare(b.name));
  const label = x => ({ int: 'whole number', float: 'decimal', bool: 'true/false', long: 'whole number' }[x.type] || 'number');
  for (const x of vars) {
    const field = { VAR: { id: x.getId() } };
    out.push({ kind: 'label', text: `${x.name} (${label(x)})` });
    out.push({ kind: 'block', type: 'dowee_var_set', fields: field, inputs: { VALUE: x.type === 'bool' ? { shadow: { type: 'logic_boolean' } } : { shadow: { type: 'math_number', fields: { NUM: 0 } } } } });
    if (x.type !== 'bool') out.push({ kind: 'block', type: 'dowee_var_change', fields: field, inputs: { DELTA: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } });
    out.push({ kind: 'block', type: 'dowee_var_get', fields: field });
  }
  return out;
}
function listsFlyout(ws) {
  const out = [{ kind: 'button', text: 'Make a list of numbers', callbackKey: 'mkvar-list' }];
  for (const x of ws.getAllVariables().filter(v => v.type === 'list')) {
    const field = { VAR: { id: x.getId() } }, n = k => ({ shadow: { type: 'math_number', fields: { NUM: k } } });
    out.push({ kind: 'label', text: `${x.name} (items 1 to ${LIST_SIZE})` });
    out.push({ kind: 'block', type: 'dowee_list_set', fields: field, inputs: { I: n(1), V: n(0) } });
    out.push({ kind: 'block', type: 'dowee_list_get', fields: field, inputs: { I: n(1) } });
  }
  return out;
}

/* ---------------- the Blocks editor ---------------- */
async function showBlocks() {
  $('#editor').hidden = true; $('#blkWrap').hidden = false; $('#btnToCode').hidden = false;
  const msg = $('#blkMsg');
  try { msg.hidden = false; msg.textContent = 'Loading blocks…'; await loadBlockly(); msg.hidden = true; }
  catch (e) { msg.hidden = false; msg.textContent = 'The blocks could not load. Check the internet connection, or switch back to Code.'; return; }
  defineDoweeBlocks();
  if (!BK.ws) {
    const theme = Blockly.Theme.defineTheme('dowee', {
      base: Blockly.Themes.Classic,
      blockStyles: { logic_blocks: { colourPrimary: C.logic }, loop_blocks: { colourPrimary: C.control }, math_blocks: { colourPrimary: C.math }, variable_blocks: { colourPrimary: C.vars }, variable_dynamic_blocks: { colourPrimary: C.vars }, text_blocks: { colourPrimary: C.text }, procedure_blocks: { colourPrimary: C.func } },
      categoryStyles: {},
      componentStyles: { workspaceBackgroundColour: '#fffdf8', toolboxBackgroundColour: '#eef8f6', toolboxForegroundColour: '#2e2a4f', flyoutBackgroundColour: '#e2f3f0', flyoutOpacity: 0.96, scrollbarColour: '#c9d9d5', insertionMarkerColour: '#2e2a4f' },
      fontStyle: { family: 'Nunito, system-ui, sans-serif', weight: '800', size: 12 },
      startHats: true,
    });
    BK.level = toolboxLevel();
    BK.ws = Blockly.inject($('#blocklyDiv'), { toolbox: TOOLBOX(BK.level), theme, sounds: false, trashcan: false, renderer: 'zelos', zoom: { controls: false, wheel: true, startScale: 0.75, maxScale: 2, minScale: 0.4 }, grid: { spacing: 24, length: 2, colour: '#e6efe9', snap: true }, move: { scrollbars: true, drag: true, wheel: false } });
    BK.ws.registerToolboxCategoryCallback('DOWEE_VARS', varsFlyout);
    BK.ws.registerToolboxCategoryCallback('DOWEE_LISTS', listsFlyout);
    for (const t of ['int', 'float', 'bool', 'list']) BK.ws.registerButtonCallback('mkvar-' + t, btn => Blockly.Variables.createVariableButtonHandler(btn.getTargetWorkspace(), null, t));
    BK.ws.addChangeListener(e => {
      if (e.type === Blockly.Events.SELECTED) { blkSelectLines(e.newElementId); return; }
      if (BK.suppress || e.isUiEvent) return;
      saveBlocks();
    });
    new ResizeObserver(() => { if (BK.ws && !$('#blkWrap').hidden) Blockly.svgResize(BK.ws); }).observe($('#blocklyDiv'));
  }
  setToolboxLevel();
  loadWorkspace(S.arena, S.robot);
  Blockly.svgResize(BK.ws);
  requestAnimationFrame(() => { Blockly.svgResize(BK.ws); BK.ws.scrollCenter(); });
}
function setToolboxLevel() {
  if (!BK.ws) return;
  const lv = toolboxLevel(); if (lv === BK.level) return;
  BK.level = lv; BK.ws.updateToolbox(TOOLBOX(lv));
}
function lessonBlocksXml(a) {
  const L = S.lesson && findLesson(S.lesson), b = L && (L.base || L);
  return b && b.blocksXml && L.arena === a ? b.blocksXml() : null;
}
function loadWorkspace(a, r) {
  BK.suppress = true;
  BK.ws.clear();
  const saved = store.get(blkKey(a, r), null);
  const ex = BLOCK_EXAMPLES[a] || BLOCK_EXAMPLES.lab;
  const xml = saved || lessonBlocksXml(a) || ex[blockStarterOf(a)].xml();
  try { Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), BK.ws); } catch (e) { BK.ws.clear(); Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(BLOCK_EXAMPLES.lab.meter.xml()), BK.ws); }
  if (!saved) BK.ws.cleanUp();   // starters are laid out by Blockly, so hats never overlap
  BK.arena = a; BK.robot = r; BK.suppress = false;
  saveBlocks();
  BK.ws.scrollCenter();
}
const blkKey = (a, r) => `blocks:${a}:${r}`, blkCodeKey = (a, r) => `blockcode:${a}:${r}`;
function saveBlocks() {
  if (!BK.ws || BK.arena !== S.arena || BK.robot !== S.robot) return;
  const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(BK.ws));
  const code = blocksToArduino(BK.ws);
  store.set(blkKey(BK.arena, BK.robot), xml); store.set(blkCodeKey(BK.arena, BK.robot), code);
  renderBlkCode(code);
  if (S.tuneFromBlocks) buildTune();
}
// The code view beside the blocks: the same colours as the editor, one row per line so lines can light up.
function renderBlkCode(code) {
  const html = highlight(code).replace(/\n $/, '').split('\n');
  $('#blkCode').innerHTML = html.map((l, i) => `<span class="ln" data-l="${i + 1}"><i>${i + 1}</i>${l || ' '}</span>`).join('');
  $('#blkNote').textContent = BK.loose ? `${BK.loose} block${BK.loose > 1 ? 's are' : ' is'} not connected, so ${BK.loose > 1 ? 'they don\'t' : 'it doesn\'t'} run (see the ⚠ on the block).` : '';
  if (BK.sel) blkSelectLines(BK.sel);
}
// Clicking a block lights up the code it wrote; clicking a code line selects its block.
function blockLines(id) {
  if (!id || !BK.ws) return [];
  const ids = new Set([id]); const b = BK.ws.getBlockById(id);
  if (b) b.getDescendants(false).forEach(d => ids.add(d.id));
  return BK.lineMap.map((x, i) => (x && ids.has(x) ? i : 0)).filter(Boolean);
}
function blkSelectLines(id) {
  BK.sel = id || null;
  $$('#blkCode .ln.sel').forEach(x => x.classList.remove('sel'));
  const ls = blockLines(id); ls.forEach(n => { const el = $(`#blkCode .ln[data-l="${n}"]`); if (el) el.classList.add('sel'); });
  const first = ls.length && $(`#blkCode .ln[data-l="${ls[0]}"]`); if (first) first.scrollIntoView({ block: 'nearest' });
}
$('#blkCode').addEventListener('click', e => {
  const ln = e.target.closest('.ln'); if (!ln || !BK.ws) return;
  const id = BK.lineMap[+ln.dataset.l]; const b = id && BK.ws.getBlockById(id);
  if (b) { b.select(); BK.ws.centerOnBlock(id); } else blkSelectLines(null);
});
// While Dowee runs, the block it is on glows (from the board's current line).
function glowRunningBlock() {
  if (!BK.ws || $('#blkWrap').hidden) return;
  const on = S.running && !S.paused && S.W && modeOf(S.arena, 'A') === 'blocks' && S.robot === 'A';
  let id = null;
  if (on) { const bd = S.W.robots[0].board; id = BK.lineMap[bd.line] || null; for (let i = (bd.calls || []).length - 1; !id && i >= 0; i--) id = BK.lineMap[bd.calls[i]] || null; }
  if (id === BK.glow) return;
  BK.glow = id; BK.ws.highlightBlock(id);
}
// A compile or run error on a line points at the block that wrote it.
function blockForError(line, msg) {
  if (!BK.ws || modeOf(S.arena, S.robot) !== 'blocks') return;
  const id = BK.lineMap[line], b = id && BK.ws.getBlockById(id);
  if (b) { b.setWarningText(msg); b.select(); BK.ws.centerOnBlock(id); }
}
function blocksCode(a, r) { return store.get(blkCodeKey(a, r), null); }
function showCode() { $('#editor').hidden = false; $('#blkWrap').hidden = true; $('#btnToCode').hidden = true; renderEditor(); }
function applyMode() {
  const m = modeOf(S.arena, S.robot);
  $$('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
  $('#work').classList.toggle('blk-mode', m === 'blocks');
  if (m === 'blocks') showBlocks(); else showCode();
}
function setBlkCodeShown(on) { BK.showCode = on; store.set('blkShowCode', on); $('#blkWrap').classList.toggle('no-code', !on); $('#blkShow').setAttribute('aria-pressed', on); $('#blkShow').textContent = on ? 'Hide code' : 'Show code'; if (BK.ws) setTimeout(() => Blockly.svgResize(BK.ws), 0); }
setBlkCodeShown(BK.showCode);
$('#blkShow').addEventListener('click', () => setBlkCodeShown(!BK.showCode));
$('#blkUndo').addEventListener('click', () => BK.ws && BK.ws.undo(false));
$('#blkRedo').addEventListener('click', () => BK.ws && BK.ws.undo(true));
$('#blkZoomIn').addEventListener('click', () => BK.ws && BK.ws.zoomCenter(1));
$('#blkZoomOut').addEventListener('click', () => BK.ws && BK.ws.zoomCenter(-1));
$('#blkTidy').addEventListener('click', () => { if (BK.ws) { BK.ws.cleanUp(); BK.ws.scrollCenter(); } });
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
function loadBlockExample(a, k) {
  if (!BK.ws || !BLOCK_EXAMPLES[a] || !BLOCK_EXAMPLES[a][k]) return;
  BK.suppress = true; BK.ws.clear();
  Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(BLOCK_EXAMPLES[a][k].xml()), BK.ws);
  BK.ws.cleanUp();
  BK.suppress = false; saveBlocks(); BK.ws.scrollCenter();
  toast(`Loaded: ${BLOCK_EXAMPLES[a][k].name}. Undo with the ↶ button.`);
}
// Which block examples a student may load: the starter of each playground, plus what the teacher unlocked.
function blockExamplesFor(a) {
  const ex = BLOCK_EXAMPLES[a] || {}; if (!samplesLocked()) return Object.keys(ex);
  const un = new Set(classSettings().unlocked || []);
  return Object.keys(ex).filter(k => ex[k].starter || un.has(`blk:${a}/${k}`));
}
// For the tests (tools/blocks-check.js): turn block XML into Arduino code without touching the editor.
window.__doweeBlocks = {
  async toCode(xml) {
    await loadBlockly(); defineDoweeBlocks();
    const ws = new Blockly.Workspace();
    try { Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), ws); return blocksToArduino(ws, { noMap: true }); } finally { ws.dispose(); }
  },
  state: () => BK,
  examples: () => Object.fromEntries(Object.entries(BLOCK_EXAMPLES).map(([a, ex]) => [a, Object.fromEntries(Object.entries(ex).map(([k, e]) => [k, e.xml()]))])),
};
