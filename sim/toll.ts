// Gatekeeper of Malakir (`sim.enter_sacrifice`): "Kicker {B}. When this enters, if it was kicked,
// target player sacrifices a creature." On its first arrival of the day (sim/abilities.ts
// `onEnter`), if it can pay the kicker from its own mana, its controller (master, or itself) may
// pick one on its tile not of its side, after the hour; it pays, and that one gives up a creature
// they control (themselves too, user decision 2026-10-01, as World Queller's: sim/quell.ts), their
// pick (the player at once, an NPC by the LLM after the hour). What is given dies.
import { creatureColors, manaAvailable, payMana, planPayment } from './mana.ts';
import { permanentsOf, quellGive, quellOwed } from './quell.ts';
import { remember } from './relations.ts';
import { masterOf, retainersOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, present, targetable, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// Whom `a` could make pay now (with its kicker in hand).
export function tollTargets(state: State, world: World, a: Actor, t: number): Actor[] {
  const es = npcDef(state, world, a.id)?.enterSacrifice;
  if (!es || a.dead || powersSealed(state, world, a, t)) return [];
  if (!planPayment(manaAvailable(state, world, a, t), es.kicker)) return [];
  const controller = masterOf(state, a) ?? a;
  const side = new Set([controller.id, a.id, ...retainersOf(state, controller.id).map((r) => r.id)]);
  return present(state, a.region, a.tile).filter((x) => !side.has(x.id) && !x.dead && x.loyalty === undefined && targetable(x, t, creatureColors(npcDef(state, world, a.id))));
}

export function enterSacrifice(state: State, world: World, a: Actor, t: number) {
  const candidates = tollTargets(state, world, a, t).map((x) => x.id);
  if (!candidates.length) return;
  const controller = masterOf(state, a) ?? a;
  (state.choices ??= []).push({ by: controller.id, land: a.region, effect: { type: 'toll', source: a.id }, candidates, optional: true, t });
}

// The pick lands: the kicker paid, the toll asked.
export function applyToll(state: State, world: World, source: Actor, target: Actor, t: number) {
  const es = npcDef(state, world, source.id)?.enterSacrifice;
  if (!es || !together(source, target) || !tollTargets(state, world, source, t).some((x) => x.id === target.id)) return;
  payMana(state, world, source, es.kicker, t);
  addLog(state, { kind: 'event', text: `${josa(shortName(source.name), '이', '가')} 힘(${es.kickerText})을 더 들여 ${shortName(target.name)}에게 통행세를 요구한다: 거느린 생물 하나(제 몸도)를 내놓아야 한다.`, regions: [source.region], actors: [source.id, target.id], t });
  remember(target, source, '나에게 피의 통행세를 받아 냈다', t);
  const owned = permanentsOf(state, world, target, 'creature');
  if (owned.length === 1) quellGive(state, world, target, owned[0].id, source, t);
  else if (owned.length > 1) (target.kind === 'player' ? (state.asks ??= []) : (state.choices ??= [])).push(quellOwed(target, 'creature', source, owned, t));
}
