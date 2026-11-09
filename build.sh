#!/bin/bash
# Builds the single-file app (robobench.html) from the sources in src/.
set -e
cd "$(dirname "$0")"
mkdir -p dist
cat src/core-lang.js src/core-sim.js src/core-arenas.js src/examples.js > dist/core-all.js
{ cat src/page-head.html; cat src/page-body.html; echo '<script>'; cat dist/core-all.js src/lessons.js src/ui.js; echo '</script>'; } > robobench.html
node -e "const fs=require('fs');const h=fs.readFileSync('robobench.html','utf8');const m=h.match(/<script>([\s\S]*)<\/script>/);new Function(m[1]);console.log('build ok', (h.length/1024).toFixed(0)+'KB')"
