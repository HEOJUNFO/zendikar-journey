// Quest for the Holy Relic (an item, effects `cast_quest` and `expedition` with `relic`): "Whenever
// you cast a creature spell, you may put a quest counter on this. Remove five quest counters from
// this and sacrifice it: Search your library for an Equipment card, put it onto the battlefield,
// attach it to a creature you control." In this world a creature spell cast is one coming to serve
// its owner (won over, hired, tamed: not a token made), counted each hour from when the quest was
// taken (always: it only helps). With enough, its owner ends it as an expedition (sim/expedition.ts):
// then they may pick an Equipment of the world no one holds and whom of theirs on their tile to put
// it on ("item|bearer"); it comes to them and is put on, for nothing.
import { equipItem, equipTargets } from './equipment.ts';
import { takeItem } from './items.ts';
import { retainersOf } from './retainers.ts';
import { addLog } from './state.ts';
import type { Actor, State } from './state.ts';
import { shortName } from './text.ts';
import type { World } from './world.ts';

// Each hour: those come to serve an owner of such a quest since they took it, not yet counted.
export function relicHour(state: State, world: World, t: number) {
  for (const x of world.items) {
    const s = state.items?.[x.id];
    const owner = s?.owner ? state.actors[s.owner] : undefined;
    if (!x.effects.some((e) => e.type === 'cast_quest') || !s || s.gone || !owner || owner.dead) continue;
    const fresh = retainersOf(state, owner.id).filter((r) => !state.tokens?.[r.id] && (r.joinedAt ?? -1) >= (s.since ?? 0) && !s.struck?.includes(r.id));
    if (!fresh.length) continue;
    s.struck = [...(s.struck ?? []), ...fresh.map((r) => r.id)];
    s.counters += fresh.length;
    addLog(state, { kind: 'effect', text: `${shortName(owner.name)}의 ${x.name}에 탐색 카운터가 쌓였다 (${s.counters}): ${fresh.map((r) => shortName(r.name)).join(', ')}이(가) 섬기러 왔다.`, regions: [owner.region], actors: [owner.id], t });
  }
}

// What `a` could find and put on whom now: an Equipment no one holds, on themselves or theirs here.
export function relicOptions(state: State, world: World, a: Actor) {
  const free = world.items.filter((x) => x.equip && !state.items?.[x.id]?.owner && !state.items?.[x.id]?.gone);
  return free.flatMap((x) => equipTargets(state, a).map((b) => ({ id: `${x.id}|${b.id}`, label: `${x.name} → ${b.id === a.id ? `${shortName(a.name)} 자신` : shortName(b.name)}` })));
}

// The pick lands: the Equipment is theirs and put on, for nothing.
export function applyRelic(state: State, world: World, a: Actor, pick: string, item: string, t: number) {
  if (!relicOptions(state, world, a).some((o) => o.id === pick)) return;
  const [itemId, bearerId] = pick.split('|');
  const x = world.items.find((y) => y.id === itemId)!;
  takeItem(state, world, a, x, t, `${item}의 끝에서 찾아냈다`);
  equipItem(state, world, a, itemId, bearerId, t, item);
}
