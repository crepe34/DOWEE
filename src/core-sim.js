/* =====================================================================
   RoboBench core 2/2 — Arduino board runtime, robot physics, arenas.
   World units: metres, seconds; y points up. Physics step: 1 ms.
   ===================================================================== */
const GRAV = 9.81;
const wrapAng = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(rng) { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }

/* ---------------- realism ----------------
   Every real robot is a little different, and so is every table. A Dowee "unit" gets fixed
   hardware quirks from its serial number (like a real robot you built), and every world gets
   floor, light and noise imperfections. Level: ideal (0), real (1), tough (1.7). */
const REALISM = { ideal: 0, real: 1, tough: 1.7 };
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), u0 = x - xi, v0 = y - yi;
  const h = (a, b) => { let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 1442695041)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t), u = sm(u0), v = sm(v0);
  const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * u, b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * u;
  return (a + (b - a) * v) * 2 - 1;
}
function makeQuirks(seed, level, nSensors = 8) {
  const k = REALISM[level] ?? 1, rng = mulberry32((seed | 0) || 1), g = () => gauss(rng);
  return {
    k, level, seed,
    gainL: 1 + 0.02 * k * g(), gainR: 1 + 0.02 * k * g(),      // TT motors + wheel size differ a few %
    revL: 1 - 0.05 * k * rng(), revR: 1 - 0.05 * k * rng(),       // gearboxes are weaker backwards
    dbL: Math.round(3.5 * k * g()), dbR: Math.round(3.5 * k * g()),    // each motor starts at a different PWM
    stiction: Math.round(16 * k),                                   // extra PWM to break free from standstill
    tau: k ? 0.045 + 0.02 * rng() + 0.01 * (k - 1) : 0,           // motor + gearbox spin-up time (s)
    sGain: Array.from({ length: nSensors }, () => 1 + 0.07 * k * g()),
    sOff: Array.from({ length: nSensors }, () => Math.round(22 * k * g())),
    height: 0.005 + 0.0004 * k * g(),                               // IR sensor height above the floor (m)
    casterMu: 0.05 * k * (0.7 + 0.6 * rng()),                       // ball caster rolling drag
    yawNoise: 0.0012 * k,                                            // bumps and caster scrub (N·m)
    sonarBias: 0.006 * k * g(),
    barY: 0.0012 * k * g(), barTwist: 0.025 * k * g(),             // sensor bar mounted a bit off-centre and twisted
  };
}
function makeEnv(level, seed, arenaId) {
  const k = REALISM[level] ?? 1, rng = mulberry32(((seed | 0) || 1) * 7 + 3);
  const env = {
    k, level, seed,
    matVar: 0.03 * k, lineVar: 0.025 * k,                   // reflectance varies across the mat and the tape
    gripVar: k > 1 ? 0.3 : 0.1 * k,                        // dust patches change tyre grip
    motorNoise: 7 * k,                                     // motor PWM noise picked up by analog wires
    spike: 0.0015 * k,                                     // rare big glitches on an analog read
    sonarDrop: 0.02 * k, sonarAngle: k ? Math.cos(42 * Math.PI / 180) : 0,   // flat walls hit at a slant don't echo back
    btDelay: k ? [25, 45 * k] : [0, 0],                    // Bluetooth latency (ms)
    sun: null,
  };
  if (k > 1) { const sx = rng() < 0.5 ? 0 : 1; env.sun = { x0: sx, amount: 70 }; }   // sunlight from a window on one side
  else if (k) env.sun = { x0: rng() < 0.5 ? 0 : 1, amount: 25 };
  return env;
}
// Ambient IR (room light, sunlight) makes the sensors read lower, as if the floor were whiter.
function ambientAt(env, A, x) { if (!env || !env.sun) return 0; const f = env.sun.x0 === 0 ? 1 - x / A.w : x / A.w; return env.sun.amount * clamp(f, 0, 1) ** 2; }

/* ---------------- Arduino board ---------------- */
class Board {
  constructor(robot) { this.robot = robot; this.onSerial = null; this.onHint = null; this.onTone = null; this.reset(); }
  reset() {
    this.mode = new Array(22).fill(0); this.out = new Array(22).fill(0); this.pwm = new Array(22).fill(null);
    this.rx = []; this.baud = 0; this.cost = 0; this.base = 0; this.wake = 0; this.t0 = 0; this.line = 0; this.depth = 0;
    this.prog = null; this.gen = null; this.state = 'off'; this.txFree = 0; this.trigArmed = false; this.rng = mulberry32(1234);
    this.loops = 0; this.warned = new Set(); this.ledToggles = 0; this.G = null; this.error = null; this.serialLines = 0;
  }
  hint(key, msg) { if (!this.warned.has(key)) { this.warned.add(key); this.onHint && this.onHint(msg, this.line); } }
  rand() { return this.rng(); }
  seed(s) { this.rng = mulberry32(Math.trunc(s) || 1); }
  now() { return this.base + this.cost; }
  millis() { return Math.floor(this.now() - this.t0) >>> 0; }
  micros() { return Math.floor((this.now() - this.t0) * 1000) >>> 0; }
  delay(ms) {
    ms = Math.trunc(+ms) || 0;
    if (ms < 0) { this.hint('negdelay', `delay(${ms}) got a negative number. A real Arduino reads it as a huge number and waits about 49 days.`); ms = ms >>> 0; }
    this.cost += ms;
  }
  delayUs(us) { us = Math.trunc(+us) || 0; if (us < 0) us = us & 0xffff; this.cost += us / 1000; }
  pin(p) {
    const q = Math.trunc(p);
    if (!(q >= 0 && q <= 21)) throw new RTError(`Pin ${p} doesn't exist on an Arduino Uno.`, this.line, 'Digital pins are 0–13, analog pins are A0–A5.');
    return q;
  }
  pinMode(p, m) { p = this.pin(p); this.mode[p] = m; if (m === 2) this.out[p] = 1; }
  digitalWrite(p, v) {
    p = this.pin(p);
    const val = v ? 1 : 0;
    if (p === 13 && this.out[13] !== val) this.ledToggles++;
    this.out[p] = val; this.pwm[p] = null;
    const pins = this.robot.cfg.pins;
    if (this.mode[p] !== 1) this.hint('pm' + p, `Pin ${pinName(p)} is written with digitalWrite, but pinMode(${pinName(p)}, OUTPUT) was never called, so the pin is too weak to drive anything.`);
    if (p === pins.trig && val && this.mode[p] === 1) this.trigArmed = true;
  }
  analogWrite(p, v) {
    p = this.pin(p);
    this.mode[p] = 1;
    let val = Math.trunc(+v) || 0;
    if (val < 0 || val > 255) {
      const w = val & 255;
      this.hint('aw' + p, `analogWrite(${pinName(p)}, ${val}): only 0 to 255 works. The Arduino keeps the lowest 8 bits, so the motor gets ${w}. Use constrain() or abs() first.`);
      val = w;
    }
    if (PWM_PINS.has(p)) { this.pwm[p] = val; this.out[p] = val > 0 ? 1 : 0; }
    else {
      this.pwm[p] = null; this.out[p] = val >= 128 ? 1 : 0;
      this.hint('np' + p, `Pin ${pinName(p)} can't do PWM. On an Uno only pins 3, 5, 6, 9, 10 and 11 can, so this pin is just ON or OFF.`);
    }
  }
  digitalRead(p) {
    p = this.pin(p);
    const r = this.robot, si = r.sensorIndex(p);
    if (si >= 0) return r.irDigital(si);
    if (p === r.cfg.pins.echo) return 0;
    if (this.mode[p] === 2) return 1;
    if (this.mode[p] === 1) return this.out[p];
    return this.rng() < 0.5 ? 0 : 1; // floating input
  }
  analogRead(p) {
    let q = Math.trunc(p);
    if (q >= 0 && q <= 7) q += 14;
    if (!(q >= 14 && q <= 21)) throw new RTError(`analogRead(${p}): only analog pins A0–A5 can be read this way.`, this.line);
    const si = this.robot.sensorIndex(q);
    if (si >= 0) return this.robot.irAnalog(si);
    this.hint('float' + q, `${pinName(q)} is not connected to a sensor, so it reads random noise.`);
    return clamp(Math.round(330 + gauss(this.rng) * 60), 0, 1023);
  }
  pulseIn(p, state, timeout) {
    p = this.pin(p);
    const to = timeout === undefined ? 1000000 : Math.max(0, Math.trunc(timeout));
    const pins = this.robot.cfg.pins;
    if (p !== pins.echo || !this.robot.cfg.sonar) { this.cost += to / 1000; this.hint('pi' + p, `pulseIn(${pinName(p)}) waited for a pulse that never came. The ultrasonic ECHO pin is ${pinName(pins.echo)}.`); return 0; }
    if (!state) { this.cost += to / 1000; return 0; }
    if (!this.trigArmed) { this.cost += to / 1000; this.hint('trig', `pulseIn(ECHO) was called without a trigger pulse. First do digitalWrite(TRIG, HIGH), delayMicroseconds(10), digitalWrite(TRIG, LOW).`); return 0; }
    this.trigArmed = false;
    const d = this.robot.sonar();
    const dur = d === null ? 38000 : (d * 2 / 343) * 1e6;
    if (dur > to) { this.cost += to / 1000; return 0; }
    this.cost += 0.46 + dur / 1000;
    return Math.round(dur);
  }
  tone(p, f, d) { this.onTone && this.onTone(+f || 0, d === undefined ? 0 : +d); }
  serialBegin(b) { this.baud = Math.trunc(b) || 9600; }
  serialOut(s) {
    s = String(s);
    if (!this.baud) this.hint('sb', 'Serial.print is used, but Serial.begin(9600) was never called in setup(). On a real Arduino nothing would appear.');
    const charMs = 10000 / (this.baud || 9600), now = this.now();
    this.txFree = Math.max(this.txFree, now) + s.length * charMs;
    const backlog = this.txFree - now - 64 * charMs;
    if (backlog > 0) this.cost += backlog;
    this.onSerial && this.onSerial(s);
    return s.length;
  }
  parseNum(isFloat) {
    const rx = this.rx;
    while (rx.length && !/[-0-9.]/.test(String.fromCharCode(rx[0]))) rx.shift();
    let s = '';
    while (rx.length && /[-0-9.]/.test(String.fromCharCode(rx[0]))) s += String.fromCharCode(rx.shift());
    return isFloat ? parseFloat(s) || 0 : parseInt(s, 10) || 0;
  }
  send(text) { for (const ch of String(text)) { if (this.rx.length < 64) this.rx.push(ch.charCodeAt(0) & 255); } }
  motorOut(en, a, b) {
    const on = p => this.mode[p] === 1 && this.out[p] === 1;
    const duty = this.mode[en] === 1 ? (this.pwm[en] != null ? this.pwm[en] / 255 : this.out[en]) : 0;
    const A = on(a), B = on(b);
    if (A && !B) return [duty, false];
    if (B && !A) return [-duty, false];
    return [0, duty > 0 && A === B];
  }
  load(compiled, t) {
    const warned = this.warned;
    this.reset(); this.warned = warned;
    this.prog = compiled; this.G = compiled.G;
    this.t0 = t; this.base = t; this.wake = t;
    this.gen = this.main(); this.state = 'run';
  }
  *invoke(F, vals) {
    if (++this.depth > 120) throw new RTError('Too many functions calling each other (stack overflow).', this.line, 'A function might be calling itself forever.');
    const L = new Array(F.nslots).fill(0);
    for (let i = 0; i < F.params.length; i++) { const p = F.params[i]; L[p.slot] = p.isArray ? vals[i] : WRAP[p.type](vals[i]); }
    const sig = yield* F.body(L);
    this.depth--;
    const v = sig && sig.r ? sig.v : 0;
    return F.ret === 'void' ? 0 : WRAP[F.ret](v);
  }
  *main() {
    const P = this.prog;
    // the simulator may already have set the globals (and the student's tuned values) at compile time
    if (!P.initDone) for (const p of P.initG) { if (p.s) p.s(null); else yield* p.g(null); }
    yield* this.invoke(P.funcs.get('setup'), []);
    const lp = P.funcs.get('loop');
    for (;;) { yield* this.invoke(lp, []); this.loops++; this.cost += 0.004; if (this.cost >= SLICE) yield 0; }
  }
  run(t) {
    let guard = 0;
    while (this.state === 'run' && this.wake <= t) {
      this.base = this.wake; this.cost = 0;
      let r;
      try { r = this.gen.next(); }
      catch (e) {
        this.state = 'error';
        this.error = (e instanceof RTError || e instanceof CError) ? e : new RTError('The program crashed: ' + e.message, this.line);
        this.onError && this.onError(this.error);
        return;
      }
      if (r.done) { this.state = 'done'; return; }
      this.wake = this.base + Math.max(this.cost, 0.001);
      if (++guard > 20000) break;
    }
  }
}

/* ---------------- geometry ---------------- */
function segDist2(px, py, s) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - s.x1) * dx + (py - s.y1) * dy) / l2 : 0; t = clamp(t, 0, 1);
  const qx = s.x1 + t * dx - px, qy = s.y1 + t * dy - py;
  return qx * qx + qy * qy;
}
function closestOnSeg(px, py, s) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - s.x1) * dx + (py - s.y1) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return { x: s.x1 + t * dx, y: s.y1 + t * dy };
}
class SegIndex {
  constructor(segs, cell = 0.05, pad = 0.08) {
    this.segs = segs; this.cell = cell; this.map = new Map();
    segs.forEach((s, k) => {
      const x0 = Math.floor((Math.min(s.x1, s.x2) - pad) / cell), x1 = Math.floor((Math.max(s.x1, s.x2) + pad) / cell);
      const y0 = Math.floor((Math.min(s.y1, s.y2) - pad) / cell), y1 = Math.floor((Math.max(s.y1, s.y2) + pad) / cell);
      for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
        const key = ix * 100003 + iy; let L = this.map.get(key); if (!L) this.map.set(key, (L = [])); L.push(k);
      }
    });
  }
  dist(x, y) {
    const L = this.map.get(Math.floor(x / this.cell) * 100003 + Math.floor(y / this.cell));
    if (!L) return Infinity;
    let best = Infinity;
    for (const k of L) { const d = segDist2(x, y, this.segs[k]); if (d < best) best = d; }
    return Math.sqrt(best);
  }
}
function catmull(pts, closed, per = 20) {
  const out = [], n = pts.length, get = i => (closed ? pts[((i % n) + n) % n] : pts[clamp(i, 0, n - 1)]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
function resample(pts, closed, step = 0.01) {
  const src = closed ? [...pts, pts[0]] : pts, out = [{ ...src[0] }];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1], b = src[i], L = Math.hypot(b.x - a.x, b.y - a.y);
    let d = step - carry;
    while (d <= L) { const t = d / L; out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); d += step; }
    carry = L - (d - step);
  }
  if (closed && out.length > 2 && Math.hypot(out[out.length - 1].x - out[0].x, out[out.length - 1].y - out[0].y) < step * 0.5) out.pop();
  return out;
}
class Path {
  constructor(pts, closed = true, step = 0.01) {
    this.closed = closed; this.pts = resample(pts, closed, step); this.step = step;
    const P = this.pts, n = P.length, segs = [];
    for (let i = 0; i < (closed ? n : n - 1); i++) { const a = P[i], b = P[(i + 1) % n]; segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }); }
    this.segs = segs; this.index = new SegIndex(segs); this.len = n * step;
  }
  dist(x, y) { return this.index.dist(x, y); }
  tangent(i) { const P = this.pts, n = P.length, a = P[(i - 2 + n) % n], b = P[(i + 2) % n]; return Math.atan2(b.y - a.y, b.x - a.x); }
  nearestAll(x, y) { let bi = 0, bd = Infinity; this.pts.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; bi = i; } }); return { i: bi, d: Math.sqrt(bd) }; }
  nearestWindow(x, y, c, w) { const P = this.pts, n = P.length; let bi = c, bd = Infinity; for (let k = -w; k <= w; k++) { const i = ((c + k) % n + n) % n, p = P[i], d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; bi = i; } } return { i: bi, d: Math.sqrt(bd) }; }
  offset(off) { const P = this.pts, n = P.length; return P.map((p, i) => { const t = this.tangent(i); return { x: p.x - Math.sin(t) * off, y: p.y + Math.cos(t) * off }; }); }
}

/* ---------------- floor (what the IR sensors see) ---------------- */
const cov1 = (d, edge, rs) => clamp(0.5 + (edge - d) / (2 * rs), 0, 1);
class Floor {
  constructor(w, h, base, color) { this.w = w; this.h = h; this.base = base; this.color = color; this.layers = []; this.outside = (x, y) => x < 0 || y < 0 || x > w || y > h; }
  poly(path, width, refl, color, opts = {}) { this.layers.push({ k: 'poly', path, hw: width / 2, refl, color, ...opts }); return this; }
  disc(cx, cy, r, refl, color) { this.layers.push({ k: 'disc', cx, cy, r, refl, color }); return this; }
  ring(cx, cy, r1, r2, refl, color) { this.layers.push({ k: 'ring', cx, cy, r1, r2, refl, color }); return this; }
  rect(x0, y0, x1, y1, refl, color) { this.layers.push({ k: 'rect', x0, y0, x1, y1, refl, color }); return this; }
  sample(x, y, rs) {
    if (this.outside(x, y)) return null;
    let r = this.base;
    for (const L of this.layers) {
      let c = 0;
      if (L.k === 'poly') { if (L.visualOnly) continue; c = cov1(L.path.dist(x, y), L.hw, rs); }
      else if (L.k === 'disc') c = cov1(Math.hypot(x - L.cx, y - L.cy), L.r, rs);
      else if (L.k === 'ring') { const d = Math.hypot(x - L.cx, y - L.cy); c = cov1(d, L.r2, rs) - cov1(d, L.r1, rs); }
      else if (L.k === 'rect') { if (L.visualOnly) continue; c = cov1(Math.abs(x - (L.x0 + L.x1) / 2), Math.abs(L.x1 - L.x0) / 2, rs) * cov1(Math.abs(y - (L.y0 + L.y1) / 2), Math.abs(L.y1 - L.y0) / 2, rs); }
      if (c > 0) r = r * (1 - c) + L.refl * c;
    }
    const env = this.env;
    if (env && env.k) r = clamp(r + (r > 0.5 ? env.matVar : env.lineVar) * vnoise(x * 6, y * 6, env.seed) + 0.01 * env.k * vnoise(x * 40, y * 40, env.seed + 9), 0, 1);
    return r;
  }
}

/* ---------------- robot presets ---------------- */
const DEFAULT_PINS = { ena: 5, in1: 7, in2: 8, enb: 6, in3: 9, in4: 10, trig: 11, echo: 12, s0: 14 };
// Dowee: the standard class robot. Arduino Uno + L298N + 2 TT gear motors (65 mm wheels)
// + 5-channel IR line array (TCRT5000) + HC-SR04 + HC-05, on 2 x 18650 cells (7.4 V).
const DOWEE = { label: 'Dowee (standard)', length: 0.18, width: 0.16, mass: 0.65, vmax: 0.75, stall: 2.6, deadband: 60, mismatch: 0, track: 0.135, axle: 0.02, grip: 0.85, wheelLoad: 0.8, sensors: 5, spacing: 0.015, sensorFwd: 0.085, sensorRadius: 0.005, noise: 0.6, irMode: 'high-on-black', sonar: true, sonarCone: 15, invertL: false, invertR: false };
const PRESETS = { dowee: DOWEE };
function makeCfg(preset, overrides) { return { ...PRESETS[preset], pins: { ...DEFAULT_PINS }, ...(overrides || {}) }; }

/* ---------------- robot ---------------- */
class Robot {
  constructor(cfg, name, color) {
    this.name = name; this.color = color; this.board = new Board(this); this.ai = null; this.world = null;
    this.q = makeQuirks(1, 'ideal'); this.battery = 1;
    this.setCfg(cfg); this.place(0, 0, 0);
  }
  setCfg(cfg) {
    this.cfg = cfg; this.hl = cfg.length / 2; this.hw = cfg.width / 2; this.rad = Math.hypot(this.hl, this.hw);
    this.invM = 1 / cfg.mass; this.I = cfg.mass * (cfg.length ** 2 + cfg.width ** 2) / 12; this.invI = 1 / this.I;
  }
  place(x, y, th) {
    Object.assign(this, { hJit: 0, mL: 0, mR: 0, yawD: 0, aLong: 0, vLongPrev: 0, x, y, th, vx: 0, vy: 0, w: 0, odo: 0, fallen: false, fallT: 0, dutyL: 0, dutyR: 0, wl: 0, wr: 0, trail: [], stillT: 0, start: { x, y, th }, headingAcc: 0, slip: false });
  }
  worldPoint(bx, by) { const c = Math.cos(this.th), s = Math.sin(this.th); return { x: this.x + bx * c - by * s, y: this.y + bx * s + by * c }; }
  sensorLocal(i) { const c = this.cfg, q = this.q || {}, yy = ((c.sensors - 1) / 2 - i) * c.spacing; return { x: c.sensorFwd - yy * (q.barTwist || 0), y: yy + (q.barY || 0) }; }
  sensorPos(i) { const l = this.sensorLocal(i); return this.worldPoint(l.x, l.y); }
  sensorIndex(pin) { const i = pin - this.cfg.pins.s0; return i >= 0 && i < this.cfg.sensors ? i : -1; }
  reflect(i) { const p = this.sensorPos(i); return this.world ? this.world.reflect(p.x, p.y, this.cfg.sensorRadius) : 0.9; }
  irAnalog(i) {
    const q = this.q, W = this.world, env = W.env;
    if (!q.k) {
      const r = this.reflect(i);
      let v = r === null ? 1015 : 35 + (1 - r) * 940;
      v += gauss(W.rng) * this.cfg.noise * 10;
      return clamp(Math.round(v), 0, 1023);
    }
    // TCRT5000: the reflected light falls off quickly with height, so rocking and bumps change readings.
    const h = Math.max(0.002, q.height + this.aLong * 0.00009 + this.hJit);
    const p = this.sensorPos(i), r = W.reflect(p.x, p.y, Math.max(this.cfg.sensorRadius, h * 0.9));
    let v;
    if (r === null) v = 1015;
    else {
      const light = r * Math.pow(0.005 / h, 1.5);
      v = 1015 - light * 980;
      v = 512 + (v - 512) * (q.sGain[i] ?? 1) + (q.sOff[i] ?? 0);
      v -= ambientAt(env, W.arena, p.x);
    }
    const busy = (Math.abs(this.dutyL) + Math.abs(this.dutyR)) / 2;
    v += gauss(W.rng) * (this.cfg.noise * 10 + env.motorNoise * busy);
    if (W.rng() < env.spike) v += (W.rng() < 0.5 ? -1 : 1) * (150 + 250 * W.rng());
    return clamp(Math.round(v), 0, 1023);
  }
  irDigital(i) { const black = this.irAnalog(i) > 512; return this.cfg.irMode === 'low-on-black' ? (black ? 0 : 1) : (black ? 1 : 0); }
  sonar() {
    if (!this.world) return null;
    const o = this.worldPoint(this.hl, 0), half = this.cfg.sonarCone * Math.PI / 180, env = this.world.env;
    let best = Infinity;
    for (let k = 0; k < 7; k++) {
      const a = this.th + (k / 6 - 0.5) * 2 * half;
      const dx = Math.cos(a), dy = Math.sin(a), hit = this.world.raycast(o.x, o.y, dx, dy, this, true);
      // A flat surface hit at a slant reflects the sound away: no echo (real HC-SR04 behaviour).
      if (env.k && hit.n && Math.abs(dx * hit.n.x + dy * hit.n.y) < env.sonarAngle) continue;
      if (hit.d < best) best = hit.d;
    }
    this.lastSonar = best;
    if (best > 4) return null;
    if (env.k && this.world.rng() < env.sonarDrop) return null;
    return Math.max(0.02, best + (this.q.sonarBias || 0) + gauss(this.world.rng) * (0.003 + 0.003 * env.k));
  }
  step(dt) {
    if (this.fallen) { this.fallT += dt; return; }
    const c = this.cfg;
    let dl, dr, bl = false, br = false;
    if (this.ai) { dl = clamp(this.ai.l, -1, 1); dr = clamp(this.ai.r, -1, 1); }
    else { [dl, bl] = this.board.motorOut(c.pins.ena, c.pins.in1, c.pins.in2); [dr, br] = this.board.motorOut(c.pins.enb, c.pins.in3, c.pins.in4); }
    if (c.invertL) dl = -dl; if (c.invertR) dr = -dr;
    this.dutyL = dl; this.dutyR = dr;
    const q = this.q, k = q.k;
    // Each motor has its own dead zone, needs an extra kick to start (stiction), and is weaker backwards.
    const eff = (d, dbq, gain, rev, wv) => {
      const db = clamp((c.deadband + dbq + (k && Math.abs(wv) < 0.01 ? q.stiction : 0)) / 255, 0, 0.9), a = Math.abs(d);
      if (a <= db) return 0;
      return Math.sign(d) * (a - db) / (1 - db) * gain * (d < 0 ? rev : 1);
    };
    // Battery: 8.2 V full, 6.6 V flat, sags under load; the L298N loses about 1.8 V.
    let supply = 1;
    if (k) { const V = 6.6 + 1.6 * this.battery - 0.5 * k * (Math.abs(this.mL) + Math.abs(this.mR)) / 2; supply = clamp((V - 1.8) / 5.6, 0.3, 1.15); }
    let el = eff(dl, q.dbL || 0, q.gainL || 1, q.revL || 1, this.wl || 0) * supply, er = eff(dr, q.dbR || 0, q.gainR || 1, q.revR || 1, this.wr || 0) * (1 - c.mismatch / 100) * supply;
    // Motors and gearboxes take a moment to spin up.
    if (q.tau) { const a = Math.min(1, dt / q.tau); this.mL += (el - this.mL) * a; this.mR += (er - this.mR) * a; el = this.mL; er = this.mR; } else { this.mL = el; this.mR = er; }
    if (k && !this.ai) this.battery = Math.max(0, this.battery - (Math.abs(el) + Math.abs(er)) / 2 * dt / 2400);
    if (!this.ai && el === 0 && er === 0 && (dl !== 0 || dr !== 0) && Math.hypot(this.vx, this.vy) < 0.01) {
      this.stillT += dt;
      if (this.stillT > 0.8) this.board.hint('deadband', `The motors get a speed of ${Math.round(Math.max(Math.abs(dl), Math.abs(dr)) * 255)}, but this robot needs at least ${c.deadband} to start moving (motor friction). Try a bigger number.`);
    } else this.stillT = 0;
    const cs = Math.cos(this.th), sn = Math.sin(this.th);
    const env = this.world ? this.world.env : null;
    const gripHere = env && env.k ? c.grip * (1 - env.gripVar * (0.5 + 0.5 * vnoise(this.x * 4, this.y * 4, env.seed + 5))) : c.grip;
    const N = c.mass * GRAV * c.wheelLoad / 2, Fmax = gripHere * N;
    let Fx = 0, Fy = 0, Tq = 0; this.slip = false;
    for (let side = 0; side < 2; side++) {
      const sgn = side === 0 ? 1 : -1, e = side === 0 ? el : er, brake = side === 0 ? bl : br;
      const rx = c.axle * cs - sgn * c.track / 2 * sn, ry = c.axle * sn + sgn * c.track / 2 * cs;
      const vcx = this.vx - this.w * ry, vcy = this.vy + this.w * rx;
      const vlong = vcx * cs + vcy * sn, vlat = -vcx * sn + vcy * cs;
      let fl;
      if (Math.abs(e) > 1e-4) fl = c.stall * (e - vlong / c.vmax);
      else fl = -c.stall * vlong / c.vmax * (brake ? 1.0 : 0.3);
      let ft = -c.mass * 60 * vlat;
      const mag = Math.hypot(fl, ft);
      if (mag > Fmax) { fl *= Fmax / mag; ft *= Fmax / mag; this.slip = true; }
      const fx = fl * cs - ft * sn, fy = fl * sn + ft * cs;
      Fx += fx; Fy += fy; Tq += rx * fy - ry * fx;
      if (side === 0) this.wl = vlong; else this.wr = vlong;
    }
    if (k) {
      // Ball caster at the back: rolling drag, plus small random twists from bumps in the floor.
      const px = -this.hl + 0.01, rx = px * cs, ry = px * sn, vcx = this.vx - this.w * ry, vcy = this.vy + this.w * rx, vc = Math.hypot(vcx, vcy);
      if (vc > 0.003) { const F = q.casterMu * c.mass * GRAV * (1 - c.wheelLoad), fx = -F * vcx / vc, fy = -F * vcy / vc; Fx += fx; Fy += fy; Tq += rx * fy - ry * fx; }
      const sp = Math.min(1, Math.hypot(this.vx, this.vy) / 0.3);
      this.yawD += -this.yawD * dt / 0.25 + q.yawNoise * Math.sqrt(dt) * gauss(this.world.rng) * 8;
      Tq += this.yawD * sp;
      // The whole sensor bar bounces together as the robot rolls over the floor (slow, about 0.1 mm).
      this.hJit += -this.hJit * dt / 0.04 + 0.00057 * k * (0.3 + sp) * Math.sqrt(dt) * gauss(this.world.rng);
    }
    this.vx += Fx * this.invM * dt; this.vy += Fy * this.invM * dt; this.w += Tq * this.invI * dt;
    const vl = this.vx * cs + this.vy * sn; this.aLong += ((vl - this.vLongPrev) / dt - this.aLong) * Math.min(1, dt / 0.03); this.vLongPrev = vl;
    this.x += this.vx * dt; this.y += this.vy * dt; this.th += this.w * dt; this.headingAcc += this.w * dt;
    this.odo += Math.hypot(this.vx, this.vy) * dt;
  }
}

/* ---------------- collisions ---------------- */
function boxCorners(b) { const c = Math.cos(b.th), s = Math.sin(b.th), hl = b.hl, hw = b.hw; return [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].map(([a, d]) => ({ x: b.x + a * c - d * s, y: b.y + a * s + d * c })); }
function toLocal(b, p) { const dx = p.x - b.x, dy = p.y - b.y, c = Math.cos(b.th), s = Math.sin(b.th); return { x: dx * c + dy * s, y: -dx * s + dy * c }; }
function pointInBox(b, p) {
  const l = toLocal(b, p), px = b.hl - Math.abs(l.x), py = b.hw - Math.abs(l.y);
  if (px <= 0 || py <= 0) return null;
  const c = Math.cos(b.th), s = Math.sin(b.th);
  if (px < py) { const sx = Math.sign(l.x) || 1; return { n: { x: c * sx, y: s * sx }, d: px }; }
  const sy = Math.sign(l.y) || 1; return { n: { x: -s * sy, y: c * sy }, d: py };
}
function applyImp(b, r, jx, jy) { if (!b.invM) return; b.vx += jx * b.invM; b.vy += jy * b.invM; if (b.invI) b.w += (r.x * jy - r.y * jx) * b.invI; }
// n points from B to A
function resolve(A, B, p, n, d, e = 0.15, mu = 0.4) {
  const ima = A.invM || 0, imb = B ? B.invM || 0 : 0, iia = A.invI || 0, iib = B ? B.invI || 0 : 0;
  const tot = ima + imb; if (!tot) return;
  const corr = Math.max(d - 0.0003, 0) * 0.8 / tot;
  A.x += n.x * corr * ima; A.y += n.y * corr * ima;
  if (B && imb) { B.x -= n.x * corr * imb; B.y -= n.y * corr * imb; }
  const ra = { x: p.x - A.x, y: p.y - A.y }, rb = B ? { x: p.x - B.x, y: p.y - B.y } : { x: 0, y: 0 };
  const wa = A.w || 0, wb = B ? B.w || 0 : 0;
  const rvx = (A.vx - wa * ra.y) - (B ? B.vx - wb * rb.y : 0), rvy = (A.vy + wa * ra.x) - (B ? B.vy + wb * rb.x : 0);
  const vn = rvx * n.x + rvy * n.y; if (vn > 0) return;
  const raXn = ra.x * n.y - ra.y * n.x, rbXn = rb.x * n.y - rb.y * n.x;
  const j = -(1 + e) * vn / (ima + imb + raXn * raXn * iia + rbXn * rbXn * iib);
  applyImp(A, ra, n.x * j, n.y * j); if (B) applyImp(B, rb, -n.x * j, -n.y * j);
  const tx = -n.y, ty = n.x, vt = rvx * tx + rvy * ty;
  const raXt = ra.x * ty - ra.y * tx, rbXt = rb.x * ty - rb.y * tx;
  let jt = -vt / (ima + imb + raXt * raXt * iia + rbXt * rbXt * iib);
  jt = clamp(jt, -mu * j, mu * j);
  applyImp(A, ra, tx * jt, ty * jt); if (B) applyImp(B, rb, -tx * jt, -ty * jt);
}
function projBox(b, ax) { const c = Math.cos(b.th), s = Math.sin(b.th); const m = b.x * ax.x + b.y * ax.y, r = b.hl * Math.abs(c * ax.x + s * ax.y) + b.hw * Math.abs(-s * ax.x + c * ax.y); return [m - r, m + r]; }
// Separating-axis test between two boxes; resolves one contact. Works for perfectly aligned faces too.
function collideBoxes(A, B) {
  const ca = Math.cos(A.th), sa = Math.sin(A.th), cb = Math.cos(B.th), sb = Math.sin(B.th);
  const axes = [{ x: ca, y: sa }, { x: -sa, y: ca }, { x: cb, y: sb }, { x: -sb, y: cb }];
  let minO = Infinity, n = null;
  for (const ax of axes) {
    const [a0, a1] = projBox(A, ax), [b0, b1] = projBox(B, ax);
    const o = Math.min(a1, b1) - Math.max(a0, b0);
    if (o <= 0) return false;
    if (o < minO) { minO = o; const sg = (a0 + a1) < (b0 + b1) ? -1 : 1; n = { x: ax.x * sg, y: ax.y * sg }; }
  }
  const t = { x: -n.y, y: n.x };
  const pn = p => p.x * n.x + p.y * n.y, pt = p => p.x * t.x + p.y * t.y;
  const cA = boxCorners(A), cB = boxCorners(B);
  const aMin = Math.min(...cA.map(pn)), bMax = Math.max(...cB.map(pn));
  const [ta0, ta1] = projBox(A, t), [tb0, tb1] = projBox(B, t);
  const pts = [];
  for (const p of cA) if (pn(p) < aMin + 2e-3 && pt(p) >= tb0 - 1e-4 && pt(p) <= tb1 + 1e-4) pts.push(p);
  for (const p of cB) if (pn(p) > bMax - 2e-3 && pt(p) >= ta0 - 1e-4 && pt(p) <= ta1 + 1e-4) pts.push(p);
  let cp;
  if (pts.length) cp = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  else cp = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  if (A.static) resolve(B, null, cp, { x: -n.x, y: -n.y }, minO, 0.1, 0.5);
  else resolve(A, B.static ? null : B, cp, n, minO, 0.1, 0.5);
  return true;
}
function collideBoxSeg(A, s) {
  let hit = false;
  for (const p of boxCorners(A)) {
    const q = closestOnSeg(p.x, p.y, s), dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
    if (d2 < s.r * s.r) { const d = Math.sqrt(d2) || 1e-6; resolve(A, null, p, { x: dx / d, y: dy / d }, s.r - d, 0.2, 0.3); hit = true; }
  }
  for (const e of [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]) { const h = pointInBox(A, e); if (h) { resolve(A, null, e, { x: -h.n.x, y: -h.n.y }, h.d, 0.2, 0.3); hit = true; } }
  return hit;
}
function collideBallBox(ball, A) {
  const l = toLocal(A, ball), cx = clamp(l.x, -A.hl, A.hl), cy = clamp(l.y, -A.hw, A.hw);
  let dx = l.x - cx, dy = l.y - cy, nl, depth;
  const d2 = dx * dx + dy * dy;
  if (d2 > 1e-12) { const d = Math.sqrt(d2); if (d >= ball.r) return; nl = { x: dx / d, y: dy / d }; depth = ball.r - d; }
  else { const px = A.hl - Math.abs(l.x), py = A.hw - Math.abs(l.y); if (px < py) { nl = { x: Math.sign(l.x) || 1, y: 0 }; depth = px + ball.r; } else { nl = { x: 0, y: Math.sign(l.y) || 1 }; depth = py + ball.r; } }
  const c = Math.cos(A.th), s = Math.sin(A.th), n = { x: nl.x * c - nl.y * s, y: nl.x * s + nl.y * c };
  resolve(ball, A.invM ? A : null, { x: ball.x - n.x * ball.r, y: ball.y - n.y * ball.r }, n, depth, 0.45, 0.1);
}
function collideBallSeg(ball, s) {
  const q = closestOnSeg(ball.x, ball.y, s), dx = ball.x - q.x, dy = ball.y - q.y, d2 = dx * dx + dy * dy, R = ball.r + s.r;
  if (d2 < R * R) { const d = Math.sqrt(d2) || 1e-6; resolve(ball, null, q, { x: dx / d, y: dy / d }, R - d, 0.6, 0.05); }
}
function raySeg(ox, oy, dx, dy, x1, y1, x2, y2) {
  const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-12) return Infinity;
  const t = ((x1 - ox) * ey - (y1 - oy) * ex) / den, u = ((x1 - ox) * dy - (y1 - oy) * dx) / den;
  return t >= 0 && u >= 0 && u <= 1 ? t : Infinity;
}
function rayBox(ox, oy, dx, dy, b) { const c = boxCorners(b); let best = Infinity; for (let i = 0; i < 4; i++) { const a = c[i], e = c[(i + 1) % 4]; best = Math.min(best, raySeg(ox, oy, dx, dy, a.x, a.y, e.x, e.y)); } return best; }

class Ball {
  constructor(x, y) { this.r = 0.037; this.invM = 1 / 0.08; this.invI = 0; this.w = 0; this.place(x, y); }
  place(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; }
  step(dt) {
    const v = Math.hypot(this.vx, this.vy);
    if (v > 0) { const nv = Math.max(0, v - (0.25 + 0.5 * v) * dt); this.vx *= nv / v; this.vy *= nv / v; }
    this.x += this.vx * dt; this.y += this.vy * dt;
  }
}

/* ---------------- world ---------------- */
class World {
  constructor(arena) {
    this.arena = arena; this.floor = arena.floor; this.walls = arena.walls || []; this.boxes = (arena.boxes || []).map(b => ({ ...b, invM: 0, invI: 0, vx: 0, vy: 0, w: 0, static: true }));
    this.robots = []; this.ball = arena.ball ? new Ball(arena.ball.x, arena.ball.y) : null;
    this.time = 0; this.rng = mulberry32(7); this.bumps = 0; this.state = {}; this.pending = []; this.env = makeEnv('ideal', 1);
  }
  reflect(x, y, rs) { return this.floor.sample(x, y, rs); }
  add(r) { r.world = this; this.robots.push(r); return r; }
  raycast(ox, oy, dx, dy, self, withNormal) {
    let best = Infinity, n = null;
    const seg = (x1, y1, x2, y2) => { const t = raySeg(ox, oy, dx, dy, x1, y1, x2, y2); if (t < best) { best = t; const L = Math.hypot(x2 - x1, y2 - y1) || 1; n = { x: -(y2 - y1) / L, y: (x2 - x1) / L }; } };
    const box = b => { const c = boxCorners(b); for (let i = 0; i < 4; i++) { const a = c[i], e = c[(i + 1) % 4]; seg(a.x, a.y, e.x, e.y); } };
    for (const s of this.walls) seg(s.x1, s.y1, s.x2, s.y2);
    for (const b of this.boxes) box(b);
    for (const r of this.robots) if (r !== self && !r.fallen) box(r);
    if (this.ball) {
      const fx = ox - this.ball.x, fy = oy - this.ball.y, b = fx * dx + fy * dy, c = fx * fx + fy * fy - this.ball.r ** 2, disc = b * b - c;
      if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t >= 0 && t < best) { best = t; n = { x: dx, y: dy }; } }   // round: always echoes
    }
    return withNormal ? { d: best, n } : best;
  }
  // Bluetooth bytes arrive a little late, like a real HC-05 link.
  deliver(board, text) {
    const [lo, hi] = this.env ? this.env.btDelay : [0, 0];
    if (!hi) { board.send(text); return; }
    this.pending.push({ t: this.time + lo + (hi - lo) * this.rng(), board, text });
  }
  step() {
    this.time += 1;
    const dt = 0.001;
    if (this.pending.length) this.pending = this.pending.filter(m => { if (m.t <= this.time) { m.board.send(m.text); return false; } return true; });
    for (const r of this.robots) {
      if (r.board.state === 'run') r.board.run(this.time);
      if (r.ai && this.time % 10 === 0) r.ai.update(this, r, 0.01);
    }
    for (const r of this.robots) r.step(dt);
    if (this.ball) this.ball.step(dt);
    for (let it = 0; it < 2; it++) this.collide(it === 0);
    for (const r of this.robots) if (!r.fallen && this.time % 20 === 0) { r.trail.push(r.x, r.y); if (r.trail.length > 6000) r.trail.splice(0, 2); }
    this.arena.update && this.arena.update(this);
  }
  collide(count) {
    const R = this.robots.filter(r => !r.fallen);
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const a = R[i], b = R[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.rad + b.rad) collideBoxes(a, b);
    }
    for (const r of R) {
      let hit = false;
      for (const s of this.walls) if (segDist2(r.x, r.y, s) < (r.rad + s.r) ** 2) hit = collideBoxSeg(r, s) || hit;
      for (const b of this.boxes) if (Math.hypot(r.x - b.x, r.y - b.y) < r.rad + Math.hypot(b.hl, b.hw)) hit = collideBoxes(r, b) || hit;
      if (count) { if (hit && !r.bumping && this.time - (r.lastBump || -1e9) > 500) { this.bumps++; r.lastBump = this.time; } if (hit) r.lastBump = this.time; r.bumping = hit; }
      if (this.ball && Math.hypot(r.x - this.ball.x, r.y - this.ball.y) < r.rad + this.ball.r) collideBallBox(this.ball, r);
    }
    if (this.ball) for (const s of this.walls) collideBallSeg(this.ball, s);
  }
}

/* ---------------- lap timing ---------------- */
class LapTracker {
  constructor(path, tol) { this.path = path; this.tol = tol; this.reset(0); }
  reset(t) { this.i = null; this.acc = 0; this.laps = []; this.lapStart = t; this.errSum = 0; this.errN = 0; this.offT = 0; this.lost = false; this.lastErr = 0; }
  update(x, y, t) {
    const P = this.path, n = P.pts.length;
    let near = this.i === null ? P.nearestAll(x, y) : P.nearestWindow(x, y, this.i, 30);
    if (this.i !== null && near.d > this.tol) { const g = P.nearestAll(x, y); if (g.d < this.tol) { this.i = g.i; return null; } }
    this.lastErr = near.d;
    if (near.d > this.tol) { this.offT += 10; this.lost = this.offT > 1500; return null; }
    this.offT = 0; this.lost = false;
    if (this.i !== null) { let di = near.i - this.i; if (di > n / 2) di -= n; if (di < -n / 2) di += n; this.acc += di; }
    this.i = near.i; this.errSum += near.d * near.d; this.errN++;
    if (Math.abs(this.acc) >= n) {
      this.acc -= Math.sign(this.acc) * n;
      const lap = { time: (t - this.lapStart) / 1000, rms: Math.sqrt(this.errSum / Math.max(1, this.errN)) * 1000 };
      this.laps.push(lap); this.lapStart = t; this.errSum = 0; this.errN = 0;
      return lap;
    }
    return null;
  }
  progress() { return Math.abs(this.acc) / this.path.pts.length; }
}

/* ---------------- AI opponents ---------------- */
function edgeSeen(W, me) {
  const a = me.worldPoint(me.hl * 0.95, me.hw * 0.8), b = me.worldPoint(me.hl * 0.95, -me.hw * 0.8);
  const ra = W.reflect(a.x, a.y, 0.005), rb = W.reflect(b.x, b.y, 0.005);
  return [ra === null || ra > 0.5, rb === null || rb > 0.5];
}
function steerTo(me, tx, ty, speed, k = 1.6) {
  const a = wrapAng(Math.atan2(ty - me.y, tx - me.x) - me.th);
  const v = speed * Math.max(0, Math.cos(a));
  return [clamp(v - k * a * 0.5, -1, 1), clamp(v + k * a * 0.5, -1, 1), a];
}
function makeSumoAI(kind) {
  return {
    l: 0, r: 0, phase: null, t: 0, turnDir: 1,
    update(W, me, dt) {
      const opp = W.robots.find(r => r !== me);
      if (W.time - (W.state.startAt || 0) < 5000 || kind === 'statue' || W.state.over) { this.l = this.r = 0; return; }
      if (this.phase) { this.t -= dt; if (this.t <= 0) { if (this.phase === 'back') { this.phase = 'turn'; this.t = 0.3 + W.rng() * 0.3; } else this.phase = null; } }
      if (this.phase === 'back') { this.l = this.r = -0.8; return; }
      if (this.phase === 'turn') { this.l = 0.7 * this.turnDir; this.r = -0.7 * this.turnDir; return; }
      const [eL, eR] = edgeSeen(W, me);
      if (eL || eR) { this.phase = 'back'; this.t = 0.25; this.turnDir = eL ? 1 : -1; this.l = this.r = -0.8; return; }
      if (kind === 'wander') { const wob = Math.sin(W.time / 700) * 0.25; this.l = 0.55 + wob; this.r = 0.55 - wob; return; }
      const dx = opp.x - me.x, dy = opp.y - me.y, dist = Math.hypot(dx, dy), a = wrapAng(Math.atan2(dy, dx) - me.th);
      const sees = kind === 'bulldozer' || (dist < 1.0 && Math.abs(a) < 0.6);
      if (!sees || opp.fallen) { this.l = 0.45; this.r = -0.45; return; }
      const power = kind === 'bulldozer' ? 1 : 0.85;
      this.l = clamp(power - a * 1.5, -1, 1); this.r = clamp(power + a * 1.5, -1, 1);
    },
  };
}
function makeSoccerAI(level) {
  const spd = { easy: 0.5, medium: 0.75, hard: 1 }[level] || 0.6;
  return {
    l: 0, r: 0,
    update(W, me) {
      const b = W.ball, A = W.arena, gx = me.team === 'B' ? A.goalLeftX : A.goalRightX, gy = A.h / 2;
      if (W.state.pause || W.state.over || W.time - (W.state.kickT || 0) < 2000) { this.l = this.r = 0; return; }
      let ux = gx - b.x, uy = gy - b.y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      const rx = b.x - me.x, ry = b.y - me.y, along = rx * ux + ry * uy, lateral = Math.abs(rx * uy - ry * ux);
      let tx, ty;
      if (along > 0 && lateral < 0.05) { tx = b.x + ux * 0.3; ty = b.y + uy * 0.3; }
      else { tx = b.x - ux * 0.17; ty = b.y - uy * 0.17; if (along < 0 && lateral < 0.15) { ty += (me.y > b.y ? 1 : -1) * 0.15; } }
      [this.l, this.r] = steerTo(me, tx, ty, spd, 2.4);
    },
  };
}
function makeRaceAI(level) {
  const spd = { easy: 0.55, medium: 0.75, hard: 0.95 }[level] || 0.7;
  return {
    l: 0, r: 0, i: null,
    update(W, me) {
      const P = W.arena.path; if (W.state.countdown) { this.l = this.r = 0; return; }
      const n = this.i === null ? P.nearestAll(me.x, me.y) : P.nearestWindow(me.x, me.y, this.i, 40); this.i = n.i;
      const t = P.pts[(n.i + 40) % P.pts.length];
      const [l, r, a] = steerTo(me, t.x, t.y, spd * (Math.abs(a0(me, t)) > 0.5 ? 0.7 : 1), 2.2);
      this.l = l; this.r = r;
    },
  };
}
const a0 = (me, t) => wrapAng(Math.atan2(t.y - me.y, t.x - me.x) - me.th);
