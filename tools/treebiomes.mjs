// In-game shots of the densest tree stands in a few biomes. Needs tools/serve.mjs running.
// node tools/treebiomes.mjs [port] [biome,biome,...]
import { chromium } from 'file:///C:/Users/ryan/Projects/Primal-Chase-Fable/node_modules/playwright/index.mjs';
const [,, port = '8791', list = '0,1,3'] = process.argv;
const TREES = ['acacia', 'umbrella', 'baobab', 'mopane', 'marula', 'fig', 'quiver', 'candelabra', 'mangrove', 'fever', 'palm', 'deadtree', 'charred'];
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('PAGEERR ' + e.stack));
await p.goto(`http://127.0.0.1:${port}/index.html`); await p.waitForTimeout(1000);
await p.click('#btn-start'); await p.waitForTimeout(500);
await p.evaluate(() => { const g = window.__pc.game; g.hunters.forEach((h) => { h.x += 9000; }); g.band.x += 9000; g.scoutT = 1e9; g.player.water = 100; });
for (const bi of list.split(',').map(Number)) {
  const res = await p.evaluate(([bi, TREES]) => {
    const g = window.__pc.game, W = g.world;
    let best = null, bn = 0;
    for (let r = 600; r < 6000; r += 200) for (let a = 0; a < 24; a++) {
      const x = Math.cos(a / 24 * 6.28) * r, y = Math.sin(a / 24 * 6.28) * r;
      if (W.T.biomeAt(x, y) !== bi) continue;
      for (let cx = Math.floor((x - 200) / 128); cx <= Math.floor((x + 200) / 128); cx++) for (let cy = Math.floor((y - 120) / 128); cy <= Math.floor((y + 120) / 128); cy++) W.propChunk(cx, cy);
      let n = 0;
      for (const pr of W.propsNear(x, y, 150)) if (TREES.includes(pr.kind) && Math.abs(pr.x - x) < 180 && Math.abs(pr.y - y) < 100) n++;
      if (n > bn) { bn = n; best = [x, y]; }
    }
    if (!best) return 'none';
    g.player.x = best[0]; g.player.y = best[1] + 40; window.__pc.renderer.camInit = false; g.clock = 0.3;
    return bn;
  }, [bi, TREES]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `tools/shots/trees-biome-${bi}.png` });
  console.log(bi, res);
}
await b.close();
