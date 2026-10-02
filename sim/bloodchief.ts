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
import { region, topOf } from './world.ts';
import type { World } from './world.ts';

export type Death = NonNullable<State['deaths']>[number];

// The deaths gathered since last asked, taken (each answered once).
export function takeDeaths(state: State): Death[] {
  const deaths = state.deaths ?? [];
  delete state.deaths;
  return deaths;
}

export function bloodchiefHour(state: State, world: World, t: number, deaths: Death[] = takeDeaths(state)) {
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

// Quest for the Gravelord (an item, effect `death_quest`): "Whenever a creature dies, you may put a
// quest counter on this." Each death in the land (its areas too) where its owner is (user decision
// 2026-10-02), a counter (always: it only helps). Ending it is an expedition's (sim/expedition.ts:
// its `token`, the 5/5 Zombie Giant).
export function gravelordHour(state: State, world: World, t: number, deaths: Death[]) {
  if (!deaths.length) return;
  for (const x of world.items) {
    const s = state.items?.[x.id];
    const owner = s?.owner ? state.actors[s.owner] : undefined;
    if (!x.effects.some((e) => e.type === 'death_quest') || !s || s.gone || !owner || owner.dead || owner.travel) continue;
    const land = topOf(world, region(world, owner.region)).id;
    const n = deaths.filter((d) => d.id !== owner.id && world.regions.some((r) => r.id === d.region) && topOf(world, region(world, d.region)).id === land).length;
    if (!n) continue;
    s.counters += n;
    addLog(state, { kind: 'effect', text: `${shortName(owner.name)}의 ${x.name}에 탐색 카운터가 쌓였다 (${s.counters}): 이 땅에서 ${n === 1 ? '하나가' : `${n}이`} 죽었다.`, regions: [owner.region], actors: [owner.id], t });
  }
}
