// "{T}: This creature deals damage equal to its power to target creature. That creature deals
// damage equal to its power to this creature" (Predatory Urge's aura, the ability `bite`): a
// power of whoever controls its bearer (their master, or themselves serving no one), as the
// Sea Gate Loremaster's (sim/loremaster.ts). The bearer is tapped (bound until 00:00: they can't
// move or strike back, user decision 2026-10-01), falls on one standing on their tile (anyone
// but a planeswalker; not one they can't pick), and the two deal each other their power at once.
// It is a fight: to the death only if the player is in it, a knockout otherwise; and the one
// bitten takes the biter for a foe that day (user decision 2026-10-01). The player uses it by
// an action, an NPC by a `bite` block in their plan (they go to the one they mean to bite).
import { formatClock, untapTime } from './clock.ts';
import { addFoe, dealDamage, down, foesOf, hurt, lifelink } from './combat.ts';
import { actorColors, COLOR_LABELS } from './mana.ts';
import { remember } from './relations.ts';
import { releaseRetainer, retainersOf } from './retainers.ts';
import { addLog, hasAbility, outOfTime, protectedFrom, ptOf, targetable, together, untargetableText } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// Hours it takes.
export const BITE_HOURS = 1;

// The biters `a` controls: themselves (serving no one) and those who serve them, who bear it.
export function bitersOf(state: State, a: Actor, t: number) {
  return [...(a.master ? [] : [a]), ...retainersOf(state, a.id)].filter((x) => !x.dead && hasAbility(x, 'bite', t));
}

// One of theirs who can bite now (untapped, in time), standing with `b` if given.
export function readyBiter(state: State, a: Actor, t: number, b?: Actor) {
  return bitersOf(state, a, t).find((x) => x.boundUntil === undefined && !outOfTime(state, x, t) && !down(x) && (!b || together(x, b)));
}

// Whom a biter may fall on: anyone but themselves and a planeswalker, not one who can't be
// picked by them.
export function biteable(state: State, world: World, biter: Actor, b: Actor, t: number) {
  return b.id !== biter.id && !b.dead && b.loyalty === undefined && !outOfTime(state, b, t) && targetable(b, t, actorColors(state, world, biter));
}

// Why `a` can't have one of theirs bite `whoId` now, or null. With `here`, the one bitten must
// stand with the biter already (the player's action); without, they may still go to them (a plan).
export function biteBlocked(state: State, world: World, a: Actor, whoId: string | undefined, t: number, here = true): string | null {
  const theirs = bitersOf(state, a, t);
  if (!theirs.length) return '물어뜯을 힘(포식 충동)을 지닌 이가 없다.';
  const b = whoId ? state.actors[whoId] : undefined;
  if (!b || b.dead) return '그런 이는 없다.';
  const biter = readyBiter(state, a, t, here ? b : undefined) ?? readyBiter(state, a, t);
  if (!biter) return `${josa(shortName(theirs[0].name), '은', '는')} 지금 쓸 수 없다 (이미 묶였음).`;
  if (b.id === biter.id) return '자신을 물어뜯을 수는 없다.';
  if (b.loyalty !== undefined) return `${josa(shortName(b.name), '은', '는')} 생물이 아니다 (플레인즈워커).`;
  if (outOfTime(state, b, t)) return `${josa(shortName(b.name), '은', '는')} 시간 밖에 있다. 닿지 않는다.`;
  if (!targetable(b, t, actorColors(state, world, biter))) return untargetableText(b, t, actorColors(state, world, biter));
  if (here && !together(biter, b)) return `${josa(shortName(b.name), '은', '는')} ${shortName(biter.name)}의 곁에 없다.`;
  return null;
}

// The bite: the biter is tapped, and the two deal each other their power at once.
export function bite(state: State, world: World, a: Actor, whoId: string, t: number) {
  const b = state.actors[whoId];
  const biter = b && readyBiter(state, a, t, b);
  if (!b || !biter || !biteable(state, world, biter, b, t)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 물어뜯을 상대가 곁에 없어 그만두었다.`, regions: [a.region], actors: [a.id] });
    return;
  }
  biter.boundUntil = untapTime(t);
  const [x, y] = [shortName(biter.name), shortName(b.name)];
  addLog(state, {
    kind: 'combat',
    text: `${josa(x, '이', '가')} 포식 충동에 사로잡혀 ${josa(y, '을', '를')} 물어뜯었다. ${josa(x, '은', '는')} 자정까지 묶인다.`,
    regions: [biter.region],
    actors: [biter.id, b.id, a.id],
  });
  // The one bitten takes the biter (and their controller) for a foe today; the biter them.
  const setUpon = !foesOf(b, t).includes(biter.id);
  addFoe(b, biter.id, t);
  if (setUpon) (b.foes!.struck ??= []).push(biter.id);
  addFoe(biter, b.id, t);
  if (b.master === biter.id && !b.seized) releaseRetainer(state, b, '주인에게 물어뜯김');
  if (biter.master === b.id && !biter.seized) releaseRetainer(state, biter, '주인을 물어뜯음');
  remember(b, biter, `나를 물어뜯었다 (${formatClock(t)})`, t);
  remember(biter, b, `내가 물어뜯었다 (${formatClock(t)})`, t);
  // Each deals their power to the other (protection from a color stops it). To the death only
  // if the player is in it.
  const nonlethal = biter.kind !== 'player' && b.kind !== 'player';
  const power = (from: Actor, to: Actor) => {
    const c = protectedFrom(to, actorColors(state, world, from), t);
    if (c) addLog(state, { kind: 'combat', text: `${josa(shortName(to.name), '은', '는')} ${COLOR_LABELS[c]}색으로부터 보호받아 다치지 않는다.`, regions: [biter.region], actors: [to.id] });
    return c ? 0 : Math.max(0, ptOf(from)[0]);
  };
  const [toB, toBiter] = [power(biter, b), power(b, biter)];
  for (const [from, to, n] of [[biter, b, toB], [b, biter, toBiter]] as const) {
    if (n <= 0) continue;
    hurt(to, from, n, t);
    dealDamage(state, to, n, t, `${josa(shortName(from.name), '과', '와')}의 물어뜯기`, nonlethal, from, from);
    lifelink(state, from, n, t);
  }
  // Someone went down: the fight is over.
  if (down(biter) || down(b)) {
    biter.foes = biter.foes && { ...biter.foes, ids: biter.foes.ids.filter((id) => id !== b.id) };
    b.foes = b.foes && { ...b.foes, ids: b.foes.ids.filter((id) => id !== biter.id) };
  }
}
