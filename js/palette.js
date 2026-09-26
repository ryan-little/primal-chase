// One palette for the whole game so every procedurally drawn asset reads as a set.
// Warm savanna earths, cool teal shadows, a single hot accent for danger.

export const P = {
  ink: '#1a110c',
  inkSoft: '#2b1d15',

  // grass ramp (dry gold -> green-gold)
  grass0: '#8c7a3a', grass1: '#a8903f', grass2: '#c2a64a', grass3: '#d7bd62', grass4: '#e6d282',
  lush0: '#5f6e2e', lush1: '#76843a', lush2: '#909a45',
  tall0: '#8a6e2a', tall1: '#b08a36', tall2: '#cfa847', tall3: '#e7c768',

  // earth
  sand0: '#b98a55', sand1: '#cfa36b', sand2: '#e0bb84', sand3: '#ecd2a2',
  clay0: '#9c5b3a', clay1: '#b8714a', clay2: '#cf8a5c',
  mud0: '#4f3b27', mud1: '#65492e', mud2: '#7a5a38',
  rock0: '#4d4540', rock1: '#6c625a', rock2: '#8d8177', rock3: '#b0a497', rock4: '#cfc4b5',

  // water
  deep0: '#12394a', deep1: '#1a4d5e', water0: '#23667a', water1: '#2f8295', water2: '#4aa3ad', foam: '#bfe3de',

  // flora
  leaf0: '#2f4a26', leaf1: '#3f6030', leaf2: '#56783a', leaf3: '#739447',
  bark0: '#3a2618', bark1: '#5a3b24', bark2: '#7a5434',
  thorn0: '#4a4a2a', thorn1: '#666236',

  // creatures
  fur0: '#8a5a24', fur1: '#b77b2e', fur2: '#d9a24a', fur3: '#ecc27a', fur4: '#f6e2b6', spot: '#3a2414',
  skin0: '#4a2c1c', skin1: '#6b4029', skin2: '#8a5a3c', skin3: '#a8744f',
  hide0: '#6e4a2c', hide1: '#8f6a3e', paint: '#d8d0c0', ochre: '#c2562e',
  gaz0: '#8e5a2c', gaz1: '#b8783c', gaz2: '#d49a58', gazW: '#f0e6d2',
  dog0: '#4e4034', dog1: '#6e5c48', dog2: '#8e7a62', dog3: '#b9a68a',
  hare0: '#6e5a44', hare1: '#948066', hare2: '#b8a48a',
  bone: '#e8e0cc', bone0: '#b9ae96',

  // biomes
  ash0: '#34302d', ash1: '#46403b', ash2: '#5a524b', ash3: '#6e665d',
  dune0: '#a95a2a', dune1: '#c47236', dune2: '#da8e52', dune3: '#ebad74',
  salt0: '#c4bba8', salt1: '#d6cebd', salt2: '#e6e0d2', salt3: '#f5f1e6',
  beach0: '#cfb27c', beach1: '#e0c792', beach2: '#ecd8a8', beach3: '#f6e8c6',
  sea0: '#0b2a40', sea1: '#10374f', sea2: '#174861', sea3: '#205b76',
  litter0: '#36331a', litter1: '#474222', litter2: '#5a532b', litter3: '#6f6836',
  basalt0: '#1c1a1b', basalt1: '#292728', basalt2: '#383536', basalt3: '#4a4647',
  palm0: '#2e5a2a', palm1: '#3f7a34', palm2: '#5b9a44', fever0: '#9aa843', fever1: '#c4c95e',
  zeb0: '#1e1b1a', zeb1: '#ece6d6', wart0: '#5a4638', wart1: '#7a6250', ost0: '#231d1a', ost1: '#e9e2d4', ost2: '#d8a58a',
  fowl0: '#2c3440', fowl1: '#5d6b7c', fowl2: '#c3ccd6', lion0: '#9c6a2c', lion1: '#c89648', lion2: '#e2b872', mane: '#6a3f1c',
  gold0: '#b88a1a', gold1: '#e8c040', gold2: '#fff09a', flam0: '#d8707a', flam1: '#f2a2a4',

  // fx
  blood: '#8e1f1a', blood1: '#b5322a', fire0: '#ff6a1a', fire1: '#ffb13b', fire2: '#fff0a0',
  danger: '#ff4a2e', hint: '#ffe08a', cool: '#7fd6e0',
};

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbStr(r, g, b, a = 1) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}
