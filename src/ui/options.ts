// Player options, persisted to localStorage. Small and flat on purpose.

export interface GameOptions {
  difficulty: 'easy' | 'normal' | 'hard';
  typewriter: boolean;
  tutorial: boolean;
  quality: 'auto' | 'low' | 'medium' | 'high';
  reducedMotion: boolean;
  sound: boolean;
}

const KEY = 'primalchase.options.v3';

const DEFAULTS: GameOptions = {
  difficulty: 'normal',
  typewriter: true,
  tutorial: true,
  quality: 'auto',
  reducedMotion: typeof matchMedia !== 'undefined'
    ? matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  sound: true
};

export function loadOptions(): GameOptions {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) as Partial<GameOptions> };
  } catch { /* fresh defaults */ }
  return { ...DEFAULTS };
}

export function saveOptions(o: GameOptions): void {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* private mode */ }
}
