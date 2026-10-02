// Expedition Map (an item, effect `search_hand`): "{2}, {T}, Sacrifice this: Search your library for
// a land card, reveal it, put it into your hand, then shuffle." Its owner, wherever they are, pays
// the cost and spends an hour over it (user decision 2026-10-02): the map is gone, and they pick a
// land of the world they don't hold yet, any land (user decision 2026-10-02), to keep in their hand
// (`Actor.handLands`, sim/oracle.ts): bonding with it from afar is their land for the day, when they
// will. It is a shuffle (`markSearched`: Cosi's Trickster). Which land is the player's to pick now,
// an NPC's by the LLM after the hour. The player uses it by an action, an NPC by a `chart` block.
import { formatMana, manaAvailable, parseManaCost, payMana, planPayment } from './mana.ts';
import { addLog, markSearched } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import { region } from './world.ts';
import type { ItemDef, World } from './world.ts';

// Hours it takes (poring over the map).
export const CHART_HOURS = 1;

function powerOf(x: ItemDef) {
  for (const e of x.effects) if (e.type === 'search_hand') return { cost: parseManaCost(e.cost)!, costText: e.cost };
  return undefined;
}

// The map `a` owns, if any.
export function chartOf(state: State, world: World, a: Actor) {
  return world.items.find((x) => powerOf(x) && state.items?.[x.id]?.owner === a.id && !state.items[x.id].gone);
}

// The lands it may find: any of the world they don't hold, nor have in hand, nor lost for good.
export function chartTargets(state: State, world: World, a: Actor) {
  return world.regions.filter((r) => !r.oneLandWith && !r.notLand && !a.bonds?.includes(r.id) && !a.handLands?.includes(r.id) && !a.exiledLands?.includes(r.id) && !state.regions[r.id]?.destroyed);
}

// Why `a` can't use a map now, or null.
export function chartBlocked(state: State, world: World, a: Actor, t: number): string | null {
  const x = chartOf(state, world, a);
  if (!x) return '펼칠 지도가 없다.';
  const e = powerOf(x)!;
  if (!planPayment(manaAvailable(state, world, a, t), e.cost)) return `마나가 모자라다 (${e.costText}, 지금 ${formatMana(manaAvailable(state, world, a, t))}).`;
  if (!chartTargets(state, world, a).length) return '지도에서 새로 찾을 땅이 없다.';
  return null;
}

export function chartCost(state: State, world: World, a: Actor) {
  const x = chartOf(state, world, a);
  return x ? powerOf(x)!.costText : '';
}

// The hour done: paid, the map is gone, and which land is theirs to pick.
export function useChart(state: State, world: World, a: Actor, t: number) {
  const x = chartOf(state, world, a);
  if (!x || chartBlocked(state, world, a, t)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 지도에서 아무 길도 찾지 못했다.`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const e = powerOf(x)!;
  payMana(state, world, a, e.cost, t);
  const s = state.items![x.id];
  state.items![x.id] = { name: s.name, counters: 0, gone: true };
  addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} ${josa(x.name, '을', '를')} 펼쳐 남들이 가 본 길을 짚고 그 반대쪽을 더듬었다 (${e.costText}). 지도는 닳아 사라졌다.`, regions: [a.region], actors: [a.id], t });
  const owed: Choice = { by: a.id, land: a.region, effect: { type: 'chart', item: x.name }, candidates: chartTargets(state, world, a).map((r) => r.id), optional: false, t };
  (a.kind === 'player' ? (state.asks ??= []) : (state.choices ??= [])).push(owed);
}

// The land picked (the first, if the pick is none of them): into their hand, and the library shuffled.
export function applyChart(state: State, world: World, a: Actor, pick: string | null, c: Choice, t: number) {
  const ok = chartTargets(state, world, a).map((r) => r.id).filter((id) => c.candidates.includes(id));
  const land = pick && ok.includes(pick) ? pick : ok[0];
  if (!land) return;
  a.handLands = [...(a.handLands ?? []), land];
  markSearched(state, a, t);
  addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} 지도에서 ${toward(region(world, land).name)} 가는 길을 찾아 손에 쥐었다 (언제든 멀리서 그날의 땅으로 이을 수 있다).`, regions: [a.region], actors: [a.id], t });
}
