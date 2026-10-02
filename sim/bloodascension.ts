// Bloodchief Ascension (an item, effect `bloodchief`): "At the beginning of each end step, if an
// opponent lost 2 or more life this turn, you may put a quest counter on this. (Damage causes loss
// of life.) Whenever a card is put into an opponent's graveyard from anywhere, if this has three or
// more quest counters, you may have that player lose 2 life. If you do, you gain 2 life." An
// opponent is another in the land (its areas too) where its owner is (user decision 2026-10-02).
// At midnight, one there who lost 2 or more life or took 2 or more damage the day just ended puts a
// counter on it (always, a boon). With enough, each thing that goes into such a one's graveyard
// (a spell let go, one who served them dying) costs them 2 life, and the owner gains 2 (always).
// Graveyards are watched each hour by their counts (`Actor.buried`, `state.buriedSeen`).
import { gameDay } from './clock.ts';
import { gainLife, loseLife } from './life.ts';
import { addLog } from './state.ts';
import type { Actor, State } from './state.ts';
import { shortName } from './text.ts';
import { region, topOf } from './world.ts';
import type { ItemDef, World } from './world.ts';

function powerOf(x: ItemDef) {
  for (const e of x.effects) if (e.type === 'bloodchief') return e;
  return undefined;
}

function sameLand(world: World, a: Actor, b: Actor) {
  return !a.travel && !b.travel && topOf(world, region(world, a.region)).id === topOf(world, region(world, b.region)).id;
}

// Midnight: a counter if someone in its owner's land was hurt 2 or more the day just ended.
export function upkeepBloodchief(state: State, world: World, t: number) {
  const yesterday = gameDay(t) - 1;
  for (const x of world.items) {
    const e = powerOf(x);
    const s = state.items?.[x.id];
    const owner = s?.owner ? state.actors[s.owner] : undefined;
    if (!e || !s || s.gone || !owner || owner.dead) continue;
    const bled = Object.values(state.actors).find((y) => y.id !== owner.id && !y.dead && y.hurtToday?.day === yesterday && y.hurtToday.amount >= 2 && sameLand(world, owner, y));
    if (!bled) continue;
    s.counters += 1;
    addLog(state, { kind: 'effect', text: `${shortName(owner.name)}의 ${x.name}에 탐색 카운터가 하나 쌓였다 (${s.counters}/${e.counters}): ${shortName(bled.name)}이(가) 피를 흘렸다.`, regions: [owner.region], actors: [owner.id], t });
  }
}

// Each hour: what went into the graveyards of those in a ready owner's land since last seen.
export function bloodchiefDrain(state: State, world: World, t: number) {
  const day = gameDay(t);
  const seen = (state.buriedSeen ??= {});
  const fresh: { a: Actor; n: number }[] = [];
  for (const a of Object.values(state.actors)) {
    const now = a.buried?.day === day ? a.buried.count : 0;
    const before = seen[a.id]?.day === day ? seen[a.id].count : 0;
    if (now > before) fresh.push({ a, n: now - before });
    if (now) seen[a.id] = { day, count: now };
    else delete seen[a.id];
  }
  if (!fresh.length) return;
  for (const x of world.items) {
    const e = powerOf(x);
    const s = state.items?.[x.id];
    const owner = s?.owner ? state.actors[s.owner] : undefined;
    if (!e || !s || s.gone || !owner || owner.dead || s.counters < e.counters) continue;
    for (const { a, n } of fresh) {
      if (a.id === owner.id || a.dead || !sameLand(world, owner, a)) continue;
      for (let i = 0; i < n && !a.dead; i++) {
        loseLife(state, a, e.drain, t, x.name, owner);
        gainLife(state, owner, e.drain, t, x.name);
      }
    }
  }
}
