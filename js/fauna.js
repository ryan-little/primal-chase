// Who lives where, and how each of them runs.
import { B } from './terrain.js';

export const SPECIES = {
  gazelle: { meat: 70, score: 150, label: 'GAZELLE', burst: 158, cruise: 96, burstT: 2.2, alert: 1, hit: 15, herd: [3, 6], zig: 1.1, zigT: 0.8, boost: 0.3 },
  hare: { meat: 24, score: 60, label: 'HARE', burst: 150, cruise: 88, burstT: 1.6, alert: 0.7, hit: 12, herd: [1, 1], zig: 2.4, zigT: 0.35, small: true, boost: 0.15 },
  zebra: { meat: 95, score: 200, label: 'ZEBRA', burst: 148, cruise: 112, burstT: 3.2, alert: 1.1, hit: 17, herd: [4, 7], zig: 0.6, zigT: 1.2, kick: true, boost: 0.35 },
  warthog: { meat: 45, score: 120, label: 'WARTHOG', burst: 128, cruise: 92, burstT: 1.4, alert: 0.75, hit: 14, herd: [1, 3], zig: 1.4, zigT: 0.6, charge: true, boost: 0.25 },
  ostrich: { meat: 60, score: 180, label: 'OSTRICH', burst: 190, cruise: 125, burstT: 3.5, alert: 1.35, hit: 15, herd: [1, 3], zig: 0.5, zigT: 1, boost: 0.35 },
  fowl: { meat: 14, score: 40, label: 'GUINEAFOWL', burst: 118, cruise: 70, burstT: 1.2, alert: 0.65, hit: 12, herd: [5, 9], zig: 2, zigT: 0.3, fly: true, small: true, boost: 0.1 },
  hyrax: { meat: 16, score: 50, label: 'HYRAX', burst: 132, cruise: 60, burstT: 1, alert: 0.75, hit: 11, herd: [2, 5], zig: 1.6, zigT: 0.4, small: true, boost: 0.1 },
  flamingo: { meat: 28, score: 80, label: 'FLAMINGO', burst: 112, cruise: 80, burstT: 1.5, alert: 0.9, hit: 13, herd: [5, 10], zig: 0.8, zigT: 1, fly: true, small: true, wader: true, boost: 0.15 },
  golden: { meat: 100, score: 1000, label: 'GOLDEN GAZELLE', burst: 195, cruise: 140, burstT: 4, alert: 1.4, hit: 15, herd: [1, 1], zig: 1.3, zigT: 0.7, boost: 1 },
};

export const BIOME_FAUNA = {
  [B.SAVANNA]: [['gazelle', 3], ['zebra', 2], ['warthog', 1], ['ostrich', 1], ['fowl', 1]],
  [B.WOODLAND]: [['warthog', 2], ['fowl', 3], ['gazelle', 1]],
  [B.WETLAND]: [['flamingo', 3], ['fowl', 2], ['warthog', 1]],
  [B.DESERT]: [['ostrich', 3], ['gazelle', 1]],
  [B.HIGHLAND]: [['hyrax', 3], ['zebra', 1], ['gazelle', 1]],
  [B.VOLCANIC]: [['hyrax', 1]],
  [B.COAST]: [['flamingo', 2], ['fowl', 1], ['ostrich', 1]],
};

export function pickSpecies(biome, r) {
  const list = BIOME_FAUNA[biome] || BIOME_FAUNA[B.SAVANNA];
  const total = list.reduce((s, [, w]) => s + w, 0);
  let k = r() * total;
  for (const [id, w] of list) { if ((k -= w) < 0) return id; }
  return list[0][0];
}
