// Secret places. One may sit in each 1400px cell of the continent, chosen by the land around it.
// Finding one gives something back: an instinct, water, a glimpse of the map, a lesson about them.

import { hash2 } from './util.js';
import { B, G, isWaterType } from './terrain.js';

export const CELL = 1400;

export const SECRETS = {
  painted: {
    name: 'The Painted Cave', biomes: [B.HIGHLAND], reward: 'perk',
    lore: 'Red ochre on the stone. A spotted cat, running. Behind it, three thin figures, and behind them more. Someone watched this happen before, and wanted it remembered.',
    gift: 'An instinct awakens.',
  },
  graveyard: {
    name: 'Where the Great Ones Lie', biomes: [B.SAVANNA, B.DESERT], reward: 'map',
    lore: 'Tusks longer than you. Ribs like the frame of a hut. The old ones come here to die, and the ground is quiet with them. From the rise of the skulls you can see a long way.',
    gift: 'The land around you is revealed.',
  },
  oasis: {
    name: 'The Hidden Spring', biomes: [B.DESERT], reward: 'water',
    lore: 'Palms where nothing should grow. Cold water from under the sand. You drink until your ribs ache.',
    gift: 'Thirst and heat washed away.',
  },
  baobab: {
    name: 'The Old Baobab', biomes: [B.SAVANNA], reward: 'heal',
    lore: 'It was old when the first hunters came. The hollow in its side smells of every animal that ever sheltered there. Your breathing slows.',
    gift: 'Wounds mended. Rest here heals fast.',
  },
  camp: {
    name: 'A Cold Camp', biomes: [B.SAVANNA, B.WOODLAND, B.HIGHLAND, B.WETLAND], reward: 'intel',
    lore: 'Ashes, days old. A shelter of hide, a rack for spears, bones picked clean. They sleep in turns. They sing to keep awake. They are only men.',
    gift: 'For the rest of the day you sense exactly where they are.',
  },
  arch: {
    name: 'The Stone Gate', biomes: [B.DESERT], reward: 'perk',
    lore: 'Wind has worn a door through the red rock. Nothing leaves a mark beneath it. Walk through, and the trail behind you simply stops.',
    gift: 'An instinct awakens. Your trail breaks here.',
  },
  whistle: {
    name: 'The Whistling Caves', biomes: [B.HIGHLAND], reward: 'cool',
    lore: 'The hill breathes through a dozen mouths. Cold air pours out of the dark and sings a low note. Nothing that hunts by sight can see you in here.',
    gift: 'Cold air. Rest here to vanish from their sight.',
  },
  shrine: {
    name: 'The Carved Pole', biomes: [B.WOODLAND, B.WETLAND], reward: 'perk',
    lore: 'A ring of standing stones and a pole carved with faces. Some faces are men. One of them, you think, is you.',
    gift: 'An instinct awakens.',
  },
  whale: {
    name: 'Bones of the Sea', biomes: [B.COAST], reward: 'perk',
    lore: 'The land ends. Beyond it, water with no far side, and on the sand the ribs of something too big to have walked. Even the chase has an edge.',
    gift: 'An instinct awakens.',
  },
  spire: {
    name: 'The Black Glass', biomes: [B.VOLCANIC], reward: 'hide',
    lore: 'Glass the colour of night, still warm inside. The ground here remembers fire. So does your hide, after walking through it.',
    gift: 'Your hide hardens (Scarred Hide).',
  },
};
export const SECRET_IDS = Object.keys(SECRETS);

// Deterministic landmark for one cell, or null.
export function landmarkForCell(T, i, j) {
  const seed = T.seed;
  if (hash2(i, j, seed + 501) > 0.72) return null;
  if (i === 0 && j === 0) return null;
  const x = (i + 0.5) * CELL + (hash2(i, j, seed + 502) - 0.5) * CELL * 0.6;
  const y = (j + 0.5) * CELL + (hash2(i, j, seed + 503) - 0.5) * CELL * 0.6;
  if (Math.hypot(x, y) < 700) return null;
  const g = T.ground(x, y);
  if (isWaterType(g) || g === G.CLIFF) return null;
  // keep the footprint off cliff faces and water
  for (const [dx, dy] of [[-30, 0], [30, 0], [0, -20], [0, 12]]) {
    const gg = T.ground(x + dx, y + dy);
    if (isWaterType(gg) || gg === G.CLIFF) return null;
  }
  const bio = T.biomeAt(x, y);
  const options = SECRET_IDS.filter((id) => SECRETS[id].biomes.includes(bio));
  if (!options.length) return null;
  const type = options[Math.floor(hash2(i, j, seed + 504) * options.length)];
  return { key: `${i},${j}`, type, x: Math.round(x), y: Math.round(y) };
}
