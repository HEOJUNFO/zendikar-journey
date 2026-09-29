// Everything that changes while the world runs. Plain JSON so it saves as-is.
import { START_MINUTES } from './clock.ts';
import { INITIAL_STATS } from './rules.ts';
import { NEEDS } from './types.ts';
import type { LifeKind, Need, Pace, Schedule, Stats } from './types.ts';
import type { Ability, Pt, World } from './world.ts';

export type TaskKind = LifeKind | 'explore' | 'travel' | 'fight';

export type Task = {
  kind: TaskKind;
  activity: string;
  emoji: string;
  // Player tasks and forced tasks end here; NPC tasks follow the schedule.
  until?: number;
};

export type Actor = {
  id: string;
  name: string;
  kind: 'npc' | 'player';
  // Where they are, or where they set out from while travelling.
  region: string;
  travel?: { to: string; arrive: number };
  // Start of the first hour spent in `region` after travelling there.
  arrivedAt?: number;
  // Regions they made landfall on (arrived at) this turn = game day, in order.
  landfalls?: { day: number; regions: string[] };
  stats: Stats;
  // Power / toughness (the player starts at 1/1; missing in old saves = 1/1).
  pt?: Pt;
  // Combat damage taken this turn; it wears off when the turn ends (00:00).
  wounds?: { day: number; amount: number };
  // Who they'll attack on sight this turn (they were attacked, or turned hostile).
  foes?: { day: number; ids: string[] };
  dead?: { at: number; cause: string };
  // Hour of their last combat exchange (one per hour).
  lastClash?: number;
  pace: Pace;
  abilities: Ability[];
  // Stats they live by; missing in saves from before needs existed (= all).
  needs?: Need[];
  task?: Task;
  // Overrides the schedule or the player's task (e.g. collapsed from exhaustion).
  forced?: Task;
  // Tapped: can't move or act until then (an untap).
  boundUntil?: number;
  schedule?: Schedule; // npc
  background?: string; // player
};

export type Condition = {
  label: string;
  until: number;
  blocksTravel: boolean;
  // A tapped land: nothing can be explored or worked there until it untaps (`until`).
  tapped?: boolean;
  source: string;
};

export type RegionState = {
  conditions: Condition[];
  // Destroyed land, for good (until a card brings it back).
  destroyed?: { at: number; source: string };
};

export type LogKind =
  | 'omen'
  | 'event'
  | 'effect'
  | 'condition'
  | 'move'
  | 'arrive'
  | 'activity'
  | 'meet'
  | 'status'
  | 'combat'
  | 'death'
  | 'player'
  | 'speech'
  | 'narration'
  | 'system';

export type LogEntry = {
  id: number;
  t: number;
  kind: LogKind;
  text: string;
  regions: string[];
  scope: 'region' | 'world';
  actors: string[];
  // Whether the player character witnessed it (always true in observer mode).
  seen: boolean;
};

export type GmPlan = {
  day: number;
  source: 'none' | 'llm';
  fires: { eventId: string; hour: number }[];
  note?: string;
};

export type Mode = 'observer' | 'character';

export type State = {
  version: 1;
  seed: number;
  rng: number;
  minutes: number;
  mode: Mode;
  playerId?: string;
  // The player character died: their life is over.
  over?: { at: number; cause: string };
  actors: Record<string, Actor>;
  regions: Record<string, RegionState>;
  events: Record<string, { lastFired?: number }>;
  // Omened events that go off at `at`, with who set them off.
  pending: { eventId: string; at: number; by: string[] }[];
  gm: GmPlan;
  // Last day whose plans (LLM or routine) were made.
  preparedDay: number;
  met: { day: number; pairs: string[] };
  nextLogId: number;
  log: LogEntry[];
};

export const PLAYER_ID = 'player';
// An ordinary person. Grows with training, gear and magic (when cards bring them).
export const PLAYER_PT: Pt = [1, 1];
const LOG_LIMIT = 3000;

export type NewGame = {
  seed?: number;
  mode: Mode;
  player?: { name: string; background: string; region: string };
};

export function newState(world: World, opts: NewGame): State {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const state: State = {
    version: 1,
    seed,
    rng: seed,
    minutes: START_MINUTES,
    mode: opts.mode,
    actors: {},
    regions: Object.fromEntries(world.regions.map((r) => [r.id, { conditions: [] }])),
    events: Object.fromEntries(world.events.map((e) => [e.id, {}])),
    pending: [],
    gm: { day: -1, source: 'none', fires: [] },
    preparedDay: -1,
    met: { day: -1, pairs: [] },
    nextLogId: 0,
    log: [],
  };
  for (const npc of world.npcs) {
    state.actors[npc.id] = {
      id: npc.id,
      name: npc.name,
      kind: 'npc',
      region: npc.home,
      stats: { ...INITIAL_STATS },
      pt: [...npc.pt],
      pace: 'normal',
      abilities: [...npc.abilities],
      needs: [...npc.needs],
    };
  }
  if (opts.mode === 'character') {
    if (!opts.player) throw new Error('character mode needs a player');
    state.playerId = PLAYER_ID;
    state.actors[PLAYER_ID] = {
      id: PLAYER_ID,
      name: opts.player.name,
      kind: 'player',
      region: opts.player.region,
      stats: { ...INITIAL_STATS },
      pt: [...PLAYER_PT],
      pace: 'normal',
      abilities: [],
      needs: [...NEEDS],
      background: opts.player.background,
    };
  }
  return state;
}

// A save made before new cards came in: add the new characters, regions and events.
// Characters whose home is gone are left where they are.
export function syncWorld(state: State, world: World) {
  for (const r of world.regions) state.regions[r.id] ??= { conditions: [] };
  for (const e of world.events) state.events[e.id] ??= {};
  for (const npc of world.npcs) {
    state.actors[npc.id] ??= {
      id: npc.id,
      name: npc.name,
      kind: 'npc',
      region: npc.home,
      stats: { ...INITIAL_STATS },
      pace: 'normal',
      abilities: [...npc.abilities],
    };
    state.actors[npc.id].abilities = [...npc.abilities];
    state.actors[npc.id].needs = [...npc.needs];
    state.actors[npc.id].pt = [...npc.pt];
  }
}

export function needsOf(a: Actor): readonly Need[] {
  return a.needs ?? NEEDS;
}

// Why the land can't be used (explored, worked) now, or null.
export function landUnusable(state: State, regionId: string): string | null {
  const rs = state.regions[regionId];
  if (rs?.destroyed) return '땅이 부서졌다';
  return rs?.conditions.find((c) => c.tapped)?.label ?? null;
}

export function player(state: State) {
  return state.playerId ? state.actors[state.playerId] : undefined;
}

export function alive(state: State) {
  return Object.values(state.actors).filter((a) => !a.dead);
}

// Living actors standing in a region (not on the road).
export function present(state: State, regionId: string) {
  return alive(state).filter((a) => a.region === regionId && !a.travel);
}

export function ptOf(a: Actor): Pt {
  return a.pt ?? PLAYER_PT;
}

export function addLog(
  state: State,
  e: { kind: LogKind; text: string; regions?: string[]; scope?: 'region' | 'world'; actors?: string[] },
): LogEntry {
  const regions = e.regions ?? [];
  const actors = e.actors ?? [];
  const scope = e.scope ?? 'region';
  const p = player(state);
  const seen =
    state.mode === 'observer' ||
    scope === 'world' ||
    (!!p && (actors.includes(p.id) || (!p.travel && regions.includes(p.region))));
  const entry: LogEntry = { id: state.nextLogId++, t: state.minutes, kind: e.kind, text: e.text, regions, scope, actors, seen };
  state.log.push(entry);
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
  return entry;
}

// Deterministic randomness (mulberry32) kept in the state so a save replays the same way.
export function random(state: State) {
  let a = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  a = Math.imul(a ^ (a >>> 15), 1 | a);
  a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}
