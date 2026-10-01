// "{2}{U}: Tap target creature without flying" (Merfolk Seastalkers; `sim.tap_foe`): before each
// hour it stands in a fight (a foe of today on its tile), its controller (itself, or its master)
// may pay to bind one of those foes who can't fly, until midnight (tap = bound, untap = 00:00;
// user decision 2026-10-01). Bound, they can't strike back nor move. An NPC's pick is the LLM's
// (sim/run.ts `binds`), the player's a pick they owe (sim/asks.ts).
import { untapTime } from './clock.ts';
import { down, foesOf } from './combat.ts';
import { creatureColors, manaAvailable, payMana, planPayment } from './mana.ts';
import { masterOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, hasAbility, npcDef, targetable, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// Foes of today standing with `a` that it could bind now (none if it can't pay).
export function bindTargets(state: State, world: World, a: Actor, t: number): Actor[] {
  const def = npcDef(state, world, a.id);
  const tap = def?.tapFoe;
  if (!tap || down(a) || powersSealed(state, world, a, t)) return [];
  if (!planPayment(manaAvailable(state, world, a, t), tap.cost)) return [];
  const m = masterOf(state, a);
  const foes = new Set([...foesOf(a, t), ...(m && together(m, a) ? foesOf(m, t) : [])]);
  return [...foes]
    .map((id) => state.actors[id])
    .filter((x) => x && !down(x) && x.boundUntil === undefined && together(a, x) && !(tap.noFly && hasAbility(x, 'fly', t)) && targetable(x, t, creatureColors(def)));
}

// Binders about to fight this hour, with someone to bind.
export function bindsDue(state: State, world: World, t: number) {
  return Object.values(state.actors).filter((a) => bindTargets(state, world, a, t).length > 0);
}

// `a` pays and binds `target` until midnight.
export function applyBind(state: State, world: World, a: Actor, target: Actor, t: number) {
  const tap = npcDef(state, world, a.id)?.tapFoe;
  if (!tap || !bindTargets(state, world, a, t).some((x) => x.id === target.id)) return;
  payMana(state, world, a, tap.cost, t);
  target.boundUntil = untapTime(t);
  target.task = undefined;
  target.forced = undefined;
  addLog(state, {
    kind: 'combat',
    text: `${josa(shortName(a.name), '이', '가')} 힘(${tap.costText})을 들여 ${josa(shortName(target.name), '을', '를')} 물살로 휘감아 묶었다. 자정까지 움직일 수 없다.`,
    regions: [a.region],
    actors: [a.id, target.id],
    t,
  });
}
