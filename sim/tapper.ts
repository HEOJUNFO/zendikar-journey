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
import { gameDay, untapTime } from './clock.ts';
import { down } from './combat.ts';
import { owesDiscard } from './discard.ts';
import { drawKnowledge } from './knowledge.ts';
import { creatureColors } from './mana.ts';
import { retainersOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, outOfTime, targetable, together, untargetableText } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { NpcDef, World } from './world.ts';

export type TapPower = 'shield' | 'loot';
export const TAP_POWERS: TapPower[] = ['shield', 'loot'];

// Hours it takes.
export const TAP_HOURS = 1;

// How much of the power `def` has (0: none).
function powerOf(def: NpcDef | undefined, power: TapPower) {
  return (power === 'shield' ? def?.tapShield : def?.tapLoot ? 1 : 0) ?? 0;
}

const NONE: Record<TapPower, string> = { shield: '가호를 걸 영혼이 없다.', loot: '부릴 학자가 없다.' };

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
  const w = readyTapper(state, world, a, power, t, here ? b : undefined) ?? readyTapper(state, world, a, power, t);
  if (!w) return `${josa(shortName(theirs[0].name), '은', '는')} 지금 쓸 수 없다 (이미 묶였거나 힘이 봉인됨).`;
  if (outOfTime(state, b, t)) return `${josa(shortName(b.name), '은', '는')} 시간 밖에 있다. 닿지 않는다.`;
  const colors = creatureColors(npcDef(state, world, w.id));
  if (!targetable(b, t, colors)) return untargetableText(b, t, colors);
  if (here && w.id !== b.id && !together(w, b)) return `${josa(shortName(b.name), '은', '는')} ${shortName(w.name)}의 곁에 없다.`;
  return null;
}

// How much one of theirs would give (for the player's and the plan's text).
export function tapAmount(state: State, world: World, w: Actor, power: TapPower) {
  return powerOf(npcDef(state, world, w.id), power);
}

// The power: the creature is tapped, and it falls on `whoId` (themselves if none).
export function useTap(state: State, world: World, a: Actor, power: TapPower, whoId: string | undefined, t: number) {
  const b = state.actors[whoId ?? a.id];
  const w = b && readyTapper(state, world, a, power, t, b);
  if (!b || !w || !tapTargetable(state, world, w, b, t)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 힘을 쓸 이가 곁에 없어 그만두었다.`, regions: [a.region], actors: [a.id] });
    return;
  }
  w.boundUntil = untapTime(t);
  const [x, y] = [shortName(w.name), shortName(b.name)];
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
