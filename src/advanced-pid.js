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

const CALIBRATE_FN = `// Sweep left and right over the line for 2 seconds, remembering each sensor's min and max.
void calibrate() {
  digitalWrite(LED_BUILTIN, HIGH);
  unsigned long start = millis();
  while (millis() - start < 2000) {
    unsigned long t = millis() - start;
    if (t < 250 || (t >= 750 && t < 1250) || t >= 1750) drive(-120, 120);
    else drive(120, -120);
    for (int i = 0; i < 5; i++) {
      int v = analogRead(A0 + i);
      if (v < minV[i]) minV[i] = v;
      if (v > maxV[i]) maxV[i] = v;
    }
  }
  drive(0, 0);
  for (int i = 0; i < 5; i++) {
    if (maxV[i] - minV[i] < 100) maxV[i] = minV[i] + 100;   // sensor never saw the line
  }
  digitalWrite(LED_BUILTIN, LOW);
  delay(300);
}`;
const PID_GLOBALS = (kp, ki, kd, speed) => `// ---- Tune these in the Tune tab while the robot drives ----
float Kp = ${kp};      // P: turn harder when the line is far away
float Ki = ${ki};    // I: fixes a robot that always drifts to one side
float Kd = ${kd};       // D: brakes the turn before it overshoots
int baseSpeed = ${speed};  // cruising speed, 0-255
long iLimit = 20000;  // anti-windup: the biggest the integral may get

int minV[5] = {1023, 1023, 1023, 1023, 1023};
int maxV[5] = {0, 0, 0, 0, 0};
int error = 0;        // where the line is now
int lastError = 0;    // where it was last time
long integral = 0;    // all the errors added up`;

// The full program. {{n}} marks blank n.
const PIDI_FULL = `// Advanced PID line follower: P, I and D, with calibration
// Five IR sensors on A0 (far left) to A4 (far right).

${MOTOR_SETUP}

${PID_GLOBALS('0.08', '0.0002', '1.5', '180')}

void setup() {
${PINMODES}
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  calibrate();
}

${DRIVE_FN}

${CALIBRATE_FN}

// One sensor scaled to 0 (white) .. 1000 (black)
int readSensor(int i) {
  long v = map(analogRead(A0 + i), minV[i], maxV[i], 0, 1000);
  return constrain(v, 0, 1000);
}

// Where is the line? -2000 (far left) .. 0 (middle) .. 2000 (far right)
int readLine() {
  long weighted = 0;
  long total = 0;
  for (int i = 0; i < 5; i++) {
    int v = readSensor(i);
    if (v < 100) v = 0;                      // ignore small noise
    long position = {{1}};
    {{2}};
    {{3}};
  }
  if (total < 300) {                         // line lost: keep turning the way we last saw it
    return lastError > 0 ? 2000 : -2000;
  }
  return {{4}};
}

void loop() {
  error = readLine();
  int change = {{5}};
  {{6}};
  integral = {{7}};
  int turn = {{8}};
  drive({{9}});
  {{10}};
  delay(2);
}
`;
const PID_BLANKS = [
  { q: 'Where is sensor i? It should give -2000 for sensor 0, 0 for the middle one and 2000 for sensor 4.', a: ['(i - 2) * 1000', '1000 * (i - 2)'], hint: 'The middle sensor is i = 2. Subtract 2, then multiply by 1000.' },
  { q: 'Add this sensor\'s reading times its position to <code class="k">weighted</code>.', a: ['weighted += v * position', 'weighted = weighted + v * position'], hint: 'Use <code class="k">+=</code> to add to a variable: <code class="k">weighted += …</code>' },
  { q: 'Add this sensor\'s reading to <code class="k">total</code>.', a: ['total += v', 'total = total + v'], hint: 'Just like blank 2, but only the reading <code class="k">v</code>.' },
  { q: 'The weighted average: where the line is.', a: ['weighted / total'], hint: 'An average is the sum divided by how much there was.' },
  { q: 'D: how much did the error change since last time?', a: ['error - lastError'], hint: 'New error minus old error.' },
  { q: 'I: add this error to the running total.', a: ['integral += error', 'integral = integral + error'], hint: 'The integral is all the errors added up: <code class="k">integral += …</code>' },
  { q: 'Anti-windup: keep the integral between <code class="k">-iLimit</code> and <code class="k">iLimit</code>.', a: ['constrain(integral, -iLimit, iLimit)'], hint: '<code class="k">constrain(value, low, high)</code> keeps a value inside a range.' },
  { q: 'The PID formula: the P part + the I part + the D part.', a: ['Kp * error + Ki * integral + Kd * change'], hint: 'Each part is its gain times its number: <code class="k">Kp * error</code>, <code class="k">Ki * integral</code>, <code class="k">Kd * change</code>. Add them.' },
  { q: 'The two wheel speeds: when the line is on the right (turn > 0), the left wheel goes faster.', a: ['baseSpeed + turn, baseSpeed - turn'], hint: 'Left wheel first: <code class="k">baseSpeed + turn</code>, then the right wheel.' },
  { q: 'Remember this error for next time.', a: ['lastError = error'], hint: 'Next time round, <code class="k">lastError</code> must hold today\'s error.' },
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
const PIDI_STEPS = ['Open the <b>Tune</b> tab and set <code class="k">Ki</code> to 0.002 while Dowee drives. Watch the trail: it starts to wiggle more.', 'Now delete the <code class="k">integral = constrain(…)</code> line and run again. The integral grows and grows (this is called <b>windup</b>) until Dowee loses the line.', 'Put the line back and set <code class="k">Ki</code> to 0.0002 again.'];
const I_WORTH = '<br><br><b>Is I worth it?</b> The I part adds up the error over time. If Dowee always sits a little to one side (for example because one motor is weaker), the sum keeps growing and pushes it back to the middle. But on a normal Dowee the line moves all the time, so I mostly adds wiggle, and without a limit it "winds up" and loses the line. That is why most line-follower racers use only P and D, or a very small, limited I.';

// Build-your-own template: stubs for the student, with fixed names the guide reads.
const PIDI_GUIDED = `// Build your own PID racer (guided)
// Follow the guide in the Lessons tab, one step at a time.
// Keep these variable names: the guide checks minV, maxV, error, integral, Kp and Ki while your program runs.

${MOTOR_SETUP}

${PID_GLOBALS('0.08', '0.0', '1.5', '150')}

void setup() {
${PINMODES}
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  calibrate();
}

${DRIVE_FN}

// STEP 1: calibrate. Sweep left and right over the line for 2 seconds.
// While sweeping, read all 5 sensors and remember each one's smallest (minV) and biggest (maxV) value.
void calibrate() {
  unsigned long start = millis();
  while (millis() - start < 2000) {
    // TODO: spin one way, then the other. (millis() - start tells you how long you have been sweeping.)

    // TODO: for each sensor i, update minV[i] and maxV[i].

  }
  drive(0, 0);
}

// STEP 2: one sensor scaled from 0 (white) to 1000 (black), using what calibrate() learned.
int readSensor(int i) {
  // TODO: map the reading from minV[i]..maxV[i] to 0..1000, then constrain it to 0..1000.
  return 0;
}

// STEP 2: where is the line? -2000 (far left) .. 0 (middle) .. 2000 (far right)
int readLine() {
  // TODO: the weighted average of the five sensors, like in PID 1.
  // If no sensor sees the line, return 2000 or -2000 (the side you saw it last).
  return 0;
}

void loop() {
  error = readLine();

  // Simple steering for now, so you can test step 2. In STEP 3 you replace it with P and D.
  // STEP 4: add I, with an anti-windup limit.
  int turn = 0;
  if (error > 300) turn = 50;
  if (error < -300) turn = -50;

  lastError = error;
  drive(baseSpeed + turn, baseSpeed - turn);
  delay(2);
}
`;
// Guide steps. check(W, memo) runs about 5 times a second while the program runs; memo starts empty each run.
const PIDI_GUIDE = [
  { title: 'Calibrate', text: 'Real sensors all read a little differently. <code class="k">calibrate()</code> sweeps over the line and remembers the darkest and brightest value each sensor sees.',
    hints: ['Spin with <code class="k">drive(-120, 120)</code> (left) and <code class="k">drive(120, -120)</code> (right). Dowee starts on the line, so sweep left 250 ms, right 500 ms, left 500 ms, right 500 ms, left 250 ms. Then it ends up back on the line.', '<code class="k">unsigned long t = millis() - start;</code> then <code class="k">if (t &lt; 250 || (t &gt;= 750 &amp;&amp; t &lt; 1250) || t &gt;= 1750) drive(-120, 120); else drive(120, -120);</code>', 'Inside the while loop: <code class="k">for (int i = 0; i &lt; 5; i++) { int v = analogRead(A0 + i); … }</code>', '<code class="k">if (v &lt; minV[i]) minV[i] = v;</code> and <code class="k">if (v &gt; maxV[i]) maxV[i] = v;</code>'],
    check: 'Every sensor learned black and white (min below 300, max above 700)', ok: W => { const a = globalOf(W, 'minV'), b = globalOf(W, 'maxV'); if (!a || !b || W.time < 2200) return false; for (let i = 0; i < 5; i++) if (!(a[i] < 300 && b[i] > 700)) return false; return true; } },
  { title: 'Find the line', text: 'Write <code class="k">readSensor()</code> with <code class="k">map()</code>, then <code class="k">readLine()</code>: the weighted average from PID 1. The simple steering in <code class="k">loop()</code> uses your <code class="k">error</code>, and the guide compares it with where the line really is.',
    hints: ['<code class="k">long v = map(analogRead(A0 + i), minV[i], maxV[i], 0, 1000); return constrain(v, 0, 1000);</code>', 'In readLine, loop over the sensors: <code class="k">weighted += (long)v * (i - 2) * 1000; total += v;</code>', 'After the loop: <code class="k">if (total &lt; 300) return lastError &gt; 0 ? 2000 : -2000;</code> then <code class="k">return weighted / total;</code>'],
    check: '<code class="k">error</code> follows the line: negative when it is on the left, positive on the right',
    ok: (W, m) => {
      const e = globalOf(W, 'error'); if (e == null || W.time < 2500) return false;
      const r = W.robots[0], refl = [0, 1, 2, 3, 4].map(i => r.reflect(i)), dark = refl.indexOf(Math.min(...refl));
      if (refl[dark] > 0.5) return false;   // no sensor is over the line right now
      const right = dark === 2 ? Math.abs(e) < 800 : (dark < 2 ? e < -300 : e > 300);
      m.n = (m.n || 0) + 1; m.good = (m.good || 0) + (right ? 1 : 0); if (right && dark !== 2) m.side = true;
      return m.n >= 8 && m.good / m.n >= 0.85 && !!m.side;
    } },
  { title: 'P and D', text: 'Replace the simple steering in <code class="k">loop()</code> with <code class="k">turn = Kp * error + Kd * (error - lastError)</code>, like PID 2 and 3.',
    hints: ['P part: <code class="k">Kp * error</code>. D part: <code class="k">Kd * (error - lastError)</code>.', 'Use the D part <b>before</b> the line <code class="k">lastError = error;</code>'],
    check: 'Lap the Oval with less than 8 mm of wiggle', ok: W => W.state.laps && W.state.laps.some(l => l.rms < 8) && W.variant === 'oval' && !(W.robots[0].cfg.mismatch > 0) },
  { title: 'Add I, with a limit', robot: { mismatch: 30 }, text: 'Press the button to swap to a Dowee whose <b>right motor is 30% weaker</b>. Set <code class="k">Kp</code> to 0.04 (gentle) and run: Dowee rides off to one side. Now add the I part: <code class="k">integral += error;</code>, limit it with <code class="k">constrain(integral, -iLimit, iLimit)</code>, and add <code class="k">Ki * integral</code> to the turn. Try <code class="k">Ki</code> = 0.001.' + I_WORTH,
    hints: ['Add these two lines before the turn: <code class="k">integral += error;</code> and <code class="k">integral = constrain(integral, -iLimit, iLimit);</code>', '<code class="k">int turn = Kp * error + Ki * integral + Kd * (error - lastError);</code>', 'Without the <code class="k">constrain</code> line the integral "winds up" and Dowee loses the line. Try it!'],
    check: 'On the weak-motor Dowee, with Kp at 0.05 or less and Ki above 0: lap the Oval with less than 6 mm of wiggle, and the integral never goes above 50000',
    ok: (W, m) => {
      if (!(W.robots[0].cfg.mismatch >= 30) || W.variant !== 'oval') return false;
      const kp = globalOf(W, 'Kp'), ki = globalOf(W, 'Ki'), it = globalOf(W, 'integral');
      if (it != null) m.maxI = Math.max(m.maxI || 0, Math.abs(it));
      if (kp == null || ki == null || !(kp <= 0.05) || !(ki > 0) || m.maxI > 50000) return false;
      return W.state.laps && W.state.laps.some(l => l.rms < 6);
    } },
  { title: 'Race', text: 'Swap back to the normal Dowee and switch the track to the <b>Snake</b>. Raise <code class="k">baseSpeed</code> and tune Kp, Ki and Kd in the Tune tab. Every lap is logged, so you can compare.',
    hints: ['Faster needs more steering: try <code class="k">baseSpeed = 200</code> with <code class="k">Kp = 0.1</code> and <code class="k">Kd = 2</code>.', 'If it wiggles more with I, make Ki smaller (or 0). The weak-motor problem is gone on the normal Dowee, and racers often don\'t need I at all.', 'Still too slow? Go up to <code class="k">baseSpeed = 230</code> and raise <code class="k">Kd</code> to 2.5 so it doesn\'t overshoot.'],
    check: 'Lap the Snake in under 14.5 seconds on the normal Dowee', ok: W => W.variant === 'snake' && !(W.robots[0].cfg.mismatch > 0) && snakeUnder(14.5)(W) },
];

const ADV_PID = [
  { id: 'apid1', title: 'Advanced PID 1: Fill in the blanks (worksheet)', level: 'Advanced PID', arena: 'line', variant: 'snake', code: PIDI_EDITOR, worksheet: true,
    intro: 'Here is a complete PID line follower, with <b>P</b>, <b>I</b> and <b>D</b> and sensor calibration, but 10 pieces are missing. Fill in each box, press <b>Check my answers</b>, then put the program in your editor and race it.' + I_WORTH,
    steps: ['Fill in the boxes in the worksheet below. Each one has a question.', 'Press <b>Check my answers</b>. Green means right. Orange gives you a hint.', 'Press <b>Put it in my code</b> and <b>Upload &amp; run</b>.', ...PIDI_STEPS],
    goal: 'Lap the Snake in under 16 seconds', check: snakeUnder(16) },
  { id: 'apid2', title: 'Advanced PID 2: Fill in the blanks (in the editor)', level: 'Advanced PID', arena: 'line', variant: 'snake', code: PIDI_EDITOR,
    intro: 'The same complete PID line follower, but this time you fill in the blanks right in the code, like a real programmer. Every <code class="k">____</code> needs an answer. The comment above it says what goes there.' + I_WORTH,
    steps: ['Find every <code class="k">____</code> in the editor (there are 10).', 'Replace each one with your answer. Press <b>Verify</b> to check the code without running it.', 'If the error says a line still has a blank, read the BLANK comment above that line.', 'Press <b>Upload &amp; run</b>.', ...PIDI_STEPS],
    hints: PID_BLANKS.map((b, i) => `Blank ${i + 1}: ${b.hint}`),
    goal: 'Lap the Snake in under 16 seconds', check: snakeUnder(16) },
  { id: 'apid3', title: 'Advanced PID 3: Build your own PID racer', level: 'Advanced PID', arena: 'line', variant: 'oval', code: PIDI_GUIDED, guide: PIDI_GUIDE,
    intro: 'Now you write the whole controller yourself, from calibration to the I part. Follow the guide below one step at a time. Each step ticks itself off when your program does it.',
    steps: ['Work through the 5 steps in the guide. Run your program after each step.', 'Stuck? Every step has hints.'],
    goal: 'Finish all 5 steps: the last one is a Snake lap under 14.5 seconds', check: W => W.variant === 'snake' && !(W.robots[0].cfg.mismatch > 0) && snakeUnder(14.5)(W) },
];
LESSONS.splice(LESSONS.findIndex(l => l.id === 'pid') + 1, 0, ...ADV_PID);
if (typeof module !== 'undefined') Object.assign(module.exports, { PIDI_FULL, PIDI_EDITOR, PIDI_GUIDED, PID_BLANKS, PIDI_GUIDE, canonAnswer, blankRight, fillBlanks, globalOf });
