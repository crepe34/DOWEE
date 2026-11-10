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
- **Realistic world:** each student gets their own Dowee unit with motor, sensor and mounting quirks. There's floor and tape variation, room light, sensor noise, ultrasonic angle limits, Bluetooth latency and a battery that runs down. Levels: Ideal world, Realistic, Competition day.
- **Tuning tools:** Serial monitor and plotter, live sensor and pin view, sliders for global variables while the robot runs, and an experiment log.
- **Lessons**, from "Blink the LED" through PID tuning to sumo and soccer.
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

On the dashboard the teacher can:

- **Live class:** see who is online, what each student is working on, whether their program is running or crashed, and raised hands. Message a student, send code to one student or the whole class, and post a class announcement.
- **Lesson plan:** build a list of activities from the built-in lessons or your own. Each activity has an arena, a track or opponent, a world (Ideal, Realistic or Competition day), a starter program and an automatic goal, such as "lap under 15 s" or "stop at 100 cm". **Lock** keeps every student on one activity.
- **Results:** a student × activity grid that ticks itself off as goals are reached, leaderboards, and a CSV download for your gradebook.
- **Battles:** pick two students' handed-in sumo or soccer programs and run the match on the projector. Results go to the class leaderboard.
- **Settings:** several classes (sections), a class PIN, whether students can open classmates' code, and a private link for using the dashboard from your phone.

Class data is saved on the laptop in `data/dowee-classroom.json`. Use `npm start -- --port 9000` to pick another port, or `--data <folder>` to store data elsewhere.

## Run it alone

Open `robobench.html` in a browser. It is one self-contained file that works offline, for one student, without classroom features. Blocks mode then loads Blockly from the jsDelivr CDN.

## Develop

```bash
npm run build                 # rebuilds robobench.html and server/public/meta.json from src/
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
| `src/lessons.js` | Lessons |
| `src/goals.js` | Goal types teachers can attach to activities |
| `src/ui.js` | Interface: editor, drawing, panels, blocks mode, artifact class features |
| `src/host.js` | Classroom mode: joining, activities, progress, hand-raising, handouts |
| `src/page-head.html`, `src/page-body.html` | Styles and page markup |
| `server/server.js` | Classroom server for the teacher's laptop (Node.js, no dependencies) |
| `server/public/teacher.html`, `teacher.js` | Teacher dashboard |
| `server/public/vendor/` | Bundled Blockly and QR code libraries (see THIRD_PARTY_NOTICES.md) |
