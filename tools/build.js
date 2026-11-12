#!/usr/bin/env node
// Builds the simulator into app/ (index.html + styles.css) and server/public/meta.json
// (lesson and arena lists used by the teacher dashboard) from the sources in src/.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), src = f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');

const core = ['core-lang.js', 'core-sim.js', 'core-arenas.js', 'examples.js', 'templates.js', 'goals.js', 'challenges.js'].map(src).join('\n');
const extra = ['lessons.js', 'advanced-pid.js', 'primm.js', 'blocks-content.js'].map(src).join('\n');   // lessons and block programs
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'core-all.js'), core + '\n' + extra);

const ui = src('ui.js');
for (const m of ['/*@HOST@*/', '/*@BLOCKS@*/']) if (!ui.includes(m)) throw new Error(`src/ui.js is missing the ${m} marker`);
const script = [core, extra, ui.replace('/*@HOST@*/', () => src('host.js')).replace('/*@BLOCKS@*/', () => src('blocks.js'))].join('\n');
// Blockly is bundled into the page so Blocks mode also works offline (see THIRD_PARTY_NOTICES.md).
const VENDOR = path.join(ROOT, 'server', 'public', 'vendor', 'blockly');
const blockly = ['blockly_compressed.js', 'blocks_compressed.js', 'msg/en.js'].map(f => fs.readFileSync(path.join(VENDOR, f), 'utf8').replace(/<\/script/gi, '<\\/script')).join('\n;\n');
new Function(script); // syntax check
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${src('page-head.html')}</head>
<body>
${src('page-body.html')}<script>
${blockly}
</script>
<script>
${script}
</script>
</body>
</html>
`;
const APP = path.join(ROOT, 'app');
fs.mkdirSync(APP, { recursive: true });
fs.writeFileSync(path.join(APP, 'index.html'), html);
fs.copyFileSync(path.join(ROOT, 'src', 'styles.css'), path.join(APP, 'styles.css'));

// metadata for the teacher dashboard
const ctx = { module: undefined, console };
vm.createContext(ctx);
vm.runInContext(`${core}\n${extra}\n;this.__meta = {
  path: LESSON_PATH.map(p => ({ name: p.name, about: p.about, ids: p.ids, extra: !!p.extra })),
  arenas: Object.fromEntries(Object.entries(ARENAS).map(([k, a]) => [k, { name: a.name, variants: a.variants, variantLabel: a.variantLabel, rc: !!a.rc }])),
  examples: Object.fromEntries(Object.entries(EXAMPLES).map(([k, ex]) => [k, Object.fromEntries(Object.entries(ex).map(([e, v]) => [e, { name: v.name, code: v.code }]))])),
  blockExamples: Object.fromEntries(Object.entries(BLOCK_EXAMPLES).map(([k, ex]) => [k, Object.fromEntries(Object.entries(ex).map(([e, v]) => [e, { name: v.name, starter: !!v.starter, xml: v.xml() }]))])),
  lessons: LESSONS.map(l => ({ id: l.id, title: l.title, level: l.level, arena: l.arena, variant: l.variant, goal: l.goal, intro: l.intro, blocks: !!l.blocks, bug: !!l.bug })),
  templates: Object.fromEntries(Object.entries(TEMPLATES).map(([k, t]) => [k, { name: t.name, missions: t.missions.map(m => m.text) }])),
  goals: Object.fromEntries(Object.entries(GOAL_TYPES).map(([k, g]) => [k, { label: g.label, arenas: g.arenas, params: g.params }])),
};`, ctx);
fs.mkdirSync(path.join(ROOT, 'server', 'public'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'server', 'public', 'meta.json'), JSON.stringify(ctx.__meta));
console.log(`build ok: app/index.html ${(html.length / 1024).toFixed(0)} KB + app/styles.css, ${ctx.__meta.lessons.length} lessons`);
