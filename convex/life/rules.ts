import { LifeKind, LifeStats } from './types';

type Effect = LifeStats;

// Change per game hour while doing a block of that kind at its place.
export const KIND_EFFECTS: Record<LifeKind, Effect> = {
  sleep: { energy: 12, hunger: 2, coin: 0 },
  eat: { energy: 2, hunger: -45, coin: -3 },
  work: { energy: -6, hunger: 5, coin: 4 },
  social: { energy: -2, hunger: 3, coin: 0 },
  leisure: { energy: -1, hunger: 3, coin: 0 },
};
// Change per game hour while walking to the scheduled place.
export const TRAVEL_EFFECT: Effect = { energy: -3, hunger: 4, coin: 0 };

export const INITIAL_STATS: LifeStats = { energy: 80, hunger: 20, coin: 20 };

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function applyEffect(stats: LifeStats, effect: Effect, gameMinutes: number) {
  const hours = gameMinutes / 60;
  stats.energy = clamp(stats.energy + effect.energy * hours, 0, 100);
  stats.hunger = clamp(stats.hunger + effect.hunger * hours, 0, 100);
  stats.coin = Math.max(0, stats.coin + effect.coin * hours);
}
