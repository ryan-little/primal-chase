// The game's framing screens: title, how-to, options, leaderboard, intro.
// All DOM, all over the live 3D world (the world itself is the title art).

import { intros } from '../content/narrative';
import { loadLeaderboard } from '../sim/score';
import { loadOptions, saveOptions, type GameOptions } from './options';

type ScreenName = 'title' | 'howto' | 'options' | 'leaderboard' | 'intro' | 'none';

const HOWTO = `You are an apex predator, and the hunters behind you do not tire,
do not stop, and do not forget. The game cannot be won — only outlasted.

Each day has two phases, sun and night, and each phase you do exactly one
thing: run somewhere inside your reach, or use the ground you stand on
(rest, drink, eat, or whatever the land offers).

Click or tap the land to choose where to run. The inner, brighter country is
a trot; the outer band is a push that spends far more of your body. Mountains
wall you. Rivers ford only where they run shallow. Ground that holds no
print — rock, running water — can break the pursuit entirely. But every time
they find your trail again, they come back faster.

You see only what your eyes can see. High ground buys sight. Night takes it
away. The hunters are out there whether you see them or not.

Watch heat, legs, thirst, hunger. Any of them can end you before the
hunters do. Drink when you can — but water marks you, and they know where
you have to stop.

The strange lights on the horizon are places worth reaching.`;

export class Screens {
  private root: HTMLElement;
  private current: ScreenName = 'none';
  private typeTimer: number | null = null;
  options: GameOptions = loadOptions();
  onStart: (() => void) | null = null;
  onIntroDone: (() => void) | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'screens';
    document.body.appendChild(this.root);
  }

  show(name: ScreenName): void {
    this.current = name;
    if (name === 'none') { this.root.innerHTML = ''; this.root.classList.add('hidden'); return; }
    this.root.classList.remove('hidden');
    if (name === 'title') this.renderTitle();
    else if (name === 'howto') this.renderHowto();
    else if (name === 'options') this.renderOptions();
    else if (name === 'leaderboard') this.renderLeaderboard();
  }

  get active(): ScreenName { return this.current; }

  private renderTitle(): void {
    this.root.innerHTML = `
      <div class="screen title-screen">
        <div class="title-block">
          <div class="pretitle">the sun does not wait — neither do they</div>
          <h1>PRIMAL<br>CHASE</h1>
          <div class="subtitle">a survival chase across an endless savannah</div>
        </div>
        <div class="menu">
          <button data-act="start">Begin the Chase</button>
          <button data-act="howto">How to Survive</button>
          <button data-act="options">Options</button>
          <button data-act="leaderboard">Past Lives</button>
        </div>
        <div class="footer">difficulty: ${this.options.difficulty} · made by Ryan Little</div>
      </div>`;
    this.root.querySelector('[data-act=start]')!.addEventListener('click', () => this.onStart?.());
    this.root.querySelector('[data-act=howto]')!.addEventListener('click', () => this.show('howto'));
    this.root.querySelector('[data-act=options]')!.addEventListener('click', () => this.show('options'));
    this.root.querySelector('[data-act=leaderboard]')!.addEventListener('click', () => this.show('leaderboard'));
  }

  private renderHowto(): void {
    this.root.innerHTML = `
      <div class="screen text-screen">
        <h2>How to Survive (You Won't)</h2>
        <div class="body">${HOWTO.split('\n\n').map((p) => `<p>${p}</p>`).join('')}</div>
        <button data-act="back">Back</button>
      </div>`;
    this.root.querySelector('[data-act=back]')!.addEventListener('click', () => this.show('title'));
  }

  private renderOptions(): void {
    const o = this.options;
    const radio = (name: keyof GameOptions, values: string[]) => values.map((v) =>
      `<label class="${o[name] === v ? 'sel' : ''}"><input type="radio" name="${name}" value="${v}" ${o[name] === v ? 'checked' : ''}>${v}</label>`
    ).join('');
    const check = (name: keyof GameOptions, label: string) =>
      `<label class="chk"><input type="checkbox" name="${name}" ${o[name] ? 'checked' : ''}>${label}</label>`;
    this.root.innerHTML = `
      <div class="screen text-screen options-screen">
        <h2>Options</h2>
        <div class="opt-row"><span>Difficulty</span><div>${radio('difficulty', ['easy', 'normal', 'hard'])}</div></div>
        <div class="opt-row"><span>Quality</span><div>${radio('quality', ['auto', 'low', 'medium', 'high'])}</div></div>
        <div class="opt-row">${check('typewriter', 'Typewriter text')}</div>
        <div class="opt-row">${check('tutorial', 'First-day guidance')}</div>
        <div class="opt-row">${check('reducedMotion', 'Reduce motion')}</div>
        <div class="opt-row">${check('sound', 'Sound')}</div>
        <div class="note">Difficulty and quality apply to the next run.</div>
        <button data-act="back">Back</button>
      </div>`;
    this.root.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('change', () => {
        const el = inp as HTMLInputElement;
        const name = el.name as keyof GameOptions;
        if (el.type === 'checkbox') (this.options[name] as boolean) = el.checked;
        else (this.options[name] as string) = el.value;
        saveOptions(this.options);
        this.renderOptions();
      });
    });
    this.root.querySelector('[data-act=back]')!.addEventListener('click', () => this.show('title'));
  }

  private renderLeaderboard(): void {
    const board = loadLeaderboard();
    const rows = board.length
      ? board.map((r, i) => `
        <tr><td>${i + 1}</td><td>${r.score}</td><td>${r.days}d</td>
        <td>${r.miles} mi</td><td>${r.cause}</td><td>${r.difficulty}</td><td>${r.date}</td></tr>`).join('')
      : '<tr><td colspan="7" class="empty">No lives lived yet.</td></tr>';
    this.root.innerHTML = `
      <div class="screen text-screen">
        <h2>Past Lives</h2>
        <table class="board">
          <tr><th>#</th><th>Score</th><th>Days</th><th>Miles</th><th>End</th><th>Mode</th><th>Date</th></tr>
          ${rows}
        </table>
        <button data-act="back">Back</button>
      </div>`;
    this.root.querySelector('[data-act=back]')!.addEventListener('click', () => this.show('title'));
  }

  /** Play one of the three openings; typewriter honors the option. */
  playIntro(seedRoll: number): void {
    this.current = 'intro';
    this.root.classList.remove('hidden');
    const intro = intros[seedRoll % intros.length]!;
    this.root.innerHTML = `
      <div class="screen intro-screen">
        <div class="intro-text" id="introText"></div>
        <div class="intro-hint">click to continue</div>
      </div>`;
    const target = this.root.querySelector('#introText') as HTMLElement;
    let para = 0;

    const showPara = (instant: boolean) => {
      if (para >= intro.length) { this.finishIntro(); return; }
      const p = document.createElement('p');
      target.appendChild(p);
      const text = intro[para]!;
      para++;
      if (instant || !this.options.typewriter) {
        p.textContent = text;
        return;
      }
      let i = 0;
      const tick = () => {
        p.textContent = text.slice(0, ++i);
        if (i < text.length && this.current === 'intro') {
          this.typeTimer = window.setTimeout(tick, 28);
        }
      };
      tick();
    };

    this.root.addEventListener('click', () => {
      if (this.typeTimer) { clearTimeout(this.typeTimer); this.typeTimer = null; }
      const last = target.lastElementChild as HTMLElement | null;
      const full = intro[para - 1];
      if (last && full && last.textContent !== full) {
        last.textContent = full; // finish current paragraph first
      } else {
        showPara(false);
      }
    });
    showPara(false);
  }

  private finishIntro(): void {
    this.show('none');
    this.onIntroDone?.();
  }
}
