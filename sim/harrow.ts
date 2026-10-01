// Harrow: "As an additional cost to cast this spell, sacrifice a land. Search your library for up
// to two basic land cards, put them onto the battlefield." Cast, the caster gives up one of the
// lands they hold (the bond broken, to be made again, as Khalni Gem's), then bonds from afar with
// up to that many basic lands of the world they don't hold yet (user decision 2026-10-01), as a
// fetch does: not their land for the day, untapped (their mana today), each a landfall. One pick
// at a time: the land to give up (one must), then each land sought (they may stop). An NPC's are
// the LLM's (sim/run.ts), the player's picks they owe (sim/asks.ts).
import { gameDay } from './clock.ts';
import { bondLand } from './abilities.ts';
import { addLog } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import { landTypes, placeName, region } from './world.ts';
import type { World } from './world.ts';

export type HarrowEffect = { type: 'harrow'; spell: string; left: number; given: boolean };

// Basic lands `a` could seek out: a basic land type (no named land card), not theirs yet, not
// destroyed, not barred to them.
export function harrowTargets(state: State, world: World, a: Actor) {
  return world.regions.filter((r) => !r.oneLandWith && landTypes(r).length > 0 && !a.bonds?.includes(r.id) && !a.exiledLands?.includes(r.id) && !state.regions[r.id]?.destroyed);
}

// The lands `a` could give up: those they hold.
export function harrowGive(world: World, a: Actor) {
  return (a.bonds ?? []).filter((id) => world.regions.some((r) => r.id === id));
}

export function harrowOptions(state: State, world: World, a: Actor, eff: HarrowEffect) {
  return eff.given
    ? harrowTargets(state, world, a).map((r) => ({ id: r.id, label: `${placeName(world, r)} (기본 땅)` }))
    : harrowGive(world, a).map((id) => ({ id, label: `${placeName(world, region(world, id))} (내어 줄 땅)` }));
}

// What `a` has to pick next, or null.
export function harrowOwed(state: State, world: World, a: Actor, eff: HarrowEffect, t: number): Choice | null {
  if (eff.given && eff.left <= 0) return null;
  const options = harrowOptions(state, world, a, eff);
  if (!options.length) return null;
  return { by: a.id, land: a.region, effect: eff, candidates: options.map((o) => o.id), optional: eff.given, t };
}

// The pick lands (an answer that isn't one: the first land to give up, or none sought). Returns
// what comes next, if anything.
export function applyHarrow(state: State, world: World, a: Actor, eff: HarrowEffect, pick: string | null, t: number): Choice | null {
  const options = harrowOptions(state, world, a, eff);
  const id = pick && options.some((o) => o.id === pick) ? pick : eff.given ? undefined : options[0]?.id;
  if (!id) return null;
  if (!eff.given) {
    a.bonds = (a.bonds ?? []).filter((b) => b !== id);
    addLog(state, { kind: 'status', text: `${eff.spell}: ${josa(shortName(a.name), '이', '가')} ${josa(region(world, id).name, '과', '와')}의 유대를 내어 주었다. 땅이 갈아엎어진다.`, regions: [a.region, id], actors: [a.id], t });
    return harrowOwed(state, world, a, { ...eff, given: true }, t);
  }
  addLog(state, { kind: 'status', text: `${eff.spell}: ${josa(shortName(a.name), '이', '가')} 다시 그려진 땅을 따라 ${toward(region(world, id).name)} 이어졌다.`, regions: [a.region, id], actors: [a.id], t });
  a.fetched = [...(a.fetched ?? []), id];
  a.searched = gameDay(t);
  bondLand(state, world, a, t, id);
  return harrowOwed(state, world, a, { ...eff, left: eff.left - 1 }, t);
}
