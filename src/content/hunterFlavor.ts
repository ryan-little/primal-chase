// Hunter proximity flavor text, hand-ported verbatim from
// Primal-Chase-Opus/js/hunters.js (Hunters.getHunterFlavorText).
// Bands are matched top-down: first band whose `min` <= distance wins.

export const trackingTexts: string[] = [
  "The hunters have lost your scent. Their confusion echoes across the distance.",
  "You sense their uncertainty. They circle, search, hesitate. But they will not give up.",
  "The pursuit has paused. They move in patterns now, searching for signs. You are a ghost to them, for now.",
  "They have split apart, fanning across the land in widening arcs. Reading the ground for what you left behind.",
  "The lead tracker kneels where you passed, fingers in the dust. He finds nothing. For now, the earth keeps your secret.",
  "Their voices carry on the wind — sharp, questioning. They argue over which direction you went. Let them argue."
];

export interface FlavorBand {
  /** Band applies when hunterDistance >= min (bands checked in order). */
  min: number;
  day: string[];
  night: string[];
}

export const distanceBands: FlavorBand[] = [
  {
    min: 20,
    night: [
      "At night, you can barely sense them. A distant point of firelight, perhaps. Or perhaps nothing.",
      "The darkness hides them well. But you know they are out there, resting as you should be.",
      "They are far behind. Their campfire smoke reaches you on the wind, faint as a memory.",
      "A glow on the far horizon, no larger than a star fallen to earth. They are distant. They are still there.",
      "The night swallows all trace of them. Only the faintest whiff of woodsmoke confirms they exist at all.",
      "So far behind that the dark between you feels almost safe. Almost like solitude."
    ],
    day: [
      "They are distant. A smudge on the horizon that might be dust or heat shimmer.",
      "You can barely sense them, but they are there. Always there.",
      "The hunters are far enough that you could almost forget them. Almost.",
      "If you did not know what to look for, you would miss them entirely. A faint disturbance in the heat haze, nothing more.",
      "The gap is wide. You cannot hear them, cannot smell them. But the knowledge of them sits in your skull like a stone.",
      "Far behind. The land between you is vast and indifferent. But they have crossed vast land before."
    ]
  },
  {
    min: 10,
    night: [
      "You can see their campfire clearly now. Orange light against the dark. They do not rest as deeply as normal prey.",
      "At night they stop, but they are close. You smell the smoke of their fire.",
      "Their fire burns bright enough to see. They are a presence on the edge of every thought.",
      "The fire marks them like a brand in the darkness. You watch it and it does not flicker. Steady as their stride.",
      "Smoke rises from their camp in a thin column, catching the moonlight. They are eating. Resting. Preparing for dawn.",
      "Their fire is a wound in the night — a hot orange eye that does not blink. They are within a hard day's reach."
    ],
    day: [
      "The hunters are a persistent smudge on the horizon. They never break stride.",
      "You can see the dust they raise. It follows you like your own shadow.",
      "They maintain the gap, never gaining, never losing. The patience is unnatural.",
      "When you look back, they are there — small figures that never waver, never sit, never look anywhere but forward.",
      "The column of dust behind them is a constant now, a pillar that connects earth to sky. It has followed you for days.",
      "They move in a line, single file, conserving what they spend. They have done this before. You can tell by the rhythm."
    ]
  },
  {
    min: 5,
    night: [
      "Their campfire is close enough to hear voices. Strange sounds. Laughter, maybe. You do not understand it.",
      "The fire's light reaches you. You can smell meat cooking. They are close.",
      "You watch their fire and wonder what drives them. They should have given up days ago.",
      "Their voices drift on the night air — low, rhythmic. They are chanting something. A song for the kill they believe is coming.",
      "The firelight paints the undersides of the nearest trees orange. You can count the shadows that move around it.",
      "Close enough to hear the crack of a branch fed to flame. They are settling in. Dawn will bring them running."
    ],
    day: [
      "You can see the dust they kick up. Individual figures are visible when you look back.",
      "They are close enough that you recognize their rhythm. The lead hunter moves with purpose.",
      "The gap narrows. You see them when you crest each rise. They see you.",
      "You can make out their shapes now — the tall one at the front, the others fanned behind. They carry sticks that glint.",
      "The lead hunter raises a hand and they slow. Not from fatigue. He is reading the ground. Reading you.",
      "They are close enough that you catch their scent on every shift of wind. Sweat, smoke, and the iron tang of purpose."
    ]
  },
  {
    min: 2,
    night: [
      "Their fire is so close you could reach it in moments. They know this. They wait for dawn.",
      "You can hear them moving in their camp. Sounds of preparation. They will run at first light.",
      "The firelight reaches your hiding place. They are too close. But the night protects you still.",
      "You hear them talking in low tones, unhurried, certain. The sound of creatures that know the end is near.",
      "Their fire throws sparks into the black sky. Each one a brief star that dies at your feet.",
      "So close that when the wind shifts you can smell the ash on their skin. They are sharpening something."
    ],
    day: [
      "You can hear them breathing. The rhythm never breaks. Step after step after step.",
      "They are close enough to see your eyes when you look back. You see theirs. They do not look away.",
      "The distance between you has collapsed to almost nothing. Every movement matters now.",
      "You feel their presence like heat on your back. They are not tired. They should be tired.",
      "The lead one is so close you can see the scars on his arms. He has done this before. Many times.",
      "Their footfalls are a drumbeat behind you, steady and patient. The sound of something that cannot be outrun."
    ]
  },
  {
    min: 0,
    night: [
      "They are close enough to hear your breathing. Only the darkness keeps you apart.",
      "Their fire is within reach. You can see their faces in the light. They are watching for you.",
      "The night is all that stands between you and them. When dawn comes, they will move.",
      "You can hear them breathing in the dark. Slow, even breaths. They are saving their strength for the morning.",
      "One of them coughs. The sound is so close it snaps your head around. The dark is the thinnest of walls.",
      "Their fire is close enough to warm you. The irony is not lost — the warmth of the thing that will end you."
    ],
    day: [
      "They are right there. You can see the whites of their eyes. The lead hunter points at you.",
      "The distance has evaporated. You are no longer fleeing. You are barely staying ahead.",
      "They are close enough to throw. To touch. To kill. But they maintain the chase.",
      "This is the end of distance. They are upon you. Only speed remains.",
      "You can hear the rattle of their weapons. The creak of sinew and bone. They are so close the air between you is shared.",
      "The lead hunter does not run. He walks. He knows. At this distance, your next mistake is your last."
    ]
  }
];
