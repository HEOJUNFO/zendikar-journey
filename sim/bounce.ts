// "Return two target creatures to their owners' hands" (Whiplash Trap), in this world ([결정]
// 2026-10-01): flung away, they lose all that was on them (+1/+1 counters, auras, the day's
// boosts, wounds) and whoever controlled them (their owner is themselves), land in another
// area of the same region (or the region around it), and lie stunned an hour. A token has no
// hand to go back to: it is gone.
import { gameDay } from './clock.ts';
import { releaseRetainer, retainersOf } from './retainers.ts';
import { KO_ACTIVITY } from './rules.ts';
import { addLog, npcDef, present, random, targetable } from './state.ts';
import type { Actor, State } from './state.ts';
import { travelBlocked } from './step.ts';
import { josa, shortName } from './text.ts';
import { descendantsOf, region, topOf } from './world.ts';
import type { World } from './world.ts';
import { nearestTile, tileCenter } from './tiles.ts';
import type { Tile } from './tiles.ts';

// Hours one flung lies stunned.
export const BOUNCE_KO_HOURS = 1;

// Creatures who came under `a`'s control today ("had two or more creatures enter the
// battlefield under their control this turn"): those who joined them today (hired, won over)
// and those born or raised theirs today.
export function joinedToday(state: State, a: Actor, t: number) {
  const day = gameDay(t);
  return retainersOf(state, a.id).filter((r) => (r.joinedAt !== undefined && gameDay(r.joinedAt) === day) || (r.enteredAt !== undefined && gameDay(r.enteredAt) === day)).length;
}

// Who a blue trap may fling there: creatures (not the player, not planeswalkers), those it can
// pick (not shrouded, not protected from blue).
export function bounceCandidates(state: State, world: World, regionId: string, tile: Tile | undefined, t: number) {
  return present(state, regionId, tile).filter((x) => x.kind === 'npc' && npcDef(state, world, x.id)?.loyalty === undefined && targetable(x, t, ['U']));
}

// Where one flung lands: another area of their region, or the region around the area they
// are in; one they could go to (not the sea for those of the land, the sky only for flyers).
function landing(state: State, world: World, a: Actor) {
  const here = region(world, a.region);
  const top = topOf(world, here);
  const places = [top, ...descendantsOf(world, top.id)].filter((r) => r.id !== here.id && !travelBlocked(state, world, a, r.id));
  return places.length ? places[Math.floor(random(state) * places.length)] : undefined;
}

// A token leaving play: it ceases to be (`how` it went, for the log).
export function vanishToken(state: State, a: Actor, t: number, cause: string, how: string) {
  const name = shortName(a.name);
  a.dead = { at: t, cause: `${cause}: 사라짐` };
  a.left = true;
  for (const r of retainersOf(state, a.id)) releaseRetainer(state, r, `${name}이(가) 사라짐`);
  a.task = undefined;
  a.forced = undefined;
  a.travel = undefined;
  addLog(state, { kind: 'event', text: `${cause}: ${josa(name, '이', '가')} ${how}`, regions: [a.region], actors: [a.id], t });
}

// Leaving play and coming back (to a hand, a library): all that was on them falls away (+1/+1
// counters, auras and what they gave, the day's boosts, wounds) and so does whoever controlled
// them.
export function shed(state: State, world: World, a: Actor, cause: string) {
  const def = npcDef(state, world, a.id);
  const given = (a.auras ?? []).flatMap((x) => x.added ?? []);
  delete a.plusCounters;
  delete a.auras;
  delete a.boost;
  delete a.pumps;
  delete a.granted;
  delete a.lost;
  delete a.wounds;
  if (def) a.abilities = [...def.abilities];
  else if (given.length) a.abilities = a.abilities.filter((x) => !given.includes(x));
  releaseRetainer(state, a, cause);
}

export function bounce(state: State, world: World, a: Actor, t: number, cause: string) {
  if (a.dead) return;
  const name = shortName(a.name);
  if (state.tokens?.[a.id]) return vanishToken(state, a, t, cause, '내동댕이쳐져 흔적도 없이 사라졌다.');
  shed(state, world, a, cause);
  const to = landing(state, world, a);
  a.travel = undefined;
  if (to) {
    a.region = to.id;
    a.tile = nearestTile(world, to.id, a.tile && tileCenter(a.tile));
  }
  a.task = undefined;
  a.forced = { kind: 'sleep', activity: KO_ACTIVITY, emoji: '😵', until: t + BOUNCE_KO_HOURS * 60 };
  addLog(state, {
    kind: 'event',
    text: `${cause}: ${josa(name, '이', '가')} 내동댕이쳐져${to ? ` ${to.name}에` : ''} 떨어졌다. 몸에 붙었던 힘이 모두 떨어져 나갔고, ${BOUNCE_KO_HOURS}시간 정신을 잃었다.`,
    regions: [a.region],
    actors: [a.id],
    t,
  });
}
