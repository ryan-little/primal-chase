// Shapes of the ported V1/Opus prose content. The generated data files
// (encounters.ts, monologue.ts, narrative.ts) conform to these; the sim's
// encounter engine consumes them.

export type Phase = 'day' | 'night';
export type Mood = 'confident' | 'concerned' | 'desperate' | 'haunted';
export type DeathCause = 'caught' | 'heatstroke' | 'exhaustion' | 'dehydration' | 'starvation';

/** Vital deltas. Positive heat/thirst/hunger is bad; positive stamina is good. */
export interface VitalEffects {
  heat?: number;
  stamina?: number;
  thirst?: number;
  hunger?: number;
  distance?: number;
}

/** Per-verb stat modifiers; opportunity `drink` may also adjust success chance. */
export type VerbModifiers = Partial<Record<string, VitalEffects & { chance?: number }>>;

/** A situational verb offered by a terrain or opportunity (Dig, Hunt, Wallow…). */
export interface SituationalAction {
  key: string;
  name: string;
  description: string;
  chance: number;
}

export interface TerrainEntry {
  id: string;
  name: string;
  text: string;
  nightText?: string;
  actions: SituationalAction[];
  modifiers: VerbModifiers;
  /** Opportunity ids (or baseIds) that can appear on this terrain. */
  compatible: string[];
}

export interface OpportunityEntry {
  id: string;
  /** Night variants carry the id of the day opportunity they shadow. */
  baseId?: string;
  nightOnly?: boolean;
  name: string;
  text: string;
  actions: SituationalAction[];
  modifiers: VerbModifiers;
}

/** The minimal view of run state that pressure conditions read. */
export interface EncounterStateView {
  day: number;
  phase: Phase;
  heat: number;
  stamina: number;
  thirst: number;
  hunger: number;
  hunterDistance: number;
  hunterState: 'pursuit' | 'tracking';
}

/** Engine flags a few conditions consult (one-time pressures). */
export interface EncounterFlags {
  usedOldTerritory: boolean;
}

export interface PressureEntry {
  id: string;
  name: string;
  text: string;
  condition: (state: EncounterStateView, ctx: EncounterFlags) => boolean;
  /** Used when the condition throws (kept from V1's defensive engine). */
  fallbackCondition: boolean;
  modifiers: VerbModifiers;
  /** Hook for presentation (e.g. 'storm' drives weather). */
  special?: string;
  oneTime?: boolean;
}

export interface RiskSpec {
  chance: number;
  penalty: VitalEffects;
  text: string;
}

export interface SignatureChoice {
  key: string;
  name: string;
  description: string;
  /** null means "resolve as the standard action with this key" (V1 semantics). */
  effects: VitalEffects | null;
  distance?: number | null;
  loseHunters?: boolean;
  risk?: RiskSpec | null;
  /** Presentation/engine hook (e.g. 'reveals_hunter_speed'). */
  special?: string;
}

/** Signature and rare encounters share one shape. */
export interface SignatureEntry {
  id: string;
  name: string;
  text: string;
  minDay?: number;
  maxDay?: number;
  dayOnly?: boolean;
  nightOnly?: boolean;
  choices: SignatureChoice[];
}

export interface MonologueFragment {
  mood: Mood;
  text: string;
  triggers?: string[];
  minDay?: number;
  nightOnly?: boolean;
}
