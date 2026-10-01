// Drawing a card (world/README.md: MTG 규칙 → 게임 대응, user decision 2026-09-30) is coming to
// know a secret of the world: something it holds but no one tells. A hidden trap and what sets
// it off, where a relic stands and what it does, where a spell is taught, and what is still to
// come today (as the Sphinx sees it; true only today). Drawn at random from what they don't
// know yet. What they know goes into their plan and their talk (the LLM makes use of it); the
// player sees it. The day's count of secrets learned is what "drew N cards this turn" asks
// (the Runeflare Trap).
import { gameDay } from './clock.ts';
import { eventTile, tileLabel } from './tiles.ts';
import { itemWhere } from './items.ts';
import { foresightText } from './foresight.ts';
import { addLog, outOfTime, random } from './state.ts';
import { hirePrice } from './allies.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { placeName, region } from './world.ts';
import type { EventDef, World } from './world.ts';

export type Secret = { id: string; text: string; day?: number };

// What sets a trap off, in Korean.
function triggerText(ev: EventDef) {
  switch (ev.trigger) {
    case 'landfall':
      return `누군가 그날 ${ev.landfalls && ev.landfalls > 1 ? `${ev.landfalls}번째로 ` : ''}이 땅과 유대를 맺을 때 터진다`;
    case 'enter': {
      const who = [
        ev.gained_life && '그날 생명을 얻은 이',
        ev.refused && '그날 누군가를 따르게 하려다 거절당한 이',
        ev.searched && '그날 페치로 땅을 찾아온 이',
        ev.claimed && '그날 아이템을 길들인 이',
        ev.joined && `그날 권속이 ${ev.joined} 이상 새로 든 이`,
      ].filter(Boolean);
      return `${who.length ? who.join(', ') : '누군가'}가 그 자리에 발을 들일 때 터진다`;
    }
    case 'destroyed':
      return '이 땅이 누군가의 손에 부서질 때 터진다';
    case 'drew':
      return `그날 비밀을 ${ev.cards}가지 이상 알게 된 이가 이 땅에 있을 때 터진다`;
    case 'attacked':
      return `같은 시간에 ${ev.attackers} 이상이 이 땅에서 덤빌 때 터진다`;
    case 'hurt':
      return `그날 서로 다른 ${ev.creatures} 이상에게 싸움 피해를 입은 이가 이 땅에 있을 때 터진다 (그를 다치게 한 이 하나에게)`;
    default:
      return '어느 날 아침 일어날 수 있다';
  }
}

// Everything there is to know now.
export function secretsOf(state: State, world: World, t: number): Secret[] {
  // A trap that springs underfoot lies on one tile of its land: where, too.
  const spot = (ev: EventDef) => {
    const tile = ev.trigger === 'enter' ? eventTile(world, ev) : undefined;
    return tile ? `${placeName(world, region(world, ev.region))}(${tileLabel(world, ev.region, tile)})` : placeName(world, region(world, ev.region));
  };
  const traps = world.events.map((ev) => ({ id: `trap:${ev.id}`, text: `${spot(ev)}의 ${ev.name}: ${ev.summary}. ${triggerText(ev)}.` }));
  const items = world.items
    .filter((x) => itemWhere(state, world, x))
    .map((x) => {
      const owner = state.items?.[x.id]?.owner;
      const w = itemWhere(state, world, x)!;
      const where = `${placeName(world, region(world, w.region))}${w.tile ? `(${tileLabel(world, w.region, w.tile)})` : ''}`;
      const how = w.carried ? `${shortName(state.actors[w.carried]?.name ?? w.carried)}이(가) 지니고 ${where}에 있다` : `${where}에 ${state.items?.[x.id]?.lies ? '떨어져' : '서'} 있다`;
      return { id: `item:${x.id}`, text: `${x.name}은(는) ${how}: ${x.summary}. 길들이는 값 ${x.costText}${x.equip ? `, 매는 값 ${x.equip.costText}` : ''}${owner ? `, 지금은 ${shortName(state.actors[owner]?.name ?? owner)}의 것` : ', 아직 주인이 없다'}.` };
    });
  const spells = world.spells.map((s) => ({ id: `spell:${s.id}`, text: `주문 ${s.name}(${s.costText})은(는) ${placeName(world, region(world, s.learnAt))}에서 배운다: ${s.summary}.` }));
  const day = gameDay(t);
  const today = foresightText(state, world, t).map((text, i) => ({ id: `today:${day}:${i}`, text: `오늘 ${text}`, day }));
  return [...traps, ...items, ...spells, ...today, ...creatureSecrets(state, world, t)];
}

// The creature cards' whereabouts (user decision 2026-10-01, Beast Hunt): where each living
// creature of a card (not a planeswalker, not a token) is now, what it is, and how it might be
// won. True only today: they move.
export function creatureSecrets(state: State, world: World, t: number): Secret[] {
  const day = gameDay(t);
  return world.npcs
    .filter((n) => n.loyalty === undefined)
    .map((n) => ({ n, a: state.actors[n.id] }))
    .filter(({ a }) => a && !a.dead && !a.left && !outOfTime(state, a))
    .map(({ n, a }) => {
      const where = a.travel ? '길 위' : `${placeName(world, region(world, a.region))}${a.tile ? `(${tileLabel(world, a.region, a.tile)})` : ''}`;
      const ways = [
        n.beast ? '말을 하지 않는 짐승' : '말을 하는 이',
        n.needs.includes('hunger') ? '먹는다' : '먹지 않는다',
        n.hireable && `${hirePrice(n)}코인에 고용할 수 있다`,
        n.tamable && '따를 이를 스스로 고른다',
        a.master && `지금은 ${shortName(state.actors[a.master]?.name ?? a.master)}의 권속`,
      ].filter(Boolean);
      return { id: `creature:${n.id}:${day}`, text: `오늘 ${josa(shortName(a.name), '이', '가')} ${where}에 있다: ${n.role ?? ''} (${ways.join(', ')}).`, day };
    });
}

// What they know now (a secret of another day has passed).
export function knownSecrets(a: Actor, t: number): Secret[] {
  return (a.knowledge ?? []).filter((k) => k.day === undefined || k.day === gameDay(t));
}

// "Draw N": N secrets they don't know yet, at random. Returns what they learned.
export function drawKnowledge(state: State, world: World, a: Actor, n: number, t: number, cause: string) {
  const pool = unknownTo(state, world, a, t);
  const got: Secret[] = [];
  while (got.length < n && pool.length) got.push(pool.splice(Math.floor(random(state) * pool.length), 1)[0]);
  a.knowledge = [...knownSecrets(a, t), ...got];
  const day = gameDay(t);
  a.drawn = { day, count: (a.drawn?.day === day ? a.drawn.count : 0) + got.length, sprung: a.drawn?.day === day ? a.drawn.sprung : undefined };
  addLog(state, {
    kind: 'effect',
    text: got.length
      ? `${cause}: ${josa(shortName(a.name), '이', '가')} 숨은 것 ${got.length}가지를 알게 되었다.${a.kind === 'player' ? got.map((s) => `\n· ${s.text}`).join('') : ''}`
      : `${cause}: ${josa(shortName(a.name), '은', '는')} 더 알아낼 것이 없었다.`,
    regions: [a.region],
    actors: [a.id],
    t,
  });
  return got;
}

// What `a` doesn't know yet (their own whereabouts aside), as a library.
function unknownTo(state: State, world: World, a: Actor, t: number) {
  const known = new Set(knownSecrets(a, t).map((k) => k.id));
  return secretsOf(state, world, t).filter((s) => !known.has(s.id) && !s.id.startsWith(`creature:${a.id}:`));
}

// "Reveal the top N cards of your library. Put all creature cards revealed this way into your
// hand and the rest into your graveyard" (Beast Hunt): N secrets they don't know, at random,
// turn up; they keep those of creatures' whereabouts and let the rest go by. Not a draw (no
// count toward "drew N"). Returns what they kept.
export function huntKnowledge(state: State, world: World, a: Actor, n: number, t: number, cause: string) {
  const pool = unknownTo(state, world, a, t);
  const shown: Secret[] = [];
  while (shown.length < n && pool.length) shown.push(pool.splice(Math.floor(random(state) * pool.length), 1)[0]);
  const kept = shown.filter((s) => s.id.startsWith('creature:'));
  a.knowledge = [...knownSecrets(a, t), ...kept];
  const missed = shown.length - kept.length;
  addLog(state, {
    kind: 'effect',
    text: shown.length
      ? `${cause}: ${josa(shortName(a.name), '이', '가')} 숨은 것 ${shown.length}가지를 더듬어, 생물의 자취 ${kept.length}가지를 알게 되었다${missed ? ` (나머지 ${missed}가지는 흘려보냈다)` : ''}.${a.kind === 'player' ? kept.map((s) => `\n· ${s.text}`).join('') : ''}`
      : `${cause}: ${josa(shortName(a.name), '은', '는')} 더 알아낼 것이 없었다.`,
    regions: [a.region],
    actors: [a.id],
    t,
  });
  return kept;
}

// For their prompts.
export function knowledgeText(a: Actor, t: number): string[] {
  return knownSecrets(a, t).map((k) => k.text);
}

// Their hand ("cards in hand"): the spells they hold, not the secrets they know (user decision
// 2026-10-01). Drawing brings secrets; discarding lets spells go.
export function handSize(a: Actor) {
  return a.spells?.length ?? 0;
}
