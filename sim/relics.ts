// Artifacts and enchantments to destroy (Relic Crush): the items standing in a place (MTG
// artifacts, and enchantments that are no aura: `card_type`), and the auras on those there
// (enchantments on someone). The caster picks, one at a time: an
// NPC by the LLM (`llm.pick`), the player as a pick they owe (sim/asks.ts); the first must be
// picked, the rest may be let be ("up to one other").
import { itemWhere, unequip } from './items.ts';
import { addLog, npcDef, present, together } from './state.ts';
import { manaAvailable, payMana, planPayment } from './mana.ts';
import { powersSealed } from './seal.ts';
import { sameTile } from './tiles.ts';
import type { Tile } from './tiles.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { destroyLand } from './step.ts';
import { landIdOf, placeName, region } from './world.ts';
import type { World } from './world.ts';

export type Relic = { id: string; label: string };

// What stands to be destroyed on `tile` of `regionId`: items standing there, auras on those there.
export function relicsHere(state: State, world: World, regionId: string, tile: Tile | undefined): Relic[] {
  // Carried ones (equipment) too, with whoever carries them there.
  const items = world.items
    .filter((x) => {
      const w = itemWhere(state, world, x);
      return !!w && w.region === regionId && sameTile(w.tile, tile);
    })
    .map((x) => {
      const owner = state.items?.[x.id]?.owner;
      const kind = x.cardType === 'enchantment' ? '부여마법' : '마법물체';
      return { id: `item:${x.id}`, label: `${x.name} (${kind}${owner ? `, ${shortName(state.actors[owner]?.name ?? owner)}의 것` : ''})` };
    });
  const auras = present(state, regionId, tile).flatMap((a) => (a.auras ?? []).map((au, i) => ({ id: `aura:${a.id}:${i}:${au.spell}`, label: `${shortName(a.name)}에게 걸린 ${au.name}` })));
  // An aura on the land they stand in (Spreading Seas).
  const land = landIdOf(world, regionId);
  const fl = state.regions[land]?.flooded;
  const seas = fl ? [{ id: `flood:${land}`, label: `${region(world, land).name}에 번진 ${world.spells.find((s) => s.id === fl.spell)?.name ?? fl.spell} (땅의 오라)` }] : [];
  return [...items, ...auras, ...seas];
}

// Destroys it, if it is still there. Returns whether it did.
export function crushRelic(state: State, world: World, relicId: string, by: Actor, t: number) {
  const [kind, ...rest] = relicId.split(':');
  if (kind === 'flood') {
    const rs = state.regions[rest[0]];
    if (!rs?.flooded || landIdOf(world, by.region) !== rest[0]) return false;
    delete rs.flooded;
    addLog(state, { kind: 'condition', text: `${region(world, rest[0]).name}에 번졌던 바다가 물러갔다 (${shortName(by.name)}의 손에). 땅이 제 모습을 되찾는다.`, regions: [rest[0]], actors: [by.id], t });
    return true;
  }
  if (kind === 'item') {
    const def = world.items.find((x) => x.id === rest[0]);
    const s = state.items?.[rest[0]];
    const w = def && itemWhere(state, world, def);
    if (!def || !w || w.region !== by.region || !sameTile(w.tile, by.tile)) return false;
    unequip(state, def.id);
    (state.items ??= {})[def.id] = { name: def.name, counters: 0, ...s, owner: undefined, gone: true };
    addLog(state, { kind: 'event', text: `${region(world, w.region).name}의 ${josa(def.name, '이', '가')} 산산이 부서졌다 (${shortName(by.name)}의 손에).`, regions: [def.at], actors: [by.id, ...(s?.owner ? [s.owner] : [])], t });
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

// "Destroy target artifact or land" (Demolish): after casting, the caster picks one of the
// artifacts standing on their tile (items that are no enchantment), the land they stand in, or
// a land someone on their tile has bonded with (none destroyed already). One must be picked.
export function demolishOptions(state: State, world: World, a: Actor): Relic[] {
  const artifacts = relicsHere(state, world, a.region, a.tile).filter((r) => r.id.startsWith('item:') && world.items.find((x) => `item:${x.id}` === r.id)?.cardType !== 'enchantment');
  const ids = [a.region, ...present(state, a.region, a.tile).flatMap((x) => x.bonds ?? [])];
  const lands = [...new Set(ids)]
    .map((id) => world.regions.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r && !r.notLand && !state.regions[r.id]?.destroyed)
    .map((r) => {
      const holders = present(state, a.region, a.tile).filter((x) => x.bonds?.includes(r.id)).map((x) => shortName(x.name));
      return { id: `land:${r.id}`, label: `${placeName(world, r)} (땅${r.id === a.region ? ', 지금 선 곳' : ''}${holders.length ? `, ${holders.join('·')}와 이어짐` : ''})` };
    });
  return [...artifacts, ...lands];
}

export function demolishOwed(state: State, world: World, a: Actor, spell: string, t: number): Choice | null {
  const options = demolishOptions(state, world, a);
  if (!options.length) return null;
  return { by: a.id, land: a.region, effect: { type: 'demolish', spell }, candidates: options.map((o) => o.id), t };
}

// Destroys the picked one, if it is still to be had.
export function demolish(state: State, world: World, a: Actor, pick: string, spell: string, t: number) {
  if (!demolishOptions(state, world, a).some((o) => o.id === pick)) return false;
  if (pick.startsWith('item:')) return crushRelic(state, world, pick, a, t);
  return destroyLand(state, world, pick.slice('land:'.length), [a.id], t, spell);
}

// "Kicker …. When this enters, if it was kicked, destroy target noncreature permanent" (Mold
// Shambler, `sim.enter_shatter`): on its first arrival of the day, if it can pay the kicker from
// its own mana, it may pick (the LLM, as it, after the hour) one of the noncreature permanents on
// its tile: the items standing there, the auras on those there, the land it stands in, or a land
// someone there holds. It pays as it destroys. "Destroy target nonbasic land" (Goblin
// Ruinblaster, `nonbasic`): of those, only the lands of a land card of their own. "Destroy target
// artifact or enchantment" (Kor Sanctifiers, `relics`): no land.
export function shatterOptions(state: State, world: World, a: Actor): Relic[] {
  const sh = npcDef(state, world, a.id)?.enterShatter;
  if (sh?.relics) return relicsHere(state, world, a.region, a.tile);
  const nonbasic = !!sh?.nonbasic;
  const lands = demolishOptions(state, world, a).filter((o) => o.id.startsWith('land:') && (!nonbasic || world.regions.find((r) => `land:${r.id}` === o.id)?.nonbasic));
  return nonbasic ? lands : [...relicsHere(state, world, a.region, a.tile), ...lands];
}

export function enterShatter(state: State, world: World, a: Actor, t: number) {
  const sh = npcDef(state, world, a.id)?.enterShatter;
  if (!sh || a.dead || powersSealed(state, world, a, t)) return;
  if (sh.kicker && !planPayment(manaAvailable(state, world, a, t), sh.kicker)) return;
  const options = shatterOptions(state, world, a);
  if (options.length) (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'shatter' }, candidates: options.map((o) => o.id), optional: true, t });
}

// Its pick lands: the kicker paid, the permanent destroyed (if still there).
export function applyShatter(state: State, world: World, a: Actor, pick: string, t: number) {
  const sh = npcDef(state, world, a.id)?.enterShatter;
  if (!sh || a.dead || !shatterOptions(state, world, a).some((o) => o.id === pick)) return false;
  if (sh.kicker) {
    if (!planPayment(manaAvailable(state, world, a, t), sh.kicker)) {
      addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '은', '는')} 힘(${sh.kickerText})이 모자라 아무것도 무너뜨리지 못했다.`, regions: [a.region], actors: [a.id], t });
      return false;
    }
    payMana(state, world, a, sh.kicker, t);
  }
  addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} 힘(${sh.kickerText ?? ''})을 더 들여 ${sh.nonbasic ? '불붙인 폭탄을 내던진다' : sh.relics ? '정화의 빛을 모은다' : '곰팡이 덮인 몸으로 덮쳐누른다'}.`, regions: [a.region], actors: [a.id], t });
  if (pick.startsWith('land:')) return destroyLand(state, world, pick.slice('land:'.length), [a.id], t, a.name);
  return crushRelic(state, world, pick, a, t);
}
