/* =====================================================================
   PRIMM for every built-in lesson: Predict, Run, Investigate, Modify, Make.
   (Sentance & Waite, Raspberry Pi Foundation.) Predict asks only WHAT will happen.
   Investigate asks what a part of the code does. Modify gives small changes that are
   checked live while the program runs (check(W, memo) is called every ~200 ms).
   Make is the lesson's own goal. `todo` versions (classroom students) can have their own.
   Also the learning path: the levels of the Lessons page.
   ===================================================================== */
const PQ = {
  still: W => { const r = W.robots[0]; return Math.hypot(r.vx, r.vy) < 0.005 && Math.abs(r.w) < 0.02; },
  dist: r => Math.hypot(r.x - r.start.x, r.y - r.start.y),
  // events per second, measured over `span` ms once the program has run for `after` ms
  rate(W, memo, count, after = 1000, span = 2000) {
    if (W.time < after) return null;
    if (memo.t0 == null) { memo.t0 = W.time; memo.n0 = count(W); return null; }
    if (W.time - memo.t0 < span) return null;
    return (count(W) - memo.n0) / (W.time - memo.t0) * 1000;
  },
  // Dowee has stayed close to the line (within 20 mm) and kept driving for `ms`
  onLine: ms => (W, memo) => {
    const s = W.state, r = W.robots[0]; if (!s || !s.lap) return false;
    const ok = !s.lap.lost && s.lap.lastErr < 0.02 && Math.hypot(r.vx, r.vy) > 0.05;
    if (!ok) { memo.since = null; return false; }
    if (memo.since == null) memo.since = W.time;
    return W.time - memo.since >= ms;
  },
  num: (W, name) => { const v = globalOf(W, name); return v == null ? null : +v; },
};

const PRIMM = {
  blocks: {
    predict: { q: 'Look at the blocks. What will Dowee do when you press <b>Upload &amp; run</b>?', options: ['Drive forward a bit, then stop', 'Spin round and round', 'Drive forward and never stop'], answer: 0, why: 'The blocks run from top to bottom, once: LED on, drive forward, wait, then <b>stop</b>.' },
    investigate: [
      { q: 'Which block decides <b>how far</b> Dowee drives?', options: ['<b>wait … seconds</b>', '<b>turn LED on</b>', '<b>when Dowee starts</b>'], answer: 0, why: 'Dowee keeps driving while it waits. A longer wait means a longer drive.' },
    ],
    modify: [
      { text: 'Make the wait shorter so Dowee stops <b>before 50 cm</b>.', check: W => W.time > 600 && PQ.still(W) && PQ.dist(W.robots[0]) > 0.05 && PQ.dist(W.robots[0]) < 0.5 },
      { text: 'Change <b>forward</b> to <b>backward</b> in the drive block.', check: W => forwardOf(W.robots[0]) < -0.15 },
    ],
  },
  blink: {
    predict: { q: 'What will the LED on Dowee\'s Arduino do?', options: ['Turn on and stay on', 'Blink on and off, again and again', 'Blink once, then stay off'], answer: 1, why: 'Everything in <code class="k">loop()</code> runs again and again forever: on, wait, off, wait, on…' },
    investigate: [
      { q: 'What does <code class="k">delay(500)</code> do?', options: ['Waits half a second', 'Waits 500 seconds', 'Makes the LED 500 times brighter'], answer: 0, why: 'delay counts in milliseconds. 1000 ms is 1 second, so 500 ms is half a second.' },
      { q: 'Why does the LED keep blinking and not stop?', options: ['Because <code class="k">loop()</code> runs again and again', 'Because <code class="k">setup()</code> runs again and again', 'Because of <code class="k">pinMode</code>'], answer: 0, why: '<code class="k">setup()</code> runs once at the start. <code class="k">loop()</code> repeats forever.' },
    ],
    modify: [
      { text: 'Make it blink <b>twice as fast</b>.', check: (W, m) => { const r = PQ.rate(W, m, W => W.robots[0].board.ledToggles); return r != null && r >= 3.5; } },
      { text: 'Make it blink <b>super fast</b>: at least 10 blinks every second.', check: (W, m) => { const r = PQ.rate(W, m, W => W.robots[0].board.ledToggles); return r != null && r >= 19; } },
    ],
  },
  drive: {
    predict: { q: '<code class="k">driveTime</code> is 1500 (1.5 seconds). How far will Dowee drive?', options: ['Less than 1 metre', 'Exactly 1 metre', 'More than 2 metres'], answer: 0, why: 'At speed 180 Dowee does about 70 cm in 1.5 seconds. To get to 1 m it has to drive for longer.' },
    investigate: [
      { q: 'Which line makes Dowee <b>stop</b>?', options: ['<code class="k">drive(0, 0);</code>', '<code class="k">delay(driveTime);</code>', '<code class="k">Serial.begin(9600);</code>'], answer: 0, why: 'A speed of 0 on both wheels stops the motors.' },
      { q: 'Why is all the driving code in <code class="k">setup()</code> and not in <code class="k">loop()</code>?', options: ['So it happens only once', 'Because loop() is broken', 'So it drives faster'], answer: 0, why: 'setup() runs once. In loop() Dowee would drive, stop, drive, stop… forever.' },
    ],
    modify: [
      { text: 'Make Dowee drive <b>about half as far</b> (between 25 and 45 cm).', check: W => W.time > 600 && PQ.still(W) && PQ.dist(W.robots[0]) > 0.25 && PQ.dist(W.robots[0]) < 0.45 },
      { text: 'Make Dowee drive <b>backwards</b>. (Hint: a negative speed.)', check: W => forwardOf(W.robots[0]) < -0.15 },
    ],
  },
  turn: {
    predict: { q: 'Look at <code class="k">drive(turnSpeed, -turnSpeed)</code>. Which way will Dowee turn?', options: ['Right (clockwise)', 'Left', 'It drives straight on'], answer: 0, why: 'The left wheel goes forward and the right wheel goes backwards, so Dowee spins to the right.' },
    investigate: [
      { q: 'What would <code class="k">drive(-turnSpeed, turnSpeed)</code> do?', options: ['Turn left', 'Turn right', 'Drive backwards'], answer: 0, why: 'Now the right wheel goes forward and the left goes back: Dowee spins to the left.' },
    ],
    modify: [
      { text: 'Make Dowee turn <b>left</b> instead.', check: W => W.time > 300 && PQ.still(W) && W.robots[0].headingAcc > 0.5 },
      { text: 'Make Dowee spin <b>a whole circle</b> (360°) or more.', check: W => Math.abs(W.robots[0].headingAcc) > 2 * Math.PI * 0.97 },
    ],
  },
  see: {
    predict: { q: 'Dowee starts on the black line. What number will the middle sensor (A2) show?', options: ['A big number, about 950', 'A small number, about 100', 'Always 0'], answer: 0, why: 'Black reflects very little light back, and little light gives a <b>big</b> number. White gives a small one.' },
    investigate: [
      { q: 'What does the <code class="k">for</code> loop do?', options: ['Reads the 5 sensors one after another', 'Reads sensor A0 five times', 'Waits 5 seconds'], answer: 0, why: 'i goes 0, 1, 2, 3, 4, so <code class="k">A0 + i</code> is A0, A1, A2, A3 and A4.' },
    ],
    modify: [
      { text: 'Make the numbers come <b>more slowly</b>: 2 lines a second or fewer.', check: (W, m) => { const r = PQ.rate(W, m, W => W.robots[0].board.serialLines, 1000, 3000); return r != null && r > 0 && r <= 2.2; } },
    ],
  },
  follow: {
    predict: { q: 'What will Dowee do on the Oval?', options: ['Follow the line with a little wiggle', 'Glide perfectly smoothly along the line', 'Drive straight off the track'], answer: 0, why: 'This follower only knows "turn left", "turn right" or "straight", so it zig-zags along the line.' },
    investigate: [
      { q: 'Only the <b>left</b> sensor sees the line. What does Dowee do?', options: ['Turns left: <code class="k">drive(0, speed)</code>', 'Turns right: <code class="k">drive(speed, 0)</code>', 'Goes straight'], answer: 0, why: 'With the left wheel stopped and the right one driving, Dowee turns left, back towards the line.' },
      { q: 'What does <code class="k">&amp;&amp;</code> mean in an <code class="k">if</code>?', options: ['AND: both parts must be true', 'OR: one part is enough', 'NOT'], answer: 0, why: '<code class="k">left == HIGH &amp;&amp; right == LOW</code> is only true when both are true.' },
    ],
    modify: [
      { text: 'Make Dowee faster: lap the Oval in <b>under 25 seconds</b>. Too fast and it misses the turn!', check: W => W.state.laps && W.state.laps.some(l => l.time < 25) },
    ],
    todo: {
      predict: { q: 'The <code class="k">loop()</code> only has TODO comments so far. What will Dowee do?', options: ['Stand still', 'Follow the line', 'Spin in circles'], answer: 0, why: 'Comments do nothing, and no line in loop() starts the motors yet.' },
      modify: [
        { text: 'Write the 3 TODOs so Dowee follows the line for 5 seconds.', check: PQ.onLine(5000) },
        { text: 'Make Dowee faster: lap the Oval in <b>under 25 seconds</b>.', check: W => W.state.laps && W.state.laps.some(l => l.time < 25) },
      ],
    },
  },
  pid1: {
    predict: { q: 'The three TODOs in <code class="k">readLine()</code> are still empty. What will Dowee do?', options: ['Drive round in circles', 'Follow the line', 'Stand still'], answer: 0, why: '<code class="k">total</code> stays 0, so readLine() thinks it lost the line and always says "far left". Dowee keeps turning left.' },
    investigate: [
      { q: 'Only the middle sensor (i = 2) sees black. What is the error?', options: ['0', '2000', '-2000'], answer: 0, why: 'Its position is (2 - 2) × 1000 = 0, so the weighted average is 0: the line is right in the middle.' },
      { q: 'The error is <b>positive</b>, like 1500. Where is the line?', options: ['On the right', 'On the left', 'Under the middle sensor'], answer: 0, why: 'A3 and A4 on the right have the positions 1000 and 2000.' },
    ],
    modify: [
      { text: 'Fill in the 3 TODOs so Dowee follows the line for 5 seconds.', check: PQ.onLine(5000) },
    ],
  },
  pid2: {
    predict: { q: '<code class="k">turn</code> is always 0 for now. What will Dowee do on the Oval?', options: ['Drive straight off the line', 'Follow the line smoothly', 'Spin on the spot'], answer: 0, why: 'Both wheels get the same speed, so Dowee never steers.' },
    investigate: [
      { q: 'The error is 1000 and Kp is 0.05. What is <code class="k">Kp * error</code>?', options: ['50', '1000', '0.05'], answer: 0, why: '0.05 × 1000 = 50, so one wheel goes 50 faster and the other 50 slower.' },
      { q: 'The line is on the right, so turn is positive. Which wheel must go faster?', options: ['The left wheel', 'The right wheel', 'Both the same'], answer: 0, why: 'A faster left wheel turns Dowee to the right, towards the line: <code class="k">drive(baseSpeed + turn, baseSpeed - turn)</code>.' },
    ],
    modify: [
      { text: 'Fill in the 2 TODOs so Dowee gets halfway round the Oval without losing the line.', check: W => W.state.lap && !W.state.lap.lost && W.state.lap.progress() > 0.5 },
    ],
  },
  pid3: {
    predict: { q: 'This step starts with P only and a big Kp (0.08). What will Dowee do?', options: ['Wobble more and more', 'Drive perfectly smoothly', 'Not move at all'], answer: 0, why: 'A strong P turns hard towards the line, crosses it and turns back too late. Each swing gets bigger.' },
    investigate: [
      { q: 'When is <code class="k">change</code> (error − lastError) big?', options: ['When the line moves away fast', 'When Dowee is exactly on the line', 'When Kd is big'], answer: 0, why: 'change is how much the error grew since the last loop. D uses it to brake the turn early.' },
    ],
    modify: [
      { text: 'Add the D part so Dowee stays close to the line for 8 seconds.', check: PQ.onLine(8000) },
    ],
  },
  pid: {
    predict: { q: 'What will Dowee do first when you press Run?', options: ['Sweep left and right on the spot', 'Race off straight away', 'Wait and do nothing'], answer: 0, why: 'It <b>calibrates</b> for 2 seconds: it learns what black and white look like for each of its sensors.' },
    investigate: [
      { q: 'Why does every sensor get its own min and max?', options: ['Real sensors all read a little differently', 'To make the code longer', 'Because the line changes colour'], answer: 0, why: 'After calibrating, every sensor gives 0 on white and 1000 on black, even if one is a bit weaker.' },
      { q: 'In the Tune tab, what happens when you set <code class="k">Kd</code> to 0?', options: ['Dowee wiggles more', 'Dowee wiggles less', 'Dowee stops'], answer: 0, why: 'D brakes the turn before Dowee overshoots. Without it, Dowee swings across the line.' },
    ],
    modify: [
      { text: 'Make it faster: set <code class="k">baseSpeed</code> to 180 or more and stay on the line for 5 seconds.', check: (W, m) => (PQ.num(W, 'baseSpeed') || 0) >= 180 && PQ.onLine(5000)(W, m) },
    ],
    todo: {
      predict: { q: 'The TODO sets <code class="k">turn = 0</code>. What will Dowee do?', options: ['Calibrate, then drive straight off the line', 'Calibrate, then follow the line', 'Not move at all'], answer: 0, why: 'Calibrating works, but with turn = 0 both wheels get the same speed and Dowee never steers.' },
      modify: [
        { text: 'Fill in the TODO so Dowee follows the Snake for 5 seconds.', check: PQ.onLine(5000) },
        { text: 'Make it faster: <code class="k">baseSpeed</code> 180 or more, still on the line.', check: (W, m) => (PQ.num(W, 'baseSpeed') || 0) >= 180 && PQ.onLine(5000)(W, m) },
      ],
    },
  },
  rc: {
    predict: { q: 'You press the up arrow. The controller sends the letter <b>F</b>. What does Dowee do?', options: ['Drives forward', 'Spins left', 'Nothing'], answer: 0, why: '<code class="k">case \'F\':</code> runs <code class="k">drive(speed, speed);</code>: both wheels forward.' },
    investigate: [
      { q: 'You let go of all the keys. Which letter arrives?', options: ['S (stop)', 'F', 'Nothing at all'], answer: 0, why: 'Open the Serial monitor: letting go sends S, and <code class="k">case \'S\':</code> stops the motors.' },
      { q: 'What does pressing the key <b>5</b> do?', options: ['Changes the speed', 'Drives 5 metres', 'Nothing'], answer: 0, why: 'Digits 0–9 go to <code class="k">map(…)</code>, which turns them into a speed from 60 to 240.' },
    ],
    modify: [
      { text: 'Make Dowee slower: set <code class="k">speed</code> to 150 or less, then drive 1 metre.', check: (W, m) => { const v = PQ.num(W, 'speed'); if (v == null || v > 150) { m.o = null; return false; } if (m.o == null) m.o = W.robots[0].odo; return W.robots[0].odo - m.o > 1; } },
    ],
    todo: {
      predict: { q: 'Only forward is written so far. You press the <b>left</b> arrow. What happens?', options: ['Dowee keeps doing what it did before', 'Dowee turns left', 'Dowee stops'], answer: 0, why: 'No <code class="k">if</code> handles the letter L yet, so nothing changes the motors.' },
      investigate: [
        { q: 'Which letter arrives when you let go of all the keys?', options: ['S', 'F', 'Nothing at all'], answer: 0, why: 'Watch the Serial monitor: S means stop. TODO 4 handles it.' },
      ],
      modify: [
        { text: 'Write TODO 1: drive <b>backwards</b> with the down arrow.', check: W => forwardOf(W.robots[0]) < -0.2 },
        { text: 'Write TODO 2 and 3: spin left and right.', check: (W, m) => { const h = W.robots[0].headingAcc; m.lo = Math.min(m.lo ?? 0, h); m.hi = Math.max(m.hi ?? 0, h); return m.hi - m.lo > 3; } },
      ],
    },
  },
  sonar: {
    predict: { q: 'A wall is closer than 25 cm. What will Dowee do?', options: ['Back up and turn away', 'Drive into the wall', 'Stop forever'], answer: 0, why: 'When <code class="k">d &lt; safeDistance</code>, Dowee backs up and turns left for a moment.' },
    investigate: [
      { q: 'What does <code class="k">safeDistance = 25</code> mean?', options: ['Turn away when a wall is closer than 25 cm', 'Drive 25 cm', 'Wait 25 milliseconds'], answer: 0, why: 'It is the distance, in cm, that counts as too close.' },
    ],
    modify: [
      { text: 'Make Dowee more careful: <code class="k">safeDistance</code> 40 or more, and keep driving for 5 seconds.', check: W => (PQ.num(W, 'safeDistance') || 0) >= 40 && W.time > 5000 && W.robots[0].odo > 0.5 },
    ],
    todo: {
      predict: { q: 'The two TODOs in <code class="k">loop()</code> are still empty. What will Dowee do?', options: ['Stand still and print distances', 'Drive around the room', 'Spin in circles'], answer: 0, why: 'It measures and prints the distance, but no line starts the motors yet.' },
      modify: [
        { text: 'Write TODO 2: drive forward at <code class="k">cruise</code> speed.', check: W => W.robots[0].odo > 0.4 },
        { text: 'Write TODO 1: back up and turn when a wall is close, and drive for 15 seconds.', check: W => W.time > 15000 && W.robots[0].odo > 1.5 && Math.abs(W.robots[0].headingAcc) > 1 },
      ],
    },
  },
  edge: {
    predict: { q: 'Dowee drives forward and the TODO is still empty. What will happen?', options: ['It drives off the ring', 'It stays inside the ring', 'It spins on the spot'], answer: 0, why: 'Nothing checks the edge yet, so Dowee drives straight over the white edge.' },
    investigate: [
      { q: 'A sensor reads 120. Where is it?', options: ['On the white edge', 'On the black ring', 'Off the table'], answer: 0, why: 'White reflects a lot of light, which gives a small number (about 100). Black gives about 950.' },
      { q: 'What does <code class="k">||</code> mean?', options: ['OR: one side is enough', 'AND: both sides must be true', 'Divide'], answer: 0, why: '<code class="k">left &lt; 400 || right &lt; 400</code> is true if <b>either</b> sensor sees the edge.' },
    ],
    modify: [
      { text: 'Fill in the TODO so Dowee stays on the ring for 8 seconds.', check: W => W.time > 8000 && !W.robots[0].fallen && W.robots[0].odo > 0.8 },
    ],
  },
  fight: {
    predict: { q: 'Dowee faces the Hunter robot. Who will win?', options: ['Dowee pushes the Hunter out', 'The Hunter pushes Dowee out', 'Nobody moves'], answer: 0, why: 'Dowee spins until its ultrasonic eyes see the Hunter, charges at full speed, and backs away from the edge.' },
    investigate: [
      { q: 'Why does Dowee wait 5 seconds at the start?', options: ['It is a sumo rule', 'To charge the battery', 'The ultrasonic needs to warm up'], answer: 0, why: 'In robot sumo both robots must wait 5 seconds after the start.' },
      { q: 'What does Dowee do when the opponent is closer than <code class="k">attackRange</code>?', options: ['Charges at full speed (255)', 'Backs away', 'Stops'], answer: 0, why: '<code class="k">drive(255, 255)</code> is full speed forward.' },
    ],
    modify: [
      { text: 'Switch the opponent to the <b>Statue</b> and win there too.', check: W => W.variant === 'statue' && W.state.result === 'A' },
    ],
    todo: {
      predict: { q: 'Only the searching part is written. What will Dowee do after 5 seconds?', options: ['Spin slowly on the spot', 'Charge at the Hunter', 'Drive off the ring'], answer: 0, why: '<code class="k">drive(searchSpeed, -searchSpeed)</code> spins it. Nothing tells it to charge yet.' },
      modify: [
        { text: 'Write TODO 2: charge at full speed (255) when the Hunter is close.', check: W => W.robots[0].dutyL > 0.95 && W.robots[0].dutyR > 0.95 },
      ],
    },
  },
  soccer: {
    predict: { q: 'Dowee drives into the ball. What happens?', options: ['The ball rolls away', 'Dowee stops dead', 'The ball sticks to Dowee'], answer: 0, why: 'The ball is light. Dowee pushes it and it rolls on until friction slows it down.' },
    investigate: [
      { q: 'Which letter does the <b>down</b> arrow send?', options: ['B (back)', 'D (down)', 'S (stop)'], answer: 0, why: 'Open the Serial monitor to see each letter as it arrives.' },
    ],
    modify: [
      { text: 'Push the ball at least 50 cm.', check: W => W.ball && Math.hypot(W.ball.x - 1.3, W.ball.y - 0.9) > 0.5 },
    ],
  },
  apid1: {
    predict: { q: 'The I part adds up the error over time. On a normal Dowee, what will a <b>big</b> Ki do?', options: ['Make it wiggle more', 'Make it drive smoother', 'Nothing at all'], answer: 0, why: 'On a line the error keeps changing sides, so the sum swings around and pushes Dowee off course. Measured: 3 mm of wiggle without I, 15–26 mm with it.' },
    modify: [
      { text: 'In the <b>Tune</b> tab, set <code class="k">Ki</code> to 0.002 or more and watch the wiggle grow.', check: W => (PQ.num(W, 'Ki') || 0) >= 0.0019 && W.time > 6000 },
    ],
  },
  apid2: {
    predict: { q: 'What will happen if you press <b>Upload &amp; run</b> before filling in the blanks?', options: ['It won\'t upload: there is a blank to fill', 'Dowee follows the line anyway', 'Dowee drives backwards'], answer: 0, why: 'A program with <code class="k">____</code> in it is not finished, so the compiler stops and tells you which line.' },
    modify: [
      { text: 'Set <code class="k">Ki</code> to 0.002 or more in the Tune tab and watch the wiggle grow.', check: W => (PQ.num(W, 'Ki') || 0) >= 0.0019 && W.time > 6000 },
    ],
  },
  apid3: {
    predict: { q: 'The template only drives straight or turns hard. What will it do before you write the steps?', options: ['Zig-zag along the line, if it stays on at all', 'Race smoothly', 'Not move'], answer: 0, why: 'Without a weighted average and PID it only knows "line far left" or "line far right".' },
  },
};
// Fix-the-bug challenges: Predict what goes wrong, Investigate, then the fix is the goal (Make).
const BUG_PRIMM = {
  'bug-backwards': { predict: ['It drives backwards', 'It drives forward and stops', 'It spins'], why: 'The direction pins are the wrong way round inside drive().', iq: 'Which part sets the direction of the left motor?', io: ['IN1 and IN2', 'ENA', 'driveTime'] },
  'bug-pinmode': { predict: ['It drives in a curve', 'It drives straight', 'It stays still'], why: 'Without pinMode, IN3 and IN4 can\'t send their signal, so only one motor knows which way to go.', iq: 'What must every pin have before digitalWrite?', io: ['pinMode(pin, OUTPUT) in setup()', 'A delay', 'Serial.begin'] },
  'bug-semicolon': { predict: ['It won\'t upload: there is an error', 'It drives forward and stops', 'It drives backwards'], why: 'One line is missing its semicolon, so the program can\'t be understood.', iq: 'How does almost every line in Arduino C end?', io: ['With a ;', 'With a .', 'With nothing'] },
  'bug-swapped': { predict: ['It turns away from the line', 'It follows the line', 'It stands still'], why: 'The left and right turns are swapped, so every correction goes the wrong way.', iq: 'To turn LEFT, which wheel should be slower?', io: ['The left wheel', 'The right wheel', 'Both the same'] },
  'bug-equals': { predict: ['It goes round in circles', 'It follows the line', 'It drives straight off'], why: '<code class="k">left = HIGH</code> puts HIGH into left every time, so the first if is always true.', iq: 'What does a single = do?', io: ['Puts a value into a variable', 'Asks if two things are equal', 'Adds two numbers'] },
  'bug-sleepy': { predict: ['It misses the turns', 'It follows the line perfectly', 'It doesn\'t move'], why: 'During delay(400) Dowee keeps driving without looking at the line.', iq: 'What does Dowee do during delay(400)?', io: ['Keeps driving without looking', 'Stops and waits', 'Reads the sensors faster'] },
  'bug-threshold': { predict: ['It loses the line', 'It follows the line', 'It drives backwards'], why: 'It checks for numbers smaller than black, but black gives a big number.', iq: 'A sensor on black reads about…', io: ['950: a big number', '100: a small number', '0'] },
  'bug-rc': { predict: ['Forward does nothing', 'Every key works', 'It drives backwards'], why: 'The program waits for a small f, but the controller sends a capital F.', iq: 'Are \'f\' and \'F\' the same letter for the Arduino?', io: ['No, they are different', 'Yes, the same'] },
  'bug-sonar': { predict: ['It keeps turning and gets nowhere', 'It drives round the room', 'It crashes into every wall'], why: 'The if is the wrong way round: it turns when the way is <b>clear</b>.', iq: 'When should Dowee turn away?', io: ['When the distance is small', 'When the distance is big', 'All the time'] },
  'bug-edge': { predict: ['It backs away all the time', 'It wins quickly', 'It drives off the ring'], why: 'The edge check is upside down: the black ring (950) counts as the edge.', iq: 'The white edge gives…', io: ['A small number', 'A big number'] },
};
for (const L of LESSONS) {
  const P = PRIMM[L.id], B = BUG_PRIMM[L.id];
  if (P) {
    Object.assign(L, { predict: P.predict, investigate: P.investigate, modify: P.modify });
    if (P.todo && L.todo) Object.assign(L.todo, P.todo);
  } else if (B) {
    L.predict = { q: 'What will go wrong when you run it?', options: B.predict, answer: 0, why: B.why };
    L.investigate = [{ q: B.iq, options: B.io, answer: 0, why: 'Now find that part of the code and fix it.' }];
  }
}
// The Lessons page: levels in the suggested order. Extra levels are optional.
const LESSON_PATH = [
  { name: 'Start here', about: 'Your first programs: blocks and a blinking light.', ids: ['blocks', 'blink'], missions: ['lab'] },
  { name: 'Motors', about: 'Drive a set distance and turn on the spot.', ids: ['drive', 'turn'] },
  { name: 'Sensors', about: 'See the line and measure distance with sound.', ids: ['see', 'sonar'], missions: ['maze'] },
  { name: 'Line following', about: 'From a simple follower to a full PID racer.', ids: ['follow', 'pid1', 'pid2', 'pid3', 'pid'], missions: ['line'] },
  { name: 'Remote control', about: 'Drive Dowee over Bluetooth and play soccer.', ids: ['rc', 'soccer'], missions: ['race', 'soccer'] },
  { name: 'Sumo', about: 'Stay in the ring and push the other robot out.', ids: ['edge', 'fight'], missions: ['sumo'] },
  { name: 'Advanced PID', about: 'Write P, I and D yourself. For confident coders.', ids: ['apid1', 'apid2', 'apid3'], extra: true },
  { name: 'Fix the bug', about: 'Each program has one mistake. Can you find it?', ids: CHALLENGES.map(c => c.id), extra: true },
];
if (typeof module !== 'undefined') Object.assign(module.exports, { PRIMM, LESSON_PATH, PQ });
