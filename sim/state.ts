// Everything that changes while the world runs. Plain JSON so it saves as-is.
import { START_MINUTES } from './clock.ts';
import { INITIAL_STATS } from './rules.ts';
import { NEEDS } from './types.ts';
import type { LifeKind, Need, Pace, Schedule, Stats } from './types.ts';
import { spellColors } from './world.ts';
import type { Ability, BeingDef, NpcDef, Pt, Speaker, World } from './world.ts';
import type { Mana } from './mana.ts';

export type TaskKind = LifeKind | 'explore' | 'travel' | 'fight' | 'bond' | 'learn' | 'cast';

export type Task = {
  kind: TaskKind;
  activity: string;
  emoji: string;
  // Player tasks and forced tasks end here; NPC tasks follow the schedule.
  until?: number;
  // learn: the spell being learned.
  spell?: string;
};

export type Actor = {
  id: string;
  name: string;
  // being: a GM-driven character (sim.gm), staying at home; its abilities are the GM's.
  kind: 'npc' | 'player' | 'being';
  // Where they are, or where they set out from while travelling.
  region: string;
  travel?: { to: string; arrive: number };
  // Lands (regions) they have bonded with: each gives a mana of its color every turn.
  bonds?: string[];
  // Lands they bonded with this turn = game day, in order: their landfalls.
  landfalls?: { day: number; regions: string[] };
  // When their latest landfall happened (a landfall event may answer it at that hour).
  landfallAt?: number;
  manaSpent?: { day: number; spent: Mana };
  // When they last arrived somewhere (an enter event may answer it at that hour).
  arrivedAt?: number;
  // Game day they last gained life (sim/life.ts).
  lifeGained?: number;
  stats: Stats;
  // Power / toughness (the player starts at 1/1; missing in old saves = 1/1).
  pt?: Pt;
  // "+N/+N and trample until end of turn": gone at `until` (00:00).
  boost?: { until: number; pt: Pt; trample: boolean };
  // Auras on them (spells that stay until they die).
  auras?: { spell: string; name: string; by: string; pt: Pt; doubleLifeOnHit: boolean }[];
  // Combat damage taken this turn; it wears off when the turn ends (00:00).
  wounds?: { day: number; amount: number };
  // Who they'll attack on sight this turn (they were attacked, or turned hostile).
  foes?: { day: number; ids: string[] };
  // Whom they serve: they are that one's retainer (sim/retainers.ts).
  master?: string;
  // Spells they know (world/entities/spells): their hand.
  spells?: string[];
  // Spells they let go of (discarded): their graveyard.
  graveyard?: string[];
  // A planeswalker's loyalty now, and the game day they last used a loyalty ability.
  loyalty?: number;
  loyaltyDay?: number;
  // A planeswalker who left this plane (with `dead` set, so the world lets them go).
  left?: boolean;
  // What they think of others, latest impression each (sim/relations.ts).
  relations?: Record<string, { name: string; text: string; t: number }>;
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
  // Activated abilities of GM-driven beings to use today.
  uses?: { being: string; ability: string; target: string; hour: number }[];
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
  // Characters born in play (MTG tokens, e.g. Kalitas's risen vampires), who have no entity
  // file: what they live by.
  tokens?: Record<string, NpcDef>;
  // Saves from before GM-driven beings were actors: their mana and tap, moved onto the
  // actor by syncWorld.
  beings?: Record<string, { id: string; manaSpent?: { day: number; spent: Mana }; boundUntil?: number }>;
  regions: Record<string, RegionState>;
  events: Record<string, { lastFired?: number }>;
  // Omened events that go off at `at`, with who set them off.
  pending: { eventId: string; at: number; by: string[] }[];
  gm: GmPlan;
  // Last day whose plans (LLM or routine) were made.
  preparedDay: number;
  met: { day: number; pairs: string[] };
  // NPC conversations held today (the LLM writes them; capped per day).
  talks?: { day: number; count: number };
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
  for (const b of world.beings) {
    state.actors[b.id] = beingActor(b);
    refreshBeing(state, world, b);
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
  // Saves from when a risen one's master was kept on its definition.
  for (const [id, def] of Object.entries(state.tokens ?? {})) {
    const old = (def as { master?: string }).master;
    if (old && state.actors[id] && !state.actors[id].master) state.actors[id].master = old;
  }
  for (const b of world.beings) {
    const old = state.beings?.[b.id];
    const a = (state.actors[b.id] ??= { ...beingActor(b), manaSpent: old?.manaSpent, boundUntil: old?.boundUntil });
    a.pt = [...b.pt];
    a.abilities = [...b.abilities];
    // Beings never leave home, so a home moved by a card moves them.
    if (!a.dead) a.region = b.home;
    refreshBeing(state, world, b);
  }
  delete state.beings;
}

// A being's loyalty (first time) and its hand: every spell of its colors it hasn't held yet
// (new spell cards join it).
function refreshBeing(state: State, world: World, b: BeingDef) {
  const a = state.actors[b.id];
  if (b.loyalty !== undefined && a.loyalty === undefined) a.loyalty = b.loyalty;
  const held = new Set([...(a.spells ?? []), ...(a.graveyard ?? [])]);
  for (const s of world.spells)
    if (!held.has(s.id) && spellColors(s).some((c) => b.knowsColors.includes(c))) a.spells = [...(a.spells ?? []), s.id];
}

// A GM-driven being on the map: at home, living by no needs.
function beingActor(b: BeingDef): Actor {
  return {
    id: b.id,
    name: b.name,
    kind: 'being',
    region: b.home,
    stats: { ...INITIAL_STATS },
    pt: [...b.pt],
    pace: 'normal',
    abilities: [...b.abilities],
    needs: [],
  };
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

// The definition an NPC lives by: from world/entities, or one born in play (state.tokens).
export function npcDef(state: State, world: World, id: string): NpcDef | undefined {
  return world.npcs.find((n) => n.id === id) ?? state.tokens?.[id];
}

// Anyone the player can talk to or fight: an NPC (from a file or born in play) or a GM-driven being.
export function speakerDef(state: State, world: World, id: string): Speaker | undefined {
  const b = world.beings.find((x) => x.id === id);
  if (!b) return npcDef(state, world, id);
  return { id: b.id, name: b.name, persona: b.summary, goal: '(드러나지 않음)', role: '(드러나지 않음)' };
}

export function isPerson(a: Actor) {
  return a.kind === 'npc' || a.kind === 'being';
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

// Power / toughness now, with this turn's boost and their auras.
export function ptOf(a: Actor): Pt {
  let [p, t] = a.pt ?? PLAYER_PT;
  for (const x of [...(a.boost ? [a.boost] : []), ...(a.auras ?? [])]) [p, t] = [p + x.pt[0], t + x.pt[1]];
  return [p, t];
}

export function addLog(
  state: State,
  e: { kind: LogKind; text: string; regions?: string[]; scope?: 'region' | 'world'; actors?: string[]; t?: number },
): LogEntry {
  const regions = e.regions ?? [];
  const actors = e.actors ?? [];
  const scope = e.scope ?? 'region';
  const p = player(state);
  const seen =
    state.mode === 'observer' ||
    scope === 'world' ||
    (!!p && (actors.includes(p.id) || (!p.travel && regions.includes(p.region))));
  const entry: LogEntry = { id: state.nextLogId++, t: e.t ?? state.minutes, kind: e.kind, text: e.text, regions, scope, actors, seen };
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
