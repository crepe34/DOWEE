#!/bin/bash
# Rebuilds robobench.html and server/public/meta.json from src/.
set -e
cd "$(dirname "$0")"
node tools/build.js
