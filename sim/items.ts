// Items (MTG artifacts, world/entities/items): permanents that stand in one place. Whoever
// pays an item's cost there tames it and holds it until they die or leave the plane.
import { gameDay, untapTime } from './clock.ts';
import { placeTile, sameTile, tileLabel } from './tiles.ts';
import { gainLife, lifeOf } from './life.ts';
import { formatMana, manaAvailable, payMana, planPayment } from './mana.ts';
import { addLog, npcDef, ptOf } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import type { Tile } from './tiles.ts';
import { josa, shortName } from './text.ts';
import { canStay, placeName, region } from './world.ts';
import type { ItemDef, World } from './world.ts';

// Taming an item takes an hour, as casting a spell does.
export const CLAIM_HOURS = 1;

export function itemDef(world: World, id: string) {
  return world.items.find((x) => x.id === id);
}

// Where an item is now: where it stands (or lies, dropped), or with its owner if they carry it
// (equipment). Undefined once gone.
export function itemWhere(state: State, world: World, x: ItemDef): { region: string; tile?: Tile; carried?: string } | undefined {
  const s = state.items?.[x.id];
  if (s?.gone) return undefined;
  const owner = s?.owner ? state.actors[s.owner] : undefined;
  if (x.equip && owner && !owner.dead) return { region: owner.region, tile: owner.tile, carried: owner.id };
  if (s?.lies) return { region: s.lies.region, tile: s.lies.tile };
  return { region: x.at, tile: itemTile(world, x) };
}

// Items standing (or lying) in a land, not carried by anyone.
export function itemsAt(state: State, world: World, regionId: string) {
  return world.items.filter((x) => {
    const w = itemWhere(state, world, x);
    return w && !w.carried && w.region === regionId;
  });
}

// The tile of its land an item stands on: always the same one (sim/tiles.ts).
export function itemTile(world: World, x: ItemDef) {
  return placeTile(world, x.at, x.id, x.pos);
}

export function itemOwner(state: State, itemId: string) {
  return state.items?.[itemId]?.owner;
}

export function itemsOf(state: State, world: World, actorId: string) {
  return world.items.filter((x) => itemOwner(state, x.id) === actorId);
}

export function claimBlocked(state: State, world: World, a: Actor, itemId: string, t: number): string | null {
  const x = itemDef(world, itemId);
  if (!x || state.items?.[x.id]?.gone) return '그런 것은 없다.';
  const owner = itemOwner(state, x.id);
  if (owner === a.id) return `이미 ${josa(x.name, '을', '를')} 길들였다.`;
  if (owner) return `${josa(x.name, '은', '는')} 이미 ${shortName(state.actors[owner]?.name ?? owner)}의 것이다.`;
  const w = itemWhere(state, world, x)!;
  if (a.region !== w.region) return `${josa(x.name, '은', '는')} ${placeName(world, region(world, w.region))}에 있다.`;
  if (w.tile && !sameTile(a.tile, w.tile)) return `${josa(x.name, '은', '는')} ${tileLabel(world, w.region, w.tile)}에 ${s_lies(state, x.id) ? '떨어져 있다' : '서 있다'}.`;
  if (!planPayment(manaAvailable(state, world, a, t), x.cost))
    return `마나가 모자라다 (${x.costText}, 지금 ${formatMana(manaAvailable(state, world, a, t))}).`;
  return null;
}

function s_lies(state: State, id: string) {
  return !!state.items?.[id]?.lies;
}

// Items an NPC could set out to tame today: no one holds them, they can stand where the item
// is, and their mana pays for it.
export function claimableItems(state: State, world: World, a: Actor, t: number) {
  const def = npcDef(state, world, a.id);
  if (!def || def.beast) return [];
  return world.items.filter(
    (x) => !itemOwner(state, x.id) && !!itemWhere(state, world, x) && canStay(region(world, itemWhere(state, world, x)!.region), def.abilities) && planPayment(manaAvailable(state, world, a, t), x.cost),
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
  takeItem(state, world, a, x, t, '길들였다');
}

// The item becomes `a`'s, as it enters under their control (tamed, or had otherwise: Archmage
// Ascension). `how`: what the log says they did.
export function takeItem(state: State, world: World, a: Actor, x: ItemDef, t: number, how: string) {
  const counters = x.effects.some((e) => e.type === 'charge_life') ? lifeOf(a) : 0;
  // When it was taken: what comes to serve them after counts (Electropotence).
  const since = x.effects.some((e) => e.type === 'enter_strike') ? { since: t } : {};
  (state.items ??= {})[x.id] = { name: x.name, owner: a.id, counters, ...since, ...(x.equip ? { carried: true } : {}) };
  // "An artifact entered the battlefield under their control this turn" (Baloth Cage Trap).
  a.claimed = gameDay(t);
  addLog(state, {
    kind: 'event',
    text: `${josa(shortName(a.name), '이', '가')} ${josa(x.name, '을', '를')} ${how}.${counters ? ` 그릇에 생명 ${counters}이 담겼다.` : ''}`,
    regions: [a.region],
    actors: [a.id],
    t,
  });
  // "When this enters, return N lands you control to their owner's hand" (Khalni Gem).
  for (const e of x.effects) {
    if (e.type !== 'return_lands') continue;
    const owed = returnLandsOwed(state, world, a, x.id, e.count, t);
    if (owed) (a.kind === 'player' ? (state.asks ??= []) : (state.choices ??= [])).push(owed);
  }
}

// Lands `a` still owes back to the item: with no more bonds than that, all of them go at once;
// else the pick they owe (the player at once, an NPC by the LLM after the hour), one at a time.
export function returnLandsOwed(state: State, world: World, a: Actor, itemId: string, left: number, t: number): Choice | undefined {
  const bonds = a.bonds ?? [];
  if (left <= 0 || !bonds.length) return undefined;
  if (bonds.length <= left) {
    for (const id of [...bonds]) returnLand(state, world, a, id, itemId, t);
    return undefined;
  }
  return { by: a.id, land: a.region, effect: { type: 'return_lands', item: itemId, left }, candidates: [...bonds], t };
}

// The pick lands: that bond (or, an answer that isn't one of theirs, the first) breaks. The
// next pick owed, if any.
export function answerReturnLand(state: State, world: World, a: Actor, pick: string | null, eff: { item: string; left: number }, t: number) {
  const bonds = a.bonds ?? [];
  const id = pick && bonds.includes(pick) ? pick : bonds[0];
  if (!id) return undefined;
  returnLand(state, world, a, id, eff.item, t);
  return returnLandsOwed(state, world, a, eff.item, eff.left - 1, t);
}

// "Return to hand": the bond breaks; they may bond with it again (one land a day).
function returnLand(state: State, world: World, a: Actor, landId: string, itemId: string, t: number) {
  a.bonds = (a.bonds ?? []).filter((b) => b !== landId);
  const name = itemDef(world, itemId)?.name ?? itemId;
  addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '이', '가')} ${region(world, landId).name}과의 유대를 ${name}에 내어 주었다 (다시 맺을 수 있다).`, regions: [a.region], actors: [a.id], t });
}

// Landfall for the items `a` holds: "you may have your life total become the number of charge
// counters". Only when that raises it (no one chooses to lose life).
export function itemsOnLandfall(state: State, world: World, a: Actor, t: number) {
  for (const x of itemsOf(state, world, a.id)) {
    // "You may put a quest counter on this" (Ior Ruin Expedition): always, it only helps.
    if (x.effects.some((e) => e.type === 'landfall_quest')) {
      const s = state.items![x.id];
      s.counters = (s.counters ?? 0) + 1;
      addLog(state, { kind: 'effect', text: `${x.name}: ${josa(shortName(a.name), '이', '가')} 새 땅을 밟아 탐색 카운터가 하나 쌓였다 (${s.counters}).`, regions: [a.region], actors: [a.id], t });
    }
    // "Landfall — equipped creature gets +P/+T until end of turn" (Adventuring Gear): its bearer.
    const bearer = x.equip?.landfallPump && state.items![x.id].bearer ? state.actors[state.items![x.id].bearer!] : undefined;
    if (bearer && !bearer.dead) {
      const pt = x.equip!.landfallPump!;
      bearer.pumps = [...(bearer.pumps ?? []), { pt: [pt[0], pt[1]], until: untapTime(t) }];
      addLog(state, { kind: 'effect', text: `${x.name}: 새 땅의 기운에 ${josa(shortName(bearer.name), '이', '가')} 자정까지 +${pt[0]}/+${pt[1]} (${ptOf(bearer).join('/')}).`, regions: [bearer.region], actors: [bearer.id, a.id], t });
    }
    if (!x.effects.some((e) => e.type === 'landfall_set_life')) continue;
    const life = lifeOf(a);
    const counters = state.items![x.id].counters;
    if (counters <= life) continue;
    gainLife(state, a, counters - life, t, x.name);
  }
}

// Their items stand unheld again (they died or left the plane).
// What they carried falls where they were.
export function releaseItems(state: State, a: Actor, t: number) {
  for (const [id, x] of Object.entries(state.items ?? {})) {
    if (x.owner !== a.id) continue;
    unequip(state, id);
    state.items![id] = { name: x.name, counters: 0, ...(x.carried ? { lies: { region: a.region, ...(a.tile ? { tile: a.tile } : {}) } } : {}) };
    addLog(state, { kind: 'status', text: `${josa(x.name, '은', '는')} ${x.carried ? '그 자리에 떨어져 ' : ''}다시 주인 없는 것이 되었다.`, regions: [a.region], actors: [a.id], t });
  }
}

// Equipment comes off its bearer (sim/equipment.ts): what it gave them goes with it.
export function unequip(state: State, id: string) {
  const s = state.items?.[id];
  if (!s?.bearer) return;
  const b = state.actors[s.bearer];
  if (b && s.added?.length) b.abilities = b.abilities.filter((x) => !s.added!.includes(x));
  delete s.bearer;
  delete s.added;
}
