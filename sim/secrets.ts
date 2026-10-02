// Quest for Ancient Secrets (an item, effect `graveyard_quest`): "Whenever a card is put into your
// graveyard from anywhere, you may put a quest counter on this. Remove five quest counters from this
// and sacrifice it: Target player shuffles their graveyard into their library." Each thing that goes
// into its owner's graveyard (a spell let go, one who served them dying, a mill; `Actor.buried`)
// puts a counter on it, counted each hour (always: it only helps). With enough, its owner may end it
// whenever they will, wherever they are (an hour): it is gone, and one on their tile (themselves
// too; their pick after the hour, the player's at once) has their graveyards go back into their
// library (user decision 2026-10-02): the spells they let go are only not yet learned again, and
// the dead in their creature graveyard come back to the world, alive at their homes and free
// (sim/discovery.ts `riseAtHome`).
import { gameDay } from './clock.ts';
import { graveCreatures, riseAtHome } from './discovery.ts';
import { addLog, present } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { ItemDef, World } from './world.ts';

// Hours it takes (reading the old carvings).
export const SECRETS_HOURS = 1;

function powerOf(x: ItemDef) {
  for (const e of x.effects) if (e.type === 'graveyard_quest') return e;
  return undefined;
}

// The quest `a` owns, if any.
export function secretsOf(state: State, world: World, a: Actor) {
  return world.items.find((x) => powerOf(x) && state.items?.[x.id]?.owner === a.id && !state.items[x.id].gone);
}

// Each hour: what went into each owner's graveyard since last seen, a counter each.
export function secretsHour(state: State, world: World, t: number) {
  const day = gameDay(t);
  for (const x of world.items) {
    const e = powerOf(x);
    const s = state.items?.[x.id];
    const owner = s?.owner ? state.actors[s.owner] : undefined;
    if (!e || !s || s.gone || !owner || owner.dead) continue;
    const now = owner.buried?.day === day ? owner.buried.count : 0;
    const before = s.seen?.day === day ? s.seen.count : 0;
    s.seen = { day, count: now };
    if (now <= before) continue;
    s.counters += now - before;
    addLog(state, { kind: 'effect', text: `${shortName(owner.name)}의 ${x.name}에 탐색 카운터가 쌓였다 (${s.counters}/${e.counters}): 잊힌 것이 무덤에 들었다.`, regions: [owner.region], actors: [owner.id], t });
  }
}

// Why `a` can't end it now, or null.
export function secretsBlocked(state: State, world: World, a: Actor): string | null {
  const x = secretsOf(state, world, a);
  if (!x) return '마칠 탐색이 없다.';
  const need = powerOf(x)!.counters;
  const have = state.items![x.id].counters;
  if (have < need) return `${x.name}의 탐색 카운터가 모자라다 (${have}/${need}, 무덤에 무언가 들 때마다 하나).`;
  return null;
}

// The hour done: it is gone, and whose graveyards go back is theirs to pick.
export function finishSecrets(state: State, world: World, a: Actor, t: number) {
  const x = secretsOf(state, world, a);
  if (!x || secretsBlocked(state, world, a)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 탐색을 마치지 못했다.`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const s = state.items![x.id];
  state.items![x.id] = { name: s.name, counters: 0, gone: true };
  addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} ${josa(x.name, '을', '를')} 마쳤다. 바위벽의 옛 문양이 금빛으로 타오르며 잊힌 것들을 불러낸다.`, regions: [a.region], actors: [a.id], t });
  const candidates = present(state, a.region, a.tile).map((y) => y.id);
  if (!candidates.length) return;
  const owed: Choice = { by: a.id, land: a.region, effect: { type: 'secrets', item: x.name }, candidates, optional: false, t };
  (a.kind === 'player' ? (state.asks ??= []) : (state.choices ??= [])).push(owed);
}

// The pick lands (an answer that isn't one: the first): their graveyards go back.
export function applySecrets(state: State, world: World, target: Actor, item: string, t: number) {
  const spells = target.graveyard?.length ?? 0;
  const dead = graveCreatures(state, target);
  target.graveyard = [];
  target.fallen = [];
  for (const x of dead) riseAtHome(state, world, x, t);
  addLog(state, {
    kind: 'event',
    text: `${item}: ${shortName(target.name)}의 무덤이 세상으로 돌아갔다${spells ? ` (잊은 주문 ${spells}가지는 다시 아직 익히지 않은 것이 되었다)` : ''}${dead.length ? `. ${dead.map((x) => shortName(x.name)).join(', ')}이(가) 제 거처에서 눈을 떴다 (누구도 섬기지 않는다)` : ''}.`,
    regions: [target.region, ...dead.map((x) => x.region)],
    actors: [target.id, ...dead.map((x) => x.id)],
    t,
  });
}
