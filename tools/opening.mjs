// Cuts the opening's footage into one film, assets/clips/opening.mp4, from the lossless clip
// recordings (tools/shots/clipframes/<clip>.mkv, made by tools/clips.mjs). The edit comes from
// the SHOTS table in js/cinematic.js: shot k comes in at its start second with a dissolve (or a fade
// through black for 'dip'), the film fades up from black at the start and out to black at BLACK.
// One file instead of a cut between two <video>s: no seeking, no clip looping when it runs short,
// no two decoders blending, so the transitions play the same on every device.
//   node tools/opening.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const FFMPEG = process.env.FFMPEG || 'C:/Users/ryan/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const FFPROBE = FFMPEG.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1');
const SRC = 'tools/shots/clipframes';
const OUT = 'assets/clips/opening.mp4';

// the table and timings, read straight out of js/cinematic.js (it can't be imported outside a browser)
const js = fs.readFileSync('js/cinematic.js', 'utf8');
const grab = (re) => { const m = js.match(re); if (!m) throw new Error('not found in cinematic.js: ' + re); return m[1]; };
const SHOTS = Function('return ' + grab(/export const SHOTS = (\[[\s\S]*?\n\]);/))();
const { MIX, DIP, FADE_IN, FADE_OUT } = Function(grab(/export const (MIX = [^;]+);/).replace(/^/, 'const ') + '; return { MIX, DIP, FADE_IN, FADE_OUT };')();
const BLACK = +grab(/export const BLACK = ([\d.]+)/);

const dur = (k) => (k < SHOTS.length ? (SHOTS[k][4] === 'dip' ? DIP : MIX) : 0); // transition into shot k
const segs = SHOTS.map(([start, clip, from], k) => {
  const end = k + 1 < SHOTS.length ? SHOTS[k + 1][0] + dur(k + 1) : BLACK + FADE_OUT;
  return { clip, from, len: +(end - start).toFixed(3) };
});
for (const s of segs) {
  const have = +execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(SRC, s.clip + '.mkv')]).toString();
  if (s.from + s.len > have - 1 / 60) throw new Error(`${s.clip}: the edit needs ${(s.from + s.len).toFixed(2)} s of footage, the recording has ${have.toFixed(2)} s (raise its secs in tools/clips.mjs)`);
}

const inputs = segs.flatMap((s) => ['-i', path.join(SRC, s.clip + '.mkv')]);
const f = segs.map((s, k) => `[${k}:v]trim=start=${s.from}:duration=${s.len},setpts=PTS-STARTPTS,fps=60,format=gbrp[s${k}]`);
let last = 's0';
for (let k = 1; k < segs.length; k++) {
  const kind = SHOTS[k][4] === 'dip' ? 'fadeblack' : 'fade';
  f.push(`[${last}][s${k}]xfade=transition=${kind}:duration=${dur(k)}:offset=${SHOTS[k][0]}[x${k}]`);
  last = 'x' + k;
}
f.push(`[${last}]fade=t=in:st=0:d=${FADE_IN},fade=t=out:st=${BLACK}:d=${FADE_OUT},` +
  'scale=out_color_matrix=bt709:out_range=tv:flags=neighbor+accurate_rnd+full_chroma_int,format=yuv420p[v]');

execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', f.join(';'), '-map', '[v]',
  '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'animation', '-crf', process.env.CRF || '28', '-g', '120',
  '-profile:v', 'high', '-level', '4.2', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-movflags', '+faststart', '-an', OUT], { stdio: 'inherit' });
console.log(OUT, (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB', 'ends at', (BLACK + FADE_OUT).toFixed(1) + ' s');
