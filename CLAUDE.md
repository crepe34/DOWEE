# DOWEE: notes for continuing work

DOWEE is a virtual robotics lab for teaching kids aged 9–20. Students program **Dowee**, a standard Arduino robot (Uno + L298N + 2 TT motors + 5-channel IR array on A0–A4 + HC-SR04 on 11/12 + HC-05 on 0/1), in Arduino C or Blockly blocks. Teachers host a classroom from their laptop, and students join over Wi-Fi by link or QR code.

## Commands

- `npm run build`: rebuilds `robobench.html` and `server/public/meta.json` from `src/`. Run it after every change in `src/`.
- `npm start`: starts the classroom server (`--port`, `--data <folder>`, `--no-open`). The teacher dashboard is at `http://localhost:8080/teacher`.
- `npm test`: headless simulator checks. `node tools/test.js <line|sumo|maze|race|soccer|lab|straight>` with `LV=ideal|real|tough`.
- `node tools/sweep.js real '[[Kp,Kd,speed]]'`: tries PID settings across robot units.

## How it fits together

- `src/core-lang.js`: Arduino C interpreter. It behaves like an Uno: 16-bit int, 8-bit PWM, real timing costs.
- `src/core-sim.js`: board runtime, physics (1 ms steps), the realism model (per-unit quirks from `makeQuirks`, world flaws from `makeEnv`), collisions and AI opponents.
- `src/core-arenas.js`: arenas and their rules.
- `src/examples.js`, `src/lessons.js`, `src/goals.js`: example programs, built-in lessons, and the goal types teachers can attach to activities.
- `src/ui.js`: the simulator interface. `tools/build.js` inserts `src/host.js` (classroom mode for students) at the `/*@HOST@*/` marker.
- `server/server.js`: classroom server (Node.js, no dependencies). It uses JSON storage in `data/` and live updates over Server-Sent Events. A request counts as the teacher if it comes from localhost or carries the `dowee_teacher` cookie. Students are identified by a token.
- `server/public/`: the teacher dashboard (`teacher.html`, `teacher.js`) and the bundled Blockly and QR libraries.
- `robobench.html` works in three ways: from the classroom server, as a claude.ai artifact (class features use the artifact `db`), or as a plain offline file.

## Conventions

- Keep the server dependency-free so it packages easily.
- The student page is named **DOWEE** ("Your Virtual Arduino Robot").
- The palette is the low-poly playground look: teal background, cream panels, yellow, orange, pink, purple, blue and green. Fonts are Baloo 2, Nunito and JetBrains Mono.
- Write student-facing text in plain language for kids. Error messages say what to fix.
- Escape all student- and teacher-typed text before showing it in a page.
- After physics changes, check that the examples still work on Realistic with `tools/test.js` and `tools/sweep.js`.

## Status

Done:
- Simulator with six arenas.
- Blocks mode.
- Realism levels.
- Lessons.
- Classroom mode: join, lesson plan, live roster, hands, handouts, lock, results with CSV export, battles, several classes, and PIN.
- Class robot types (`ROBOT_TYPES` in `server/server.js`): line, sumo, rc, obstacle and all. Students only see their class's playgrounds plus the Test lab (`S.allowedArenas` in the app); the teacher sees everything. Classes saved before this feature load as `all`.
- Live tuning (`buildTune`, `tuneRange`, `prepareGlobals` in `src/ui.js`): global values are set at compile time, so sliders are right immediately. Tuned values are kept per arena across Restart until the number in the code changes. Ranges follow the hardware: PWM 0–255, analogRead 0–1023, HC-SR04 0–400 cm (hard limits), plus times in ms, and type limits such as a 16-bit int.
- Meet Dowee is a main tab (`showMeet()` / `showWork()` in `src/ui.js`) and the students' starting page. It has numbered parts, and the parts that matter for the class type are highlighted (`CLASS_TYPES`).

Next:
1. **Standalone app:** wrap the server and dashboard with Electron for a normal installer. Open question for the user: which systems should it support (Windows, macOS, Linux)?
2. **More hardware:** the user wants these next: servo, wheel encoders, colour sensor, gyro.
3. **Ideas:** gearbox backlash in the physics; update the published claude.ai artifact with the latest build.
