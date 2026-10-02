// Cosi's Trickster (`sim.shuffle_counter`): "Whenever an opponent shuffles their library, you may put
// a +1/+1 counter on this creature." A library shuffled is a land sought out from afar (a fetch,
// Harrow, a cartographer or guide, an expedition's lands: `markSearched`). An opponent is another
// in the land where it stands (its areas too; not it, not the one it serves; user decision
// 2026-10-02). Each such search is a counter (always, a boon). The searches are gathered as they
// come and answered each hour (sim/step.ts).
import { addLog, npcDef } from './state.ts';
import type { State } from './state.ts';
import { josa, shortName } from './text.ts';
import { region, topOf } from './world.ts';
import type { World } from './world.ts';

export function tricksterHour(state: State, world: World, t: number) {
  const shuffles = state.shuffles ?? [];
  delete state.shuffles;
  if (!shuffles.length) return;
  const top = (id: string) => topOf(world, region(world, id)).id;
  for (const x of Object.values(state.actors)) {
    if (x.dead || x.travel || !npcDef(state, world, x.id)?.shuffleCounter) continue;
    const n = shuffles.filter((s) => s.id !== x.id && s.id !== x.master && top(s.region) === top(x.region)).length;
    if (!n) continue;
    x.plusCounters = (x.plusCounters ?? 0) + n;
    addLog(state, { kind: 'effect', text: `${josa(shortName(x.name), '이', '가')} 뒤섞이는 길의 무늬에서 힘을 얻었다 (+1/+1 카운터 ${n}).`, regions: [x.region], actors: [x.id], t });
  }
}
