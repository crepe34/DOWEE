const M = require('../dist/core-all.js');
const { EXAMPLES } = M;
function sim(arena, variant, code, ms, opts={}) {
  const cfgA = M.makeCfg(M.ARENAS[arena].preset, opts.cfg);
  const W = M.buildWorld(arena, variant, Object.assign({ realism: process.env.LV || 'real', unitA: +(process.env.UNIT||1), runSeed: +(process.env.RUN||7) }, opts.arenaOpts||{}), cfgA, M.makeCfg(M.ARENAS[arena].preset), opts.opp||'none');
  const r = W.robots[0]; const out=[]; const hints=[];
  r.board.onSerial = s => out.push(s); r.board.onHint = m => hints.push(m);
  r.board.onError = e => console.log('RTERR', e.message, e.line);
  const comp = M.compileArduino(code, r.board);
  if (comp.warnings.length) console.log('warn', comp.warnings);
  r.board.load(comp, 0);
  if (opts.codeB && W.robots[1]) { const b=W.robots[1]; const cb=M.compileArduino(opts.codeB,b.board); b.board.load(cb,0); }
  const t0=Date.now();
  for (let i=0;i<ms;i++) { W.step(); if (opts.onStep) opts.onStep(W,i); }
  return {W, r, out: out.join(''), hints, real: Date.now()-t0};
}
const arg = process.argv[2];
if (arg==='line') {
  for (const v of ['oval','snake','figure8','sharp']) {
    const res = sim('line', v, EXAMPLES.line.pid.code, 40000);
    console.log(v, 'laps', res.W.state.laps.map(l=>l.time.toFixed(2)+'s/'+l.rms.toFixed(0)+'mm').join(' '), 'lost', res.W.state.lap.lost, 'real', res.real, 'ms loops', res.r.board.loops, res.hints);
  }
  const res = sim('line','oval',EXAMPLES.line.bang.code, 30000);
  console.log('bang oval laps', res.W.state.laps.map(l=>l.time.toFixed(2)).join(' '), res.hints);
}
if (arg==='sumo') {
  for (const opp of ['statue','wander','hunter','bulldozer']) {
    const res = sim('sumo','x',EXAMPLES.sumo.basic.code, 60000, {opp});
    console.log(opp, JSON.stringify(res.W.events.map(e=>e.text||e.type)), res.real, res.hints);
  }
  const res = sim('sumo','x',EXAMPLES.sumo.basic.code, 60000, {opp:'code', codeB: EXAMPLES.sumo.basic.code});
  console.log('mirror', JSON.stringify(res.W.events.map(e=>e.text||e.type)));
}
if (arg==='maze') { for (const v of ['room1','room2']) { const res = sim('maze',v,EXAMPLES.maze.avoid.code, 90000); console.log(v, res.W.events, res.W.bumps, res.real); } }
if (arg==='lab') { for (const k of ['meter','turn','blink']) { const res = sim('lab','lab',EXAMPLES.lab[k].code, 4000); const r=res.r; console.log(k, 'dist', Math.hypot(r.x-r.start.x,r.y-r.start.y).toFixed(3), 'turn', (r.headingAcc*180/Math.PI).toFixed(1), 'led', r.board.ledToggles, res.out); } }
if (arg==='race') {
  const res = sim('race','hard',EXAMPLES.race.rc.code, 60000, {opp:'hard'});
  console.log(res.W.events);
  const res2 = sim('race','none',EXAMPLES.race.rc.code, 4000, {onStep:(W,i)=>{ if(i===3500) W.robots[0].board.send('F'); }});
  const r=res2.r; console.log('rc drive', r.x.toFixed(2), r.y.toFixed(2));
}
if (arg==='soccer') { const res = sim('soccer','hard',EXAMPLES.soccer.rc.code, 60000, {opp:'hard'}); console.log(res.W.events, res.W.state.score); }
if (arg==='sumodbg') {
  sim('sumo','x',EXAMPLES.sumo.basic.code, 12000, {opp:'statue', onStep:(W,i)=>{ if (i%500===0){ const [a,b]=W.robots; console.log(i, 'A', a.x.toFixed(3),a.y.toFixed(3),(a.th*57.3).toFixed(0),'duty',a.dutyL.toFixed(2),a.dutyR.toFixed(2),'B',b.x.toFixed(3),b.y.toFixed(3), 'sonar', a.lastSonar&&a.lastSonar.toFixed(2), 'ir', a.irAnalog(0), a.irAnalog(1)); } }});
}
if (arg==='socdbg') { sim('soccer','hard',EXAMPLES.soccer.rc.code, 15000, {opp:'hard', onStep:(W,i)=>{ if(i%1000===0){ const b=W.robots[1]; console.log(i,'B',b.x.toFixed(2),b.y.toFixed(2),(b.th*57.3).toFixed(0),'ai',b.ai.l.toFixed(2),b.ai.r.toFixed(2),'ball',W.ball.x.toFixed(2),W.ball.y.toFixed(2)); } }}); }
if (arg==='soc2') { for (const lv of ['easy','medium','hard']) { const res=sim('soccer',lv,EXAMPLES.soccer.rc.code, 90000, {opp:lv, onStep:(W,i)=>{ if(i===0){ const a=W.robots[0]; a.x=1.3; a.y=1.6; } if (W.state.pause===1){ setTimeout; } }}); console.log(lv, res.W.state.score, res.real); } }
if (arg==='wro') { for (const b of [1,2,3,4]) { const code = EXAMPLES.wro.mission.code.replace('int targetBranch = 3;', `int targetBranch = ${b};`); const res = sim('wro','b'+b, code, 60000); const r=res.r; console.log(b, res.W.events.map(e=>e.text), res.out.replace(/\n/g,' | '), r.x.toFixed(2), r.y.toFixed(2)); } }
if (arg==='wrodbg') { const code = EXAMPLES.wro.mission.code.replace('int targetBranch = 3;', `int targetBranch = 2;`); sim('wro','b2', code, 12000, {onStep:(W,i)=>{ const r=W.robots[0]; if(i%100===0 && i>3000) console.log(i, r.x.toFixed(3), r.y.toFixed(3), (r.th*57.3).toFixed(0), r.dutyL.toFixed(2), r.dutyR.toFixed(2), [0,1,2,3,4].map(k=>r.irAnalog(k)).join(','), r.board.line); }}); }
if (arg==='wrofast') { for (const sp of [145,150,155]) { const code = EXAMPLES.wro.mission.code.replace('int baseSpeed = 140;', `int baseSpeed = ${sp};`); const res = sim('wro','b3', code, 30000); console.log(sp, res.W.events.map(e=>e.text)); } }
if (arg==='straight') { const code = EXAMPLES.lab.meter.code; const res = sim('lab','lab',code, 4000); const r=res.r; console.log('drive straight: dist', Math.hypot(r.x-r.start.x,r.y-r.start.y).toFixed(3), 'sideways drift cm', ((r.y-r.start.y)*100).toFixed(1), 'heading deg', (r.headingAcc*57.3).toFixed(1)); }
if (arg==='iso') {
  const code = EXAMPLES.lab.meter.code;
  for (const what of ['all','nogain','nodb','noyaw','nocaster']) {
    const cfgA = M.makeCfg('dowee'); const W = M.buildWorld('lab','lab',{realism:'real', unitA: 4}, cfgA, M.makeCfg('dowee'), 'none');
    const r = W.robots[0]; if (what==='nogain') { r.q.gainL=r.q.gainR=1; } if (what==='nodb') { r.q.dbL=r.q.dbR=0; } if (what==='noyaw') r.q.yawNoise=0; if (what==='nocaster') r.q.casterMu=0;
    r.board.load(M.compileArduino(code, r.board), 0); for (let i=0;i<4000;i++) W.step();
    console.log(what, 'heading', (r.headingAcc*57.3).toFixed(1));
  }
}
