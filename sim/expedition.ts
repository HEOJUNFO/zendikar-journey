// Ior Ruin Expedition (an item, effects `landfall_quest` and `expedition`): "Landfall — you may put
// a quest counter on this. Remove three quest counters from this and sacrifice it: Draw two
// cards." Each land its owner bonds with puts a counter on it (always: it only helps, sim/items.ts
// `itemsOnLandfall`). With enough, its owner may end the expedition whenever they will, wherever
// they are (user decision 2026-10-02: an action): it is gone, and they come to know that many
// secrets of the world ("draw", sim/knowledge.ts). The player uses it by an action, an NPC by an
// `expedition` block in their plan.
import { drawKnowledge } from './knowledge.ts';
import { addLog } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { ItemDef, World } from './world.ts';

// Hours it takes (going over what the expedition found).
export const EXPEDITION_HOURS = 1;

function powerOf(x: ItemDef) {
  for (const e of x.effects) if (e.type === 'expedition') return e;
  return undefined;
}

// The expedition `a` owns, if any.
export function expeditionOf(state: State, world: World, a: Actor) {
  return world.items.find((x) => powerOf(x) && state.items?.[x.id]?.owner === a.id && !state.items[x.id].gone);
}

// Why `a` can't end an expedition now, or null.
export function expeditionBlocked(state: State, world: World, a: Actor): string | null {
  const x = expeditionOf(state, world, a);
  if (!x) return '마칠 원정이 없다.';
  const need = powerOf(x)!.counters;
  const have = state.items![x.id].counters;
  if (have < need) return `${x.name}의 탐색 카운터가 모자라다 (${have}/${need}, 땅과 유대를 맺을 때마다 하나).`;
  return null;
}

// How many secrets ending it brings.
export function expeditionDraws(state: State, world: World, a: Actor) {
  const x = expeditionOf(state, world, a);
  return x ? powerOf(x)!.draws : 0;
}

export function finishExpedition(state: State, world: World, a: Actor, t: number) {
  const x = expeditionOf(state, world, a);
  if (!x || expeditionBlocked(state, world, a)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 원정을 마치지 못했다.`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const e = powerOf(x)!;
  const s = state.items![x.id];
  state.items![x.id] = { name: s.name, counters: 0, gone: true };
  addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} ${josa(x.name, '을', '를')} 마쳤다 (탐색 카운터 ${e.counters}). 원정대가 가라앉은 폐허에서 건져 올린 것이 펼쳐진다.`, regions: [a.region], actors: [a.id], t });
  drawKnowledge(state, world, a, e.draws, t, x.name);
}
