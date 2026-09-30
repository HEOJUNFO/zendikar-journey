// "{T}: Draw a card for each Ally you control" (Sea Gate Loremaster): a power of whoever
// controls him (his master, or himself when he serves no one). He is tapped (bound until 00:00),
// and they come to hold as many spells of the world as their party has Allies, at random ("draw"
// = come to hold a spell of the world). The player uses it by an action, an NPC by a `recall`
// block in their plan.
import { untapTime, gameDay } from './clock.ts';
import { alliesOf } from './allies.ts';
import { retainersOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, outOfTime, random } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// Hours it takes (going over what he remembers with him).
export const RECALL_HOURS = 1;

// The loremasters `a` controls: themselves (serving no one) and those who serve them.
export function loremastersOf(state: State, world: World, a: Actor) {
  return [...(a.master ? [] : [a]), ...retainersOf(state, a.id)].filter((x) => !x.dead && npcDef(state, world, x.id)?.tapDrawAllies);
}

// One of theirs who can be tapped now, if any.
function readyLoremaster(state: State, world: World, a: Actor, t: number) {
  return loremastersOf(state, world, a).find((x) => x.boundUntil === undefined && !outOfTime(state, x, t) && !powersSealed(state, world, x, t));
}

// Why `a` can't draw on a loremaster now, or null.
export function recallBlocked(state: State, world: World, a: Actor, t: number): string | null {
  const theirs = loremastersOf(state, world, a);
  if (!theirs.length) return '부릴 전승술사가 없다.';
  if (!readyLoremaster(state, world, a, t)) return `${josa(shortName(theirs[0].name), '은', '는')} 지금 쓸 수 없다 (이미 묶였거나 힘이 봉인됨).`;
  return null;
}

// How many they would draw: the Allies of their party.
export function recallCount(state: State, world: World, a: Actor) {
  return alliesOf(state, world, a).length;
}

export function recall(state: State, world: World, a: Actor, t: number) {
  const lm = readyLoremaster(state, world, a, t);
  if (!lm || a.dead) return;
  lm.boundUntil = untapTime(t);
  const n = recallCount(state, world, a);
  const got = drawSpells(state, world, a, n, t);
  addLog(state, {
    kind: 'effect',
    text: `${shortName(lm.name)}의 기억을 빌려 ${josa(shortName(a.name), '이', '가')} ${got.length ? `${got.map((id) => world.spells.find((s) => s.id === id)!.name).join(', ')}을(를) 떠올렸다` : '더 떠올릴 주문이 없었다'} (동료 ${n}).`,
    regions: [a.region],
    actors: [a.id, lm.id],
    t,
  });
}

// "Draw N": they come to hold N spells of the world they don't hold yet, at random. Counts
// toward what they drew today (the Runeflare Trap).
export function drawSpells(state: State, world: World, a: Actor, n: number, t: number) {
  const pool = world.spells.filter((s) => !a.spells?.includes(s.id)).map((s) => s.id);
  const got: string[] = [];
  while (got.length < n && pool.length) got.push(pool.splice(Math.floor(random(state) * pool.length), 1)[0]);
  a.spells = [...(a.spells ?? []), ...got];
  const day = gameDay(t);
  a.drawn = { day, count: (a.drawn?.day === day ? a.drawn.count : 0) + got.length, sprung: a.drawn?.day === day ? a.drawn.sprung : undefined };
  return got;
}
