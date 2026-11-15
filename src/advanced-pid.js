/* =====================================================================
   Advanced PID: students write a full P + I + D line follower.
   - "Fill in the blanks" as a worksheet (boxes with feedback) or in the editor (____).
   - "Build your own PID racer": a template with a step-by-step guide whose
     checkpoints read the student's variables while the program runs.
   ===================================================================== */
// Read a global variable of Dowee A's running program (null if there is none).
function globalOf(W, name) {
  const P = W.robots[0].board.prog; if (!P || !P.G) return null;
  const g = P.globals.find(x => x.name === name);
  return g ? P.G[g.slot] : null;
}

const aswap = (text, a, b) => { if (!text.includes(a)) throw new Error('Advanced PID: text not found: ' + a.slice(0, 40)); return text.replace(a, b); };
const PID_GLOBALS = (kp, ki, kd, speed) => `// ---- Tune these in the Tune tab while the robot drives ----
float Kp = ${kp};       // P: turn harder when the line is far away
float Ki = ${ki};       // I: fixes a robot that always drifts to one side
float Kd = ${kd};     // D: brakes the turn before it overshoots
int baseSpeed = ${speed};  // cruising speed, 0-255
float iLimit = 40;    // anti-windup: the biggest the integral may get

${LINE_GLOBALS}

float error = 0;      // where the line is now: -2 (far left) .. 0 .. +2 (far right)
float lastError = 0;  // where it was 10 ms ago
float integral = 0;   // all the errors added up`;
const PID_SETUP = `void setup() {
${PINMODES}
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  calibrate();
}`;

// The full program. {{n}} marks blank n.
const PIDI_FULL = `// Advanced PID line follower: P, I and D, with calibration
// Five IR sensors on A0 (far left) to A4 (far right).

${MOTOR_SETUP}

${PID_GLOBALS('70', '0.5', '1000', '200')}

${PID_SETUP}

${DRIVE_FN}

${aswap(CALIBRATE_FN, '  threshold = (avgWhite + avgBlack) / 2;', '  threshold = {{1}};')}

${aswap(aswap(aswap(READLINE_FN, '    onLine[i] = analogRead(A0 + i) > threshold ? 1 : 0;\n    seen += onLine[i];\n    sum += onLine[i] * (i + 1);\n',
  '    onLine[i] = {{2}};\n    {{3}};\n    {{4}};\n'), '  if (seen > 0) position = (float)sum / seen;', '  if (seen > 0) position = {{5}};'), '// Reads all 5 sensors', '// Reads all 5 sensors')}

void loop() {
  readLine();
  error = {{6}};
  float change = error - lastError;
  integral = {{7}};
  float turn = {{8}};
  drive({{9}});
  {{10}};
  delay(10);   // the same time every loop
}
`;
const PID_BLANKS = [
  { q: 'The threshold: halfway between the average white and the average black.', a: ['(avgWhite + avgBlack) / 2'], hint: 'Halfway between two numbers is their sum divided by 2. Use brackets: <code class="k">(a + b) / 2</code>.' },
  { q: 'Is sensor i on the line? 1 if its reading is above the threshold, else 0.', a: ['analogRead(A0 + i) > threshold ? 1 : 0', '(analogRead(A0 + i) > threshold) ? 1 : 0'], hint: 'Read it with <code class="k">analogRead(A0 + i)</code>, compare with <code class="k">&gt; threshold</code>, then <code class="k">? 1 : 0</code>.' },
  { q: 'Count the sensors that see the line: add <code class="k">onLine[i]</code> to <code class="k">seen</code>.', a: ['seen += onLine[i]', 'seen = seen + onLine[i]'], hint: 'Use <code class="k">+=</code> to add to a variable.' },
  { q: 'Add this sensor\'s number (i + 1) to <code class="k">sum</code>, but only if it sees the line.', a: ['sum += onLine[i] * (i + 1)', 'sum = sum + onLine[i] * (i + 1)'], hint: '<code class="k">onLine[i]</code> is 0 or 1, so multiplying by it adds the number only when the sensor sees the line.' },
  { q: 'The position is the average of the sensors that see the line.', a: ['(float)sum / seen', 'sum / (float)seen'], hint: 'An average is the sum divided by how many. Write <code class="k">(float)</code> first, or 5 / 2 gives 2 instead of 2.5.' },
  { q: 'The error: how far the line is from the middle sensor (number 3).', a: ['position - 3'], hint: 'Positive means the line is to the right. The middle is 3.' },
  { q: 'I: add this error to the integral, and keep it between <code class="k">-iLimit</code> and <code class="k">iLimit</code> (anti-windup).', a: ['constrain(integral + error, -iLimit, iLimit)', 'constrain(error + integral, -iLimit, iLimit)'], hint: '<code class="k">constrain(value, low, high)</code> keeps a value between low and high. The value is <code class="k">integral + error</code>.' },
  { q: 'The PID formula: the P part + the I part + the D part.', a: ['Kp * error + Ki * integral + Kd * change'], hint: 'Each part is its gain times its number: <code class="k">Kp * error</code>, <code class="k">Ki * integral</code>, <code class="k">Kd * change</code>.' },
  { q: 'The two wheel speeds: when the line is on the right (turn > 0), the left wheel goes faster.', a: ['baseSpeed + turn, baseSpeed - turn'], hint: 'Left wheel first: <code class="k">baseSpeed + turn</code>, then the right wheel.' },
  { q: 'Remember this error for next time.', a: ['lastError = error'], hint: 'In 10 ms, <code class="k">lastError</code> must hold this error.' },
];
// Make two answers comparable: no spaces, no ";", "x += y" means "x = x + y", and the order of
// things added or multiplied at the top level doesn't matter.
function canonAnswer(s) {
  s = String(s || '').replace(/\/\/.*$/gm, '').replace(/\s+/g, '').replace(/;+$/, '').replace(/(\d)L\b/g, '$1');
  const m = s.match(/^(\w+)\+=(.+)$/); if (m) s = `${m[1]}=${m[1]}+${m[2]}`;
  const split = (t, ch) => { const out = []; let d = 0, cur = ''; for (const c of t) { if (c === '(') d++; if (c === ')') d--; if (c === ch && d === 0) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
  const expr = t => split(t, '+').map(term => split(term, '*').sort().join('*')).sort().join('+');
  return split(s, ',').map(part => { const eq = part.indexOf('='); return eq > 0 && part[eq + 1] !== '=' && !'<>!'.includes(part[eq - 1]) ? part.slice(0, eq) + '=' + expr(part.slice(eq + 1)) : expr(part); }).join(',');
}
function blankRight(i, answer) { const c = canonAnswer(answer); return !!c && PID_BLANKS[i].a.some(a => canonAnswer(a) === c); }
const fillBlanks = answers => PIDI_FULL.replace(/\{\{(\d+)\}\}/g, (m, n) => answers[n - 1] == null ? '____' : String(answers[n - 1]).trim().replace(/;+$/, ''));
// In-editor version: ____ in place of every blank, with the question in a comment above.
const PIDI_EDITOR = PIDI_FULL.split('\n').map(line => {
  const m = line.match(/\{\{(\d+)\}\}/); if (!m) return line;
  const indent = line.match(/^\s*/)[0], q = PID_BLANKS[m[1] - 1].q.replace(/<[^>]+>/g, '');
  return `${indent}// BLANK ${m[1]}: ${q}\n${line.replace(/\{\{\d+\}\}/g, '____')}`;
}).join('\n').replace(/^\/\/ Advanced PID line follower: P, I and D, with calibration/, '// Advanced PID: fill in the blanks\n// Replace every ____ with your answer. The comment above each one says what goes there.');

const snakeUnder = sec => W => W.arena.id === 'line' && W.state.laps && W.state.laps.some(l => l.time < sec);
const PIDI_STEPS = ['Open the <b>Tune</b> tab and set <code class="k">Ki</code> to 5 while Dowee drives. Watch the trail: it starts to wiggle more.', 'Now change the integral line to <code class="k">integral = integral + error;</code> (no limit) and run again. The integral can grow and grow (this is called <b>windup</b>), so Dowee keeps steering after the line has moved.', 'Put the <code class="k">constrain</code> back and set <code class="k">Ki</code> to 0.5 again.'];
const I_WORTH = '<br><br><b>Is I worth it?</b> The I part adds up the error over time. If Dowee always sits a little to one side (for example because one motor is weaker), the sum keeps growing and pushes it back to the middle. But on a normal Dowee the line moves all the time, so I mostly adds wiggle, and without a limit it "winds up". That is why most line-follower racers use only P and D, or a very small, limited I.';

// Build-your-own template: stubs for the student, with fixed names the guide reads.
const PIDI_GUIDED = `// Build your own PID racer (guided)
// Follow the guide in the Lessons tab, one step at a time.
// Keep these variable names: the guide checks minV, maxV, threshold, error, integral, Kp and Ki while your program runs.

${MOTOR_SETUP}

${aswap(PID_GLOBALS('70', '0', '1000', '150'), 'int threshold = 500;   // above this = the sensor sees the line (calibrate() works out the real one)', 'int threshold = 0;     // above this = the sensor sees the line (STEP 1 works it out)')}

${PID_SETUP}

${DRIVE_FN}

// STEP 1: calibrate. Sweep left and right over the line for 2 seconds.
// While sweeping, read all 5 sensors and remember each one's whitest (minV) and blackest (maxV) value.
// Then the threshold is halfway between the average white and the average black.
void calibrate() {
  unsigned long start = millis();
  while (millis() - start < 2000) {
    // TODO: spin one way, then the other. (millis() - start tells you how long you have been sweeping.)

    // TODO: for each sensor i, update minV[i] and maxV[i].

  }
  drive(0, 0);
  // TODO: average the minV values, average the maxV values, and set the threshold halfway between them.

}

// STEP 2: where is the line? For each sensor: onLine[i] is 1 when it reads above the threshold.
// seen counts them, and position is the average of (i + 1) of the sensors that see the line:
// 1 (far left) .. 3 (middle) .. 5 (far right). If no sensor sees the line, keep the last position.
void readLine() {
  // TODO: like in PID 2.

}

void loop() {
  readLine();
  error = position - 3;

  // Simple steering for now, so you can test step 2. In STEP 3 you replace it with P and D.
  // STEP 4: add I, with an anti-windup limit.
  float turn = 0;
  if (error > 0.5) turn = 50;
  if (error < -0.5) turn = -50;

  lastError = error;
  drive(baseSpeed + turn, baseSpeed - turn);
  delay(10);   // the same time every loop
}
`;
// Guide steps. check(W, memo) runs about 5 times a second while the program runs; memo starts empty each run.
const PIDI_GUIDE = [
  { title: 'Calibrate', text: 'Real sensors all read a little differently, and every floor is different. <code class="k">calibrate()</code> sweeps over the line, remembers the whitest and blackest value each sensor sees, and puts the <b>threshold</b> halfway between the average white and the average black.',
    hints: ['Spin with <code class="k">drive(-120, 120)</code> (left) and <code class="k">drive(120, -120)</code> (right). Dowee starts on the line, so sweep left 250 ms, right 500 ms, left 500 ms, right 500 ms, left 250 ms.', 'For each sensor: <code class="k">int v = analogRead(A0 + i); if (v &lt; minV[i]) minV[i] = v; if (v &gt; maxV[i]) maxV[i] = v;</code>', 'Add up the five minV values and divide by 5 (the average white), the same for maxV, then <code class="k">threshold = (avgWhite + avgBlack) / 2;</code>'],
    check: 'Every sensor learned white and black (white below 300, black above 700), and the threshold is between them', ok: W => W.time > 2200 && calibrated(W) },
  { title: 'Find the line', text: 'Write <code class="k">readLine()</code>, like in PID 2: on or off for each sensor, then the average position. The simple steering in <code class="k">loop()</code> uses it, so Dowee should already follow the line roughly.',
    hints: ['<code class="k">onLine[i] = analogRead(A0 + i) &gt; threshold ? 1 : 0;</code>', 'Count and add up: <code class="k">seen += onLine[i]; sum += onLine[i] * (i + 1);</code> (start with <code class="k">seen = 0</code> and <code class="k">sum = 0</code>).', 'After the loop: <code class="k">if (seen &gt; 0) position = (float)sum / seen;</code>'],
    check: '<code class="k">error</code> follows the line: negative when it is on the left, positive on the right',
    ok: (W, m) => {
      const e = globalOf(W, 'error'); if (e == null || W.time < 2500) return false;
      const r = W.robots[0], refl = [0, 1, 2, 3, 4].map(i => r.reflect(i)), dark = refl.indexOf(Math.min(...refl));
      if (refl[dark] > 0.5) return false;   // no sensor is over the line right now
      const right = dark === 2 ? Math.abs(e) < 0.6 : (dark < 2 ? e < -0.4 : e > 0.4);
      m.n = (m.n || 0) + 1; m.good = (m.good || 0) + (right ? 1 : 0); if (right && dark !== 2) m.side = true;
      return m.n >= 8 && m.good / m.n >= 0.85 && !!m.side;
    } },
  { title: 'P and D', text: 'Replace the simple steering in <code class="k">loop()</code> with <code class="k">turn = Kp * error + Kd * (error - lastError)</code>, like PID 3 and 4.',
    hints: ['P part: <code class="k">Kp * error</code>. D part: <code class="k">Kd * (error - lastError)</code>.', 'Use the D part <b>before</b> the line <code class="k">lastError = error;</code>'],
    check: 'Lap the Oval with less than 8 mm of wiggle', ok: W => W.state.laps && W.state.laps.some(l => l.rms < 8) && W.variant === 'oval' && !(W.robots[0].cfg.mismatch > 0) },
  { title: 'Add I, with a limit', robot: { mismatch: 30 }, text: 'Press the button to swap to a Dowee whose <b>right motor is 30% weaker</b>. Set <code class="k">Kp</code> to 20 (gentle) and run: Dowee rides off to one side of the line. Add the I part: it adds up the error, so a steady drift keeps growing the push back. Keep the integral between <code class="k">-iLimit</code> and <code class="k">iLimit</code>, or it winds up.',
    hints: ['Add this line before the turn: <code class="k">integral = constrain(integral + error, -iLimit, iLimit);</code>', '<code class="k">float turn = Kp * error + Ki * integral + Kd * (error - lastError);</code>', 'Then try <code class="k">Ki</code> values in the Tune tab, starting with 1.'],
    check: 'On the weak-motor Dowee, with Kp at 20 or less and Ki above 0: lap the Oval with less than 6 mm of wiggle, and the integral stays within ±50',
    ok: (W, m) => {
      if (!(W.robots[0].cfg.mismatch >= 30) || W.variant !== 'oval') return false;
      const kp = globalOf(W, 'Kp'), ki = globalOf(W, 'Ki'), it = globalOf(W, 'integral');
      if (it != null) m.maxI = Math.max(m.maxI || 0, Math.abs(it));
      if (kp == null || ki == null || !(kp <= 20) || !(ki > 0) || m.maxI > 50) return false;
      return W.state.laps && W.state.laps.some(l => l.rms < 6);
    } },
  { title: 'Race', text: 'Swap back to the normal Dowee and switch the track to the <b>Snake</b>. Raise <code class="k">baseSpeed</code> and tune Kp, Ki and Kd in the Tune tab. Every lap is logged, so you can compare.',
    hints: ['Raise <code class="k">baseSpeed</code> to about 220, set Kp back to 70 and Kd to 1000, and Ki to 0.', 'If it wiggles more with I, make Ki smaller (or 0). The weak-motor problem is gone on the normal Dowee.'],
    check: 'Lap the Snake in under 12 seconds on the normal Dowee', ok: W => W.variant === 'snake' && !(W.robots[0].cfg.mismatch > 0) && snakeUnder(12)(W) },
];

// Advanced PID 4: weight each sensor by how dark it sees the floor, instead of on/off. Smoother.
const PIDI_GREY = aswap(PIDI_FULL.replace(/\{\{(\d+)\}\}/g, (m, n) => PID_BLANKS[n - 1].a[0]).replace('float Ki = 0.5;', 'float Ki = 0;  ').replace('int baseSpeed = 200;', 'int baseSpeed = 220;').replace('// Advanced PID line follower: P, I and D, with calibration', '// Advanced PID 4: shades of grey'),
  '  if (seen > 0) position = (float)sum / seen;   // no line: keep the last position\n}',
  `  if (seen > 0) position = (float)sum / seen;   // no line: keep the last position

  // TODO: on/off only knows "on the line" or "not". A sensor half over the line reads grey,
  // and that tells you more. Instead of the average above, weight each sensor by how dark it is:
  //   for each sensor:  long dark = constrain(map(analogRead(A0 + i), minV[i], maxV[i], 0, 1000), 0, 1000);
  //                     add  dark * (i + 1)  to a weighted sum, and  dark  to a total
  //   then (when seen > 0):  position = (float)weighted / total;
}`);

const ADV_PID = [
  { id: 'apid1', title: 'Advanced PID 1: Fill in the blanks (worksheet)', level: 'Advanced PID', arena: 'line', variant: 'snake', code: PIDI_EDITOR, worksheet: true,
    intro: 'Here is a complete PID line follower, with calibration and <b>P</b>, <b>I</b> and <b>D</b>, but 10 pieces are missing. Fill in each box, press <b>Check my answers</b>, then put the program in your editor and race it.' + I_WORTH,
    steps: ['Fill in the boxes in the worksheet below. Each one has a question.', 'Press <b>Check my answers</b>. Green means right. Orange gives you a hint.', 'Press <b>Put it in my code</b> and <b>Upload &amp; run</b>.', ...PIDI_STEPS],
    goal: 'Lap the Snake in under 14 seconds', check: snakeUnder(14) },
  { id: 'apid2', title: 'Advanced PID 2: Fill in the blanks (in the editor)', level: 'Advanced PID', arena: 'line', variant: 'snake', code: PIDI_EDITOR,
    intro: 'The same complete PID line follower, but this time you fill in the blanks right in the code, like a real programmer. Every <code class="k">____</code> needs an answer. The comment above it says what goes there.' + I_WORTH,
    steps: ['Find every <code class="k">____</code> in the editor (there are 10).', 'Replace each one with your answer. Press <b>Verify</b> to check the code without running it.', 'If the error says a line still has a blank, read the BLANK comment above that line.', 'Press <b>Upload &amp; run</b>.', ...PIDI_STEPS],
    hints: PID_BLANKS.map((b, i) => `Blank ${i + 1}: ${b.hint}`),
    goal: 'Lap the Snake in under 14 seconds', check: snakeUnder(14) },
  { id: 'apid3', title: 'Advanced PID 3: Build your own PID racer', level: 'Advanced PID', arena: 'line', variant: 'oval', code: PIDI_GUIDED, guide: PIDI_GUIDE,
    intro: 'Now you write the whole controller yourself, from calibration to the I part. Follow the guide below one step at a time. Each step ticks itself off when your program does it.',
    steps: ['Work through the 5 steps in the guide. Run your program after each step.', 'Stuck? Every step has hints.'],
    goal: 'Finish all 5 steps: the last one is a Snake lap under 12 seconds', check: W => W.variant === 'snake' && !(W.robots[0].cfg.mismatch > 0) && snakeUnder(12)(W) },
  { id: 'apid4', title: 'Advanced PID 4: Shades of grey', level: 'Advanced PID', arena: 'line', variant: 'oval', code: PIDI_GREY,
    intro: 'On/off sensors make the position jump in steps: 3, then 3.5, then 4. But a sensor half over the line reads <b>grey</b>, somewhere between white and black. If each sensor counts as much as it is dark, the position slides smoothly between sensors, and Dowee wobbles less. It uses the white and black that <code class="k">calibrate()</code> learned.',
    steps: ['Run it with <b>Trail</b> on and note the wiggle (in mm) in the lap list.', 'Fill in the <b>TODO</b> at the end of <code class="k">readLine()</code>.', 'Run it again and compare the wiggle.'],
    hints: ['Keep the on/off part: <code class="k">seen</code> still tells you when the line is lost or at a crossing.', '<code class="k">long weighted = 0, total = 0;</code> then in a loop: <code class="k">long dark = constrain(map(analogRead(A0 + i), minV[i], maxV[i], 0, 1000), 0, 1000); weighted += dark * (i + 1); total += dark;</code>', 'Then <code class="k">if (seen &gt; 0) position = (float)weighted / total;</code>'],
    goal: 'At baseSpeed 220 or more, lap the Oval with less than 4 mm of wiggle', check: W => W.variant === 'oval' && (globalOf(W, 'baseSpeed') || 0) >= 220 && W.state.laps && W.state.laps.some(l => l.rms < 4) },
];
LESSONS.splice(LESSONS.findIndex(l => l.id === 'pid') + 1, 0, ...ADV_PID);
if (typeof module !== 'undefined') Object.assign(module.exports, { PIDI_FULL, PIDI_EDITOR, PIDI_GUIDED, PIDI_GREY, PID_BLANKS, PIDI_GUIDE, canonAnswer, blankRight, fillBlanks, globalOf });
