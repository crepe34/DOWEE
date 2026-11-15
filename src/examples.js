/* =====================================================================
   Example programs. Every one of these also runs on a real Arduino Uno
   wired as shown in the Wiring tab.
   ===================================================================== */
const MOTOR_SETUP = `// Motor driver (L298N) pins
const int ENA = 5;   // left motor speed (PWM)
const int IN1 = 7;   // left motor direction
const int IN2 = 8;
const int ENB = 6;   // right motor speed (PWM)
const int IN3 = 9;   // right motor direction
const int IN4 = 10;`;
const DRIVE_FN = `// Drive both motors. Speeds go from -255 (full reverse) to 255 (full forward).
void drive(int left, int right) {
  left = constrain(left, -255, 255);
  right = constrain(right, -255, 255);
  digitalWrite(IN1, left >= 0 ? HIGH : LOW);
  digitalWrite(IN2, left >= 0 ? LOW : HIGH);
  analogWrite(ENA, abs(left));
  digitalWrite(IN3, right >= 0 ? HIGH : LOW);
  digitalWrite(IN4, right >= 0 ? LOW : HIGH);
  analogWrite(ENB, abs(right));
}`;
const PINMODES = `  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);`;

// ---- The DOWEE way to read the line (shared by the PID sample, the PID lessons and the blocks) ----
// 1. calibrate(): sweep over the line, remember each sensor's white (min) and black (max) reading,
//    then threshold = halfway between the average white and the average black.
// 2. readLine(): every sensor is on the line (1) or not (0); the line's position is the average
//    of the sensors that see it: 1 (far left) .. 3 (middle) .. 5 (far right).
const LINE_GLOBALS = `// ---- The line sensors ----
int minV[5] = {1023, 1023, 1023, 1023, 1023};   // each sensor's white reading (its smallest)
int maxV[5] = {0, 0, 0, 0, 0};                  // each sensor's black reading (its biggest)
int threshold = 500;   // above this = the sensor sees the line (calibrate() works out the real one)
int onLine[5];         // 1 = this sensor sees the line, 0 = it sees the white floor
int seen = 0;          // how many sensors see the line
float position = 3;    // where the line is: 1 (far left) .. 3 (middle) .. 5 (far right)`;
const CALIBRATE_FN = `// Sweep left and right over the line for 2 seconds, so every sensor sees white and black.
// Then the threshold is halfway between the average white and the average black.
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
  long whiteSum = 0;
  long blackSum = 0;
  for (int i = 0; i < 5; i++) {
    whiteSum += minV[i];
    blackSum += maxV[i];
  }
  int avgWhite = whiteSum / 5;
  int avgBlack = blackSum / 5;
  threshold = (avgWhite + avgBlack) / 2;
  Serial.print("white ");
  Serial.print(avgWhite);
  Serial.print("  black ");
  Serial.print(avgBlack);
  Serial.print("  threshold ");
  Serial.println(threshold);
  digitalWrite(LED_BUILTIN, LOW);
  delay(300);
}`;
const READLINE_FN = `// Reads all 5 sensors: each one sees the line (1) or not (0).
// The line's position is the average of the sensors that see it:
// only sensor 1 gives 1, sensors 2 and 3 give 2.5, only the middle one gives 3.
void readLine() {
  int sum = 0;
  seen = 0;
  for (int i = 0; i < 5; i++) {
    onLine[i] = analogRead(A0 + i) > threshold ? 1 : 0;
    seen += onLine[i];
    sum += onLine[i] * (i + 1);
  }
  if (seen > 0) position = (float)sum / seen;   // no line: keep the last position
}`;

const EXAMPLES = {
  line: {
    pid: { name: 'PID line follower (5 sensors)', code: `// PID line follower with calibration
// Five IR sensors on A0 (left) to A4 (right). Higher reading = darker floor.
// 1. Press the start button on pin 2 (or type g in the Serial monitor).
// 2. calibrate(): Dowee sweeps over the line and works out the threshold between white and black.
// 3. It follows the line with a PID worked out every 10 ms. If the line is lost, it spins
//    towards where it was last seen. At a crossing, it drives straight over.
${MOTOR_SETUP}

// ---- Tune these in the Tune tab while the robot drives ----
float Kp = 70;        // turn harder when far from the line (error 1 = one sensor off centre)
float Ki = 0;         // the I part: 0 = off (Dowee's motors are matched, so it only adds wobble)
float Kd = 1000;      // calms the wobble: the change in error over one 10 ms step, times Kd
int baseSpeed = 240;  // cruising speed, 0-255
int turnSpeed = 170;  // spin speed when the line is lost
int sampleMs = 10;    // work out the PID every 10 ms

const int startButton = 2;   // a button between pin 2 and GND: reads LOW while pressed

${LINE_GLOBALS}

float lastError = 0;
float integral = 0;
char lostSide = 's';  // where the line was last seen at the edge: 'l', 'r', or 's' (not yet)
unsigned long lastPid = 0;

void setup() {
${PINMODES}
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(startButton, INPUT_PULLUP);
  Serial.begin(9600);
  waitForStart();
  calibrate();
}

${DRIVE_FN}

// Wait for the start button (pin 2 goes LOW) or the letter g in the Serial monitor.
void waitForStart() {
  Serial.println("Press the button on pin 2, or type g, to start.");
  while (true) {
    if (digitalRead(startButton) == LOW) break;
    if (Serial.available() > 0 && Serial.read() == 'g') break;
  }
  Serial.println("Go!");
}

${CALIBRATE_FN}

${READLINE_FN}

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

  // The PID, every sampleMs milliseconds
  if (millis() - lastPid >= sampleMs) {
    lastPid = millis();
    float error = position - 3;            // + means the line is to the RIGHT
    integral = constrain(integral + error, -40, 40);   // anti-windup
    float turn = Kp * error + Ki * integral + Kd * (error - lastError);
    lastError = error;
    drive(baseSpeed + turn, baseSpeed - turn);
  }
}
` },
    bang: { name: 'Simple 2-sensor follower', code: `// Beginner line follower: uses only the two outer-middle sensors.
// A1 = left-middle, A3 = right-middle. A reading above the threshold = the sensor sees the black line.
${MOTOR_SETUP}

int speed = 150;
int threshold = 500;   // halfway between white (about 100) and black (about 950)

void setup() {
${PINMODES}
}

${DRIVE_FN}

void loop() {
  int left = analogRead(A1) > threshold ? 1 : 0;    // 1 = sees the line
  int right = analogRead(A3) > threshold ? 1 : 0;

  if (left == 1 && right == 0) {
    drive(0, speed);          // line is on the left: turn left
  } else if (right == 1 && left == 0) {
    drive(speed, 0);          // line is on the right: turn right
  } else {
    drive(speed, speed);      // go straight
  }
}
` },
    print: { name: 'Print sensor values', code: `// Read all 5 line sensors and send them to the Serial Plotter.
void setup() {
  Serial.begin(9600);
}

void loop() {
  for (int i = 0; i < 5; i++) {
    Serial.print(analogRead(A0 + i));
    Serial.print(i < 4 ? "," : "\\n");
  }
  delay(50);
}
` },
  },
  race: {
    rc: { name: 'Bluetooth RC car', code: `// Bluetooth RC car (HC-05 on pins 0/1, Serial at 9600)
// Commands from the phone app or keyboard:
//   F B L R = forward, back, left, right    S = stop
//   G I H J = forward-left, forward-right, back-left, back-right
//   0-9 = speed, q = full speed
${MOTOR_SETUP}

int speed = 220;

void setup() {
${PINMODES}
  Serial.begin(9600);
}

${DRIVE_FN}

void loop() {
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    switch (cmd) {
      case 'F': drive(speed, speed); break;
      case 'B': drive(-speed, -speed); break;
      case 'L': drive(-speed / 2, speed / 2); break;
      case 'R': drive(speed / 2, -speed / 2); break;
      case 'G': drive(speed / 3, speed); break;
      case 'I': drive(speed, speed / 3); break;
      case 'H': drive(-speed / 3, -speed); break;
      case 'J': drive(-speed, -speed / 3); break;
      case 'S': drive(0, 0); break;
      case 'q': speed = 255; break;
      default:
        if (cmd >= '0' && cmd <= '9') {
          speed = map(cmd - '0', 0, 9, 60, 240);
        }
    }
  }
}
` },
  },
  soccer: {},
  sumo: {
    basic: { name: 'Sumo: search, attack, stay in', code: `// Sumo robot
// Edge sensors: A0 = far-left, A4 = far-right of the IR array (white edge reads LOW numbers)
// Ultrasonic: TRIG on 11, ECHO on 12. LED on 13 shows "target locked".
${MOTOR_SETUP}
const int TRIG = 11;
const int ECHO = 12;

int edgeLimit = 400;     // below this number = white edge
int attackRange = 70;    // cm: charge when the opponent is closer than this
int searchSpeed = 130;

void setup() {
${PINMODES}
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  // Sumo rule: wait 5 seconds after the start. Blink while waiting.
  for (int i = 0; i < 5; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(500);
    digitalWrite(LED_BUILTIN, LOW);
    delay(500);
  }
}

${DRIVE_FN}

long readDistanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long duration = pulseIn(ECHO, HIGH, 30000);  // give up after 30 ms
  if (duration == 0) return 999;               // nothing seen
  return duration * 0.034 / 2;
}

void loop() {
  int left = analogRead(A0);
  int right = analogRead(A4);

  if (left < edgeLimit || right < edgeLimit) {
    drive(-220, -220);                 // edge! back up...
    delay(250);
    if (left < edgeLimit) drive(200, -200); else drive(-200, 200);
    delay(220);                        // ...and turn away
    return;
  }

  long d = readDistanceCm();
  if (d < attackRange) {
    digitalWrite(LED_BUILTIN, HIGH);
    drive(255, 255);                   // charge!
  } else {
    digitalWrite(LED_BUILTIN, LOW);
    drive(searchSpeed, -searchSpeed);  // spin to search
  }
}
` },
  },
  maze: {
    avoid: { name: 'Avoid obstacles with ultrasonic', code: `// Obstacle avoider: drive forward, turn away when something is close.
${MOTOR_SETUP}
const int TRIG = 11;
const int ECHO = 12;

int safeDistance = 25;   // cm
int cruise = 200;

void setup() {
${PINMODES}
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  Serial.begin(9600);
}

${DRIVE_FN}

long readDistanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long duration = pulseIn(ECHO, HIGH, 30000);
  if (duration == 0) return 999;
  return duration * 0.034 / 2;
}

void loop() {
  long d = readDistanceCm();
  Serial.println(d);
  if (d < safeDistance) {
    drive(-150, -150);
    delay(200);
    drive(-170, 170);          // turn left
    delay(random(250, 500));
  } else {
    drive(cruise, cruise);
  }
  delay(30);
}
` },
  },
  lab: {
    meter: { name: 'Drive 1 metre, then stop', code: `// Calibration test: drive forward for a set time and stop.
// Watch "Distance" in the top-left. Change driveTime until it stops at 100 cm.
${MOTOR_SETUP}

int speed = 180;
int driveTime = 1500;   // milliseconds

void setup() {
${PINMODES}
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  digitalWrite(LED_BUILTIN, HIGH);
  drive(speed, speed);
  delay(driveTime);
  drive(0, 0);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("Done!");
}

${DRIVE_FN}

void loop() {
  // nothing to repeat
}
` },
    turn: { name: 'Turn 90 degrees', code: `// Spin on the spot for turnTime ms. Watch "Turned" — aim for 90°.
${MOTOR_SETUP}

int turnSpeed = 150;
int turnTime = 400;

void setup() {
${PINMODES}
  drive(turnSpeed, -turnSpeed);   // left wheel forward, right wheel back = turn right
  delay(turnTime);
  drive(0, 0);
}

${DRIVE_FN}

void loop() {
}
` },
    blink: { name: 'Blink the LED', code: `// The classic first program: blink the LED on pin 13.
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);   // LED on
  delay(500);                        // wait half a second
  digitalWrite(LED_BUILTIN, LOW);    // LED off
  delay(500);
}
` },
  },
};
EXAMPLES.soccer.rc = { ...EXAMPLES.race.rc, name: 'Bluetooth RC (soccer)' };
const DEFAULT_EXAMPLE = { line: 'pid', race: 'rc', soccer: 'rc', sumo: 'basic', maze: 'avoid', lab: 'meter' };
if (typeof module !== 'undefined') Object.assign(module.exports, { EXAMPLES, LINE_GLOBALS, CALIBRATE_FN, READLINE_FN });
