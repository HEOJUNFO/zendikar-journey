// What the viewer gets to see: everything for the observer, only what the character
// witnessed (and who stands next to them) in character mode.
import { formatClock } from '../sim/clock.ts';
import { player } from '../sim/state.ts';
import type { Actor, State } from '../sim/state.ts';

export function visibleActors(state: State): Actor[] {
  const all = Object.values(state.actors);
  const p = player(state);
  if (!p) return all;
  return all.filter((a) => a.id === p.id || (!p.travel && !a.travel && a.region === p.region));
}

export function visibleLog(state: State) {
  return state.log.filter((e) => e.seen);
}

export function clock(state: State) {
  return formatClock(state.minutes);
}
