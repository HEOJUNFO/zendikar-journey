// Drawing a card (world/README.md: MTG 규칙 → 게임 대응, user decision 2026-09-30) is coming to
// know a secret of the world: something it holds but no one tells. A hidden trap and what sets
// it off, where a relic stands and what it does, where a spell is taught, and what is still to
// come today (as the Sphinx sees it; true only today). Drawn at random from what they don't
// know yet. What they know goes into their plan and their talk (the LLM makes use of it); the
// player sees it. The day's count of secrets learned is what "drew N cards this turn" asks
// (the Runeflare Trap).
import { gameDay } from './clock.ts';
import { foresightText } from './foresight.ts';
import { addLog, random } from './state.ts';
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
      ].filter(Boolean);
      return `${who.length ? who.join(', ') : '누군가'}가 들어설 때 터진다`;
    }
    case 'destroyed':
      return '이 땅이 누군가의 손에 부서질 때 터진다';
    case 'drew':
      return `그날 비밀을 ${ev.cards}가지 이상 알게 된 이가 이 땅에 있을 때 터진다`;
    case 'attacked':
      return `같은 시간에 ${ev.attackers} 이상이 이 땅에서 덤빌 때 터진다`;
    default:
      return '어느 날 아침 일어날 수 있다';
  }
}

// Everything there is to know now.
export function secretsOf(state: State, world: World, t: number): Secret[] {
  const traps = world.events.map((ev) => ({ id: `trap:${ev.id}`, text: `${placeName(world, region(world, ev.region))}의 ${ev.name}: ${ev.summary}. ${triggerText(ev)}.` }));
  const items = world.items
    .filter((x) => !state.items?.[x.id]?.gone)
    .map((x) => {
      const owner = state.items?.[x.id]?.owner;
      return { id: `item:${x.id}`, text: `${x.name}이(가) ${placeName(world, region(world, x.at))}에 서 있다: ${x.summary}. 길들이는 값 ${x.costText}${owner ? `, 지금은 ${shortName(state.actors[owner]?.name ?? owner)}의 것` : ', 아직 주인이 없다'}.` };
    });
  const spells = world.spells.map((s) => ({ id: `spell:${s.id}`, text: `주문 ${s.name}(${s.costText})은(는) ${placeName(world, region(world, s.learnAt))}에서 배운다: ${s.summary}.` }));
  const day = gameDay(t);
  const today = foresightText(state, world, t).map((text, i) => ({ id: `today:${day}:${i}`, text: `오늘 ${text}`, day }));
  return [...traps, ...items, ...spells, ...today];
}

// What they know now (a secret of another day has passed).
export function knownSecrets(a: Actor, t: number): Secret[] {
  return (a.knowledge ?? []).filter((k) => k.day === undefined || k.day === gameDay(t));
}

// "Draw N": N secrets they don't know yet, at random. Returns what they learned.
export function drawKnowledge(state: State, world: World, a: Actor, n: number, t: number, cause: string) {
  const known = new Set(knownSecrets(a, t).map((k) => k.id));
  const pool = secretsOf(state, world, t).filter((s) => !known.has(s.id));
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

// For their prompts.
export function knowledgeText(a: Actor, t: number): string[] {
  return knownSecrets(a, t).map((k) => k.text);
}

// Their hand ("cards in hand"): the spells they hold and the secrets they know.
export function handSize(a: Actor, t: number) {
  return (a.spells?.length ?? 0) + knownSecrets(a, t).length;
}
