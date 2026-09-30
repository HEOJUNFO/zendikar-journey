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

// Where a land's node is drawn. A region holding areas, or one with a size (a continent, a
// small island), is itself a circle of that size, with its areas as small circles across the
// lower part; the upper part is where its own people and marks go. (The engine puts areas at
// their region's place; this is only how they are drawn.)
const SIZE_RADIUS = { continent: 16, island: 7 } as const;
function areaAngle(world: World, r: Region) {
  const sibs = world.regions.filter((x) => x.parent === r.parent);
  const n = sibs.length;
  const spread = Math.min(2.4, (n - 1) * 1.4);
  return Math.PI / 2 + (n > 1 ? -spread / 2 + (spread * sibs.indexOf(r)) / (n - 1) : 0);
}

// The circle's radius for a region drawn as one, 0 for a plain node.
export function containerRadius(world: World, r: Region) {
  if (r.parent) return 0;
  const n = world.regions.filter((x) => x.parent === r.id).length;
  const base = r.size ? SIZE_RADIUS[r.size] : n ? 10 : 0;
  return base && base + Math.max(0, n - 3) * 1.3;
}

export function nodeAt(world: World, r: Region) {
  if (r.parent) {
    const R = containerRadius(world, world.regions.find((x) => x.id === r.parent)!);
    const angle = areaAngle(world, r);
    return { x: r.x + Math.cos(angle) * R * 0.5, y: r.y + Math.sin(angle) * R * 0.5 };
  }
  return { x: r.x, y: r.y - containerRadius(world, r) * 0.45 };
}

// An area's name: just outside its region's circle, in the area's direction.
export function areaLabelAt(world: World, r: Region) {
  const angle = areaAngle(world, r);
  const d = containerRadius(world, world.regions.find((x) => x.id === r.parent)!) + 1.8;
  const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
  return { x: r.x + dx * d, y: r.y + dy * d + 1.5, anchor: dx > 0.3 ? 'start' : dx < -0.3 ? 'end' : 'middle' } as const;
}

// Traps: events the land sets off by itself when someone comes (law-ruin-traps), unlike
// the events the morning LLM raises.
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
