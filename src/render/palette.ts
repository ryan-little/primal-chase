// The game's color language. One place, so terrain, water, sky, UI and the
// debug tools stay in the same gouache-savannah register.

import { Color } from 'three';

/** Ground colors per V1 terrain id (linear-space THREE Colors). */
export const TERRAIN_COLORS: Record<string, Color> = Object.fromEntries(
  Object.entries({
    watering_hole: 0x3a6c80, seasonal_stream: 0x4f837a, reed_bed: 0x5f7742,
    dried_marsh: 0x7d7a52, dry_riverbed: 0xa08a62, sandy_wash: 0xd4b483,
    open_plain: 0xb59a53, tall_grass: 0xa8913f, salt_flat: 0xdcd7c4,
    red_dunes: 0xc27a4a, clay_pan: 0xbfa070, dry_lake_bed: 0xc9bda0,
    burned_ground: 0x5c4d3f, ash_field: 0x7a7066, elephant_path: 0xa88a5c,
    acacia_grove: 0x7e8449, mopane_woodland: 0x6f7a45, bamboo_grove: 0x6d8a4c,
    fallen_tree_grove: 0x7a6f4c, thorn_thicket: 0x8a7c4a, fever_trees: 0x9aa257,
    rocky_outcrop: 0x7d7166, granite_plateau: 0x8d8378, volcanic_rock: 0x5e564e,
    sandstone_arches: 0xb07a52, whistling_caves: 0x6a5f57, ridge_line: 0x91826d,
    dry_ravine: 0x8a7355, kopje: 0x877a6b, baobab: 0x9a8455,
    overhang_cave: 0x6f645a, termite_cathedral: 0xa87c52
  }).map(([id, hex]) => [id, new Color(hex).convertSRGBToLinear()])
);

export const ROCK_COLOR = new Color(0x6f645c).convertSRGBToLinear();
export const WATER_SHALLOW = new Color(0x3d7a8a).convertSRGBToLinear();
export const WATER_DEEP = new Color(0x14384a).convertSRGBToLinear();

/** Sky/light keyframes by sun elevation phase (interpolated in sky.ts). */
export interface SkyStop {
  /** Sun elevation in [-1, 1] this stop anchors at. */
  at: number;
  top: number; horizon: number; sun: number; fog: number;
  ambient: number; sunIntensity: number;
}

export const SKY_STOPS: SkyStop[] = [
  { at: -0.3,  top: 0x070b16, horizon: 0x14203a, sun: 0xbcd2f2, fog: 0x0d1524, ambient: 1.0,  sunIntensity: 1.9 },
  { at: -0.12, top: 0x1a2340, horizon: 0x6d4a52, sun: 0xffc890, fog: 0x2c2436, ambient: 1.4,  sunIntensity: 1.9 },
  { at: 0.0,   top: 0x2e3f66, horizon: 0xd97a3e, sun: 0xffb060, fog: 0x8a5a3a, ambient: 1.6,  sunIntensity: 2.6 },
  { at: 0.18,  top: 0x4a7fb8, horizon: 0xe8c89a, sun: 0xfff0d0, fog: 0xd2bc94, ambient: 2.1,  sunIntensity: 3.8 },
  { at: 0.6,   top: 0x5b93cf, horizon: 0xd9c39a, sun: 0xfff4d8, fog: 0xd6c2a0, ambient: 2.3,  sunIntensity: 4.4 }
];
