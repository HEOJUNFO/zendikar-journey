// Scute Mob (`sim.upkeep_grow`): "At the beginning of your upkeep, if you control five or more
// lands, put four +1/+1 counters on this creature." An upkeep is 00:00: if whoever controls it (its
// master, or itself) holds that many lands (not broken), the counters are its for good. A beast
// holds only its latest hunting ground, so on its own it stays small; one with many lands who wins
// it over has it swell each night.
import { masterOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, outOfTime } from './state.ts';
import type { State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

export function upkeepScute(state: State, world: World, t: number) {
  for (const x of Object.values(state.actors)) {
    const g = npcDef(state, world, x.id)?.upkeepGrow;
    if (!g || x.dead || outOfTime(state, x, t) || powersSealed(state, world, x, t)) continue;
    const controller = masterOf(state, x) ?? x;
    const lands = new Set(controller.bonds ?? []);
    const held = [...lands].filter((id) => !state.regions[id]?.destroyed).length;
    if (held < g.lands) continue;
    x.plusCounters = (x.plusCounters ?? 0) + g.counters;
    addLog(state, { kind: 'effect', text: `한밤, ${josa(shortName(x.name), '이', '가')} 불어났다: ${shortName(controller.name)}이(가) 쥔 땅 ${held}곳에서 떼가 몰려와 +1/+1 카운터 ${g.counters} (영영).`, regions: [x.region], actors: [x.id, controller.id], t });
  }
}
