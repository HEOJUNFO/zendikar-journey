// Retainers (world/entities/laws/law-retainers.md): characters who serve a master. What a
// card calls "a creature you control". They follow their master about, join the master's
// fights, and can be called on (a kicker taps one). Kalitas's risen vampires are his; the
// player wins retainers by persuading someone in conversation.
import { addLog } from './state.ts';
import type { Actor, State } from './state.ts';
import { remember } from './relations.ts';
import { josa, shortName } from './text.ts';
import { hasPowers } from './world.ts';
import type { World } from './world.ts';
import { npcDef } from './state.ts';

export function masterOf(state: State, a: Actor) {
  const m = a.master ? state.actors[a.master] : undefined;
  return m && !m.dead ? m : undefined;
}

export function retainersOf(state: State, masterId: string) {
  return Object.values(state.actors).filter((x) => !x.dead && x.master === masterId);
}

// The creature kind someone is (e.g. cre-vampire): a risen one's kind, or a creature entity.
export function creatureOf(state: State, world: World, id: string) {
  return state.tokens?.[id]?.creature ?? npcDef(state, world, id)?.creature;
}

// Why `a` can't be won over as a retainer, or null.
export function swayBlocked(state: State, world: World, a: Actor): string | null {
  if (a.dead || a.kind !== 'npc' || hasPowers(npcDef(state, world, a.id))) return `${josa(shortName(a.name), '은', '는')} 누구를 따를 존재가 아니다.`;
  if (npcDef(state, world, a.id)?.beast) return '짐승은 말로 따르게 할 수 없다.';
  const m = masterOf(state, a);
  if (m) return `${josa(shortName(a.name), '은', '는')} 이미 ${shortName(m.name)}의 권속이다.`;
  return null;
}

export function bindRetainer(state: State, a: Actor, master: Actor, t: number, how: string) {
  a.master = master.id;
  remember(a, master, `나의 주인 (${how})`, t);
  addLog(state, {
    kind: 'status',
    text: `${josa(shortName(a.name), '이', '가')} ${shortName(master.name)}의 권속이 되었다 (${how}).`,
    regions: [a.region],
    actors: [a.id, master.id],
  });
}

export function releaseRetainer(state: State, a: Actor, why: string) {
  if (!a.master) return;
  delete a.master;
  addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} 권속에서 풀려났다 (${why}).`, regions: [a.region], actors: [a.id] });
}
