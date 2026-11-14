# DOWEE: notes for continuing work

DOWEE is a virtual robotics lab for teaching kids aged 9–20. Students program **Dowee**, a standard Arduino robot (Uno + L298N + 2 TT motors + 5-channel IR array on A0–A4 + HC-SR04 on 11/12 + HC-05 on 0/1), in Arduino C or Blockly blocks. Teachers host a classroom from their laptop, and students join over Wi-Fi by link or QR code.

## Commands

- `npm run build`: rebuilds the simulator into `app/` (`index.html` + `styles.css`) and `server/public/meta.json` from `src/`. Run it after every change in `src/`. Never edit `app/` by hand.
- `npm start`: starts the classroom server (`--port`, `--data <folder>`, `--no-open`). The teacher dashboard is at `http://localhost:8080/teacher`.
- `npm test`: the build, the headless simulator checks (`tools/check.js`) and the blocks checks (`tools/blocks-check.js`). The blocks checks use Playwright when it can be loaded, and are skipped otherwise. `node tools/test.js <line|sumo|maze|race|soccer|lab|straight>` with `LV=ideal|real|tough`.
- `node tools/sweep.js real '[[Kp,Kd,speed]]'`: tries PID settings across robot units.

## How it fits together

- `src/core-lang.js`: Arduino C interpreter. It behaves like an Uno: 16-bit int, 8-bit PWM, real timing costs.
- `src/core-sim.js`: board runtime, physics (1 ms steps), the realism model (per-unit quirks from `makeQuirks`, world flaws from `makeEnv`), collisions and AI opponents.
- `src/core-arenas.js`: arenas and their rules.
- `src/examples.js`, `src/lessons.js`, `src/goals.js`: example programs, built-in lessons, and the goal types teachers can attach to activities.
- `src/templates.js`: the student templates per playground (`guided` with TODO steps, `blank` with only the wiring), their missions (3 stars, using `GOAL_TYPES`) and the hint ladder. `src/challenges.js`: fix-the-bug programs, added to `LESSONS` with level "Fix the bug". Their fixes live only in `tools/check.js`.
- `src/primm.js` (after `advanced-pid.js` in the build): PRIMM content for every lesson (`predict`, `investigate`, `modify`, plus `todo` variants for classroom TODO starters; fix-the-bug lessons get Predict and Investigate) and `LESSON_PATH`, the levels of the Lessons page. Modify checks are `check(W, memo)`, polled about every 200 ms; helpers are in `PQ`. Every Modify step needs a reference change in `MOD` in `tools/check.js`.
- `src/blocks.js` (inserted into `ui.js` at `/*@BLOCKS@*/`): Blocks mode.
  - `blocksToArduino(ws)` is the translator.
    - Orders are whole numbers spaced by 2, because Blockly floors them. The left operand gets `ord + 1`; the right operand of − × ÷ gets `ord - 1`, so it is bracketed.
    - ÷ always gives a decimal; `dowee_intdiv` gives C's whole-number division.
    - `inferTypes` types the variables: typed variables (`int`/`float`/`bool`, made with the three Variables buttons; lists are `int name[LIST_SIZE]`) keep their type. Untyped ones become `int` unless a decimal can reach them. `checkFit` warns when a decimal goes into an `int`.
    - `makeNames` makes names unique and safe.
    - Only the setup lines that are used are emitted.
  - `STATEMENT_PREFIX` markers become `BK.lineMap` (code line → block id), which drives:
    - click-to-highlight in the code view (`#blkCode`);
    - the glowing running block (`glowRunningBlock`, using `board.line` and `board.calls`, the caller lines kept by `invoke` in `core-sim.js`);
    - errors pointing at blocks (`blockForError`).
  - `TOOLBOX(level)` gives `beginner` or `full`. `toolboxLevel()`: a lesson's `toolbox` wins, then `settings.toolbox`.
  - `window.__doweeBlocks` is a read-only hook for `tools/blocks-check.js`.
  - Blockly is inlined into `app/index.html` by `tools/build.js` (from `server/public/vendor/blockly`).
- `src/blocks-content.js` (after `primm.js`): `X` XML helpers, `BLOCK_EXAMPLES[arena][id]` (`starter: true` is what classroom students always get; others are unlocked as `blk:arena/id`), and `BLOCK_LESSONS` (the Blocks track, pushed into `LESSONS` and put first in `LESSON_PATH`). Each lesson has `blocksXml`, `toolbox` and PRIMM. Their reference solutions live in `REF` in `tools/blocks-check.js`.
- `src/ui.js`: the simulator interface. `tools/build.js` inserts `src/host.js` (classroom mode for students) at the `/*@HOST@*/` marker.
  - Views: `showMeet()`, `showLessons()` (the path page, `buildPath()`), `showWork()`.
  - The lesson pane (`#lessonPane`, left of the code) is built by `buildLessons()`. With no lesson it shows the playground's missions. Layout is set by `layoutWork()`: a column on wide screens (`S.paneOpen`), a drawer at 761–1100 px (`S.drawer`), and its own view on phones (`S.mview`, the bottom `#mSwitch`).
  - PRIMM engine: `primmOf`, `primmStages`, `primmHtml`, `checkPrimm`. `primmGate()` blocks Upload & run until the prediction is answered. Progress is saved under `progKey('primm')` and sent to the teacher with `hostPrimm` (`/api/primm`).
  - Dock: `DOCK` groups and `showPanel(p)`. The panel ids (`p-serial`, `p-plot`, `p-sensors`, `p-wiring`, `p-tune`, `p-class`) are unchanged.
  - Menus: `<details class="menu">` (code ⋯ and View).
  - First-time tour: `TOUR`, `startTour()`, the `seenTour` flag and the ? button.
- `server/server.js`: classroom server (Node.js, no dependencies). It uses JSON storage in `data/` and live updates over Server-Sent Events. A request counts as the teacher if it comes from localhost or carries the `dowee_teacher` cookie. Students are identified by a token.
- `server/public/`: the teacher dashboard (`teacher.html`, `teacher.js`) and the bundled Blockly and QR libraries.
- Styling lives only in CSS files: `src/styles.css` (simulator) and `server/public/teacher.css` (dashboard). Don't put `<style>` blocks or `style="…"` attributes in the HTML markup; use classes. (Small inline styles inside JavaScript templates are tolerated.)
- `app/index.html` works in three ways: from the classroom server, as a claude.ai artifact (class features use the artifact `db`), or as a plain offline file.

## Conventions

- Keep the server dependency-free so it packages easily.
- The student page is named **DOWEE** ("Your Virtual Arduino Robot").
- The palette is the low-poly playground look: teal background, cream panels, yellow, orange, pink, purple, blue and green. Fonts are Baloo 2, Nunito and JetBrains Mono.
- Write student-facing text in plain language for kids. Error messages say what to fix.
- Escape all student- and teacher-typed text before showing it in a page.
- Real physics lives in `PHYS` (`src/core-sim.js`) and is always on. Quirks (`makeQuirks`, `makeEnv`) are deviations that are zero for the Ideal robot (the default), so ideal runs are repeatable (fixed seed). Never put a defect into `PHYS`.
- After physics changes, run `npm test` (it fails if an example stops working) and `tools/sweep.js`.
- Physics was checked against the datasheets (TT motor 1:48, L298N, HC-SR04, TCRT5000, 2 x 18650).
  - Dowee weighs 0.5 kg, which makes pushing grip-limited: the sumo AIs get their strength from weight and grip, not only `stall`.
  - The L298N drop grows with load (1.3 → 1.8 V).
  - The battery lasts `PHYS.batteryHours` (2 h) at full power.
  - Gearbox backlash is `PHYS.backlash`.
  - The speed of sound follows `env.tempC`: 20 °C in the Ideal world.
  - The sonar uses 13 rays.
  - The ball rolls, so it has an effective mass of 5/3 × 80 g.

## Status

Done:
- Simulator with six arenas.
- Blocks mode:
  - code shown under the blocks (full width, with a drag bar `#blkSplit` saved as `blkCodeH`), with two-way highlighting and the running block glowing;
  - a block for every Arduino function the interpreter has (`BUILTINS`, `SERIAL`, `STRING_METHODS` in `core-lang.js`), plus Blockly's logic, math, loops and functions. `npm test` builds one program from every Full toolbox block (`__doweeBlocks.everyBlock()`), and checks the printed answers of the function blocks (`OUTPUT` in `tools/blocks-check.js`). When you add an interpreter function, add its block too;
  - typed variables (whole number, decimal, true/false, text = `String`) and lists. Text blocks count letters from 1, like lists;
  - Beginner/Full toolbox;
  - 14 examples;
  - a 10-lesson Blocks track;
  - works offline.
- Realism levels.
- Lessons.
- Classroom mode: join, lesson plan, live roster, hands, handouts, lock, results with CSV export, battles, several classes, and PIN.
- The teacher can change which playgrounds a class opens at any time (Settings → Playgrounds). This is `c.arenaPick`, via `allowedArenas(c)`; the Test lab is always on, and changing the robot type clears it. `robotInfo` gives a label such as "Line follower + Sumo".
- Class robot types (`ROBOT_TYPES` in `server/server.js`): line, sumo, rc, obstacle and all. Students only see their class's playgrounds plus the Test lab (`S.allowedArenas` in the app); the teacher sees everything. Classes saved before this feature load as `all`.
- Live tuning (`buildTune`, `tuneRange`, `prepareGlobals` in `src/ui.js`): global values are set at compile time, so sliders are right immediately. Tuned values are kept per arena across Restart until the number in the code changes. Ranges follow the hardware: PWM 0–255, analogRead 0–1023, HC-SR04 0–400 cm (hard limits), plus times in ms, and type limits such as a 16-bit int.
- Meet Dowee is a main tab (`showMeet()` / `showWork()` in `src/ui.js`) and the students' starting page. It has numbered parts, and the parts that matter for the class type are highlighted (`CLASS_TYPES`).
- The examples menu (`fillExamples(others)` in `src/ui.js`) lists only the current playground's samples; "More from other playgrounds…" lists the rest, and picking one opens its playground first (`goToSampleArena`).
- Students write their own code (`samplesLocked()` in `src/ui.js`): in a class, students (and guests) start from the class's template (Guided or Blank, set by the teacher) and only see the samples the teacher unlocked (`settings.unlocked`) or sent. Built-in lessons give them a TODO version (`todo` in `src/lessons.js`). The teacher and solo/offline use keep every sample.
- Missions with stars and the hint ladder in the Lessons tab. Stars and hint use are reported to the teacher (`/api/stars`, `/api/hint`); the roster, Results and CSV show them. The teacher can turn hints off (`settings.hints`).
- PID path (`PID_LESSONS` in `src/lessons.js`): pid1 the weighted-average error, pid2 P, pid3 D, then pid (calibrate and race). Each step's goal is out of reach for the step before; `npm test` checks the starters fail and the finished steps pass. New line follower classes get all four in their plan.
- Advanced PID (`src/advanced-pid.js`, after `lessons.js` in the build):
  - apid1: worksheet with blank boxes (`PIDI_FULL` with `{{n}}`, `PID_BLANKS`, `canonAnswer`);
  - apid2: the same blanks as `____` in the editor (the compiler says "This line still has a blank");
  - apid3: a guided build with 5 live checkpoints (`PIDI_GUIDE`) that read the student's globals with `globalOf`. Step 4 lends a Dowee with a 30% weaker right motor (`S.lessonRobot`) to show when I helps.
  - Why the plain PID has no I: on a normal Dowee, I only adds wiggle, and without a limit it winds up and loses the line.
- Ten fix-the-bug challenges. `npm test` checks that each broken program fails and its fix passes, that every template runs, and that every automatic mission can be reached.
- UI tidy-up:
  - Lessons is a main tab with a learning path (levels, "Next" badge, progress dots, mission strips).
  - Lessons open in a side pane beside the code.
  - The dock is grouped as Serial · Robot · Tune · Class.
  - The code bar has a ⋯ menu, and the arena bar has a View menu (World, speed, trail, sensor view, sound, Draw track), with `#viewChip` showing non-default settings.
  - Phones get a Code/Arena/Lesson switcher.
  - A first-time tour.
- PRIMM in every lesson. `npm test` checks:
  - every answer index is valid;
  - every lesson is in `LESSON_PATH`;
  - the starter ticks no Modify step, and each reference change ticks its own.
- Teacher dashboard:
  - the join card folds into a header pill;
  - the roster shows labelled progress chips and the current PRIMM part, with a click-to-expand row per student and a ⋯ menu;
  - Merge (`/api/teacher/student/merge`, which keeps the merged device's token as an `alias`);
  - the lesson plan is a draggable path, with "Add from the lessons path" (`meta.path`);
  - Results and CSV have prediction and lesson-part columns.

Next:
1. **Standalone app:** wrap the server and dashboard with Electron for a normal installer. Open question for the user: which systems should it support (Windows, macOS, Linux)?
2. **More hardware:** the user wants these next: servo, wheel encoders, colour sensor, gyro.
3. **Ideas:** gearbox backlash in the physics; update the published claude.ai artifact with the latest build.
