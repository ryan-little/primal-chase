// The share card: a 1200x630 canvas painted in the game's palette, offered
// as a download (and the native share sheet where one exists).

import type { RunScore } from '../sim/score';
import { percentileFor } from '../content/percentiles';

export function drawShareCard(run: RunScore, achievements: string[]): HTMLCanvasElement {
  const W = 1200, H = 630;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;

  // Ground: night-leather gradient with a horizon band.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#12100c');
  bg.addColorStop(0.62, '#1c1610');
  bg.addColorStop(0.63, '#2a1a0e');
  bg.addColorStop(1, '#171009');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // A low sun.
  const sun = ctx.createRadialGradient(W * 0.78, H * 0.60, 8, W * 0.78, H * 0.60, 130);
  sun.addColorStop(0, 'rgba(255, 200, 120, 0.95)');
  sun.addColorStop(1, 'rgba(255, 160, 70, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  // Ridge silhouette.
  ctx.fillStyle = '#0d0a06';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.66);
  for (let x = 0; x <= W; x += 24) {
    const y = H * 0.64 + Math.sin(x * 0.008 + run.score) * 14 + Math.sin(x * 0.021 + 2) * 9;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fill();

  const serif = 'Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';

  ctx.fillStyle = '#d4a574';
  ctx.font = `italic 26px ${serif}`;
  ctx.fillText('the sun does not wait — neither do they', 70, 92);

  ctx.fillStyle = '#e8d9b8';
  ctx.font = `bold 92px ${serif}`;
  ctx.fillText('PRIMAL CHASE', 64, 190);

  ctx.fillStyle = '#d4883a';
  ctx.font = `bold 54px ${serif}`;
  ctx.fillText(`Survived ${run.days} day${run.days === 1 ? '' : 's'} · ${run.miles} miles`, 70, 300);

  ctx.fillStyle = '#e8d9b8';
  ctx.font = `30px ${serif}`;
  const causeLine: Record<string, string> = {
    caught: 'The hunters closed the last mile.',
    heatstroke: 'The sun finished what they started.',
    exhaustion: 'The body gave out before the will.',
    dehydration: 'The land withheld its water.',
    starvation: 'Hunger hollowed the runner out.'
  };
  ctx.fillText(causeLine[run.cause] ?? 'The chase ended.', 70, 356);

  ctx.fillStyle = '#d4a574';
  ctx.font = `28px ${serif}`;
  ctx.fillText(
    `Score ${run.score} — outlasted ${percentileFor(run.score)}% of runs · ${run.difficulty}`,
    70, 412);

  if (achievements.length) {
    ctx.fillStyle = '#9fdcea';
    ctx.font = `italic 24px ${serif}`;
    ctx.fillText(achievements.slice(0, 3).join('  ·  '), 70, 462);
  }

  ctx.fillStyle = 'rgba(232, 217, 184, 0.65)';
  ctx.font = `22px ${serif}`;
  ctx.fillText('primalchase.com', 70, H - 48);

  return c;
}

export async function shareCard(run: RunScore, achievements: string[]): Promise<void> {
  const canvas = drawShareCard(run, achievements);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'primal-chase-run.png', { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Primal Chase',
        text: `I lasted ${run.days} days and ${run.miles} miles. The chase always ends.`
      });
      return;
    } catch { /* user cancelled — fall through to download */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'primal-chase-run.png';
  a.click();
  URL.revokeObjectURL(a.href);
}
