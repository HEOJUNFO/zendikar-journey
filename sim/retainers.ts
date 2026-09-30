// Retainers (world/entities/laws/law-retainers.md): characters who serve a master. What a
// card calls "a creature you control". They follow their master about, join the master's
// fights, and can be called on (a kicker taps one). Kalitas's risen vampires are his; the
// player wins retainers by persuading someone in conversation. A beast that may follow
// (`tamable`, the Felidar Sovereign) chooses whom to trust: the player who talks to it, or an
// NPC who courts it (a "court" block); the LLM decides, as the beast.
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
  const def = npcDef(state, world, a.id);
  if (def?.beast && !def.tamable) return '짐승은 말로 따르게 할 수 없다.';
  const m = masterOf(state, a);
  if (m) return `${josa(shortName(a.name), '은', '는')} 이미 ${shortName(m.name)}의 권속이다.`;
  return null;
}

// Hours an NPC spends at a beast's side to win its trust.
export const COURT_HOURS = 2;

// Beasts that may follow and follow no one yet, whose trust `a` could seek (not beasts, not
// those who serve someone).
export function courtTargets(state: State, world: World, a: Actor) {
  if (a.dead || a.master || npcDef(state, world, a.id)?.beast) return [];
  return Object.values(state.actors).filter((x) => x.id !== a.id && npcDef(state, world, x.id)?.tamable && !swayBlocked(state, world, x));
}

// Why `a` can't court `whoId` now, or null.
export function courtBlocked(state: State, world: World, a: Actor, whoId: string | undefined): string | null {
  const x = whoId ? state.actors[whoId] : undefined;
  if (!x || !courtTargets(state, world, a).some((y) => y.id === x.id)) return x ? (swayBlocked(state, world, x) ?? `${josa(shortName(x.name), '은', '는')} 곁을 내주지 않는다.`) : '그런 짐승은 없다.';
  if (x.region !== a.region || x.travel) return `${josa(shortName(x.name), '이', '가')} 여기 없다.`;
  return null;
}

// A court is over: the beast decides after the hour (sim/run.ts), in character, whether to
// follow them (state.choices; "may": it may not).
export function readyCourt(state: State, world: World, a: Actor, whoId: string, t: number) {
  const why = courtBlocked(state, world, a, whoId);
  if (why) {
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} 마음을 얻지 못했다: ${why}`, regions: [a.region], actors: [a.id], t });
    return;
  }
  (state.choices ??= []).push({ by: whoId, land: a.region, effect: { type: 'follow' }, candidates: [a.id], optional: true, t });
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
