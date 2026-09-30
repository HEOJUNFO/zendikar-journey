// Items (MTG artifacts, world/entities/items): permanents that stand in one place. Whoever
// pays an item's cost there tames it and holds it until they die or leave the plane.
import { gainLife, lifeOf } from './life.ts';
import { formatMana, manaAvailable, payMana, planPayment } from './mana.ts';
import { addLog, npcDef } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { canStay, placeName, region } from './world.ts';
import type { World } from './world.ts';

// Taming an item takes an hour, as casting a spell does.
export const CLAIM_HOURS = 1;

export function itemDef(world: World, id: string) {
  return world.items.find((x) => x.id === id);
}

export function itemsAt(world: World, regionId: string) {
  return world.items.filter((x) => x.at === regionId);
}

export function itemOwner(state: State, itemId: string) {
  return state.items?.[itemId]?.owner;
}

export function itemsOf(state: State, world: World, actorId: string) {
  return world.items.filter((x) => itemOwner(state, x.id) === actorId);
}

export function claimBlocked(state: State, world: World, a: Actor, itemId: string, t: number): string | null {
  const x = itemDef(world, itemId);
  if (!x) return '그런 것은 없다.';
  const owner = itemOwner(state, x.id);
  if (owner === a.id) return `이미 ${josa(x.name, '을', '를')} 길들였다.`;
  if (owner) return `${josa(x.name, '은', '는')} 이미 ${shortName(state.actors[owner]?.name ?? owner)}의 것이다.`;
  if (a.region !== x.at) return `${josa(x.name, '은', '는')} ${placeName(world, region(world, x.at))}에 있다.`;
  if (!planPayment(manaAvailable(state, world, a, t), x.cost))
    return `마나가 모자라다 (${x.costText}, 지금 ${formatMana(manaAvailable(state, world, a, t))}).`;
  return null;
}

// Items an NPC could set out to tame today: no one holds them, they can stand where the item
// is, and their mana pays for it.
export function claimableItems(state: State, world: World, a: Actor, t: number) {
  const def = npcDef(state, world, a.id);
  if (!def || def.beast) return [];
  return world.items.filter(
    (x) => !itemOwner(state, x.id) && canStay(region(world, x.at), def.abilities) && planPayment(manaAvailable(state, world, a, t), x.cost),
  );
}

// `a` pays for the item and it becomes theirs. "Enters with X charge counters, where X is
// your life total": their life now goes into it.
export function claimItem(state: State, world: World, a: Actor, itemId: string, t: number) {
  const why = claimBlocked(state, world, a, itemId, t);
  const x = itemDef(world, itemId);
  if (why || !x) {
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} 길들이지 못했다: ${why}`, regions: [a.region], actors: [a.id], t });
    return;
  }
  payMana(state, world, a, x.cost, t);
  const counters = x.effects.some((e) => e.type === 'charge_life') ? (lifeOf(a) ?? 0) : 0;
  (state.items ??= {})[x.id] = { name: x.name, owner: a.id, counters };
  addLog(state, {
    kind: 'event',
    text: `${josa(shortName(a.name), '이', '가')} ${josa(x.name, '을', '를')} 길들였다.${counters ? ` 그릇에 생명 ${counters}이 담겼다.` : ''}`,
    regions: [a.region],
    actors: [a.id],
    t,
  });
}

// Landfall for the items `a` holds: "you may have your life total become the number of charge
// counters". Only when that raises it (no one chooses to lose life).
export function itemsOnLandfall(state: State, world: World, a: Actor, t: number) {
  for (const x of itemsOf(state, world, a.id)) {
    if (!x.effects.some((e) => e.type === 'landfall_set_life')) continue;
    const life = lifeOf(a);
    const counters = state.items![x.id].counters;
    if (life === null || counters <= life) continue;
    gainLife(state, a, counters - life, t, x.name);
  }
}

// Their items stand unheld again (they died or left the plane).
export function releaseItems(state: State, a: Actor, t: number) {
  for (const [id, x] of Object.entries(state.items ?? {})) {
    if (x.owner !== a.id) continue;
    state.items![id] = { name: x.name, counters: 0 };
    addLog(state, { kind: 'status', text: `${josa(x.name, '은', '는')} 다시 주인 없는 것이 되었다.`, regions: [a.region], actors: [a.id], t });
  }
}
