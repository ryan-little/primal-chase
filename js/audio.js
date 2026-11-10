// All sound is synthesized: no audio files ship with the game.
//
// Instruments are rendered once into AudioBuffers (Karplus-Strong kora plucks, modal marimba
// and mbira, a djembe/talking-drum kit, footsteps for every ground), then played by a
// sequencer. The score follows the land: each biome has its own theme and groove, night
// thins everything out, and the band's drums swell as they close in until a full chase
// groove with chanting takes over.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const D2 = 38, D3 = 50;

// ---------------- composed material ----------------
// Tunes are written in scale degrees (0 = tonic, 7 = the octave of a seven-note mode, 5 of a
// pentatonic one), so one tune can be sequenced, inverted, moved by register or set in another
// mode. A bar is [[step, degree, lengthInSteps], ...]: twelve-step bars are 12/8 (four beats of
// three), sixteen-step bars 4/4. Chords are semitones above the tonic, voiced at play time; a bar
// may hold several chords, spread evenly across it.
const MODE = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
  minpent: [0, 3, 5, 7, 10], ambassel: [0, 1, 5, 7, 8], // Ethiopian qenet: A Bb D E F
};
function deg(mode, d) { const n = mode.length, o = Math.floor(d / n); return 12 * o + mode[d - o * n]; }
// the degree whose pitch class is nearest below a semitone offset (to move a riff onto a chord)
function degOf(mode, semis) { const p = ((semis % 12) + 12) % 12; let best = 0; for (let i = 0; i < mode.length; i++) if (mode[i] <= p) best = i; return best; }
// the old D minor progression; only the constructor's first, placeholder section refers to it
const PROG = [{ root: 50, tones: [62, 65, 69] }];

// Rhythm sections, by energy layer: shekere (time), bell, dundun (bass drum), djembe, claps.
// Patterns are [step, stroke, velocity] or plain steps.
const KITS = {
  // 12/8: the standard seven-stroke bell, the shekere in eighths, a djembe accompaniment, dundun
  d12: { bell: [0, 2, 4, 5, 7, 9, 11], shek: 'triple', dj: [[0, 'bass', 1], [2, 'tone', 0.6], [3, 'tone', 0.7], [5, 'slap', 0.8], [6, 'bass', 0.8], [8, 'tone', 0.6], [9, 'tone', 0.7], [11, 'slap', 0.8]], dun: [[0, 1], [7, 0.6], [9, 0.7]], ken: [2, 5, 8, 11] },
  // 4/4: a highlife bell, offbeat shaker, djembe and dundun
  d16: { bell: [0, 3, 6, 10, 12], shek: 'off', dj: [[0, 'bass', 1], [2, 'tone', 0.6], [3, 'tone', 0.5], [4, 'slap', 0.8], [6, 'tone', 0.6], [7, 'tone', 0.5], [8, 'bass', 0.8], [10, 'tone', 0.6], [11, 'tone', 0.5], [12, 'slap', 0.8], [14, 'tone', 0.6], [15, 'slap', 0.4]], dun: [[0, 1], [6, 0.7], [10, 0.6]], ken: [4, 12] },
  // Saharan tende: a lopsided low drum under handclaps on two and four
  tende: { shek: 'triple', dun: [[0, 1], [5, 0.55], [6, 0.85], [11, 0.4]], clap: [3, 9], dj: [[2, 'tone', 0.5], [8, 'tone', 0.5], [9, 'slap', 0.5]] },
  // Ethiopian kebero in a rolling six
  kebero: { dun: [[0, 1], [3, 0.55], [5, 0.45], [6, 0.9], [9, 0.55], [11, 0.45]], clap: [6], shek: 'beat', dj: [[2, 'tone', 0.4], [8, 'tone', 0.4]] },
  // an mbira song: hosho in triplets and a soft drum
  hosho: { shek: 'hosho', dun: [[0, 0.8], [6, 0.6]], dj: [[3, 'tone', 0.4], [9, 'tone', 0.4], [11, 'slap', 0.3]], clap: [0, 3, 6, 9] },
  // forest: quick djembe over a kenkeni in quarters
  forest: { bell: [0, 4, 8, 12], shek: 'off', dj: [[0, 'bass', 0.9], [3, 'tone', 0.6], [4, 'slap', 0.7], [6, 'tone', 0.5], [7, 'slap', 0.5], [10, 'tone', 0.6], [12, 'slap', 0.7], [14, 'tone', 0.5]], dun: [[0, 0.9], [7, 0.5], [10, 0.6]], ken: [0, 4, 8, 12] },
  // the burnt country: a slow heartbeat and the udu
  ash: { heart: [[0, 1], [3, 0.55], [8, 0.8], [11, 0.45]], udu: [10, 13] },
  // the hunters' war groove: 12/8 with the bell, dundun in twos against the threes
  chase: { bell: [0, 2, 4, 5, 7, 9, 11], shek: 'triple', dj: [[0, 'bass', 1], [1, 'tone', 0.5], [2, 'slap', 0.8], [3, 'tone', 0.7], [5, 'slap', 0.9], [6, 'bass', 0.9], [8, 'slap', 0.8], [9, 'tone', 0.7], [10, 'tone', 0.5], [11, 'slap', 0.9]], dun: [[0, 1], [2, 0.6], [3, 0.8], [6, 1], [8, 0.6], [9, 0.8]], ken: [1, 4, 7, 10], clap: [3, 9] },
};

// One song per theme. tune: eight bars (A, its answer A', then B with the peak and the cadence).
// ost: the accompaniment idiom; lead/answer/counter: who plays the tune, who answers, who
// improvises. progs: alternative harmonizations under the same tune.
const SONGS = {
  // The signature tune, D dorian: a rising hunting call (A D E F), an answer that settles on the
  // fifth, a reach to the top A, and a B phrase that lifts on the dorian B natural.
  title: {
    grid: 16, tempo: 92, tonic: 62, mode: 'dorian', ost: 'kumbengo', kit: 'd16', swing: 0.08,
    lead: ['kalimba', 'flute'], answer: 'kora', counter: 'balafon',
    tune: [
      [[0, 4, 3], [3, 7, 3], [6, 8, 2], [8, 9, 4], [12, 8, 2], [14, 7, 2]],
      [[0, 6, 3], [3, 4, 5], [8, 3, 2], [10, 4, 6]],
      [[0, 4, 3], [3, 7, 3], [6, 8, 2], [8, 9, 2], [10, 10, 2], [12, 11, 4]],
      [[0, 10, 2], [2, 9, 2], [4, 8, 4], [8, 6, 2], [10, 7, 6]],
      [[0, 11, 6], [6, 12, 2], [8, 11, 2], [10, 9, 2], [12, 10, 4]],
      [[0, 9, 3], [3, 8, 3], [6, 7, 2], [8, 8, 8]],
      [[0, 7, 2], [2, 9, 2], [4, 11, 4], [8, 10, 2], [10, 9, 2], [12, 8, 4]],
      [[0, 6, 3], [3, 4, 3], [6, 6, 2], [8, 7, 8]],
    ],
    progs: [
      [[0, 3, 7], [7, 10, 14], [3, 7, 10], [0, 3, 7], [5, 9, 12], [-2, 2, 5], [0, 3, 7], [[-2, 2, 5], [0, 3, 7]]],
      [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [7, 10, 14], [5, 9, 12], [7, 10, 14], [-4, 0, 3], [[-2, 2, 5], [0, 3, 7]]],
    ],
  },
  // Open grass by day: D mixolydian in 12/8, a kora kumbengo under a flute call. The flat seventh
  // (C) gives the bVII-I cadence of a lot of Mande song.
  savanna: {
    grid: 12, tempo: 84, tonic: 62, mode: 'mixo', ost: 'kumbengo', kit: 'd12', swing: 0,
    lead: ['flute', 'kalimba', 'kora'], answer: 'kora', counter: 'balafon',
    tune: [
      [[0, 7, 2], [2, 9, 1], [3, 11, 3], [6, 10, 2], [8, 9, 1], [9, 8, 3]],
      [[0, 7, 3], [3, 9, 2], [5, 8, 1], [6, 6, 4], [10, 4, 2]],
      [[0, 7, 2], [2, 9, 1], [3, 11, 3], [6, 12, 2], [8, 11, 1], [9, 10, 3]],
      [[0, 9, 3], [3, 8, 2], [5, 6, 1], [6, 7, 6]],
      [[0, 10, 4], [4, 11, 2], [6, 10, 2], [8, 8, 1], [9, 10, 3]],
      [[0, 9, 2], [2, 8, 1], [3, 6, 3], [6, 8, 3], [9, 9, 3]],
      [[0, 13, 3], [3, 12, 3], [6, 11, 2], [8, 10, 1], [9, 9, 3]],
      [[0, 8, 2], [2, 7, 1], [3, 8, 3], [6, 7, 6]],
    ],
    progs: [
      [[0, 4, 7], [-2, 2, 5], [0, 4, 7], [[-2, 2, 5], [0, 4, 7]], [5, 9, 12], [-2, 2, 5], [[-2, 2, 5], [0, 4, 7]], [[-2, 2, 5], [0, 4, 7]]],
      [[0, 4, 7], [-2, 2, 5], [-3, 0, 4], [[-2, 2, 5], [0, 4, 7]], [5, 9, 12], [2, 5, 9], [-2, 2, 5], [[5, 9, 12], [0, 4, 7]]],
    ],
  },
  // The coast: F lydian palm-wine lilt, swung 4/4 with a highlife bell; the raised fourth (B)
  // keeps it bright.
  coast: {
    grid: 16, tempo: 96, tonic: 65, mode: 'lydian', ost: 'palm', kit: 'd16', swing: 0.2,
    lead: ['kalimba', 'flute'], answer: 'balafon', counter: 'kora',
    tune: [
      [[0, 4, 2], [2, 5, 2], [4, 7, 3], [7, 6, 1], [8, 5, 2], [10, 4, 4], [14, 2, 2]],
      [[0, 4, 3], [3, 2, 3], [6, 1, 2], [8, 2, 6], [14, 4, 2]],
      [[0, 7, 2], [2, 8, 2], [4, 9, 3], [7, 8, 1], [8, 7, 2], [10, 5, 4], [14, 6, 2]],
      [[0, 7, 6], [6, 5, 2], [8, 4, 8]],
      [[0, 9, 2], [2, 10, 2], [4, 11, 6], [10, 10, 2], [12, 9, 4]],
      [[0, 8, 3], [3, 7, 3], [6, 5, 2], [8, 6, 4], [12, 8, 4]],
      [[0, 9, 2], [2, 7, 2], [4, 5, 3], [7, 4, 1], [8, 5, 2], [10, 7, 2], [12, 6, 4]],
      [[0, 4, 3], [3, 5, 3], [6, 6, 2], [8, 7, 8]],
    ],
    progs: [
      [[0, 4, 7], [-3, 0, 4], [0, 4, 7], [-5, -1, 2], [0, 4, 7], [2, 6, 9], [-3, 0, 4], [[-5, -1, 2], [0, 4, 7]]],
      [[0, 4, 7], [4, 7, 11], [-3, 0, 4], [-5, -1, 2], [2, 6, 9], [-1, 2, 6], [-3, 0, 4], [[-5, -1, 2], [0, 4, 7]]],
    ],
  },
  // Woodland: two balafons interlocking in A minor pentatonic (amadinda style: each plays every
  // other pulse and the tune is the sum), a flute call that the talking drum answers.
  woodland: {
    grid: 16, tempo: 104, tonic: 57, mode: 'minpent', ost: 'hocket', kit: 'forest', swing: 0.06,
    lead: ['flute', 'kalimba'], answer: 'talk', counter: 'kora',
    hocket: [[[5, 7, 6, 4, 5, 3, 6, 8, 7, 5, 6, 4], [8, 6, 7, 5, 6, 4, 9, 7, 8, 6, 7, 5]], [[3, 5, 4, 6, 5, 7, 4, 6, 5, 3, 4, 2], [7, 8, 6, 7, 9, 8, 6, 5, 7, 8, 6, 4]]],
    tune: [
      [[0, 7, 3], [3, 8, 1], [4, 9, 2], [6, 8, 2], [8, 7, 4], [12, 6, 2], [14, 5, 2]],
      [[0, 6, 2], [2, 5, 6]],
      [[0, 9, 2], [2, 10, 2], [4, 9, 2], [6, 8, 2], [8, 9, 4], [12, 8, 2], [14, 7, 2]],
      [[0, 6, 3], [3, 7, 3], [6, 6, 2], [8, 5, 8]],
      [[0, 10, 4], [4, 11, 4], [8, 10, 2], [10, 9, 2], [12, 8, 4]],
      [[0, 9, 3], [3, 8, 3], [6, 7, 2], [8, 8, 8]],
      [[0, 7, 2], [2, 8, 2], [4, 9, 2], [6, 10, 2], [8, 9, 2], [10, 8, 2], [12, 7, 4]],
      [[0, 6, 4], [4, 7, 4], [8, 5, 8]],
    ],
    progs: [
      [[0, 3, 7], [-2, 2, 5], [0, 3, 7], [[-2, 2, 5], [0, 3, 7]], [3, 7, 10], [-2, 2, 5], [[5, 9, 12], [3, 7, 10]], [[-2, 2, 5], [0, 3, 7]]],
      [[0, 3, 7], [3, 7, 10], [-2, 2, 5], [0, 3, 7], [-5, -2, 2], [3, 7, 10], [5, 9, 12], [[-2, 2, 5], [0, 3, 7]]],
    ],
  },
  // Wetland: an mbira song in G. Each 12/8 bar holds three chords of four pulses (3 against 4),
  // in the old Shona cycle I-iii-V, I-iii-vi, I-IV-vi, ii-IV-vi; kushaura and kutsinhira interlock.
  wetland: {
    grid: 12, tempo: 72, tonic: 55, mode: 'ionian', ost: 'mbira', kit: 'hosho', swing: 0,
    lead: ['flute', 'voice'], answer: 'kalimba', counter: 'kora',
    tune: [
      [[0, 11, 6], [6, 12, 3], [9, 11, 3]],
      [[0, 9, 6], [6, 8, 3], [9, 9, 3]],
      [[0, 9, 4], [4, 10, 4], [8, 9, 4]],
      [[0, 8, 4], [4, 7, 8]],
      [[0, 14, 3], [3, 13, 3], [6, 11, 6]],
      [[0, 11, 4], [4, 13, 4], [8, 12, 4]],
      [[0, 11, 4], [4, 12, 4], [8, 14, 4]],
      [[0, 12, 4], [4, 11, 2], [6, 10, 2], [8, 9, 4]],
    ],
    progs: (() => {
      const I = [0, 4, 7], ii = [2, 5, 9], iii = [4, 7, 11], IV = [5, 9, 12], V = [7, 11, 14], vi = [9, 12, 16];
      const a = [[I, iii, V], [I, iii, vi], [I, IV, vi], [ii, IV, vi]], b = [[I, iii, V], [I, iii, vi], [I, IV, vi], [ii, IV, V]];
      return [[...a, ...a], [...a, ...b]];
    })(),
  },
  // Desert: E phrygian in a 12/8 tende groove; an ngoni riff in desert-blues style, a flute line
  // that ends every phrase on the phrygian F-E fall, and women's voices answering.
  desert: {
    grid: 12, tempo: 88, tonic: 52, mode: 'phrygian', ost: 'riff', kit: 'tende', swing: 0,
    lead: ['flute', 'ngoni'], answer: 'chorus', counter: 'ngoni',
    riff: [
      [[0, 0, 2], [2, 2, 1], [3, 0, 2], [5, 3, 1], [6, 2, 2], [8, 0, 1], [9, -1, 2], [11, 0, 1]],
      [[0, 0, 2], [2, 2, 1], [3, 4, 2], [5, 3, 1], [6, 2, 2], [8, 1, 1], [9, 0, 3]],
    ],
    tune: [
      [[0, 11, 5], [5, 12, 1], [6, 11, 3], [9, 9, 3]],
      [[0, 10, 3], [3, 9, 3], [6, 7, 6]],
      [[0, 14, 4], [4, 13, 2], [6, 11, 3], [9, 12, 1], [10, 11, 2]],
      [[0, 10, 2], [2, 9, 1], [3, 8, 3], [6, 7, 6]],
      [[0, 7, 3], [3, 9, 3], [6, 10, 3], [9, 11, 3]],
      [[0, 13, 6], [6, 14, 3], [9, 13, 3]],
      [[0, 12, 3], [3, 11, 3], [6, 9, 2], [8, 10, 1], [9, 11, 3]],
      [[0, 8, 4], [4, 8, 2], [6, 7, 6]],
    ],
    progs: [
      [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [[1, 5, 8], [0, 3, 7]], [-4, 0, 3], [-2, 2, 5], [5, 8, 12], [[1, 5, 8], [0, 3, 7]]],
      [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [[-2, 2, 5], [0, 3, 7]], [5, 8, 12], [-4, 0, 3], [-2, 2, 5], [[1, 5, 8], [0, 3, 7]]],
    ],
  },
  // Highland: the Ethiopian ambassel scale on A, slow 12/8; a krar (lyre) ostinato, a washint
  // (flute) line with heavy ornament over an open-fifth drone and the kebero.
  highland: {
    grid: 12, tempo: 74, tonic: 57, mode: 'ambassel', ost: 'krar', kit: 'kebero', swing: 0,
    lead: ['flute'], answer: 'voice', counter: 'krar',
    riff: [
      [[0, 0, 2], [2, 3, 1], [3, 4, 2], [5, 3, 1], [6, 5, 2], [8, 4, 1], [9, 3, 2], [11, 2, 1]],
      [[0, 1, 2], [2, 2, 1], [3, 4, 2], [5, 3, 1], [6, 2, 2], [8, 1, 1], [9, 0, 2], [11, -1, 1]],
    ],
    tune: [
      [[0, 8, 6], [6, 9, 2], [8, 8, 1], [9, 7, 3]],
      [[0, 6, 3], [3, 5, 9]],
      [[0, 5, 2], [2, 6, 1], [3, 7, 3], [6, 9, 3], [9, 8, 3]],
      [[0, 7, 2], [2, 6, 1], [3, 5, 9]],
      [[0, 10, 6], [6, 9, 3], [9, 10, 3]],
      [[0, 8, 3], [3, 9, 3], [6, 8, 3], [9, 7, 3]],
      [[0, 6, 4], [4, 7, 4], [8, 8, 4]],
      [[0, 6, 3], [3, 5, 9]],
    ],
    progs: [
      [[0, 7, 12], [0, 7, 12], [0, 7, 12], [0, 7, 12], [0, 7, 12], [1, 5, 8], [0, 7, 12], [0, 7, 12]],
      [[0, 7, 12], [1, 5, 8], [5, 8, 12], [0, 7, 12], [5, 8, 12], [1, 5, 8], [0, 7, 12], [0, 7, 12]],
    ],
  },
  // Burnt country: D locrian, half-time, a heartbeat drum and a low lament.
  ash: {
    grid: 16, tempo: 64, tonic: 62, mode: 'locrian', ost: 'ash', kit: 'ash', swing: 0,
    lead: ['flute'], answer: 'mbira', counter: 'mbira',
    tune: [
      [[0, 7, 8], [8, 8, 4], [12, 7, 4]],
      [[0, 5, 6], [6, 4, 2], [8, 3, 8]],
      [[0, 2, 4], [4, 3, 4], [8, 4, 6], [14, 5, 2]],
      [[0, 1, 8], [8, 0, 8]],
      [[0, 9, 6], [6, 8, 2], [8, 7, 8]],
      [[0, 8, 4], [4, 7, 4], [8, 4, 8]],
      [[0, 5, 4], [4, 4, 4], [8, 3, 4], [12, 2, 4]],
      [[0, 1, 6], [6, 2, 2], [8, 0, 8]],
    ],
    progs: [
      [[0, 3, 6], [0, 3, 6], [-4, -1, 3], [1, 5, 8], [6, 10, 13], [5, 8, 12], [-4, -1, 3], [[1, 5, 8], [0, 3, 6]]],
      [[0, 3, 6], [1, 5, 8], [0, 3, 6], [-4, -1, 3], [5, 8, 12], [6, 10, 13], [1, 5, 8], [0, 3, 6]],
    ],
  },
  // Night: a slow nocturne. Its tonic and mode follow the land (see nightSong), so dusk and dawn
  // pivot on a shared tonic.
  night: {
    grid: 16, tempo: 64, tonic: 62, mode: 'dorian', ost: 'night', kit: null, swing: 0.1,
    lead: ['flute', 'mbira'], answer: 'kalimba', counter: 'kora',
    tune: [
      [[0, 4, 6], [6, 6, 2], [8, 7, 8]],
      [[0, 6, 4], [4, 4, 4], [8, 3, 8]],
      [[0, 2, 6], [6, 3, 2], [8, 4, 6], [14, 6, 2]],
      [[0, 4, 16]],
      [[0, 7, 6], [6, 8, 2], [8, 9, 8]],
      [[0, 8, 4], [4, 7, 4], [8, 6, 8]],
      [[0, 5, 6], [6, 4, 2], [8, 3, 4], [12, 2, 4]],
      [[0, 1, 8], [8, 0, 8]],
    ],
    progs: [
      [[0, 3, 7], [7, 10, 14], [3, 7, 10], [7, 10, 14], [0, 3, 7], [-2, 2, 5], [5, 9, 12], [0, 3, 7]],
      [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [7, 10, 14], [-4, 0, 3], [7, 10, 14], [5, 9, 12], [0, 3, 7]],
    ],
  },
  // The hunters: 12/8 at a run, D aeolian. A kora riff grouped in twos against the drums' threes,
  // a leader's call and the band's answer.
  chase: {
    grid: 12, tempo: 112, tonic: 50, mode: 'aeolian', ost: 'riff', kit: 'chase', swing: 0,
    lead: ['voice'], answer: 'chorus', counter: 'kora',
    riff: [
      [[0, 7, 1], [2, 9, 1], [3, 7, 1], [5, 10, 1], [6, 11, 1], [8, 10, 1], [9, 9, 1], [11, 8, 1]],
      [[0, 7, 1], [1, 7, 1], [3, 9, 1], [4, 7, 1], [6, 10, 1], [7, 9, 1], [9, 8, 1], [10, 6, 1]],
      [[0, 11, 1], [2, 10, 1], [3, 9, 1], [5, 7, 1], [6, 9, 1], [8, 7, 1], [9, 6, 1], [11, 4, 1]],
    ],
    // leader's call (two variants) and the chorus answer, in degrees above the D3 tonic
    call: [[[0, 11, 2], [2, 11, 1], [3, 12, 2], [5, 11, 1], [6, 10, 3], [9, 9, 3]], [[0, 14, 3], [3, 12, 2], [5, 11, 1], [6, 12, 3], [9, 11, 3]]],
    resp: [[[0, 7, 3], [3, 9, 2], [5, 7, 1], [6, 7, 6]], [[0, 9, 2], [2, 8, 1], [3, 7, 3], [6, 7, 6]]],
    tune: null,
    progs: [
      [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [0, 3, 7], [0, 3, 7], [0, 3, 7], [-4, 0, 3], [[-2, 2, 5], [0, 3, 7]]],
      [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [[7, 10, 14], [0, 3, 7]]],
    ],
  },
  // The death screen: the title tune again, slowed, in aeolian, each bar stretched to two.
  elegy: {
    grid: 16, tempo: 56, tonic: 62, mode: 'aeolian', ost: 'elegy', kit: null, swing: 0,
    lead: ['flute'], answer: 'kora', counter: 'kora',
    tune: null,
    progs: [[[0, 3, 7], [7, 11, 14], [-4, 0, 3], [0, 3, 7], [5, 8, 12], [-4, 0, 3], [-2, 2, 5], [[7, 11, 14], [0, 3, 7]]]],
  },
};
SONGS.elegy.tune = SONGS.title.tune;
// night mode by land: the dry and burnt country stays phrygian
const NIGHT_MODE = ['dorian', 'dorian', 'dorian', 'phrygian', 'aeolian', 'phrygian', 'dorian'];

// Ways to develop a two-bar phrase on its repeat (see develop()).
const DEVS = [
  [null, 'orn', 'seq', 'orn'], [null, 'disp', null, 'orn'], ['orn', 'inv', 'reg', null], [null, 'seq', 'orn', 'disp'],
  ['reg', 'orn', null, 'rhy'], [null, 'rhy', 'inv', 'orn'], ['disp', null, 'seq', null],
];
// Stereo seats for a small ensemble, and how much of each goes to the room.
const SEAT = { kora: -0.35, ngoni: -0.3, krar: -0.3, bolon: 0, balafon: 0.38, marimba: 0.38, mbira: -0.18, kalimba: 0.28, flute: 0.12, voice: 0.05, chorus: 0, talk: 0.3 };
const ROOM = { kora: 0.3, ngoni: 0.22, krar: 0.3, bolon: 0.12, balafon: 0.25, marimba: 0.25, mbira: 0.32, kalimba: 0.35, flute: 0.45, voice: 0.45 };
// small timing leans in seconds: the kora pushes, the flute and voices sit back
const LEAN = { kora: -0.004, ngoni: -0.003, flute: 0.012, voice: 0.015, chorus: 0.02, bolon: 0.004 };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// biome ids from terrain.js: 0 savanna 1 woodland 2 wetland 3 desert 4 highland 5 volcanic 6 coast
const BIOME_THEME = ['savanna', 'woodland', 'wetland', 'desert', 'highland', 'ash', 'coast'];

// ---------------- sample synthesis ----------------
function noise(n) { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1; return a; }

// RBJ biquad, applied in place
function biquad(buf, sr, type, f, q) {
  const w = (2 * Math.PI * f) / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; } // bandpass
  a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

function normalize(buf, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / m;
  return buf;
}

// Karplus-Strong string for the kora family. The loop is tuned with an allpass fractional delay
// (integer loops put high strings up to a quarter-tone out), the excitation is combed for the
// pluck position, and the string feeds a gourd body: a few resonances mixed under it.
function pluck(sr, f, dur, o = {}) {
  const { t60 = 3, damp = 0.5, exc = 0.6, pos = 0.12, body = [], nail = 0.25, peak = 0.8 } = o;
  const len = Math.floor(sr * dur), out = new Float32Array(len);
  const P = sr / f;
  let Ni = Math.floor(P - damp), fr = P - damp - Ni;
  if (fr < 0.25) { Ni -= 1; fr += 1; }
  Ni = Math.max(2, Ni);
  const C = (1 - fr) / (1 + fr);
  const line = new Float32Array(Ni), ex = new Float32Array(Ni);
  let lp = 0, mean = 0;
  for (let i = 0; i < Ni; i++) { lp += (Math.random() * 2 - 1 - lp) * exc; ex[i] = lp; }
  const d = Math.max(1, Math.round(pos * Ni));
  for (let i = 0; i < Ni; i++) { line[i] = ex[i] - 0.85 * ex[(i - d + Ni) % Ni]; mean += line[i]; }
  mean /= Ni;
  for (let i = 0; i < Ni; i++) line[i] -= mean;
  const g = Math.pow(10, -3 / (t60 * f));
  let idx = 0, x1 = 0, apx = 0, apy = 0;
  for (let n = 0; n < len; n++) {
    const x = line[idx];
    out[n] = x;
    const y = g * ((1 - damp) * x + damp * x1);
    x1 = x;
    const a = C * y + apx - C * apy;
    apx = y; apy = a;
    line[idx] = a;
    if (++idx === Ni) idx = 0;
  }
  if (body.length) {
    const dry = out.slice();
    for (const [bf, q, bg] of body) {
      if (bf > sr / 2.5) continue;
      const r = biquad(dry.slice(), sr, 'bp', bf, q);
      for (let i = 0; i < len; i++) out[i] += r[i] * bg;
    }
  }
  // the fingertip or nail on the string
  const nl = Math.min(len, Math.floor(sr * 0.004));
  if (nail) { const z = biquad(noise(nl), sr, 'hp', 2500, 0.7); for (let i = 0; i < nl; i++) out[i] += z[i] * nail * (1 - i / nl); }
  for (let i = 0; i < 128 && i < len; i++) out[len - 1 - i] *= i / 128;
  return normalize(out, peak);
}

// Modal bar for marimba, balafon, mbira and kalimba: decaying partials, a soft mallet or thumb,
// the resonator under the bar that keeps the fundamental ringing, the balafon's buzzing
// mirliton (a dead-zone nonlinearity, so it only buzzes while the note is loud) and the
// mbira's rattling shells (clicks whose rate follows the note's level).
function bar(sr, f, dur, o = {}) {
  const { partials = [[1, 1, 0.6]], mallet = 0.06, malletF = 2500, reson = null, buzz = 0, sizzle = 0, peak = 0.8 } = o;
  const len = Math.floor(sr * dur), out = new Float32Array(len);
  for (const [ratio, amp, dec, det = 0] of partials) {
    const fr = f * ratio * (1 + det);
    if (fr > sr / 2.2) continue;
    const w = (2 * Math.PI * fr) / sr, k = Math.exp(-1 / (dec * sr));
    let e = amp;
    for (let i = 0; i < len; i++) { out[i] += Math.sin(w * i) * e; e *= k; }
  }
  if (reson) {
    const [ra, rd, rat] = reson, w = (2 * Math.PI * f) / sr;
    for (let i = 0; i < len; i++) out[i] += Math.sin(w * i) * ra * (1 - Math.exp(-i / (rat * sr))) * Math.exp(-i / (rd * sr));
  }
  if (mallet) {
    const nl = Math.min(len, Math.floor(sr * 0.012)), m = biquad(noise(nl), sr, 'lp', malletF, 0.7);
    for (let i = 0; i < nl; i++) out[i] += m[i] * mallet * (1 - i / nl) * (1 - i / nl);
  }
  let pk = 0;
  for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(out[i]));
  if (buzz && pk) {
    const th = pk * 0.35, b = new Float32Array(len);
    for (let i = 0; i < len; i++) { const v = out[i]; b[i] = v > th ? v - th : v < -th ? v + th : 0; }
    biquad(b, sr, 'hp', 700, 0.7);
    for (let i = 0; i < len; i++) out[i] += b[i] * buzz * 6;
  }
  if (sizzle && pk) {
    const z = new Float32Array(len);
    let env = 0;
    for (let i = 0; i < len; i++) { env = Math.max(Math.abs(out[i]) / pk, env * 0.9996); if (Math.random() < env * 0.2) z[i] = Math.random() * 2 - 1; }
    biquad(z, sr, 'bp', 3600, 0.8);
    for (let i = 0; i < len; i++) out[i] += z[i] * sizzle * pk;
  }
  for (let i = 0; i < Math.min(40, len); i++) out[i] *= i / 40;
  for (let i = 0; i < 128 && i < len; i++) out[len - 1 - i] *= i / 128;
  return normalize(out, peak);
}

// A struck membrane: circular-membrane modes over a pitch that sags as the skin relaxes (or a
// shaped bend, for the talking drum), with the hand or stick as filtered noise.
function membrane(sr, f, dur, o = {}) {
  const { modes = [[1, 1, 0.2]], sag = 0.1, sagT = 0.03, nAmt = 0, nf = 2000, nq = 1, nd = 0.02, bend = null, peak = 0.9 } = o;
  const len = Math.floor(sr * dur), out = new Float32Array(len);
  for (const [ratio, amp, dec] of modes) {
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      ph += (2 * Math.PI * f * ratio * (1 + sag * Math.exp(-t / sagT)) * (bend ? bend(t) : 1)) / sr;
      out[i] += Math.sin(ph) * amp * Math.exp(-t / dec);
    }
  }
  if (nAmt) {
    const z = biquad(noise(len), sr, 'bp', nf, nq);
    for (let i = 0; i < len; i++) out[i] += z[i] * nAmt * Math.exp(-i / (sr * nd));
  }
  for (let i = 0; i < 64 && i < len; i++) out[len - 1 - i] *= i / 64;
  return normalize(out, peak);
}

// Iron bell (gankogui / dawuro): bright inharmonic partials and a hard strike.
function ironBell(sr, f) {
  const out = bar(sr, f, 0.5, { partials: [[1, 1, 0.22], [2.42, 0.55, 0.1], [4.07, 0.3, 0.05], [5.9, 0.18, 0.03]], mallet: 0.5, malletF: 6000, peak: 0.85 });
  return out;
}

// Shekere: a gourd netted with beads; a downstroke slaps the gourd as the beads hiss.
function shekere(sr, dur, down) {
  const len = Math.floor(sr * dur), out = new Float32Array(len);
  const n = 140 + Math.floor(Math.random() * 60);
  for (let k = 0; k < n; k++) {
    const u = Math.pow(Math.random(), 1.6), at = Math.floor(u * len * 0.85), a = (1 - u) * (0.4 + Math.random() * 0.6);
    for (let i = 0; i < 24 && at + i < len; i++) out[at + i] += (Math.random() * 2 - 1) * a * (1 - i / 24);
  }
  biquad(out, sr, 'bp', 5200, 0.7);
  if (down) { let ph = 0; for (let i = 0; i < len; i++) { ph += (2 * Math.PI * 170) / sr; out[i] += Math.sin(ph) * 0.35 * Math.exp(-i / (sr * 0.03)); } }
  for (let i = 0; i < Math.min(len, sr * 0.004); i++) out[i] *= i / (sr * 0.004);
  return normalize(out, 0.8);
}

// Handclap: a few hands landing within a few milliseconds, then a short room.
function clapBuf(sr) {
  const len = Math.floor(sr * 0.18), out = new Float32Array(len), z = noise(len);
  for (const [ms, a] of [[0, 0.8], [7, 1], [15, 0.7], [22, 0.5]]) {
    const at = Math.floor((ms / 1000) * sr);
    for (let i = at; i < len; i++) out[i] += z[i] * a * Math.exp(-(i - at) / (sr * (ms === 22 ? 0.045 : 0.006)));
  }
  biquad(out, sr, 'bp', 1400, 0.9);
  return normalize(out, 0.8);
}

function drum(sr, f0, f1, dur, noiseAmt, noiseF, tone2 = 0) {
  const len = Math.floor(sr * dur);
  const out = new Float32Array(len);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = f1 + (f0 - f1) * Math.exp(-t * 30);
    ph += (2 * Math.PI * f) / sr;
    ph2 += (2 * Math.PI * f * 1.52) / sr;
    const env = Math.exp(-t / (dur * 0.28));
    out[i] = (Math.sin(ph) + Math.sin(ph2) * tone2) * env;
  }
  if (noiseAmt) {
    const n = biquad(noise(len), sr, 'bp', noiseF, 1.2);
    for (let i = 0; i < len; i++) out[i] += n[i] * noiseAmt * Math.exp(-i / (sr * 0.018));
  }
  return normalize(out, 0.9);
}

function noiseHitBuf(sr, dur, type, f, q, attack = 0.002, curve = 1) {
  const len = Math.floor(sr * dur);
  const out = biquad(noise(len), sr, type, f, q);
  const a = Math.max(1, Math.floor(attack * sr));
  for (let i = 0; i < len; i++) out[i] *= (i < a ? i / a : 1) * Math.pow(1 - i / len, curve);
  return normalize(out, 0.8);
}

// ---------------- sfx synthesis ----------------
// Sound effects and ambience beds. Each recipe in SFX renders a few takes into Float32Arrays the
// first time it is needed (or earlier, from a warm queue), and play() then only starts buffer
// sources. Most cues are layered: a body (a pitched thump or a formant voice), a transient, and a
// noise texture, with envelopes shaped after the real sound.
const TW = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ad = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const LP = 0, BP = 1, HP = 2;
const zeros = (sr, dur) => new Float32Array(Math.max(1, Math.floor(dur * sr)));
// piecewise-linear curve through [[t, v], ...]
const curve = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t < pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0); }
  return pts[pts.length - 1][1];
};
function white(n) { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1; return a; }
// pink (Kellet's economy filter): wind, surf, distant rumble
function pink(n) {
  const a = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; a[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22; }
  return a;
}
function brown(n) { const a = new Float32Array(n); let y = 0; for (let i = 0; i < n; i++) { y = (y + (Math.random() * 2 - 1) * 0.06) * 0.997; a[i] = y; } return a; }

// Zavalishin state-variable filter, in place. f is Hz or a function of time (re-read every 16
// samples, so sweeps are smooth); the bandpass has unity gain at its centre.
function svf(x, sr, mode, f, q = 0.707) {
  const k = 1 / q;
  let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0;
  const set = (fc) => { const g = Math.tan((Math.PI * Math.min(Math.max(fc, 10), sr * 0.45)) / sr); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; };
  const fn = typeof f === 'function';
  if (!fn) set(f);
  for (let i = 0; i < x.length; i++) {
    if (fn && (i & 15) === 0) set(f(i / sr));
    const v0 = x[i], v3 = v0 - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    x[i] = mode === LP ? v2 : mode === BP ? k * v1 : v0 - k * v1 - v2;
  }
  return x;
}
function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
// mix src into o at a time offset
function put(o, src, sr, at = 0, g = 1) {
  const s = Math.floor(at * sr), n = Math.min(src.length, o.length - s);
  for (let i = Math.max(0, -s); i < n; i++) o[s + i] += src[i] * g;
  return o;
}
// A decaying sine: a claw tick, a water drop, a crackle. rise > 0 glides it up (a bubble).
function ring(o, sr, at, f, amp, dec, rise = 0) {
  const s = Math.floor(at * sr), n = Math.min(o.length - s, Math.floor(dec * 7 * sr));
  let ph = 0;
  const att = Math.max(2, Math.floor(sr * Math.min(0.004, 0.25 / f)));
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (TW * f * (1 + rise * t)) / sr; o[s + i] += Math.sin(ph) * Math.exp(-t / dec) * amp * Math.min(1, i / att); }
}
// A body landing: a sine whose pitch drops as it rings out, the weight under a footfall.
function thud(o, sr, at, f, amp, dec = 0.03, drop = 0.8) {
  const s = Math.floor(at * sr), n = Math.min(o.length - s, Math.floor(dec * 8 * sr));
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (TW * f * (1 + drop * Math.exp(-t * 60))) / sr; o[s + i] += Math.sin(ph) * ad(t, 0.003, dec) * amp; }
}
// A filtered noise layer with its own envelope.
function nz(o, sr, at, dur, mode, f, q, env, amp, color = white) {
  const s = Math.floor(at * sr), n = Math.min(o.length - s, Math.floor(dur * sr));
  if (n <= 0) return o;
  const z = svf(color(n), sr, mode, f, q);
  for (let i = 0; i < n; i++) o[s + i] += z[i] * env(i / sr) * amp;
  return o;
}
// scatter ring-clicks between t0 and t1 (crackle, grit, claws)
function clicks(o, sr, t0, t1, count, fLo, fHi, dec, amp, rise = 0) {
  for (let k = 0; k < count; k++) ring(o, sr, rnd(t0, t1), rnd(fLo, fHi), amp * Math.pow(Math.random(), 1.5), dec * rnd(0.6, 1.4), rise);
  return o;
}
// raw noise grains (for rustles: filtered afterwards as a whole)
function grains(o, sr, t0, t1, count, len, amp) {
  for (let k = 0; k < count; k++) {
    const s = Math.floor(rnd(t0, t1) * sr), n = Math.floor(rnd(len * 0.5, len * 1.5) * sr), a = amp * Math.pow(Math.random(), 1.3);
    for (let i = 0; i < n && s + i < o.length; i++) o[s + i] += (Math.random() * 2 - 1) * a * (1 - i / n);
  }
  return o;
}
function peakOf(x) { let m = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > m) m = v; } return m; }
// Finish a take: block DC, fade the ends (no clicks), scrub NaNs, normalize.
function fin(o, sr, peak = 0.9, fi = 0.001, fo = 0.02) {
  const c = 1 - Math.exp((-TW * 18) / sr);
  let y = 0;
  for (let i = 0; i < o.length; i++) { const v = Number.isFinite(o[i]) ? o[i] : 0; y += (v - y) * c; o[i] = v - y; }
  const a = Math.floor(fi * sr), r = Math.min(o.length, Math.floor(fo * sr));
  for (let i = 0; i < a && i < o.length; i++) o[i] *= i / a;
  for (let i = 0; i < r; i++) o[o.length - 1 - i] *= i / r;
  const m = peakOf(o);
  if (m > 0 && peak) for (let i = 0; i < o.length; i++) o[i] *= peak / m;
  return o;
}
// Beds are levelled by RMS (crackle and hiss differ wildly in crest), peak kept under 0.95.
function finBed(o, sr, rms = 0.12) {
  fin(o, sr, 0, 0.01, 0.01);
  let s = 0;
  for (let i = 0; i < o.length; i++) s += o[i] * o[i];
  const g = Math.min(rms / Math.sqrt(s / o.length || 1e-9), 0.95 / (peakOf(o) || 1));
  for (let i = 0; i < o.length; i++) o[i] *= g;
  return o;
}
// Crossfade the extra tail into the head so a bed loops without a seam.
function loopify(x, sr, xf = 0.5) {
  const X = Math.floor(xf * sr), L = x.length - X, o = x.slice(0, L);
  for (let i = 0; i < X; i++) { const k = i / X; o[i] = x[i] * Math.sin((k * Math.PI) / 2) + x[L + i] * Math.cos((k * Math.PI) / 2); }
  return o;
}
// A stereo bed: the recipe runs once per channel (decorrelated), then loops and levels.
// A stereo bed: rendered once, looped and levelled; the right channel is the same loop half a turn on
// (decorrelated for free, and half the render cost).
const bed = (sr, dur, rms, fn) => {
  const L = finBed(loopify(fn(sr, dur + 0.5, 0), sr, 0.5), sr, rms), h = L.length >> 1, R = new Float32Array(L.length);
  R.set(L.subarray(h)); R.set(L.subarray(0, h), L.length - h);
  return [L, R];
};

// A voiced call: a band-limited buzz (or a sine, for pure calls) plus breath, through parallel
// formant filters that move with time. P: dur, f0(t), amp(t), form(t) -> [[hz, q, gain], ...],
// breath, rough (subharmonic + flutter: growls, roars, rasps), pure, bright (Hz), vib [rate, depth],
// jit, low (dry fundamental: a big chest), drive (tanh).
function voice(sr, P) {
  const n = Math.floor(P.dur * sr), out = new Float32Array(n);
  const breath = P.breath ?? 0.1, rough = P.rough || 0, pure = P.pure || 0, low = P.low || 0, jit = P.jit ?? 0.3;
  const cb = 1 - Math.exp((-TW * (P.bright || 3000)) / sr);
  const fr = 1 - Math.exp((-TW * (P.flutter || 35)) / sr), fn = 0.4 / Math.sqrt(fr / 2);
  const vr = P.vib ? P.vib[0] : 0, vd = P.vib ? P.vib[1] : 0;
  let ph = Math.random(), ph2 = 0, lp = 0, fl = 0, jt = 0;
  const m = P.form(0).length, st = new Float64Array(m * 2), co = new Float64Array(m * 4);
  const setF = (t) => {
    const F = P.form(t);
    for (let k = 0; k < m; k++) {
      const [f, q, gn] = F[k], g = Math.tan((Math.PI * Math.min(Math.max(f, 20), sr * 0.45)) / sr), kk = 1 / q, a1 = 1 / (1 + g * (g + kk));
      co[k * 4] = a1; co[k * 4 + 1] = g * a1; co[k * 4 + 2] = g * g * a1; co[k * 4 + 3] = kk * gn;
    }
  };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if ((i & 31) === 0) setF(t);
    jt += (Math.random() * 2 - 1 - jt) * 0.004;
    fl += (Math.random() * 2 - 1 - fl) * fr;
    const f = Math.max(15, P.f0(t) * (1 + jt * jit * 0.25 + (vd ? Math.sin(TW * vr * t) * vd : 0)));
    const dt = Math.min(0.45, f / sr);
    ph += dt; if (ph >= 1) ph -= 1;
    ph2 += dt * 0.5; if (ph2 >= 1) ph2 -= 1;
    let s = 2 * ph - 1 - polyblep(ph, dt);
    if (pure) s = s * (1 - pure) + Math.sin(TW * ph) * pure * 1.4;
    if (rough) s *= 1 - rough * 0.35 * (1 + Math.sin(TW * ph2)) + rough * fl * fn;
    lp += (s - lp) * cb;
    const a = P.amp(t);
    const x = (lp + (Math.random() * 2 - 1) * breath * 1.2) * a;
    let y = low ? low * Math.sin(TW * ph) * a : 0;
    for (let k = 0; k < m; k++) {
      const j = k * 4, i1 = st[k * 2], i2 = st[k * 2 + 1];
      const v3 = x - i2, v1 = co[j] * i1 + co[j + 1] * v3, v2 = i2 + co[j + 1] * i1 + co[j + 2] * v3;
      st[k * 2] = 2 * v1 - i1; st[k * 2 + 1] = 2 * v2 - i2;
      y += v1 * co[j + 3];
    }
    out[i] = y;
  }
  if (P.drive) { const m0 = peakOf(out) || 1, th = Math.tanh(P.drive); for (let i = 0; i < n; i++) out[i] = Math.tanh((out[i] / m0) * P.drive) / th; }
  return out;
}
const VOW = {
  a: [[750, 7, 1], [1150, 9, 0.5], [2500, 12, 0.22]],
  e: [[520, 6, 1], [1850, 11, 0.45], [2550, 12, 0.25]],
  i: [[300, 5, 1], [2250, 12, 0.4], [3000, 13, 0.25]],
  o: [[560, 6, 1], [880, 8, 0.5], [2450, 12, 0.15]],
  u: [[330, 5, 1], [850, 8, 0.3], [2300, 12, 0.1]],
  uh: [[620, 6, 1], [1200, 9, 0.45], [2550, 12, 0.2]],
  m: [[250, 4, 1], [1000, 6, 0.08], [2300, 8, 0.04]],
};
const vmix = (A, B, k) => A.map((a, i) => [a[0] + (B[i][0] - a[0]) * k, a[1] + (B[i][1] - a[1]) * k, a[2] + (B[i][2] - a[2]) * k]);
// glide through [[t, vowel], ...]; fs scales every formant (head size)
const vpath = (keys, fs = 1) => (t) => {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, A] = keys[i], [t1, B] = keys[i + 1];
  return vmix(VOW[A] || A, VOW[B] || B, c01((t - t0) / (t1 - t0 || 1))).map(([f, q, g]) => [f * fs, q, g]);
};
// a whistled bird note with a little second harmonic
function chirp(o, sr, at, dur, f, amp, h2 = 0.08, ch = null) {
  const s = Math.floor(at * sr), n = Math.min(o.length - s, Math.floor(dur * sr));
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (TW * f(t)) / sr; o[s + i] += (Math.sin(ph) + h2 * Math.sin(2 * ph)) * amp(t); }
  return o;
}
// smooth random wander in [-1, 1], about `rate` turns per second (gusts, flutter, swells)
function wob(dur, rate) {
  const n = Math.ceil(dur * rate) + 3, p = Array.from({ length: n }, () => Math.random() * 2 - 1);
  return (t) => { const x = Math.max(0, t * rate), i = Math.min(n - 2, Math.floor(x)), f = x - i, k = (1 - Math.cos(f * Math.PI)) / 2; return p[i] + (p[i + 1] - p[i]) * k; };
}

// ---- footsteps: a cat's pad lands soft, so the ground does the talking ----
// ground ids from terrain.js G: grass lush tall sand clay mud rock shallow deep ash dune salt beach sea leaf basalt cliff
const STEP_OF = ['grass', 'lush', 'tall', 'sand', 'clay', 'mud', 'rock', 'wade', 'swim', 'ash', 'dune', 'salt', 'beach', 'swim', 'leaf', 'basalt', 'rock'];
function footstep(sr, kind) {
  const o = zeros(sr, kind === 'swim' ? 0.6 : kind === 'tall' ? 0.34 : 0.26);
  const f = rnd(80, 115);
  const th = (o, sr, at, f, a, d, dr) => thud(o, sr, at, f, a * 0.5, d, dr);
  switch (kind) {
    case 'grass': th(o, sr, 0, f, 0.6, 0.02); clicks(o, sr, 0.004, 0.11, 18, 2200, 7500, 0.0011, 0.5); nz(o, sr, 0, 0.16, BP, rnd(2600, 4200), 0.9, (t) => ad(t, 0.01, 0.035), 0.35); break;
    case 'lush': th(o, sr, 0, f, 0.7, 0.02); nz(o, sr, 0, 0.14, BP, rnd(1600, 2400), 0.8, (t) => ad(t, 0.012, 0.03), 0.4); clicks(o, sr, 0.005, 0.07, 4, 2000, 4500, 0.0012, 0.2); break;
    case 'tall': {
      const f0 = rnd(1400, 2000), d = rnd(0.2, 0.28);
      nz(o, sr, 0, d + 0.03, BP, (t) => f0 * (1 + 1.6 * Math.sin(Math.PI * c01(t / d))), 1.3, (t) => Math.pow(Math.sin(Math.PI * c01(t / d)), 1.5), 0.6);
      clicks(o, sr, 0.02, d, 12, 1800, 6000, 0.0015, 0.35); th(o, sr, 0.02, f, 0.3, 0.02); break;
    }
    case 'sand': case 'dune':
      th(o, sr, 0, f * 0.9, 0.8, 0.024); clicks(o, sr, 0.002, 0.07, 34, 3000, 9000, 0.0005, 0.3); nz(o, sr, 0, 0.12, BP, rnd(800, 1200), 0.8, (t) => ad(t, 0.004, 0.028), 0.45);
      if (kind === 'dune') nz(o, sr, 0.01, 0.16, HP, 2500, 0.7, (t) => ad(t, 0.03, 0.05), 0.25);
      break;
    case 'beach': th(o, sr, 0, f, 0.9, 0.02); nz(o, sr, 0, 0.12, LP, 900, 0.8, (t) => ad(t, 0.004, 0.03), 0.5); clicks(o, sr, 0.002, 0.04, 8, 3000, 8000, 0.0005, 0.15); break;
    case 'salt': th(o, sr, 0, f, 0.55, 0.016); clicks(o, sr, 0.001, 0.05, 36, 3500, 9500, 0.0007, 0.6); nz(o, sr, 0, 0.06, HP, 3000, 0.8, (t) => ad(t, 0.001, 0.012), 0.3); break;
    case 'clay': th(o, sr, 0, f * 1.2, 0.9, 0.014); nz(o, sr, 0, 0.05, BP, rnd(2200, 3000), 1.2, (t) => ad(t, 0.001, 0.008), 0.35); clicks(o, sr, 0.003, 0.04, 6, 3000, 7000, 0.0006, 0.18); break;
    case 'ash': th(o, sr, 0, f * 0.85, 0.7, 0.026); nz(o, sr, 0, 0.14, LP, 1300, 0.7, (t) => ad(t, 0.006, 0.045), 0.55); clicks(o, sr, 0.004, 0.06, 5, 1500, 3500, 0.0012, 0.15); break;
    case 'rock': case 'basalt':
      th(o, sr, 0, f * 1.4, 0.6, 0.012, 0.5);
      for (let k = 0; k < 2 + ((Math.random() * 2) | 0); k++) ring(o, sr, rnd(0, 0.03), rnd(3500, 6500), rnd(0.25, 0.5), rnd(0.001, 0.002));
      nz(o, sr, 0, kind === 'basalt' ? 0.07 : 0.035, BP, rnd(3500, 5000), 1.4, (t) => ad(t, 0.001, kind === 'basalt' ? 0.02 : 0.01), 0.35);
      break;
    case 'leaf': th(o, sr, 0, f, 0.5, 0.02); clicks(o, sr, 0.003, 0.12, 26, 1200, 5500, 0.0018, 0.6); nz(o, sr, 0, 0.14, BP, 3000, 0.7, (t) => ad(t, 0.006, 0.04), 0.25); break;
    case 'mud': {
      th(o, sr, 0, f * 0.75, 0.55, 0.03);
      const r = rnd(0.07, 0.12);
      nz(o, sr, 0, 0.2, BP, (t) => 250 + 700 * Math.exp(-t * 14), 3, (t) => ad(t, 0.012, 0.05), 0.8);
      ring(o, sr, r, rnd(260, 420), 0.45, 0.018, 40);
      nz(o, sr, r, 0.06, LP, 1500, 0.7, (t) => ad(t, 0.002, 0.015), 0.25);
      break;
    }
    case 'wade':
      nz(o, sr, 0, 0.24, LP, (t) => 400 + 3800 * Math.exp(-t * 16), 0.8, (t) => ad(t, 0.004, 0.05), 0.8);
      nz(o, sr, 0, 0.2, LP, 320, 0.8, (t) => ad(t, 0.02, 0.06), 0.5);
      for (let k = 0; k < 7; k++) ring(o, sr, rnd(0.015, 0.2), rnd(900, 3500), rnd(0.05, 0.18), rnd(0.008, 0.016), 25);
      break;
    case 'swim': // a stroke: a slow push of water, a gurgle, drops off the paw
      nz(o, sr, 0, 0.55, LP, (t) => 250 + 500 * Math.sin(Math.PI * c01(t / 0.45)), 0.9, (t) => Math.pow(Math.sin(Math.PI * c01(t / 0.5)), 2), 0.75, pink);
      for (let k = 0; k < 6; k++) ring(o, sr, rnd(0.1, 0.4), rnd(250, 800), rnd(0.1, 0.3), rnd(0.015, 0.03), 20);
      for (let k = 0; k < 4; k++) ring(o, sr, rnd(0.3, 0.5), rnd(1200, 3000), rnd(0.04, 0.1), 0.01, 25);
      break;
  }
  return fin(o, sr, 0.9);
}
// hooves on hard ground (a herd running, a gazelle stotting)
function hoof(o, sr, at, amp = 1, f = rnd(90, 120)) {
  thud(o, sr, at, f, amp, 0.02, 0.6);
  ring(o, sr, at, rnd(1600, 2600), amp * 0.35, 0.0025);
  nz(o, sr, at, 0.06, LP, 2200, 0.7, (t) => ad(t, 0.002, 0.015), amp * 0.25);
}

// ---- the cat ----
function catSfx(sr, kind) {
  const s = rnd(0.9, 1.1);
  let o;
  switch (kind) {
    case 'snarl': // a short open-mouthed snarl, hiss first
      o = voice(sr, { dur: rnd(0.4, 0.5), f0: curve([[0, 150 * s], [0.08, 230 * s], [0.3, 190 * s], [0.5, 140 * s]]), amp: (t) => c01(t / 0.03) * Math.exp(-Math.max(0, t - 0.12) / 0.08),
        form: vpath([[0, 'uh'], [0.08, [[950, 4, 1], [1750, 5, 0.6], [3000, 6, 0.35]]], [0.5, 'a']], 0.9), breath: 0.7, rough: 0.75, bright: 4000, drive: 1.6 });
      return fin(nz(o, sr, 0, 0.08, HP, 3000, 0.7, (t) => ad(t, 0.01, 0.03), 0.3 * peakOf(o)), sr);
    case 'yowl': // hurt: a closed-mouth start that opens into a cry and falls
      { const d = rnd(0.42, 0.55); return fin(voice(sr, { dur: d, f0: curve([[0, 270 * s], [0.1, 500 * s], [0.28, 420 * s], [d, 230 * s]]), amp: (t) => c01(t / 0.02) * c01((d - t) / 0.2) ** 1.5,
        form: vpath([[0, 'm'], [0.07, 'a'], [0.3, 'a'], [d, 'o']], 0.95), breath: 0.35, rough: 0.4, bright: 4500, vib: [9, 0.02], drive: 1.4 }), sr); }
    case 'growl':
      return fin(voice(sr, { dur: rnd(0.6, 0.8), f0: (t) => 72 * s * (1 + 0.08 * Math.sin(t * 9)), amp: (t) => c01(t / 0.12) * c01((0.75 - t) / 0.25),
        form: vpath([[0, 'uh'], [0.8, 'o']], 0.6), breath: 0.4, rough: 0.8, flutter: 25, low: 0.4, bright: 2000 }), sr);
    case 'saw': { // a leopard's sawing call: hoarse strokes out and in
      o = zeros(sr, 3.2);
      const n = 6 + ((Math.random() * 3) | 0), gap = rnd(0.36, 0.44);
      for (let k = 0; k < n; k++) {
        const v = 1 - k * 0.06;
        put(o, voice(sr, { dur: 0.22, f0: curve([[0, 95 * s], [0.1, 120 * s], [0.22, 90 * s]]), amp: (t) => Math.sin(Math.PI * c01(t / 0.22)) ** 0.7, form: () => [[480, 3, 1], [1150, 4, 0.6], [2600, 5, 0.3]], breath: 0.8, rough: 0.85, bright: 3000 }), sr, k * gap, v);
        put(o, voice(sr, { dur: 0.15, f0: () => 135 * s, amp: (t) => Math.sin(Math.PI * c01(t / 0.15)), form: () => [[700, 3, 1], [1600, 4, 0.5], [3000, 5, 0.3]], breath: 0.95, rough: 0.6 }), sr, k * gap + 0.23, v * 0.45);
      }
      return fin(o, sr);
    }
    case 'pantOut': // "hah": breath through an open mouth, a touch voiced
      return fin(voice(sr, { dur: rnd(0.11, 0.15), f0: () => 170 * s, amp: (t) => ad(t, 0.015, 0.045), form: () => VOW.a.map(([f, q, g]) => [f * 0.85 * s, q * 0.6, g]), breath: 0.95, rough: 0.2, bright: 2500 }), sr);
    case 'pantIn':
      o = zeros(sr, 0.13);
      return fin(nz(o, sr, 0, 0.12, BP, (t) => 1800 + 2000 * t / 0.12, 1, (t) => Math.sin(Math.PI * c01(t / 0.12)) ** 2, 1), sr);
    case 'chuff':
      return fin(voice(sr, { dur: 0.1, f0: () => 140 * s, amp: (t) => ad(t, 0.005, 0.03), form: () => VOW.uh, breath: 0.9, rough: 0.3 }), sr);
    case 'lap': // a tongue flick: the scoop pops a bubble and throws a few drops
      o = zeros(sr, 0.14);
      ring(o, sr, 0.004, rnd(450, 900), 0.6, 0.012, 30);
      nz(o, sr, 0, 0.04, HP, 2500, 0.7, (t) => ad(t, 0.001, 0.008), 0.35);
      ring(o, sr, 0, rnd(2800, 3600), 0.15, 0.0008);
      for (let k = 0; k < 3; k++) ring(o, sr, rnd(0.03, 0.1), rnd(1400, 3200), rnd(0.05, 0.15), 0.008, 25);
      return fin(o, sr);
    case 'tear': { // sinew giving way: a ragged burst of grain, wet underneath
      o = zeros(sr, 0.4);
      const d = rnd(0.18, 0.3), g = grains(zeros(sr, 0.4), sr, 0, d, 80, 0.004, 1);
      svf(g, sr, BP, rnd(700, 1200), 0.9);
      clicks(g, sr, 0.02, d, 6, 900, 2000, 0.003, 0.5);
      for (let i = 0; i < g.length; i++) g[i] *= c01((d + 0.04 - i / sr) / 0.08);
      put(o, g, sr, 0);
      return fin(nz(o, sr, 0, 0.3, LP, 700, 0.8, (t) => ad(t, 0.01, 0.08), 0.2 * peakOf(g)), sr);
    }
    case 'crunch': // a bone: hard crack, a ring, splinters after
      o = zeros(sr, 0.25);
      nz(o, sr, 0, 0.02, HP, 1500, 0.7, (t) => ad(t, 0.0003, 0.003), 0.9);
      ring(o, sr, 0, rnd(1700, 2600), 0.5, 0.006);
      thud(o, sr, 0, 160, 0.5, 0.015);
      clicks(o, sr, 0.015, 0.09, 8, 1500, 5000, 0.0012, 0.35);
      return fin(o, sr);
    case 'chew':
      o = zeros(sr, 0.18);
      nz(o, sr, 0, 0.15, BP, (t) => 650 - 1500 * t, 2, (t) => ad(t, 0.012, 0.04), 0.8);
      clicks(o, sr, 0, 0.06, 3, 1000, 2200, 0.002, 0.3);
      return fin(o, sr);
    case 'settle': // lying down: fur on ground, the weight going down, a long breath out
      o = zeros(sr, 1.3);
      nz(o, sr, 0, 0.45, BP, 1400, 0.6, (t) => Math.sin(Math.PI * c01(t / 0.42)) ** 2, 0.35, pink);
      grains(o, sr, 0.02, 0.4, 25, 0.004, 0.08);
      thud(o, sr, 0.26, 55, 0.9, 0.06, 0.4);
      put(o, voice(sr, { dur: 0.75, f0: curve([[0, 110], [0.75, 75]]), amp: (t) => Math.sin(Math.PI * c01(t / 0.75)) ** 1.5, form: () => VOW.uh.map(([f, q, g]) => [f * 0.7, q * 0.5, g]), breath: 0.97, bright: 1800 }), sr, 0.4, 0.5);
      return fin(o, sr, 0.9, 0.002, 0.1);
    case 'rise':
      o = zeros(sr, 0.35);
      nz(o, sr, 0, 0.3, BP, 1700, 0.6, (t) => Math.sin(Math.PI * c01(t / 0.28)) ** 2, 0.5, pink);
      grains(o, sr, 0, 0.25, 12, 0.004, 0.1);
      return fin(o, sr);
    case 'pounce': { // a scrabble and a chuff off the ground, air, then the landing
      o = zeros(sr, 0.55);
      for (let k = 0; k < 2; k++) nz(o, sr, k * 0.025, 0.05, BP, rnd(1500, 2500), 1, (t) => ad(t, 0.002, 0.015), 0.5);
      clicks(o, sr, 0, 0.05, 6, 3000, 7000, 0.001, 0.4);
      put(o, voice(sr, { dur: 0.1, f0: () => 150 * s, amp: (t) => ad(t, 0.005, 0.03), form: () => VOW.uh, breath: 0.9, rough: 0.3 }), sr, 0.005, 0.6);
      nz(o, sr, 0.02, 0.24, BP, (t) => 500 + 1100 * Math.sin(Math.PI * c01(t / 0.24)), 1.4, (t) => Math.sin(Math.PI * c01(t / 0.24)) ** 2, 0.45, pink);
      thud(o, sr, 0.245, 68, 1, 0.05, 0.5);
      clicks(o, sr, 0.25, 0.33, 14, 2500, 8000, 0.0007, 0.3);
      nz(o, sr, 0.245, 0.2, LP, 1500, 0.7, (t) => ad(t, 0.004, 0.05), 0.4);
      return fin(o, sr);
    }
    case 'climb': // claws biting rock, a heave, the body onto the ledge
      o = zeros(sr, 0.5);
      for (let k = 0; k < 4; k++) { const at = k * rnd(0.04, 0.07); nz(o, sr, at, 0.05, BP, (t) => rnd(2500, 3500) + 15000 * t, 2, (t) => ad(t, 0.002, 0.018), 0.5); clicks(o, sr, at, at + 0.03, 3, 3500, 7000, 0.001, 0.45); }
      put(o, voice(sr, { dur: 0.14, f0: () => 120 * s, amp: (t) => ad(t, 0.01, 0.05), form: () => VOW.uh, breath: 0.85, rough: 0.4 }), sr, 0.1, 0.4);
      thud(o, sr, 0.28, 80, 0.8, 0.04, 0.5);
      clicks(o, sr, 0.28, 0.38, 8, 2500, 7000, 0.0008, 0.25);
      return fin(o, sr);
    case 'drop':
      o = zeros(sr, 0.4);
      thud(o, sr, 0, 62, 1, 0.06, 0.5);
      clicks(o, sr, 0.01, 0.16, 20, 2500, 8000, 0.0007, 0.3);
      nz(o, sr, 0, 0.3, LP, 2000, 0.7, (t) => ad(t, 0.005, 0.07), 0.45);
      return fin(o, sr);
    case 'fall': // dying: the body goes down, dust, a last long breath
      o = zeros(sr, 1.7);
      thud(o, sr, 0, 52, 1, 0.09, 0.4); thud(o, sr, 0.13, 70, 0.55, 0.05, 0.4);
      nz(o, sr, 0, 0.5, LP, 1500, 0.7, (t) => ad(t, 0.01, 0.12), 0.4);
      put(o, voice(sr, { dur: 1.2, f0: curve([[0, 120], [1.2, 68]]), amp: (t) => c01(t / 0.08) * Math.exp(-t / 0.45), form: vpath([[0, 'uh'], [1.2, 'm']], 0.7), breath: 0.85, rough: 0.45, bright: 1800 }), sr, 0.22, 0.45);
      return fin(o, sr, 0.9, 0.001, 0.2);
    case 'overheat': // ragged heaving breath and a groan
      o = zeros(sr, 0.9);
      for (let k = 0; k < 3; k++) put(o, voice(sr, { dur: 0.13, f0: () => 180 * s, amp: (t) => ad(t, 0.012, 0.05), form: () => VOW.a.map(([f, q, g]) => [f * 0.85, q * 0.6, g]), breath: 0.9, rough: 0.55 }), sr, k * 0.16, 1 - k * 0.1);
      put(o, voice(sr, { dur: 0.4, f0: curve([[0, 110], [0.4, 80]]), amp: (t) => Math.sin(Math.PI * c01(t / 0.4)), form: () => VOW.uh.map(([f, q, g]) => [f * 0.7, q, g]), breath: 0.6, rough: 0.6 }), sr, 0.48, 0.5);
      return fin(o, sr);
    case 'heart': // lub-dub
      o = zeros(sr, 0.45);
      thud(o, sr, 0, 52, 1, 0.045, 0.3); thud(o, sr, 0.17, 62, 0.65, 0.035, 0.3);
      return fin(o, sr, 0.9, 0.003);
  }
  return fin(zeros(sr, 0.1), sr);
}
// What a blow sounds like on the cat, by what dealt it.
function impact(sr, kind) {
  const o = zeros(sr, 0.4);
  if (kind === 'pierce') { nz(o, sr, 0, 0.03, HP, 2000, 0.7, (t) => ad(t, 0.0003, 0.004), 0.7); thud(o, sr, 0, 110, 0.9, 0.04); nz(o, sr, 0.003, 0.15, LP, 1500, 0.7, (t) => ad(t, 0.002, 0.05), 0.5); }
  else if (kind === 'bite') { ring(o, sr, 0, rnd(1600, 2200), 0.6, 0.003); nz(o, sr, 0, 0.02, BP, 2500, 2, (t) => ad(t, 0.0005, 0.006), 0.7); thud(o, sr, 0, 120, 0.6, 0.03); nz(o, sr, 0.004, 0.12, LP, 1200, 0.7, (t) => ad(t, 0.003, 0.04), 0.45); }
  else if (kind === 'blunt') { thud(o, sr, 0, 72, 1, 0.07, 0.6); nz(o, sr, 0, 0.2, LP, 600, 0.7, (t) => ad(t, 0.002, 0.05), 0.6); clicks(o, sr, 0.005, 0.1, 10, 2000, 6000, 0.0008, 0.25); }
  else { nz(o, sr, 0, 0.38, HP, 3000, 0.7, (t) => ad(t, 0.01, 0.12), 0.5); clicks(o, sr, 0, 0.3, 30, 1500, 6000, 0.0008, 0.5); thud(o, sr, 0, 90, 0.5, 0.03); }
  return fin(o, sr);
}

// ---- the hunters ----
// Calls are shaped vowel by vowel: s scales the speaker's pitch, fs his formants (head size).
function hunterCall(sr, kind) {
  const s = rnd(0.88, 1.15), fs = rnd(0.95, 1.08);
  const o = zeros(sr, 1.6);
  const syl = (at, P, g = 1) => put(o, voice(sr, { breath: 0.18, bright: 3800, jit: 0.4, drive: 1.2, ...P }), sr, at, g);
  if (kind === 'sight') { // "hai, YAA!": a sharp alert, then the long carrying call
    syl(0, { dur: 0.24, f0: curve([[0, 210 * s], [0.05, 300 * s], [0.24, 280 * s]]), amp: (t) => ad(t, 0.015, 0.3) * c01((0.24 - t) / 0.04), form: vpath([[0.02, 'a'], [0.12, 'a'], [0.22, 'i']], fs) }, 0.8);
    syl(0.3, { dur: 0.62, f0: curve([[0, 300 * s], [0.08, 345 * s], [0.45, 330 * s], [0.62, 240 * s]]), amp: (t) => c01(t / 0.03) * c01((0.62 - t) / 0.2), form: vpath([[0, 'i'], [0.07, 'a'], [0.62, 'a']], fs), vib: [5.5, 0.015], rough: 0.08 });
  } else if (kind === 'ulul') { // a second man's ululation: the tongue flicks the vowel
    syl(0, { dur: 1.1, f0: curve([[0, 400 * s], [1.1, 440 * s]]), amp: (t) => c01(t / 0.05) * c01((1.1 - t) / 0.2) * (0.65 + 0.35 * Math.sin(TW * 7.5 * t)),
      form: (t) => vmix(VOW.e, VOW.u, 0.5 + 0.5 * Math.sin(TW * 7.5 * t)).map(([f, q, g]) => [f * fs * 1.08, q, g]), pure: 0.2, breath: 0.1 });
  } else if (kind === 'search') { // "ho-oo... a?": calling across the bush, rising like a question
    syl(0, { dur: 0.95, f0: curve([[0, 175 * s], [0.35, 165 * s], [0.85, 245 * s], [0.95, 235 * s]]), amp: (t) => c01(t / 0.06) * c01((0.95 - t) / 0.15), form: vpath([[0, 'o'], [0.5, 'u'], [0.8, 'a'], [0.95, 'a']], fs), vib: [5, 0.012] });
  } else if (kind === 'lost') { // "ehh...": a falling, let-down call
    syl(0, { dur: 0.8, f0: curve([[0, 235 * s], [0.8, 140 * s]]), amp: (t) => ad(t, 0.03, 0.22), form: vpath([[0, 'e'], [0.65, 'a']], fs), breath: 0.4 });
  } else if (kind === 'found') { // "yip yip, hooo": the trail is back
    syl(0, { dur: 0.1, f0: () => 380 * s, amp: (t) => ad(t, 0.01, 0.05), form: vpath([[0, 'i'], [0.1, 'e']], fs) });
    syl(0.16, { dur: 0.1, f0: () => 390 * s, amp: (t) => ad(t, 0.01, 0.05), form: vpath([[0, 'i'], [0.1, 'e']], fs) });
    syl(0.34, { dur: 0.6, f0: curve([[0, 300 * s], [0.2, 335 * s], [0.6, 280 * s]]), amp: (t) => c01(t / 0.04) * c01((0.6 - t) / 0.2), form: vpath([[0, 'u'], [0.15, 'o'], [0.6, 'o']], fs), vib: [5.5, 0.015] });
  } else if (kind === 'whistle') { // a scout's finger whistle, two tones
    chirp(o, sr, 0, 0.25, curve([[0, 1600 * s], [0.25, 2300 * s]]), (t) => c01(t / 0.02) * c01((0.25 - t) / 0.03) * 0.5, 0.05);
    chirp(o, sr, 0.3, 0.42, curve([[0, 2350 * s], [0.42, 1500 * s]]), (t) => c01(t / 0.02) * c01((0.42 - t) / 0.08) * 0.5, 0.05);
    nz(o, sr, 0, 0.72, BP, 2000 * s, 3, (t) => (t < 0.25 || t > 0.3 ? 1 : 0), 0.04);
  } else if (kind === 'grunt') { // effort: the throw
    syl(0, { dur: 0.2, f0: curve([[0, 140 * s], [0.2, 100 * s]]), amp: (t) => ad(t, 0.01, 0.08), form: vpath([[0, 'uh'], [0.2, 'uh']], fs), breath: 0.5, rough: 0.25, drive: 1.5 });
  } else if (kind === 'oof') { // knocked flat
    syl(0, { dur: 0.32, f0: curve([[0, 175 * s], [0.32, 105 * s]]), amp: (t) => ad(t, 0.008, 0.12), form: vpath([[0, 'u'], [0.32, 'o']], fs), breath: 0.45, rough: 0.35, drive: 1.5 });
  } else if (kind === 'inhale') {
    nz(o, sr, 0, 0.35, BP, (t) => 1200 + 4000 * t, 1.2, (t) => Math.sin(Math.PI * c01(t / 0.35) * 0.9) ** 2, 0.5, pink);
  }
  return fin(o, sr, 0.9, 0.001, 0.05);
}
function hunterSfx(sr, kind) {
  let o;
  switch (kind) {
    case 'creak': { // the shaft bending back: stick-slip friction through the wood's resonances
      o = zeros(sr, 0.6);
      const imp = zeros(sr, 0.6), d = rnd(0.35, 0.45);
      let t = 0.02;
      while (t < d) { const k = t / d, i = Math.floor(t * sr); imp[i] += rnd(0.4, 1) * (0.4 + 0.6 * Math.sin(Math.PI * k)); t += 1 / (60 + 140 * k + rnd(-10, 10)); }
      for (const [f, q, g] of [[rnd(420, 520), 10, 1], [rnd(1050, 1250), 12, 0.7], [rnd(2400, 2900), 14, 0.4]]) put(o, svf(imp.slice(), sr, BP, f, q), sr, 0, g);
      return fin(o, sr);
    }
    case 'whoosh': { // the spear leaving the hand: a rising, then falling, rush of air
      o = zeros(sr, 0.5);
      const pk = rnd(0.1, 0.14);
      nz(o, sr, 0, 0.45, BP, (t) => 500 + 1900 * Math.exp(-(((t - pk) / 0.07) ** 2)), 1.6, (t) => c01(t / pk) ** 2 * Math.exp(-Math.max(0, t - pk) / 0.09), 1, pink);
      nz(o, sr, 0, 0.45, HP, 3500, 0.7, (t) => Math.exp(-(((t - pk) / 0.05) ** 2)), 0.25);
      return fin(o, sr);
    }
    case 'thunk': { // the point punching into earth, and the shaft left quivering
      o = zeros(sr, 0.7);
      thud(o, sr, 0, rnd(80, 95), 1, 0.04, 0.6);
      nz(o, sr, 0, 0.08, LP, 2500, 0.7, (t) => ad(t, 0.001, 0.025), 0.5);
      clicks(o, sr, 0.01, 0.14, 10, 1500, 5000, 0.001, 0.3);
      const f = rnd(130, 180), w = rnd(13, 19);
      for (let i = 0, n = Math.floor(0.6 * sr); i < n; i++) { const t = i / sr; o[i] += (Math.sin(TW * f * t) + 0.3 * Math.sin(TW * 2.7 * f * t)) * Math.exp(-t / 0.17) * (0.55 + 0.45 * Math.sin(TW * w * t)) * 0.3 * c01(t / 0.004); }
      return fin(o, sr);
    }
    case 'clack': // on rock: a hard clack and the spear skittering off
      o = zeros(sr, 0.45);
      ring(o, sr, 0, rnd(2000, 2500), 0.6, 0.01); ring(o, sr, 0, rnd(3200, 3800), 0.4, 0.006);
      nz(o, sr, 0, 0.02, BP, 3000, 2, (t) => ad(t, 0.0003, 0.008), 0.6);
      thud(o, sr, 0, 150, 0.4, 0.015);
      for (const at of [rnd(0.07, 0.1), rnd(0.15, 0.2), rnd(0.24, 0.3)]) { ring(o, sr, at, rnd(1800, 2800), 0.25, 0.006); ring(o, sr, at, rnd(900, 1300), 0.15, 0.012); }
      return fin(o, sr);
    case 'plunk': // into water
      o = zeros(sr, 0.5);
      ring(o, sr, 0.005, rnd(250, 350), 0.7, 0.05, 18);
      nz(o, sr, 0, 0.25, LP, (t) => 500 + 4000 * Math.exp(-t * 15), 0.8, (t) => ad(t, 0.003, 0.05), 0.5);
      for (let k = 0; k < 6; k++) ring(o, sr, rnd(0.05, 0.35), rnd(1000, 3000), rnd(0.05, 0.15), 0.01, 25);
      return fin(o, sr);
    case 'knock': // a man slammed down, his spear clattering
      o = zeros(sr, 0.6);
      thud(o, sr, 0, 60, 1, 0.09, 0.6); thud(o, sr, 0.1, 80, 0.55, 0.05, 0.4);
      nz(o, sr, 0, 0.4, LP, 1500, 0.7, (t) => ad(t, 0.005, 0.12), 0.5);
      for (const at of [rnd(0.13, 0.17), rnd(0.21, 0.25), rnd(0.28, 0.33)]) { ring(o, sr, at, rnd(900, 1500), 0.3, 0.02); ring(o, sr, at, rnd(2300, 3000), 0.15, 0.008); }
      return fin(o, sr);
    case 'footfall': // a bare foot running on hard ground, heard more through the ground than the air
      o = zeros(sr, 0.18);
      thud(o, sr, 0, rnd(55, 75), 1, 0.035, 0.6);
      nz(o, sr, 0, 0.1, LP, 500, 0.7, (t) => ad(t, 0.002, 0.03), 0.5);
      return fin(o, sr);
  }
  return fin(zeros(sr, 0.1), sr);
}

// ---- dogs ----
function dogSfx(sr, kind) {
  const p = rnd(0.85, 1.2);
  let o;
  if (kind === 'bark') { // "wuff": the jaw opens on a rough burst and closes as the pitch drops
    o = voice(sr, { dur: rnd(0.13, 0.18), f0: curve([[0, 380 * p], [0.02, 540 * p], [0.08, 420 * p], [0.16, 260 * p]]), amp: (t) => ad(t, 0.004, 0.05),
      form: (t) => { const k = c01(t / 0.04) - c01((t - 0.06) / 0.08); return [[p * (500 + 450 * k), 4, 1], [p * (1100 + 600 * k), 5, 0.6], [p * 2700, 6, 0.3]]; }, breath: 0.45, rough: 0.4, bright: 5000, drive: 1.8 });
    return fin(nz(o, sr, 0, 0.03, BP, 1800, 1, (t) => ad(t, 0.001, 0.008), 0.3 * peakOf(o)), sr);
  }
  if (kind === 'yelp') {
    o = zeros(sr, 0.5);
    put(o, voice(sr, { dur: 0.2, f0: curve([[0, 1100 * p], [0.04, 1500 * p], [0.2, 750 * p]]), amp: (t) => ad(t, 0.004, 0.08), form: () => [[1000 * p, 3, 1], [2100 * p, 4, 0.6], [3200, 5, 0.3]], pure: 0.35, breath: 0.25, rough: 0.2 }), sr, 0);
    put(o, voice(sr, { dur: 0.16, f0: curve([[0, 1250 * p], [0.16, 700 * p]]), amp: (t) => ad(t, 0.004, 0.06), form: () => [[1000 * p, 3, 1], [2100 * p, 4, 0.6], [3200, 5, 0.3]], pure: 0.35, breath: 0.3, rough: 0.2 }), sr, 0.24, 0.6);
    return fin(o, sr);
  }
  if (kind === 'whine') {
    const d = rnd(0.6, 0.9);
    return fin(voice(sr, { dur: d, f0: (t) => 950 * p * (1 + 0.12 * Math.sin(TW * 4.5 * t) - 0.15 * t), amp: (t) => c01(t / 0.08) * c01((d - t) / 0.25) ** 1.5 * (0.7 + 0.3 * Math.sin(TW * 3 * t)), form: () => [[1000 * p, 3, 1], [2500 * p, 4, 0.4], [3500, 5, 0.1]], pure: 0.6, breath: 0.25 }), sr);
  }
  // bite: a snarl and the snap of teeth
  o = voice(sr, { dur: 0.32, f0: (t) => 120 * p * (1 + 0.15 * Math.sin(t * 40)), amp: (t) => c01(t / 0.02) * c01((0.32 - t) / 0.08), form: () => [[700 * p, 3, 1], [1500 * p, 4, 0.6], [2800, 5, 0.3]], breath: 0.5, rough: 0.85, bright: 4000, drive: 1.6 });
  ring(o, sr, 0.2, rnd(1800, 2400), 0.8 * peakOf(o), 0.003);
  return fin(o, sr);
}

// ---- animals ----
function animalSfx(sr, kind) {
  const p = rnd(0.9, 1.12);
  let o;
  const V = (P) => voice(sr, P);
  switch (kind) {
    case 'snort': // gazelle alarm: a sharp nasal blow, sometimes doubled
      o = zeros(sr, 0.45);
      nz(o, sr, 0, 0.18, BP, (t) => 1500 - 2500 * t, 1.5, (t) => ad(t, 0.004, 0.05), 0.8, pink);
      put(o, V({ dur: 0.14, f0: () => 220 * p, amp: (t) => ad(t, 0.004, 0.05), form: () => [[1100, 3, 1], [2400, 4, 0.5], [3500, 5, 0.2]], breath: 1, rough: 0.3 }), sr, 0, 0.4);
      if (Math.random() < 0.5) nz(o, sr, 0.2, 0.12, BP, 1300, 1.5, (t) => ad(t, 0.004, 0.03), 0.45, pink);
      return fin(o, sr);
    case 'stot': { // pronking: all four hooves strike together, bounce after bounce
      o = zeros(sr, 1.5);
      const gap = rnd(0.3, 0.36);
      for (let k = 0; k < 4; k++) { const a = 1 - k * 0.15; hoof(o, sr, k * gap, a); hoof(o, sr, k * gap + 0.012, a * 0.8); }
      return fin(o, sr);
    }
    case 'hoof': o = zeros(sr, 0.15); hoof(o, sr, 0, 1); return fin(o, sr);
    case 'stride': o = zeros(sr, 0.2); thud(o, sr, 0, rnd(75, 90), 1, 0.035, 0.6); ring(o, sr, 0, rnd(1000, 1400), 0.2, 0.004); nz(o, sr, 0, 0.1, LP, 1800, 0.7, (t) => ad(t, 0.003, 0.03), 0.3); return fin(o, sr);
    case 'zebra': { // "kwa-ha, kwa-ha": a barking whinny, out-breath and in-breath
      o = zeros(sr, 1.2);
      const n = 3 + ((Math.random() * 2) | 0), gap = rnd(0.2, 0.24);
      for (let k = 0; k < n; k++) {
        put(o, V({ dur: 0.14, f0: curve([[0, 520 * p], [0.04, 700 * p], [0.14, 580 * p]]), amp: (t) => ad(t, 0.008, 0.06), form: () => VOW.a.map(([f, q, g]) => [f * 1.1, q * 0.6, g]), rough: 0.5, breath: 0.3, bright: 5000, drive: 1.4 }), sr, k * gap, 1 - k * 0.12);
        put(o, V({ dur: 0.1, f0: () => 420 * p, amp: (t) => Math.sin(Math.PI * c01(t / 0.1)), form: () => VOW.e, breath: 0.75, rough: 0.3 }), sr, k * gap + 0.13, 0.35);
      }
      return fin(o, sr);
    }
    case 'gnu': // wildebeest: a short nasal honk-grunt, "gnu"
      o = zeros(sr, 0.7);
      for (let k = 0, n = 1 + ((Math.random() * 2) | 0); k < n; k++) put(o, V({ dur: 0.3, f0: curve([[0, 95 * p], [0.08, 120 * p], [0.3, 82 * p]]), amp: (t) => ad(t, 0.03, 0.1), form: () => [[260, 4, 1], [950, 5, 0.3], [2400, 6, 0.12]], rough: 0.55, breath: 0.3, low: 0.3, bright: 2500 }), sr, k * 0.34, 1 - k * 0.3);
      return fin(o, sr);
    case 'grunt': // warthog
      o = zeros(sr, 0.6);
      for (let k = 0, n = 2 + ((Math.random() * 2) | 0); k < n; k++) put(o, V({ dur: 0.13, f0: () => 85 * p * rnd(0.9, 1.1), amp: (t) => ad(t, 0.008, 0.045), form: () => [[450, 3, 1], [1000, 4, 0.4], [2400, 5, 0.15]], rough: 0.9, breath: 0.6, low: 0.3 }), sr, k * rnd(0.14, 0.19), rnd(0.7, 1));
      return fin(o, sr);
    case 'squeal': // warthog, charging or caught
      return fin(V({ dur: rnd(0.35, 0.45), f0: curve([[0, 1100 * p], [0.08, 1500 * p], [0.4, 950 * p]]), amp: (t) => c01(t / 0.02) * c01((0.42 - t) / 0.12), form: () => [[1500, 3, 1], [2900, 4, 0.6], [4200, 5, 0.3]], rough: 0.45, breath: 0.25, bright: 7000, drive: 1.6 }), sr);
    case 'thump': // hare: the hind foot drummed on the ground
      o = zeros(sr, 0.45);
      for (let k = 0; k < 2 + ((Math.random() * 2) | 0); k++) thud(o, sr, k * rnd(0.1, 0.13), 70, 1, 0.03, 0.4);
      return fin(o, sr);
    case 'scream': // hare caught
      return fin(V({ dur: 0.35, f0: curve([[0, 1100 * p], [0.08, 1350 * p], [0.35, 800 * p]]), amp: (t) => c01(t / 0.01) * c01((0.35 - t) / 0.1), form: () => VOW.i.map(([f, q, g]) => [f * 1.5, q * 0.6, g]), rough: 0.35, breath: 0.3, bright: 7000 }), sr);
    case 'shriek': // hyrax: piercing rising shrieks
      o = zeros(sr, 0.7);
      for (let k = 0, n = 2 + ((Math.random() * 2) | 0); k < n; k++) put(o, V({ dur: 0.16, f0: curve([[0, 1600 * p], [0.16, 3000 * p]]), amp: (t) => ad(t, 0.01, 0.07), form: () => [[2600, 3, 1], [4200, 4, 0.5], [5500, 5, 0.2]], pure: 0.3, rough: 0.25, bright: 8000 }), sr, k * 0.21, 1 - k * 0.15);
      return fin(o, sr);
    case 'boom': // ostrich: a hollow hum through a closed beak, "boo, booooom"
      o = zeros(sr, 1.6);
      put(o, V({ dur: 0.3, f0: () => 62 * p, amp: (t) => Math.sin(Math.PI * c01(t / 0.3)), form: () => [[150, 1.5, 1], [300, 2, 0.25], [600, 3, 0.04]], pure: 0.9, low: 1, breath: 0.02, bright: 250 }), sr, 0, 0.6);
      put(o, V({ dur: 1.0, f0: curve([[0, 62 * p], [1, 54 * p]]), amp: (t) => c01(t / 0.25) * c01((1 - t) / 0.4), form: () => [[150, 1.5, 1], [300, 2, 0.25], [600, 3, 0.04]], pure: 0.9, low: 1, breath: 0.02, bright: 250 }), sr, 0.45);
      return fin(o, sr, 0.9, 0.01, 0.1);
    case 'kek': { // guineafowl: "kek-kek-kek-kerrrr", harsh and fast
      o = zeros(sr, 1.3);
      const n = 6 + ((Math.random() * 4) | 0), gap = rnd(0.08, 0.1);
      for (let k = 0; k < n; k++) put(o, V({ dur: 0.05, f0: () => 1300 * p * rnd(0.95, 1.05), amp: (t) => ad(t, 0.002, 0.015), form: () => [[1700, 3, 1], [3200, 4, 0.5], [4500, 5, 0.25]], rough: 0.6, breath: 0.5, bright: 7000 }), sr, k * gap, rnd(0.7, 1));
      put(o, V({ dur: 0.4, f0: () => 1100 * p, amp: (t) => (Math.sin(TW * 35 * t) > 0 ? 1 : 0.15) * c01((0.4 - t) / 0.15), form: () => [[1600, 3, 1], [3000, 4, 0.5], [4500, 5, 0.2]], rough: 0.7, breath: 0.5, bright: 7000 }), sr, n * gap + 0.02, 0.7);
      return fin(o, sr);
    }
    case 'whirr': case 'flap': { // wings taking off: fast beats for small birds, slow for big ones
      const big = kind === 'flap', per = big ? rnd(0.1, 0.13) : rnd(0.04, 0.055), n = big ? 9 : 14;
      o = zeros(sr, per * n + 0.2);
      for (let k = 0; k < n; k++) nz(o, sr, k * per, per * 1.4, BP, rnd(big ? 350 : 600, big ? 600 : 1000), 0.9, (t) => ad(t, per * 0.25, per * 0.3), Math.exp(-k / (n * 0.6)));
      return fin(o, sr);
    }
    case 'honk': // flamingo: a nasal goose-like honk
      return fin(V({ dur: rnd(0.14, 0.2), f0: curve([[0, 520 * p], [0.18, 470 * p]]), amp: (t) => c01(t / 0.015) * c01((0.18 - t) / 0.04), form: () => [[900, 4, 1], [1700, 5, 0.8], [2700, 6, 0.4]], rough: 0.2, breath: 0.15, bright: 6000 }), sr);
    case 'flock': { // a flamingo flock lifting: honks over honks, and wings
      o = zeros(sr, 2.2);
      for (let k = 0; k < 12; k++) { const q = p * rnd(0.85, 1.2), d = rnd(0.12, 0.2); put(o, V({ dur: d, f0: (t) => 500 * q * (1 - 0.15 * t / d), amp: (t) => c01(t / 0.015) * c01((d - t) / 0.04), form: () => [[900 * q, 4, 1], [1700 * q, 5, 0.8], [2700, 6, 0.4]], rough: 0.2, breath: 0.15, bright: 6000 }), sr, rnd(0, 1.6), rnd(0.3, 1)); }
      for (let k = 0; k < 14; k++) nz(o, sr, k * 0.11 + rnd(0, 0.03), 0.16, BP, rnd(350, 600), 0.9, (t) => ad(t, 0.03, 0.04), 0.5 * Math.exp(-k / 9), pink);
      return fin(o, sr);
    }
    case 'bleat': // gazelle caught
      return fin(V({ dur: 0.32, f0: curve([[0, 620 * p], [0.1, 480 * p], [0.32, 360 * p]]), amp: (t) => c01(t / 0.01) * c01((0.32 - t) / 0.12), form: () => VOW.e.map(([f, q, g]) => [f * 1.2, q * 0.6, g]), rough: 0.4, breath: 0.3, bright: 6000, vib: [12, 0.04] }), sr);
    case 'whoop': // hyena: a rising "whoo-OOP"
      return fin(V({ dur: rnd(0.95, 1.2), f0: (t) => 220 * p * Math.pow(4.2, c01(t / 0.95)), amp: (t) => c01(t / 0.12) * c01((1.05 - t) / 0.12) * (0.55 + 0.45 * c01(t)), form: (t) => vmix(VOW.u, VOW.o, c01(t)), pure: 0.55, breath: 0.12, vib: [7, 0.01] }), sr, 0.9, 0.01, 0.06);
    case 'giggle': { // hyena: a run of breathy "hee" notes, each bent down
      const n = 9 + ((Math.random() * 5) | 0), per = rnd(0.085, 0.1), base = Array.from({ length: n }, (_, k) => p * (650 + (k % 2) * 120 + rnd(-40, 40)));
      return fin(V({ dur: n * per + 0.05, f0: (t) => { const k = Math.min(n - 1, Math.floor(t / per)); return base[k] * (1 - 0.15 * c01((t - k * per) / (per * 0.8))); }, amp: (t) => { const u = t - Math.floor(t / per) * per; return u < per * 0.8 ? ad(u, 0.006, 0.035) : 0; },
        form: () => [[550, 4, 1], [2000, 6, 0.6], [2900, 7, 0.3]], breath: 0.35, rough: 0.2, bright: 5000 }), sr);
    }
    case 'hsnarl': // hyena biting
      return fin(V({ dur: 0.35, f0: (t) => 180 * p * (1 + 0.2 * Math.sin(t * 30)), amp: (t) => c01(t / 0.015) * c01((0.35 - t) / 0.1), form: () => VOW.a, breath: 0.5, rough: 0.85, bright: 4500, drive: 1.6 }), sr);
    case 'roar': { // lion: a full-chested roar, then the grunts that trail it
      o = zeros(sr, 4.4);
      put(o, V({ dur: 1.6, f0: curve([[0, 105 * p], [0.35, 185 * p], [0.9, 150 * p], [1.6, 85 * p]]), amp: (t) => c01(t / 0.15) * c01((1.6 - t) / 0.5),
        form: (t) => { const k = Math.sin(Math.PI * c01(t / 1.6)); return [[200 + 120 * k, 3, 1], [450 + 300 * k, 3, 0.8], [900 + 400 * k, 4, 0.5], [1700, 5, 0.25], [2600, 6, 0.12]]; },
        rough: 0.6, flutter: 45, breath: 0.2, low: 0.7, bright: 1100, drive: 1.6 }), sr, 0);
      for (let k = 0; k < 4; k++) put(o, V({ dur: 0.35, f0: curve([[0, 120 * p], [0.35, 80 * p]]), amp: (t) => ad(t, 0.04, 0.12), form: () => [[260, 3, 1], [600, 3, 0.7], [1300, 4, 0.3], [2200, 5, 0.1]], rough: 0.6, breath: 0.25, low: 0.6, bright: 1100, drive: 1.4 }), sr, 1.85 + k * rnd(0.5, 0.62), 0.7 - k * 0.12);
      return fin(o, sr, 0.9, 0.005, 0.2);
    }
    case 'charge': // lion: a snarling roar as it comes
      return fin(V({ dur: 1.0, f0: curve([[0, 150 * p], [0.2, 240 * p], [0.6, 190 * p], [1, 110 * p]]), amp: (t) => c01(t / 0.05) * c01((1 - t) / 0.35),
        form: () => [[350, 3, 1], [800, 3, 0.8], [1500, 4, 0.4], [2600, 5, 0.15]], rough: 0.85, flutter: 50, breath: 0.35, low: 0.5, bright: 1800, drive: 1.8 }), sr);
    case 'lgrunt': // a resting lion's soft grunts
      o = zeros(sr, 1.6);
      for (let k = 0; k < 3; k++) put(o, V({ dur: 0.3, f0: curve([[0, 110 * p], [0.3, 80 * p]]), amp: (t) => ad(t, 0.04, 0.1), form: () => [[260, 3, 1], [600, 3, 0.6], [1300, 4, 0.2]], rough: 0.5, breath: 0.4, low: 0.5, bright: 1500 }), sr, k * 0.5, 1 - k * 0.2);
      return fin(o, sr);
    case 'vhiss': // vulture: a raspy hiss
      o = zeros(sr, 1);
      nz(o, sr, 0, 0.6, BP, 2800, 0.8, (t) => ad(t, 0.03, 0.2), 0.7, pink);
      put(o, V({ dur: 0.5, f0: () => 90, amp: (t) => ad(t, 0.03, 0.18), form: () => VOW.uh, breath: 1, rough: 0.7 }), sr, 0, 0.4);
      return fin(o, sr);
    case 'vwing': // a slow heavy wingbeat
      o = zeros(sr, 0.4);
      nz(o, sr, 0, 0.3, LP, 550, 0.8, (t) => Math.sin(Math.PI * c01(t / 0.25)) ** 2, 1, pink);
      nz(o, sr, 0.05, 0.2, BP, 1800, 1, (t) => Math.sin(Math.PI * c01(t / 0.18)) ** 3, 0.12);
      return fin(o, sr);
    case 'lurk': // a croc rising: water displaced, bubbles, a felt-more-than-heard rumble
      o = zeros(sr, 1.7);
      nz(o, sr, 0, 1.5, LP, 140, 0.8, (t) => Math.sin(Math.PI * c01(t / 1.5)) ** 1.5, 0.6, pink);
      put(o, V({ dur: 1.2, f0: () => 38 * p, amp: (t) => Math.sin(Math.PI * c01(t / 1.2)) ** 2, form: () => [[90, 2, 1], [250, 3, 0.3], [700, 4, 0.05]], pure: 0.5, low: 0.8, rough: 0.5, bright: 500 }), sr, 0.2, 0.5);
      for (let k = 0; k < 10; k++) ring(o, sr, rnd(0.1, 1.4), rnd(150, 600), rnd(0.15, 0.4), rnd(0.03, 0.06), rnd(15, 40));
      return fin(o, sr, 0.9, 0.01, 0.1);
    case 'csnap': // jaws slamming shut, and the water they burst from
      o = zeros(sr, 0.8);
      ring(o, sr, 0.02, rnd(2400, 2900), 0.8, 0.004); ring(o, sr, 0.02, rnd(1200, 1600), 0.5, 0.008);
      nz(o, sr, 0.02, 0.02, BP, 3000, 1, (t) => ad(t, 0.0003, 0.006), 0.8);
      thud(o, sr, 0.02, 90, 0.9, 0.05);
      nz(o, sr, 0, 0.5, LP, (t) => 500 + 5000 * Math.exp(-t * 12), 0.7, (t) => ad(t, 0.003, 0.12), 0.9);
      for (let k = 0; k < 10; k++) ring(o, sr, rnd(0.06, 0.45), rnd(1000, 4000), rnd(0.05, 0.2), 0.01, 25);
      return fin(o, sr);
    case 'csink': // going back under: big slow bubbles and a swirl
      o = zeros(sr, 1.1);
      nz(o, sr, 0, 0.95, LP, (t) => 200 + 250 * Math.sin(Math.PI * t), 0.9, (t) => Math.sin(Math.PI * c01(t / 0.95)) ** 2, 0.6, pink);
      for (let k = 0; k < 5; k++) ring(o, sr, rnd(0.1, 0.7), rnd(110, 260), rnd(0.4, 0.8), rnd(0.05, 0.08), rnd(8, 14));
      return fin(o, sr, 0.9, 0.01, 0.1);
    case 'herdcome': { // a stampede building over the rise: a rumble swelling, hooves thickening
      o = zeros(sr, 3.6);
      nz(o, sr, 0, 3.6, LP, (t) => 70 + 120 * t / 3.6, 0.8, (t) => c01(t / 3) ** 1.5 * c01((3.6 - t) / 0.4), 1, brown);
      for (let t = 0.3; t < 3.4; t += 0.16 / (0.3 + t / 3)) thud(o, sr, t + rnd(0, 0.05), rnd(55, 85), 0.25 * (0.3 + t / 3.4), 0.03, 0.5);
      return fin(o, sr, 0.9, 0.05, 0.3);
    }
  }
  return fin(zeros(sr, 0.1), sr);
}

// ---- weather and the land ----
function worldSfx(sr, kind) {
  let o;
  switch (kind) {
    case 'thunderNear': { // a crack overhead, then the roll tumbling away
      o = zeros(sr, 5);
      nz(o, sr, 0, 0.06, HP, 1200, 0.7, (t) => ad(t, 0.0005, 0.012), 1);
      clicks(o, sr, 0, 0.25, 70, 1500, 6000, 0.002, 0.5);
      const b = wob(5, 3.5);
      nz(o, sr, 0.02, 4.9, LP, (t) => 900 * Math.exp(-t * 1.2) + 110, 0.7, (t) => ad(t, 0.05, 1.3) * Math.max(0.12, 0.5 + 0.9 * b(t)) ** 2, 1.2, brown);
      return fin(o, sr, 0.95, 0.0005, 0.6);
    }
    case 'thunderFar': {
      o = zeros(sr, 5);
      const b = wob(5, 2.5);
      nz(o, sr, 0, 5, LP, (t) => 300 * Math.exp(-t * 0.5) + 80, 0.7, (t) => c01(t / 0.6) * Math.exp(-Math.max(0, t - 0.6) / 1.5) * Math.max(0.15, 0.5 + 0.9 * b(t)) ** 2, 1, brown);
      return fin(o, sr, 0.9, 0.01, 0.6);
    }
    case 'strike': // lightning landing close: a tearing crack and the sizzle after
      o = zeros(sr, 1.2);
      nz(o, sr, 0, 0.04, HP, 800, 0.7, (t) => ad(t, 0.0003, 0.008), 1);
      clicks(o, sr, 0, 0.08, 40, 2000, 9000, 0.0015, 0.8);
      nz(o, sr, 0.01, 1.1, HP, 4000, 0.7, (t) => ad(t, 0.002, 0.35), 0.35);
      thud(o, sr, 0, 60, 0.8, 0.08, 0.5);
      return fin(o, sr, 0.95);
    case 'ignite': // grass going up: a whoomph and a burst of crackle
      o = zeros(sr, 1.4);
      nz(o, sr, 0, 1.2, LP, (t) => 150 + 1500 * c01(t / 0.25), 0.8, (t) => ad(t, 0.06, 0.35), 1, pink);
      clicks(o, sr, 0.1, 1.1, 60, 1500, 6000, 0.0012, 0.6);
      return fin(o, sr);
    case 'vent': // ashlands: a steam vent breathing out
      o = zeros(sr, 2);
      nz(o, sr, 0, 1.8, HP, (t) => 1500 + 800 * Math.sin(t * 3), 0.7, (t) => Math.sin(Math.PI * c01(t / 1.8)) ** 2, 0.6);
      nz(o, sr, 0, 1.8, LP, 110, 0.8, (t) => Math.sin(Math.PI * c01(t / 1.8)), 0.6, brown);
      for (let k = 0; k < 8; k++) ring(o, sr, rnd(0.1, 1.6), rnd(120, 300), 0.2, 0.04, 10);
      return fin(o, sr, 0.9, 0.01, 0.1);
    case 'gust': { // a gust through the dust: a whistle that swells and falls away
      const d = rnd(1.6, 2.6), f0 = rnd(450, 850), k = rnd(1.8, 2.6);
      o = zeros(sr, d);
      nz(o, sr, 0, d, BP, (t) => f0 * (1 + (k - 1) * Math.sin(Math.PI * c01(t / d)) ** 2), 9, (t) => Math.sin(Math.PI * c01(t / d)) ** 1.5, 1);
      nz(o, sr, 0, d, LP, 700, 0.7, (t) => Math.sin(Math.PI * c01(t / d)) ** 2, 0.6, pink);
      return fin(o, sr, 0.9, 0.01, 0.1);
    }
  }
  return fin(zeros(sr, 0.1), sr);
}

// ---- birds (the update loop asks for kinds 0..9), and the dawn chorus ----
function birdNotes(o, sr, at, kind, amp = 1) {
  const sw = (t0, d, f0, f1, a, h = 0.08) => chirp(o, sr, at + t0, d, (t) => f0 + (f1 - f0) * (t / d), (t) => c01(t / 0.006) * c01((d - t) / (d * 0.4)) * a * amp, h);
  switch (kind) {
    case 0: { const b = rnd(2200, 3800); for (let i = 0; i < 3; i++) sw(i * 0.12, 0.07, b, b * 1.35, 0.5); break; } // chirps
    case 1: sw(0, 0.22, 1300, 1250, 0.5, 0.03); sw(0.28, 0.18, 1750, 1700, 0.45, 0.03); break; // a boubou's duet
    case 2: for (let i = 0; i < 7; i++) chirp(o, sr, at + i * 0.055, 0.045, (t) => 3600 - i * 180 + 600 * Math.sin(t * 300), (t) => c01(t / 0.004) * c01((0.045 - t) / 0.02) * 0.35 * amp, 0.05); break; // trill
    case 3: { // dove: "coo, COO-coo"
      const f = rnd(480, 540);
      for (const [t0, d, a] of [[0, 0.3, 0.5], [0.42, 0.42, 0.6], [0.9, 0.3, 0.45]]) chirp(o, sr, at + t0, d, (t) => f * (1.04 - 0.08 * t / d), (t) => Math.sin(Math.PI * c01(t / d)) ** 1.5 * a * amp, 0.2);
      break;
    }
    case 4: for (let i = 0; i < 3; i++) put(o, voice(sr, { dur: 0.08, f0: () => 170, amp: (t) => ad(t, 0.005, 0.025), form: () => [[400, 3, 1], [1100, 4, 0.4]], rough: 0.6, breath: 0.2 }), sr, at + i * 0.12, 0.6 * amp); break; // frog
    case 5: sw(0, 0.25, 1500, 1100, 0.4, 0.4); sw(0.3, 0.3, 1450, 1000, 0.35, 0.4); break; // gull
    case 6: { const n = 14 + ((Math.random() * 10) | 0), f = rnd(900, 1150); chirp(o, sr, at, n * 0.035, (t) => f * (1 - 0.06 * ((t / 0.035) % 1)), (t) => (0.5 + 0.5 * Math.sin(TW * 28 * t)) * c01(t / 0.05) * c01((n * 0.035 - t) / 0.1) * 0.25 * amp, 0.1); break; } // nightjar churr
    case 7: put(o, animalSfx(sr, 'whoop'), sr, at, 0.4 * amp); break; // hyena, far off
    case 8: { const f = rnd(360, 420); for (const [t0, d, a] of [[0, 0.35, 0.45], [0.6, 0.2, 0.35], [0.85, 0.3, 0.4]]) chirp(o, sr, at + t0, d, (t) => f * (1 - 0.06 * t / d), (t) => Math.sin(Math.PI * c01(t / d)) * a * amp, 0.05); break; } // owl
    case 9: { const f = rnd(150, 180); for (let i = 0; i < 4; i++) chirp(o, sr, at + i * 0.32 + (i > 1 ? 0.25 : 0), 0.22, (t) => f * (i % 2 ? 0.85 : 1) * (1 - 0.05 * t / 0.22), (t) => Math.sin(Math.PI * c01(t / 0.22)) * 0.6 * amp, 0.3); break; } // ground hornbill
    case 10: { // francolin: a harsh accelerating "ke-ke-kerrak"
      for (let i = 0; i < 6; i++) put(o, voice(sr, { dur: 0.06, f0: () => 1100 + i * 40, amp: (t) => ad(t, 0.003, 0.02), form: () => [[1500, 3, 1], [2800, 4, 0.5]], rough: 0.6, breath: 0.4, bright: 6000 }), sr, at + i * (0.14 - i * 0.012), 0.5 * amp);
      break;
    }
    case 11: { // sunbird: a fast twittering run
      for (let i = 0; i < 10; i++) { const f = rnd(4000, 6500); chirp(o, sr, at + i * 0.06, 0.04, (t) => f * (1 + 2 * t), (t) => c01(t / 0.003) * c01((0.04 - t) / 0.015) * 0.25 * amp, 0.02); }
      break;
    }
  }
}
function birdTake(sr, kind) { const o = zeros(sr, kind === 6 ? 1.3 : kind === 7 ? 1.4 : 1.4); birdNotes(o, sr, 0.01, kind); return fin(o, sr, 0.8, 0.002, 0.05); }

// ---- interface ----
// A tuned tine: a few inharmonic partials, so pitched cues read as wood and metal, not beeps.
function tine(sr, f = 880) {
  const o = zeros(sr, 0.9);
  for (const [r, a, d] of [[1, 1, 0.16], [2.76, 0.32, 0.07], [5.4, 0.12, 0.03], [8.93, 0.05, 0.015]]) ring(o, sr, 0, f * r, a, d);
  return fin(o, sr, 0.9, 0.0005, 0.1);
}
function uiSfx(sr, kind) {
  const o = zeros(sr, 0.25);
  if (kind === 'tick') { ring(o, sr, 0, 1800, 0.7, 0.006); ring(o, sr, 0, 3100, 0.3, 0.003); nz(o, sr, 0, 0.02, BP, 2500, 3, (t) => ad(t, 0.0003, 0.003), 0.3); }
  else if (kind === 'tok') { ring(o, sr, 0, 620, 0.8, 0.03); ring(o, sr, 0, 1710, 0.35, 0.012); nz(o, sr, 0, 0.02, BP, 1500, 2, (t) => ad(t, 0.0003, 0.004), 0.3); }
  else { nz(o, sr, 0, 0.22, BP, (t) => 3200 * Math.exp(-t * 8) + 500, 2, (t) => ad(t, 0.01, 0.06), 1); } // swish: a spear going past
  return fin(o, sr);
}

// ---- ambience beds (stereo loops, rendered at a low rate: they are noise and insects) ----
function bedSfx(sr, kind) {
  switch (kind) {
    case 'wind': return bed(sr, 10, 0.15, (sr, d) => { const o = pink(Math.floor(d * sr)), w = wob(d, 0.3); svf(o, sr, LP, (t) => 330 + 200 * w(t), 0.6); const a = wob(d, 0.2); for (let i = 0; i < o.length; i++) o[i] *= 0.7 + 0.3 * a(i / sr); return o; });
    case 'leaves': return bed(sr, 8, 0.12, (sr, d) => {
      const o = grains(zeros(sr, d), sr, 0, d, Math.floor(d * 1100), 0.0018, 1); svf(o, sr, BP, 4200, 0.6);
      const g = wob(d, 0.6); for (let i = 0; i < o.length; i++) o[i] *= 0.3 + 0.7 * c01(0.5 + 0.7 * g(i / sr));
      return nz(o, sr, 0, d, LP, 1800, 0.6, (t) => 0.4 + 0.6 * c01(0.5 + 0.7 * g(t)), 0.2, pink);
    });
    case 'grass': return bed(sr, 8, 0.1, (sr, d) => { const w = wob(d, 0.8), o = zeros(sr, d); nz(o, sr, 0, d, BP, (t) => 2200 + 900 * w(t), 0.8, (t) => 0.35 + 0.65 * c01(0.5 + 0.6 * w(t)), 1, pink); return grains(o, sr, 0, d, d * 200, 0.002, 0.15); });
    case 'insects': return bed(sr, 8, 0.1, (sr, d) => { // day: a high buzz, katydid trains, grasshoppers rattling
      const o = zeros(sr, d);
      nz(o, sr, 0, d, BP, 7000, 2.5, (t) => 1 + 0.3 * Math.sin(TW * 47 * t), 0.25);
      const k = zeros(sr, d);
      for (let n = 0; n < d * 1.3; n++) { const t0 = rnd(0, d - 0.5), len = rnd(0.15, 0.4), r = rnd(60, 120), a = rnd(0.3, 1); for (let t = t0; t < t0 + len; t += 1 / r) grains(k, sr, t, t + 0.0005, 1, 0.003, a); }
      svf(k, sr, BP, rnd(5000, 6500), 3); put(o, k, sr, 0, 0.8);
      const g = zeros(sr, d);
      for (let n = 0; n < d * 0.3; n++) { const t0 = rnd(0, d - 0.8); for (let t = t0; t < t0 + 0.6; t += 1 / 18) grains(g, sr, t, t + 0.001, 1, 0.008, 0.6); }
      svf(g, sr, BP, 4000, 2); return put(o, g, sr, 0, 0.6);
    });
    case 'crickets': return bed(sr, 8, 0.1, (sr, d, ch) => { // night: a few near crickets chirping over a distant chorus
      const o = zeros(sr, d);
      for (let c = 0; c < 3; c++) {
        const f = rnd(3800, 5200), per = rnd(0.5, 1.1), np = 3 + ((Math.random() * 2) | 0), a = rnd(0.3, 1);
        for (let t = rnd(0, per); t < d - 0.2; t += per * rnd(0.97, 1.03)) for (let k = 0; k < np; k++) {
          const s = Math.floor((t + k * 0.03) * sr), n = Math.floor(0.016 * sr);
          for (let i = 0; i < n && s + i < o.length; i++) o[s + i] += Math.sin((TW * f * i) / sr) * Math.sin((Math.PI * i) / n) ** 2 * a;
        }
      }
      return nz(o, sr, 0, d, BP, 4600, 8, (t) => 0.6 + 0.4 * Math.sin(TW * 2.7 * t + ch), 0.35);
    });
    case 'frogs': return bed(sr, 8, 0.1, (sr, d) => { // reed frogs tinking, croaking trains, a toad's long trill
      const o = zeros(sr, d);
      for (let n = 0; n < d * 2.2; n++) { const t = rnd(0, d), f = rnd(2600, 3600); for (let k = 0; k < 1 + ((Math.random() * 3) | 0); k++) ring(o, sr, t + k * 0.11, f, rnd(0.2, 0.5), 0.01); }
      for (let n = 0; n < d * 0.6; n++) { const t0 = rnd(0, d - 1), r = rnd(12, 18), f = rnd(350, 550); for (let k = 0; k < 6 + Math.random() * 5; k++) { nz(o, sr, t0 + k / r, 0.03, BP, f * 1.3, 4, (t) => ad(t, 0.002, 0.01), 0.5); ring(o, sr, t0 + k / r, f, 0.25, 0.01); } }
      if (Math.random() < 0.7) { const t0 = rnd(0, d - 2.5), f = rnd(1000, 1400); for (let i = Math.floor(t0 * sr), e = i + Math.floor(2 * sr); i < e; i++) { const t = i / sr - t0; o[i] += Math.sin(TW * f * t) * Math.sin(Math.PI * ((t * 25) % 1)) ** 8 * 0.25 * Math.sin(Math.PI * t / 2); } }
      return o;
    });
    case 'water': return bed(sr, 8, 0.1, (sr, d) => { // lapping water, a trickle, the odd plop
      const w = wob(d, 0.5), o = zeros(sr, d);
      nz(o, sr, 0, d, LP, (t) => 450 + 200 * w(t), 0.7, (t) => 0.4 + 0.6 * c01(0.5 + 0.8 * w(t)), 0.8, pink);
      for (let n = 0; n < d * 25; n++) ring(o, sr, rnd(0, d), rnd(800, 3000), rnd(0.02, 0.07), 0.006, 30);
      for (let n = 0; n < d * 2; n++) ring(o, sr, rnd(0, d), rnd(200, 500), rnd(0.08, 0.2), 0.02, 15);
      return o;
    });
    case 'surf': return bed(sr, 14, 0.13, (sr, d, ch) => { // waves: the build, the crash, the long fizzing wash
      const o = zeros(sr, d);
      nz(o, sr, 0, d, LP, 300, 0.7, () => 1, 0.3, pink);
      for (let tw = ch * rnd(1.5, 3); tw < d; tw += rnd(6.5, 8)) {
        nz(o, sr, tw, 3, LP, (t) => 150 + 700 * c01(t / 3), 0.7, (t) => c01(t / 3) ** 2, 0.6, pink);
        nz(o, sr, tw + 3, 0.8, LP, 3500, 0.7, (t) => ad(t, 0.05, 0.35), 1, pink);
        nz(o, sr, tw + 3.1, 4, BP, 3000, 0.5, (t) => ad(t, 0.2, 1.5), 0.45);
        clicks(o, sr, tw + 3.2, tw + 6.5, 200, 3000, 8000, 0.0006, 0.12);
      }
      return o;
    });
    case 'desert': return bed(sr, 10, 0.12, (sr, d) => { // sand hiss and the odd thin whistle off a dune crest
      const w = wob(d, 0.3), w2 = wob(d, 0.2), o = zeros(sr, d);
      nz(o, sr, 0, d, HP, 3500, 0.7, (t) => 0.3 + 0.7 * c01(0.5 + w(t)), 0.5);
      nz(o, sr, 0, d, BP, 750, 25, (t) => 0.4 * c01(w2(t)), 1);
      nz(o, sr, 0, d, BP, 1180, 30, (t) => 0.3 * c01(-w2(t)), 1);
      return nz(o, sr, 0, d, LP, 250, 0.7, (t) => 0.6 + 0.4 * w(t), 0.6, pink);
    });
    case 'highwind': return bed(sr, 10, 0.13, (sr, d) => { // a howl over the ridges
      const w = wob(d, 0.15), a = wob(d, 0.25), o = zeros(sr, d);
      nz(o, sr, 0, d, BP, (t) => 320 + 120 * w(t), 3.5, (t) => 0.5 + 0.5 * c01(0.5 + a(t)), 1, pink);
      nz(o, sr, 0, d, BP, 950, 30, (t) => 0.5 * c01(a(t)), 1);
      return nz(o, sr, 0, d, LP, 200, 0.7, () => 1, 0.5, pink);
    });
    case 'ash': return bed(sr, 10, 0.12, (sr, d) => { // the ground grumbling, mud pots popping
      const w = wob(d, 0.3), o = zeros(sr, d);
      nz(o, sr, 0, d, LP, 90, 0.8, (t) => 0.6 + 0.4 * w(t), 1, brown);
      for (let n = 0; n < d * 3; n++) ring(o, sr, rnd(0, d), rnd(80, 250), rnd(0.2, 0.5), 0.04, 8);
      return nz(o, sr, 0, d, HP, 3000, 0.7, () => 1, 0.04);
    });
    case 'rainLight': return bed(sr, 6, 0.1, (sr, d) => {
      const o = zeros(sr, d);
      for (let n = 0; n < d * 35; n++) { const t = rnd(0, d); ring(o, sr, t, rnd(2500, 7000), rnd(0.1, 0.3), rnd(0.002, 0.005)); if (Math.random() < 0.25) ring(o, sr, t, rnd(400, 900), 0.12, 0.01, 20); }
      return nz(o, sr, 0, d, HP, 3000, 0.7, () => 1, 0.05, pink);
    });
    case 'rainHeavy': return bed(sr, 6, 0.14, (sr, d) => {
      const o = zeros(sr, d);
      nz(o, sr, 0, d, BP, 2500, 0.4, () => 1, 0.7, pink);
      nz(o, sr, 0, d, LP, 500, 0.7, () => 1, 0.5, pink);
      for (let n = 0; n < d * 220; n++) ring(o, sr, rnd(0, d), rnd(2000, 8000), rnd(0.05, 0.2), 0.003);
      return o;
    });
    case 'storm': return bed(sr, 10, 0.15, (sr, d) => { const w = wob(d, 0.1), o = zeros(sr, d); return nz(o, sr, 0, d, LP, 140, 0.8, (t) => 0.6 + 0.4 * w(t), 1, brown); });
    case 'fire': return bed(sr, 6, 0.12, (sr, d) => { // a grass fire: crackle, snaps, a fluttering roar
      const w = wob(d, 6), o = zeros(sr, d);
      nz(o, sr, 0, d, LP, 450, 0.7, (t) => 0.6 + 0.4 * w(t), 0.6, pink);
      clicks(o, sr, 0, d, d * 40, 1500, 6000, 0.0012, 0.8);
      for (let n = 0; n < d * 2; n++) { const t = rnd(0, d); ring(o, sr, t, rnd(800, 1500), 1, 0.004); nz(o, sr, t, 0.05, HP, 1500, 0.7, (x) => ad(x, 0.0005, 0.01), 0.4); }
      return nz(o, sr, 0, d, HP, 4000, 0.7, () => 1, 0.05);
    });
    case 'torch': return bed(sr, 6, 0.1, (sr, d) => { // a torch: the flame flapping, a light crackle
      const w = wob(d, 9), o = zeros(sr, d);
      nz(o, sr, 0, d, BP, 600, 0.8, (t) => 0.3 + 0.7 * Math.abs(w(t)), 1, pink);
      return clicks(o, sr, 0, d, d * 12, 1500, 5000, 0.001, 0.5);
    });
    case 'embers': return bed(sr, 8, 0.06, (sr, d) => { const o = zeros(sr, d); clicks(o, sr, 0, d, d * 4, 1500, 4000, 0.001, 0.4); return nz(o, sr, 0, d, BP, 1200, 0.5, () => 1, 0.05, pink); });
    case 'cicada': return bed(sr, 8, 0.12, (sr, d, ch) => { // heat: two cicadas, each a tymbal buzz that swells and dies
      const o = zeros(sr, d);
      for (const [f, r, per, off] of [[5200, 230, 3.7, ch], [6400, 180, 5.3, 1.7 + ch]]) nz(o, sr, 0, d, BP, f, 5, (t) => (0.5 + 0.5 * Math.sin(TW * r * t)) ** 4 * (0.3 + 0.7 * Math.sin((Math.PI * (t + off)) / per) ** 2), 1);
      return o;
    });
    case 'shimmer': return bed(sr, 8, 0.05, (sr, d) => { // heat haze: faint beating tones high up
      const o = zeros(sr, d);
      const w = wob(d, 0.25);
      for (let i = 0; i < o.length; i++) { const t = i / sr; o[i] = (0.3 * (Math.sin(TW * 1661 * t) + Math.sin(TW * 1664.5 * t)) + 0.2 * (Math.sin(TW * 2489 * t) + Math.sin(TW * 2493 * t))) * (0.35 + 0.65 * c01(0.5 + w(t))); }
      return nz(o, sr, 0, d, BP, 3300, 20, () => 1, 0.4);
    });
    case 'grit': return bed(sr, 8, 0.12, (sr, d) => { const w = wob(d, 0.5), o = grains(zeros(sr, d), sr, 0, d, d * 1500, 0.0015, 1); svf(o, sr, HP, 4500, 0.7); for (let i = 0; i < o.length; i++) o[i] *= 0.4 + 0.6 * c01(0.5 + w(i / sr)); return o; });
    case 'whistle': return bed(sr, 10, 0.12, (sr, d) => { // the whistling rocks: wind across holes, three tones coming and going
      const o = zeros(sr, d);
      for (const f of [620, 930, 1395]) { const a = wob(d, rnd(0.15, 0.3)); nz(o, sr, 0, d, BP, (t) => f * (1 + 0.004 * a(t)), 60, (t) => c01(0.3 + a(t)), 1); }
      return nz(o, sr, 0, d, BP, 1000, 2, () => 1, 0.05, pink);
    });
    case 'herd': return bed(sr, 6, 0.15, (sr, d) => { // a stampede going by: hooves without end, the ground rumbling
      const o = zeros(sr, d);
      for (let n = 0; n < d * 22; n++) { const t = rnd(0, d); thud(o, sr, t, rnd(60, 110), rnd(0.5, 1), 0.025, 0.6); ring(o, sr, t, rnd(1500, 2500), 0.12, 0.003); }
      return nz(o, sr, 0, d, LP, 150, 0.7, () => 1, 0.6, brown);
    });
  }
  return [zeros(sr, 1), zeros(sr, 1)];
}

// The recipe book: name -> takes, renderer, highest sample rate it needs (lower renders faster).
const SFX = {};
const def = (name, n, fn, maxSr = 32000) => { SFX[name] = { n, fn, maxSr }; };
for (const k of new Set(STEP_OF)) def('step_' + k, 6, (sr) => footstep(sr, k));
for (const k of ['snarl', 'yowl', 'growl', 'pantOut', 'pantIn', 'chuff', 'lap', 'tear', 'crunch', 'chew', 'pounce', 'climb', 'drop', 'overheat', 'rise']) def('cat_' + k, 4, (sr) => catSfx(sr, k));
for (const k of ['saw', 'settle', 'fall', 'heart']) def('cat_' + k, 2, (sr) => catSfx(sr, k));
for (const k of ['pierce', 'bite', 'blunt', 'burn']) def('hit_' + k, 3, (sr) => impact(sr, k));
for (const k of ['sight', 'ulul', 'search', 'lost', 'found', 'whistle', 'grunt', 'oof', 'inhale']) def('call_' + k, 4, (sr) => hunterCall(sr, k));
for (const k of ['creak', 'whoosh', 'thunk', 'clack', 'plunk', 'knock', 'footfall']) def('hunt_' + k, k === 'footfall' ? 6 : 4, (sr) => hunterSfx(sr, k), k === 'footfall' ? 12000 : 32000);
for (const k of ['bark', 'yelp', 'whine', 'bite']) def('dog_' + k, k === 'bark' ? 6 : 3, (sr) => dogSfx(sr, k));
for (const k of ['snort', 'stot', 'hoof', 'stride', 'zebra', 'gnu', 'grunt', 'squeal', 'thump', 'scream', 'shriek', 'boom', 'kek', 'whirr', 'flap', 'honk', 'flock', 'bleat', 'whoop', 'giggle', 'hsnarl', 'charge', 'lgrunt', 'vhiss', 'vwing', 'csnap', 'csink'])
  def('an_' + k, ['hoof', 'honk', 'stride'].includes(k) ? 5 : 3, (sr) => animalSfx(sr, k));
def('an_roar', 2, (sr) => animalSfx(sr, 'roar'), 22050);
def('an_lurk', 2, (sr) => animalSfx(sr, 'lurk'), 16000);
def('an_herdcome', 1, (sr) => animalSfx(sr, 'herdcome'), 16000);
def('w_thunderNear', 2, (sr) => worldSfx(sr, 'thunderNear'), 22050);
def('w_thunderFar', 2, (sr) => worldSfx(sr, 'thunderFar'), 12000);
for (const k of ['strike', 'ignite', 'vent', 'gust']) def('w_' + k, k === 'gust' ? 4 : 2, (sr) => worldSfx(sr, k), 24000);
for (let k = 0; k < 12; k++) def('bird' + k, 3, (sr) => birdTake(sr, k));
def('ui_tine', 1, (sr) => tine(sr), 44100);
for (const k of ['tick', 'tok', 'swish']) def('ui_' + k, 1, (sr) => uiSfx(sr, k), 44100);
const BEDS = ['wind', 'leaves', 'grass', 'insects', 'crickets', 'frogs', 'water', 'surf', 'desert', 'highwind', 'ash', 'rainLight', 'rainHeavy', 'storm', 'fire', 'torch', 'embers', 'cicada', 'shimmer', 'grit', 'whistle', 'herd'];
// each bed's level at full presence (beds are rendered to a common RMS, so these set the balance)
const BED_LVL = { wind: 0.3, leaves: 0.25, grass: 0.17, insects: 0.19, crickets: 0.22, frogs: 0.2, water: 0.15, surf: 0.33, desert: 0.22, highwind: 0.24, ash: 0.28,
  rainLight: 0.7, rainHeavy: 0.75, storm: 0.7, fire: 0.8, torch: 0.28, embers: 0.22, cicada: 0.3, shimmer: 0.05, grit: 0.25, whistle: 0.28, herd: 1 };
// beds with nothing above 5 kHz render at 12 kHz, most others at 16 kHz; only the hissiest need 22
const BED_SR = { storm: 12000, herd: 12000, ash: 12000, wind: 12000, highwind: 12000, whistle: 12000, insects: 22050, leaves: 22050, grit: 22050, crickets: 22050, frogs: 22050 };
for (const k of BEDS) def('bed_' + k, 1, (sr) => bedSfx(sr, k), BED_SR[k] || 16000);
// rendered takes, shared by every engine on the page (keyed by rate)
const RENDERED = new Map();
const renderTakes = (name, rate) => { const R = SFX[name], d = []; for (let i = 0; i < R.n; i++) d.push(R.fn(rate)); return d; };
// Loaded as a module worker (buildSfx does this), this file renders the bank off the main thread.
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = (e) => {
    for (const [name, rate] of e.data) {
      const data = renderTakes(name, rate), tr = [];
      for (const d of data) for (const c of Array.isArray(d) ? d : [d]) tr.push(c.buffer);
      self.postMessage({ name, rate, data }, tr);
    }
  };
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.8;
    this.sfxVol = 0.9;
    this.muted = false;
    this.intensity = 0;
    this.night = 0;
    this.rain = 0;
    this.biome = 0;
    this.coast = 0;
    this.fire = 0;
    this.tempo = 88;
    this.step = 0;
    this.nextTime = 0;
    this.section = 'A';
    this.theme = 'title';
    this.playing = false;
    this.lastBird = 0;
    this.menu = true;
    this.cache = new Map();
    // weather beds (set each frame by the game; storm/heat/fog are 0..1)
    this.dust = 0;
    this.heat = 0;
    this.fog = 0;
    this.storm = 0;
    this.wxOn = {};
    // the arrangement currently playing: variant, lead voice, harmony, key offset, tempo nudge
    this.sec = { v: 0, lead: 'kalimba', prog: PROG, xp: 0, dt: 0, alt: false };
    this.secN = 0;
    this.last = {}; // round-robin memory per sound
    this.log = null; // set to [] to record arrangement changes (tools/audio.html)
  }

  // A random index in [0, n) that never repeats the previous pick for this key.
  rr(key, n) {
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === this.last[key]) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    this.last[key] = i;
    return i;
  }
  jit(a, b) { return a + Math.random() * (b - a); }

  init(offline) {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC && !offline) return;
    const ctx = (this.ctx = offline || new AC());
    this.sr = ctx.sampleRate;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.amb = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.applyVolumes();

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    this.noise.getChannelData(0).set(noise(len));

    this.verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 2.6, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const b = ir.getChannelData(ch);
      for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / b.length, 2.8);
    }
    this.verb.buffer = ir;
    this.verbIn = ctx.createGain();
    this.verbIn.gain.value = 0.9;
    this.verbIn.connect(this.verb).connect(this.music);

    this.mbus = ctx.createBiquadFilter();
    this.mbus.type = 'lowpass';
    this.mbus.frequency.value = Math.min(18000, ctx.sampleRate / 2 - 100);
    // weather colours the band too: fog and dust close the top end
    this.wx = ctx.createBiquadFilter();
    this.wx.type = 'lowpass';
    this.wx.frequency.value = Math.min(18000, ctx.sampleRate / 2 - 100);
    this.mbus.connect(this.wx).connect(this.music);

    this.buildKit();
    this.startAmbience();
    // render instrument notes a few per frame instead of on first use
    this.warm = [];
    // (ranges cover the key changes, up a fourth or down a tone)
    for (let m = 44; m <= 81; m++) this.warm.push(['kora', m]);
    for (let m = 60; m <= 93; m++) this.warm.push(['kalimba', m]);
    for (let m = 48; m <= 86; m++) this.warm.push(['marimba', m]);
    for (let m = 36; m <= 81; m++) this.warm.push(['mbira', m]);
    for (let m = 36; m <= 43; m++) this.warm.push(['kora', m]);
    for (let m = 82; m <= 93; m++) this.warm.push(['kora', m]);
    this.nextTime = ctx.currentTime + 0.1;
    this.playing = true;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const m = this.muted ? 0 : 1;
    this.music.gain.value = this.musicVol * 0.55 * m;
    this.sfx.gain.value = this.sfxVol * 0.8 * m;
    this.amb.gain.value = this.sfxVol * 0.5 * m;
  }

  setMuffle(on) {
    if (!this.ctx) return;
    this.mbus.frequency.setTargetAtTime(on ? 700 : Math.min(18000, this.ctx.sampleRate / 2 - 100), this.ctx.currentTime, 0.15);
  }

  // ---------------- sample bank ----------------
  buf(data) {
    const b = this.ctx.createBuffer(1, data.length, this.sr);
    b.getChannelData(0).set(data);
    return b;
  }

  buildKit() {
    const sr = this.sr;
    const K = (this.kit = {});
    K.bass = this.buf(drum(sr, 120, 58, 0.55, 0.25, 900));
    K.tone = this.buf(drum(sr, 260, 205, 0.3, 0.4, 2200, 0.35));
    K.slap = this.buf(noiseHitBuf(sr, 0.12, 'bp', 2400, 2.5, 0.001, 3));
    K.shaker = this.buf(noiseHitBuf(sr, 0.07, 'hp', 6500, 0.8, 0.02, 2));
    K.talk = this.buf((() => { // talking drum: the pitch bends up under the arm
      const len = Math.floor(sr * 0.4), o = new Float32Array(len); let ph = 0;
      for (let i = 0; i < len; i++) { const t = i / sr; ph += (2 * Math.PI * (170 + 90 * Math.min(1, t / 0.18))) / sr; o[i] = Math.sin(ph) * Math.exp(-t / 0.13); }
      return normalize(o, 0.9);
    })());
    K.udu = this.buf((() => {
      const len = Math.floor(sr * 0.35), o = new Float32Array(len); let ph = 0;
      for (let i = 0; i < len; i++) { const t = i / sr; ph += (2 * Math.PI * (95 + 70 * Math.min(1, t / 0.08))) / sr; o[i] = Math.sin(ph) * Math.exp(-t / 0.09); }
      return normalize(o, 0.9);
    })());
    K.heart = this.buf(drum(sr, 70, 42, 0.22, 0, 0));
    // The band's own drums. The sfx share the older kit above, so these stay separate.
    const M = (this.mk = {});
    M.bass = this.buf(membrane(sr, 72, 0.45, { modes: [[1, 1, 0.13], [1.59, 0.25, 0.05]], sag: 0.3, sagT: 0.02, nAmt: 0.2, nf: 500, nd: 0.008 }));
    M.tone = this.buf(membrane(sr, 320, 0.3, { modes: [[1, 1, 0.08], [1.59, 0.5, 0.05], [2.14, 0.35, 0.04], [2.65, 0.2, 0.03]], sag: 0.05, nAmt: 0.25, nf: 1500, nd: 0.006 }));
    M.slap = this.buf(membrane(sr, 410, 0.18, { modes: [[1, 0.4, 0.03], [1.59, 0.5, 0.025], [2.3, 0.6, 0.02], [3.6, 0.4, 0.015]], sag: 0.04, nAmt: 1.1, nf: 3000, nq: 0.8, nd: 0.012 }));
    M.dun = this.buf(membrane(sr, 62, 0.6, { modes: [[1, 1, 0.2], [1.5, 0.3, 0.08]], sag: 0.35, sagT: 0.025, nAmt: 0.45, nf: 1600, nd: 0.004 }));
    M.ken = this.buf(membrane(sr, 150, 0.3, { modes: [[1, 1, 0.1], [1.59, 0.3, 0.04]], sag: 0.2, nAmt: 0.5, nf: 2200, nd: 0.004 }));
    // talking drum: squeezing the cords bends the head up, letting go bends it down
    M.talk = this.buf(membrane(sr, 150, 0.45, { modes: [[1, 1, 0.16], [1.59, 0.3, 0.07], [2.14, 0.12, 0.04]], sag: 0, nAmt: 0.3, nf: 1100, nd: 0.006, bend: (t) => 1 + 0.5 * Math.min(1, t / 0.14) }));
    M.talkDn = this.buf(membrane(sr, 150, 0.45, { modes: [[1, 1, 0.16], [1.59, 0.3, 0.07], [2.14, 0.12, 0.04]], sag: 0, nAmt: 0.3, nf: 1100, nd: 0.006, bend: (t) => 1.5 - 0.5 * Math.min(1, t / 0.16) }));
    M.bell = this.buf(ironBell(sr, 1180));
    M.bellLo = this.buf(ironBell(sr, 790));
    M.shek = [0, 1, 2].map(() => this.buf(shekere(sr, 0.11, true)));
    M.shekUp = [0, 1, 2].map(() => this.buf(shekere(sr, 0.08, false)));
    M.clap = [0, 1, 2].map(() => this.buf(clapBuf(sr)));
    M.udu = K.udu; M.heart = K.heart; M.shaker = K.shaker;
    // (footsteps and claw scrapes now live in the sfx bank: SFX step_* and cat_*)
  }

  // Cached melodic sample for (instrument, midi)
  note(inst, midi) {
    const key = inst + midi;
    let b = this.cache.get(key);
    if (b) return b;
    const f = NOTE(midi), sr = this.sr;
    let data;
    // kora: a big calabash under cowhide (air mode near 115 Hz, the skin above it)
    if (inst === 'kora') data = pluck(sr, f, midi < 55 ? 3 : 2.4, { t60: midi < 55 ? 4 : Math.max(1.6, 3.2 - (midi - 60) * 0.04), damp: 0.5, exc: 0.55, pos: 0.12, body: [[115, 3, 0.5], [240, 2.5, 0.35], [520, 2, 0.2], [1250, 1.5, 0.1]], nail: 0.2 });
    // ngoni: a small skin-topped lute, brighter, shorter and plucked hard
    else if (inst === 'ngoni') data = pluck(sr, f, 1.6, { t60: 1.3, damp: 0.35, exc: 0.85, pos: 0.08, body: [[320, 2, 0.4], [900, 2, 0.3], [1900, 1.5, 0.15]], nail: 0.4 });
    // krar: the Ethiopian lyre, a bright gut ring over a bowl
    else if (inst === 'krar') data = pluck(sr, f, 2.2, { t60: 2.2, damp: 0.42, exc: 0.75, pos: 0.18, body: [[210, 2.5, 0.35], [640, 2, 0.25]], nail: 0.3 });
    // bolon: the Mande bass harp, dark and round
    else if (inst === 'bolon') data = pluck(sr, f, 2.4, { t60: 2.6, damp: 0.55, exc: 0.4, pos: 0.2, body: [[90, 3, 0.6], [190, 2.5, 0.35]], nail: 0.08 });
    // marimba and balafon: tuned bars over resonators; the balafon's gourds carry buzzing membranes
    else if (inst === 'marimba' || inst === 'balafon') data = bar(sr, f, 1.4, { partials: [[1, 1, 0.45], [3.93, 0.3, 0.12], [9.24, 0.08, 0.04]], mallet: 0.12, malletF: 1800, reson: [0.6, 0.7, 0.02], buzz: inst === 'balafon' ? 0.35 : 0 });
    // mbira: steel tines on a soundboard inside a gourd, with rattling shells
    else if (inst === 'mbira') data = bar(sr, f, 2.0, { partials: [[1, 1, 1.0], [2.01, 0.08, 0.5], [5.95, 0.2, 0.15], [11.3, 0.05, 0.04]], mallet: 0.05, malletF: 3000, reson: [0.25, 0.8, 0.015], sizzle: 0.35 });
    // kalimba: two slightly mistuned modes beat gently under a short bright ping
    else if (inst === 'kalimba') data = bar(sr, f, 1.6, { partials: [[1, 1, 0.7], [1, 0.45, 0.6, 0.0025], [6.27, 0.28, 0.07], [2, 0.08, 0.35]], mallet: 0.05, malletF: 4000 });
    else data = pluck(sr, f, 2, {});
    b = this.buf(data);
    this.cache.set(key, b);
    return b;
  }

  playBuf(b, t, gain = 1, { dest = this.mbus, rate = 1, pan = 0, verb = 0.3 } = {}) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    let node = s.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(dest);
    if (verb) { const v = ctx.createGain(); v.gain.value = verb; node.connect(v).connect(this.verbIn); }
    s.start(t);
    return s;
  }

  // A melodic sample note. o.len damps the string or bar after that many seconds (riffs, muted
  // notes); o.dest overrides the band bus (stingers go straight to the music bus).
  inst(name, midi, t, vel = 1, pan = 0, o = {}) {
    const gains = { kora: 0.3, marimba: 0.28, balafon: 0.27, mbira: 0.26, kalimba: 0.24, ngoni: 0.27, krar: 0.27, bolon: 0.34 };
    this.rec(name, midi, t, o.len || 0.4, vel, pan);
    const ctx = this.ctx, s = ctx.createBufferSource();
    s.buffer = this.note(name, midi);
    s.playbackRate.value = o.rate || 1;
    const g = ctx.createGain();
    g.gain.value = (gains[name] ?? 0.26) * vel;
    if (o.len) { g.gain.setValueAtTime((gains[name] ?? 0.26) * vel, t + o.len); g.gain.setTargetAtTime(0, t + o.len, 0.05); }
    let node = s.connect(g);
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(o.dest || this.bandOut());
    const v = o.verb ?? ROOM[name] ?? 0.3;
    if (v) { const vg = ctx.createGain(); vg.gain.value = v; node.connect(vg).connect(this.verbIn); }
    s.start(t);
    if (o.len) s.stop(t + o.len + 0.4);
  }

  // A drum stroke. Names from the band's kit first (round-robin where there are takes), then the
  // shared kit, so older callers still get a drum.
  hit(name, t, vel = 1, rate = 1, pan = 0, dest = null) {
    let b = (this.mk && this.mk[name]) || this.kit[name];
    if (!b) return;
    if (Array.isArray(b)) b = b[this.rr('mk' + name, b.length)];
    const lvl = { bass: 1, tone: 0.75, slap: 0.65, dun: 0.95, ken: 0.55, talk: 0.8, talkDn: 0.8, bell: 0.32, bellLo: 0.34, shek: 0.32, shekUp: 0.24, clap: 0.45, udu: 1, heart: 1, shaker: 1 }[name] ?? 1;
    const seat = { tone: -0.15, slap: 0.12, ken: 0.2, talk: 0.3, talkDn: 0.3, bell: 0.45, bellLo: 0.45, shek: -0.45, shekUp: -0.45, clap: -0.2, udu: -0.25 }[name] || 0;
    this.rec('drum', null, t, 0.05, vel, pan, name);
    this.playBuf(b, t, vel * 0.55 * lvl, { rate, pan: pan || seat, verb: name === 'talk' || name === 'talkDn' ? 0.3 : name === 'bell' || name === 'bellLo' ? 0.2 : 0.12, dest: dest || this.bandOut() });
  }

  // The band's bus: a high-pass under everything so the low end stays for the sfx, a slight
  // low-mid dip against mud, and a gain the stingers duck. Built on first use.
  bandOut() {
    if (this.band && this.band.context === this.ctx) return this.band;
    const ctx = this.ctx;
    this.band = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 52; hp.Q.value = 0.6;
    const pk = ctx.createBiquadFilter();
    pk.type = 'peaking'; pk.frequency.value = 280; pk.Q.value = 0.8; pk.gain.value = -2.5;
    this.band.connect(hp).connect(pk).connect(this.mbus);
    return this.band;
  }

  duck(t, depth = 0.6, hold = 0.5) {
    const g = this.bandOut().gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(depth, t, 0.02);
    g.setTargetAtTime(1, t + hold, 0.3);
  }

  // Score capture for the music lab (tools/musiclab.js sets this.score = []).
  rec(p, m, t, d, v, pan, k) { if (this.score) this.score.push({ p, m, t, d, v, pan, k }); }

  // ---------------- ambience ----------------
  loopNoise(filterType, freq, q, gain, rate = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.amb);
    src.start();
    return { g, f };
  }

  startAmbience() {
    const ctx = this.ctx;
    this.buildSfx();
    // The update loop still sets these levels each frame; the beds that replaced them are mixed
    // in ambTick, so they are left unconnected.
    for (const k of ['wind', 'rainG', 'surfG', 'cricketG', 'fireG', 'stormG', 'gritG', 'cicadaG']) this[k] = ctx.createGain();
    this.windF = ctx.createBiquadFilter();
    // fog: a soft low drone that beats slowly against itself
    this.fogG = ctx.createGain(); this.fogG.gain.value = 0;
    const fogLp = ctx.createBiquadFilter(); fogLp.type = 'lowpass'; fogLp.frequency.value = 300;
    for (const [f, type] of [[73.4, 'sine'], [73.75, 'sine'], [110.2, 'triangle']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = type === 'sine' ? 0.5 : 0.25;
      o.connect(g).connect(fogLp); o.start();
    }
    fogLp.connect(this.fogG).connect(this.amb);
  }

  // ---------------- sfx bank ----------------
  // Run once from startAmbience: renders what the first seconds need, queues the rest, and builds
  // the sfx reverb (open country vs woodland, plus an echo off the highland rock).
  buildSfx() {
    const ctx = this.ctx, sr = ctx.sampleRate;
    this.sfxBufs = new Map();
    this.sfxMs = 0;
    this.beds = {};
    this.sc = null;
    const t0 = performance.now();
    for (const k of ['step_grass', 'step_sand', 'ui_tick', 'ui_tok', 'ui_tine']) this.takes(k);
    this.sfxInitMs = performance.now() - t0;
    // beds first (the ambience starts at once), then the cat's own sounds, then the rest
    const pri = (k) => (k.startsWith('bed_') ? 0 : k.startsWith('step_') || k.startsWith('cat_') ? 1 : 2);
    this.sfxWarm = Object.keys(SFX).filter((k) => !this.sfxBufs.has(k)).sort((a, b) => pri(a) - pri(b));
    this.warmAt = 0;
    // A live context hands the rest of the bank to a worker (this same file); takes() picks the
    // results up as they land. Offline renders, or no worker, fall back to the warm queue.
    if (typeof ctx.startRendering !== 'function' && typeof Worker !== 'undefined') {
      try {
        const w = (this.sfxWorker = new Worker(new URL(import.meta.url), { type: 'module' }));
        let left = this.sfxWarm.length;
        w.onmessage = (e) => { const { name, rate, data } = e.data; RENDERED.set(name + '|' + rate, data); if (--left <= 0) w.terminate(); };
        w.onerror = () => { w.terminate(); this.sfxWorker = null; };
        w.postMessage(this.sfxWarm.map((k) => [k, Math.min(sr, SFX[k].maxSr)]));
      } catch (e) { this.sfxWorker = null; }
    }
    const ir = (dur, taps, dens, damp) => {
      const b = ctx.createBuffer(2, Math.floor(sr * dur), sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() < dens ? (Math.random() * 2 - 1) * Math.exp(-i / (sr * dur * 0.2)) : 0;
        for (const [ms, a] of taps) d[Math.floor((ms * (1 + ch * 0.07) * sr) / 1000)] += a * (Math.random() < 0.5 ? -1 : 1);
        svf(d, sr, LP, (t) => damp * Math.exp(-t * 4) + 700, 0.6);
      }
      const c = ctx.createConvolver(); c.buffer = b; return c;
    };
    // A pile-up of loud cues (a strike, a roar and a kill at once) is caught here, before the master:
    // the sfx bus now runs through a fast limiter on its way there.
    this.sfxLim = ctx.createDynamicsCompressor();
    const thr = -8;
    this.sfxLim.threshold.value = thr; this.sfxLim.knee.value = 3; this.sfxLim.ratio.value = 20;
    this.sfxLim.attack.value = 0.001; this.sfxLim.release.value = 0.2;
    // (the compressor adds its own makeup gain, (1 / gain at 0 dBFS) ^ 0.6 in Chromium; take it back off)
    const trim = ctx.createGain(); trim.gain.value = Math.pow(10, (0.6 * (thr - thr / 20)) / 20);
    this.sfx.disconnect();
    this.sfx.connect(this.sfxLim).connect(trim).connect(this.master);
    this.sfxVerb = ctx.createGain();
    // open country: a ground bounce and a short, thin tail; woodland: dense and longer
    const open = ir(0.7, [[9, 0.8], [23, 0.4], [41, 0.25]], 0.25, 6000), wood = ir(1.4, [[7, 0.5], [13, 0.4], [19, 0.35], [29, 0.3]], 1, 4500);
    this.vOpen = ctx.createGain(); this.vWood = ctx.createGain(); this.vEcho = ctx.createGain();
    this.vOpen.gain.value = 0.5; this.vWood.gain.value = 0; this.vEcho.gain.value = 0;
    this.sfxVerb.connect(open).connect(this.vOpen).connect(this.sfx);
    this.sfxVerb.connect(wood).connect(this.vWood).connect(this.sfx);
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.34;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2200;
    this.sfxVerb.connect(dl).connect(dlp).connect(fb).connect(dl);
    dlp.connect(this.vEcho).connect(this.sfx);
  }

  // The pre-rendered takes of a cue, as AudioBuffers (rendered now if the warm queue has not
  // reached it yet). Low sounds render at a lower rate, which is most of the saving.
  takes(name) {
    let b = this.sfxBufs.get(name);
    if (b) return b;
    const R = SFX[name];
    if (!R) return null;
    const rate = Math.min(this.ctx.sampleRate, R.maxSr), key = name + '|' + rate;
    let data = RENDERED.get(key);
    if (!data) {
      const t0 = performance.now();
      data = [];
      for (let i = 0; i < R.n; i++) data.push(R.fn(rate));
      RENDERED.set(key, data);
      this.sfxMs += performance.now() - t0;
    }
    b = data.map((d) => {
      const ch = Array.isArray(d) ? d : [d], ab = this.ctx.createBuffer(ch.length, ch[0].length, rate);
      ch.forEach((c, k) => ab.getChannelData(k).set(c));
      return ab;
    });
    this.sfxBufs.set(name, b);
    return b;
  }

  // Play one take of a cue. o: take, rate, jit (pitch spread), pan, dist (0 near .. 1 far: duller
  // and wetter), lp (Hz), verb (send), dest.
  fx(name, t, gain, o = {}) {
    const set = this.takes(name);
    if (!set || gain <= 0.0005) return null;
    const ctx = this.ctx, s = ctx.createBufferSource();
    s.buffer = set[o.take ?? this.rr(name, set.length)];
    const j = o.jit ?? 0.04;
    s.playbackRate.value = (o.rate || 1) * (j ? this.jit(1 - j, 1 + j) : 1);
    let node = s;
    const d = Math.min(1, o.dist || 0), img = s.buffer.sampleRate < ctx.sampleRate * 0.6 ? s.buffer.sampleRate * 0.45 * s.playbackRate.value : 0;
    if (d > 0.05 || o.lp || img) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = Math.min(o.lp || 20000, img || 20000, 16000 * Math.pow(1 - d, 2.2) + 500);
      node = node.connect(f);
    }
    const g = ctx.createGain();
    g.gain.value = gain;
    node = node.connect(g);
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); node = node.connect(p); }
    node.connect(o.dest || this.sfx);
    const wet = (o.verb ?? 0.12) + d * 0.3;
    if (wet > 0.01) { const v = ctx.createGain(); v.gain.value = wet; node.connect(v).connect(this.sfxVerb); }
    s.start(Math.max(t, ctx.currentTime));
    return s;
  }

  bedStart(k) {
    const ctx = this.ctx, src = ctx.createBufferSource(), b = this.takes('bed_' + k)[0];
    src.buffer = b; src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0;
    let node = src;
    if (b.sampleRate < ctx.sampleRate * 0.6) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = b.sampleRate * 0.45; node = node.connect(f); }
    node = node.connect(g);
    let p = null;
    if (ctx.createStereoPanner && ['herd', 'torch', 'embers', 'whistle', 'fire'].includes(k)) { p = ctx.createStereoPanner(); node = node.connect(p); }
    node.connect(this.amb);
    src.start(ctx.currentTime, Math.random() * b.duration);
    return { g, p };
  }

  // The ambience mix, run every frame from the update loop (by way of weatherStings): each bed
  // follows the land, the hour and the weather, and the wind rises and falls with the same gusts
  // the tall grass is drawn leaning in (render.js), measured at the cat.
  ambTick(rain, dust, heat, fog, storm) {
    const ctx = this.ctx, t = ctx.currentTime;
    const wq = this.sfxWarm;
    if (wq.length && this.sfxWorker) { // collect what the worker has finished
      for (let i = wq.length - 1; i >= 0; i--) if (RENDERED.has(wq[i] + '|' + Math.min(ctx.sampleRate, SFX[wq[i]].maxSr))) this.takes(wq.splice(i, 1)[0]);
    } else if (wq.length && performance.now() - this.warmAt > 120 && t - (this.ambT ?? t) < 0.03) { this.warmAt = performance.now(); this.takes(wq.shift()); }
    this.ambT = t;
    const S = (this.menu ? null : this.sc) || {};
    const night = this.menu ? 0.1 : this.night, B = this.menu ? 0 : this.biome || 0, day = 1 - night;
    const is = (b) => (B === b ? 1 : 0);
    const gt = S.t ?? t, lean = Math.sin(gt * 1.3 + (S.x || 0) * 0.02) + Math.sin(gt * 2.9 + (S.y || 0) * 0.03) * 0.4;
    const gust = Math.min(1, Math.abs(lean) / 1.4);
    const wet = this.menu ? 0 : rain;
    const want = {
      wind: (0.45 + 0.35 * is(3) + 0.2 * is(6) + 0.3 * is(4) + dust * 1.4 + storm * 0.8 + wet * 0.4) * (0.7 + 0.6 * gust),
      leaves: (this.menu ? 0.3 : S.trees || 0) * (0.25 + 0.75 * gust) * (1 + wet * 0.5),
      grass: (S.tall || 0) * (0.3 + 0.7 * gust),
      insects: day * [1, 0.8, 0.6, 0.15, 0.3, 0, 0.4][B] * (1 - wet * 0.85) * (1 - dust) * (1 - heat * 0.6),
      crickets: night * [1, 1, 0.7, 0.35, 0.5, 0.15, 0.5][B] * (1 - wet * 0.7) * (1 - dust),
      frogs: (is(2) * (0.3 + 0.7 * night) + (S.oasis || 0) * 0.8) * (1 + wet * 0.5),
      water: is(2) * 0.6 + (S.oasis || 0) + (S.water || 0) * 0.5,
      surf: this.menu ? 0 : this.coast,
      desert: is(3) * (0.6 + dust),
      highwind: is(4) * (0.5 + 0.5 * gust),
      ash: is(5),
      rainLight: wet * (1 - c01((wet - 0.35) / 0.4)),
      rainHeavy: wet * c01((wet - 0.35) / 0.4),
      storm: this.menu ? 0 : storm,
      fire: Math.max(this.fire ? 0.6 : 0, S.fire || 0),
      torch: S.torch || 0,
      embers: S.camp || 0,
      cicada: (this.menu ? 0 : heat) * day,
      shimmer: (this.menu ? 0 : heat) * day,
      grit: this.menu ? 0 : dust,
      whistle: (S.whistle || 0) * (0.4 + 0.6 * gust),
      herd: S.herd || 0,
    };
    const fast = { wind: 0.35, leaves: 0.3, grass: 0.3, whistle: 0.35, highwind: 0.4, herd: 0.25, fire: 0.4, torch: 0.3 };
    for (const k in want) {
      const v = Math.max(0, want[k]) * BED_LVL[k];
      let b = this.beds[k];
      if (!b) { // (with a worker, wait for it rather than render a bed here)
        if (v < 0.002 || (this.sfxWorker && !this.sfxBufs.has('bed_' + k))) continue;
        b = this.beds[k] = this.bedStart(k);
      }
      b.g.gain.setTargetAtTime(v, t, fast[k] || 1.5);
      if (b.p) b.p.pan.setTargetAtTime(S[k + 'Pan'] || 0, t, 0.3);
    }
    // the space the sfx sit in
    this.vOpen.gain.setTargetAtTime(B === 1 ? 0.1 : 0.5, t, 2);
    this.vWood.gain.setTargetAtTime(B === 1 ? 0.45 : 0, t, 2);
    this.vEcho.gain.setTargetAtTime(B === 4 ? 0.5 : 0, t, 2);
    // the ashlands breathe steam now and then
    if (!this.menu && B === 5 && Math.random() < 0.0025) this.fx('w_vent', t + 0.05, 0.12, { dest: this.amb, pan: rnd(-0.8, 0.8), dist: rnd(0.2, 0.7) });
  }

  // Called by main every frame of a run with the live game. Turns what is near the cat into sound
  // that no event carries: trees in the wind, a herd's hooves, the band's footfalls and torches,
  // animals calling, vultures overhead, and the cat's own breathing and settling.
  scene(g, dt) {
    if (!this.ctx || !g || !this.sfxBufs) return;
    const t = this.ctx.currentTime + 0.01, p = g.player, S = (this.sc = this.sc || {});
    const D = (o) => Math.hypot(o.x - p.x, o.y - p.y);
    const side = (x) => Math.max(-0.9, Math.min(0.9, (x - p.x) / 320));
    const night = g.isNight;
    S.t = g.time; S.x = p.x; S.y = p.y;
    S.tall = p.ground === 2 ? (p.still > 0.3 ? 1 : 0.5) : 0;
    S.water = p.ground === 7 || p.ground === 8 ? 1 : 0;
    // slow scans, twice a second: trees, landmarks, fire
    S.scanT = (S.scanT || 0) - dt;
    if (S.scanT <= 0) {
      S.scanT = 0.5;
      let n = 0;
      for (const pr of g.world.propsNear(p.x, p.y, 170)) if (pr.def && pr.def.frames) n++;
      S.trees = Math.min(1, n / 6);
      S.whistle = S.camp = S.oasis = 0;
      for (const lm of g.world.landmarksNear(p.x, p.y, 420)) {
        const k = (1 - D(lm) / 420) ** 2;
        if (lm.type === 'whistle' && k > S.whistle) { S.whistle = k; S.whistlePan = side(lm.x); }
        else if (lm.type === 'camp' && k > S.camp) { S.camp = k; S.embersPan = side(lm.x); }
        else if (lm.type === 'oasis') S.oasis = Math.max(S.oasis, k);
      }
      S.fire = g.fireNear ? (g.fireNear(p.x, p.y, 60) ? 1 : g.fireNear(p.x, p.y, 140) ? 0.6 : g.fireNear(p.x, p.y, 260) ? 0.3 : 0) : 0;
    }
    if (g.over) { S.torch = S.herd = 0; return; }
    // the cat: lying down and getting up, and breath that quickens with heat
    if (p.state === 'lie' && S.pst !== 'lie') this.play('settle');
    else if (S.pst === 'lie' && p.state !== 'lie') this.play('rise');
    S.pst = p.state;
    const inW = p.ground === 7 || p.ground === 8; // wading in: no event carries it
    if (inW && S.pw === false) this.fx('step_wade', t, 0.3, { rate: 0.85, verb: 0.05 });
    S.pw = inW;
    const pant = Math.max(p.overheated ? 1 : c01((p.heat - 72) / 28), p.exhausted ? 0.7 : 0);
    if (pant > 0 && !p.drinking && !p.eating) {
      S.pantT = (S.pantT || 0) - dt;
      if (S.pantT <= 0) { const per = 0.62 - 0.36 * pant; S.pantT = per * rnd(0.92, 1.08); this.play('pant', { vol: 0.4 + 0.6 * pant, per }); }
    } else S.pantT = 0;
    // the band: footfalls felt through the ground before they are seen; torches at night
    let hd = 1e9, hx = 0, hrun = false;
    for (const h of g.hunters) { if (h.down > 0) continue; const d = D(h); if (d < hd) { hd = d; hx = h.x; hrun = Math.hypot(h.vx || 0, h.vy || 0) > 60; } }
    if (hd < 460) {
      S.ffT = (S.ffT || 0) - dt;
      if (S.ffT <= 0) { // several men, never quite in step
        S.ffT = (hrun ? 0.15 : 0.3) * rnd(0.8, 1.2);
        const k = 1 - hd / 460;
        this.fx('hunt_footfall', t, 0.28 * k ** 1.5, { pan: side(hx) * 0.6, lp: 250 + 1000 * k, verb: 0 });
      }
    }
    S.torch = night && g.day >= 5 && hd < 320 ? 1 - hd / 320 : 0; // TORCH_DAY in game.js
    S.torchPan = side(hx);
    for (const d of g.dogs) if (!d.dead && d.state === 'return' && Math.random() < dt * 0.15) { const k = c01(1 - D(d) / 450); this.fx('dog_whine', t, 0.08 * k, { pan: side(d.x), dist: 1 - k }); }
    // prey: hooves drumming away, and grazers calling among themselves
    let fn = 0, fx = 0, fd = 1e9, fk = null, calm = null, cd = 1e9;
    for (const q of g.prey) {
      if (q.dead) continue;
      const d = D(q);
      if (d > 420) continue;
      if (q.state === 'flee' && !(q.air > 0) && !(q.startle > 0)) { fn++; fx += q.x; if (d < fd) { fd = d; fk = q.kind; } }
      else if (q.state !== 'flee' && d > 60 && d < cd) { cd = d; calm = q; }
    }
    if (fn && !['hare', 'hyrax', 'fowl', 'flamingo'].includes(fk)) {
      S.hfT = (S.hfT || 0) - dt;
      if (S.hfT <= 0) {
        S.hfT = Math.max(0.05, 0.3 / Math.min(fn, 6)) * rnd(0.7, 1.3);
        const k = 1 - fd / 420;
        this.fx(fk === 'ostrich' ? 'an_stride' : 'an_hoof', t, 0.16 * k * k, { pan: side(fx / fn), dist: 1 - k, verb: 0.05, rate: fk === 'zebra' ? 0.88 : fk === 'warthog' ? 1 : 1.12 });
      }
    }
    S.callT = (S.callT ?? rnd(3, 6)) - dt;
    if (S.callT <= 0) {
      S.callT = rnd(4, 9);
      const cue = calm && { zebra: 'an_zebra', warthog: 'an_grunt', fowl: 'an_kek', flamingo: 'an_honk', ostrich: night ? null : 'an_boom', hyrax: 'an_shriek', gazelle: 'an_snort' }[calm.kind];
      if (cue && Math.random() < (calm.kind === 'gazelle' || calm.kind === 'hyrax' ? 0.25 : 0.7)) {
        const k = 1 - cd / 420, o = { pan: side(calm.x), dist: 1 - k, verb: 0.2 };
        const g0 = { an_zebra: 0.12, an_grunt: 0.13, an_kek: 0.16, an_honk: 0.12, an_boom: 0.08, an_shriek: 0.14, an_snort: 0.25 }[cue];
        this.fx(cue, t, g0 * k, o);
        if (cue === 'an_honk') this.fx(cue, t + rnd(0.2, 0.35), 0.8 * g0 * k, o);
      }
    }
    // a stampede passing: the bed swells with the nearest beasts, and they grunt as they go
    let gn = 0, gx = 0, gd = 1e9;
    if (!(g.stampedeWarn > 1.2)) for (const w of g.gnus) { const d = D(w); if (d < 800) { gn++; gx += w.x; gd = Math.min(gd, d); } }
    S.herd = gn ? Math.min(1, gn / 6) * c01(1 - gd / 700) ** 1.3 : 0;
    S.herdPan = gn ? side(gx / gn) : 0;
    if (gn && Math.random() < dt * 1.5 * S.herd) this.fx('an_gnu', t, 0.22 * S.herd, { pan: S.herdPan + rnd(-0.3, 0.3), dist: 1 - S.herd });
    // hyenas giggling and whooping while they hang about; a pride grunting at rest
    let yd = 1e9, yx = 0;
    for (const h of g.hyenas) { const d = D(h); if (d < yd) { yd = d; yx = h.x; } }
    if (yd < 600 && Math.random() < dt * 0.3) { const k = 1 - yd / 600; this.fx(Math.random() < 0.6 ? 'an_giggle' : 'an_whoop', t, 0.15 * k, { pan: side(yx), dist: 1 - k }); }
    for (const L of g.lions) if (L.state === 'rest') { const d = D(L); if (d < 700 && Math.random() < dt * 0.05) this.fx('an_lgrunt', t, 0.3 * (1 - d / 700), { pan: side(L.x), dist: d / 700 }); break; }
    // the croc: bubbles while it lurks, a swirl as it goes under
    const c = g.croc;
    if (c) {
      const k = c01(1 - D(c) / 500);
      if (c.state === 'stalk' && Math.random() < dt * 0.25) this.fx('an_lurk', t, 0.18 * k, { pan: side(c.x), dist: 1 - k });
      if (c.state === 'sink' && S.croc !== 'sink') this.fx('an_csink', t, 0.13 * k, { pan: side(c.x), dist: 1 - k });
    }
    S.croc = c && c.state;
    // vultures circling a kill beat their wings in the same phase render.js draws them flapping
    for (const cc of g.carcasses) {
      if (cc.t < 6) continue;
      const d = D(cc);
      if (d > 400) continue;
      const k = 1 - d / 400, nv = Math.min(3, Math.floor((cc.t - 6) / 5) + 1);
      for (let i = 0; i < nv; i++) if ((g.time * 0.25 + i * 0.37) % 1 < 0.3 && Math.random() < dt * 2.2) this.fx('an_vwing', t, 0.11 * k, { pan: side(cc.x) + rnd(-0.2, 0.2), dist: 0.3 + 0.5 * (1 - k) });
      if (p.eating === cc && Math.random() < dt * 0.12) this.fx('an_vhiss', t, 0.12, { pan: rnd(-0.5, 0.5), dist: 0.3 });
    }
  }

  // A gust through the dust: a whistle that swells and falls away.
  gust(t) {
    this.fx('w_gust', t, 0.15, { dest: this.amb, pan: rnd(-0.6, 0.6), verb: 0, jit: 0.1 });
  }

  // Birds, frogs and far-off calls (kinds 0..9 come from the update loop), each a few takes,
  // placed at a random spot and distance.
  birdCall(t, kind) {
    const lvl = [0.036, 0.036, 0.032, 0.04, 0.16, 0.036, 0.032, 0.04, 0.04, 0.05][kind] ?? 0.036;
    this.fx('bird' + kind, t, lvl, { dest: this.amb, pan: rnd(-0.8, 0.8), dist: rnd(0.15, 0.55), verb: 0.25, jit: 0.05 });
  }

  // ---------------- instruments that stay oscillator-based ----------------
  env(g, t, a, peak, dec, sus = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec);
  }

  // An end-blown flute (Fula tambin, Ethiopian washint): a soft harmonic tone that starts a touch
  // flat and settles, breath noise around the pitch all through the note, a chiff on the attack,
  // vibrato that arrives late, and an optional grace note flicked in before the main note.
  flute(midi, t, dur, vel = 1, o = {}) {
    const ctx = this.ctx, f = NOTE(midi);
    this.rec('flute', midi, t, dur, vel);
    if (!this._fw || this._fw.ctx !== ctx) this._fw = { ctx, w: ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.3, 0.1, 0.04, 0.015])) };
    const o1 = ctx.createOscillator();
    o1.setPeriodicWave(this._fw.w);
    const fr = o1.frequency, gr = o.grace != null;
    if (gr) { fr.setValueAtTime(NOTE(o.grace), t); fr.setValueAtTime(f * 0.985, t + 0.05); }
    else fr.setValueAtTime(f * 0.982, t);
    fr.exponentialRampToValueAtTime(f, t + (gr ? 0.11 : 0.07));
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.6 + Math.random() * 0.9;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.setValueAtTime(0, t + Math.min(0.25, dur * 0.4));
    vg.gain.linearRampToValueAtTime(f * 0.007 * (o.vib ?? 1), t + Math.max(0.3, dur * 0.8));
    vib.connect(vg).connect(fr);
    const g = ctx.createGain(), pk = 0.12 * vel, a = 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    g.gain.linearRampToValueAtTime(pk * 0.8, t + a + 0.12);
    if (dur > 0.6) g.gain.linearRampToValueAtTime(pk * 0.92, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(pk * 0.82, t + Math.max(a + 0.13, dur - 0.04));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.16);
    const n = ctx.createBufferSource();
    n.buffer = this.noise; n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 5;
    const ng = ctx.createGain(); ng.gain.value = 2.2;
    const ch = ctx.createBiquadFilter();
    ch.type = 'bandpass'; ch.frequency.value = Math.min(9000, f * 4); ch.Q.value = 0.9;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, t); cg.gain.linearRampToValueAtTime(0.45, t + 0.008); cg.gain.exponentialRampToValueAtTime(0.03, t + 0.09);
    n.connect(bp).connect(ng).connect(g);
    n.connect(ch).connect(cg).connect(g);
    o1.connect(g);
    let out = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan ?? SEAT.flute; out = g.connect(p); }
    out.connect(o.dest || this.bandOut());
    const send = ctx.createGain(); send.gain.value = 0.45;
    out.connect(send).connect(this.verbIn);
    const end = t + dur + 0.25;
    o1.start(t); vib.start(t); n.start(t, Math.random() * 1.5);
    o1.stop(end); vib.stop(end); n.stop(end);
  }

  // A warm bed under a chord: detuned triangles with a little reed, kept above the bass.
  pad(midis, t, dur, bright = 0.5, vel = 1) {
    const ctx = this.ctx;
    for (const m of midis) this.rec('pad', m, t, dur, vel);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(260 + bright * 700, t);
    lp.frequency.linearRampToValueAtTime(380 + bright * 1100, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(260 + bright * 700, t + dur);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 110; hp.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05 * vel, t + Math.min(1.5, dur * 0.35));
    g.gain.setValueAtTime(0.05 * vel, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5);
    for (const m of midis) {
      for (const [type, det, lv] of [['triangle', -6, 0.6], ['triangle', 6, 0.6], ['sawtooth', 0, 0.16]]) {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = NOTE(m); o.detune.value = det + (Math.random() - 0.5) * 4;
        const og = ctx.createGain(); og.gain.value = lv;
        o.connect(og).connect(lp);
        o.start(t); o.stop(t + dur + 0.6);
      }
    }
    lp.connect(hp).connect(g).connect(this.bandOut());
    const send = ctx.createGain(); send.gain.value = 0.6;
    g.connect(send).connect(this.verbIn);
  }

  // The bass is a bolon (Mande bass harp), damped after the note's length.
  bass(midi, t, dur, vel = 1) {
    while (midi > 52) midi -= 12;
    while (midi < 33) midi += 12;
    this.inst('bolon', midi, t, vel, 0, { len: Math.max(0.12, dur), verb: 0.1 });
  }

  noiseHit(t, freq, q, dec, vel, dest = this.sfx, type = 'bandpass', rate = 1) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, 0.002, vel, dec);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dec + 0.05);
    return f;
  }

  // Voices through vowel formants: one leader, or a chorus of several slightly apart in pitch
  // and time. o.vowel is one vowel, or two to glide between ('oa').
  sing(midi, t, dur, vel = 1, n = 1, o = {}) {
    const ctx = this.ctx;
    this.rec(n > 1 ? 'chorus' : 'voice', midi, t, dur, vel);
    if (!this._vw || this._vw.ctx !== ctx) {
      const re = new Float32Array(32), im = new Float32Array(32);
      for (let k = 1; k < 32; k++) im[k] = Math.pow(k, -1.15);
      this._vw = { ctx, w: ctx.createPeriodicWave(re, im) };
    }
    const VOW = { a: [800, 1150, 2900], o: [450, 800, 2830], e: [400, 1700, 2600], u: [330, 700, 2700], i: [300, 2200, 3000] };
    const vs = (o.vowel || 'a').split('').map((c) => VOW[c] || VOW.a);
    const g = ctx.createGain(), lvl = (0.15 * vel) / Math.sqrt(n), atk = n > 1 ? 0.07 : 0.035;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(lvl, t + atk);
    g.gain.setValueAtTime(lvl * 0.9, t + Math.max(atk + 0.01, dur - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.14);
    const banks = n > 1 ? [-0.4, 0.4] : [o.pan ?? SEAT.voice];
    const ins = banks.map((pn) => {
      const inp = ctx.createGain(), sum = ctx.createGain();
      vs[0].forEach((ff, i) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = 7 + i * 2;
        bp.frequency.setValueAtTime(ff, t);
        if (vs[1]) bp.frequency.linearRampToValueAtTime(vs[1][i], t + dur * 0.6);
        const ag = ctx.createGain(); ag.gain.value = [1, 0.5, 0.22][i] * 3;
        inp.connect(bp).connect(ag).connect(sum);
      });
      let out = sum;
      if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pn; out = sum.connect(p); }
      out.connect(g);
      return inp;
    });
    const end = t + dur + 0.2;
    for (let k = 0; k < n; k++) {
      const f = NOTE(midi + (o.oct && k % 2 ? 12 : 0)) * (1 + (n > 1 ? (Math.random() - 0.5) * 0.012 : 0));
      const s = t + (n > 1 ? Math.random() * 0.03 : 0);
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(this._vw.w);
      osc.frequency.setValueAtTime(f * 0.965, s);
      osc.frequency.exponentialRampToValueAtTime(f, s + 0.08);
      if (o.fall) osc.frequency.setTargetAtTime(f * 0.8, s + dur * 0.6, dur * 0.3);
      const vib = ctx.createOscillator(); vib.frequency.value = 5 + Math.random();
      const vgn = ctx.createGain();
      vgn.gain.setValueAtTime(0, s); vgn.gain.linearRampToValueAtTime(f * 0.012, s + Math.min(0.4, dur));
      vib.connect(vgn).connect(osc.frequency);
      osc.connect(ins[k % ins.length]);
      osc.start(s); vib.start(s); osc.stop(end); vib.stop(end);
    }
    g.connect(o.dest || this.bandOut());
    const send = ctx.createGain(); send.gain.value = 0.5;
    g.connect(send).connect(this.verbIn);
  }

  // The old drone chant (still called by the start sting): a chorus on D and A, 'o' opening to 'a'.
  chant(t, dur, vel = 1) {
    this.sing(D3, t, dur, vel * 0.8, 3, { vowel: 'oa' });
    this.sing(D3 + 7, t + 0.02, dur, vel * 0.6, 2, { vowel: 'oa' });
  }

  // ---------------- sequencer ----------------
  update(dt) {
    if (!this.ctx || !this.playing) return;
    const ctx = this.ctx;
    if (!this.warmed) { this.warmed = true; this.warmMore(); }
    if (this.warm.length && dt < 0.02) { const [i, m] = this.warm.shift(); this.note(i, m); }
    const I = this.menu ? 0 : this.intensity;
    if (I >= 3) this.hotT = ctx.currentTime;
    const S = this.song();
    const want = (S.tempo + (this.sec.dt || 0)) * (I >= 2 && !['chase', 'title', 'elegy'].includes(this.theme) ? 1.06 : 1);
    this.tempo += (want - this.tempo) * Math.min(1, dt * (this.theme === 'chase' ? 2 : 0.8));
    // fell behind (tab was in the background): drop the missed steps and start a fresh bar
    if (this.nextTime < ctx.currentTime - 0.05) { this.nextTime = ctx.currentTime + 0.05; this.pos = 0; this.cut = false; }
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.prep(this.nextTime);
      const d = this.stepDur();
      this.schedule(this.step, this.nextTime, d);
      this.nextTime += d;
      this.step++;
    }
    const t = ctx.currentTime;
    const night = this.menu ? 0.1 : this.night;
    this.cricketG.gain.setTargetAtTime(night * 0.012 * (this.biome === 3 ? 0.3 : 1), t, 1);
    this.rainG.gain.setTargetAtTime(this.rain * 0.35, t, 0.8);
    this.wind.gain.setTargetAtTime(0.1 + this.rain * 0.12 + (this.dust || 0) * 0.35 + (this.biome === 4 ? 0.06 : 0), t, 1);
    this.windF.frequency.setTargetAtTime(380 + (this.dust || 0) * 500, t, 1);
    this.surfG.gain.setTargetAtTime(this.coast * 0.3, t, 1.5);
    this.fireG.gain.setTargetAtTime(this.fire * 0.35, t, 0.6);
    if (this.fire > 0.1 && Math.random() < dt * 14 * this.fire) this.noiseHit(t, 2500 + Math.random() * 3000, 3, 0.02, 0.2 * this.fire, this.amb);
    // weather beds
    const wxOn = !this.menu;
    const rain = wxOn ? this.rain : 0, dust = wxOn ? this.dust || 0 : 0, heat = wxOn ? this.heat || 0 : 0, fog = wxOn ? this.fog || 0 : 0, storm = wxOn ? this.storm || 0 : 0;
    this.stormG.gain.setTargetAtTime(storm * 0.5, t, 1.5);
    this.gritG.gain.setTargetAtTime(dust * 0.07, t, 1);
    this.cicadaG.gain.setTargetAtTime(heat * (1 - this.night) * 0.4, t, 2);
    this.fogG.gain.setTargetAtTime(fog * 0.05, t, 2);
    const nyq = Math.min(18000, ctx.sampleRate / 2 - 100);
    this.wx.frequency.setTargetAtTime(Math.max(1400, nyq * (1 - 0.8 * fog) * (1 - 0.65 * dust) * (1 - 0.3 * rain)), t, 1.5);
    // rain patter: single drops on leaves and ground
    if (rain > 0.05) {
      const n = Math.min(4, Math.floor(rain * 22 * dt + Math.random()));
      for (let i = 0; i < n; i++) this.noiseHit(t + Math.random() * dt, 2500 + Math.random() * 5000, 4, 0.012 + Math.random() * 0.02, (0.03 + Math.random() * 0.07) * rain, this.amb);
    }
    if (dust > 0.2 && Math.random() < dt * 0.35 * dust) this.gust(t + 0.05);
    this.weatherStings(rain, dust, heat, fog, storm);
    if (!this.menu && t - this.lastBird > 2.2 && Math.random() < dt * 0.4 * (1 - this.rain) * (1 - dust * 0.8)) {
      this.lastBird = t;
      let kind;
      if (fog > 0.4 && Math.random() < 0.5) kind = 9;
      else if (this.night > 0.5) {
        if ((this.biome === 2 || this.biome === 1) && Math.random() < 0.6) kind = 4;
        else if (Math.random() < 0.55) return; // nights are sparser
        else kind = this.biome === 1 ? pick([6, 8, 8]) : this.biome === 5 ? 8 : pick([6, 7, 8]);
      }
      else if (this.biome === 6) kind = Math.random() < 0.6 ? 5 : 0;
      else if (this.biome === 1) kind = [0, 1, 2, 3][Math.floor(Math.random() * 4)];
      else if (this.biome === 2) kind = Math.random() < 0.5 ? 4 : 2;
      else if (this.biome === 3 || this.biome === 5) { if (Math.random() < 0.7) return; kind = 3; }
      else kind = [0, 1, 3][Math.floor(Math.random() * 3)];
      this.birdCall(t + 0.05, kind);
    }
  }

  pickTheme() {
    if (this.menu) return 'title';
    if (this.dead || this.over) return 'elegy';
    if (this.intensity >= 3) return 'chase';
    // the chase holds a moment after they lose sight, so a flicker can't end it
    if (this.theme === 'chase' && this.ctx && this.ctx.currentTime - (this.hotT || 0) < 1.5) return 'chase';
    if (this.night > 0.5) return 'night';
    return BIOME_THEME[this.biome] || 'savanna';
  }

  // The song for a theme. Night borrows its tonic from the land it fell on, so dusk and dawn
  // pivot on a shared tonic.
  song(th = this.theme) {
    if (th !== 'night') return SONGS[th] || SONGS.savanna;
    const b = this.nightBiome ?? this.biome ?? 0;
    this._ns ||= {};
    if (!this._ns[b]) {
      const day = SONGS[BIOME_THEME[b]] || SONGS.savanna;
      let tonic = day.tonic;
      while (tonic < 60) tonic += 12;
      while (tonic > 71) tonic -= 12;
      this._ns[b] = { ...SONGS.night, tonic, mode: NIGHT_MODE[b] || 'dorian' };
    }
    return this._ns[b];
  }

  stepDur() { return 60 / this.tempo / (this.grid === 12 ? 3 : 4); }

  // Instruments the shared warm-up list does not cover, rendered a note per frame like the rest.
  warmMore() {
    const add = (name, lo, hi) => { for (let m = lo; m <= hi; m++) this.warm.push([name, m]); };
    add('bolon', 33, 52); add('balafon', 50, 86); add('ngoni', 45, 81); add('krar', 48, 84);
  }

  // Draw the next eight-bar section of a theme: its kind (the tune stated, developed, traded in
  // call and response, or a groove with solos), who leads, which harmony, an occasional key
  // change, a tempo nudge and how much of the band plays.
  newSection(th, kind = null) {
    const S = this.song(th), prev = this.sec || {};
    const first = prev.th !== th;
    this.secBar = this.barN || 0;
    this.secLen = 8;
    if (!kind) {
      if (th === 'title' || th === 'elegy') kind = th;
      else if (th === 'chase') kind = first ? 'groove' : pick(['groove', 'chant', 'chant', 'break'].filter((k) => k !== prev.kind));
      else if (th === 'night') kind = pick(['nocturne', 'lullaby', 'stars'].filter((k) => k !== prev.kind));
      else if (first) kind = 'head';
      else kind = this.secN - (this.lastHead ?? -9) >= 4 ? 'head' : pick(['var', 'call', 'groove', 'var'].filter((k) => k !== prev.kind));
    }
    if (kind === 'head') this.lastHead = this.secN;
    if (kind === 'title' || kind === 'elegy') this.secLen = 1e9;
    if (kind === 'dusk') this.secLen = 4;
    const leads = S.lead;
    const lead = leads.length > 1 ? leads[this.rr('lead' + th, leads.length)] : leads[0];
    const day = !['title', 'elegy', 'chase', 'night'].includes(th);
    const xp = day && !first && (kind === 'var' || kind === 'call') && Math.random() < 0.25 ? pick([5, -2, 2]) : 0;
    const energy = { head: first ? 1 : 2, var: pick([2, 3]), call: 2, groove: 3, breather: 1, dawn: 1, dusk: 0, nocturne: 0, lullaby: 0, stars: 0, chant: 3, break: 3, title: 2, elegy: 0 }[kind] ?? 2;
    this.sec = {
      th, kind, lead, xp, energy,
      prog: this.rr('prog' + th, S.progs.length),
      dt: th === 'title' || th === 'elegy' ? 0 : th === 'chase' ? pick([-2, 0, 4]) : pick([-3, 0, 0, 3]),
      dev: DEVS[this.rr('dev' + th, DEVS.length)],
      riff: S.riff ? this.rr('riff' + th, S.riff.length) : 0,
      alt: Math.random() < 0.5,
    };
    this.secN++;
    if (this.log) this.log.push(`${th}:${kind}/${lead}/p${this.sec.prog}/x${xp}/t${this.sec.dt}/e${energy}`);
  }

  // Key of the band relative to D, for the sfx stings that play along.
  get key() {
    const S = this.song(), k = (((S.tonic + (this.sec.xp || 0) - 62) % 12) + 12) % 12;
    return k > 6 ? k - 12 : k;
  }

  // Before each step: a chase cuts in on the next beat; a bar line builds the bar's plan.
  prep(t) {
    // keyed on barN, not pos: a scheduler that fell behind before the first bar has already set pos to 0
    if (this.barN == null) { this.pos = 0; this.grid = 16; this.barN = 0; this.themeBar = 0; this.secBar = 0; this.secLen = 0; }
    if (this.cut && this.pos % (this.grid === 12 ? 3 : 4) === 0) { this.cut = false; this.pos = 0; }
    if (this.pos === 0 && this.barT !== t) this.barStart(t);
  }

  schedule(step, t, spb) {
    this.prep(t);
    const p = this.pos, ev = this.plan && this.plan[p];
    const S = this.song(), sw = this.grid === 12 ? [0, 0.05, 0][p % 3] : p % 2 ? S.swing || 0 : 0;
    if (ev) for (const [fr, fn] of ev) fn(t + (fr + sw) * spb, spb);
    // sighted: roll into the chase on the next beat
    if (!this.cut && !this.menu && this.theme !== 'chase' && this.pickTheme() === 'chase') {
      this.cut = true;
      const beat = this.grid === 12 ? 3 : 4, left = beat - ((p + 1) % beat);
      for (let i = 1; i <= left; i++) this.hit(i === left ? 'slap' : 'tone', t + i * spb, 0.4 + 0.15 * i, 1, (i % 2) - 0.5);
      this.hit('talk', t + spb, 0.5, 1.2);
    }
    this.pos = p + 1 >= this.grid ? 0 : p + 1;
  }

  barStart(t) {
    this.barT = t;
    this.barN++;
    const want = this.pickTheme(), from = this.theme;
    const urgent = want !== from && (want === 'chase' || want === 'elegy' || want === 'title' || from === 'title' || from === 'elegy');
    this.release = false; this.pickup = null;
    if (urgent || !this.sec.kind) { this.next = null; this.enter(want); }
    else if (this.next) {
      const nx = this.next;
      this.next = null;
      if (nx.force) this.enter(want, nx.kind);
      else if (want === nx.th) this.enter(want, nx.kind);
    } else if (want !== from) {
      const since = this.barN - this.themeBar;
      if (from === 'chase') { this.release = true; this.next = { th: want, kind: 'breather', force: true }; }
      else if (since % 4 === 3) { this.next = { th: want, kind: from === 'night' ? 'dawn' : want === 'night' ? 'dusk' : null }; this.pickup = want; }
    }
    if (this.theme === from && !this.release && this.barN - this.secBar >= this.secLen) this.newSection(this.theme);
    const S = this.song();
    if (this.score) this.score.push({ p: 'bar', t, th: this.theme + ':' + this.sec.kind, first: this.barN === this.secBar, mode: MODE[S.mode].map((x) => (S.tonic + (this.sec.xp || 0) + x) % 12) });
    this.buildBar(t);
  }

  enter(th, kind = null) {
    const prev = this.theme;
    if (th === 'night') this.nightBiome = this.biome;
    this.theme = th;
    this.themeBar = this.barN;
    if (!kind && prev === 'night' && !['chase', 'elegy', 'title'].includes(th)) kind = 'dawn';
    if (!kind && th === 'night' && prev !== 'chase' && prev !== 'title') kind = 'dusk';
    this.newSection(th, kind);
  }

  // ---------------- the arranger: one bar's plan at a time ----------------
  buildBar() {
    const th = this.theme, S = this.song(), sec = this.sec;
    const G = (this.grid = S.grid);
    const plan = (this.plan = Array.from({ length: G }, () => []));
    const W = this.menu ? { rain: 0, heat: 0, fog: 0, dust: 0, storm: 0 } : { rain: this.rain || 0, heat: this.heat || 0, fog: this.fog || 0, dust: this.dust || 0, storm: this.storm || 0 };
    const T = S.tonic + (sec.xp || 0), M = MODE[S.mode];
    const B = {
      th, S, sec, G, W, T, M, beat: G === 12 ? 3 : 4,
      k: this.barN - this.secBar, tb: this.barN - this.themeBar, I: this.menu ? 0 : this.intensity,
      at: (s, fn) => { const i = Math.floor(s); if (i >= 0 && i < G) plan[i].push([s - i, fn]); },
      pitch: (d) => T + deg(M, d),
    };
    B.ci = B.k;
    B.chord = (s = 0) => {
      const bars = S.progs[sec.prog % S.progs.length], c = bars[((B.ci % bars.length) + bars.length) % bars.length];
      return Array.isArray(c[0]) ? c[Math.min(c.length - 1, Math.floor((s * c.length) / G))] : c;
    };
    B.vo = (x, lo) => { let m = T + x; while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; };
    B.play = (name, s, m, vel, len = 1, o = {}) => B.at(s, (tt, spb) => this.voiceNote(name, m, tt, len * spb, vel, o));
    const struck = new Set(); // one stroke per drum per step, however many layers ask for it
    B.drum = (name, s, vel, rate = 1, pan = 0) => { const key = name + s; if (struck.has(key)) return; struck.add(key); B.at(s, (tt) => this.hit(name, tt, vel * (0.9 + Math.random() * 0.15), rate, pan)); };
    const shape = [-1, -1, 0, 0, 1, 1, 1, 0][B.k % 8];
    B.e = Math.max(0, Math.min(3, sec.energy + (sec.kind === 'head' || sec.kind === 'var' ? shape : 0)));
    if (B.I >= 2 && th !== 'chase') B.e = Math.max(B.e, 2);
    if (this.release) this.arrRelease(B);
    else if (th === 'title') this.arrTitle(B);
    else if (th === 'elegy') this.arrElegy(B);
    else if (th === 'chase') this.arrChase(B);
    else if (th === 'night') this.arrNight(B);
    else this.arrSong(B);
    if (!['title', 'elegy', 'chase'].includes(th) && !this.release) { this.layTension(B); this.layWeather(B); }
    if (this.pickup) this.layPickup(B, this.pickup);
  }

  // Melodic voices by name: flute and voices are live; the rest are samples.
  voiceNote(name, m, t, dur, vel = 1, o = {}) {
    t = Math.max(this.ctx.currentTime, t + (LEAN[name] || 0) + (Math.random() - 0.5) * 0.008);
    vel *= 0.92 + Math.random() * 0.14;
    const pan = o.pan ?? SEAT[name] ?? 0;
    if (name === 'flute') return this.flute(m, t, dur, vel, { grace: o.grace, pan, dest: o.dest, vib: o.vib });
    if (name === 'voice' || name === 'chorus') return this.sing(m, t, dur, vel, name === 'chorus' ? 4 : 1, { ...o, pan });
    if (name === 'bolon') return this.bass(m, t, dur, vel);
    if (name === 'talk') return this.hit(o.down ? 'talkDn' : 'talk', t, vel * 0.8, Math.pow(2, (m - 62) / 24), SEAT.talk, o.dest);
    if (o.grace != null) this.inst(name, o.grace, Math.max(this.ctx.currentTime, t - 0.045), vel * 0.5, pan, { dest: o.dest });
    this.inst(name, m, t, vel, pan, { dest: o.dest, len: o.damp ? dur : 0 });
  }

  // Ranges the instruments can actually play; a whole bar moves by octaves to fit.
  fit(name, ms) {
    const R = { flute: [60, 96], kalimba: [60, 93], kora: [41, 89], balafon: [50, 86], marimba: [50, 86], mbira: [38, 81], voice: [48, 76], chorus: [45, 72], ngoni: [45, 81], krar: [48, 84], talk: [50, 80] }[name] || [36, 96];
    if (!ms.length) return 0;
    let sh = 0;
    while (Math.max(...ms) + sh > R[1]) sh -= 12;
    while (Math.min(...ms) + sh < R[0]) sh += 12;
    return sh;
  }

  // One bar of a tune developed for its phrase: ornament, diatonic sequence, inversion,
  // rhythmic displacement, register, or a reworked rhythm.
  develop(bar, op, B) {
    if (!op) return bar;
    const n = B.M.length;
    if (op === 'orn') return bar.map(([s, d, l]) => (l >= 3 ? [s, d, l, d + 1] : [s, d, l]));
    if (op === 'seq') return bar.map(([s, d, l]) => [s, d + 1, l]);
    if (op === 'inv') { const ax = bar[0][1]; return bar.map(([s, d, l]) => [s, 2 * ax - d, l]); }
    if (op === 'disp') return bar.filter(([s]) => s + 1 < B.G).map(([s, d, l]) => [s + 1, d, Math.max(1, Math.min(l, B.G - s - 1))]);
    if (op === 'reg') return bar.map(([s, d, l]) => [s, d + (Math.max(...bar.map((x) => x[1])) > 9 ? -n : n), l]);
    if (op === 'rhy') {
      const out = [];
      for (const [s, d, l] of bar) { if (l >= 4) { const h = Math.floor(l / 2); out.push([s, d, h], [s + h, d - 1, l - h]); } else out.push([s, d, l]); }
      return out;
    }
    return bar;
  }

  // Lay one tune bar on an instrument; the B phrase leans in, the cadence relaxes.
  layTune(B, bar, name, vel, o = {}) {
    const ms = bar.map(([, d]) => B.pitch(d) + (o.oct || 0));
    const sh = this.fit(name, ms);
    const thin = Math.max(B.W.heat, B.W.dust) * 0.35;
    const lean = [0, 0, 0.03, 0, 0.1, 0.12, 0.08, -0.05][B.k % 8];
    bar.forEach(([s, d, l, gd], i) => {
      if (o.half && s >= B.G / 2) return;
      if (thin && i && Math.random() < thin) return;
      let nm = name;
      if (B.W.rain > 0.4 && nm === 'kalimba') nm = 'mbira';
      const v = vel * (1 + lean) * (s % B.beat === 0 ? 1.05 : 0.95) * (1 - B.W.fog * 0.2);
      B.play(nm, s, B.pitch(d) + (o.oct || 0) + sh, v, l * (o.stretch || 1), gd != null ? { grace: B.pitch(gd) + (o.oct || 0) + sh, vowel: o.vowel } : { vowel: o.vowel });
    });
  }

  // An improvised line in the mode: starts from the tune's opening cell when asked (so solos grow
  // out of the theme), walks mostly by step with an arch, and lands on a chord tone.
  layImprov(B, name, vel, o = {}) {
    const { G, beat } = B;
    const cells = G === 12 ? [[0, 1, 2], [0, 2], [0], [0, 1], [1, 2], [0, 0.5, 1, 2]] : [[0, 1, 2, 3], [0, 2], [0, 1, 2], [0, 3], [0, 2, 3], [1, 2, 3], [0]];
    let cur = this.imp ?? 9;
    const evs = [];
    if (o.motif && B.S.tune) {
      const shift = degOf(B.M, B.chord(0)[0]);
      B.S.tune[0].slice(0, 3).forEach(([s, d]) => evs.push([s, d + shift]));
      cur = evs[evs.length - 1][1];
    }
    const from = evs.length ? Math.ceil((evs[evs.length - 1][0] + 1) / beat) : 0;
    for (let b = from; b < 4; b++) {
      const cell = o.dense ? pick(cells.slice(0, 3)) : pick(cells);
      for (const off of cell) {
        const up = b < 2 ? 0.6 : 0.35;
        const r = Math.random(), mv = r < 0.12 ? 0 : r < 0.75 ? 1 : r < 0.93 ? 2 : 3;
        cur += (Math.random() < up ? 1 : -1) * mv;
        cur = Math.max(4, Math.min(15, cur));
        evs.push([b * beat + off, cur]);
      }
    }
    // land the last note on the nearest chord tone
    if (evs.length) {
      const last = evs[evs.length - 1], ct = B.chord(G - 1).map((x) => ((x % 12) + 12) % 12);
      for (let dd = 0; dd < 3; dd++) { if (ct.includes(((deg(B.M, last[1] + dd) % 12) + 12) % 12)) { last[1] += dd; break; } if (ct.includes(((deg(B.M, last[1] - dd) % 12) + 12) % 12)) { last[1] -= dd; break; } }
    }
    this.imp = evs.length ? evs[evs.length - 1][1] : cur;
    const ms = evs.map(([, d]) => B.pitch(d) + (o.oct || 0)), sh = this.fit(name, ms);
    evs.forEach(([s, d], i) => B.play(name, s, B.pitch(d) + (o.oct || 0) + sh, vel * (i === evs.length - 1 ? 1 : 0.85), i === evs.length - 1 ? 3 : 1));
  }

  // The accompaniment idioms.
  layOst(B, vel = 1) {
    const { S, sec, G, k, tb } = B;
    const name = S.ost;
    if (name === 'kumbengo' || name === 'palm') {
      // kora: thumbs on the bass strings, index fingers on the treble, crossing the beat
      const P = name === 'palm' ? [[0, 'L0'], [3, 'T1'], [6, 'M2'], [8, 'L2'], [10, 'T0'], [12, 'M1'], [14, 'T2']]
        : G === 12 ? (sec.alt ? [[0, 'L0'], [1, 'T1'], [3, 'L2'], [4, 'M0'], [6, 'L0'], [7, 'T1'], [9, 'L2'], [10, 'M2']] : [[0, 'L0'], [2, 'M1'], [3, 'L2'], [5, 'T0'], [6, 'M0'], [8, 'M1'], [9, 'L2'], [11, 'T2']])
          : sec.alt ? [[0, 'L0'], [2, 'T1'], [4, 'L2'], [6, 'M0'], [8, 'L0'], [10, 'T1'], [12, 'L2'], [14, 'M2']] : [[0, 'L0'], [3, 'M1'], [6, 'L2'], [8, 'T0'], [10, 'M1'], [11, 'L2'], [14, 'T2']];
      const inst = sec.lead === 'kora' ? 'balafon' : 'kora';
      const run = k % 4 === 3 && B.e >= 1 && inst === 'kora';
      for (const [s, v] of P) {
        if (run && s >= G / 2) continue;
        const c = B.chord(s), reg = v[0], i = +v[1];
        const lo = reg === 'L' ? 45 : reg === 'M' ? 57 : 67;
        B.play(inst, s, B.vo(c[i], lo), vel * (reg === 'L' ? 0.55 : reg === 'M' ? 0.42 : 0.48) * (s % B.beat === 0 ? 1.1 : 0.9));
      }
      // birimintingo: a run down the treble strings closes each phrase
      if (run) { const top = degOf(B.M, B.chord(G - 1)[0]) + B.M.length + 4; const hi = B.pitch(top) > 84 ? -12 : 0; for (let s = G / 2, i = 0; s < G; s++, i++) B.play('kora', s, B.pitch(top - i - (G === 12 ? 2 : 0)) + hi, vel * (0.5 - i * 0.02)); }
      if (name === 'palm' && B.e >= 2) for (const s of [2, 6, 10, 14]) { const c = B.chord(s); B.play('balafon', s, B.vo(c[1], 64), vel * 0.28); B.play('balafon', s, B.vo(c[2], 64), vel * 0.22); }
    } else if (name === 'hocket') {
      const pat = S.hocket[sec.alt ? 1 : 0];
      for (let s = 0; s < G; s++) {
        const idx = (tb * 8 + (s >> 1)) % 12;
        // an octave under the tune, so the flute sits on top of the interlock
        if (s % 2 === 0) B.play('balafon', s, B.pitch(pat[0][idx] - 5), vel * 0.5, 1, { pan: 0.4 });
        else if (B.e >= 1 || k % 2) B.play('balafon', s, B.pitch(pat[1][idx] - 5), vel * 0.36, 1, { pan: -0.2 });
      }
    } else if (name === 'mbira') {
      // kushaura on the even pulses, kutsinhira on the odd, three chords a bar; the top notes
      // move by the smallest step, so a melody rises out of the interlock
      let top = this.mtop ?? 72;
      for (let slot = 0; slot < 3; slot++) {
        const c = B.chord(slot * 4), s0 = slot * 4;
        const tops = c.map((x) => B.vo(x, 67)).concat(c.map((x) => B.vo(x, 67) + 12));
        top = tops.reduce((a, b) => (Math.abs(b - top) < Math.abs(a - top) && b !== top ? b : a), tops[0]);
        B.play('mbira', s0, B.vo(c[0], 43), vel * 0.55, 1, { pan: -0.25 });
        B.play('mbira', s0 + 2, top, vel * 0.5, 1, { pan: -0.25 });
        if (B.e >= 1 || sec.kind !== 'head' || k >= 2) {
          B.play('mbira', s0 + 1, B.vo(c[1], 55), vel * 0.4, 1, { pan: 0.3 });
          B.play('mbira', s0 + 3, B.vo(c[2], 60), vel * 0.38, 1, { pan: 0.3 });
        }
      }
      this.mtop = top;
    } else if (name === 'riff' || name === 'krar') {
      const r = S.riff[(tb + sec.riff) % S.riff.length];
      let sh = degOf(B.M, B.chord(0)[0]);
      if (sh > B.M.length / 2) sh -= B.M.length;
      const inst = name === 'krar' ? 'krar' : sec.lead === 'ngoni' ? 'kora' : 'ngoni';
      r.forEach(([s, d, l]) => B.play(inst, s, B.pitch(d + sh), vel * (s === 0 ? 0.6 : 0.46), l, { damp: name === 'riff' }));
      if (name === 'krar' && B.e >= 2 && k % 2) r.slice(0, 3).forEach(([s, d]) => B.play('krar', s + 6, B.pitch(d + sh + 5), vel * 0.3));
    } else if (name === 'ash') {
      if (k % 2 === 0) { B.play('mbira', 0, B.vo(B.chord(0)[0], 45), vel * 0.5); B.play('mbira', 0.08, B.vo(B.chord(0)[1], 52), vel * 0.35); }
      if (Math.random() < 0.5) B.play('kalimba', 8 + 2 * Math.floor(Math.random() * 4), B.vo(pick(B.chord(8)), 74), vel * 0.22, 1, { pan: Math.random() - 0.5 });
    } else if (name === 'night') {
      const open = [3, 4, 5].includes(this.nightBiome ?? this.biome);
      if (open || sec.kind === 'stars') { if (tb % 2 === 0) B.at(0, (tt, spb) => this.pad([B.T - 12, B.T - 5], tt, spb * 32, 0.08, 0.9)); }
      else {
        B.at(0, (tt, spb) => this.pad(B.chord(0).map((x) => B.vo(x, 57)), tt, spb * 16, 0.1, 0.7));
        const c = B.chord(0), ins = (this.nightBiome ?? this.biome) === 2 ? 'mbira' : 'kora';
        [[0, 0, 50], [4, 2, 57], [8, 1, 60], [12, 2, 57]].forEach(([s, i, lo]) => { if (s !== 8 || k % 2) B.play(ins, s, B.vo(c[i], lo), vel * 0.32); });
      }
    }
  }

  layBass(B, vel = 1) {
    const pats = {
      title: [[0, 0, 6], [10, 0, 4], [14, 2, 2]], savanna: [[0, 0, 6], [7, 2, 2], [9, 0, 3]], coast: [[0, 0, 5], [6, 2, 2], [10, 0, 4], [14, 1, 2]],
      woodland: [[0, 0, 4], [6, 0, 2], [10, 2, 4]], desert: [[0, 0, 5], [6, 0, 3], [9, 2, 3]], highland: [[0, 0, 6], [6, 2, 6]], ash: [[0, 0, 16]],
      night: [[0, 0, 16]], chase: [[0, 0, 2], [3, 0, 2], [6, 0, 2], [8, 2, 1], [9, 0, 2]], wetland: [[0, 0, 4], [4, 0, 4], [8, 0, 4]],
    }[B.th] || [[0, 0, 8]];
    for (const [s, i, l] of pats) { const c = B.chord(s); B.play('bolon', s, B.vo(c[i], 38), vel * (s === 0 ? 0.85 : 0.65), l); }
  }

  layDrums(B, e) {
    const K = KITS[B.S.kit];
    if (!K) return;
    const { G, beat, k } = B;
    const fill = e >= 2 && k % 8 === 7;
    if (K.heart) K.heart.forEach(([s, v]) => B.drum('heart', s, v * 0.6));
    if (K.udu && e >= 1) K.udu.forEach((s) => { if (Math.random() < 0.6) B.drum('udu', s, 0.35, 0.9 + Math.random() * 0.3); });
    if (e >= 1 && K.shek) {
      for (let s = 0; s < G; s++) {
        if (K.shek === 'triple') B.drum(s % 3 === 0 ? 'shek' : 'shekUp', s, s % 3 === 0 ? 0.8 : s % 3 === 2 ? 0.55 : 0.4);
        else if (K.shek === 'hosho') B.drum(s % 3 === 2 ? 'shek' : 'shekUp', s, [0.5, 0.35, 0.8][s % 3]);
        else if (K.shek === 'beat' && s % 3 === 0) B.drum('shek', s, 0.6);
        else if (K.shek === 'off' && s % 2 === 0) B.drum(s % 4 === 2 ? 'shek' : 'shekUp', s, s % 4 === 2 ? 0.7 : 0.4);
      }
    }
    if (e >= 2) {
      if (K.dun) K.dun.forEach(([s, v]) => B.drum('dun', s, v * 0.8));
      if (K.bell) K.bell.forEach((s) => B.drum(s === 0 ? 'bellLo' : 'bell', s, s === 0 ? 0.8 : 0.6));
      if (K.ken && e >= 3) K.ken.forEach((s) => B.drum('ken', s, 0.5));
    }
    if (e >= 3 || (e >= 2 && K.clap && !K.dj)) {
      if (K.dj) K.dj.forEach(([s, n, v]) => {
        if (fill && s >= G - beat) return;
        B.drum(n, s, v * 0.8);
        if (n === 'slap' && Math.random() < 0.15) B.drum('slap', s - 0.12, v * 0.35); // a flam
      });
      if (K.clap) K.clap.forEach((s) => B.drum('clap', s, 0.6));
    }
    // a lead djembe fill into the next phrase
    if (fill) for (let s = G - beat, i = 0; s < G; s++, i++) { B.drum(i % 2 ? 'tone' : 'slap', s, 0.55 + 0.12 * i); if (G === 16) B.drum('slap', s + 0.5, 0.4 + 0.1 * i); }
    // the talking drum answers at the end of a half-phrase
    if (e >= 2 && k % 4 === 1 && !fill) { B.drum('talk', G - beat, 0.5, 1.1); B.drum('talkDn', G - beat + beat / 2, 0.45, 1); B.drum('talk', G - 1, 0.5, 1.25); }
  }

  // Day themes: the tune and its developments over the land's own accompaniment.
  arrSong(B) {
    const { S, sec, k, e } = B, kind = sec.kind;
    const tune = S.tune, lead = sec.lead, ph = Math.floor((k % 8) / 2);
    let ostVel = 1;
    if (kind === 'dawn') {
      // the bloom: a chord swells and the strings climb into the light, then the tune
      if (k < 4) {
        if (k % 2 === 0) B.at(0, (tt, spb) => this.pad(B.chord(0).map((x) => B.vo(x, 57)).concat(B.vo(B.chord(0)[0], 69)), tt, spb * B.G * 2, 0.2 + k * 0.15, 0.6 + k * 0.15));
        for (let s = 0, i = 0; s < B.G; s += B.G === 12 ? 1 : 2, i++) B.play('kora', s, B.pitch(k * 2 + i - 2), 0.25 + 0.05 * k);
        if (k >= 2) for (let s = 0; s < B.G; s += B.beat) if (Math.random() < 0.5) B.play('kalimba', s + B.beat / 2, B.vo(pick(B.chord(s)), 79), 0.25, 1, { pan: Math.random() - 0.5 });
        if (k >= 2) this.layBass(B, 0.6);
        return;
      }
      this.layOst(B, 0.85); this.layBass(B, 0.8);
      this.layTune(B, tune[k - 4], 'flute', 0.85);
      if (k >= 6) this.layDrums(B, 1);
      return;
    }
    if (kind === 'breather') {
      this.layOst(B, 0.7);
      if (k >= 1) this.layBass(B, 0.6);
      if (k >= 1) this.layTune(B, tune[(k - 1) % 4], 'flute', 0.7, { stretch: 1.1 });
      if (k >= 4) this.layDrums(B, 1);
      return;
    }
    this.layOst(B, ostVel);
    if (e >= 1 || k >= 2) this.layBass(B, 0.9);
    this.layDrums(B, e);
    const half = B.I >= 2; // as they close in, the tune breaks into fragments
    if (kind === 'head') {
      const name = S.lead.length > 1 && k >= 4 && sec.alt ? S.lead.find((x) => x !== lead) : lead;
      this.layTune(B, tune[k % 8], name, 0.85, { half });
      // the answering instrument echoes the opening of a phrase in the gap after it
      if (k % 2 === 1 && !half && S.answer !== 'talk') this.layTune(B, tune[(k - 1) % 8].slice(0, 3).map(([s, d, l]) => [s + B.G / 2, d - (B.M.length === 5 ? 0 : 2), Math.min(l, 2)]).filter(([s]) => s < B.G), S.answer === 'chorus' ? 'chorus' : S.answer, 0.5, { vowel: 'e' });
      if (k % 2 === 1 && S.answer === 'talk') this.layTalkAnswer(B, tune[(k - 1) % 8]);
    } else if (kind === 'var') {
      this.layTune(B, this.develop(tune[k % 8], sec.dev[ph], B), lead, 0.85, { half });
      if (k % 4 === 3 && e >= 2) this.layImprov(B, S.counter, 0.4);
    } else if (kind === 'call') {
      // call and response: the lead calls, another voice answers with the call reworked
      if (k % 2 === 0) this.layTune(B, tune[k % 8], lead, 0.85, { half });
      else {
        const ans = S.answer, call = tune[(k - 1) % 8];
        if (ans === 'talk') this.layTalkAnswer(B, call);
        else this.layTune(B, this.develop(call, pick(['seq', 'inv', 'disp', 'orn']), B), ans, ans === 'chorus' || ans === 'voice' ? 0.6 : 0.7, { oct: ans === 'balafon' || ans === 'kora' ? -12 : 0, vowel: 'a' });
      }
    } else if (kind === 'groove') {
      // no tune: the counter instrument solos out of the theme's opening, the lead calls the motif
      if (k % 4 === 0) this.layTune(B, tune[0].slice(0, 3), lead, 0.7);
      else this.layImprov(B, S.counter, 0.5, { motif: k % 4 === 1, dense: k % 4 === 3 });
    }
  }

  // The talking drum speaks the rhythm and contour of a call back to it.
  layTalkAnswer(B, call) {
    call.forEach(([s, d], i) => { const m = B.pitch(d); B.play('talk', s, m, 0.55, 1, { down: i > 0 && d < call[i - 1][1] }); });
  }

  arrNight(B) {
    const { S, sec, k } = B, kind = sec.kind;
    this.layOst(B, 0.9);
    if (B.k % 4 === 0 && (this.nightBiome ?? this.biome) !== 3) this.layBass(B, 0.45);
    if (kind === 'dusk') {
      // the day's last light: a slow fall down the strings over a darkening chord
      for (let i = 0; i < 4; i++) B.play(k % 2 ? 'mbira' : 'kora', i * B.beat, B.pitch(11 - k * 2 - i), 0.4 - k * 0.05);
      return;
    }
    if (kind === 'nocturne') this.layTune(B, S.tune[k % 8], 'flute', 1, { stretch: 1.05 });
    else if (kind === 'lullaby') {
      this.layTune(B, S.tune[k % 8], 'mbira', 0.95, { oct: -12 });
      if (k % 2 === 1) this.layTune(B, S.tune[k % 8].slice(0, 2).map(([s, d, l]) => [s + B.G / 2, d + 7, l]).filter(([s]) => s < B.G), 'kalimba', 0.35);
    } else {
      // stars: the tune's outline as single high notes, far apart
      S.tune[k % 8].forEach(([s, d], i) => { if (i % 2 === 0) B.play('kalimba', s, B.pitch(d) + 12, 0.55, 1, { pan: Math.random() * 0.8 - 0.4 }); });
      if (k % 2 === 0) B.play('kora', 0, B.vo(B.chord(0)[0], 45), 0.45);
    }
  }

  arrChase(B) {
    const { S, sec, k, G } = B, kind = sec.kind;
    const brk = kind === 'break' && k < 4;
    if (!brk) this.layDrums(B, 3);
    else {
      // the break: dundun and a talking-drum solo, then the band slams back in
      [[0, 1], [3, 0.7], [6, 1], [9, 0.7]].forEach(([s, v]) => B.drum('dun', s, v * 0.8));
      for (let s = 0; s < G; s++) if (Math.random() < 0.55) B.drum(Math.random() < 0.5 ? 'talk' : 'talkDn', s, 0.45 + Math.random() * 0.3, 0.8 + Math.random() * 0.6);
      for (let s = 0; s < G; s += 3) B.drum('shek', s, 0.7);
    }
    this.layBass(B, 0.95);
    // the kora riff, grouped in twos across the threes, moving with the chord
    if (!brk || k >= 2) {
      const r = S.riff[(sec.riff + Math.floor(k / 4)) % S.riff.length];
      let sh = degOf(B.M, B.chord(0)[0]);
      if (sh > 3) sh -= 7;
      r.forEach(([s, d]) => B.play('kora', s, B.pitch(d + sh), 0.55, 1, { damp: true }));
    }
    if (kind === 'chant') {
      const v = Math.floor(k / 4) % 2;
      if (k % 2 === 0) this.layTune(B, S.call[v], 'voice', 0.8, { oct: -12, vowel: 'e' });
      else this.layTune(B, S.resp[v], 'chorus', 0.75, { oct: 0, vowel: 'a' });
    } else if (kind === 'groove' && k % 4 === 0) B.at(0, (tt, spb) => this.chant(tt, spb * G * 1.9, 0.75));
    else if (kind === 'break' && k === 4) B.at(0, (tt) => this.sing(B.T + 12, tt, 0.35, 0.9, 4, { vowel: 'e', oct: true }));
  }

  // Out of the chase: one bar that lands the run and lets the breath go.
  arrRelease(B) {
    const { G, T } = B;
    B.drum('dun', 0, 1); B.drum('bass', 0, 1); B.drum('slap', 0, 0.8); B.drum('bellLo', 0, 0.7);
    B.at(0, (tt) => this.sing(T + 12, tt, 0.3, 0.85, 4, { vowel: 'e', oct: true }));
    B.at(3, (tt, spb) => this.sing(T + 12, tt, spb * (G - 3), 0.45, 4, { vowel: 'oa', fall: true }));
    B.play('bolon', 0, B.vo(0, 38), 0.9, G);
    for (let s = 3, i = 0; s < G; s++, i++) B.play('kora', s, B.pitch(14 - i), 0.45 - i * 0.02);
  }

  // Title: intro on the kora, the tune on kalimba, again on flute with the band and a sung
  // answer, the B phrase at full strength, then a breakdown with a kora solo and back round.
  arrTitle(B) {
    const S = B.S, tb = B.tb;
    const p = tb < 4 ? tb : 4 + ((tb - 4) % 24), round = tb < 4 ? 0 : Math.floor((tb - 4) / 24);
    const tuneBar = p >= 4 && p < 12 ? p - 4 : p >= 12 && p < 20 ? p - 12 : p >= 20 && p < 24 ? p - 16 : p < 4 ? p : p - 20;
    B.ci = tuneBar; B.k = tuneBar;
    if (p < 4) {
      this.layOst(B, 0.7 + p * 0.08);
      if (p >= 2) B.at(0, (tt, spb) => this.pad(B.chord(0).map((x) => B.vo(x, 57)), tt, spb * 16, 0.25, 0.6));
      if (p === 3) { B.drum('talk', 8, 0.5, 1); B.drum('talkDn', 10, 0.45); B.drum('talk', 12, 0.55, 1.15); B.drum('talk', 14, 0.6, 1.3); }
      return;
    }
    this.layOst(B, 0.9);
    this.layBass(B, 0.85);
    if (p < 12) {
      this.layDrums(B, p >= 8 ? 1 : 0);
      this.layTune(B, S.tune[tuneBar], round % 2 ? 'flute' : 'kalimba', 0.9);
    } else if (p < 20) {
      this.layDrums(B, p >= 16 ? 3 : 2);
      if (tuneBar % 2 === 0) this.layTune(B, S.tune[tuneBar], round % 2 ? 'kalimba' : 'flute', 0.9);
      else this.layTune(B, S.tune[tuneBar], 'chorus', 0.6, { vowel: 'a' });
      if (tuneBar % 2 === 1) this.layImprov(B, 'balafon', 0.3, { oct: -12 });
    } else if (p < 24) {
      this.layDrums(B, 3);
      this.layTune(B, S.tune[tuneBar], 'flute', 0.95);
      this.layTune(B, S.tune[tuneBar], 'kalimba', 0.55, { oct: -12 });
      if (p === 23) B.at(8, (tt, spb) => this.sing(B.T, tt, spb * 8, 0.55, 4, { vowel: 'oa', oct: true }));
    } else {
      this.layDrums(B, 1);
      if (p < 27) this.layImprov(B, 'kora', 0.5, { motif: p === 24, dense: p === 26 });
      else { B.drum('talk', 8, 0.5); B.drum('talk', 11, 0.5, 1.15); B.drum('slap', 12, 0.6); B.drum('slap', 14, 0.7); B.drum('slap', 15, 0.8); }
    }
  }

  // Death: the title tune again, slowed and in the minor, each bar stretched over two, the flute
  // alone over a kora; then a quiet coda that keeps recalling its opening.
  arrElegy(B) {
    const tb = B.tb, S = B.S, ord = [0, 1, 2, 3, 6, 7];
    if (tb < 12) {
      const j = ord[tb >> 1], half = tb % 2;
      B.ci = j;
      const notes = S.tune[j].map(([s, d, l]) => [s * 2 - half * 16, d, l * 2]).filter(([s]) => s >= 0 && s < 16);
      this.layTune(B, notes, 'flute', 0.75);
      if (half === 0) B.at(0, (tt, spb) => this.pad(B.chord(0).map((x) => B.vo(x, 55)), tt, spb * 32, 0.12, 0.8));
    } else B.ci = (tb >> 1) % 2 ? 7 : 0;
    const c = B.chord(0);
    [[0, 0, 45], [4, 2, 57], [8, 1, 60], [12, 2, 57]].forEach(([s, i, lo]) => B.play('kora', s, B.vo(c[i], lo), tb < 12 ? 0.4 : 0.28));
    if (tb % 2 === 0) B.play('bolon', 0, B.vo(c[0], 38), 0.6, 16);
    if (tb >= 12 && tb % 4 === 2) this.layTune(B, S.tune[0].slice(0, 3).map(([s, d, l]) => [s * 2, d, l * 2]), 'flute', 0.4);
  }

  // The hunters on your trail: a distant talking drum, then a pulse as they close.
  layTension(B) {
    const { I, G, beat, tb } = B;
    if (I < 1) return;
    const far = I < 2;
    if (tb % 2 === 1 || !far) {
      const side = tb % 4 < 2 ? 0.6 : -0.6;
      const call = G === 12 ? [[6, 'talk', 1], [8, 'talkDn', 0.9], [9, 'talk', 1.15], [11, 'talkDn', 1]] : [[8, 'talk', 1], [11, 'talkDn', 0.9], [12, 'talk', 1.15], [14, 'talkDn', 1]];
      call.forEach(([s, n, r]) => B.at(s, (tt) => this.hit(n, tt, (far ? 0.28 : 0.45) * (0.85 + Math.random() * 0.3), r * (0.95 + Math.random() * 0.1), side)));
    }
    if (!far) {
      // a pulse on every beat, low and close, like footfalls
      for (let s = 0; s < G; s += beat) B.drum(s === 0 ? 'dun' : 'ken', s, s === 0 ? 0.42 : 0.3);
      for (let s = 0; s < G; s += beat / (G === 12 ? 3 : 2)) B.drum('shekUp', s, 0.3);
    }
  }

  layWeather(B) {
    const { W, tb, T } = B;
    if (W.rain > 0.4) B.at(Math.floor(Math.random() * B.G), (tt) => { if (Math.random() < 0.6 * W.rain) this.inst('kalimba', B.vo(pick(B.chord(0)), 79), tt, 0.25, Math.random() - 0.5); });
    if (W.storm > 0.4 && tb % 2 === 0) B.drum('dun', 0, 0.45 * W.storm, 0.6);
    if (W.heat > 0.4 && tb % 4 === 0) B.at(0, (tt, spb) => this.pad([B.vo(0, 74), B.vo(7, 74)], tt, spb * B.G * 4, 0.9, 0.35 * W.heat));
    void T;
  }

  // The last beat before a new theme: a run up (or, into night, down) to its tonic.
  layPickup(B, th) {
    const S2 = this.song(th === 'night' ? 'night' : th), M2 = MODE[S2.mode];
    const down = th === 'night';
    let t2 = S2.tonic;
    while (t2 < 64) t2 += 12;
    for (let i = 0; i < B.beat; i++) {
      const d = down ? 3 - i : i - B.beat;
      B.play('kora', B.G - B.beat + i, t2 + deg(M2, d), 0.35 + 0.05 * i);
    }
  }

  // ---------------- stingers ----------------
  // Short musical cues in the key and on the grid of whatever is playing; the band ducks under
  // them. main.js calls these for game moments (see the report in tools/musicpack.html).
  cue(kind) {
    if (!this.ctx || !this.mk) return;
    if (kind === 'death') this.dead = true;
    if (kind === 'start') this.dead = false;
    const ctx = this.ctx, S = this.song(), M = MODE[S.mode], T = S.tonic + (this.sec.xp || 0);
    const d = this.stepDur(), now = ctx.currentTime + 0.01;
    let t = now;
    if (this.playing && this.nextTime > now) { t = this.nextTime - Math.floor((this.nextTime - now) / d) * d; if (t - now > 0.12) t = now; }
    const P = (x, lo = 60) => { let m = T + deg(M, x); while (m < lo) m += 12; while (m >= lo + 24) m -= 12; return m; };
    const dest = this.mbus;
    const N = (name, m, at, vel, len = 0.4, o = {}) => this.voiceNote(name, m, t + at, len, vel, { ...o, dest });
    const H = (name, at, vel, rate = 1) => this.hit(name, t + at, vel, rate, 0, dest);
    this.duck(t, kind === 'death' ? 0.3 : 0.65, kind === 'death' ? 2.5 : 0.6);
    const h = d * (this.grid === 12 ? 1 : 2) * 0.5;
    switch (kind) {
      case 'kill': { // a kora flourish up the chord to the octave, on a dundun hit
        const n = M.length, base = P(0, 62);
        [0, 2, 4, n].forEach((x, i) => N('kora', base + deg(M, x), i * h, 0.75 - i * 0.04));
        N('balafon', base + 12, 4 * h, 0.55);
        H('dun', 0, 0.8); H('slap', 4 * h, 0.6);
        break;
      }
      case 'dodge': N('kalimba', P(4, 74), 0, 0.6, 0.3, { grace: P(5, 74) }); N('kalimba', P(7, 74), h, 0.45); H('shekUp', 0, 0.6); break;
      case 'secret': {
        const n = M.length;
        [0, 2, 4, n - 1, n, n + 2].forEach((x, i) => N(i < 3 ? 'mbira' : 'kalimba', P(x, 62), i * h * 1.5, 0.6));
        this.pad([P(0, 57), P(2, 57), P(4, 57), P(1, 69)], t, 2.6, 0.5, 0.9);
        H('bellLo', 6 * h * 1.5, 0.5);
        break;
      }
      case 'feat': { // the title's hunting call, as a fanfare
        [[0, 4, 1], [1, 7, 1], [2, 8, 1], [3, 9, 3]].forEach(([s, x, l]) => N('flute', P(x, 60), s * h * 2, 0.9, l * h * 2));
        H('dun', 0, 0.8); H('bell', 0, 0.6); H('bell', 2 * h, 0.5); H('bell', 6 * h, 0.7); H('dun', 6 * h, 0.9);
        this.sing(P(0, 55), t + 6 * h, 0.4, 0.7, 4, { vowel: 'e', oct: true, dest });
        break;
      }
      case 'perk': {
        for (let i = 0; i <= M.length; i++) N('kora', P(i, 60), i * h * 0.7, 0.5 + i * 0.03);
        this.pad([P(0, 57), P(2, 57), P(4, 57)], t + h * 4, 1.8, 0.45, 0.8);
        N('kalimba', P(M.length, 72), h * 6, 0.5);
        break;
      }
      case 'dawn': {
        for (let i = 0; i <= 2 * M.length; i++) N('kora', P(i, 50), i * h * 0.6, 0.35 + i * 0.02);
        N('flute', P(0, 62), h * 8, 0.8, h * 6); N('flute', P(4, 62), h * 14, 0.8, h * 10);
        this.pad([P(0, 57), P(4, 57), P(2, 64)], t, 4, 0.5, 0.9);
        break;
      }
      case 'dusk': {
        [M.length + 4, M.length + 2, M.length, 4, 2, 0].forEach((x, i) => N('mbira', P(x, 50), i * h * 2.5, 0.55));
        this.pad([P(0, 50), P(4, 50)], t, 3.5, 0.1, 0.9);
        break;
      }
      case 'hurt': H('talkDn', 0, 0.6, 0.75); N('mbira', P(0, 48), 0, 0.5, 0.3); N('mbira', P(0, 48) + 1, 0.03, 0.4, 0.3); break;
      case 'death': {
        H('dun', 0, 1); H('talkDn', h * 2, 0.6, 0.7);
        [[0, 7], [3, 4], [6, 3], [9, 2], [14, 0]].forEach(([s, x], i) => N('flute', P(x, 60), 0.3 + s * h * 1.5, 0.75, h * (i === 4 ? 12 : 4.5)));
        break;
      }
      case 'start': {
        H('dun', 0, 0.9); H('dun', h * 0.25, 0.5); H('dun', h * 3, 0.9);
        this.sing(P(0, 50), t + h * 3, 0.45, 0.8, 4, { vowel: 'e', oct: true, dest });
        for (let i = 0; i < 4; i++) N('kora', P(i - 4, 58), h * (4 + i * 0.5), 0.5);
        N('kora', P(0, 62), h * 6, 0.7);
        break;
      }
      case 'escape': {
        this.sing(P(4, 55), t, 1.6, 0.5, 4, { vowel: 'oa', fall: true, dest });
        for (let i = 0; i < 6; i++) N('kora', P(2 * M.length - i, 60), h * (1 + i), 0.45 - i * 0.03);
        break;
      }
    }
  }

  // Weather turning is marked with a short cue (hysteresis so a wobble can't retrigger it).
  // update() calls this every frame, so it also drives the ambience mix.
  weatherStings(rain, dust, heat, fog, storm) {
    if (this.sfxBufs) this.ambTick(rain, dust, heat, fog, storm);
    if (this.menu) { this.wxOn = {}; return; }
    const on = this.wxOn;
    const edge = (k, v, hi, lo) => {
      if (!on[k] && v > hi) { on[k] = true; return true; }
      if (on[k] && v < lo) on[k] = false;
      return false;
    };
    const s = edge('storm', storm, 0.5, 0.15), r = edge('rain', rain, 0.5, 0.15);
    const d = edge('dust', dust, 0.4, 0.1), h = edge('heat', heat, 0.4, 0.1), f = edge('fog', fog, 0.4, 0.1);
    if (s) this.sting('storm');
    else if (r && !on.storm) this.sting('rain');
    if (d) this.sting('dust');
    if (h) this.sting('heat');
    if (f) this.sting('fog');
  }

  // ---------------- one-shots ----------------
  // Musical stings choose among variants and never play the same one twice running.
  sting(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const spb = 60 / this.tempo / 4;
    const x = this.key;
    const fl = (seq, vel, len = 5, off = 0) => seq.forEach(([m, s]) => this.flute(m + x, t + off + s * spb, spb * len, vel));
    const ar = (name, ms, gap, vel, off = 0) => ms.forEach((m, i) => this.inst(name, m + x, t + off + i * gap, vel, (i / Math.max(1, ms.length - 1) - 0.5) * 0.6));
    const calm = this.intensity >= 2 && !this.menu ? 0.6 : 1; // weather cues duck under a hunt
    switch (kind) {
      case 'dawn': {
        const v = this.rr('dawn', 3);
        if (v === 0) { fl([[62, 0], [69, 2], [74, 4], [72, 8], [74, 10]], 1); ar('kora', [50, 57, 62], 0.06, 0.7); }
        else if (v === 1) { ar('kalimba', [62, 65, 69, 74, 77, 81], 0.11, 0.8); fl([[81, 8], [79, 12], [81, 14]], 0.7, 6); this.pad([62 + x, 69 + x, 74 + x], t, 3, 0.45, 0.9); }
        else { ar('kora', [50, 57, 62, 65, 69], 0.05, 0.65); fl([[69, 4], [72, 6], [74, 8], [77, 12]], 0.85); }
        break;
      }
      case 'dusk': {
        const v = this.rr('dusk', 3);
        if (v === 0) fl([[74, 0], [72, 3], [69, 6], [65, 10]], 0.8);
        else if (v === 1) { ar('mbira', [74, 69, 65, 62, 57], 0.2, 0.7); this.pad([50 + x, 57 + x, 62 + x], t, 3.2, 0.12, 1); }
        else { fl([[81, 0], [77, 4], [74, 8]], 0.7, 6); this.inst('kora', 50 + x, t + spb * 12, 0.7); this.inst('kora', 38 + x, t + spb * 12, 0.5); }
        break;
      }
      case 'death':
        this.hit('bass', t, 1.2, 0.7);
        this.pad([50, 53, 57], t + 0.1, 3.5, 0.1, 1.4);
        [[69, 0], [67, 4], [65, 8], [62, 14]].forEach(([m, s]) => this.flute(m, t + 0.4 + s * spb * 1.5, spb * 7, 0.9));
        break;
      case 'start':
        this.hit('bass', t, 1); this.hit('bass', t + spb * 3, 0.9); this.hit('talk', t + spb * 6, 0.8);
        this.chant(t, 2.2, 0.8);
        break;
      case 'secret': {
        const v = this.rr('secret', 3);
        ar(v === 2 ? 'kora' : 'kalimba', [[74, 78, 81, 86], [69, 74, 78, 81, 86, 90], [86, 81, 78, 74, 78, 81, 86]][v], v === 1 ? 0.07 : 0.09, 0.9);
        this.pad([62 + x, 66 + x, 69 + x], t, 2.5, 0.4, 1);
        break;
      }
      case 'perk': {
        const v = this.rr('perk', 3);
        ar('kora', [[62, 69, 74, 77], [57, 62, 65, 69, 74], [74, 77, 81, 86]][v], 0.07, 0.8);
        if (v === 2) this.inst('kalimba', 86 + x, t + 0.35, 0.5);
        break;
      }
      // weather turning
      case 'rain': // drops running down the kalimba
        [86, 81, 79, 74, 72, 69].forEach((m, i) => this.inst('kalimba', m + x, t + i * 0.16 + Math.random() * 0.05, 0.6 * calm, Math.random() - 0.5));
        this.pad([62 + x, 65 + x, 69 + x], t, 3, 0.2, 0.8 * calm);
        break;
      case 'storm': // a dark cluster under a low drum
        this.hit('talk', t, 0.5 * calm, 0.6); this.hit('bass', t + 0.35, 0.6 * calm, 0.55);
        this.pad([50 + x, 51 + x, 57 + x], t, 3.2, 0.1, 1.2 * calm);
        fl([[62, 4], [63, 7], [62, 10]], 0.8 * calm, 4);
        break;
      case 'heat': // a bleached, high shimmer
        this.pad([74 + x, 81 + x, 86 + x], t, 3.5, 0.95, 0.6 * calm);
        fl([[81, 2], [79, 10]], 0.6 * calm, 8);
        break;
      case 'dust': // a quick phrygian run and a hollow fifth
        [74, 75, 72, 70, 69].forEach((m, i) => this.inst('kora', m + x, t + i * 0.08, 0.6 * calm, 0.3));
        this.pad([38 + x, 45 + x], t, 3, 0.15, 1.1 * calm);
        break;
      case 'fog': // a low, veiled call
        fl([[62, 0], [65, 8]], 0.6 * calm, 8);
        this.inst('mbira', 50 + x, t, 0.6 * calm);
        this.pad([50 + x, 57 + x], t, 3.5, 0.08, calm);
        break;
    }
  }

  // A short musical tag when a kill lands, in the band's key, on the sfx bus so it reads as feedback.
  killTag(t) {
    const x = this.key;
    const figs = [[62, 69, 74], [69, 74, 77], [65, 69, 72, 74], [74, 72, 74], [57, 62, 69]];
    const f = figs[this.rr('killtag', figs.length)];
    const name = pick(['kalimba', 'kora', 'marimba']);
    const g = { kora: 0.3, marimba: 0.28, kalimba: 0.24 }[name] * 0.9;
    f.forEach((m, i) => this.playBuf(this.note(name, m + x), t + 0.1 + i * 0.075, g, { dest: this.sfx, pan: (i - 1) * 0.2, verb: 0.3 }));
  }

  // One-shot cues. Positional ones get { vol, pan } from main: farther is quieter, duller, wetter.
  // Every cue draws a different take each time (never the same twice running) with a little
  // pitch spread, so nothing machine-guns.
  play(name, opts = {}) {
    if (!this.ctx || this.muted || !this.sfxBufs) return;
    const t = this.ctx.currentTime + 0.005;
    const v = opts.vol ?? 1;
    const P = opts.pan !== undefined ? { pan: opts.pan, dist: Math.max(0, 1 - v) * 0.85 } : {};
    const F = (n, at, g, o = {}) => this.fx(n, t + at, g, { ...P, ...o });
    const j = (a, b) => this.jit(a, b);
    switch (name) {
      case 'step': {
        let kind = STEP_OF[opts.g ?? 0] || 'grass';
        if (opts.water && kind !== 'swim') kind = 'wade';
        const run = opts.sprint || v > 0.8;
        // a stalk is nearly silent and soft-edged; a sprint lands heavier
        F('step_' + kind, 0, (opts.stalk ? 0.09 : run ? 0.3 : 0.2) * (kind === 'swim' ? 0.5 : kind === 'tall' ? 0.45 : 1) * j(0.85, 1.1), { rate: j(0.92, 1.08) * (run ? 0.95 : 1), pan: j(-0.08, 0.08), lp: opts.stalk ? 2000 : 0, verb: 0.03 });
        break;
      }
      case 'pounce': {
        F('cat_pounce', 0, 0.4 * v);
        const k = STEP_OF[opts.g ?? 0];
        if (k === 'wade' || k === 'swim') F('step_wade', 0.245, 0.3 * v);
        break;
      }
      case 'kill': { // the bite, a bone, the animal's last cry, and it goes down
        const k = opts.kind || 'gazelle';
        const cry = { gazelle: ['an_bleat', 1], golden: ['an_bleat', 1.1], zebra: ['an_bleat', 0.72], gnu: ['an_gnu', 0.9], warthog: ['an_squeal', 1], hare: ['an_scream', 1], fowl: ['an_kek', 1.15], hyrax: ['an_shriek', 1], flamingo: ['an_honk', 0.95], ostrich: ['an_vhiss', 1.3] }[k] || ['an_bleat', 1];
        F('hit_bite', 0, 0.6 * v);
        F('cat_crunch', 0.03, 0.3 * v);
        F(cry[0], 0.02, 0.4 * v, { rate: cry[1] });
        F('cat_drop', 0.2, 0.35 * v, { rate: ['hare', 'fowl', 'hyrax', 'flamingo'].includes(k) ? 1.4 : 0.8 });
        this.killTag(t);
        break;
      }
      case 'eat': {
        const r = Math.random();
        if (r < 0.45) F('cat_tear', 0, 0.24 * v);
        else if (r < 0.8) { F('cat_chew', 0, 0.2 * v); F('cat_chew', j(0.16, 0.22), 0.15 * v); }
        else F('cat_crunch', 0, 0.2 * v);
        break;
      }
      case 'drink': { // a cat laps about four times a second
        const gap = j(0.13, 0.17);
        for (let i = 0; i < 3; i++) F('cat_lap', i * gap + j(0, 0.02), 0.22 * v * j(0.8, 1));
        break;
      }
      case 'splash': F('step_wade', 0, 0.6 * v); break;
      case 'croc': F('an_lurk', 0, 0.42 * v); F('step_wade', 0, 0.18 * v, { rate: 0.7 }); break;
      case 'throw': F('hunt_whoosh', 0, 0.42 * v); F('call_grunt', 0, 0.17 * v); break;
      case 'windup': F('hunt_creak', 0, 0.25 * v); F('call_inhale', 0.03, 0.2 * v); break;
      case 'hit': { // what dealt the blow, then the cat's cry
        const k = opts.kind;
        const imp = k === 'spear' || k === 'stab' ? 'pierce' : k === 'dog' || k === 'hyena' || k === 'croc' || k === 'lion' ? 'bite' : k === 'fire' || k === 'lightning' ? 'burn' : 'blunt';
        F('hit_' + imp, 0, 0.5 * v);
        F(Math.random() < 0.7 ? 'cat_yowl' : 'cat_snarl', 0.03, 0.38 * v);
        break;
      }
      case 'thunk': {
        const k = STEP_OF[opts.g ?? 0];
        F(k === 'rock' || k === 'basalt' ? 'hunt_clack' : k === 'wade' || k === 'swim' ? 'hunt_plunk' : 'hunt_thunk', 0, (k === 'wade' || k === 'swim' ? 0.52 : 0.7) * v);
        break;
      }
      case 'dodge': F('ui_swish', 0, 0.35 * v, { rate: j(0.9, 1.15) }); this.bell(t + 0.08, [86, 88, 91][this.rr('dodge', 3)], 0.12); break;
      case 'climb': F('cat_climb', 0, 0.34 * v); break;
      case 'drop': F('cat_drop', 0, 0.55 * v); break;
      case 'startle': { // prey catching wind of you, each in its own voice
        const k = opts.kind || (opts.fly ? 'fowl' : 'gazelle');
        if (k === 'fowl') { F('an_kek', 0, 0.22 * v); F('an_whirr', 0.05, 0.19 * v); }
        else if (k === 'flamingo') F('an_flock', 0, 0.16 * v);
        else if (k === 'zebra') { F('an_zebra', 0, 0.15 * v); for (let i = 0; i < 3; i++) F('an_hoof', 0.25 + i * j(0.09, 0.12), 0.1 * v, { rate: 0.88 }); }
        else if (k === 'warthog') { F('an_grunt', 0, 0.14 * v); if (Math.random() < 0.3) F('an_squeal', 0.2, 0.08 * v); }
        else if (k === 'hare') F('an_thump', 0, 0.22 * v);
        else if (k === 'hyrax') F('an_shriek', 0, 0.14 * v);
        else if (k === 'ostrich') { F('an_vhiss', 0, 0.14 * v, { rate: 1.3 }); for (let i = 0; i < 4; i++) F('an_stride', 0.15 + i * 0.2, 0.14 * v); }
        else { F('an_snort', 0, 0.34 * v); F('an_stot', 0.16, 0.22 * v); } // gazelles: snort and stot
        break;
      }
      case 'golden': // the golden gazelle shows itself: a shimmer up the bells
        [81, 86, 88, 93].forEach((m, i) => this.bell(t + i * 0.08, m + this.key, 0.09));
        this.playBuf(this.note('kalimba', 74 + this.key), t, 0.2, { dest: this.sfx, verb: 0.5 });
        break;
      case 'multloss': this.bell(t, 81, 0.05, 0.4); this.bell(t + 0.09, 76, 0.05, 0.4); break;
      case 'shout': { // the band calling: what they are saying depends on the moment
        const [c, g] = { lost: ['call_lost', 0.28], found: ['call_found', 0.16], search: ['call_search', 0.18], scout: ['call_whistle', 0.08], grunt: ['call_grunt', 0.3], sight: ['call_sight', 0.4] }[opts.call] || ['call_search', 0.18];
        F(c, 0, g * v, { verb: 0.25 });
        break;
      }
      case 'sighted': {
        F('call_sight', 0, 0.5 * v, { verb: 0.25 });
        F('call_ulul', j(0.4, 0.55), 0.26 * v, { pan: (P.pan || 0) + j(-0.4, 0.4), dist: (P.dist || 0) + 0.2, verb: 0.3 });
        this.playBuf(this.kit.bass, t, 0.6 * v, { dest: this.sfx, verb: 0.3 }); // the band's drum answers
        break;
      }
      case 'bark': {
        const n = Math.random() < 0.25 ? 3 : 2, gap = j(0.17, 0.24);
        for (let i = 0; i < n; i++) F('dog_bark', i * gap + j(0, 0.03), 0.22 * v * j(0.8, 1));
        break;
      }
      case 'bite': F('dog_bite', 0, 0.4 * v); break;
      case 'whine': F('dog_whine', 0, 0.08 * v); break;
      case 'yelp': F('dog_yelp', 0, 0.45 * v); break;
      case 'knockdown': F('hunt_knock', 0, 0.54 * v); F('call_oof', 0.03, 0.37 * v); break;
      case 'trail': [74, 78, 81].forEach((m, i) => this.bell(t + i * 0.07, m, 0.14)); break;
      case 'score': this.bell(t, 86 + (opts.pitch || 0), 0.045, 0.6); break;
      case 'overheat': F('cat_overheat', 0, 0.5 * v); break;
      case 'pant': F('cat_pantOut', 0, 0.19 * v); F('cat_pantIn', (opts.per || 0.32) * 0.5, 0.1 * v); break;
      case 'heart': F('cat_heart', 0, 0.75 * v, { verb: 0, jit: 0.02 }); break;
      case 'roar': F(opts.charge ? 'an_charge' : 'an_roar', 0, (opts.charge ? 0.25 : 0.44) * v, { verb: 0.2 }); break;
      case 'saw': F('cat_saw', 0, 0.6 * v); break;
      case 'settle': F('cat_settle', 0, 0.21 * v); break;
      case 'rise': F('cat_rise', 0, 0.055 * v); break;
      case 'fall': F('cat_fall', 0, 0.8 * v); break;
      case 'ui': { // menu move is a wooden tick, select a tok and a tine, higher pitches a rising tine
        const m = opts.pitch || 81;
        if (m <= 78) F('ui_tick', 0, 0.22, { rate: Math.pow(2, (m - 76) / 12), jit: 0.02, verb: 0 });
        else if (m <= 83) { F('ui_tok', 0, 0.3, { jit: 0.01, verb: 0 }); this.bell(t + 0.01, m, 0.06); }
        else { this.bell(t, m, 0.07); F('ui_tick', 0, 0.12, { rate: 1.5, verb: 0 }); }
        break;
      }
      case 'back': F('ui_tick', 0, 0.2, { rate: 0.94, verb: 0 }); F('ui_tick', 0.06, 0.16, { rate: 0.8, verb: 0 }); break;
      case 'pause': F('ui_tok', 0, 0.3, { rate: 0.75, verb: 0.1 }); break;
      case 'feat': F('ui_tok', 0, 0.25, { verb: 0 }); [81, 86, 90, 93].forEach((m, i) => this.bell(t + 0.05 + i * 0.07, m, 0.09)); break;
      case 'perkopen': F('ui_swish', 0, 0.2, { rate: 0.6 }); this.bell(t + 0.05, 74, 0.1); this.bell(t + 0.2, 81, 0.08); break;
      case 'thunder': { // near when the storm is on top of you, otherwise a far roll
        const near = opts.near ?? ((this.storm || 0) > 0.5 && Math.random() < 0.4);
        F(near ? 'w_thunderNear' : 'w_thunderFar', 0, (near ? 1.7 : 0.85) * v, { pan: j(-0.5, 0.5), verb: 0.2, jit: 0.08 });
        break;
      }
      case 'strike': F('w_strike', 0, 0.8 * v); F('w_thunderNear', 0.04, 0.8 * v, { jit: 0.05 }); break;
      case 'ignite': F('w_ignite', 0, 0.29 * v); break;
      case 'chorus': // the dawn chorus: two dozen birds waking over a few seconds, densest in the middle
        for (let i = 0; i < 24; i++) { const at = 6 * Math.pow(Math.random(), 0.8), k = pick([0, 0, 1, 2, 3, 3, 10, 11, 11]); this.fx('bird' + k, t + at, 0.1 * v * rnd(0.4, 1) * c01(at / 1.5 + 0.3), { dest: this.amb, pan: rnd(-0.9, 0.9), dist: rnd(0.1, 0.6), verb: 0.3, jit: 0.06 }); }
        break;
      case 'snarl': // a hyena biting, a warthog charging, or the cat
        if (opts.who === 'hyena') F('an_hsnarl', 0, 0.3 * v);
        else if (opts.who === 'warthog') { F('an_squeal', 0, 0.19 * v); F('an_grunt', 0.3, 0.15 * v); }
        else F('cat_snarl', 0, 0.3 * v);
        break;
      case 'rumble': F('an_herdcome', 0, 0.8 * v, { jit: 0 }); F('an_gnu', j(1.6, 2.4), 0.35 * v, { dist: 0.5 }); break;
      case 'laugh': F('an_giggle', 0, 0.26 * v); if (Math.random() < 0.5) F('an_whoop', j(0.9, 1.4), 0.15 * v); break;
      case 'snap': F('an_csnap', 0, 1 * v); break;
      case 'secret': this.sting('secret'); break;
      case 'perk': this.sting('perk'); break;
    }
  }

  // A tuned tine (pre-rendered), standing in for the old oscillator bell. dec < 1 damps it.
  bell(t, midi, vel, dec = 1) {
    this.fx('ui_tine', t, vel * 1.3, { rate: Math.pow(2, (midi - 81) / 12), jit: 0, verb: 0.15, lp: dec < 1 ? 3000 : 0 });
  }

  // The old voice helpers, kept for anything outside that still calls them.
  growl(t, dur, vel, hurt = false, pitch = 1) {
    this.fx(hurt ? 'cat_yowl' : 'cat_growl', t, vel * 0.5, { rate: pitch });
  }

  squeal(t, dur, f0 = 1400) {
    this.fx('an_squeal', t, 0.4, { rate: f0 / 1300 });
  }

  shout(t, vel, pitch) {
    this.fx('call_search', t, vel * 0.6, { rate: pitch, pan: rnd(-0.3, 0.3), verb: 0.25 });
  }
}
