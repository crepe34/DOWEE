// The finished versions of the line lessons' TODO starters, shared by tools/check.js (text) and
// tools/blocks-check.js (which compares each block solution with its text solution).
'use strict';
const PID_FIX = {
  pid1: [["      // TODO 1: remember this sensor's whitest and blackest reading:\n      //   if v is smaller than minV[i], put v in minV[i]. If v is bigger than maxV[i], put v in maxV[i].\n\n", '      if (v < minV[i]) minV[i] = v;\n      if (v > maxV[i]) maxV[i] = v;\n'],
    ['  // TODO 2: the threshold is halfway between the average white and the average black.\n  threshold = 0;', '  threshold = (avgWhite + avgBlack) / 2;']],
  pid2: [['    // TODO 1: does sensor i see the line? 1 if analogRead(A0 + i) is above the threshold, else 0.\n    onLine[i] = 0;\n    // TODO 2: count it: add onLine[i] to seen, and onLine[i] * (i + 1) to sum.\n\n', '    onLine[i] = analogRead(A0 + i) > threshold ? 1 : 0;\n    seen += onLine[i];\n    sum += onLine[i] * (i + 1);\n'],
    ['  // TODO 3: if seen is more than 0, the position is the average:  (float)sum / seen\n  //         (if no sensor sees the line, keep the last position)\n', '  if (seen > 0) position = (float)sum / seen;\n']],
  pid3: [['  float turn = 0;', '  float turn = Kp * error;'], ['  drive(baseSpeed, baseSpeed);\n  delay(10);', '  drive(baseSpeed + turn, baseSpeed - turn);\n  delay(10);']],
  pid: [['  float turn = Kp * error;   // the P part, from PID 3', '  float turn = Kp * error + Kd * change;']],
};

const gsub = (c, a, b) => { if (!c.includes(a)) throw new Error(`guided: text not found: ${a.slice(0, 40)}`); return c.replace(a, b); };
const GUIDED_STEPS = {
  1: c => gsub(gsub(c, `    // TODO: spin one way, then the other. (millis() - start tells you how long you have been sweeping.)\n\n    // TODO: for each sensor i, update minV[i] and maxV[i].\n\n`,
    `    unsigned long t = millis() - start;\n    if (t < 250 || (t >= 750 && t < 1250) || t >= 1750) drive(-120, 120);\n    else drive(120, -120);\n    for (int i = 0; i < 5; i++) {\n      int v = analogRead(A0 + i);\n      if (v < minV[i]) minV[i] = v;\n      if (v > maxV[i]) maxV[i] = v;\n    }\n`),
    `  // TODO: average the minV values, average the maxV values, and set the threshold halfway between them.\n\n`,
    `  long whiteSum = 0;\n  long blackSum = 0;\n  for (int i = 0; i < 5; i++) {\n    whiteSum += minV[i];\n    blackSum += maxV[i];\n  }\n  threshold = (whiteSum / 5 + blackSum / 5) / 2;\n`),
  2: c => gsub(c, `  // TODO: like in PID 2.\n\n`, `  int sum = 0;\n  seen = 0;\n  for (int i = 0; i < 5; i++) {\n    onLine[i] = analogRead(A0 + i) > threshold ? 1 : 0;\n    seen += onLine[i];\n    sum += onLine[i] * (i + 1);\n  }\n  if (seen > 0) position = (float)sum / seen;\n`),
  3: c => gsub(c, '  float turn = 0;\n  if (error > 0.5) turn = 50;\n  if (error < -0.5) turn = -50;', '  float turn = Kp * error + Kd * (error - lastError);'),
  4: (c, lim = true) => gsub(gsub(gsub(c, '  float turn = Kp * error + Kd * (error - lastError);', `  integral = ${lim ? 'constrain(integral + error, -iLimit, iLimit)' : 'integral + error'};\n  float turn = Kp * error + Ki * integral + Kd * (error - lastError);`),
    'float Kp = 70;', 'float Kp = 20;'), 'float Ki = 0;', `float Ki = ${lim ? 1 : 3};`),
  5: c => gsub(gsub(gsub(c, 'float Kp = 20;', 'float Kp = 70;'), 'float Ki = 1;', 'float Ki = 0;'), 'int baseSpeed = 150;', 'int baseSpeed = 220;'),
};
// apid4: weight each sensor by how dark it is
const GREY_FIX = ['  if (seen > 0) position = (float)sum / seen;   // no line: keep the last position\n', '  long weighted = 0, total = 0;\n  for (int i = 0; i < 5; i++) {\n    long dark = constrain(map(analogRead(A0 + i), minV[i], maxV[i], 0, 1000), 0, 1000);\n    weighted += dark * (i + 1);\n    total += dark;\n  }\n  if (seen > 0) position = (float)weighted / total;\n'];
// The finished text program of a lesson (pid1, pid2, pid3, pid, apid3 = guide step 5, apid4).
function textSolution(M, id) {
  const L = M.LESSONS.find(l => l.id === id);
  if (PID_FIX[id]) return PID_FIX[id].reduce((c, [a, b]) => { if (!c.includes(a)) throw new Error(`${id}: fix text not found: ${a.slice(0, 40)}`); return c.replace(a, b); }, L.code);
  if (id === 'apid3') return [1, 2, 3, 4, 5].reduce((c, n) => GUIDED_STEPS[n](c), M.PIDI_GUIDED);
  if (id === 'apid4') { if (!M.PIDI_GREY.includes(GREY_FIX[0])) throw new Error('apid4: fix text not found'); return M.PIDI_GREY.replace(GREY_FIX[0], GREY_FIX[1]); }
  return null;
}
module.exports = { PID_FIX, GUIDED_STEPS, GREY_FIX, textSolution };
