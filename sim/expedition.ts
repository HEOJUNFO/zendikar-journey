// Ior Ruin Expedition (an item, effects `landfall_quest` and `expedition`): "Landfall — you may put
// a quest counter on this. Remove three quest counters from this and sacrifice it: Draw two
// cards." Each land its owner bonds with puts a counter on it (always: it only helps, sim/items.ts
// `itemsOnLandfall`). With enough, its owner may end the expedition whenever they will, wherever
// they are (user decision 2026-10-02: an action): it is gone, and they come to know that many
// secrets of the world ("draw", sim/knowledge.ts; `draws`), or bond from afar with up to that many
// basic lands of the world, tapped (Khalni Heart Expedition, `lands`: picked one at a time as
// Harrow's, sim/harrow.ts). The player uses it by an action, an NPC by an `expedition` block in
// their plan.
import { harrowOwed } from './harrow.ts';
import { relicOptions } from './relic.ts';
import { graveCreatures } from './discovery.ts';
import { spawnWild } from './abilities.ts';
import { untapTime } from './clock.ts';
import { ABILITY_LABELS } from './world.ts';
import { drawKnowledge } from './knowledge.ts';
import { addLog, here, ptOf, together } from './state.ts';
import { masterOf } from './retainers.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { ItemDef, World } from './world.ts';

// Hours it takes (going over what the expedition found).
export const EXPEDITION_HOURS = 1;

function powerOf(x: ItemDef) {
  for (const e of x.effects) if (e.type === 'expedition') return e;
  return undefined;
}

// The expedition `a` owns, if any (one ready to end first).
export function expeditionOf(state: State, world: World, a: Actor) {
  const theirs = world.items.filter((x) => powerOf(x) && state.items?.[x.id]?.owner === a.id && !state.items[x.id].gone);
  return theirs.find((x) => state.items![x.id].counters >= powerOf(x)!.counters) ?? theirs[0];
}

// Why `a` can't end an expedition now, or null.
export function expeditionBlocked(state: State, world: World, a: Actor): string | null {
  const x = expeditionOf(state, world, a);
  if (!x) return '마칠 원정이 없다.';
  const need = powerOf(x)!.counters;
  const have = state.items![x.id].counters;
  const how = x.effects.some((e) => e.type === 'quest_combat') ? '부리는 생물이 생물에게 싸움 피해를 줄 때마다' : x.effects.some((e) => e.type === 'death_quest') ? '내가 선 땅에서 누가 죽을 때마다' : x.effects.some((e) => e.type === 'cast_quest') ? '누군가 나를 섬기러 올 때마다' : '땅과 유대를 맺을 때마다';
  if (have < need) return `${x.name}의 탐색 카운터가 모자라다 (${have}/${need}, ${how} 하나).`;
  return null;
}

// What ending it brings, in Korean (`ko`) and for the LLM (`en`).
export function expeditionReward(state: State, world: World, a: Actor) {
  const x = expeditionOf(state, world, a);
  const e = x && powerOf(x);
  if (!e) return { ko: '', en: '' };
  const ko = [e.draws ? `숨은 것 ${e.draws}가지를 알게 된다` : '', e.lands ? `아직 유대 없는 기본 땅 ${e.lands}까지와 멀리서 이어진다 (탭된 채, 오늘은 마나 없음)` : '', e.plus_counters ? `곁의 하나에게 +1/+1 카운터 ${e.plus_counters}을 준다` : '', e.relic ? '주인 없는 장비 하나를 찾아 자신이나 곁의 권속에게 값 없이 맨다' : '', e.raise ? `무덤의 생물 ${e.raise}까지를 제 거처에서 되살린다 (누구도 섬기지 않음)` : '', e.token ? `${e.token.pt.join('/')} ${world.lore.find((l) => l.id === e.token!.creature)?.name ?? e.token.creature}이(가) 곁에 나 섬긴다${e.token.until_midnight ? ' (자정에 사라짐)' : ''}` : ''].filter(Boolean).join(', ');
  const en = [e.draws ? `come to know ${e.draws} hidden secrets of the world` : '', e.lands ? `bond from afar with up to ${e.lands} basic lands of the world they don't hold yet (tapped: no mana from them today; not their land for the day)` : '', e.plus_counters ? `give ${e.plus_counters} +1/+1 counters, for good, to one standing with them (themselves too), picked after the hour` : '', e.relic ? 'find an Equipment of the world no one holds and put it on themselves or one who serves them there, for nothing (picked after the hour)' : '', e.raise ? `raise up to ${e.raise} of the dead in their creature graveyard, who wake at their homes serving no one (picked after the hour)` : '', e.token ? `have a ${e.token.pt.join('/')} ${world.lore.find((l) => l.id === e.token!.creature)?.name ?? e.token.creature}${e.token.abilities.length ? ` (${e.token.abilities.join(', ')})` : ''} serve them at their side${e.token.until_midnight ? ', gone at midnight' : ''}` : ''].filter(Boolean).join(', and ');
  return { ko, en };
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
  addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} ${josa(x.name, '을', '를')} 마쳤다 (탐색 카운터 ${e.counters}). 원정대가 찾아낸 것이 펼쳐진다.`, regions: [a.region], actors: [a.id], t });
  if (e.draws) drawKnowledge(state, world, a, e.draws, t, x.name);
  const owed = e.lands ? harrowOwed(state, world, a, { type: 'harrow', spell: x.name, left: e.lands, given: true, tapped: true }, t) : null;
  if (owed) (state.choices ??= []).push(owed);
  // Zektar Shrine Expedition: a creature token serving them at their side.
  if (e.token) {
    const [b] = spawnWild(state, world, e.token.creature, [e.token.pt[0], e.token.pt[1]], 1, a.region, e.token.colors, a.tile, e.token.abilities);
    b.master = a.id;
    if (e.token.until_midnight) state.tokens![b.id].vanishAt = untapTime(t);
    addLog(state, { kind: 'event', text: `${x.name}: ${josa(shortName(b.name), '이', '가')} 솟구쳐 ${shortName(a.name)} 곁에 섰다 (${e.token.pt.join('/')}${e.token.abilities.length ? `, ${e.token.abilities.map((ab) => ABILITY_LABELS[ab]).join('·')}` : ''}${e.token.until_midnight ? ', 자정에 사라진다' : ''}).`, regions: [a.region], actors: [a.id, b.id], t });
  }
  // Soul Stair Expedition: up to that many of their dead rise at home, free (Grim Discovery's pick).
  const dead = e.raise ? graveCreatures(state, a) : [];
  if (dead.length) (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'discovery', spell: x.name, kind: 'creature', left: e.raise }, candidates: dead.map((y) => y.id), optional: true, t });
  // Quest for the Holy Relic: an Equipment no one holds, put on one of theirs there (their pick).
  const relics = e.relic ? relicOptions(state, world, a) : [];
  if (relics.length) (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'relic', item: x.name }, candidates: relics.map((o) => o.id), optional: true, t });
  // Quest for the Gemblades: +1/+1 counters on one there (their pick after the hour; one must).
  const candidates = e.plus_counters ? here(state, a).filter((y) => y.loyalty === undefined).map((y) => y.id) : [];
  if (candidates.length) (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'gem', item: x.name, amount: e.plus_counters! }, candidates, t });
}

// The gem's counters land on `target` (if they still stand with `a`).
export function applyGem(state: State, a: Actor, target: Actor, item: string, amount: number, t: number) {
  if (target.dead || !together(a, target) || target.loyalty !== undefined) return;
  target.plusCounters = (target.plusCounters ?? 0) + amount;
  addLog(state, { kind: 'effect', text: `${item}: ${josa(shortName(target.name), '이', '가')} 보석 칼날의 힘을 받아 +1/+1 카운터 ${amount}을 얻었다 (${ptOf(target).join('/')}).`, regions: [target.region], actors: [target.id, a.id], t });
}

// Quest for the Gemblades (`quest_combat`): one `x`'s owner controls dealt combat damage to a
// creature: a quest counter (always, a boon).
export function gembladesHit(state: State, world: World, x: Actor, t: number) {
  const owner = masterOf(state, x) ?? x;
  for (const it of world.items) {
    const st = state.items?.[it.id];
    if (!it.effects.some((e) => e.type === 'quest_combat') || !st || st.gone || st.owner !== owner.id) continue;
    st.counters += 1;
    addLog(state, { kind: 'effect', text: `${shortName(owner.name)}의 ${it.name}에 탐색 카운터가 하나 쌓였다 (${st.counters}): ${shortName(x.name)}의 칼날이 피를 보았다.`, regions: [x.region], actors: [owner.id, x.id], t });
  }
}
