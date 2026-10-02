// Quest for Pure Flame (an item, effect `damage_quest`): "Whenever a source you control deals damage
// to an opponent, you may put a quest counter on this. Remove four quest counters from this and
// sacrifice it: If any source you control would deal damage to a creature or player this turn, it
// deals double that damage instead." Each time its owner or one who serves them deals damage that
// gets through to someone not of their side (a fight, a spell, a power; combat.ts `dealDamage`), a
// counter (always: it only helps). With enough, its owner may end it whenever they will, wherever
// they are (an hour): it is gone, and until midnight the damage they and theirs deal is doubled
// (`Actor.doubleUntil`). The player uses it by an action, an NPC by a `flame` block in their plan.
import { untapTime } from './clock.ts';
import { masterOf } from './retainers.ts';
import { addLog } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { ItemDef, World } from './world.ts';

// Hours it takes (feeding the flame).
export const FLAME_HOURS = 1;

function powerOf(x: ItemDef) {
  for (const e of x.effects) if (e.type === 'damage_quest') return e;
  return undefined;
}

// The quest `a` owns, if any.
export function flameOf(state: State, world: World, a: Actor) {
  return world.items.find((x) => powerOf(x) && state.items?.[x.id]?.owner === a.id && !state.items[x.id].gone);
}

// How much the damage `source` deals is multiplied: doubled while its controller's flame burns.
export function flameMultiplier(state: State, source: Actor | undefined, t: number) {
  if (!source) return 1;
  const controller = masterOf(state, source) ?? source;
  return controller.doubleUntil !== undefined && controller.doubleUntil > t ? 2 : 1;
}

// Damage got through from `source` to `target`: a counter on its controller's quest, if the target
// is not of their side.
export function flameOnDamage(state: State, world: World, source: Actor | undefined, target: Actor, t: number) {
  if (!source) return;
  const controller = masterOf(state, source) ?? source;
  if (target.id === controller.id || masterOf(state, target)?.id === controller.id) return;
  const x = flameOf(state, world, controller);
  if (!x) return;
  const s = state.items![x.id];
  s.counters += 1;
  addLog(state, { kind: 'effect', text: `${shortName(controller.name)}의 ${x.name}에 탐색 카운터가 쌓였다 (${s.counters}/${powerOf(x)!.counters}): 불길이 ${shortName(target.name)}에게 닿았다.`, regions: [controller.region], actors: [controller.id], t });
}

// Why `a` can't end it now, or null.
export function flameBlocked(state: State, world: World, a: Actor): string | null {
  const x = flameOf(state, world, a);
  if (!x) return '마칠 탐색이 없다.';
  const need = powerOf(x)!.counters;
  const have = state.items![x.id].counters;
  if (have < need) return `${x.name}의 탐색 카운터가 모자라다 (${have}/${need}, 나와 내 편이 남에게 피해를 줄 때마다 하나).`;
  return null;
}

export function finishFlame(state: State, world: World, a: Actor, t: number) {
  const x = flameOf(state, world, a);
  if (!x || flameBlocked(state, world, a)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 탐색을 마치지 못했다.`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const s = state.items![x.id];
  state.items![x.id] = { name: s.name, counters: 0, gone: true };
  a.doubleUntil = untapTime(t);
  addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} ${josa(x.name, '을', '를')} 마쳤다. 순수한 불꽃이 몸에 깃들어, 자정까지 ${shortName(a.name)}와(과) 그 편이 주는 피해가 두 배가 된다.`, regions: [a.region], actors: [a.id], t });
}
