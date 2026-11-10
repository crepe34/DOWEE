/* DOWEE teacher dashboard */
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const T = { st: null, meta: null, lan: 0, planDraft: null, editing: null, tab: 'live' };
const ago = t => { if (!t) return ''; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2400); }
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  let d = {}; try { d = await r.json(); } catch (e) { /* none */ }
  if (!r.ok) throw new Error(d.error || 'The DOWEE server did not answer.');
  return d;
}
const C = () => T.st.active;
const arenaName = a => (T.meta && T.meta.arenas[a] ? T.meta.arenas[a].name : a);

/* ---------- live connection ---------- */
function connect() {
  const es = new EventSource('/api/events?as=teacher');
  es.addEventListener('teacher', e => { T.st = JSON.parse(e.data); render(); });
  es.onopen = () => { $('#conn').classList.remove('bad'); $('#conn span').textContent = 'Classroom is live'; };
  es.onerror = () => { $('#conn').classList.add('bad'); $('#conn span').textContent = 'Reconnecting… is DOWEE still running?'; };
}

/* ---------- join card & QR ---------- */
function joinUrl() { const lan = T.st.lan; return lan.length ? lan[Math.min(T.lan, lan.length - 1)].url : `http://localhost:${T.st.port}/`; }
function qrSvg(text) {
  try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) { return '<p class="note">QR code unavailable</p>'; }
}
function renderJoin() {
  const c = C(), url = joinUrl(), lan = T.st.lan;
  $('#className').textContent = c.name;
  if ($('#qr').dataset.url !== url) { $('#qr').innerHTML = qrSvg(url); $('#qr').dataset.url = url; }
  $('#joinUrl').textContent = url;
  $('#lanSel').hidden = lan.length < 2;
  $('#lanSel').innerHTML = lan.map((l, i) => `<option value="${i}" ${i === T.lan ? 'selected' : ''}>${esc(l.name)} · ${esc(l.url)}</option>`).join('');
  $('#lanNote').textContent = lan.length ? 'Students\' devices must be on the same Wi-Fi as this laptop.' : 'This laptop is not on a network yet. Connect it to the class Wi-Fi (or turn on a hotspot) and the link appears here.';
  $('#onlineCount').textContent = c.students.filter(s => s.online).length;
  $('#totalCount').textContent = c.students.length;
  $('#pinStat').hidden = !c.pin; $('#pinShow').textContent = c.pin;
  $('#classSel').innerHTML = T.st.classes.map(k => `<option value="${esc(k.id)}" ${k.id === c.id ? 'selected' : ''}>${esc(k.name)} (${k.students})</option>`).join('');
  if (!$('#joinScreen').hidden) renderJoinScreen();
}
$('#lanSel').addEventListener('change', e => { T.lan = +e.target.value; renderJoin(); });
function renderJoinScreen() {
  const c = C(), url = joinUrl();
  if ($('#qrBig').dataset.url !== url) { $('#qrBig').innerHTML = qrSvg(url); $('#qrBig').dataset.url = url; }
  $('#jsName').textContent = c.name; $('#jsUrl').textContent = url;
  $('#jsPin').textContent = c.pin ? `Class PIN: ${c.pin}` : '';
  $('#jsNames').innerHTML = c.students.filter(s => s.online).map(s => `<span>${esc(s.name)}</span>`).join('');
}
$('#joinScreenBtn').addEventListener('click', () => { $('#joinScreen').hidden = false; renderJoinScreen(); try { document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* optional */ } });
$('#jsClose').addEventListener('click', () => { $('#joinScreen').hidden = true; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#joinScreen').hidden = true; closeModal(); } });

/* ---------- tabs ---------- */
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; T.tab = b.dataset.t; $$('#tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); $$('section > .card').forEach(p => (p.hidden = p.id !== 't-' + T.tab)); render(); });

/* ---------- live class ---------- */
function statusOf(s) {
  const st = s.status || {}, acts = C().activities, a = acts.find(x => x.id === st.activity);
  const doing = a ? a.title : st.arena ? arenaName(st.arena) : '—';
  const chips = [];
  if (!s.online) chips.push('<span class="chip">offline</span>');
  else if (st.crashed) chips.push('<span class="chip err">program crashed</span>');
  else if (st.running) chips.push('<span class="chip run">running</span>');
  else chips.push('<span class="chip">editing</span>');
  if (st.mode === 'blocks') chips.push('<span class="chip blk">blocks</span>');
  return { doing, chips: chips.join(' ') };
}
function progressBar(s) {
  return `<span class="prog" title="${C().activities.map(a => a.title + ': ' + (s.progress[a.id] && s.progress[a.id].done ? 'done' : s.progress[a.id] ? 'tried' : 'not started')).join('\n')}">${C().activities.map(a => `<i class="${s.progress[a.id] && s.progress[a.id].done ? 'd' : s.progress[a.id] ? 't' : ''}"></i>`).join('')}</span>`;
}
function renderLive() {
  const c = C(), stu = [...c.students].sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
  if (document.activeElement !== $('#annText')) $('#annText').value = c.announcement || '';
  const hands = stu.filter(s => s.hand).sort((a, b) => a.hand.at - b.hand.at);
  $('#hands').hidden = !hands.length;
  $('#hands').innerHTML = `<span>Raised hands:</span>` + hands.map(s => `<span>${esc(s.name)} <span class="note">${ago(s.hand.at)}</span> <button class="btn small" data-lower="${esc(s.id)}">Done helping</button></span>`).join('');
  $('#handCount').hidden = !hands.length; $('#handCount').textContent = hands.length;
  $('#rosterEmpty').hidden = stu.length > 0;
  $('#roster tbody').innerHTML = stu.map(s => {
    const { doing, chips } = statusOf(s), subs = Object.entries(s.subs);
    return `<tr><td><span class="dot ${s.online ? 'on' : ''}"></span><b>${esc(s.name)}</b>${s.team ? `<br><span class="note">${esc(s.team)}</span>` : ''}${s.hand ? ' <span class="chip p">hand up</span>' : ''}</td>
      <td>${esc(doing)}<br><span class="note">${s.online ? 'active ' + ago(s.status && s.status.at || s.lastSeen) : 'last seen ' + ago(s.lastSeen)}</span></td>
      <td>${chips}</td><td>${progressBar(s)}<br><span class="note">${c.activities.filter(a => s.progress[a.id] && s.progress[a.id].done).length}/${c.activities.length}</span></td>
      <td>${subs.length ? subs.map(([a, v]) => `<button class="btn small" data-code="${esc(s.id)}" data-arena="${esc(a)}" title="Handed in ${ago(v.at)}">${esc(arenaName(a))}</button>`).join(' ') : '<span class="note">nothing yet</span>'}</td>
      <td><div class="row" style="justify-content:flex-end"><button class="btn small" data-msg="${esc(s.id)}">Message</button><button class="btn small" data-send="${esc(s.id)}">Send code</button><button class="btn small danger" data-remove="${esc(s.id)}">Remove</button></div></td></tr>`;
  }).join('');
}
$('#annForm').addEventListener('submit', async e => { e.preventDefault(); try { await api('POST', '/api/teacher/class', { announcement: $('#annText').value.trim() }); toast('Posted to the class'); $('#annText').blur(); } catch (err) { toast(err.message); } });
$('#annClear').addEventListener('click', async () => { $('#annText').value = ''; await api('POST', '/api/teacher/class', { announcement: '' }).catch(() => {}); toast('Message cleared'); });
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.lower) { await api('POST', '/api/teacher/student/hand', { id: b.dataset.lower }); }
    else if (b.dataset.code) showCode(b.dataset.code, b.dataset.arena);
    else if (b.dataset.msg) messageModal(b.dataset.msg);
    else if (b.dataset.send) handoutModal(b.dataset.send);
    else if (b.dataset.remove) {
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Click again'; return; }
      await api('POST', '/api/teacher/student/remove', { id: b.dataset.remove }); toast('Student removed');
    }
  } catch (err) { toast(err.message); }
});

/* ---------- modals ---------- */
function openModal(html) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.dataset.close !== undefined) closeModal(); });
async function showCode(id, arena) {
  try {
    const d = await api('GET', `/api/code?student=${encodeURIComponent(id)}&arena=${encodeURIComponent(arena)}`);
    openModal(`<div class="row"><h3 style="margin:0">${esc(d.name)} · ${esc(arenaName(arena))}</h3><span class="spacer"></span><span class="note">handed in ${ago(d.at)}${d.mode === 'blocks' ? ' · made with blocks' : ''}</span></div>
      <pre class="code" style="margin-top:10px">${esc(d.code)}</pre>
      <div class="row" style="margin-top:10px"><a class="btn primary" href="/?view=${encodeURIComponent(id)}&arena=${encodeURIComponent(arena)}" target="_blank" rel="noopener">Run it on this screen</a><button class="btn" id="copyCode">Copy</button><span class="spacer"></span><button class="btn" data-close>Close</button></div>`);
    $('#copyCode').addEventListener('click', () => { navigator.clipboard.writeText(d.code).then(() => toast('Copied'), () => toast('Select the code and press Ctrl+C')); });
  } catch (err) { toast(err.message); }
}
function messageModal(id) {
  const s = C().students.find(x => x.id === id);
  openModal(`<h3>Message ${esc(s ? s.name : 'student')}</h3><form id="msgForm"><textarea id="msgText" maxlength="500" rows="3" style="width:100%" placeholder="e.g. Great job! Now try a higher baseSpeed."></textarea><div class="row" style="margin-top:8px"><button class="btn primary" type="submit">Send</button><button class="btn" type="button" data-close>Cancel</button></div></form>`);
  $('#msgText').focus();
  $('#msgForm').addEventListener('submit', async e => { e.preventDefault(); const text = $('#msgText').value.trim(); if (!text) return; try { await api('POST', '/api/teacher/message', { target: id, text }); toast('Message sent'); closeModal(); } catch (err) { toast(err.message); } });
}
function exampleOptions(arena) { const ex = T.meta.examples[arena] || {}; return Object.entries(ex).map(([k, v]) => `<option value="${esc(k)}">${esc(v.name)}</option>`).join(''); }
function handoutModal(target) {
  const s = target === 'all' ? null : C().students.find(x => x.id === target);
  const arenas = Object.entries(T.meta.arenas).map(([k, a]) => `<option value="${k}">${esc(a.name)}</option>`).join('');
  openModal(`<h3>Send a program to ${s ? esc(s.name) : 'everyone'}</h3>
    <p class="note" style="margin-top:0">Students get a notice with a "Load it" button. It replaces the code in their editor for that arena.</p>
    <form id="hoForm"><div class="form"><label class="fld">Arena<select id="hoArena">${arenas}</select></label><label class="fld">Start from an example<select id="hoEx"><option value="">(type your own)</option></select></label><label class="fld wide">Note to students<input type="text" id="hoNote" maxlength="300" placeholder="e.g. Here is a faster PID — find the best Kd"></label></div>
    <textarea class="code" id="hoCode" style="margin-top:8px" placeholder="Arduino code"></textarea>
    <div class="row" style="margin-top:8px"><button class="btn primary" type="submit">Send</button><button class="btn" type="button" data-close>Cancel</button></div></form>`);
  const fill = () => { $('#hoEx').innerHTML = '<option value="">(type your own)</option>' + exampleOptions($('#hoArena').value); };
  fill();
  $('#hoArena').addEventListener('change', fill);
  $('#hoEx').addEventListener('change', () => { const ex = T.meta.examples[$('#hoArena').value][$('#hoEx').value]; if (ex) $('#hoCode').value = ex.code; });
  $('#hoForm').addEventListener('submit', async e => { e.preventDefault(); const code = $('#hoCode').value; if (!code.trim()) { toast('Type or pick some code first'); return; } try { await api('POST', '/api/teacher/handout', { target, arena: $('#hoArena').value, kind: 'code', code, note: $('#hoNote').value.trim() }); toast('Sent'); closeModal(); } catch (err) { toast(err.message); } });
}

/* ---------- lesson plan ---------- */
function goalText(a) {
  if (a.builtin && (!a.goal || a.goal.type === 'builtin')) { const l = T.meta.lessons.find(x => x.id === a.builtin); return l ? l.goal : 'Built-in goal'; }
  const g = a.goal || { type: 'none' }, gt = T.meta.goals[g.type] || T.meta.goals.none;
  const ps = Object.entries(gt.params).map(([k, p]) => `${p.label.toLowerCase()} ${g[k]}`).join(', ');
  return gt.label + (ps ? ` (${ps})` : '');
}
function renderPlan() {
  const c = C(), acts = c.activities;
  const done = id => c.students.filter(s => s.progress[id] && s.progress[id].done).length;
  $('#acts').innerHTML = acts.length ? acts.map((a, i) => `<div class="act ${c.lock === a.id ? 'locked' : ''}">
      <span class="n">${i + 1}</span>
      <div><b>${esc(a.title)}</b>${c.lock === a.id ? ' <span class="chip p">locked: everyone is here</span>' : ''}<br><span class="note">${esc(arenaName(a.arena))}${a.variant && T.meta.arenas[a.arena] && T.meta.arenas[a.arena].variants[a.variant] ? ' · ' + esc(T.meta.arenas[a.arena].variants[a.variant]) : ''}${a.realism ? ' · ' + ({ ideal: 'Ideal world', real: 'Realistic', tough: 'Competition day' })[a.realism] : ''} · Goal: ${esc(goalText(a))}</span><br><span class="note"><b class="ok">${done(a.id)}</b> of ${c.students.length} students done</span></div>
      <div class="row"><button class="btn small" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="btn small" data-down="${i}" ${i === acts.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
        <button class="btn small ${c.lock === a.id ? 'yellow' : ''}" data-lock="${esc(a.id)}">${c.lock === a.id ? 'Unlock' : 'Lock class here'}</button>
        <button class="btn small" data-edit="${i}">Edit</button><button class="btn small danger" data-del="${i}">Delete</button></div></div>`).join('')
    : '<p class="empty">No activities yet. Add one from the built-in lessons, or make your own.</p>';
}
async function savePlan(acts, msg) { try { await api('POST', '/api/teacher/class', { activities: acts }); if (msg) toast(msg); } catch (err) { toast(err.message); } }
$('#acts').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  const acts = JSON.parse(JSON.stringify(C().activities));
  if (b.dataset.up) { const i = +b.dataset.up; [acts[i - 1], acts[i]] = [acts[i], acts[i - 1]]; savePlan(acts); }
  else if (b.dataset.down) { const i = +b.dataset.down; [acts[i + 1], acts[i]] = [acts[i], acts[i + 1]]; savePlan(acts); }
  else if (b.dataset.del) { if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Click again'; return; } acts.splice(+b.dataset.del, 1); savePlan(acts, 'Activity deleted'); }
  else if (b.dataset.edit) editActivity(+b.dataset.edit);
  else if (b.dataset.lock) { const on = C().lock !== b.dataset.lock; try { await api('POST', '/api/teacher/class', { lock: on ? b.dataset.lock : null }); toast(on ? 'Every student now works on this activity' : 'Students can choose freely again'); } catch (err) { toast(err.message); } }
});
$('#addAct').addEventListener('click', () => editActivity(-1));
function editActivity(index) {
  const isNew = index < 0, a = isNew ? { id: '', title: '', arena: 'line', variant: 'oval', realism: '', intro: '', steps: [], starter: { kind: 'example', example: 'bang' }, goal: { type: 'laps', n: 1 } } : JSON.parse(JSON.stringify(C().activities[index]));
  const lessons = T.meta.lessons.map(l => `<option value="${esc(l.id)}" ${a.builtin === l.id ? 'selected' : ''}>${esc(l.title)} · ${esc(arenaName(l.arena))}</option>`).join('');
  openModal(`<h3>${isNew ? 'Add an activity' : 'Edit activity'}</h3>
    <form id="actForm">
      <div class="form">
        <label class="fld wide">Start from a built-in lesson<select id="aBuiltin"><option value="">— Make my own activity —</option>${lessons}</select></label>
        <label class="fld wide">Title<input type="text" id="aTitle" maxlength="80" required value="${esc(a.title)}" placeholder="e.g. Tune a PID racer"></label>
        <label class="fld">Arena<select id="aArena">${Object.entries(T.meta.arenas).map(([k, x]) => `<option value="${k}" ${a.arena === k ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label class="fld"><span id="aVarLbl">Track</span><select id="aVariant"></select></label>
        <label class="fld">World<select id="aReal"><option value="">Students choose</option><option value="ideal">Ideal world</option><option value="real">Realistic</option><option value="tough">Competition day</option></select></label>
        <label class="fld">Goal<select id="aGoal"></select></label>
        <div class="fld wide" id="aParams" style="flex-direction:row;gap:10px;flex-wrap:wrap"></div>
        <label class="fld">Starter program<select id="aStarter"><option value="none">Keep the student's own code</option><option value="lesson">The built-in lesson's program</option><option value="example">An example program</option><option value="code">My own code (below)</option></select></label>
        <label class="fld" id="aExRow">Example<select id="aExample"></select></label>
        <label class="fld wide" id="aCodeRow">Your starter code<textarea class="code" id="aCode" placeholder="Arduino code students start from">${esc(a.starter && a.starter.code || '')}</textarea></label>
        <label class="fld wide">Instructions for students<textarea id="aIntro" rows="2" maxlength="2000" placeholder="What is this activity about?">${esc(a.intro || '')}</textarea></label>
        <label class="fld wide">Steps (one per line)<textarea id="aSteps" rows="4" placeholder="Run the program&#10;Change the speed&#10;…">${esc((a.steps || []).join('\n'))}</textarea></label>
      </div>
      <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">${isNew ? 'Add to lesson plan' : 'Save'}</button><button class="btn" type="button" data-close>Cancel</button></div>
    </form>`);
  $('#aReal').value = a.realism || '';
  $('#aStarter').value = (a.starter && a.starter.kind) || 'none';
  const refresh = () => {
    const arena = $('#aArena').value, ar = T.meta.arenas[arena];
    $('#aVarLbl').textContent = ar.variantLabel;
    const keepV = $('#aVariant').value || a.variant;
    $('#aVariant').innerHTML = Object.entries(ar.variants).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    if (ar.variants[keepV]) $('#aVariant').value = keepV;
    const b = $('#aBuiltin').value;
    const goals = Object.entries(T.meta.goals).filter(([, g]) => !g.arenas || g.arenas.includes(arena));
    const curGoal = $('#aGoal').value || (a.goal && a.goal.type);
    $('#aGoal').innerHTML = (b ? `<option value="builtin">The lesson's own goal</option>` : '') + goals.map(([k, g]) => `<option value="${k}">${esc(g.label)}</option>`).join('');
    if ([...$('#aGoal').options].some(o => o.value === curGoal)) $('#aGoal').value = curGoal; else if (b) $('#aGoal').value = 'builtin';
    renderParams();
    $('#aExample').innerHTML = exampleOptions(arena);
    if (a.starter && a.starter.example && T.meta.examples[arena][a.starter.example]) $('#aExample').value = a.starter.example;
    $('#aStarter').querySelector('[value=lesson]').disabled = !b;
    if (!b && $('#aStarter').value === 'lesson') $('#aStarter').value = 'example';
    $('#aExRow').hidden = $('#aStarter').value !== 'example';
    $('#aCodeRow').hidden = $('#aStarter').value !== 'code';
  };
  const renderParams = () => {
    const type = $('#aGoal').value, g = T.meta.goals[type];
    if ($('#aParams').dataset.type === type) return;   // keep what the teacher typed
    $('#aParams').dataset.type = type;
    $('#aParams').innerHTML = g ? Object.entries(g.params).map(([k, p]) => `<label class="fld" style="min-width:140px">${esc(p.label)}<input type="number" data-param="${k}" min="${p.min}" max="${p.max}" value="${a.goal && a.goal.type === type && a.goal[k] !== undefined ? a.goal[k] : p.def}"></label>`).join('') : '';
  };
  $('#aBuiltin').addEventListener('change', () => {
    const l = T.meta.lessons.find(x => x.id === $('#aBuiltin').value);
    if (l) { $('#aTitle').value = l.title; $('#aArena').value = l.arena; a.variant = l.variant; $('#aVariant').value = ''; $('#aStarter').value = 'lesson'; $('#aGoal').value = 'builtin'; }
    refresh();
  });
  $('#aArena').addEventListener('change', () => { $('#aVariant').value = ''; a.variant = ''; refresh(); });
  $('#aGoal').addEventListener('change', renderParams);
  $('#aStarter').addEventListener('change', refresh);
  $('#aExample').addEventListener('change', () => { if (a.starter) a.starter.example = $('#aExample').value; });
  refresh();
  $('#actForm').addEventListener('submit', async e => {
    e.preventDefault();
    const goal = { type: $('#aGoal').value };
    $$('#aParams [data-param]').forEach(i => { goal[i.dataset.param] = +i.value; });
    const kind = $('#aStarter').value;
    const act = {
      id: a.id || Math.random().toString(16).slice(2, 10), title: $('#aTitle').value.trim(), builtin: $('#aBuiltin').value || undefined,
      arena: $('#aArena').value, variant: $('#aVariant').value, realism: $('#aReal').value,
      intro: $('#aIntro').value.trim(), steps: $('#aSteps').value.split('\n').map(x => x.trim()).filter(Boolean),
      starter: { kind, example: kind === 'example' ? $('#aExample').value : undefined, code: kind === 'code' ? $('#aCode').value : undefined },
      goal,
    };
    const acts = JSON.parse(JSON.stringify(C().activities));
    if (isNew) acts.push(act); else acts[index] = act;
    await savePlan(acts, isNew ? 'Activity added' : 'Saved');
    closeModal();
  });
}

/* ---------- results ---------- */
function renderResults() {
  const c = C(), acts = c.activities, stu = [...c.students].sort((a, b) => a.name.localeCompare(b.name));
  $('#grid').innerHTML = stu.length && acts.length ? `<thead><tr><th>Student</th>${acts.map((a, i) => `<th title="${esc(a.title)}">${i + 1}. ${esc(a.title.length > 18 ? a.title.slice(0, 17) + '…' : a.title)}</th>`).join('')}<th>Done</th></tr></thead><tbody>${stu.map(s => `<tr><td><b>${esc(s.name)}</b>${s.team ? ` <span class="note">${esc(s.team)}</span>` : ''}</td>${acts.map(a => { const p = s.progress[a.id]; return `<td class="c">${p && p.done ? `<span class="ok">✓</span>${p.result ? `<br><span class="note">${esc(p.result)}</span>` : ''}` : p ? `<span class="note">tried ${p.attempts || ''}</span>` : ''}</td>`; }).join('')}<td class="c"><b>${acts.filter(a => s.progress[a.id] && s.progress[a.id].done).length}/${acts.length}</b></td></tr>`).join('')}</tbody>
    <tfoot><tr><th>Class</th>${acts.map(a => `<th class="c">${Math.round(100 * stu.filter(s => s.progress[a.id] && s.progress[a.id].done).length / Math.max(1, stu.length))}%</th>`).join('')}<th></th></tr></tfoot>` : '<tr><td class="empty">Results appear here when students start the activities.</td></tr>';
  const lb = c.leaderboard, boxes = [];
  for (const [arena, keys] of Object.entries(lb)) for (const [key, rows] of Object.entries(keys)) {
    const ar = T.meta.arenas[arena], label = key === 'wins' ? 'Battle wins' : key === 'lap' ? 'Best lap' : (ar && ar.variants[key]) || key;
    boxes.push(`<div class="card"><b>${esc(arenaName(arena))}</b> <span class="note">${esc(label)}</span>${rows.map((r, i) => `<div class="lbrow"><span>${i + 1}</span><span>${esc(r.name)}${r.team ? ` <span class="note">${esc(r.team)}</span>` : ''}</span><span class="t">${key === 'wins' ? r.value : r.value.toFixed(2) + ' s'}</span></div>`).join('')}</div>`);
  }
  $('#boards').innerHTML = boxes.join('') || '<p class="empty">Best lap times and battle wins appear here automatically.</p>';
}

/* ---------- battles ---------- */
function renderBattles() {
  const c = C(), arena = $('#batArena').value;
  const ok = c.students.filter(s => s.subs[arena]);
  const opts = ok.map(s => `<option value="${esc(s.id)}">${esc(s.name)}${s.team ? ' · ' + esc(s.team) : ''}</option>`).join('');
  const keepA = $('#batA').value, keepB = $('#batB').value;
  $('#batA').innerHTML = opts; $('#batB').innerHTML = opts;
  if (keepA) $('#batA').value = keepA; if (keepB) $('#batB').value = keepB; else if (ok.length > 1) $('#batB').selectedIndex = 1;
  $('#batGo').disabled = ok.length < 2;
  $('#batNote').textContent = ok.length < 2 ? `At least two students need to hand in a ${arenaName(arena)} program.` : '';
  $('#matches').innerHTML = c.matches.length ? c.matches.slice(0, 30).map(m => `<div class="lbrow" style="grid-template-columns:1fr auto"><span><b>${esc(m.a)}</b> vs <b>${esc(m.b)}</b> · ${esc(arenaName(m.arena))}<br><span class="note">${esc(m.text)}</span></span><span class="note">${ago(m.at)}</span></div>`).join('') : '<p class="empty">No battles yet.</p>';
}
$('#batArena').addEventListener('change', renderBattles);
$('#batGo').addEventListener('click', () => {
  const a = $('#batA').value, b = $('#batB').value;
  if (a === b) { toast('Pick two different students'); return; }
  window.open(`/?battle=${encodeURIComponent(a)},${encodeURIComponent(b)}&arena=${encodeURIComponent($('#batArena').value)}`, '_blank', 'noopener');
});

/* ---------- settings & classes ---------- */
function renderSettings() {
  const c = C();
  if (!$('#t-settings').contains(document.activeElement)) { $('#setName').value = c.name; $('#setPin').value = c.pin || ''; $('#setShow').checked = !!c.settings.showCode; }
  $('#classList').innerHTML = T.st.classes.map(k => `<div class="lbrow" style="grid-template-columns:1fr auto"><span><b>${esc(k.name)}</b> <span class="note">${k.students} students · made ${new Date(k.created).toLocaleDateString()}</span>${k.id === c.id ? ' <span class="chip p">open now</span>' : ''}</span><span class="row">${k.id !== c.id ? `<button class="btn small" data-open="${esc(k.id)}">Open this class</button><button class="btn small danger" data-delclass="${esc(k.id)}">Delete</button>` : ''}</span></div>`).join('');
  const lan = T.st.lan[Math.min(T.lan, T.st.lan.length - 1)];
  $('#teacherLink').textContent = (lan ? lan.url : `http://localhost:${T.st.port}/`) + 'teacher?key=' + T.st.teacherKey;
  $('#dataFile').textContent = `Class data is saved on this laptop in ${T.st.dataFile} · DOWEE ${T.st.version}`;
}
$('#saveSettings').addEventListener('click', async () => { try { await api('POST', '/api/teacher/class', { name: $('#setName').value.trim(), pin: $('#setPin').value.trim(), settings: { ...C().settings, showCode: $('#setShow').checked } }); toast('Saved'); } catch (err) { toast(err.message); } });
$('#classList').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.open) { await api('POST', '/api/teacher/classes/activate', { id: b.dataset.open }); toast('Class opened. Students of this class can join now.'); }
    if (b.dataset.delclass) { if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Click again: deletes all its results'; return; } await api('POST', '/api/teacher/classes/delete', { id: b.dataset.delclass }); toast('Class deleted'); }
  } catch (err) { toast(err.message); }
});
$('#classSel').addEventListener('change', async e => { try { await api('POST', '/api/teacher/classes/activate', { id: e.target.value }); toast('Class opened'); } catch (err) { toast(err.message); } });
$('#newClassBtn').addEventListener('click', () => {
  openModal(`<h3>New class</h3><form id="ncForm"><label class="fld">Name<input type="text" id="ncName" maxlength="60" required placeholder="e.g. Grade 7 – Section B"></label>
    <label class="fld" style="flex-direction:row;align-items:center;gap:8px;color:var(--ink);margin-top:8px"><input type="checkbox" id="ncCopy" checked> Copy the lesson plan from "${esc(C().name)}"</label>
    <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Create and open</button><button class="btn" type="button" data-close>Cancel</button></div></form>`);
  $('#ncName').focus();
  $('#ncForm').addEventListener('submit', async e => { e.preventDefault(); try { await api('POST', '/api/teacher/classes/new', { name: $('#ncName').value.trim(), copyFrom: $('#ncCopy').checked ? C().id : null }); toast('Class created'); closeModal(); } catch (err) { toast(err.message); } });
});

/* ---------- render ---------- */
function render() {
  if (!T.st || !T.meta) return;
  renderJoin();
  if (T.tab === 'live') renderLive();
  if (T.tab === 'plan') renderPlan();
  if (T.tab === 'results') renderResults();
  if (T.tab === 'battles') renderBattles();
  if (T.tab === 'settings') renderSettings();
  if (T.tab !== 'live') { const h = C().students.filter(s => s.hand).length; $('#handCount').hidden = !h; $('#handCount').textContent = h; }
}
setInterval(() => { if (T.tab === 'live' && $('#modal').hidden) render(); }, 15000);
fetch('/meta.json').then(r => r.json()).then(m => { T.meta = m; render(); }).catch(() => toast('Could not load the lesson list.'));
connect();
