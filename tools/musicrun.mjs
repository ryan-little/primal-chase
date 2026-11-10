// Offline music renders for every scene with both engines: numbers to stdout and JSON, piano roll and
// spectrogram PNGs (and WAVs with --wav) into tools/shots/music/. Needs the static server on 8791.
//   node tools/musicrun.mjs [sceneId|all] [before|after|both] [--wav] [--secs=N]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cands = [process.env.PW, 'C:/Users/ryan/Projects/felt.gg/node_modules/playwright-core/index.mjs', path.resolve(root, '../../../tools/pw/node_modules/playwright-core/index.mjs')].filter(Boolean);
const { chromium } = await import(pathToFileURL(cands.find((c) => fs.existsSync(c))).href);
const args = process.argv.slice(2), flags = args.filter((a) => a.startsWith('--')), pos = args.filter((a) => !a.startsWith('--'));
const which = pos[0] || 'all', engs = (pos[1] || 'both') === 'both' ? ['before', 'after'] : [pos[1]];
const secs = +(flags.find((f) => f.startsWith('--secs='))?.split('=')[1] || 0);
const out = path.join(root, 'tools/shots/music');
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERR', e.stack));
p.on('console', (m) => { if (m.type() === 'error') console.log('PAGE', m.text()); });
await p.goto('http://127.0.0.1:8791/tools/musicrig.html');
await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
const ids = which === 'all' ? await p.evaluate(() => window.scenes) : which.split(',');
if (flags.includes('--init')) console.log('init ms', JSON.stringify(await p.evaluate(() => window.initCost())));
const summary = fs.existsSync(path.join(out, 'summary.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8')) : {};
for (const id of ids) for (const eng of engs) {
  const r = await p.evaluate(([eng, id, o]) => window.run(eng, id, o), [eng, id, { wav: flags.includes('--wav'), ...(secs ? { secs } : {}) }]);
  for (const k of ['roll', 'spec']) fs.writeFileSync(path.join(out, `${id}.${eng}.${k}.png`), Buffer.from(r[k].split(',')[1], 'base64'));
  if (r.wav) fs.writeFileSync(path.join(out, `${id}.${eng}.wav`), Buffer.from(r.wav, 'base64'));
  delete r.roll; delete r.spec; delete r.wav;
  summary[`${id}.${eng}`] = r;
  const bal = Object.entries(r.balance).map(([k, v]) => `${k}${v}`).join(' ');
  console.log(`${id.padEnd(15)} ${eng.padEnd(6)} pk ${r.peakDb} rms ${r.rmsDb} crest ${r.crestDb} loud ${r.loudMin}..${r.loudMax} w ${r.width} nan ${r.nan} clip ${r.clip} | ${bal} | bars ${r.bars} rep ${r.repeatBarsPct}%/${r.repeatMelPct}% oom ${r.outOfMode} coll/min ${r.collPerMin} | ${r.ms}ms`);
  if (flags.includes('--v')) console.log('   dens', JSON.stringify(r.density), 'leaps', JSON.stringify(r.leaps), 'log', r.log.slice(0, 12).join(' '));
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 1));
await b.close();
