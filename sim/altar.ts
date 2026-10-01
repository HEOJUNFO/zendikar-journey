// Carnage Altar (an item, effect `sacrifice_draw`): "{3}, Sacrifice a creature: Draw a card." Its
// owner, standing before it (on its tile, user decision 2026-10-01), pays the cost and offers one
// who serves them there (not themselves: [가공]); that one dies, into the owner's graveyard, and
// the owner comes to know a secret of the world ("draw", sim/knowledge.ts). The player uses it by
// an action, an NPC by an `altar` block in their plan (they walk to it).
import { die } from './combat.ts';
import { itemWhere } from './items.ts';
import { drawKnowledge } from './knowledge.ts';
import { formatMana, manaAvailable, parseManaCost, payMana, planPayment } from './mana.ts';
import { retainersOf } from './retainers.ts';
import { addLog, outOfTime, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { sameTile } from './tiles.ts';
import { josa, shortName } from './text.ts';
import type { ItemDef, World } from './world.ts';

// Hours it takes.
export const ALTAR_HOURS = 1;

function powerOf(x: ItemDef) {
  for (const e of x.effects) if (e.type === 'sacrifice_draw') return { cost: parseManaCost(e.cost)!, costText: e.cost, draws: e.draws };
  return undefined;
}

// The altar `a` owns, if any.
export function altarOf(state: State, world: World, a: Actor) {
  return world.items.find((x) => powerOf(x) && state.items?.[x.id]?.owner === a.id && !state.items[x.id].gone);
}

// Whether `a` stands before it.
export function atAltar(state: State, world: World, a: Actor, x: ItemDef) {
  const w = itemWhere(state, world, x);
  return !!w && w.region === a.region && sameTile(w.tile, a.tile);
}

// Those of theirs they could offer, there with them.
export function altarVictims(state: State, a: Actor, t: number) {
  return retainersOf(state, a.id).filter((x) => !x.dead && together(x, a) && !outOfTime(state, x, t));
}

// Why `a` can't offer `whoId` now, or null. With `here`, they must stand before it already (the
// player's action); without, they may still walk there (a plan).
export function altarBlocked(state: State, world: World, a: Actor, whoId: string | undefined, t: number, here = true): string | null {
  const x = altarOf(state, world, a);
  if (!x) return '바칠 제단이 없다.';
  if (here && !atAltar(state, world, a, x)) return `${x.name} 앞에 있어야 한다.`;
  const e = powerOf(x)!;
  if (!planPayment(manaAvailable(state, world, a, t), e.cost)) return `마나가 모자라다 (${e.costText}, 지금 ${formatMana(manaAvailable(state, world, a, t))}).`;
  const v = whoId ? state.actors[whoId] : undefined;
  if (!v || v.dead || v.master !== a.id) return '바칠 권속이 없다 (자신은 바치지 않는다).';
  if (here && !together(v, a)) return `${josa(shortName(v.name), '은', '는')} 곁에 없다.`;
  return null;
}

export function sacrificeAtAltar(state: State, world: World, a: Actor, whoId: string | undefined, t: number) {
  const x = altarOf(state, world, a);
  if (!x || altarBlocked(state, world, a, whoId, t)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 제단에 아무것도 바치지 못했다.`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const e = powerOf(x)!;
  const v = state.actors[whoId!];
  payMana(state, world, a, e.cost, t);
  addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} ${x.name}에 ${josa(shortName(v.name), '을', '를')} 바쳤다 (${e.costText}). 핏자국 속에서 무언가가 드러난다.`, regions: [a.region], actors: [a.id, v.id], t });
  die(state, v, t, x.name, a);
  drawKnowledge(state, world, a, e.draws, t, x.name);
}
