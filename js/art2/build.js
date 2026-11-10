// The game's art: every sprite, drawn in code at load. Assembles the families in this folder into
// the one object the world and renderer read, then packs the frames into texture atlases.
//
//   creatures   A.cat, A.gazelle, ... = { w, h, ox, oy, <set>: [frames] }
//   hunters     A.hunter[v] = { ox, oy, torch, torchAt, d: { <set> }, n: { <set> } }
//   props       A.props[kind][variant] = { img, frames?, ox, oy, shadow, shade, solid, ... }
//   landmarks   A.landmarks[type] = same as a prop
//   tall grass  A.tallgrass = { ox, oy, clumps: [[7 frames ordered by lean]] }
//   items       A.carcass, A.carcassBones, A.smallCarcass, A.spearStuck = { img, frames?, ox, oy }
//   icons       A.icons[name] = data URL
import { packAtlases } from '../art.js';
import * as cat from './cat.js';
import * as predators from './predators.js';
import * as hoofed from './hoofed.js';
import * as birds from './birds.js';
import * as human from './human.js';
import * as acacia from './acacia.js';
import * as trees from './trees.js';
import * as plants from './plants.js';
import * as rocks from './rocks.js';
import * as landmarks from './landmarks.js';

export function buildArt() {
  const A = { props: {} };
  for (const mod of [cat, predators, hoofed, birds, human, acacia, trees, plants, rocks, landmarks]) {
    const part = mod.build();
    for (const k of Object.keys(part)) {
      if (k === 'props') Object.assign(A.props, part.props);
      else A[k] = part[k];
    }
  }
  A.iconCanvas = A.icons;
  A.icons = Object.fromEntries(Object.entries(A.icons).map(([k, c]) => [k, c.toDataURL()]));
  delete A.iconCanvas;
  packAtlases(A);
  return A;
}
