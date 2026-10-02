// Luminarch Ascension (an item, effects `quest_unhurt` and `quest_token`): "At the beginning of
// each opponent's end step, if you didn't lose life this turn, you may put a quest counter on
// this. (Damage causes loss of life.) {1}{W}: Create a 4/4 white Angel creature token with
// flying. Activate only if this has four or more quest counters." A turn's end is midnight: an
// owner who neither lost life nor took damage that day (user decision 2026-10-02: wounds count,
// as the card's reminder; `Actor.hurtDay`) puts a counter on it (always, a boon). With enough,
// its owner pays whenever they will, wherever they are (an hour): an angel token comes to serve
// them at their side, as many times as they can pay. The player uses it by an action, an NPC by
// an `ascend` block in their plan.
import { gameDay } from './clock.ts';
import { spawnWild } from './abilities.ts';
import { formatMana, manaAvailable, parseManaCost, payMana, planPayment } from './mana.ts';
import { addLog } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { ItemDef, World } from './world.ts';

// Hours it takes (calling one down).
export const ASCEND_HOURS = 1;

function tokenOf(x: ItemDef) {
  for (const e of x.effects) if (e.type === 'quest_token') return e;
  return undefined;
}

// Midnight: each such item whose owner went unhurt the day just ended takes a counter.
export function upkeepUnhurt(state: State, world: World, t: number) {
  const yesterday = gameDay(t) - 1;
  for (const x of world.items) {
    if (!x.effects.some((e) => e.type === 'quest_unhurt')) continue;
    const s = state.items?.[x.id];
    const owner = s?.owner ? state.actors[s.owner] : undefined;
    if (!s || s.gone || !owner || owner.dead || owner.hurtDay === yesterday) continue;
    s.counters += 1;
    const need = tokenOf(x)?.counters;
    addLog(state, { kind: 'effect', text: `${shortName(owner.name)}의 ${x.name}에 탐색 카운터가 하나 쌓였다 (${s.counters}${need ? `/${need}` : ''}): 상처 없이 하루를 지냈다.${need && s.counters === need ? ' 이제 빛 속에서 천사를 부를 수 있다.' : ''}`, regions: [owner.region], actors: [owner.id], t });
  }
}

// The ascension `a` owns that can call one down, if any.
export function ascensionOf(state: State, world: World, a: Actor) {
  return world.items.find((x) => tokenOf(x) && state.items?.[x.id]?.owner === a.id && !state.items[x.id].gone);
}

// Why `a` can't call one down now, or null.
export function ascendBlocked(state: State, world: World, a: Actor, t: number): string | null {
  const x = ascensionOf(state, world, a);
  if (!x) return '부를 승천이 없다.';
  const e = tokenOf(x)!;
  const have = state.items![x.id].counters;
  if (have < e.counters) return `${x.name}의 탐색 카운터가 모자라다 (${have}/${e.counters}, 상처 없이 지낸 날마다 하나).`;
  if (!planPayment(manaAvailable(state, world, a, t), parseManaCost(e.cost)!)) return `마나가 모자라다 (${e.cost}, 지금 ${formatMana(manaAvailable(state, world, a, t))}).`;
  return null;
}

// What it calls down, in Korean.
export function ascendText(state: State, world: World, a: Actor) {
  const x = ascensionOf(state, world, a);
  const e = x && tokenOf(x);
  if (!e) return '';
  const kind = world.lore.find((l) => l.id === e.creature)?.name ?? e.creature;
  return `${e.cost}를 치러 ${e.pt.join('/')} ${kind}을(를) 권속으로 부른다`;
}

export function ascend(state: State, world: World, a: Actor, t: number) {
  const x = ascensionOf(state, world, a);
  if (!x || a.dead || ascendBlocked(state, world, a, t)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 아무것도 내려오지 않았다.`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const e = tokenOf(x)!;
  payMana(state, world, a, parseManaCost(e.cost)!, t);
  const [b] = spawnWild(state, world, e.creature, [e.pt[0], e.pt[1]], 1, a.region, e.colors, a.tile, e.abilities);
  b.master = a.id;
  if (e.types.length) state.tokens![b.id].types = [...e.types];
  const kind = world.lore.find((l) => l.id === e.creature)?.name ?? e.creature;
  addLog(state, { kind: 'event', text: `${x.name}: ${josa(shortName(a.name), '이', '가')} ${e.cost}를 치르자 빛 속에서 ${josa(kind, '이', '가')} 내려와 곁에 섰다 (${e.pt.join('/')}, 권속).`, regions: [a.region], actors: [a.id, b.id], t });
}
