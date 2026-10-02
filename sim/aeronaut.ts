// Kor Aeronaut (`sim.enter_grant`): "Kicker {1}{W}. When this enters, if it was kicked, target
// creature gains flying until end of turn." On its first arrival of the day (sim/abilities.ts
// `onEnter`), if it can pay the kicker from its own mana (as Torch Slinger's), its controller
// (master, or itself) may pick one on its tile (no planeswalker: no creature) after the hour, and
// it pays as it lifts them: they have the ability until midnight.
import { untapTime } from './clock.ts';
import { grantAbility } from './abilities.ts';
import { creatureColors, manaAvailable, payMana, planPayment } from './mana.ts';
import { masterOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, present, targetable, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { ABILITY_LABELS } from './world.ts';
import type { World } from './world.ts';

// Whom `a` could lift now (with its kicker in hand): anyone on its tile, itself too.
export function liftTargets(state: State, world: World, a: Actor, t: number): Actor[] {
  const eg = npcDef(state, world, a.id)?.enterGrant;
  if (!eg || a.dead || powersSealed(state, world, a, t)) return [];
  if (!planPayment(manaAvailable(state, world, a, t), eg.kicker)) return [];
  return present(state, a.region, a.tile).filter((x) => !x.dead && x.loyalty === undefined && targetable(x, t, creatureColors(npcDef(state, world, a.id))));
}

export function enterGrant(state: State, world: World, a: Actor, t: number) {
  const candidates = liftTargets(state, world, a, t).map((x) => x.id);
  if (!candidates.length) return;
  const controller = masterOf(state, a) ?? a;
  (state.choices ??= []).push({ by: controller.id, land: a.region, effect: { type: 'lift', source: a.id }, candidates, optional: true, t });
}

// The pick lands: the kicker paid, the one picked given the ability (if they are still there).
export function applyLift(state: State, world: World, source: Actor, target: Actor, t: number) {
  const eg = npcDef(state, world, source.id)?.enterGrant;
  if (!eg || !together(source, target) || !liftTargets(state, world, source, t).some((x) => x.id === target.id)) return;
  payMana(state, world, source, eg.kicker, t);
  addLog(state, { kind: 'event', text: `${josa(shortName(source.name), '이', '가')} 힘(${eg.kickerText})을 더 들여 ${shortName(target.name)}에게 갈고리 밧줄을 걸어 함께 하늘로 끌어올린다 (${ABILITY_LABELS[eg.ability]}).`, regions: [source.region], actors: [source.id, target.id], t });
  grantAbility(state, target, eg.ability, untapTime(t), shortName(source.name), t);
}
