#!/usr/bin/env node
// Builds robobench.html (the simulator) and server/public/meta.json (lesson and arena
// lists used by the teacher dashboard) from the sources in src/.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), src = f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');

const core = ['core-lang.js', 'core-sim.js', 'core-arenas.js', 'examples.js'].map(src).join('\n');
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'core-all.js'), core);

const ui = src('ui.js');
if (!ui.includes('/*@HOST@*/')) throw new Error('src/ui.js is missing the /*@HOST@*/ marker');
const script = [core, src('goals.js'), src('lessons.js'), ui.replace('/*@HOST@*/', () => src('host.js'))].join('\n');
new Function(script); // syntax check
const html = `${src('page-head.html')}${src('page-body.html')}<script>\n${script}\n</script>\n`;
fs.writeFileSync(path.join(ROOT, 'robobench.html'), html);

// metadata for the teacher dashboard
const ctx = { module: undefined, console };
vm.createContext(ctx);
vm.runInContext(`${core}\n${src('goals.js')}\n${src('lessons.js')}\n;this.__meta = {
  arenas: Object.fromEntries(Object.entries(ARENAS).map(([k, a]) => [k, { name: a.name, variants: a.variants, variantLabel: a.variantLabel, rc: !!a.rc }])),
  examples: Object.fromEntries(Object.entries(EXAMPLES).map(([k, ex]) => [k, Object.fromEntries(Object.entries(ex).map(([e, v]) => [e, { name: v.name, code: v.code }]))])),
  lessons: LESSONS.map(l => ({ id: l.id, title: l.title, level: l.level, arena: l.arena, variant: l.variant, goal: l.goal, intro: l.intro, blocks: !!l.blocks })),
  goals: Object.fromEntries(Object.entries(GOAL_TYPES).map(([k, g]) => [k, { label: g.label, arenas: g.arenas, params: g.params }])),
};`, ctx);
fs.mkdirSync(path.join(ROOT, 'server', 'public'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'server', 'public', 'meta.json'), JSON.stringify(ctx.__meta));
console.log(`build ok: robobench.html ${(html.length / 1024).toFixed(0)} KB, ${ctx.__meta.lessons.length} lessons`);
