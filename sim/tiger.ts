// Scythe Tiger (`sim.join_toll`): "When this enters, sacrifice it unless you sacrifice a land." In
// this world it enters one's side when it comes to serve them (user decision 2026-10-02): its new
// master gives up one of their lands (the bond breaks; they may bond with it again) or it won't
// have them, and leaves, serving no one (a lighter telling: it does not die). One with no lands
// to give loses it at once. Asked each hour of those come to serve since last seen (sim/step.ts);
// the master picks (the player by a pick, an NPC by the LLM after the hour).
import { masterOf, releaseRetainer } from './retainers.ts';
import { addLog, npcDef } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { region } from './world.ts';
import type { World } from './world.ts';

export function tigerHour(state: State, world: World, t: number) {
  for (const x of Object.values(state.actors)) {
    if (x.dead || !npcDef(state, world, x.id)?.joinToll) continue;
    const m = masterOf(state, x);
    if (!m || m.dead || x.tolled === x.joinedAt) continue;
    x.tolled = x.joinedAt;
    if (!(m.bonds ?? []).length) {
      leave(state, x, `${shortName(m.name)}에게 내어 줄 땅이 없어`);
      continue;
    }
    (m.kind === 'player' ? (state.asks ??= []) : (state.choices ??= [])).push({ by: m.id, land: m.region, effect: { type: 'toll_land', source: x.id }, candidates: [...m.bonds!], optional: true, t });
  }
}

// Their answer: a land of theirs given up keeps it; none (or one no longer theirs), it leaves.
export function answerTigerToll(state: State, world: World, m: Actor, sourceId: string, pick: string | null, t: number) {
  const x = state.actors[sourceId];
  if (!x || x.dead || masterOf(state, x)?.id !== m.id) return;
  if (!pick || !(m.bonds ?? []).includes(pick)) {
    leave(state, x, `${josa(shortName(m.name), '이', '가')} 땅을 내어 주지 않아`);
    return;
  }
  m.bonds = m.bonds!.filter((b) => b !== pick);
  addLog(state, { kind: 'effect', text: `${josa(shortName(m.name), '이', '가')} ${region(world, pick).name}과의 유대를 ${shortName(x.name)}에게 내어 주었다 (다시 맺을 수 있다). ${josa(shortName(x.name), '은', '는')} 그 땅을 제 사냥터로 삼고 곁에 남는다.`, regions: [m.region], actors: [m.id, x.id], t });
}

function leave(state: State, x: Actor, why: string) {
  addLog(state, { kind: 'event', text: `${why} ${josa(shortName(x.name), '이', '가')} 등을 돌려 숲으로 사라졌다.`, regions: [x.region], actors: [x.id] });
  releaseRetainer(state, x, '땅을 받지 못함');
}
