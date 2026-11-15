'use strict';
// Ready-made seminar plans: built-in lessons and a few activities, each with a short discussion question
// (shown to students as "Talk about it"). Loaded with POST /api/teacher/seminar { name }.
const SEMINAR_PLANS = {
  line: { title: 'Line follower seminar', arena: 'line', activities: [
    { builtin: 'see', discuss: 'White reads a small number and black a big one. Why? What does the sensor really measure?' },
    { builtin: 'pid1', discuss: 'Why not always use 500 as the threshold? What could make white and black read differently?' },
    { builtin: 'follow', discuss: 'Only the left sensor sees the line. What should Dowee do, and why does this follower zig-zag?' },
    { builtin: 'pid2', discuss: 'Sensors 3 and 4 both see the line. Where is it, and what is the error?' },
    { builtin: 'pid3', discuss: 'What should a bigger error do to the steering? What happens if Kp is far too big?' },
    { builtin: 'pid', discuss: 'Why does a fast robot overshoot the line? How could it know it is about to?' },
    { title: 'Sharp corners', arena: 'line', variant: 'sharp', starter: { kind: 'example', example: 'pid' }, goal: { type: 'laps', n: 2 },
      intro: 'In a 90° corner the line can slip out from under all five sensors. The PID sample remembers which edge sensor saw it last and spins on the spot until a middle sensor finds it.',
      steps: ['Run the PID sample on Sharp turns. Watch what Dowee does in each corner.', 'In the Tune tab, set turnSpeed to 220. What goes wrong?', 'Find the fastest turnSpeed that still laps every time.'],
      discuss: 'What should a robot do when the line disappears in a corner?' },
    { builtin: 'apid3', discuss: 'One motor is a bit weaker. What will P and D do about a robot that always drifts to one side?' },
    { builtin: 'apid4', discuss: 'A sensor is half over the line. Is it on or off? What does on/off throw away?' },
    { title: 'Race challenge: Competition day', arena: 'line', variant: 'snake', realism: 'tough', starter: { kind: 'example', example: 'pid' }, goal: { type: 'laps', n: 3 },
      intro: 'Competition day: the floor, the light and your robot are not perfect any more. First make Dowee finish 3 laps without losing the line, then tune for the fastest lap: the best laps go on the class leaderboard. Every Dowee is a little different, so compare your laps with your own first try.',
      steps: ['Run the PID sample. Note your lap time and wobble.', 'Tune Kp, Kd, baseSpeed and turnSpeed in the Tune tab.', 'Press Write values into code when you are happy, then hand in your program.'],
      discuss: 'What will change when the robot and the track are less perfect? What will you tune first?' },
  ] },
};
if (typeof module !== 'undefined') module.exports = { SEMINAR_PLANS };
