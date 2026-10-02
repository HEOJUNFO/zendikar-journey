// Blade of the Bloodchief (equipment `death_counters`): "Whenever a creature is put into a
// graveyard from the battlefield, put a +1/+1 counter on equipped creature. If equipped creature
// is a Vampire, put two +1/+1 counters on it instead." In this world (user decision 2026-10-02),
// a death on its bearer's tile (a token gone or a planeswalker leaving is no death): one counter,
// two on a vampire (creature `cre-vampire`). The deaths are gathered as they come (sim/combat.ts
// `die`, no world there) and answered each hour (sim/step.ts).
import { creatureOf } from './retainers.ts';
import { addLog } from './state.ts';
import type { State } from './state.ts';
import { josa, shortName } from './text.ts';
import { sameTile } from './tiles.ts';
import type { World } from './world.ts';

export function bloodchiefHour(state: State, world: World, t: number) {
  const deaths = state.deaths ?? [];
  delete state.deaths;
  if (!deaths.length) return;
  for (const x of world.items) {
    const s = state.items?.[x.id];
    if (!x.equip?.deathCounters || !s?.bearer || s.gone) continue;
    const b = state.actors[s.bearer];
    if (!b || b.dead) continue;
    const n = deaths.filter((d) => d.id !== b.id && d.region === b.region && sameTile(d.tile, b.tile)).length;
    if (!n) continue;
    const each = creatureOf(state, world, b.id) === 'cre-vampire' ? 2 : 1;
    b.plusCounters = (b.plusCounters ?? 0) + n * each;
    addLog(state, { kind: 'effect', text: `${x.name}: 곁에서 흘린 피를 마시고 ${josa(shortName(b.name), '이', '가')} +1/+1 카운터 ${n * each}을 얻었다${each === 2 ? ' (흡혈귀라 둘씩)' : ''}.`, regions: [b.region], actors: [b.id], t });
  }
}
