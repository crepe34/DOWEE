/* =====================================================================
   Lessons: a path from "blink an LED" to sumo and soccer.
   ===================================================================== */
const EDGE_STARTER = `// Stay inside the sumo ring.
// The IR array is at the front: A0 = far left, A4 = far right.
// Black ring ≈ 950, white edge ≈ 100.
${MOTOR_SETUP}

void setup() {
${PINMODES}
  Serial.begin(9600);
}

${DRIVE_FN}

void loop() {
  int left = analogRead(A0);
  int right = analogRead(A4);
  Serial.print(left);
  Serial.print(",");
  Serial.println(right);

  // TODO: if left OR right is below 400, the robot is on the white edge!
  //       Back up (negative speeds), wait a little, then turn around.
  //       Hint: if (left < 400 || right < 400) { ... }

  drive(150, 150);
}
`;
const LESSONS = [
  { id: 'blocks', title: 'Your first blocks program', level: 'Blocks', arena: 'lab', variant: 'lab', blocks: true,
    intro: 'No typing needed: snap blocks together to tell Dowee what to do. Every block becomes real Arduino code that you can see under the blocks.',
    steps: ['Press <b>Upload &amp; run</b>. Dowee turns on its light, drives forward, waits, then stops.', 'Change the number in <b>wait 1.5 seconds</b> so Dowee stops on the <b>1 m</b> line.', 'Open <b>Arduino code made by your blocks</b> to see the code your blocks wrote.', 'Ready for more? Press <b>Turn into code</b> to keep going in typed Arduino code.'],
    goal: 'Stop between 95 and 105 cm from the start', check: W => { const r = W.robots[0], d = Math.hypot(r.x - r.start.x, r.y - r.start.y); return W.time > 600 && Math.hypot(r.vx, r.vy) < 0.005 && d > 0.95 && d < 1.05; } },
  { id: 'blink', title: 'Blink the LED', level: 'Start here', arena: 'lab', variant: 'lab', example: 'blink',
    intro: 'Every Arduino has a small LED on pin 13. Turning it on and off is the "hello world" of robotics.',
    steps: ['Press <b>Upload &amp; run</b>. The light on Dowee\'s Arduino board blinks.', 'Change both <code class="k">delay(500)</code> lines to <code class="k">delay(100)</code> and run again. What changed?', '<code class="k">setup()</code> runs once. <code class="k">loop()</code> runs again and again forever.'],
    goal: 'Blink the LED 10 times', check: W => W.robots[0].board.ledToggles >= 20 },
  { id: 'drive', title: 'Drive exactly 1 metre', level: 'Motors', arena: 'lab', variant: 'lab', example: 'meter',
    intro: 'Motors are controlled through a motor driver. analogWrite sets the speed (0–255) and two digitalWrite pins set the direction.',
    steps: ['Run the program and watch <b>Distance</b> in the top-left.', 'Change <code class="k">driveTime</code> until the robot stops between 95 and 105 cm.', 'Try a different <code class="k">speed</code>. Does the time you need change in a straight line? Real motors are not perfectly linear.'],
    goal: 'Stop between 95 and 105 cm from the start', check: W => { const r = W.robots[0], d = Math.hypot(r.x - r.start.x, r.y - r.start.y); return W.time > 600 && Math.hypot(r.vx, r.vy) < 0.005 && d > 0.95 && d < 1.05; } },
  { id: 'turn', title: 'Turn 90 degrees', level: 'Motors', arena: 'lab', variant: 'lab', example: 'turn',
    intro: 'Spinning one wheel forward and the other backward turns the robot on the spot.',
    steps: ['Run it and read <b>Turned</b>. Negative means it turned right (clockwise).', 'Change <code class="k">turnTime</code> until it turns between 85° and 95°.', 'Switch the <b>World</b> menu from <b>Ideal robot</b> to <b>Realistic world</b> and run it again. No two real motors are identical, so the same code turns a different amount!'],
    goal: 'Turn between 85° and 95° and stop', check: W => { const r = W.robots[0], a = Math.abs(r.headingAcc * 180 / Math.PI); return W.time > 300 && Math.abs(r.w) < 0.02 && a > 85 && a < 95; } },
  { id: 'see', title: 'See what the sensors see', level: 'Sensors', arena: 'line', variant: 'oval', example: 'print',
    intro: 'Line sensors shine infrared light at the floor. White reflects a lot (low number), black reflects little (high number).',
    steps: ['Run it and open the <b>Plotter</b> tab. Each coloured line is one sensor.', 'Open <b>Sensors &amp; pins</b>. Which sensor sees the black line?', 'Drag the robot? Not yet — instead change the track and run again to see new values.'],
    goal: 'Print 20 lines of sensor values', check: W => W.robots[0].board.serialLines >= 20 },
  { id: 'follow', title: 'Follow the line with 2 sensors', level: 'Line following', arena: 'line', variant: 'oval', example: 'bang',
    intro: 'The simplest line follower: if the line is on the left, turn left. If it is on the right, turn right. Otherwise go straight.',
    steps: ['Run it. The robot wiggles around the oval.', 'Make <code class="k">speed</code> bigger. At some point it misses the turn — why?', 'Turn on <b>Trail</b> to see the path it really drove.'],
    goal: 'Complete one full lap', check: W => W.state.laps && W.state.laps.length >= 1 },
  { id: 'rc', title: 'Bluetooth RC driver', level: 'Remote control', arena: 'race', variant: 'none', example: 'rc',
    intro: 'A phone app sends letters over Bluetooth: F for forward, L for left, S for stop. The robot reads them with Serial.read().',
    steps: ['Run it, then drive with <b>W A S D</b>, the arrow keys, a gamepad, or the on-screen pad.', 'Watch the Serial monitor: it shows every letter the controller sends.', 'Change the <code class="k">\'L\'</code> and <code class="k">\'R\'</code> cases so turning is gentler.'],
    goal: 'Finish one lap of the race track', check: W => W.state.laps && W.state.laps[0] && W.state.laps[0].length >= 1 },
  { id: 'sonar', title: 'Ultrasonic eyes', level: 'Sensors', arena: 'maze', variant: 'room1', example: 'avoid',
    intro: 'An ultrasonic sensor sends a "ping" and times the echo. Sound travels 0.034 cm per microsecond, there and back.',
    steps: ['Run it and turn on <b>Sensor view</b> to see the sound beam.', 'Change <code class="k">safeDistance</code>. Too small and it bumps; too big and it gets stuck turning.', 'The beam is narrow: corners can hide from it. How could you fix that?'],
    goal: 'Reach the green goal zone', check: W => W.state.done != null },
  { id: 'edge', title: 'Stay inside the ring', level: 'Sumo', arena: 'sumo', variant: 'none', code: EDGE_STARTER,
    intro: 'A sumo robot that drives off the ring loses. The ring is black with a white edge, so line sensors can see the edge.',
    steps: ['Run it: the robot drives straight off the ring.', 'Fill in the <b>TODO</b>: back up with <code class="k">drive(-200, -200); delay(300);</code>, then turn with <code class="k">drive(200, -200); delay(250);</code>.', 'Use the Plotter to see the edge values change.'],
    goal: 'Drive for 20 seconds without falling off', check: W => W.time > 20000 && !W.robots[0].fallen && W.robots[0].odo > 1.5 },
  { id: 'fight', title: 'Win a sumo match', level: 'Sumo', arena: 'sumo', variant: 'hunter', example: 'basic',
    intro: 'Now add an opponent. Find it with the ultrasonic sensor, charge, and stay inside the ring yourself.',
    steps: ['Run it against the Hunter.', 'Try different start positions — a good robot wins from any of them.', 'Tune <code class="k">attackRange</code> and <code class="k">searchSpeed</code>. Then try the Bulldozer!'],
    goal: 'Push the Hunter out of the ring', check: W => W.state.result === 'A' },
  { id: 'soccer', title: 'Score two goals', level: 'Soccer', arena: 'soccer', variant: 'easy', example: 'rc',
    intro: 'Robot soccer: push the ball into the goal on the right. Your Dowee is the yellow one.',
    steps: ['Run it and drive with the keyboard or the on-screen pad.', 'Use the speed slider: slower is easier to aim.', 'Want a friend to play? Choose <b>Player 2 (arrow keys)</b> as the opponent.'],
    goal: 'Score 2 goals', check: W => W.state.score && W.state.score[0] >= 2 },
];

/* ---- PID path: students write a PID line follower in four steps ----
   The same method as the PID sample (LINE_GLOBALS, CALIBRATE_FN, READLINE_FN in examples.js):
   1 calibrate and find the threshold, 2 where is the line, 3 P, 4 D and race. */
const PID_TOP = (title, extra, opts = {}) => `// ${title}
// Five IR sensors: A0 (far left) to A4 (far right). About 950 on black, 100 on white.

${MOTOR_SETUP}

${extra}int baseSpeed = ${opts.speed || 150};   // cruising speed, 0-255

${opts.globals || LINE_GLOBALS}

void setup() {
${PINMODES}
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  calibrate();
}

${DRIVE_FN}

${opts.calibrate || CALIBRATE_FN}

${opts.readLine || READLINE_FN}
`;
const swap = (text, a, b) => { if (!text.includes(a)) throw new Error('PID lesson: text not found: ' + a.slice(0, 40)); return text.replace(a, b); };
const CALIBRATE_TODO = swap(swap(CALIBRATE_FN,
  '      if (v < minV[i]) minV[i] = v;\n      if (v > maxV[i]) maxV[i] = v;\n',
  '      // TODO 1: remember this sensor\'s whitest and blackest reading:\n      //   if v is smaller than minV[i], put v in minV[i]. If v is bigger than maxV[i], put v in maxV[i].\n\n'),
  '  threshold = (avgWhite + avgBlack) / 2;',
  '  // TODO 2: the threshold is halfway between the average white and the average black.\n  threshold = 0;');
const READLINE_TODO = swap(swap(READLINE_FN,
  '    onLine[i] = analogRead(A0 + i) > threshold ? 1 : 0;\n    seen += onLine[i];\n    sum += onLine[i] * (i + 1);\n',
  '    // TODO 1: does sensor i see the line? 1 if analogRead(A0 + i) is above the threshold, else 0.\n    onLine[i] = 0;\n    // TODO 2: count it: add onLine[i] to seen, and onLine[i] * (i + 1) to sum.\n\n'),
  '  if (seen > 0) position = (float)sum / seen;   // no line: keep the last position',
  '  // TODO 3: if seen is more than 0, the position is the average:  (float)sum / seen\n  //         (if no sensor sees the line, keep the last position)\n');
const PID1_CODE = PID_TOP('PID step 1: calibrate', '', {
  globals: swap(LINE_GLOBALS, 'int threshold = 500;   // above this = the sensor sees the line (calibrate() works out the real one)', 'int threshold = 0;     // above this = the sensor sees the line (TODO 2 works it out)'),
  calibrate: CALIBRATE_TODO }) + `
void loop() {
  readLine();
  // Simple steering with the sensors. In PID 2 you work out exactly where the line is.
  if (onLine[2] == 1) drive(baseSpeed, baseSpeed);                              // middle: straight on
  else if (onLine[1] == 1 || onLine[0] == 1) drive(baseSpeed / 4, baseSpeed);   // line on the left: turn left
  else if (onLine[3] == 1 || onLine[4] == 1) drive(baseSpeed, baseSpeed / 4);   // line on the right: turn right
}
`;
const PID2_CODE = PID_TOP('PID step 2: where is the line?', '', { readLine: READLINE_TODO }) + `
void loop() {
  readLine();
  float error = position - 3;   // -2 (line far left) .. 0 (in the middle) .. +2 (far right)
  Serial.println(error);        // open the Plotter to watch it

  // Simple steering for now. In PID 3 you make it smooth.
  if (error > 0.5) drive(baseSpeed, baseSpeed / 4);         // line on the right: turn right
  else if (error < -0.5) drive(baseSpeed / 4, baseSpeed);   // line on the left: turn left
  else drive(baseSpeed, baseSpeed);
}
`;
const PID3_CODE = PID_TOP('PID step 3: P, steer by how far away the line is', 'float Kp = 15;        // P gain: how hard to steer for each sensor of error\nint sampleMs = 10;    // work out the steering every 10 ms\n') + `
unsigned long lastPid = 0;

void loop() {
  readLine();
  if (millis() - lastPid >= sampleMs) {
    lastPid = millis();
    float error = position - 3;   // -2 .. +2

    // P = proportional: the farther the line, the harder Dowee steers.
    // TODO 1: work out how hard to turn:  Kp * error
    float turn = 0;

    // TODO 2: speed up one wheel and slow the other: left gets  baseSpeed + turn,  right gets  baseSpeed - turn
    drive(baseSpeed, baseSpeed);
  }
}
`;
const PID4_CODE = PID_TOP('PID step 4: D, calm the wiggle, then race', 'float Kp = 70;        // P gain\nfloat Kd = 1000;      // D gain: brakes the turn before it overshoots\nint turnSpeed = 170;  // spin speed when the line is lost\nint sampleMs = 10;    // work out the steering every 10 ms\n', { speed: 240 }) + `
float lastError = 0;
char lostSide = 's';  // where the line was last seen at the edge: 'l', 'r', or 's' (not yet)
unsigned long lastPid = 0;

void loop() {
  readLine();

  // Remember which edge sensor saw the line last
  if (onLine[0] == 1 && onLine[4] == 0) lostSide = 'l';
  if (onLine[4] == 1 && onLine[0] == 0) lostSide = 'r';

  // Line lost: spin towards where it was last seen until a middle sensor finds it
  if (seen == 0 && lostSide != 's') {
    if (lostSide == 'r') drive(turnSpeed, -turnSpeed);
    else drive(-turnSpeed, turnSpeed);
    while (onLine[1] == 0 && onLine[2] == 0 && onLine[3] == 0) readLine();
    lastError = position - 3;
    return;
  }

  // A crossing (every sensor sees black): drive straight over it
  if (seen == 5) {
    drive(baseSpeed, baseSpeed);
    while (seen == 5) readLine();
    return;
  }

  if (millis() - lastPid >= sampleMs) {
    lastPid = millis();
    float error = position - 3;

    // D = derivative: how much did the error change in the last 10 ms?
    float change = error - lastError;

    float turn = Kp * error;   // the P part, from PID 3
    // TODO: add the D part to turn:  Kd * change

    lastError = error;         // remember this error for next time
    drive(baseSpeed + turn, baseSpeed - turn);
  }
}
`;
// Did calibrate() learn white and black, and put the threshold between them?
const calibrated = W => {
  const lo = globalOf(W, 'minV'), hi = globalOf(W, 'maxV'), th = globalOf(W, 'threshold');
  if (!lo || !hi || th == null) return false;
  const w = [0, 1, 2, 3, 4].reduce((s, i) => s + lo[i], 0) / 5, b = [0, 1, 2, 3, 4].reduce((s, i) => s + hi[i], 0) / 5;
  return w < 300 && b > 700 && th > w && th < b;
};
const PID_LESSONS = [
  { id: 'pid1', title: 'PID 1: Calibrate', level: 'PID line follower', arena: 'line', variant: 'oval', code: PID1_CODE,
    intro: 'Every sensor reads white and black a little differently, and the floor changes from room to room. So a line follower first <b>calibrates</b>: it sweeps over the line, learns white and black, and picks a <b>threshold</b> halfway between them. Above the threshold means "I see the line".',
    steps: ['Run it as it is. The threshold is 0, so every sensor thinks it sees the line, and Dowee drives straight off.', 'Fill in <b>TODO 1</b>: while sweeping, remember each sensor\'s whitest (<code class="k">minV</code>) and blackest (<code class="k">maxV</code>) reading.', 'Fill in <b>TODO 2</b>: <code class="k">threshold = (avgWhite + avgBlack) / 2</code>. The Serial monitor shows what Dowee learned.', 'Run it: the simple steering now follows the Oval.'],
    hints: ['In the <code class="k">for</code> loop: <code class="k">if (v &lt; minV[i]) minV[i] = v;</code> and the same for <code class="k">maxV</code> with <code class="k">&gt;</code>.', 'Halfway between two numbers is their sum divided by 2: <code class="k">threshold = (avgWhite + avgBlack) / 2;</code>', 'White is about 100 and black about 950, so the threshold should be about 530.'],
    goal: 'Calibrate (white below 300, black above 700, threshold between them), then lap the Oval', check: W => calibrated(W) && W.state.laps && W.state.laps.length >= 1 },
  { id: 'pid2', title: 'PID 2: Where is the line?', level: 'PID line follower', arena: 'line', variant: 'oval', code: PID2_CODE,
    intro: 'A PID follower needs one number: how far the line is from the middle of Dowee, the <b>error</b>. Each sensor is either on the line (1) or not (0). The line\'s <b>position</b> is the average of the sensors that see it: from 1 (far left) to 5 (far right). The middle is 3, so <code class="k">error = position - 3</code>.',
    steps: ['Run it. <code class="k">readLine()</code> never sees the line, so the error stays 0 and Dowee drives straight.', 'Fill in the three <b>TODO</b>s in <code class="k">readLine()</code>.', 'Run again and open the <b>Plotter</b>: the error goes from -2 to 2 as the line moves under Dowee.'],
    hints: ['If only the middle sensor (number 3) sees the line, the position is 3 and the error is 0. If sensors 4 and 5 see it, the position is 4.5.', '<code class="k">onLine[i] = analogRead(A0 + i) &gt; threshold ? 1 : 0;</code> then <code class="k">seen += onLine[i];</code> and <code class="k">sum += onLine[i] * (i + 1);</code>', 'After the loop: <code class="k">if (seen &gt; 0) position = (float)sum / seen;</code>'],
    goal: 'Complete one lap of the Oval', check: W => W.state.laps && W.state.laps.length >= 1 },
  { id: 'pid3', title: 'PID 3: P, steer smoothly', level: 'PID line follower', arena: 'line', variant: 'oval', code: PID3_CODE,
    intro: 'Step 2 steered in jumps: hard left, straight or hard right. The <b>P</b> part steers by <i>how much</i>: a little off means a little turn, far off means a big turn. <code class="k">turn = Kp * error</code>. It is worked out every 10 ms, so it acts the same however fast the loop runs.',
    steps: ['Fill in the two <b>TODO</b>s.', 'Run it on the Oval with <b>Trail</b> on: Dowee follows the line, but it wiggles.', 'Open the <b>Tune</b> tab and move <code class="k">Kp</code> and <code class="k">baseSpeed</code> while it drives.'],
    hints: ['<code class="k">float turn = Kp * error;</code>', 'Line on the right means the error is positive, so the left wheel must go faster: <code class="k">drive(baseSpeed + turn, baseSpeed - turn);</code>', 'If Dowee wiggles a lot, make Kp smaller. If it is slow to turn, make it bigger. Without D (next step), a big Kp swings across the line.'],
    goal: 'Lap the Oval in under 17 seconds', check: W => W.state.laps && W.state.laps.some(l => l.time < 17) },
  { id: 'pid', title: 'PID 4: D, calm the wiggle, then race', level: 'PID line follower', arena: 'line', variant: 'snake', code: PID4_CODE,
    intro: 'With P alone, a fast Dowee overshoots: it turns towards the line, crosses it and has to turn back. The <b>D</b> part looks at how fast the error is changing and brakes the turn early, like easing off the steering wheel before you reach the bend. This program also finds a lost line and drives over crossings, so you can race.',
    steps: ['Run it first: with P only at this speed, Dowee wobbles off the Snake.', 'Fill in the <b>TODO</b>: add <code class="k">Kd * change</code> to <code class="k">turn</code>.', 'Run again with <b>Trail</b> on, then tune Kp, Kd and baseSpeed in the <b>Tune</b> tab for the fastest lap.'],
    hints: ['<code class="k">change</code> is big when the line moves away fast. That is when Dowee should brake its turn.', 'One line does both parts: <code class="k">float turn = Kp * error + Kd * change;</code>', 'Keep <code class="k">lastError = error;</code> after the turn, so next time <code class="k">change</code> is right.'],
    goal: 'Lap the Snake in under 12 seconds', check: W => W.state.laps && W.state.laps.some(l => l.time < 12) },
];
LESSONS.splice(LESSONS.findIndex(l => l.id === 'follow') + 1, 0, ...PID_LESSONS);

// Classroom students start these lessons from a version with TODOs instead of the finished program.
const LESSON_TODO = {
  follow: { code: EXAMPLES.line.bang.code.replace(/  if \(left == 1 && right == 0\) \{[\s\S]*?\n  \}\n\}/, `  // TODO 1: if left is 1 and right is 0, the line is on the left: turn left with drive(0, speed);

  // TODO 2: else if right is 1 and left is 0, the line is on the right: turn right.

  // TODO 3: else (both see the same thing) go straight.
}`),
    hints: ['Look at the <b>Sensors &amp; pins</b> tab: which sensor reads above the threshold when the line is on the left?', 'Use <code class="k">&amp;&amp;</code> for "and": <code class="k">if (left == 1 &amp;&amp; right == 0) { … }</code>', '<pre>if (left == 1 &amp;&amp; right == 0) {\n  drive(0, speed);\n} else if (right == 1 &amp;&amp; left == 0) {\n  drive(speed, 0);\n} else {\n  drive(speed, speed);\n}</pre>'],
    steps: ['Read the three <b>TODO</b>s in <code class="k">loop()</code> and write them as <code class="k">if</code> / <code class="k">else if</code> / <code class="k">else</code>.', 'Press <b>Upload &amp; run</b>. Does Dowee follow the oval?', 'Make <code class="k">speed</code> bigger. At some point it misses the turn — why?', 'Turn on <b>Trail</b> to see the path it really drove.'] },
  rc: { code: TEMPLATES.race.guided, hints: TEMPLATES.race.hints, steps: ['Run it and press the up arrow (or W): forward already works.', 'Fill in the <b>TODO</b>s one letter at a time and test each one.', 'Watch the Serial monitor to see each letter the controller sends.'] },
  soccer: { code: TEMPLATES.soccer.guided, hints: TEMPLATES.race.hints, steps: ['Fill in the <b>TODO</b>s so all the arrow keys work (or reuse your RC car program).', 'Use the speed slider: slower is easier to aim.', 'Push the ball into the goal on the right.'] },
  sonar: { code: TEMPLATES.maze.guided, hints: TEMPLATES.maze.hints, steps: ['Run it and turn on <b>Sensor view</b> to see the sound beam. The distance appears in the Serial monitor.', 'Fill in the two <b>TODO</b>s: turn away when a wall is close, otherwise drive on.', 'Change <code class="k">safeDistance</code>. Too small and it bumps; too big and it gets stuck turning.'] },
  fight: { code: TEMPLATES.sumo.guided, hints: TEMPLATES.sumo.hints, steps: ['Fill in <b>TODO 1</b> first and test that Dowee stays in the ring.', 'Then do <b>TODO 2</b>: charge when the ultrasonic sees the Hunter.', 'Try different start positions — a good robot wins from any of them.'] },
};
for (const L of LESSONS) if (LESSON_TODO[L.id]) L.todo = LESSON_TODO[L.id];
for (const c of CHALLENGES) LESSONS.push({ ...c, level: 'Fix the bug', bug: true, steps: ['Press <b>Upload &amp; run</b> and watch what goes wrong.', 'Find the mistake and fix it. Use <b>Hint</b> if you are stuck.', 'Run it again until the goal turns green.'] });
if (typeof module !== 'undefined') module.exports.LESSONS = LESSONS;
