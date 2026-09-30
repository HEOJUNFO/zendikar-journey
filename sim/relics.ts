// Artifacts and enchantments to destroy (Relic Crush): the items standing in a place (MTG
// artifacts, and enchantments that are no aura: `card_type`), and the auras on those there
// (enchantments on someone). The caster picks, one at a time: an
// NPC by the LLM (`llm.pick`), the player as a pick they owe (sim/asks.ts); the first must be
// picked, the rest may be let be ("up to one other").
import { itemTile } from './items.ts';
import { addLog, present, together } from './state.ts';
import { sameTile } from './tiles.ts';
import type { Tile } from './tiles.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { region } from './world.ts';
import type { World } from './world.ts';

export type Relic = { id: string; label: string };

// What stands to be destroyed on `tile` of `regionId`: items standing there, auras on those there.
export function relicsHere(state: State, world: World, regionId: string, tile: Tile | undefined): Relic[] {
  const items = world.items
    .filter((x) => x.at === regionId && sameTile(itemTile(world, x), tile) && !state.items?.[x.id]?.gone)
    .map((x) => {
      const owner = state.items?.[x.id]?.owner;
      const kind = x.cardType === 'enchantment' ? '부여마법' : '마법물체';
      return { id: `item:${x.id}`, label: `${x.name} (${kind}${owner ? `, ${shortName(state.actors[owner]?.name ?? owner)}의 것` : ''})` };
    });
  const auras = present(state, regionId, tile).flatMap((a) => (a.auras ?? []).map((au, i) => ({ id: `aura:${a.id}:${i}:${au.spell}`, label: `${shortName(a.name)}에게 걸린 ${au.name}` })));
  return [...items, ...auras];
}

// Destroys it, if it is still there. Returns whether it did.
export function crushRelic(state: State, world: World, relicId: string, by: Actor, t: number) {
  const [kind, ...rest] = relicId.split(':');
  if (kind === 'item') {
    const def = world.items.find((x) => x.id === rest[0]);
    const s = state.items?.[rest[0]];
    if (!def || def.at !== by.region || !sameTile(itemTile(world, def), by.tile) || s?.gone) return false;
    (state.items ??= {})[def.id] = { name: def.name, counters: 0, ...s, owner: undefined, gone: true };
    addLog(state, { kind: 'event', text: `${region(world, def.at).name}의 ${josa(def.name, '이', '가')} 산산이 부서졌다 (${shortName(by.name)}의 손에).`, regions: [def.at], actors: [by.id, ...(s?.owner ? [s.owner] : [])], t });
    return true;
  }
  const [actorId, index, spell] = rest;
  const a = state.actors[actorId];
  if (!a || a.dead || !together(a, by)) return false;
  const auras = a.auras ?? [];
  const i = auras[Number(index)]?.spell === spell ? Number(index) : auras.findIndex((x) => x.spell === spell);
  if (i < 0) return false;
  const [gone] = auras.splice(i, 1);
  a.auras = auras;
  // What it gave goes with it.
  if (gone.added?.length) a.abilities = a.abilities.filter((x) => !gone.added!.includes(x));
  addLog(state, { kind: 'effect', text: `${shortName(a.name)}에게 걸린 ${josa(gone.name, '이', '가')} 부서져 흩어졌다.`, regions: [a.region], actors: [a.id, by.id], t });
  return true;
}

// What `a` still has to pick (`left` more; the first must be picked), or null.
export function crushOwed(state: State, world: World, a: Actor, spell: string, left: number, first: boolean, t: number): Choice | null {
  const relics = relicsHere(state, world, a.region, a.tile);
  if (left <= 0 || !relics.length) return null;
  return { by: a.id, land: a.region, effect: { type: 'crush', spell, left, first }, candidates: relics.map((r) => r.id), optional: !first, t };
}
