// "Whenever a creature enters the battlefield under your control, you may pay {2}{R}. If you do,
// that creature deals damage equal to its power to any target" (Electropotence, an enchantment
// standing on the Crown of Talib, an item: `enter_strike`). A creature entering under one's
// control is one coming to serve them (user decision 2026-10-01, as Whiplash Trap counts it): one
// who joins (hired, won over, acknowledged, answering a call), or is born or raised theirs. The
// hour after, its owner may pay to have it strike one standing with it (an NPC by the LLM, the
// player as a pick they owe), or no one. As a fight: to the death only if the player is in it
// (the owner, the creature or the one struck); between NPCs, a knockout (user decision 2026-10-01).
import { dealDamage } from './combat.ts';
import { creatureColors, manaAvailable, parseManaCost, payMana, planPayment } from './mana.ts';
import { retainersOf } from './retainers.ts';
import { addLog, npcDef, present, protectedFrom, ptOf, targetable, together } from './state.ts';
import { actorColors, COLOR_LABELS } from './mana.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

function strikeOf(world: World, itemId: string) {
  const e = world.items.find((x) => x.id === itemId)?.effects.find((x) => x.type === 'enter_strike');
  return e?.type === 'enter_strike' ? { cost: parseManaCost(e.cost)!, costText: e.cost } : undefined;
}

// Whom `x` could strike where it stands.
export function strikeTargets(state: State, world: World, x: Actor, t: number) {
  const own = creatureColors(npcDef(state, world, x.id));
  return present(state, x.region, x.tile).filter((y) => y.id !== x.id && !y.dead && targetable(y, t, own));
}

// Each hour: those come to serve an owner of such an item since they took it, not yet seen to.
export function electroHour(state: State, world: World, t: number) {
  for (const x of world.items) {
    const strike = strikeOf(world, x.id);
    const s = state.items?.[x.id];
    const owner = s?.owner ? state.actors[s.owner] : undefined;
    if (!strike || !s || s.gone || !owner || owner.dead) continue;
    for (const r of retainersOf(state, owner.id)) {
      const entered = Math.max(r.joinedAt ?? -1, r.enteredAt ?? -1);
      if (entered < (s.since ?? 0) || s.struck?.includes(r.id)) continue;
      s.struck = [...(s.struck ?? []), r.id];
      if (!planPayment(manaAvailable(state, world, owner, t), strike.cost)) continue;
      const targets = strikeTargets(state, world, r, t);
      if (targets.length) (state.choices ??= []).push({ by: owner.id, land: r.region, effect: { type: 'strike', item: x.id, creature: r.id }, candidates: targets.map((y) => y.id), optional: true, t });
    }
  }
}

// The owner's answer: `pick`, or no one.
export function applyStrike(state: State, world: World, owner: Actor, eff: { item: string; creature: string }, pick: string | null, t: number) {
  const strike = strikeOf(world, eff.item);
  const c = state.actors[eff.creature];
  const target = pick ? state.actors[pick] : undefined;
  if (!strike || !c || c.dead || !target || target.dead || !together(c, target) || !targetable(target, t, creatureColors(npcDef(state, world, c.id)))) return false;
  if (!planPayment(manaAvailable(state, world, owner, t), strike.cost)) {
    addLog(state, { kind: 'status', text: `${josa(shortName(owner.name), '은', '는')} 힘(${strike.costText})이 모자라 번개를 부르지 못했다.`, regions: [owner.region], actors: [owner.id], t });
    return false;
  }
  payMana(state, world, owner, strike.cost, t);
  const name = state.items?.[eff.item]?.name ?? eff.item;
  addLog(state, { kind: 'event', text: `${name}: ${shortName(owner.name)}이(가) 힘(${strike.costText})을 들이자 ${josa(shortName(c.name), '이', '가')} 붉은 번개를 휘감고 ${shortName(target.name)}에게 내리꽂았다.`, regions: [c.region], actors: [owner.id, c.id, target.id], t });
  const color = protectedFrom(target, actorColors(state, world, c), t);
  if (color) {
    addLog(state, { kind: 'combat', text: `${josa(shortName(target.name), '은', '는')} ${COLOR_LABELS[color]}색으로부터 보호받아 다치지 않는다.`, regions: [c.region], actors: [target.id], t });
    return true;
  }
  const n = Math.max(0, ptOf(c)[0]);
  const nonlethal = owner.kind !== 'player' && c.kind !== 'player' && target.kind !== 'player';
  if (n > 0) dealDamage(state, world, target, n, t, `${shortName(c.name)}의 번개`, nonlethal, c, c);
  return true;
}
