// Torch Slinger (`sim.enter_damage`): "Kicker {1}{R}. When this enters, if it was kicked, it deals
// 2 damage to target creature." On its first arrival of the day (sim/abilities.ts `onEnter`), if
// it can pay the kicker from its own mana (as Heartstabber Mosquito's), its controller (master, or
// itself) may pick one on its tile (no planeswalker: no creature) after the hour, and it pays as
// it throws. Damage from a creature: between NPCs a knockout, as a fight (user decision 2026-10-01,
// as Electropotence and a bite); the one struck takes it for a foe.
import { addFoe, dealDamage } from './combat.ts';
import { creatureColors, manaAvailable, payMana, planPayment } from './mana.ts';
import { remember } from './relations.ts';
import { masterOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, PLAYER_ID, present, targetable, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// Whom `a` could throw at now (with its kicker in hand).
export function torchTargets(state: State, world: World, a: Actor, t: number): Actor[] {
  const ed = npcDef(state, world, a.id)?.enterDamage;
  if (!ed || a.dead || powersSealed(state, world, a, t)) return [];
  if (ed.kicker && !planPayment(manaAvailable(state, world, a, t), ed.kicker)) return [];
  return present(state, a.region, a.tile).filter((x) => x.id !== a.id && !x.dead && x.loyalty === undefined && targetable(x, t, creatureColors(npcDef(state, world, a.id))));
}

export function enterDamage(state: State, world: World, a: Actor, t: number) {
  const candidates = torchTargets(state, world, a, t).map((x) => x.id);
  if (!candidates.length) return;
  const controller = masterOf(state, a) ?? a;
  (state.choices ??= []).push({ by: controller.id, land: a.region, effect: { type: 'torch', source: a.id }, candidates, optional: true, t });
}

// The pick lands: the kicker paid, the torch thrown (if they are still there).
export function applyTorch(state: State, world: World, source: Actor, target: Actor, t: number) {
  const ed = npcDef(state, world, source.id)?.enterDamage;
  if (!ed || !together(source, target) || !torchTargets(state, world, source, t).some((x) => x.id === target.id)) return;
  if (ed.kicker) payMana(state, world, source, ed.kicker, t);
  addLog(state, { kind: 'combat', text: `${josa(shortName(source.name), '이', '가')} ${ed.kickerText ? `힘(${ed.kickerText})을 더 들여 ` : ''}타오르는 횃불을 ${shortName(target.name)}에게 내던졌다.`, regions: [source.region], actors: [source.id, target.id], t });
  const nonlethal = source.id !== PLAYER_ID && target.id !== PLAYER_ID && (masterOf(state, source)?.id ?? source.id) !== PLAYER_ID;
  if (!dealDamage(state, world, target, ed.amount, t, `${shortName(source.name)}의 횃불`, nonlethal, source, source) && !target.dead) {
    addFoe(target, source.id, t);
    remember(target, source, '나에게 횃불을 던졌다', t);
  }
}
