// Palette for the redrawn sprites: the game's palette plus the extra steps the new shading needs
// (a deep shadow and a highlight at the ends of most ramps, and hue-tinted outline colors).
// Colors are registered in ramps, dark to light, so shading passes can shift a pixel one step
// up or down its own ramp instead of painting a second flat shape over it.
import { P } from '../palette.js';

export const P2 = {
  ...P,
  // creatures
  furD: '#5c3814', fur5: '#fff3d6',
  gazD: '#6a4020', gaz3: '#e6b878',
  dogD: '#33291f', dog4: '#d8c8ac',
  hareD: '#4c3d2e', hare3: '#d4c4aa',
  lionD: '#74501e', lion3: '#f0d096', maneD: '#452811', mane1: '#8a5628',
  sandD: '#96683c',
  mudD: '#36281a',
  wartD: '#3e2f25', wart2: '#9a8068',
  zebG: '#b8b1a3', zebD: '#8f897e', zeb2: '#3a3532',
  ostD: '#120e0d', ost3: '#3a302b', ostP: '#c08a70', ostW: '#fffaf0',
  fowlD: '#1a2029', flamD: '#b04e5c', flam2: '#fbd0cc',
  crocD: '#1f3320', croc0: '#2f4a26', croc1: '#44632f', croc2: '#5f7d3c', croc3: '#86a052', crocB: '#c9c690',
  skinD: '#33190f', skin4: '#c08c62',
  hideD: '#4a3019', hide2: '#b08a56',
  ochreD: '#8e3a1e', ochre1: '#dc7444',
  boneD: '#8a806c', bone1: '#f7f2e4',
  // flora and ground
  leafD: '#1c3020', leaf4: '#93b058',
  lushD: '#46532a', lush3: '#aab452',
  palmD: '#1d3f20', palm3: '#7ab656',
  barkD: '#26180f', bark3: '#9a7448', bark4: '#b8946a',
  thornD: '#34351f', thorn2: '#84804a',
  tallD: '#6a521e',
  feverD: '#6e7a2e', fever2: '#dfe07e',
  rockD: '#342e2b', rock5: '#e4dccf',
  clayD: '#7a4229', clay3: '#e2a678',
  duneD: '#843f1c', dune4: '#f6c996',
  basaltD: '#121011', basalt4: '#5f5a5a',
  ashD: '#231f1d',
  saltD: '#a69d8a',
  // fx
  bloodD: '#5e1210', fireD: '#c8360f', emberD: '#7a2410',
  // outlines: the ink, tinted toward what it surrounds
  olFur: '#2a180c', olLeaf: '#14201a', olRock: '#211c1a', olBone: '#3a3226', olSkin: '#1f100a', olWater: '#0a2330',
};

export const RAMPS = {};
const def = (name, keys, ol = 'ink') => { RAMPS[name] = { keys, ol }; return keys; };

def('fur', ['furD', 'fur0', 'fur1', 'fur2', 'fur3', 'fur4', 'fur5'], 'olFur');
def('gaz', ['gazD', 'gaz0', 'gaz1', 'gaz2', 'gaz3', 'gazW'], 'olFur');
def('gold', ['gaz0', 'gold0', 'gold1', 'gold2', 'bone1'], 'olFur');
def('dog', ['dogD', 'dog0', 'dog1', 'dog2', 'dog3', 'dog4'], 'olRock');
def('hare', ['hareD', 'hare0', 'hare1', 'hare2', 'hare3'], 'olRock');
def('lion', ['lionD', 'lion0', 'lion1', 'lion2', 'lion3'], 'olFur');
def('mane', ['maneD', 'mane', 'mane1'], 'olFur');
def('sand', ['sandD', 'sand0', 'sand1', 'sand2', 'sand3'], 'olFur');
def('mud', ['mudD', 'mud0', 'mud1', 'mud2'], 'olFur');
def('wart', ['wartD', 'wart0', 'wart1', 'wart2'], 'olRock');
def('zebW', ['zebD', 'zebG', 'zeb1', 'ostW'], 'olRock');
def('zebB', ['zeb0', 'zeb2'], 'ink');
def('ost', ['ostD', 'ost0', 'ost3'], 'ink');
def('ostSkin', ['ostP', 'ost2', 'flam2'], 'olSkin');
def('fowl', ['fowlD', 'fowl0', 'fowl1', 'fowl2'], 'ink');
def('flam', ['flamD', 'flam0', 'flam1', 'flam2'], 'olSkin');
def('croc', ['crocD', 'croc0', 'croc1', 'croc2', 'croc3'], 'olLeaf');
def('skin', ['skinD', 'skin0', 'skin1', 'skin2', 'skin3', 'skin4'], 'olSkin');
def('hide', ['hideD', 'hide0', 'hide1', 'hide2'], 'olFur');
def('ochre', ['ochreD', 'ochre', 'ochre1'], 'olSkin');
def('bone', ['boneD', 'bone0', 'bone', 'bone1'], 'olBone');
def('leaf', ['leafD', 'leaf0', 'leaf1', 'leaf2', 'leaf3', 'leaf4'], 'olLeaf');
def('lush', ['lushD', 'lush0', 'lush1', 'lush2', 'lush3'], 'olLeaf');
def('palm', ['palmD', 'palm0', 'palm1', 'palm2', 'palm3'], 'olLeaf');
def('bark', ['barkD', 'bark0', 'bark1', 'bark2', 'bark3', 'bark4'], 'olFur');
def('thorn', ['thornD', 'thorn0', 'thorn1', 'thorn2'], 'olLeaf');
def('tall', ['tallD', 'tall0', 'tall1', 'tall2', 'tall3'], 'olFur');
def('fever', ['feverD', 'fever0', 'fever1', 'fever2'], 'olLeaf');
def('rock', ['rockD', 'rock0', 'rock1', 'rock2', 'rock3', 'rock4', 'rock5'], 'olRock');
def('clay', ['clayD', 'clay0', 'clay1', 'clay2', 'clay3'], 'olFur');
def('dune', ['duneD', 'dune0', 'dune1', 'dune2', 'dune3', 'dune4'], 'olFur');
def('basalt', ['basaltD', 'basalt0', 'basalt1', 'basalt2', 'basalt3', 'basalt4'], 'ink');
def('ash', ['ashD', 'ash0', 'ash1', 'ash2', 'ash3'], 'ink');
def('salt', ['saltD', 'salt0', 'salt1', 'salt2', 'salt3'], 'olBone');
def('water', ['deep0', 'deep1', 'water0', 'water1', 'water2', 'foam'], 'olWater');
def('blood', ['bloodD', 'blood', 'blood1'], 'ink');
def('fire', ['emberD', 'fireD', 'fire0', 'fire1', 'fire2'], 'emberD');

// A module can add its own colors and ramps (call before drawing).
export function addColors(map) { Object.assign(P2, map); }
export function addRamp(name, keys, ol = 'ink') { def(name, keys, ol); rampVersion++; return keys; }
export let rampVersion = 0;
