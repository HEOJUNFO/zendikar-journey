// "{T}: Prevent the next 1 damage that would be dealt to target player or planeswalker this turn"
// (Noble Vestige, `sim.tap_shield`): a power of whoever controls it (its master, or itself serving
// no one), as the Sea Gate Loremaster's (sim/loremaster.ts). "Target player" is one standing on
// its tile (themselves too; user decision 2026-10-01). The spirit is tapped (bound until 00:00),
// and the one warded has the next N damage dealt to them today, from anything (a fight, a spell,
// a trap), prevented (`Actor.shield`, `dealDamage`); life lost is no damage. The player uses it by
// an action, an NPC by a `shield` block in their plan (they go to the one they mean to ward).
import { gameDay, untapTime } from './clock.ts';
import { down } from './combat.ts';
import { retainersOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, outOfTime, targetable, together, untargetableText } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// Hours it takes.
export const SHIELD_HOURS = 1;
const WHITE = ['W' as const];

// The spirits `a` controls: themselves (serving no one) and those who serve them.
export function wardensOf(state: State, world: World, a: Actor) {
  return [...(a.master ? [] : [a]), ...retainersOf(state, a.id)].filter((x) => !x.dead && npcDef(state, world, x.id)?.tapShield);
}

// One of theirs who can be tapped now (untapped, in time, powers not sealed), standing with `b`
// if given.
export function readyWarden(state: State, world: World, a: Actor, t: number, b?: Actor) {
  return wardensOf(state, world, a).find((x) => x.boundUntil === undefined && !outOfTime(state, x, t) && !down(x) && !powersSealed(state, world, x, t) && (!b || x.id === b.id || together(x, b)));
}

// Whom it may ward: anyone (a planeswalker too), not one it can't pick (shroud, protection from
// white).
export function wardable(state: State, b: Actor, t: number) {
  return !b.dead && !outOfTime(state, b, t) && targetable(b, t, WHITE);
}

// Why `a` can't ward `whoId` (themselves if none) now, or null. With `here`, the one warded must
// stand with the spirit already (the player's action); without, they may still go to them (a plan).
export function shieldBlocked(state: State, world: World, a: Actor, whoId: string | undefined, t: number, here = true): string | null {
  const theirs = wardensOf(state, world, a);
  if (!theirs.length) return '가호를 걸 영혼이 없다.';
  const b = state.actors[whoId ?? a.id];
  if (!b || b.dead) return '그런 이는 없다.';
  const w = readyWarden(state, world, a, t, here ? b : undefined) ?? readyWarden(state, world, a, t);
  if (!w) return `${josa(shortName(theirs[0].name), '은', '는')} 지금 쓸 수 없다 (이미 묶였거나 힘이 봉인됨).`;
  if (outOfTime(state, b, t)) return `${josa(shortName(b.name), '은', '는')} 시간 밖에 있다. 닿지 않는다.`;
  if (!targetable(b, t, WHITE)) return untargetableText(b, t, WHITE);
  if (here && w.id !== b.id && !together(w, b)) return `${josa(shortName(b.name), '은', '는')} ${shortName(w.name)}의 곁에 없다.`;
  return null;
}

// The ward: the spirit is tapped, and `whoId` (themselves if none) is shielded today.
export function shield(state: State, world: World, a: Actor, whoId: string | undefined, t: number) {
  const b = state.actors[whoId ?? a.id];
  const w = b && readyWarden(state, world, a, t, b);
  if (!b || !w || !wardable(state, b, t)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 가호를 걸 이가 곁에 없어 그만두었다.`, regions: [a.region], actors: [a.id] });
    return;
  }
  const n = npcDef(state, world, w.id)!.tapShield!;
  w.boundUntil = untapTime(t);
  const day = gameDay(t);
  b.shield = { day, amount: (b.shield?.day === day ? b.shield.amount : 0) + n };
  addLog(state, {
    kind: 'status',
    text: `${josa(shortName(w.name), '이', '가')} 희망의 빛으로 ${josa(shortName(b.name), '을', '를')} 감쌌다. 오늘 받을 다음 피해 ${b.shield.amount}를 막는다. ${josa(shortName(w.name), '은', '는')} 자정까지 묶인다.`,
    regions: [w.region],
    actors: [w.id, b.id, a.id],
    t,
  });
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
