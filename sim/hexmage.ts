// Vampire Hexmage (`sim.sac_uncounter`): "Sacrifice this creature: Remove all counters from target
// permanent." Whoever controls it (its master, or itself serving no one) may sacrifice it whenever
// they will (user decision 2026-10-02): it dies (into its master's graveyard), and one permanent on
// its tile loses every counter: a being's +1/+1 counters, a planeswalker's loyalty (gone, it leaves
// the plane), an item's counters there (an ascension's quest counters, a vessel's charge). The
// player does it by an action, an NPC by a `hex` block in their plan; it takes an hour.
import { die, leavePlane } from './combat.ts';
import { itemWhere } from './items.ts';
import { retainersOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, outOfTime, present, targetable, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { sameTile } from './tiles.ts';
import type { World } from './world.ts';

// Hours it takes.
export const HEX_HOURS = 1;

// The hexmages `a` controls: themselves (serving no one) and those who serve them.
export function hexmagesOf(state: State, world: World, a: Actor) {
  return [...(a.master ? [] : [a]), ...retainersOf(state, a.id)].filter((x) => !x.dead && npcDef(state, world, x.id)?.sacUncounter);
}

// What a hexmage `h` could strip there: beings with counters (or loyalty), items with counters.
export function hexTargets(state: State, world: World, h: Actor, t: number) {
  const beings = present(state, h.region, h.tile)
    .filter((x) => x.id !== h.id && ((x.plusCounters ?? 0) > 0 || (x.loyalty ?? 0) > 0) && targetable(x, t, ['B']))
    .map((x) => ({ id: `being:${x.id}`, label: x.loyalty !== undefined ? `${shortName(x.name)} (기세 ${x.loyalty}: 떠나게 된다)` : `${shortName(x.name)} (+1/+1 카운터 ${x.plusCounters})` }));
  const items = world.items
    .filter((x) => (state.items?.[x.id]?.counters ?? 0) > 0 && !state.items![x.id].gone)
    .filter((x) => {
      const w = itemWhere(state, world, x);
      return !!w && w.region === h.region && sameTile(w.tile, h.tile);
    })
    .map((x) => ({ id: `item:${x.id}`, label: `${x.name} (카운터 ${state.items![x.id].counters})` }));
  return [...beings, ...items];
}

// One of theirs who can do it now, standing with the target if `here`.
function readyHexmage(state: State, world: World, a: Actor, target: string, t: number, here: boolean) {
  return hexmagesOf(state, world, a).find((h) => !outOfTime(state, h, t) && !powersSealed(state, world, h, t) && (!here || hexTargets(state, world, h, t).some((o) => o.id === target)));
}

// Why `a` can't have a hexmage strip `target` now, or null. With `here`, it must stand by it
// already (the player's action); without, they may still go to it (a plan).
export function hexBlocked(state: State, world: World, a: Actor, target: string | undefined, t: number, here = true): string | null {
  const theirs = hexmagesOf(state, world, a);
  if (!theirs.length) return '부릴 흡혈귀 주술사가 없다.';
  if (!target) return '카운터를 없앨 것을 골라야 한다.';
  if (!readyHexmage(state, world, a, target, t, here)) return here ? '곁에 카운터를 없앨 것이 없다 (주술사와 같은 칸이어야 한다).' : `${josa(shortName(theirs[0].name), '은', '는')} 지금 힘을 쓸 수 없다.`;
  return null;
}

export function hex(state: State, world: World, a: Actor, target: string, t: number) {
  const h = readyHexmage(state, world, a, target, t, true);
  if (!h) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 주술이 닿지 않았다.`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const [kind, id] = target.split(':');
  addLog(state, { kind: 'event', text: `${josa(shortName(h.name), '이', '가')} 제 피를 모두 바쳐 저주를 건다.`, regions: [h.region], actors: [h.id, a.id], t });
  if (kind === 'being') {
    const x = state.actors[id];
    if (x.loyalty !== undefined) {
      x.loyalty = 0;
      addLog(state, { kind: 'effect', text: `${josa(shortName(x.name), '은', '는')} 기세를 모두 잃었다.`, regions: [x.region], actors: [x.id], t });
      leavePlane(state, x, t, `${shortName(h.name)}의 저주`);
    } else {
      addLog(state, { kind: 'effect', text: `${josa(shortName(x.name), '이', '가')} 쌓아 온 힘(+1/+1 카운터 ${x.plusCounters})이 모두 빠져나갔다.`, regions: [x.region], actors: [x.id], t });
      delete x.plusCounters;
    }
  } else {
    const s = state.items![id];
    addLog(state, { kind: 'effect', text: `${world.items.find((x) => x.id === id)?.name ?? s.name}에 쌓였던 카운터 ${s.counters}이 모두 흩어졌다.`, regions: [h.region], actors: [h.id], t });
    s.counters = 0;
  }
  die(state, h, t, `${shortName(h.name)} 자신의 저주 (희생)`);
}

// Whether `a` stands with one of theirs and something to strip (for buttons).
export function hexNear(state: State, world: World, a: Actor, t: number) {
  return hexmagesOf(state, world, a).filter((h) => together(h, a) || h.id === a.id).flatMap((h) => hexTargets(state, world, h, t));
}
