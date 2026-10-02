// "{T}: <something> to target player" powers of a creature, used by whoever controls it (its
// master, or itself serving no one), as the Sea Gate Loremaster's (sim/loremaster.ts). "Target
// player" is one standing on its tile (themselves too; user decision 2026-10-01). It is tapped
// (bound until 00:00). The player uses one by an action, an NPC by a block in their plan of the
// same name (they go to the one they mean it for).
// - shield (Noble Vestige, `sim.tap_shield`): "Prevent the next N damage that would be dealt to
//   target player or planeswalker this turn": the next N damage dealt to them today, from
//   anything (a fight, a spell, a trap), is prevented (`Actor.shield`, `dealDamage`); life lost
//   is no damage.
// - loot (Reckless Scholar, `sim.tap_loot`): "Target player draws a card, then discards a card":
//   they come to know a secret of the world, then let go of a spell of theirs, their pick
//   (sim/knowledge.ts, sim/discard.ts; with no spell, nothing goes).
// - scout (Frontier Guide, `sim.tap_search`): "<cost>, {T}: Search your library for a basic land,
//   put it onto the battlefield tapped": no one else, its controller pays and may bond from afar
//   with a basic land of the world they don't hold yet, as Kor Cartographer's (sim/abilities.ts
//   `applySearch`: not their land for the day, no mana today).
import { gameDay, untapTime } from './clock.ts';
import { down } from './combat.ts';
import { owesDiscard } from './discard.ts';
import { drawKnowledge } from './knowledge.ts';
import { creatureColors, manaAvailable, payMana, planPayment } from './mana.ts';
import { grantAbility, searchTargets } from './abilities.ts';
import { retainersOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, outOfTime, targetable, together, untargetableText } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { NpcDef, World } from './world.ts';

export type TapPower = 'shield' | 'loot' | 'scout' | 'gale';
export const TAP_POWERS: TapPower[] = ['shield', 'loot', 'scout', 'gale'];

// Hours it takes.
export const TAP_HOURS = 1;

// How much of the power `def` has (0: none).
function powerOf(def: NpcDef | undefined, power: TapPower) {
  return (power === 'shield' ? def?.tapShield : power === 'loot' ? (def?.tapLoot ? 1 : 0) : power === 'gale' ? (def?.tapGrant ? 1 : 0) : def?.tapSearch ? 1 : 0) ?? 0;
}

const NONE: Record<TapPower, string> = { shield: '가호를 걸 영혼이 없다.', loot: '부릴 학자가 없다.', scout: '부릴 길잡이가 없다.', gale: '돌풍을 부를 이가 없다.' };

// Those with the power `a` controls: themselves (serving no one) and those who serve them.
export function tappersOf(state: State, world: World, a: Actor, power: TapPower) {
  return [...(a.master ? [] : [a]), ...retainersOf(state, a.id)].filter((x) => !x.dead && powerOf(npcDef(state, world, x.id), power) > 0);
}

// One of theirs who can be tapped now (untapped, in time, powers not sealed), standing with `b`
// if given.
export function readyTapper(state: State, world: World, a: Actor, power: TapPower, t: number, b?: Actor) {
  return tappersOf(state, world, a, power).find((x) => x.boundUntil === undefined && !outOfTime(state, x, t) && !down(x) && !powersSealed(state, world, x, t) && (!b || x.id === b.id || together(x, b)));
}

// Whom `w` may pick: anyone (a planeswalker too), not one it can't (shroud, protection from its
// colors).
export function tapTargetable(state: State, world: World, w: Actor, b: Actor, t: number) {
  return !b.dead && !outOfTime(state, b, t) && targetable(b, t, creatureColors(npcDef(state, world, w.id)));
}

// Why `a` can't use `power` on `whoId` (themselves if none) now, or null. With `here`, that one
// must stand with the creature already (the player's action); without, they may still go to them
// (a plan).
export function tapBlocked(state: State, world: World, a: Actor, power: TapPower, whoId: string | undefined, t: number, here = true): string | null {
  const theirs = tappersOf(state, world, a, power);
  if (!theirs.length) return NONE[power];
  const b = state.actors[whoId ?? a.id];
  if (!b || b.dead) return '그런 이는 없다.';
  // The scout's is for its controller alone, and costs mana.
  if (power === 'scout') {
    if (b.id !== a.id) return '길잡이는 조종하는 이에게만 길을 찾아 준다.';
    const w = readyTapper(state, world, a, power, t);
    if (!w) return `${josa(shortName(theirs[0].name), '은', '는')} 지금 쓸 수 없다 (이미 묶였거나 힘이 봉인됨).`;
    const ts = npcDef(state, world, w.id)!.tapSearch!;
    if (!planPayment(manaAvailable(state, world, a, t), ts.cost)) return `마나가 모자라다 (${ts.costText}).`;
    if (!searchTargets(state, world, a, ts.types).length) return '이을 수 있는 기본 땅이 없다.';
    return null;
  }
  const w = readyTapper(state, world, a, power, t, here ? b : undefined) ?? readyTapper(state, world, a, power, t);
  if (!w) return `${josa(shortName(theirs[0].name), '은', '는')} 지금 쓸 수 없다 (이미 묶였거나 힘이 봉인됨).`;
  if (outOfTime(state, b, t)) return `${josa(shortName(b.name), '은', '는')} 시간 밖에 있다. 닿지 않는다.`;
  const colors = creatureColors(npcDef(state, world, w.id));
  if (!targetable(b, t, colors)) return untargetableText(b, t, colors);
  if (here && w.id !== b.id && !together(w, b)) return `${josa(shortName(b.name), '은', '는')} ${shortName(w.name)}의 곁에 없다.`;
  const tg = power === 'gale' ? npcDef(state, world, w.id)?.tapGrant : undefined;
  if (tg && !planPayment(manaAvailable(state, world, a, t), tg.cost)) return `마나가 모자라다 (${tg.costText}).`;
  return null;
}

// How much one of theirs would give (for the player's and the plan's text).
export function tapAmount(state: State, world: World, w: Actor, power: TapPower) {
  return powerOf(npcDef(state, world, w.id), power);
}

// The power: the creature is tapped, and it falls on `whoId` (themselves if none).
export function useTap(state: State, world: World, a: Actor, power: TapPower, whoId: string | undefined, t: number) {
  if (power === 'scout') return scout(state, world, a, t);
  const b = state.actors[whoId ?? a.id];
  const w = b && readyTapper(state, world, a, power, t, b);
  if (!b || !w || !tapTargetable(state, world, w, b, t)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 힘을 쓸 이가 곁에 없어 그만두었다.`, regions: [a.region], actors: [a.id] });
    return;
  }
  w.boundUntil = untapTime(t);
  const [x, y] = [shortName(w.name), shortName(b.name)];
  if (power === 'gale') {
    const tg = npcDef(state, world, w.id)!.tapGrant!;
    if (!payMana(state, world, a, tg.cost, t)) {
      w.boundUntil = undefined;
      return;
    }
    addLog(state, { kind: 'status', text: `${josa(x, '이', '가')} 힘(${tg.costText})을 들여 돌풍을 불러 ${josa(y, '을', '를')} 하늘로 띄운다. ${josa(x, '은', '는')} 자정까지 묶인다.`, regions: [w.region], actors: [w.id, b.id, a.id], t });
    grantAbility(state, b, tg.ability, untapTime(t), x, t);
    return;
  }
  if (power === 'shield') {
    const day = gameDay(t);
    b.shield = { day, amount: (b.shield?.day === day ? b.shield.amount : 0) + tapAmount(state, world, w, power) };
    addLog(state, { kind: 'status', text: `${josa(x, '이', '가')} 희망의 빛으로 ${josa(y, '을', '를')} 감쌌다. 오늘 받을 다음 피해 ${b.shield.amount}를 막는다. ${josa(x, '은', '는')} 자정까지 묶인다.`, regions: [w.region], actors: [w.id, b.id, a.id], t });
    return;
  }
  addLog(state, { kind: 'status', text: `${josa(x, '이', '가')} ${y}${b.id === w.id ? '(자신)' : ''}에게 주워들은 것을 늘어놓는다. 금을 거르려면 모래도 버려야 한다. ${josa(x, '은', '는')} 자정까지 묶인다.`, regions: [w.region], actors: [w.id, b.id, a.id], t });
  drawKnowledge(state, world, b, 1, t, `${x}의 이야기`);
  owesDiscard(state, world, b, `${x}의 이야기`, t);
}

// Frontier Guide: paid and tapped, it shows its controller the ways to the basic lands they don't
// hold yet; which (if any) is theirs to pick (the player now, an NPC by the LLM after the hour).
function scout(state: State, world: World, a: Actor, t: number) {
  const w = readyTapper(state, world, a, 'scout', t);
  if (!w || tapBlocked(state, world, a, 'scout', a.id, t)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 길잡이가 길을 찾지 못했다.`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const ts = npcDef(state, world, w.id)!.tapSearch!;
  payMana(state, world, a, ts.cost, t);
  w.boundUntil = untapTime(t);
  addLog(state, { kind: 'status', text: `${josa(shortName(w.name), '이', '가')} 힘(${ts.costText})을 들여 아무도 찾아보지 않은 길을 더듬는다. ${josa(shortName(w.name), '은', '는')} 자정까지 묶인다.`, regions: [w.region], actors: [w.id, a.id], t });
  const candidates = searchTargets(state, world, a, ts.types).map((r) => r.id);
  const owed: Choice = { by: a.id, land: a.region, effect: { type: 'search', source: w.id }, candidates, optional: true, t };
  (a.kind === 'player' ? (state.asks ??= []) : (state.choices ??= [])).push(owed);
}

// Damage `a` would take, less what their ward prevents today (the ward spent that much).
export function shielded(state: State, a: Actor, amount: number, t: number) {
  const s = a.shield;
  if (!s || s.day !== gameDay(t) || amount <= 0) return amount;
  const n = Math.min(s.amount, amount);
  if (s.amount - n > 0) a.shield = { day: s.day, amount: s.amount - n };
  else delete a.shield;
  addLog(state, { kind: 'combat', text: `가호가 ${shortName(a.name)}에게 닿을 피해 ${n}를 막았다.`, regions: [a.region], actors: [a.id], t });
  return amount - n;
}
