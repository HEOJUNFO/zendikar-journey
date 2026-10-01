// Archmage Ascension (an enchantment standing in Sea Gate, an item): "At the beginning of each
// end step, if you drew two or more cards this turn, you may put a quest counter on this. As
// long as it has six or more quest counters, if you would draw a card, you may instead search
// your library for a card, put that card into your hand." A turn's end is midnight: an owner
// who came to know two secrets or more that day puts a counter on it (always, a boon). With six,
// each secret they would come to know (at random, as ever) they have for real instead (user
// decision 2026-10-01): a spell they learn on the spot; an item no one holds becomes theirs, as
// if tamed; a creature of a card who serves no one is drawn to their side (only brought: it
// doesn't serve them, user decision 2026-10-01; winning it over is theirs to do then). A
// trap or what is to come today stays a secret (there is nothing to have). Had for real, it is
// no draw (a replaced draw); what stays a secret is.
import { gameDay } from './clock.ts';
import { itemDef, itemOwner, takeItem } from './items.ts';
import { onEnter } from './abilities.ts';
import { remember } from './relations.ts';
import { addLog, npcDef, outOfTime } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { canStay, region } from './world.ts';
import type { World } from './world.ts';
import type { Secret } from './knowledge.ts';

function questOf(world: World, itemId: string) {
  const e = itemDef(world, itemId)?.effects.find((x) => x.type === 'quest');
  return e?.type === 'quest' ? e : undefined;
}

// Midnight: each quest item whose owner came to know enough the day just ended takes a counter.
export function upkeepQuest(state: State, world: World, t: number) {
  const yesterday = gameDay(t) - 1;
  for (const x of world.items) {
    const q = questOf(world, x.id);
    const s = state.items?.[x.id];
    const owner = s?.owner ? state.actors[s.owner] : undefined;
    if (!q || !s || s.gone || !owner || owner.dead) continue;
    if (owner.drawn?.day !== yesterday || owner.drawn.count < q.draws) continue;
    s.counters += 1;
    addLog(state, {
      kind: 'effect',
      text: `${shortName(owner.name)}의 ${x.name}에 탐색 카운터가 하나 쌓였다 (${s.counters}/${q.counters})${s.counters === q.counters ? '. 이제 알게 될 것을 실제로 손에 넣는다' : ''}.`,
      regions: [owner.region],
      actors: [owner.id],
      t,
    });
  }
}

// Whether `a` holds a quest item with enough counters.
export function ascended(state: State, world: World, a: Actor) {
  return world.items.some((x) => {
    const q = questOf(world, x.id);
    const s = state.items?.[x.id];
    return !!q && !!s && !s.gone && s.owner === a.id && s.counters >= q.counters;
  });
}

// `a` has what the secret is about, for real, if there is something to have. Returns whether.
export function obtain(state: State, world: World, a: Actor, secret: Secret, t: number) {
  const [kind, id] = secret.id.split(':');
  const cause = '대마법사의 승천';
  if (kind === 'spell') {
    const s = world.spells.find((x) => x.id === id);
    if (!s || a.spells?.includes(s.id) || a.exiled?.includes(s.id)) return false;
    a.spells = [...(a.spells ?? []), s.id];
    a.graveyard = a.graveyard?.filter((x) => x !== s.id);
    addLog(state, { kind: 'effect', text: `${cause}: ${josa(shortName(a.name), '이', '가')} ${josa(s.name, '을', '를')} 곧바로 익혔다.`, regions: [a.region], actors: [a.id], t });
    return true;
  }
  if (kind === 'item') {
    const x = itemDef(world, id);
    if (!x || itemOwner(state, x.id) || state.items?.[x.id]?.gone) return false;
    takeItem(state, world, a, x, t, `${cause}로 손에 넣었다`);
    return true;
  }
  if (kind === 'creature') {
    const c = state.actors[id];
    const def = npcDef(state, world, id);
    if (!c || !def || c.dead || c.left || c.master || c.id === a.id || c.kind !== 'npc' || def.loyalty !== undefined || outOfTime(state, c, t)) return false;
    if (a.travel || !canStay(region(world, a.region), def.abilities)) return false;
    addLog(state, { kind: 'event', text: `${cause}: ${josa(shortName(c.name), '이', '가')} ${shortName(a.name)}의 곁으로 이끌려 왔다. 섬기는 것은 아니다.`, regions: [a.region, c.region], actors: [a.id, c.id], t });
    Object.assign(c, { region: a.region, tile: a.tile, task: undefined, forced: undefined, travel: undefined });
    remember(c, a, `나를 그의 곁으로 이끌어 왔다 (${cause})`, t);
    // Arriving somewhere: its powers on entering wake, as for one called forth.
    onEnter(state, world, c, t);
    return true;
  }
  return false;
}
