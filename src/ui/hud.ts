// Playable-skeleton HUD. DOM over canvas: accessible, cheap, styleable.
// The real presentation pass is Task #7 — keep logic and markup separable.

import type { GameState, MovePreview } from '../sim/game';
import type { EncounterAction } from '../sim/encounters';
import { distanceBands, trackingTexts } from '../content/hunterFlavor';
import { deaths } from '../content/narrative';
import type { DeathCause } from '../content/types';

export class Hud {
  private root: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  onAction: ((key: string) => void) | null = null;
  onConfirmMove: (() => void) | null = null;
  onCancelMove: (() => void) | null = null;
  onRestart: (() => void) | null = null;

  constructor(private flavorRng: () => number = Math.random) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div id="clock" class="hud-panel"></div>
      <div id="tracker" class="hud-panel">
        <div class="label"><span>The Hunters</span><span id="trackerMiles"></span></div>
        <div class="bar"><div id="trackerFill"></div></div>
        <div class="flavor" id="trackerFlavor"></div>
      </div>
      <div id="vitals" class="hud-panel"></div>
      <div id="prose" class="hud-panel">
        <div class="encounter" id="encounterText"></div>
        <div class="monologue" id="monologueText"></div>
        <div class="note hidden" id="noteText"></div>
      </div>
      <div id="actions"></div>
      <div id="preview" class="hud-panel hidden"></div>
      <div id="death" class="hidden"></div>`;
    document.body.appendChild(this.root);
    for (const id of ['clock', 'tracker', 'trackerMiles', 'trackerFill', 'trackerFlavor',
      'vitals', 'encounterText', 'monologueText', 'noteText', 'actions', 'preview', 'death']) {
      this.els[id] = document.getElementById(id)!;
    }
  }

  setClock(day: number, phase: string): void {
    this.els['clock']!.textContent = `Day ${day} — ${phase === 'day' ? 'Sun' : 'Night'}`;
  }

  setVitals(s: GameState): void {
    const rows = [
      ['heat', 'Heat', s.heat, s.heat >= 65],
      ['stamina', 'Legs', s.stamina, s.stamina <= 35],
      ['thirst', 'Thirst', s.thirst, s.thirst >= 65],
      ['hunger', 'Hunger', s.hunger, s.hunger >= 65]
    ] as const;
    this.els['vitals']!.innerHTML = rows.map(([cls, name, v, warn]) => `
      <div class="vital ${cls}${warn ? ' warn' : ''}">
        <div class="label"><span>${name}</span><span>${Math.round(v)}</span></div>
        <div class="bar"><div style="width:${Math.round(v)}%"></div></div>
      </div>`).join('');
  }

  setHunters(s: GameState): void {
    const d = s.hunters.distance;
    this.els['trackerMiles']!.textContent = s.hunters.state === 'tracking'
      ? 'searching' : `${d.toFixed(1)} mi`;
    const pct = Math.max(0, Math.min(100, 100 - (d / 30) * 100));
    (this.els['trackerFill'] as HTMLElement).style.width = `${pct}%`;

    let texts: string[];
    if (s.hunters.state === 'tracking') {
      texts = trackingTexts;
    } else {
      const band = distanceBands.find((b) => d >= b.min) ?? distanceBands[distanceBands.length - 1]!;
      texts = s.phase === 'night' ? band.night : band.day;
    }
    this.els['trackerFlavor']!.textContent = texts[Math.floor(this.flavorRng() * texts.length)]!;
  }

  setProse(encounterText: string, monologue: string, note: string | null): void {
    this.els['encounterText']!.textContent = encounterText;
    this.els['monologueText']!.textContent = monologue ? `"${monologue}"` : '';
    const noteEl = this.els['noteText']!;
    if (note) { noteEl.textContent = note; noteEl.classList.remove('hidden'); }
    else noteEl.classList.add('hidden');
  }

  setActions(actions: EncounterAction[]): void {
    const box = this.els['actions']!;
    box.innerHTML = '';
    for (const a of actions) {
      const btn = document.createElement('button');
      btn.className = 'hud-panel';
      btn.innerHTML = `${a.name}<span class="desc">${a.description}</span>`;
      btn.addEventListener('click', () => this.onAction?.(a.key));
      box.appendChild(btn);
    }
  }

  showPreview(p: MovePreview): void {
    const e = p.effects;
    const fmt = (v: number, invert = false) => {
      const r = Math.round(v);
      const good = invert ? r > 0 : r < 0;
      return `<span style="color:${good ? '#7aaa6f' : r === 0 ? '#aaa' : '#d4663a'}">${r > 0 ? '+' : ''}${r}</span>`;
    };
    const breakPct = Math.round(p.trailBreakChance * 100);
    this.els['preview']!.innerHTML = `
      <div class="gait">${p.gait} — ${p.realMiles.toFixed(1)} mi</div>
      <div class="cost">heat ${fmt(e.heat)} · legs ${fmt(e.stamina, true)} · thirst ${fmt(e.thirst)} · hunger ${fmt(e.hunger)}</div>
      <div class="odds">they gain ${p.hunterAdvance.toFixed(1)} mi${breakPct > 0 ? ` · ${breakPct}% the ground hides you` : ''}</div>
      <button id="goBtn">Run</button><button id="cancelBtn">Stay</button>`;
    this.els['preview']!.classList.remove('hidden');
    document.getElementById('goBtn')!.addEventListener('click', () => this.onConfirmMove?.());
    document.getElementById('cancelBtn')!.addEventListener('click', () => this.onCancelMove?.());
  }

  hidePreview(): void {
    this.els['preview']!.classList.add('hidden');
  }

  showDeath(cause: DeathCause, s: GameState): void {
    const texts = deaths[cause];
    const text = texts[Math.floor(this.flavorRng() * texts.length)]!;
    this.els['death']!.innerHTML = `
      <h1>The Chase Ends</h1>
      <div class="text">${text}</div>
      <div class="score">Day ${s.day} · ${s.distanceCovered.toFixed(0)} miles · trail broken ${s.stats.trailBreaks}×</div>
      <button id="againBtn">Run Again</button>`;
    this.els['death']!.classList.remove('hidden');
    document.getElementById('againBtn')!.addEventListener('click', () => this.onRestart?.());
  }

  hideDeath(): void {
    this.els['death']!.classList.add('hidden');
  }

  setBusy(busy: boolean): void {
    this.els['actions']!.style.opacity = busy ? '0.35' : '1';
    this.els['actions']!.style.pointerEvents = busy ? 'none' : 'auto';
  }
}
