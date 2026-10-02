// Spreading Seas (spell effect `flood_land`): "Enchant land. When this Aura enters, draw a card.
// Enchanted land is an Island." In this world (user decision 2026-10-02), after casting, the
// caster picks one of the lands someone on their tile holds (themselves too; none destroyed): the
// sea spreads over it. For everyone bonded with it, it is an Island: blue mana only, an island
// for all that counts lands' kinds (sim/world.ts `landTypes` with the state), and it loses its own
// powers (what bonding with it does, a fetch, Valakut's fire, a tap power, entering tapped). The
// aura is on the land: it is gone when destroyed (Relic Crush there, sim/relics.ts) or when the
// land is (sim/step.ts `destroyLand`). The caster comes to know a secret as it takes hold.
import { drawKnowledge } from './knowledge.ts';
import { addLog, present } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { landIdOf, placeName, region } from './world.ts';
import type { Region, World } from './world.ts';

export type FloodOption = { id: string; label: string };

// Whether the sea has spread over land `r` (a land is one with its other half, `landIdOf`).
export function flooded(state: State, world: World, r: Region) {
  return !!state.regions[landIdOf(world, r.id)]?.flooded;
}

// The lands `a` could flood: held by someone on their tile, standing, not flooded already.
export function floodOptions(state: State, world: World, a: Actor): FloodOption[] {
  const here = present(state, a.region, a.tile);
  const ids = [...new Set(here.flatMap((x) => x.bonds ?? []).map((id) => landIdOf(world, id)))];
  return ids
    .map((id) => world.regions.find((r) => r.id === id))
    .filter((r): r is Region => !!r && !r.notLand && !state.regions[r.id]?.destroyed && !state.regions[r.id]?.flooded)
    .map((r) => ({ id: r.id, label: `${placeName(world, r)} (${here.filter((x) => x.bonds?.some((b) => landIdOf(world, b) === r.id)).map((x) => shortName(x.name)).join('·')}와 이어짐)` }));
}

export function floodOwed(state: State, world: World, a: Actor, spell: string, t: number): Choice | null {
  const options = floodOptions(state, world, a);
  if (!options.length) return null;
  return { by: a.id, land: a.region, effect: { type: 'flood', spell }, candidates: options.map((o) => o.id), t };
}

// The sea spreads over the picked land (if it still can), and the caster learns a secret.
export function applyFlood(state: State, world: World, a: Actor, landId: string, spell: string, t: number) {
  if (!floodOptions(state, world, a).some((o) => o.id === landId)) return false;
  (state.regions[landId] ??= { conditions: [] }).flooded = { by: a.id, spell };
  addLog(state, { kind: 'condition', text: `${spell}: ${josa(shortName(a.name), '이', '가')} 부른 바다가 ${region(world, landId).name}에 번졌다. 이제 그곳은 섬이다 (청 마나만, 제 힘은 잠긴다).`, regions: [landId, a.region], actors: [a.id], t });
  drawKnowledge(state, world, a, 1, t, spell);
  return true;
}
