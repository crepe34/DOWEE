# DOWEE: notes for continuing work

DOWEE is a virtual robotics lab for teaching kids aged 9–20. Students program **Dowee**, a standard Arduino robot (Uno + L298N + 2 TT motors + 5-channel IR array on A0–A4 + HC-SR04 on 11/12 + HC-05 on 0/1), in Arduino C or Blockly blocks. Teachers host a classroom from their laptop, and students join over Wi-Fi by link or QR code.

## Commands

- `npm run build`: rebuilds the simulator into `app/` (`index.html` + `styles.css`) and `server/public/meta.json` from `src/`. Run it after every change in `src/`. Never edit `app/` by hand.
- `npm start`: starts the classroom server (`--port`, `--data <folder>`, `--no-open`). The teacher dashboard is at `http://localhost:8080/teacher`.
- `npm test`: the build, the headless simulator checks (`tools/check.js`) and the blocks checks (`tools/blocks-check.js`). The blocks checks use Playwright when it can be loaded, and are skipped otherwise. `node tools/test.js <line|sumo|maze|race|soccer|lab|straight>` with `LV=ideal|real|tough`.
- `node tools/sweep.js real '[[Kp,Kd,speed]]'`: tries PID settings of the PID sample (defaults 70, 1000, 240) across robot units.
- `npm run loadtest -- <students> <seconds> <busy>`: fakes a class against a throwaway server (`tools/load-test.js`) and reports request times, hand/handout delays, Wi-Fi traffic, CPU and memory. Run it after changing the server's live updates.

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
- `server/server.js`: classroom server (Node.js, no dependencies). It uses JSON storage in `data/` and live updates over Server-Sent Events.
  - `broadcast()` is a throttle, not a debounce (a debounce starved in busy classes): updates go out at most 4 times a second. `broadcast('teacher')` updates only the dashboard (status, connect/close, join), `broadcast(studentId)` the dashboard and that student (hand, stars, hints, PRIMM, progress), and `broadcast()` everyone, at most once a second (class view = `sharedState`, turned into JSON once per beat; `meState` per student). The student roster only lists classmates who handed in a program.
  - `save()` is throttled the same way. Static files are sent gzipped with an ETag (`fileCache`).
  - A class holds `LIM.students` (200, or `DOWEE_MAX_STUDENTS`). A request counts as the teacher if it comes from localhost or carries the `dowee_teacher` cookie. Students are identified by a token.
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
  - a block for every Arduino function the interpreter has (`BUILTINS`, `SERIAL`, `STRING_METHODS` in `core-lang.js`), plus Blockly's logic, math, loops and functions. `npm test` builds one program from every Full toolbox block with every dropdown choice (`__doweeBlocks.everyBlock()`), fails if any `BUILTINS`/`SERIAL`/`STRING_METHODS`/`CONSTS` name never appears in its code, and checks the printed answers of the function blocks (`OUTPUT` in `tools/blocks-check.js`). So when you add an interpreter function, add its block too, or the test fails;
  - typed variables (whole number, big whole number = `long`, decimal, true/false, text = `String`) and lists (`list` = int, `flist` = float). Text blocks count letters from 1, like lists;
  - the C language parts too: "any pin" blocks (`dowee_dwrite`, `dowee_dread`, `dowee_aread`, `dowee_awrite`, `dowee_pmode`, `dowee_pulse`, with a `dowee_pin` shadow that sets pinMode for you; a variable pin does not), `dowee_switch`/`dowee_case`/`dowee_case_default` (each case ends with break; numbers or one letter), `dowee_do_while`, `logic_ternary`, `dowee_bitop`/`dowee_bitnot` (orders SHIFT/BAND/BXOR/BOR), and "and" inside "or" is bracketed. Every text example has a block version (`pidBlocks()` builds the PID one with the generic `B()`/`seq()` helpers in `blocks-content.js`);
  - Beginner/Full toolbox;
  - 26 examples. Every text example has a complete block translation (`FULL` and `pidBlocks()` in `blocks-content.js`: meterfull, bang, pid, print, turn, blink, avoidfull, sumo full, rcfull for race and soccer), and `SAME` in `tools/blocks-check.js` runs each next to its text sample and requires the same end position (within 3 cm), Serial output and result. The short starters are marked "(simple)". Plus `lab/commands`, which reads typed Serial commands with the text blocks;
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
- **One way to read the line**, everywhere (sample, PID lessons, Advanced PID, blocks): the shared fragments `LINE_GLOBALS`, `CALIBRATE_FN` and `READLINE_FN` in `src/examples.js` (exported, and used by `lessons.js`, `advanced-pid.js` and `blocks.js`). Change them there, not in copies.
  - `calibrate()` sweeps for 2 s, keeps each sensor's white (`minV`) and black (`maxV`), then `threshold = (avgWhite + avgBlack) / 2`: one threshold, halfway between the average white and the average black (the teacher's method). It prints `white … black … threshold …`.
  - `readLine()` sets `onLine[i]` (reading above the threshold), `seen` and `position` (the average of `i + 1` over the sensors that see the line: 1 far left, 3 middle, 5 far right; it keeps the last position when the line is lost). `error = position - 3` (−2…+2).
  - Simple programs (the 2-sensor follower, the Line follower template, the "black or white?" bug) use a fixed `int threshold = 500`.
- The PID sample (`EXAMPLES.line.pid`) is kept short on purpose (the teacher asked): calibrate, then `loop()` is readLine, `error = position - 3`, the PID (Kp 70, Ki 0, Kd 1000, baseSpeed 240) and `delay(10)` for a steady sample time. No start button. A crossing averages to 3, so it drives straight. A lost line needs the teacher's lost-line search (`lostSide` from the edge sensors, then spin on the spot at `turnSpeed` 140 until a middle sensor sees the line): without it the Sharp turns track can't be lapped. The spin speed matters: 170 spins past the line (4 of 9 robots finish), 140 gets all 9 (Ideal, Realistic and Competition day, 16–24 s). `npm test` and `tools/sweep.js` include the Sharp turns track so this can't break quietly again. `calibrate()` uses a `sweep(left, right, ms)` helper.
- "How the PID formula works" (`PID_EXPLAIN` in `src/lessons.js`): a fold-out explainer shown in the lesson pane of every PID and Advanced PID lesson (any lesson with an `explain` field): the error from the sensors, P/I/D, from turn to wheels, four loops worked out with the sample's numbers, and the tuning order. The PID sample has the same summary as a comment above `loop()`. If you change the sample's gains, update the worked example.
- PID path (`PID_LESSONS` in `src/lessons.js`, inserted after "follow"; the ids stay pid1, pid2, pid3, pid): PID 1 calibrate (TODO: min/max and the threshold), PID 2 where is the line (TODO: `readLine()`), PID 3 P (Kp 15), PID 4 D and race; every loop ends with `delay(10)`. Goals: lap the Oval (and calibrated, read with `globalOf`), lap the Oval, Oval under 17 s, Snake under 12 s. Each step's goal is out of reach for the step before (`PID_FIX` in `tools/check.js`). Lessons start straight away (no start button).
- Advanced PID (`src/advanced-pid.js`, after `lessons.js` in the build), on the same method (`PID_GLOBALS`, `PID_SETUP`):
  - apid1: worksheet with blank boxes (`PIDI_FULL` with `{{n}}`, `PID_BLANKS`, `canonAnswer`): threshold, on/off, counting, the position, the error, I with `constrain`, the PID formula, the wheels, `lastError`. Goal: Snake under 14 s;
  - apid2: the same blanks as `____` in the editor (the compiler says "This line still has a blank");
  - apid3: a guided build with 5 live checkpoints (`PIDI_GUIDE`) that read the student's globals with `globalOf`. Step 4 lends a Dowee with a 30% weaker right motor (`S.lessonRobot`): with Kp ≤ 20, I (Ki 1, limit `iLimit` 40) takes the wobble from 16 mm to 3 mm; a strong I without the limit winds up;
  - apid4 "Shades of grey" (`PIDI_GREY`): the analog extra. Weighting each sensor by how dark it is (`map` between `minV` and `maxV`) instead of on/off: at baseSpeed 220 the Oval wobble drops from 5–6 mm to 3 mm (goal: under 4 mm at 220 or more).
- Blocks use the same code (the PID block sample is as short as the text one): "calibrate the line sensors" (`dowee_calibrate` → `CALIBRATE_FN`), "line position (1 to 5)", "how many sensors see the line", "sensor N is on the line", and "read the line sensors" (`readLine()`). With a "read the line sensors" block in the program (`g.manualRead`), the value blocks give the last read (`position`, `seen`, `onLine[]`), like text code; without it they read the sensors themselves (`linePosition()`, `sensorsOnLine()`). "sensor N sees black" compares with `threshold`. The PID block sample uses them and matches the text by printout, laps and lap time (within 5%): on/off sensors make a fast PID too sensitive to timing for a strict path comparison.
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
