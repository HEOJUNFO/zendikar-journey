// Hedron Crab (`sim.landfall_mill`): "Landfall — Whenever a land you control enters, target player
// mills three cards." When its controller (master, or itself) bonds with a land and it is awake at
// their side (as Lotus Cobra), the controller picks one on their tile (themselves too; one must):
// that many of the spells that one could still learn (their library, sim/sacrament.ts) go to their
// spell graveyard at random (forgotten: to be learned again where taught). The player picks at
// once, an NPC by the LLM after the hour.
import { KO_ACTIVITY } from './rules.ts';
import { libraryOf } from './sacrament.ts';
import { retainersOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, buryCount, npcDef, present, random, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

export function landfallMill(state: State, world: World, a: Actor, t: number) {
  for (const x of [a, ...retainersOf(state, a.id)]) {
    const n = npcDef(state, world, x.id)?.landfallMill;
    if (!n || x.dead || x.forced?.activity === KO_ACTIVITY || powersSealed(state, world, x, t) || (x.id !== a.id && !together(x, a))) continue;
    const candidates = present(state, a.region, a.tile).map((y) => y.id);
    if (!candidates.length) continue;
    (a.kind === 'player' ? (state.asks ??= []) : (state.choices ??= [])).push({ by: a.id, land: a.region, effect: { type: 'mill', source: x.id, count: n }, candidates, optional: false, t });
  }
}

// The pick lands (an answer that isn't one: the first): that many of their library to the graveyard.
export function applyMill(state: State, world: World, target: Actor, count: number, sourceId: string, t: number) {
  const lib = libraryOf(world, target).map((s) => s.id);
  const gone: string[] = [];
  while (gone.length < count && lib.length) gone.push(...lib.splice(Math.floor(random(state) * lib.length), 1));
  const who = shortName(state.actors[sourceId]?.name ?? '헤드론');
  if (!gone.length) {
    addLog(state, { kind: 'effect', text: `${who}이(가) 쥔 헤드론이 웅웅거렸지만 ${shortName(target.name)}에게서 흩어질 앞날이 없었다.`, regions: [target.region], actors: [target.id], t });
    return;
  }
  target.graveyard = [...(target.graveyard ?? []), ...gone];
  buryCount(target, gone.length, t);
  const names = gone.map((id) => world.spells.find((s) => s.id === id)?.name ?? id).join(', ');
  addLog(state, { kind: 'effect', text: `${who}이(가) 쥔 헤드론이 웅웅거리자 ${shortName(target.name)}의 앞날이 어지러워졌다: ${josa(names, '이', '가')} 잊힌 것이 되었다 (무덤으로, 배우는 곳에서 다시 익힐 수 있다).`, regions: [target.region], actors: [target.id, sourceId], t });
}
