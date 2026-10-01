// "Search target player's library for up to three cards, exile them" (Sadistic Sacrament; kicked,
// fifteen). A library is the spells one could still learn (user decision 2026-10-01): those the
// world teaches that they hold not, nor have forgotten, nor lost for good. After casting, the
// caster picks them one at a time (they may stop): an NPC's by the LLM (sim/run.ts), the player's a
// pick they owe (sim/asks.ts). Exiled, the target may never learn it (`Actor.exiled`). With no
// player in it, a step lighter (user decision 2026-10-01, as every exile): it goes to their
// graveyard, as one forgotten, to be learned again.
import { addLog, PLAYER_ID } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

export type SacramentEffect = { type: 'sacrament'; spell: string; target: string; left: number };

// The spells `a` could still learn.
export function libraryOf(world: World, a: Actor) {
  return world.spells.filter((s) => !a.spells?.includes(s.id) && !a.graveyard?.includes(s.id) && !a.exiled?.includes(s.id));
}

// What the caster has to pick next, or null.
export function sacramentOwed(state: State, world: World, caster: Actor, eff: SacramentEffect, t: number): Choice | null {
  const target = state.actors[eff.target];
  if (eff.left <= 0 || !target || target.dead) return null;
  const lib = libraryOf(world, target);
  if (!lib.length) return null;
  return { by: caster.id, land: caster.region, effect: eff, candidates: lib.map((s) => s.id), optional: true, t };
}

// The pick lands (none: they stop). Returns what comes next, if anything.
export function applySacrament(state: State, world: World, caster: Actor, eff: SacramentEffect, pick: string | null, t: number): Choice | null {
  const target = state.actors[eff.target];
  if (!pick || !target || target.dead || !libraryOf(world, target).some((s) => s.id === pick)) return null;
  const name = world.spells.find((s) => s.id === pick)?.name ?? pick;
  const [x, y] = [shortName(caster.name), shortName(target.name)];
  if (caster.id === PLAYER_ID || target.id === PLAYER_ID) {
    target.exiled = [...(target.exiled ?? []), pick];
    addLog(state, { kind: 'effect', text: `${eff.spell}: ${josa(x, '이', '가')} ${y}의 앞날에서 ${josa(name, '을', '를')} 도려냈다. ${josa(y, '은', '는')} 그것을 영영 익힐 수 없다.`, regions: [target.region], actors: [caster.id, target.id], t });
  } else {
    target.graveyard = [...(target.graveyard ?? []), pick];
    addLog(state, { kind: 'effect', text: `${eff.spell}: ${josa(x, '이', '가')} ${y}의 앞날에서 ${josa(name, '을', '를')} 도려내려 했지만, 그것은 잊힌 것으로 남았다 (다시 익힐 수 있다).`, regions: [target.region], actors: [caster.id, target.id], t });
  }
  return sacramentOwed(state, world, caster, { ...eff, left: eff.left - 1 }, t);
}
