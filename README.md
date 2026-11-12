# DOWEE

A beginner robot online simulation app for learning and teaching beginner robot concepts: line follower, sumo, RC and soccer robots.

**RoboBench** is the simulator: a browser app for teaching robotics with Arduino. Students program **Dowee**, a standard class robot, in real Arduino C or with drag-and-drop blocks. Then they test it on virtual arenas and tune it the way they would tune a real robot.

## Dowee, the class robot

Arduino Uno, L298N motor driver, 2 × TT gear motors (65 mm wheels), 5-channel IR line array (TCRT5000) on A0–A4, HC-SR04 ultrasonic on pins 11/12, HC-05 Bluetooth on pins 0/1, 2 × 18650 cells. 18 × 16 cm, 650 g.

The example programs also run on a real Dowee wired as shown in the Wiring tab.

## Features

- **Arenas:** line following (4 tracks, plus tracks students draw), RC race, robot soccer, sumo, obstacle room and a measuring lab.
- **Arduino interpreter** that behaves like an Uno: 16-bit `int`, 8-bit PWM, PWM only on pins 3/5/6/9/10/11, real `analogRead`/Serial timing, `pulseIn` for the HC-SR04. Errors and tips are written for kids.
- **Blocks mode** (Blockly) that writes real Arduino code, with a "Turn into code" button.
- **Real physics, by default:** even the perfect **Ideal robot** moves like a real one. Motors need about 60 PWM and a kick to start, and take a moment to spin up. The battery dips under load, the IR reading depends on sensor height, and the ultrasonic can't see walls hit at a steep slant. The same code gives the same result every run.
- **Realistic world and Competition day:** each student gets their own Dowee unit with motor, sensor and mounting quirks, plus floor and tape variation, room light, sensor noise, missed echoes, Bluetooth delay and a battery that runs down.
- **A tidy workspace:** the lesson's steps sit beside the code, and the drawer under the arena has four tabs: **Serial** (monitor and plotter), **Robot** (live sensors and pins, wiring), **Tune** and **Class**. World, speed, trail, sensor view and sound live in one **View** menu. On a phone, a bar at the bottom switches between Code, Arena and Lesson. New students get a short tour, and the **?** button replays it.
- **Tuning tools:** Serial monitor and plotter, live sensor and pin view, sliders for global variables while the robot runs, and an experiment log.
- **A Lessons page** with a learning path: levels from Start here to Sumo, a "Next" badge on the lesson to do next, progress on every card, and each playground's missions. Every lesson follows **PRIMM** (Predict, Run, Investigate, Modify, Make; Sentance and Waite, Raspberry Pi Foundation). Students guess what the program will do before the first run (any guess unlocks **Upload & run**), answer "what does this part do?" questions, make small changes that tick themselves off while the robot drives, and then reach the lesson's goal.
- **Lessons**, from "Blink the LED" to sumo and soccer, including a four-step **PID path** where students write a PID line follower themselves (where is the line → P → D → calibrate and race), and three **Advanced PID** lessons with the I part: fill in the blanks on a worksheet, fill in the blanks in the editor, and a guided build whose checkpoints tick themselves off, plus ten **Fix the bug** challenges (a swapped motor, `=` instead of `==`, a missing `pinMode`, and so on).
- **Templates and missions:** every playground has a template to start from (Guided with TODO steps, or Blank) and three missions that earn stars. A **Hint** button reveals hints one at a time, from a nudge to a code snippet.
- **Class features** (when published as a claude.ai artifact): teams, program submissions, leaderboards, class battles and a teacher's challenge.

## Run a classroom

The teacher's laptop hosts the class. Students only need a browser on the same Wi-Fi: no installs, no accounts and no internet.

1. Install [Node.js](https://nodejs.org) 18 or newer on the teacher's laptop.
2. In this folder, run:

   ```bash
   npm start
   ```

3. The **teacher dashboard** opens at `http://localhost:8080/teacher`. Press **Show join screen** to put a big QR code and link on the projector.
4. Students scan the QR code or type the link, enter their name and join.

Each class is about one robot. When you make a class you pick its **robot type**, and students only see that robot's playgrounds (plus the Test lab for calibrating). You always see every playground.

| Robot type | Playgrounds for students |
| --- | --- |
| Line follower | Line following, Test lab |
| Sumo robot | Sumo, Test lab |
| RC robot | RC race, Robot soccer, Test lab |
| Obstacle avoider | Obstacle room, Test lab |
| Everything (free play) | All six |

Students start on the **Meet Dowee** page: a numbered picture of the robot and its parts, with the parts that matter for the class highlighted.

In a class, students write their own programs. Each playground opens with the class's **template** (Guided or Blank, your choice), and built-in lessons start from a version with TODO steps. The finished sample programs stay hidden until you **unlock** one for the class or **send** it. When the app is used on its own, without a class, every sample is available.

On the dashboard the teacher can:

- **Live class:** see who is online, what each student is working on and which PRIMM part they are on (for example "Modify, 3 of 5 parts"), whether their program is running or crashed, and raised hands. Click a name to see every plan activity for that student and whether their prediction was right. Each student's **⋯** menu has Message, Send code, Merge (when one student joined twice under the same name) and Remove. Post a class announcement or send code to everyone. Once students are in, the QR card folds into a **Join** pill in the header.
- **Lesson plan:** build a list of activities from the built-in lessons or your own. Each activity has an arena, a track or opponent, a world (Ideal robot, Realistic world or Competition day), a starter program and an automatic goal, such as "lap under 15 s" or "stop at 100 cm". Drag the cards (or use ↑ ↓) to change the order. **Add from the lessons path** shows the same levels your students see, and adds a lesson in one click. **Lock** keeps every student on one activity. Under **Sample programs** you unlock or send the finished samples.
- **Results:** a student × activity grid that ticks itself off as goals are reached (and shows how many lesson parts are done before that), mission stars, hints used, predictions that were right, leaderboards, and a CSV download for your gradebook.
- **Battles:** pick two students' handed-in sumo or soccer programs and run the match on the projector. Results go to the class leaderboard.
- **Settings:** the class's robot type, Guided or Blank templates, whether students can use hints, several classes (sections), a class PIN, whether students can open classmates' code, and a private link for using the dashboard from your phone.

Class data is saved on the laptop in `data/dowee-classroom.json`. Use `npm start -- --port 9000` to pick another port, or `--data <folder>` to store data elsewhere.

## Run it alone

Open `app/index.html` in a browser (keep `app/styles.css` next to it). It works offline, for one student, without classroom features. Blocks mode then loads Blockly from the jsDelivr CDN.

## Develop

```bash
npm run build                 # rebuilds app/ (index.html + styles.css) and server/public/meta.json from src/
node tools/test.js line       # runs headless simulations (line, sumo, maze, race, soccer, lab, straight)
node tools/sweep.js real '[[0.08,1.5,150]]'   # tries PID settings (Kp, Kd, speed) across robot units
```

Set `LV=ideal|real|tough` before `node tools/test.js` to choose the realism level.

### Source layout

| File | What it holds |
| --- | --- |
| `src/core-lang.js` | Arduino C tokenizer, parser and compiler |
| `src/core-sim.js` | Board runtime, Dowee physics, realism model, collisions, AI opponents |
| `src/core-arenas.js` | Arenas, floors, rules and scoring |
| `src/examples.js` | Example Arduino programs |
| `src/templates.js` | Student templates, missions and hints for each playground |
| `src/challenges.js` | Fix-the-bug challenges |
| `src/lessons.js` | Lessons |
| `src/advanced-pid.js` | Advanced PID lessons: worksheet, in-editor blanks, guided build |
| `src/primm.js` | Predict / Investigate / Modify parts of every lesson, and the levels of the Lessons page |
| `src/goals.js` | Goal types teachers can attach to activities |
| `src/ui.js` | Interface: editor, drawing, panels, blocks mode, artifact class features |
| `src/host.js` | Classroom mode: joining, activities, progress, hand-raising, handouts |
| `src/styles.css` | All the simulator's styles |
| `src/page-head.html`, `src/page-body.html` | Page head and markup (no styling) |
| `server/server.js` | Classroom server for the teacher's laptop (Node.js, no dependencies) |
| `server/public/teacher.html`, `teacher.css`, `teacher.js` | Teacher dashboard: markup, styles, behaviour |
| `server/public/vendor/` | Bundled Blockly and QR code libraries (see THIRD_PARTY_NOTICES.md) |
