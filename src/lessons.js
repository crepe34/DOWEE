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
  { id: 'pid', title: 'Tune a PID racer', level: 'Line following', arena: 'line', variant: 'snake', example: 'pid',
    intro: 'PID control turns smoothly: the farther the line is from the centre, the harder it steers (P). The D part brakes the turn before it overshoots.',
    steps: ['Run it. First Dowee sweeps left and right for 2 seconds: it is <b>calibrating</b>, learning what black and white look like for each of its sensors. The Serial monitor shows what it learned.', 'Open the <b>Tune</b> tab. Move the sliders <b>while the robot drives</b>.', 'Set <code class="k">Kd</code> to 0. What happens to the wiggle? Put it back.', 'Raise <code class="k">baseSpeed</code> and adjust Kp and Kd. Every lap is logged so you can compare.', 'When you are happy, press <b>Write values into code</b>.'],
    goal: 'Lap the Snake track in under 15 seconds', check: W => W.state.laps && W.state.laps.some(l => l.time < 15) },
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

// Classroom students start these lessons from a version with TODOs instead of the finished program.
const LESSON_TODO = {
  follow: { code: EXAMPLES.line.bang.code.replace(/  if \(left == HIGH && right == LOW\) \{[\s\S]*?\n  \}\n\}/, `  // TODO 1: if left is HIGH and right is LOW, the line is on the left: turn left with drive(0, speed);

  // TODO 2: else if right is HIGH and left is LOW, the line is on the right: turn right.

  // TODO 3: else (both see the same thing) go straight.
}`),
    hints: ['Look at the <b>Sensors &amp; pins</b> tab: which sensor turns HIGH when the line is on the left?', 'Use <code class="k">&amp;&amp;</code> for "and": <code class="k">if (left == HIGH &amp;&amp; right == LOW) { … }</code>', '<pre>if (left == HIGH &amp;&amp; right == LOW) {\n  drive(0, speed);\n} else if (right == HIGH &amp;&amp; left == LOW) {\n  drive(speed, 0);\n} else {\n  drive(speed, speed);\n}</pre>'],
    steps: ['Read the three <b>TODO</b>s in <code class="k">loop()</code> and write them as <code class="k">if</code> / <code class="k">else if</code> / <code class="k">else</code>.', 'Press <b>Upload &amp; run</b>. Does Dowee follow the oval?', 'Make <code class="k">speed</code> bigger. At some point it misses the turn — why?', 'Turn on <b>Trail</b> to see the path it really drove.'] },
  pid: { code: EXAMPLES.line.pid.code.replace('  int turn = Kp * error + Kd * (error - lastError);', `  // TODO: work out how hard to turn. Right now turn is 0, so Dowee never steers!
  //   P part: Kp * error              (far from the line = turn harder)
  //   D part: Kd * (error - lastError) (calms the wiggle down)
  //   Add the two parts together.
  int turn = 0;`),
    hints: ['<code class="k">error</code> says how far the line is from the centre. The bigger it is, the harder Dowee should turn.', 'The P part is <code class="k">Kp * error</code>. The D part looks at how fast the error changes: <code class="k">error - lastError</code>.', '<pre>int turn = Kp * error + Kd * (error - lastError);</pre>'],
    steps: ['Run it. Dowee calibrates for 2 seconds, then drives straight off the line: <code class="k">turn</code> is always 0.', 'Fill in the <b>TODO</b>: <code class="k">turn</code> is the P part plus the D part.', 'Open the <b>Tune</b> tab and move the sliders <b>while the robot drives</b>. Set <code class="k">Kd</code> to 0: what happens to the wiggle?', 'Raise <code class="k">baseSpeed</code> and adjust Kp and Kd. Every lap is logged so you can compare.', 'When you are happy, press <b>Write values into code</b>.'] },
  rc: { code: TEMPLATES.race.guided, hints: TEMPLATES.race.hints, steps: ['Run it and press the up arrow (or W): forward already works.', 'Fill in the <b>TODO</b>s one letter at a time and test each one.', 'Watch the Serial monitor to see each letter the controller sends.'] },
  soccer: { code: TEMPLATES.soccer.guided, hints: TEMPLATES.race.hints, steps: ['Fill in the <b>TODO</b>s so all the arrow keys work (or reuse your RC car program).', 'Use the speed slider: slower is easier to aim.', 'Push the ball into the goal on the right.'] },
  sonar: { code: TEMPLATES.maze.guided, hints: TEMPLATES.maze.hints, steps: ['Run it and turn on <b>Sensor view</b> to see the sound beam. The distance appears in the Serial monitor.', 'Fill in the two <b>TODO</b>s: turn away when a wall is close, otherwise drive on.', 'Change <code class="k">safeDistance</code>. Too small and it bumps; too big and it gets stuck turning.'] },
  fight: { code: TEMPLATES.sumo.guided, hints: TEMPLATES.sumo.hints, steps: ['Fill in <b>TODO 1</b> first and test that Dowee stays in the ring.', 'Then do <b>TODO 2</b>: charge when the ultrasonic sees the Hunter.', 'Try different start positions — a good robot wins from any of them.'] },
};
for (const L of LESSONS) if (LESSON_TODO[L.id]) L.todo = LESSON_TODO[L.id];
for (const c of CHALLENGES) LESSONS.push({ ...c, level: 'Fix the bug', bug: true, steps: ['Press <b>Upload &amp; run</b> and watch what goes wrong.', 'Find the mistake and fix it. Use <b>Hint</b> if you are stuck.', 'Run it again until the goal turns green.'] });
