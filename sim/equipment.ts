// Equipment (MTG Artifact — Equipment; Grappling Hook): an item its owner carries (sim/items.ts
// `itemWhere`). "Equip <cost>": the owner pays to put it on themselves or a retainer standing
// with them (an hour); the bearer then has its abilities. It comes off when the bearer dies or
// no longer serves the owner, or the owner loses it (dies: it falls where they were; it is
// destroyed). `lure` ("whenever equipped creature attacks, you may have target creature block
// it"): the one its bearer falls on can't fly from them (sim/combat.ts `unblockable`).
import { formatMana, manaAvailable, payMana, planPayment } from './mana.ts';
import { itemDef, itemsOf, unequip } from './items.ts';
import { addLog, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { ItemDef, World } from './world.ts';

// Equipping takes an hour.
export const EQUIP_HOURS = 1;

// The equipment `a` holds.
export function equipmentOf(state: State, world: World, a: Actor): ItemDef[] {
  return itemsOf(state, world, a.id).filter((x) => !!x.equip);
}

// Whom `a` could put `item` on now: themselves and their retainers standing with them.
export function equipTargets(state: State, a: Actor) {
  return [a, ...Object.values(state.actors).filter((x) => x.master === a.id && !x.dead && together(x, a))];
}

export function equipBlocked(state: State, world: World, a: Actor, itemId: string | undefined, toId: string | undefined, t: number): string | null {
  const x = itemId ? itemDef(world, itemId) : undefined;
  if (!x?.equip) return '맬 수 있는 것이 아니다.';
  if (state.items?.[x.id]?.owner !== a.id) return `${josa(x.name, '은', '는')} 내 것이 아니다.`;
  const to = state.actors[toId ?? a.id];
  if (!to || to.dead) return '그런 이는 없다.';
  if (to.id !== a.id && to.master !== a.id) return `${josa(shortName(to.name), '은', '는')} 나를 섬기지 않는다.`;
  if (!together(to, a)) return `${josa(shortName(to.name), '은', '는')} 곁에 없다.`;
  if (state.items?.[x.id]?.bearer === to.id) return `${josa(x.name, '은', '는')} 이미 ${to.id === a.id ? '내 몸에' : `${shortName(to.name)}에게`} 매여 있다.`;
  if (!planPayment(manaAvailable(state, world, a, t), x.equip.cost)) return `마나가 모자라다 (${x.equip.costText}, 지금 ${formatMana(manaAvailable(state, world, a, t))}).`;
  return null;
}

// `a` pays and puts it on `toId` (themselves if none); it comes off whoever had it.
export function equipItem(state: State, world: World, a: Actor, itemId: string, toId: string | undefined, t: number) {
  const why = equipBlocked(state, world, a, itemId, toId, t);
  const x = itemDef(world, itemId);
  if (why || !x?.equip) {
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} 매지 못했다: ${why}`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const to = state.actors[toId ?? a.id];
  payMana(state, world, a, x.equip.cost, t);
  unequip(state, x.id);
  const added = x.equip.abilities.filter((ab) => !to.abilities.includes(ab));
  to.abilities = [...to.abilities, ...added];
  Object.assign(state.items![x.id], { bearer: to.id, ...(added.length ? { added } : {}) });
  addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} ${josa(x.name, '을', '를')} ${to.id === a.id ? '몸에' : `${shortName(to.name)}에게`} 맸다.`, regions: [a.region], actors: [a.id, to.id], t });
}

// Each hour: equipment whose bearer is gone, or no longer serves its owner, comes off.
export function syncEquipment(state: State, world: World) {
  for (const x of world.items) {
    const s = state.items?.[x.id];
    if (!s?.bearer) continue;
    const b = state.actors[s.bearer];
    if (s.gone || !s.owner || !b || b.dead || (b.id !== s.owner && b.master !== s.owner)) unequip(state, x.id);
  }
}

// The equipment `a` bears that lures what they fall on (Grappling Hook).
export function hooks(state: State, world: World, a: Actor) {
  return world.items.find((x) => x.equip?.lure && state.items?.[x.id]?.bearer === a.id);
}
