/* ---------------- classroom mode (served by the DOWEE teacher app) ----------------
   When this page is opened from the teacher's laptop, students join the class, get the
   teacher's activities, and their progress, best times and programs go to the teacher. */
const HOST = { on: false, role: 'guest', me: null, info: null, state: null, token: null, es: null, notices: [], lastStatus: '', reported: new Set() };
const hostKey = () => 'host-token:' + (HOST.info ? HOST.info.classId : '');
async function hostApi(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-Dowee-Token': HOST.token || '' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  let data = {}; try { data = await r.json(); } catch (e) { /* not json */ }
  if (!r.ok) { const e = new Error(data.error || 'The teacher laptop did not answer.'); e.status = r.status; throw e; }
  return data;
}
async function initHost() {
  if (!/^https?:$/.test(location.protocol)) return false;
  try {
    const r = await fetch('/api/info', { cache: 'no-store' });
    if (!r.ok) return false;
    const info = await r.json();
    if (!info || info.app !== 'dowee') return false;
    HOST.info = info;
  } catch (e) { return false; }
  HOST.on = true;
  HOST.token = store.get(hostKey(), null);
  try { const w = await hostApi('GET', '/api/whoami'); HOST.role = w.role; HOST.me = w.student || null; } catch (e) { HOST.role = 'guest'; }
  if (HOST.role === 'guest' && HOST.token) { HOST.token = null; store.set(hostKey(), null); }
  $('#hostChip').hidden = false;
  renderHostChip();
  applyLock();
  if (HOST.role !== 'teacher') showMeet();   // students always start by meeting the robot
  if (HOST.role === 'guest') showJoin(); else connectHost();
  setInterval(() => sendStatus(true), 15000);
  return true;
}
function connectHost() {
  if (HOST.es) HOST.es.close();
  const q = HOST.role === 'teacher' ? 'as=teacher-view' : 'token=' + encodeURIComponent(HOST.token || '');
  const es = new EventSource('/api/events?' + q);
  HOST.es = es;
  es.addEventListener('state', e => { HOST.state = JSON.parse(e.data); onHostState(); });
  es.addEventListener('handout', e => onHandout(JSON.parse(e.data)));
  es.addEventListener('message', e => { const m = JSON.parse(e.data); banner('Message from your teacher', m.text, 6000); hostNotice({ kind: 'message', text: m.text }); });
  es.addEventListener('removed', () => { es.close(); store.set(hostKey(), null); HOST.token = null; HOST.role = 'guest'; HOST.me = null; renderHostChip(); showJoin('Your teacher removed you from the class. You can join again.'); });
  es.addEventListener('switched', () => { es.close(); setTimeout(() => location.reload(), 300); });
  es.onerror = () => { $('#hostChip').classList.add('offline'); };
  es.onopen = () => { $('#hostChip').classList.remove('offline'); sendStatus(true); };
  handleHostParams();
}

/* join screen */
function showJoin(note) {
  const m = $('#joinModal');
  $('#joinClass').textContent = HOST.info.className;
  $('#joinType').textContent = HOST.info.robotLabel && HOST.info.robot !== 'all' ? HOST.info.robotLabel + ' class' : '';
  $('#joinPinRow').hidden = !HOST.info.pinRequired;
  $('#joinNote').textContent = note || '';
  $('#joinErr').textContent = '';
  m.hidden = false;
  setTimeout(() => $('#joinName').focus(), 50);
}
$('#joinForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#joinGo'); btn.disabled = true; $('#joinErr').textContent = '';
  try {
    const r = await hostApi('POST', '/api/join', { name: $('#joinName').value, team: $('#joinTeam').value, pin: $('#joinPin').value });
    HOST.token = r.token; HOST.me = r.student; HOST.role = 'student'; store.set(hostKey(), r.token);
    $('#joinModal').hidden = true; renderHostChip(); connectHost();
    toast(`Welcome, ${r.student.name}!`);
    showMeet();
  } catch (err) { $('#joinErr').textContent = err.message; }
  btn.disabled = false;
});
$('#joinSolo').addEventListener('click', () => { $('#joinModal').hidden = true; HOST.role = 'guest'; renderHostChip(); });

/* header chip */
function renderHostChip() {
  const chip = $('#hostChip'); if (!chip) return;
  const src = HOST.state || HOST.info, typeLbl = src.robot && src.robot !== 'all' ? ' · ' + src.robotLabel : '';
  const name = (HOST.state ? HOST.state.name : HOST.info.className) + typeLbl;
  if (HOST.role === 'teacher') chip.innerHTML = `<b>${esc(name)}</b><span>Teacher view</span><a class="btn small" href="/teacher" target="_blank" rel="noopener">Dashboard</a>`;
  else if (HOST.role === 'student' && HOST.me) {
    const up = HOST.state && HOST.state.me && HOST.state.me.hand;
    chip.innerHTML = `<b>${esc(name)}</b><span>${esc(HOST.me.name)}${HOST.me.team ? ' · ' + esc(HOST.me.team) : ''}</span><button class="btn small hand ${up ? 'up' : ''}" id="handBtn" aria-pressed="${!!up}" title="Ask your teacher for help">${up ? 'Hand raised' : 'Raise hand'}</button>`;
    $('#handBtn').addEventListener('click', async () => { const upNow = !(HOST.state && HOST.state.me && HOST.state.me.hand); try { await hostApi('POST', '/api/hand', { up: upNow }); if (HOST.state && HOST.state.me) HOST.state.me.hand = upNow ? { at: Date.now() } : null; renderHostChip(); toast(upNow ? 'Your teacher can see your raised hand' : 'Hand lowered'); } catch (e) { toast(e.message); } });
  } else chip.innerHTML = `<b>${esc(name)}</b><span>Not joined</span><button class="btn small" id="joinAgain">Join class</button>`;
  const ja = $('#joinAgain'); if (ja) ja.addEventListener('click', () => showJoin());
}

/* state from the teacher */
function onHostState() {
  const st = HOST.state;
  if (st.me) HOST.me = { ...HOST.me, ...st.me };
  renderHostChip();
  applyLock();
  buildLessons();
  renderClass();
  if (st.announcement && st.announcement !== S.lastAnnouncement) { S.lastAnnouncement = st.announcement; banner('From your teacher', st.announcement, 5000); }
}
function hostActivities() { return HOST.on && HOST.state ? HOST.state.activities : []; }
function activityToLesson(a) {
  const base = a.builtin ? LESSONS.find(l => l.id === a.builtin) : null;
  const g = a.goal || { type: 'none' }, gt = GOAL_TYPES[g.type] || GOAL_TYPES.none;
  const useBuiltinGoal = base && (g.type === 'builtin' || !GOAL_TYPES[g.type]);
  return {
    id: 'act:' + a.id, actId: a.id, title: a.title || (base && base.title) || 'Activity', level: 'From your teacher',
    arena: a.arena || (base && base.arena) || 'lab', variant: a.variant || (base && base.variant), realism: a.realism || '',
    intro: a.intro ? esc(a.intro) : base ? base.intro : '',
    steps: a.steps && a.steps.length ? a.steps.map(esc) : base ? base.steps : [],
    goal: useBuiltinGoal ? base.goal : gt.text(g),
    check: useBuiltinGoal ? base.check : (W => gt.check(W, g)),
    result: !useBuiltinGoal && gt.result ? (W => gt.result(W)) : null,
    starter: a.starter || { kind: 'none' }, base,
  };
}
function findLesson(id) {
  if (id && id.startsWith('act:')) { const a = hostActivities().find(x => 'act:' + x.id === id); return a ? activityToLesson(a) : null; }
  return LESSONS.find(l => l.id === id);
}
function activityDone(L) { const pr = HOST.state && HOST.state.me && HOST.state.me.progress[L.actId]; return !!(pr && pr.done); }
function hostLessonDone(L) {
  if (!HOST.on || HOST.role !== 'student' || !L.actId || HOST.reported.has(L.actId)) return;
  HOST.reported.add(L.actId);
  let result = ''; try { result = L.result ? L.result(S.W) : ''; } catch (e) { result = ''; }
  hostApi('POST', '/api/progress', { activity: L.actId, done: true, result }).catch(() => HOST.reported.delete(L.actId));
}
function hostAttempt() {
  const L = S.lesson && S.lesson.startsWith('act:') ? findLesson(S.lesson) : null;
  if (HOST.on && HOST.role === 'student' && L && L.actId) hostApi('POST', '/api/progress', { activity: L.actId, attempt: true }).catch(() => {});
}
function hostStars(arena, n) { if (HOST.on && HOST.role === 'student') hostApi('POST', '/api/stars', { arena, n }).catch(() => {}); }
function hostPrimm(lesson, done, total, next, predictRight) { if (HOST.on && HOST.role === 'student') hostApi('POST', '/api/primm', { lesson, done, total, next, predictRight }).catch(() => {}); }
function hostHint(key) { if (HOST.on && HOST.role === 'student') hostApi('POST', '/api/hint', { key }).catch(() => {}); }
function hostBest(arena, key, value) { if (HOST.on && HOST.role === 'student') hostApi('POST', '/api/best', { arena, key, value }).catch(() => {}); }

/* lock: the teacher keeps everyone on one activity */
function applyLock() {
  const st = HOST.state, student = HOST.role !== 'teacher';
  const a = st && st.lock && HOST.role === 'student' ? st.activities.find(x => x.id === st.lock) : null;
  const classArenas = student ? ((st && st.arenas) || (HOST.info && HOST.info.arenas) || null) : null;
  S.lockedArena = a ? a.arena : null;
  S.allowedArenas = a ? [a.arena] : classArenas;
  buildArenaTabs(); fillExamples();
  // a new template level (or joining) shows the right template, unless the student already wrote code here
  const lk = samplesLocked() + ':' + templateLevel();
  if (S.tplKey !== lk) { S.tplKey = lk; if (store.get(codeKey(S.arena, S.robot), null) == null && modeOf(S.arena, S.robot) === 'code') loadEditor(); }
  if (S.allowedArenas && !S.allowedArenas.includes(S.arena) && !a) { setArena(S.allowedArenas.find(x => x !== 'lab') || S.allowedArenas[0]); if (S.view === 'meet') buildRobotPanel(); }
  if (S.view === 'meet' && st && S.lastType !== st.robot) { S.lastType = st.robot; buildRobotPanel(); }
  $('#variantSel').disabled = !!a; $('#realSel').disabled = !!a && !!a.realism;
  if (a && (S.arena !== a.arena || S.lesson !== 'act:' + a.id) && !S.lockApplied) { S.lockApplied = a.id; startLesson(activityToLesson(a)); toast(`Your teacher started: ${a.title}`); }
  if (!a) S.lockApplied = null;
}

/* handouts and messages */
function onHandout(h) {
  banner('Your teacher sent you a program', h.note || (ARENAS[h.arena] ? ARENAS[h.arena].name : ''), 4000);
  hostNotice({ kind: 'handout', h });
}
function hostNotice(n) { HOST.notices.unshift({ ...n, at: Date.now() }); HOST.notices = HOST.notices.slice(0, 6); renderHostNotices(); }
function renderHostNotices() {
  const box = $('#hostNotice'); if (!box) return;
  box.innerHTML = HOST.notices.slice(0, 2).map((n, i) => n.kind === 'handout'
    ? `<div class="msg ok"><span class="tag">Teacher</span><span>Sent you a ${n.h.kind === 'blocks' ? 'blocks' : 'code'} program for <b>${esc(ARENAS[n.h.arena] ? ARENAS[n.h.arena].name : n.h.arena)}</b>${n.h.note ? ': ' + esc(n.h.note) : ''} <button class="btn small" data-ho="${i}">Load it</button> <button class="btn small" data-x="${i}">Dismiss</button></span></div>`
    : `<div class="msg tip"><span class="tag">Teacher</span><span>${esc(n.text)} <button class="btn small" data-x="${i}">OK</button></span></div>`).join('');
  $$('#hostNotice [data-x]').forEach(b => b.addEventListener('click', () => { HOST.notices.splice(+b.dataset.x, 1); renderHostNotices(); }));
  $$('#hostNotice [data-ho]').forEach(b => b.addEventListener('click', () => { const n = HOST.notices[+b.dataset.ho]; loadHandout(n.h); HOST.notices.splice(+b.dataset.ho, 1); renderHostNotices(); }));
}
function loadHandout(h) {
  if (!allowed(h.arena)) { toast('That program is for a playground this class doesn\'t use'); return; }
  if (S.arena !== h.arena) setArena(h.arena);
  showWork();
  if (h.kind === 'blocks' && h.xml) { store.set(`blocks:${h.arena}:A`, h.xml); store.set(`mode:${h.arena}:A`, 'blocks'); }
  else putCode(h.arena, 'A', h.code);
  S.robot = 'A'; updateRobotTabs(); loadEditor();
  toast('Program loaded. Press Upload & run.');
}

/* hand in a program */
async function handIn() {
  if (modeOf(S.arena, S.robot) === 'code') setCode(S.arena, S.robot, ta.value);
  const L = S.lesson && S.lesson.startsWith('act:') ? findLesson(S.lesson) : null;
  try {
    await hostApi('POST', '/api/submit', { arena: S.arena, code: getCode(S.arena, 'A'), mode: modeOf(S.arena, 'A'), activity: L && L.arena === S.arena ? L.actId : '' });
    for (const [k, v] of Object.entries(S.best[S.arena] || {})) hostBest(S.arena, k, v);
    toast('Handed in to your teacher');
  } catch (e) { toast(e.message); }
}

/* status heartbeat */
function sendStatus(force) {
  if (!HOST.on || HOST.role !== 'student') return;
  const W = S.W, crashed = !!(W && W.robots.some(r => r.board.state === 'error'));
  const st = { arena: S.arena, activity: S.lesson && S.lesson.startsWith('act:') ? S.lesson.slice(4) : '', running: !!S.running, mode: modeOf(S.arena, 'A'), crashed, realism: S.realism };
  const key = JSON.stringify(st);
  if (!force && key === HOST.lastStatus) return;
  HOST.lastStatus = key;
  hostApi('POST', '/api/status', st).catch(() => {});
}

/* teacher-only links: ?view=<student>&arena=..  and  ?battle=<a>,<b>&arena=.. */
let hostParamsDone = false;
async function handleHostParams() {
  if (hostParamsDone) return; hostParamsDone = true;
  const q = new URLSearchParams(location.search), arena = q.get('arena');
  if (!arena || !ARENAS[arena]) return;
  const getCodeOf = id => hostApi('GET', `/api/code?student=${encodeURIComponent(id)}&arena=${encodeURIComponent(arena)}`);
  try {
    if (q.get('view')) {
      const c = await getCodeOf(q.get('view'));
      setArena(arena); showWork(); putCode(arena, 'A', c.code); S.robot = 'A'; updateRobotTabs(); loadEditor();
      banner(`${c.name}'s program`, `${ARENAS[arena].name} · handed in ${new Date(c.at).toLocaleTimeString()}`, 3500);
    } else if (q.get('battle') && HOST.role === 'teacher') {
      const [a, b] = q.get('battle').split(','), [ca, cb] = await Promise.all([getCodeOf(a), getCodeOf(b)]);
      putCode(arena, 'A', ca.code); putCode(arena, 'B', cb.code);
      S.variant[arena] = 'code'; store.set('variant', S.variant);
      setArena(arena); showWork();
      S.classMatch = { arena, aId: a, bId: b, a: ca.name, b: cb.name, host: true };
      run();
      banner(`${ca.name} vs ${cb.name}`, 'Class battle', 3000);
    }
  } catch (e) { toast(e.message); }
}
async function hostSaveMatch(m, e) {
  try { await hostApi('POST', '/api/teacher/match', { arena: m.arena, aId: m.aId, bId: m.bId, winner: e.winner || null, text: e.text }); toast('Result saved to the class'); } catch (err) { toast(err.message); }
}

/* Class tab in classroom mode */
function renderHostClass() {
  const box = $('#classBox'); if (!box) return;
  const st = HOST.state, a = S.arena, aName = ARENAS[a].name;
  if (HOST.role === 'teacher') { box.innerHTML = `<h3 class="sec">${esc(st ? st.name : HOST.info.className)}</h3><p class="empty">You are the teacher. Manage the class, see everyone's progress and start battles from the <a href="/teacher" target="_blank" rel="noopener">teacher dashboard</a>. This simulator window is good for showing programs on the projector.</p>`; return; }
  if (HOST.role !== 'student' || !st) { box.innerHTML = `<h3 class="sec">${esc(HOST.info.className)}</h3><p class="empty">Join the class to hand in programs and see the leaderboard.</p><button class="btn primary" id="joinAgain2">Join class</button>`; const j = $('#joinAgain2'); if (j) j.addEventListener('click', () => showJoin()); return; }
  const me = st.me || {}, acts = st.activities.map(activityToLesson);
  const done = acts.filter(L => me.progress && me.progress[L.actId] && me.progress[L.actId].done).length;
  const lb = (st.leaderboard || {})[a] || {};
  const lbKey = a === 'sumo' || a === 'soccer' ? 'wins' : a === 'race' ? 'lap' : S.variant[a];
  const rows = lb[lbKey] || [];
  const unit = lbKey === 'wins' ? '' : ' s';
  const myRow = rows.findIndex(r => r.id === me.id);
  const others = st.roster.filter(r => r.id !== me.id && r.subs.includes(a));
  box.innerHTML = `${st.announcement ? `<div class="challenge"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><polygon points="11,1 21,8 17,21 5,21 1,8" fill="#e9467e"/><polygon points="11,1 21,8 11,11" fill="#f39a3b"/><polygon points="1,8 11,11 5,21" fill="#8c5bc4"/></svg><div><b>From your teacher</b><div>${esc(st.announcement)}</div></div></div>` : ''}
    <div class="class-grid" style="margin-top:10px">
      <div class="card"><h4><span>Me</span><span>${done}/${acts.length} activities done</span></h4>
        <p style="margin:0 0 8px"><b style="font-family:var(--font-display);font-size:18px">${esc(me.name || '')}</b>${me.team ? ` <span class="note">${esc(me.team)}</span>` : ''}</p>
        <button class="btn primary" id="handInBtn">Hand in my ${esc(aName)} program</button>
        <p class="note">${me.subs && me.subs[a] ? 'Last handed in ' + new Date(me.subs[a].at).toLocaleTimeString() + '.' : 'Your teacher will see your code and best times.'}</p>
        <div class="row"><button class="btn small" id="editMe">Change my name</button><button class="btn small" id="leaveClass">Leave class</button></div>
      </div>
      <div class="card"><h4><span>Leaderboard</span><span>${esc(aName)}</span></h4>
        ${rows.length ? rows.map((r, i) => `<div class="board-row"><span class="rank">${i + 1}</span><span>${esc(r.name)}${r.team ? ' <span class="note">' + esc(r.team) + '</span>' : ''}${r.id === me.id ? ' <span class="chip p">you</span>' : ''}</span><span class="t">${lbKey === 'wins' ? r.value + ' win' + (r.value > 1 ? 's' : '') : r.value.toFixed(2) + unit}</span></div>`).join('') : `<p class="note">${a === 'lab' ? 'The test lab has no leaderboard.' : 'No times yet. Finish a run and they appear here automatically.'}</p>`}
        ${myRow < 0 && S.best[a] && S.best[a][lbKey] ? `<p class="note">Your best: ${S.best[a][lbKey].toFixed(2)} s</p>` : ''}
      </div>
      <div class="card"><h4><span>Classmates' programs</span><span>${esc(aName)}</span></h4>
        ${others.length ? others.map(r => `<div class="board-row" style="grid-template-columns:1fr auto"><span>${r.online ? '<span class="dot-on"></span>' : '<span class="dot-off"></span>'}${esc(r.name)}${r.team ? ' <span class="note">' + esc(r.team) + '</span>' : ''}</span>${st.settings.showCode ? `<span class="row"><button class="btn small" data-see="${esc(r.id)}" data-r="A">Open in A</button>${a === 'sumo' || a === 'soccer' ? `<button class="btn small" data-see="${esc(r.id)}" data-r="B">Practise against</button>` : ''}</span>` : ''}</div>`).join('') : '<p class="note">Nobody has handed in a program for this arena yet.</p>'}
        ${!st.settings.showCode ? '<p class="note">Your teacher keeps classmates\' code private.</p>' : ''}
      </div>
      <div class="card"><h4><span>Class battles</span><span>results</span></h4>
        ${st.matches.length ? st.matches.slice(0, 8).map(m => `<div class="board-row" style="grid-template-columns:1fr"><span><b>${esc(m.a)}</b> vs <b>${esc(m.b)}</b> · ${esc(ARENAS[m.arena] ? ARENAS[m.arena].name : m.arena)}<br><span class="note">${esc(m.text)}</span></span></div>`).join('') : '<p class="note">Your teacher runs battles between handed-in Sumo and Soccer programs.</p>'}
      </div>
    </div>`;
  $('#handInBtn').addEventListener('click', handIn);
  $('#leaveClass').addEventListener('click', async e => {
    if (e.target.dataset.confirm !== '1') { e.target.dataset.confirm = '1'; e.target.textContent = 'Click again to leave'; return; }
    try { await hostApi('POST', '/api/leave'); } catch (err) { /* already gone */ }
    store.set(hostKey(), null); location.reload();
  });
  $('#editMe').addEventListener('click', async () => {
    const card = $('#editMe').closest('.card');
    card.insertAdjacentHTML('beforeend', `<form id="meForm" style="margin-top:8px"><label class="fld">Name<input id="meName" maxlength="40" value="${esc(me.name || '')}"></label><label class="fld">Team<input id="meTeam" maxlength="40" value="${esc(me.team || '')}"></label><button class="btn small" type="submit">Save</button></form>`);
    $('#editMe').remove();
    $('#meForm').addEventListener('submit', async ev => { ev.preventDefault(); try { await hostApi('POST', '/api/profile', { name: $('#meName').value, team: $('#meTeam').value }); HOST.me.name = $('#meName').value; HOST.me.team = $('#meTeam').value; renderHostChip(); toast('Saved'); } catch (err) { toast(err.message); } });
  });
  $$('#classBox [data-see]').forEach(b => b.addEventListener('click', async () => {
    try {
      const c = await hostApi('GET', `/api/code?student=${encodeURIComponent(b.dataset.see)}&arena=${encodeURIComponent(a)}`);
      backupMine();
      putCode(a, b.dataset.r, c.code);
      if (b.dataset.r === 'B') { S.variant[a] = 'code'; store.set('variant', S.variant); $('#variantSel').value = 'code'; resetWorld(); }
      S.robot = b.dataset.r; updateRobotTabs(); loadEditor(); renderClass(true);
      toast(`Opened ${c.name}'s program in Dowee ${b.dataset.r}`);
    } catch (err) { toast(err.message); }
  }));
}
