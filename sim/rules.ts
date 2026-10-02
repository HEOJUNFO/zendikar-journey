import { NEEDS } from './types.ts';
import type { LifeKind, Need, Stats } from './types.ts';

type Effect = Stats;

// Change per game hour while doing a block of that kind.
export const KIND_EFFECTS: Record<LifeKind, Effect> = {
  sleep: { energy: 12, hunger: 2, coin: 0 },
  eat: { energy: 2, hunger: -45, coin: -3 },
  work: { energy: -6, hunger: 5, coin: 4 },
  social: { energy: -2, hunger: 3, coin: 0 },
  leisure: { energy: -1, hunger: 3, coin: 0 },
  bond: { energy: -1, hunger: 3, coin: 0 },
  claim: { energy: -1, hunger: 3, coin: 0 },
  equip: { energy: -1, hunger: 3, coin: 0 },
  store_day: { energy: -1, hunger: 3, coin: 0 },
  spend_day: { energy: -1, hunger: 3, coin: 0 },
  grow: { energy: -1, hunger: 3, coin: 0 },
  fetch: { energy: -1, hunger: 3, coin: 0 },
  learn: { energy: -1, hunger: 3, coin: 0 },
  cast: { energy: -1, hunger: 3, coin: 0 },
  court: { energy: -2, hunger: 3, coin: 0 },
  hire: { energy: -1, hunger: 3, coin: 0 },
  attack: { energy: -2, hunger: 3, coin: 0 },
  recall: { energy: -1, hunger: 3, coin: 0 },
  bite: { energy: -2, hunger: 3, coin: 0 },
  shield: { energy: -1, hunger: 3, coin: 0 },
  loot: { energy: -1, hunger: 3, coin: 0 },
  scout: { energy: -1, hunger: 3, coin: 0 },
  altar: { energy: -1, hunger: 3, coin: 0 },
  expedition: { energy: -1, hunger: 3, coin: 0 },
  ascend: { energy: -1, hunger: 3, coin: 0 },
  set_trap: { energy: -1, hunger: 3, coin: 0 },
};
// Change per game hour while travelling between regions.
export const TRAVEL_EFFECT: Effect = { energy: -3, hunger: 4, coin: 0 };
// Fighting: exhausting.
export const FIGHT_EFFECT: Effect = { energy: -8, hunger: 5, coin: 0 };
// Exploring a region: tiring, no pay.
export const EXPLORE_EFFECT: Effect = { energy: -6, hunger: 5, coin: 0 };
// Extra energy loss per hour when starving (hunger >= STARVING).
export const STARVING = 90;
export const STARVING_ENERGY = -3;

export const INITIAL_STATS: Stats = { energy: 80, hunger: 20, coin: 20 };

// Map units covered per game hour of travel (the map is 1920×1440 units): a tile's side (sim/tiles.ts).
export const TRAVEL_UNITS_PER_HOUR = 24;

// Bonding with a land (landfall) takes this long.
export const BOND_HOURS = 4;

// A beast this hungry hunts whoever stands with it.
export const HUNT_HUNGER = 60;
// A beast that fed on someone: this much hunger gone.
export const KILL_FEED = 60;
// How long a land stays hunted out after a beast fed there.
export const DEPLETED_HOURS = 72;
// A destroyed land lies in ruins for everyone this many days, and comes back at a midnight
// (user decision 2026-09-30).
export const DESTROYED_DAYS = 7;
export const DEPLETED_LABEL = '사냥감이 바닥남';

// A fight with no player in it doesn't kill: whoever goes down is knocked out this long.
export const KO_HOURS = 4;
export const KO_ACTIVITY = '기절';

// Hours of forced sleep when energy hits 0.
export const COLLAPSE_HOURS = 6;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// Stats outside `needs` stay as they are.
export function applyEffect(stats: Stats, effect: Partial<Effect>, gameMinutes = 60, needs: readonly Need[] = NEEDS) {
  const hours = gameMinutes / 60;
  if (needs.includes('energy')) stats.energy = clamp(stats.energy + (effect.energy ?? 0) * hours, 0, 100);
  if (needs.includes('hunger')) stats.hunger = clamp(stats.hunger + (effect.hunger ?? 0) * hours, 0, 100);
  if (needs.includes('coin')) stats.coin = Math.max(0, stats.coin + (effect.coin ?? 0) * hours);
}
