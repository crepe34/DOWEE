const M = require('../dist/core-all.js');
const base = M.EXAMPLES.line.pid.code;
const lv = process.argv[2] || 'real';
const sets = JSON.parse(process.argv[3]);
for (const [kp, kd, sp] of sets) {
  const code = base.replace('float Kp = 0.08;', `float Kp = ${kp};`).replace('float Kd = 1.5;', `float Kd = ${kd};`).replace('int baseSpeed = 150;', `int baseSpeed = ${sp};`);
  let out = [];
  for (const tr of ['oval', 'snake', 'figure8']) for (const u of [1, 2, 3, 4]) {
    const W = M.buildWorld('line', tr, { realism: lv, unitA: u, runSeed: u * 3 }, M.makeCfg('dowee'), M.makeCfg('dowee'), 'none');
    const r = W.robots[0]; r.board.load(M.compileArduino(code, r.board), 0);
    for (let i = 0; i < 60000; i++) W.step();
    const L = W.state.laps; out.push(L.length > 1 ? `${tr[0]}${u}:${L[1].time.toFixed(1)}/${Math.round(L[1].rms)}` : `${tr[0]}${u}:X`);
  }
  console.log(kp, kd, sp, '|', out.join(' '));
}
