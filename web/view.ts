// What the viewer gets to see: everything for the observer (and on the world page, `all`),
// only what the character witnessed (and who stands next to them) in character mode.
import { formatClock } from '../sim/clock.ts';
import { player } from '../sim/state.ts';
import type { Actor, State } from '../sim/state.ts';
import type { EventDef, Region, World } from '../sim/world.ts';

export function visibleActors(state: State, all = false): Actor[] {
  const alive = Object.values(state.actors).filter((a) => !a.dead || a.kind === 'player');
  const p = player(state);
  if (!p || all) return alive;
  return alive.filter((a) => a.id === p.id || (!p.travel && !a.travel && a.region === p.region));
}

export function visibleLog(state: State, all = false) {
  return all ? state.log : state.log.filter((e) => e.seen);
}

export function clock(state: State) {
  return formatClock(state.minutes);
}

// Where a land's node is drawn: a region at its place, an area as a small node beside its
// region (the engine puts areas at the region's place).
export const AREA_GAP = 7.5;
export function nodeAt(world: World, r: Region) {
  if (!r.parent) return { x: r.x, y: r.y };
  const i = world.regions.filter((x) => x.parent === r.parent).indexOf(r);
  const angle = -Math.PI / 12 + i * (Math.PI / 4);
  return { x: r.x + Math.cos(angle) * AREA_GAP, y: r.y + Math.sin(angle) * AREA_GAP };
}

// Traps: events the land sets off by itself when someone comes (law-ruin-traps), unlike
// the GM's events.
export function isTrap(ev: EventDef) {
  return ev.trigger !== 'gm';
}

export type TrapStatus = { kind: 'armed' } | { kind: 'omen'; at: number } | { kind: 'cooldown'; until: number };

// Whether a trap would answer now: waiting, about to go off (omened), or spent for a while.
export function trapStatus(state: State | null, ev: EventDef): TrapStatus {
  const t = state?.minutes ?? 0;
  const pending = state?.pending.find((p) => p.eventId === ev.id);
  if (pending) return { kind: 'omen', at: pending.at };
  const last = state?.events[ev.id]?.lastFired;
  if (last !== undefined && t - last < ev.cooldownHours * 60) return { kind: 'cooldown', until: last + ev.cooldownHours * 60 };
  return { kind: 'armed' };
}
