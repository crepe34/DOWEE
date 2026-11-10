/* =====================================================================
   Goal types a teacher can pick for a classroom activity.
   check(W, p) runs in the student's simulator; the result is reported
   to the teacher's laptop when it first becomes true.
   ===================================================================== */
const robotA = W => W.robots[0];
const stoppedA = W => { const r = robotA(W); return Math.hypot(r.vx, r.vy) < 0.005 && Math.abs(r.w) < 0.02; };
const lapList = W => (W.arena.id === 'race' ? (W.state.laps && W.state.laps[0]) || [] : W.state.laps || []);
const GOAL_TYPES = {
  none: { label: 'No automatic goal (teacher checks)', arenas: null, params: {}, text: () => 'Show your teacher when you are done', check: () => false },
  laps: { label: 'Complete laps', arenas: ['line', 'race'], params: { n: { label: 'Laps', def: 1, min: 1, max: 20 } }, text: p => `Complete ${p.n} lap${p.n > 1 ? 's' : ''}`, check: (W, p) => lapList(W).length >= p.n },
  lapTime: { label: 'Lap faster than a time', arenas: ['line', 'race'], params: { sec: { label: 'Seconds', def: 15, min: 1, max: 300 } }, text: p => `Finish a lap in under ${p.sec} s`, check: (W, p) => lapList(W).some(l => l.time < p.sec), result: W => { const l = lapList(W); return l.length ? Math.min(...l.map(x => x.time)).toFixed(2) + ' s' : ''; } },
  reachGoal: { label: 'Reach the goal zone', arenas: ['maze'], params: { sec: { label: 'Within seconds (0 = any)', def: 0, min: 0, max: 600 } }, text: p => p.sec ? `Reach the green goal in under ${p.sec} s` : 'Reach the green goal zone', check: (W, p) => W.state.done != null && (!p.sec || W.state.done < p.sec), result: W => (W.state.done != null ? W.state.done.toFixed(1) + ' s' : '') },
  winSumo: { label: 'Win a sumo match', arenas: ['sumo'], params: {}, text: () => 'Push the opponent out of the ring', check: W => W.state.result === 'A' },
  survive: { label: 'Stay in the sumo ring', arenas: ['sumo'], params: { sec: { label: 'Seconds', def: 20, min: 5, max: 180 } }, text: p => `Drive for ${p.sec} s without falling off`, check: (W, p) => W.time > p.sec * 1000 && !robotA(W).fallen && robotA(W).odo > 1 },
  goals: { label: 'Score soccer goals', arenas: ['soccer'], params: { n: { label: 'Goals', def: 2, min: 1, max: 20 } }, text: p => `Score ${p.n} goal${p.n > 1 ? 's' : ''}`, check: (W, p) => W.state.score && W.state.score[0] >= p.n },
  distance: { label: 'Stop at a distance', arenas: ['lab'], params: { cm: { label: 'Distance (cm)', def: 100, min: 10, max: 250 }, tol: { label: '± cm', def: 5, min: 1, max: 50 } }, text: p => `Stop between ${p.cm - p.tol} and ${p.cm + p.tol} cm from the start`, check: (W, p) => { const r = robotA(W), d = Math.hypot(r.x - r.start.x, r.y - r.start.y) * 100; return W.time > 600 && stoppedA(W) && Math.abs(d - p.cm) <= p.tol; }, result: W => { const r = robotA(W); return (Math.hypot(r.x - r.start.x, r.y - r.start.y) * 100).toFixed(1) + ' cm'; } },
  turn: { label: 'Turn an angle', arenas: ['lab'], params: { deg: { label: 'Angle (°)', def: 90, min: 10, max: 720 }, tol: { label: '± degrees', def: 5, min: 1, max: 45 } }, text: p => `Turn ${p.deg}° (±${p.tol}°) and stop`, check: (W, p) => W.time > 300 && stoppedA(W) && Math.abs(Math.abs(robotA(W).headingAcc * 180 / Math.PI) - p.deg) <= p.tol, result: W => Math.abs(robotA(W).headingAcc * 180 / Math.PI).toFixed(1) + '°' },
  blinks: { label: 'Blink the LED', arenas: null, params: { n: { label: 'Times', def: 10, min: 1, max: 100 } }, text: p => `Blink the LED ${p.n} times`, check: (W, p) => robotA(W).board.ledToggles >= p.n * 2 },
  prints: { label: 'Print to the Serial monitor', arenas: null, params: { n: { label: 'Lines', def: 20, min: 1, max: 500 } }, text: p => `Print ${p.n} lines to the Serial monitor`, check: (W, p) => robotA(W).board.serialLines >= p.n },
  drive: { label: 'Drive a total distance', arenas: null, params: { cm: { label: 'Distance (cm)', def: 300, min: 10, max: 10000 } }, text: p => `Drive ${p.cm} cm in total`, check: (W, p) => robotA(W).odo * 100 >= p.cm },
};
function goalDefaults(type) { const g = { type }; for (const [k, v] of Object.entries((GOAL_TYPES[type] || GOAL_TYPES.none).params)) g[k] = v.def; return g; }
if (typeof module !== 'undefined') module.exports.GOAL_TYPES = GOAL_TYPES;
