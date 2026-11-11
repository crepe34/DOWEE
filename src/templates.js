/* =====================================================================
   Student templates: the starting program for each playground when a
   student is in a class. "guided" has the wiring and sensor reading done
   and the thinking left as TODO steps. "blank" has only the wiring.
   Missions are small checked goals (one star each). Hints go from a
   nudge to a code snippet.
   ===================================================================== */
const SONAR_FN = `// Measures the distance in front of Dowee in cm (999 = nothing seen). Done for you.
long readDistanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long duration = pulseIn(ECHO, HIGH, 30000);
  if (duration == 0) return 999;
  return duration * 0.034 / 2;
}`;
const blankOf = (title, about, extraPins, extraSetup, extraFns) => `// ${title}: your own program
// ${about}

${MOTOR_SETUP}${extraPins ? '\n' + extraPins : ''}

void setup() {
${PINMODES}${extraSetup ? '\n' + extraSetup : ''}
  Serial.begin(9600);
}

${DRIVE_FN}${extraFns ? '\n\n' + extraFns : ''}

void loop() {
  // Write your program here.
}
`;
const SONAR_PINS = 'const int TRIG = 11;\nconst int ECHO = 12;', SONAR_SETUP = '  pinMode(TRIG, OUTPUT);\n  pinMode(ECHO, INPUT);';

const RC_GUIDED = `// RC car template (Guided)
// The HC-05 Bluetooth module is on pins 0 and 1. The phone app or keyboard sends letters:
//   F = forward, B = back, L = left, R = right, S = stop
// Each TODO is one letter. Do them in order and test after each one!

${MOTOR_SETUP}

int speed = 200;   // 0-255

void setup() {
${PINMODES}
  Serial.begin(9600);
}

${DRIVE_FN}

void loop() {
  if (Serial.available() > 0) {
    char cmd = Serial.read();   // the letter that just arrived

    if (cmd == 'F') {
      drive(speed, speed);      // forward: done for you
    }
    // TODO 1: if cmd is 'B', drive backwards (use negative speeds).

    // TODO 2: if cmd is 'L', spin left: left wheel backwards, right wheel forwards.

    // TODO 3: if cmd is 'R', spin right.

    // TODO 4: if cmd is 'S', stop with drive(0, 0);
  }
}
`;

const TEMPLATES = {
  line: {
    name: 'Line follower',
    guided: `// Line follower template (Guided)
// Five IR sensors look at the floor: A0 (far left) ... A4 (far right).
// analogRead gives a BIG number on black (about 950) and a small one on white (about 100).
// Fill in the TODOs in loop(), then press Upload & run.

${MOTOR_SETUP}

int speed = 140;   // cruising speed, 0-255
int black = 500;   // above this number = the sensor sees the black line

void setup() {
${PINMODES}
  Serial.begin(9600);
}

${DRIVE_FN}

void loop() {
  int left = analogRead(A1);     // left-middle sensor
  int middle = analogRead(A2);   // centre sensor
  int right = analogRead(A3);    // right-middle sensor

  // TODO 1: if the MIDDLE sensor sees black (middle > black), drive straight.

  // TODO 2: else if the LEFT sensor sees black, the line is on the left: turn left.
  //         (Make the left wheel slower than the right one.)

  // TODO 3: else if the RIGHT sensor sees black, turn right.

  // TODO 4: what should Dowee do when no sensor sees the line? Try something!
}
`,
    blank: blankOf('Line follower', 'Five IR sensors on A0 (far left) to A4 (far right). Black is about 950, white about 100. Use analogRead and drive(left, right).'),
    hints: [
      'Open the <b>Sensors &amp; pins</b> tab while Dowee sits on the line. Which sensors show a big number?',
      'A line follower is a chain of <code class="k">if</code> … <code class="k">else if</code> … <code class="k">else</code>: check the middle first, then the left, then the right.',
      'To turn <b>left</b>, the left wheel goes slower than the right wheel, for example <code class="k">drive(0, speed)</code>.',
      '<pre>if (middle &gt; black) {\n  drive(speed, speed);\n} else if (left &gt; black) {\n  drive(0, speed);\n} else if (right &gt; black) {\n  drive(speed, 0);\n}</pre>',
    ],
    missions: [
      { text: 'Finish one lap of the Oval', variant: 'oval', goal: { type: 'laps', n: 1 } },
      { text: 'Finish one lap of the Snake', variant: 'snake', goal: { type: 'laps', n: 1 } },
      { text: 'Lap the Snake in under 15 seconds', variant: 'snake', goal: { type: 'lapTime', sec: 15 } },
    ],
  },
  race: {
    name: 'RC car',
    guided: RC_GUIDED,
    blank: blankOf('RC car', 'The HC-05 Bluetooth module is on pins 0/1. Read the letters with Serial.available() and Serial.read(): F B L R S.'),
    hints: [
      'Press <b>Upload &amp; run</b>, then press the up arrow key (or F on the phone). Forward already works: copy that <code class="k">if</code> for the other letters.',
      'Every letter gets its own <code class="k">if (cmd == \'B\') { … }</code>. Use single quotes around a letter.',
      'Backwards means negative speeds: <code class="k">drive(-speed, -speed)</code>. Spinning left means <code class="k">drive(-speed, speed)</code>.',
      '<pre>if (cmd == \'B\') drive(-speed, -speed);\nif (cmd == \'L\') drive(-speed / 2, speed / 2);\nif (cmd == \'R\') drive(speed / 2, -speed / 2);\nif (cmd == \'S\') drive(0, 0);</pre>',
    ],
    missions: [
      { text: 'Drive 3 metres in total', goal: { type: 'drive', cm: 300 } },
      { text: 'Finish one lap of the time trial', variant: 'none', goal: { type: 'laps', n: 1 } },
      { text: 'Lap the time trial in under 25 seconds (faster than the easy AI)', variant: 'none', goal: { type: 'lapTime', sec: 25 } },
    ],
  },
  soccer: {
    name: 'RC soccer player',
    guided: RC_GUIDED.replace('// RC car template (Guided)', '// RC soccer template (Guided)'),
    blank: blankOf('RC soccer player', 'The HC-05 Bluetooth module is on pins 0/1. Read the letters with Serial.available() and Serial.read(): F B L R S.'),
    hints: null, // same as race
    missions: [
      { text: 'Score a goal with no opponent', variant: 'none', goal: { type: 'goals', n: 1 } },
      { text: 'Score 3 goals with no opponent', variant: 'none', goal: { type: 'goals', n: 3 } },
      { text: 'Score a goal against the easy AI', variant: 'easy', goal: { type: 'goals', n: 1 } },
    ],
  },
  sumo: {
    name: 'Sumo robot',
    guided: `// Sumo template (Guided)
// Edge sensors: A0 = far left, A4 = far right. The black ring reads about 950, the white edge about 100.
// Ultrasonic "eyes": TRIG on 11, ECHO on 12 tell you how far away the opponent is.

${MOTOR_SETUP}
${SONAR_PINS}

int edgeLimit = 400;    // below this number = white edge
int attackRange = 60;   // cm: charge when the opponent is closer than this
int searchSpeed = 120;

void setup() {
${PINMODES}
${SONAR_SETUP}
  Serial.begin(9600);
  delay(5000);          // sumo rule: wait 5 seconds after the start
}

${DRIVE_FN}

${SONAR_FN}

void loop() {
  int left = analogRead(A0);
  int right = analogRead(A4);
  long d = readDistanceCm();

  // TODO 1: if left OR right is below edgeLimit, Dowee is on the white edge!
  //         Back up for a moment, turn around, then write  return;  to start loop() again.

  // TODO 2: if the opponent is closer than attackRange, charge at full speed (255).

  // TODO 3: otherwise spin slowly to search for the opponent:
  drive(searchSpeed, -searchSpeed);
}
`,
    blank: blankOf('Sumo robot', 'Edge sensors on A0 and A4 (black ring about 950, white edge about 100). Ultrasonic on TRIG 11 / ECHO 12.', SONAR_PINS, SONAR_SETUP, SONAR_FN),
    hints: [
      'Stay in the ring first, win later. Do <b>TODO 1</b> and test it with no opponent before anything else.',
      '"Left OR right" is written with <code class="k">||</code>: <code class="k">if (left &lt; edgeLimit || right &lt; edgeLimit) { … }</code>',
      'To back up: <code class="k">drive(-220, -220); delay(250);</code>. Then turn with opposite wheel speeds and another short delay.',
      '<pre>if (left &lt; edgeLimit || right &lt; edgeLimit) {\n  drive(-220, -220);\n  delay(250);\n  drive(200, -200);\n  delay(220);\n  return;\n}\nif (d &lt; attackRange) {\n  drive(255, 255);\n  return;\n}</pre>',
    ],
    missions: [
      { text: 'Drive around for 20 seconds without falling off', goal: { type: 'survive', sec: 20 } },
      { text: 'Beat the Statue', variant: 'statue', goal: { type: 'winSumo' } },
      { text: 'Beat the Hunter', variant: 'hunter', goal: { type: 'winSumo' } },
    ],
  },
  maze: {
    name: 'Obstacle avoider',
    guided: `// Obstacle avoider template (Guided)
// The ultrasonic sensor (TRIG 11, ECHO 12) measures how far away the nearest wall is.
// Fill in the TODOs so Dowee drives around without bumping into things.

${MOTOR_SETUP}
${SONAR_PINS}

int safeDistance = 25;   // cm: closer than this is too close
int cruise = 180;        // driving speed

void setup() {
${PINMODES}
${SONAR_SETUP}
  Serial.begin(9600);
}

${DRIVE_FN}

${SONAR_FN}

void loop() {
  long d = readDistanceCm();
  Serial.println(d);       // watch the distance in the Serial monitor

  // TODO 1: if something is closer than safeDistance, back up a little,
  //         then turn for a moment (for example drive(-170, 170); delay(300);).

  // TODO 2: otherwise drive forward at cruise speed.

  delay(30);
}
`,
    blank: blankOf('Obstacle avoider', 'Ultrasonic sensor on TRIG 11 / ECHO 12: readDistanceCm() gives the distance in cm.', SONAR_PINS, SONAR_SETUP, SONAR_FN),
    hints: [
      'Run it and watch the <b>Serial monitor</b>. Push Dowee towards a wall: how does the number change?',
      'You need one <code class="k">if</code> and one <code class="k">else</code>: "too close" or "all clear".',
      'If Dowee always turns the same way it can get stuck in a corner. <code class="k">random(250, 500)</code> gives a different turn time each time.',
      '<pre>if (d &lt; safeDistance) {\n  drive(-150, -150);\n  delay(200);\n  drive(-170, 170);\n  delay(random(250, 500));\n} else {\n  drive(cruise, cruise);\n}</pre>',
    ],
    missions: [
      { text: 'Drive 2 metres in total', goal: { type: 'drive', cm: 200 } },
      { text: 'Reach the green goal in Room 1', variant: 'room1', goal: { type: 'reachGoal', sec: 0 } },
      { text: 'Reach the green goal in Room 1 in under 60 seconds', variant: 'room1', goal: { type: 'reachGoal', sec: 60 } },
    ],
  },
  lab: {
    name: 'Test lab',
    guided: `// Test lab template (Guided)
// Make Dowee move exactly how you want. Watch "Distance" and "Turned" in the top-left.

${MOTOR_SETUP}

int speed = 180;   // 0-255

void setup() {
${PINMODES}
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);

  // TODO 1: drive forward with drive(speed, speed);

  // TODO 2: wait with delay(...). How many milliseconds for 1 metre? Test and change it!

  // TODO 3: stop with drive(0, 0);
}

${DRIVE_FN}

void loop() {
  // Code here runs again and again. For a single move, setup() is enough.
}
`,
    blank: blankOf('Test lab', 'Drive, turn and blink the LED (pin 13). Watch "Distance" and "Turned" in the top-left.', '', '  pinMode(LED_BUILTIN, OUTPUT);'),
    hints: [
      'Code in <code class="k">setup()</code> runs once. That is perfect for "drive, wait, stop".',
      '<code class="k">delay(1000)</code> waits one second while the motors keep running.',
      'Too short? Make the delay bigger. Too far? Make it smaller. Real robots are tuned like this too.',
      '<pre>drive(speed, speed);\ndelay(1400);\ndrive(0, 0);</pre>',
    ],
    missions: [
      { text: 'Stop between 95 and 105 cm from the start', goal: { type: 'distance', cm: 100, tol: 5 } },
      { text: 'Turn 90° (±5°) and stop', goal: { type: 'turn', deg: 90, tol: 5 } },
      { text: 'Blink the LED 10 times', goal: { type: 'blinks', n: 10 } },
    ],
  },
};
TEMPLATES.soccer.hints = TEMPLATES.race.hints;
if (typeof module !== 'undefined') module.exports.TEMPLATES = TEMPLATES;
