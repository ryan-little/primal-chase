// ============================================================
// NARRATIVE.JS — the long-form prose, shared by both builds
// Lifted verbatim from V1's ui.js so the 3D game reads in exactly
// the same voice. Namespaced under NARRATIVE so it can coexist
// with the classic build's own copies if they are ever loaded together.
// ============================================================

const NARRATIVE = {
  /** Three openings, rolled at the start of a run. */
  intros: [
  [
    "You stand at the crest of a ridge, the savanna golden and endless beneath you. The air is still. The land is yours.",
    "But today, something is different. On the far horizon, where the heat bends the light — shapes. Upright. Moving.",
    "They do not run. They do not crouch or stalk. They just walk. Steady. Patient. Toward you.",
    "Something deeper than thought tells you what this means. Something old. Something the body knows before the mind can name it.",
    "You turn. You run. The chase begins."
  ],
  [
    "The morning is warm and the grass is high and the world belongs to you. You have eaten well. You are strong.",
    "Then the wind shifts. A scent — strange, sharp, wrong. And beneath it, the faintest vibration in the earth. Footsteps. Many of them.",
    "You see them now. Distant figures, moving in a line across the open plain. They carry no fear. They carry no hurry.",
    "Every instinct screams at once. Not to fight. Not to hide. To run. To run and never stop.",
    "The savanna stretches ahead. You choose distance. The chase begins."
  ],
  [
    "Dawn breaks over the thornwood and you drink from a still pool, unhurried. Nothing here can threaten you. You are the reason other creatures run.",
    "A bird screams. Then another. The acacia grove goes silent in a wave, spreading outward from a point behind you.",
    "You turn and see them. Small against the vastness, but unmistakable. Walking. Two legs. Steady as the sun's arc.",
    "You have never seen anything walk toward you like that. Without hesitation. Without fear. The wrongness of it settles in your chest like a stone.",
    "You do not understand what is happening. But your legs do. The chase begins."
  ]
],

  /** One of these is chosen when the run ends, keyed by cause. */
  deaths: {
  caught: [
    "The rhythm of the footfalls has finally stopped. Not yours—theirs. You turn, and they are there. Closer than they have ever been. The lead hunter's eyes meet yours, and you see something unexpected: respect. Perhaps even sorrow. They have run you down across impossible distance, through days that blurred into agony. And now, at the end, there is only stillness. The chase is over.",

    "You stumble. It is not exhaustion—not quite. It is inevitability. Behind you, the footsteps slow but do not stop. They close the final distance with the patience they have shown from the beginning. You could fight, but your body will not answer. You have run farther than any of your kind has ever run. And it was not enough. The hunters stand over you now. The chase ends not with violence, but with certainty.",

    "The shadow you have carried for days finally overtakes you. You feel them before you see them—a presence that has become part of the landscape, part of your breath. When you turn, they are already there. Not triumphant. Not cruel. Simply there, as inevitable as the sun. You have led them across the world, and they have followed. Now the following is done."
  ],

  heatstroke: [
    "The world shimmers and fades into a blinding white. The heat has been building for hours—days, maybe. You cannot remember when it became unbearable. Your legs fold beneath you, and the ground rushes up, scorching. The sky is too bright. Everything is too bright. In the distance, through the haze, you see the shapes of the hunters. Still walking. Still following. They will find you here, but by then, the sun will have already claimed you.",

    "You no longer feel the heat. That should worry you, but you cannot remember why. The savanna tilts and blurs, and you realize you are on the ground. The earth beneath you radiates warmth like a living thing. Above, the sun is a white void that has swallowed the sky. You try to rise, but your body no longer obeys. Somewhere behind you, the hunters continue their steady approach. They do not need to hurry. The sun has done their work for them.",

    "The heat becomes a sound—a high, ringing whine that drowns out everything else. Your vision narrows to a white tunnel, and at the end of it, nothing. You collapse, and the dust rises around you in slow motion. The ground is like a furnace, but you can barely feel it. The last thing you see, before the white takes everything, is the distant line of the hunters. They are still coming. They will find only bones."
  ],

  exhaustion: [
    "Your legs simply stop. There is no warning, no gradual fade. One moment you are running, and the next you are kneeling in the dust, muscles locked in total refusal. You have asked too much of this body for too long. It has carried you farther than it was ever meant to go, and now it is done. You try to command it to rise, but nothing happens. Behind you, the footsteps grow louder. The hunters have won not through speed, but through endurance. And you have none left.",

    "The collapse comes in stages. First your legs lose their strength, turning to water beneath you. Then your vision dims at the edges, a creeping shadow that no amount of will can push back. You fall forward, catching yourself on trembling forelegs. One more step. Just one. But your body will not give it. You have run until there was nothing left to run on. The hunters are close now—you can hear their breathing. You wonder, distantly, if they feel what you feel. If they, too, are empty. But they are still standing. And you are not.",

    "Your muscles seize all at once, a full-body cramp that drops you like a stone. You lie in the dust, lungs heaving, unable to move. Every fiber of your being has been used, wrung out, consumed. The world narrows to the patch of earth in front of your eyes and the sound of your own ragged breathing. The hunters' footsteps are close now—rhythmic, relentless, unbothered by the heat or the distance or the days. They will reach you soon. You try to rise one last time. Your body does not even respond."
  ],

  dehydration: [
    "Your tongue is a useless slab of leather. Your throat has closed to a pinprick. The world tilts and sways, and you realize the ground is rushing up to meet you. There is no saliva left, no moisture in your mouth, no tears in your eyes. You are dust, held together by will alone, and now even the will is evaporating. The hunters are coming, but they seem distant, unreal. Everything is distant. The only thing that feels real is the terrible, burning thirst—and then, mercifully, even that fades.",

    "You can no longer swallow. Your body has shut down everything that is not essential, and even the essential systems are failing now. You stumble, fall, rise, stumble again. Each time it takes longer to stand. The savanna shimmers with phantom water—pools and rivers that vanish when you approach. You know they are not real, but you stagger toward them anyway. Behind you, the hunters follow. They have water. You can smell it on the wind. But they will not share. They will only wait for you to fall one final time.",

    "The cracked earth mirrors the cracked lining of your throat. You have not drunk in days—or is it hours? Time has become meaningless, measured only in the desperate need for water. Your body is shutting down, conserving what little moisture remains. Your vision blurs and doubles. You collapse, and the world tilts sideways. The hunters are there, at the edge of your fading sight. They carry water skins. You can see them. They will drink when you are gone. The irony is almost enough to make you laugh. Almost."
  ],

  starvation: [
    "The hunger has become something beyond hunger. It is a hollowness that has consumed everything—thought, will, identity. You are an empty skin stretched over bones, moving out of habit rather than purpose. When you finally collapse, it is almost a relief. The ground is cool. The sky is distant. The hunters are coming, but it does not matter anymore. You have been eating yourself from the inside for days, and there is nothing left to consume.",

    "Your body has been burning itself for fuel. First the fat, then the muscle. Now there is nothing left but bone and the thin membrane of will that holds you upright. And even that is failing. You sway, stumble, crash into the earth. You try to rise, but your legs will not support your weight—there is no weight left to support. You are hollow. A husk. The hunters will find you here, light enough for the wind to carry away.",

    "The gnawing emptiness has spread from your belly to your entire being. You are a void, collapsing in on yourself. Each step is a negotiation with a body that has already given up. When you fall, you fall slowly, almost gracefully. The earth receives you like an old friend. Above, the sky is a pale expanse. Behind, the hunters approach. But you are already gone, consumed by your own hunger long before they arrive."
  ]
}
};

if (typeof window !== 'undefined') window.NARRATIVE = NARRATIVE;
