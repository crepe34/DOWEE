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

const EXAMPLES = {
  line: {
    pid: { name: 'PID line follower (5 sensors)', code: `// PID line follower with sensor calibration
// Five IR sensors on A0 (left) to A4 (right). Higher reading = darker floor.
// Real sensors all read a bit differently, so Dowee first sweeps over the line
// and learns the darkest and brightest value each sensor sees.
${MOTOR_SETUP}

// ---- Tune these in the Tune tab while the robot drives ----
float Kp = 0.08;      // turn harder when far from the line
float Kd = 1.5;       // calms down the wiggle
int baseSpeed = 150;  // cruising speed, 0-255

int minV[5] = {1023, 1023, 1023, 1023, 1023};
int maxV[5] = {0, 0, 0, 0, 0};
int lastError = 0;

void setup() {
${PINMODES}
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  calibrate();
}

${DRIVE_FN}

// Sweep left and right over the line for 2 seconds, remembering min and max.
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
    Serial.print(minV[i]);
    Serial.print("-");
    Serial.print(maxV[i]);
    Serial.print(i < 4 ? "  " : "\\n");
  }
  digitalWrite(LED_BUILTIN, LOW);
  delay(300);
}

// One sensor scaled to 0 (white) .. 1000 (black)
int readSensor(int i) {
  long v = map(analogRead(A0 + i), minV[i], maxV[i], 0, 1000);
  return constrain(v, 0, 1000);
}

// Where is the line? -2000 (far left) .. 0 (center) .. 2000 (far right)
int readLine() {
  long weighted = 0;
  long total = 0;
  for (int i = 0; i < 5; i++) {
    int v = readSensor(i);
    if (v < 100) v = 0;                 // ignore small noise
    weighted += (long)v * (i - 2) * 1000;
    total += v;
  }
  if (total < 300) {                    // line lost: keep turning the way we last saw it
    return lastError > 0 ? 2000 : -2000;
  }
  return weighted / total;
}

void loop() {
  int error = readLine();               // + means the line is to the RIGHT
  int turn = Kp * error + Kd * (error - lastError);
  lastError = error;
  drive(baseSpeed + turn, baseSpeed - turn);
  delay(2);
}
` },
    bang: { name: 'Simple 2-sensor follower', code: `// Beginner line follower: uses only the two outer-middle sensors.
// A1 = left-middle, A3 = right-middle. HIGH = sees the black line.
${MOTOR_SETUP}

int speed = 150;

void setup() {
${PINMODES}
}

${DRIVE_FN}

void loop() {
  int left = digitalRead(A1);
  int right = digitalRead(A3);

  if (left == HIGH && right == LOW) {
    drive(0, speed);          // line is on the left: turn left
  } else if (right == HIGH && left == LOW) {
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
if (typeof module !== 'undefined') module.exports.EXAMPLES = EXAMPLES;
