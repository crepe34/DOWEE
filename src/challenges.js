/* =====================================================================
   Fix-the-bug challenges: short programs with one mistake each.
   Each shows up as a lesson ("Fix the bug" level) with its own goal,
   which the broken program cannot reach.
   ===================================================================== */
// How far Dowee moved forward (in metres) along the direction it started in.
const forwardOf = r => (r.x - r.start.x) * Math.cos(r.start.th) + (r.y - r.start.y) * Math.sin(r.start.th);
const stillA = W => { const r = W.robots[0]; return Math.hypot(r.vx, r.vy) < 0.005 && Math.abs(r.w) < 0.02; };
const driveStraight = fix => `// Drive forward for driveTime ms, then stop.
${MOTOR_SETUP}

int speed = 180;
int driveTime = 1500;   // milliseconds

void setup() {
${fix.pinModes || PINMODES}
  drive(speed, speed);
  delay(driveTime)${fix.semi || ';'}
  drive(0, 0);
}

${fix.driveFn || DRIVE_FN}

void loop() {
}
`;
const bangWith = (loopBody, extra) => `// 2-sensor line follower. A1 = left-middle, A3 = right-middle. HIGH = sees the black line.
${MOTOR_SETUP}

int speed = 150;

void setup() {
${PINMODES}
}

${DRIVE_FN}

void loop() {
  int left = digitalRead(A1);
  int right = digitalRead(A3);
${loopBody}${extra || ''}
}
`;
const BANG_OK = `
  if (left == HIGH && right == LOW) {
    drive(0, speed);          // line on the left: turn left
  } else if (right == HIGH && left == LOW) {
    drive(speed, 0);          // line on the right: turn right
  } else {
    drive(speed, speed);      // go straight
  }`;
const lapOnce = W => W.state.laps && W.state.laps.length >= 1;
const forwardStop = W => W.time > 600 && stillA(W) && forwardOf(W.robots[0]) > 0.5;

const CHALLENGES = [
  { id: 'bug-backwards', title: 'Bug: Dowee goes backwards', arena: 'lab', variant: 'lab',
    intro: 'This program should drive Dowee <b>forward</b> and stop. Instead it drives backwards! One small thing is the wrong way round.',
    code: driveStraight({ driveFn: DRIVE_FN.replace('digitalWrite(IN1, left >= 0 ? HIGH : LOW);\n  digitalWrite(IN2, left >= 0 ? LOW : HIGH);', 'digitalWrite(IN1, left >= 0 ? LOW : HIGH);\n  digitalWrite(IN2, left >= 0 ? HIGH : LOW);').replace('digitalWrite(IN3, right >= 0 ? HIGH : LOW);\n  digitalWrite(IN4, right >= 0 ? LOW : HIGH);', 'digitalWrite(IN3, right >= 0 ? LOW : HIGH);\n  digitalWrite(IN4, right >= 0 ? HIGH : LOW);') }),
    hints: ['The speeds in <code class="k">drive(speed, speed)</code> are positive, so the problem is inside the <code class="k">drive()</code> function.', 'IN1 and IN2 choose the direction of the left motor. HIGH/LOW means forward, LOW/HIGH means backwards.', 'Swap HIGH and LOW in the four <code class="k">digitalWrite</code> lines of <code class="k">drive()</code>.'],
    goal: 'Drive forward at least 50 cm and stop', check: forwardStop },
  { id: 'bug-pinmode', title: 'Bug: Dowee only turns', arena: 'lab', variant: 'lab',
    intro: 'Dowee should drive straight, but it only turns in a curve. One motor is not getting its direction signal. Read the messages under the code!',
    code: driveStraight({ pinModes: '  pinMode(IN1, OUTPUT);\n  pinMode(IN2, OUTPUT);' }),
    hints: ['Look at the yellow tip under the code after you run it.', 'Every pin you use with <code class="k">digitalWrite</code> needs <code class="k">pinMode(pin, OUTPUT)</code> in setup() first.', 'Add <code class="k">pinMode(IN3, OUTPUT);</code> and <code class="k">pinMode(IN4, OUTPUT);</code> to setup().'],
    goal: 'Drive forward at least 50 cm and stop', check: W => forwardStop(W) && Math.abs(W.robots[0].headingAcc) < 0.2 },
  { id: 'bug-semicolon', title: 'Bug: it won\'t upload', arena: 'lab', variant: 'lab',
    intro: 'Press <b>Upload &amp; run</b>: the program doesn\'t even start. Read the red error message. It tells you the line and what is missing.',
    code: driveStraight({ semi: ' ' }),
    hints: ['Click the red error message: it jumps to the line with the problem.', 'In Arduino C almost every line ends with a semicolon <code class="k">;</code>', 'Look at the line just before the one in the error: <code class="k">delay(driveTime)</code> is missing its <code class="k">;</code>'],
    goal: 'Drive forward at least 50 cm and stop', check: forwardStop },
  { id: 'bug-swapped', title: 'Bug: turns the wrong way', arena: 'line', variant: 'oval',
    intro: 'This line follower turns <b>away</b> from the line as soon as it sees it. The left and right turns are mixed up.',
    code: bangWith(BANG_OK.replace('drive(0, speed);          // line on the left: turn left', 'drive(speed, 0);          // line on the left: turn left').replace('drive(speed, 0);          // line on the right: turn right', 'drive(0, speed);          // line on the right: turn right')),
    hints: ['Turn on <b>Trail</b> and watch where Dowee goes when the line is on its left.', 'To turn left, the LEFT wheel must be slower. Which number in <code class="k">drive(left, right)</code> is the left wheel?', 'Line on the left → <code class="k">drive(0, speed)</code>. Line on the right → <code class="k">drive(speed, 0)</code>.'],
    goal: 'Complete one full lap', check: lapOnce },
  { id: 'bug-equals', title: 'Bug: one = or two?', arena: 'line', variant: 'oval',
    intro: 'Dowee keeps going round in circles. In C, <code class="k">=</code> and <code class="k">==</code> mean very different things. Find the wrong one.',
    code: bangWith(BANG_OK.replace('if (left == HIGH && right == LOW)', 'if (left = HIGH)')),
    hints: ['Look closely at every <code class="k">if</code>.', '<code class="k">=</code> puts a value into a variable. <code class="k">==</code> asks "are these equal?".', 'The first <code class="k">if</code> says <code class="k">left = HIGH</code>, which makes left HIGH every time. Make it <code class="k">left == HIGH</code>.'],
    goal: 'Complete one full lap', check: lapOnce },
  { id: 'bug-sleepy', title: 'Bug: the sleepy follower', arena: 'line', variant: 'oval',
    intro: 'This follower has the right idea, but it misses the turns. It only looks at the line every now and then.',
    code: bangWith(BANG_OK, '\n  delay(400);                 // rest a little'),
    hints: ['How long does one trip through <code class="k">loop()</code> take? Look for anything that waits.', 'While <code class="k">delay()</code> runs, Dowee keeps driving but doesn\'t look at its sensors.', 'Remove the <code class="k">delay(400);</code> line (or make it very small).'],
    goal: 'Complete one full lap', check: lapOnce },
  { id: 'bug-threshold', title: 'Bug: black or white?', arena: 'line', variant: 'oval',
    intro: 'This follower uses analogRead. Black gives a big number and white a small one, but the program checks it the wrong way round.',
    code: `// Analog line follower. Black ≈ 950, white ≈ 100.
${MOTOR_SETUP}

int speed = 140;
int black = 500;

void setup() {
${PINMODES}
  Serial.begin(9600);
}

${DRIVE_FN}

void loop() {
  int left = analogRead(A1);
  int middle = analogRead(A2);
  int right = analogRead(A3);

  if (middle < black) {
    drive(speed, speed);
  } else if (left < black) {
    drive(0, speed);
  } else if (right < black) {
    drive(speed, 0);
  }
}
`,
    hints: ['Open <b>Sensors &amp; pins</b>: what number does a sensor on the black line show?', '"Sees black" means the number is <b>bigger</b> than <code class="k">black</code>.', 'Change all three <code class="k">&lt;</code> to <code class="k">&gt;</code>.'],
    goal: 'Complete one full lap', check: lapOnce },
  { id: 'bug-rc', title: 'Bug: forward is broken', arena: 'race', variant: 'none',
    intro: 'Every key works except <b>forward</b>. Look carefully at the letter the program waits for.',
    code: EXAMPLES.race.rc.code.replace("case 'F':", "case 'f':"),
    hints: ['Open the <b>Serial monitor</b> and press the up arrow: which letter arrives?', 'Letters are case-sensitive: <code class="k">\'f\'</code> and <code class="k">\'F\'</code> are different.', "Change <code class=\"k\">case 'f':</code> to <code class=\"k\">case 'F':</code>"],
    goal: 'Drive forward at least 1 metre', check: W => forwardOf(W.robots[0]) > 1 },
  { id: 'bug-sonar', title: 'Bug: scared of nothing', arena: 'maze', variant: 'room1',
    intro: 'This obstacle avoider turns all the time, even with nothing in front of it, and never gets anywhere.',
    code: EXAMPLES.maze.avoid.code.replace('if (d < safeDistance) {', 'if (d > safeDistance) {'),
    hints: ['Watch the distance in the <b>Serial monitor</b>. Is it big or small when the way is clear?', 'The <code class="k">if</code> should be true when the wall is <b>close</b>, so when d is small.', 'Change <code class="k">d &gt; safeDistance</code> to <code class="k">d &lt; safeDistance</code>.'],
    goal: 'Reach the green goal zone', check: W => W.state.done != null },
  { id: 'bug-edge', title: 'Bug: afraid of the ring', arena: 'sumo', variant: 'statue',
    intro: 'This sumo robot backs away all the time, even in the middle of the black ring. Its edge check is upside down.',
    code: EXAMPLES.sumo.basic.code.replace('if (left < edgeLimit || right < edgeLimit) {', 'if (left > edgeLimit || right > edgeLimit) {'),
    hints: ['The black ring reads about 950 and the white edge about 100. Which one is "below edgeLimit"?', 'Dowee is on the edge when a sensor reads a <b>small</b> number.', 'Change both <code class="k">&gt;</code> in the edge check to <code class="k">&lt;</code>.'],
    goal: 'Push the Statue out of the ring', check: W => W.state.result === 'A' },
];
if (typeof module !== 'undefined') { module.exports.CHALLENGES = CHALLENGES; module.exports.forwardOf = forwardOf; }
