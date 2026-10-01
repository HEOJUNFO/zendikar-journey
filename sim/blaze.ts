// Blaze counters (Obsidian Fireheart, `blaze_land`): a land set burning stays so after the one
// who lit it is gone ("The land continues to burn"), until the land itself is destroyed. At each
// 00:00 everyone bonded with a burning land loses 1 life ("this land deals 1 damage to you": to
// a player, life; user decision 2026-10-01).
import { loseLife } from './life.ts';
import { addLog, alive, outOfTime } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { region } from './world.ts';
import type { World } from './world.ts';

// Lights the latest land the target holds that isn't burning (nor destroyed). Returns it.
export function blazeLand(state: State, world: World, by: Actor, target: Actor, t: number) {
  const id = [...(target.bonds ?? [])].reverse().find((x) => !state.regions[x]?.blaze && !state.regions[x]?.destroyed);
  if (!id) {
    addLog(state, { kind: 'effect', text: `${josa(shortName(target.name), '은', '는')} 불씨를 놓을 땅을 쥐고 있지 않다.`, regions: [by.region], actors: [by.id, target.id], t });
    return undefined;
  }
  state.regions[id] ??= { conditions: [] };
  state.regions[id].blaze = { by: by.id, at: t };
  addLog(state, { kind: 'condition', text: `${region(world, id).name}: ${shortName(by.name)}의 불씨가 땅속에 박혀 타오르기 시작했다. 이 땅과 이어진 이는 밤마다 생명을 잃는다.`, regions: [id], actors: [by.id, target.id], t });
  return id;
}

// At 00:00: each burning land burns those bonded with it.
export function upkeepBlaze(state: State, world: World, t: number) {
  for (const r of world.regions) {
    const rs = state.regions[r.id];
    if (!rs?.blaze || rs.destroyed) continue;
    for (const a of alive(state).filter((x) => (x.bonds ?? []).includes(r.id) && !outOfTime(state, x, t))) loseLife(state, a, 1, t, `불타는 ${r.name}`);
  }
}
