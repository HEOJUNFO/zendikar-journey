// Life (world/README.md: MTG 규칙 → 게임 대응): a total of its own, apart from energy
// ([결정] 2026-09-30). Every being has it, those who never tire too (Kalitas, Lorthos: user
// decision 2026-09-30), and starts at START_LIFE. It never comes back
// by itself (sleep and food restore energy, not life); only effects that say "gain life" raise
// it, with no cap. At 0 they die, except when an NPC took it from an NPC: then, as in their
// fights, they are knocked out and come to with 1 life.
import { gameDay } from './clock.ts';
import { die, knockOut } from './combat.ts';
import { addLog } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName, toward } from './text.ts';

// MTG's starting life total.
export const START_LIFE = 20;

// Life they have now. Everyone has it: people, beasts, legends, planeswalkers (apart from loyalty).
export function lifeOf(a: Actor) {
  return a.life ?? START_LIFE;
}

// "Their life total becomes N": they gain or lose the difference.
export function setLife(state: State, a: Actor, n: number, t: number, cause: string, by?: Actor) {
  const life = lifeOf(a);
  if (a.dead || life === n) return;
  if (life < n) gainLife(state, a, n - life, t, cause);
  else loseLife(state, a, life - n, t, cause, by);
}

// `by`: whose doing it is (a land's bonder, a spell's caster), if anyone's.
export function loseLife(state: State, a: Actor, amount: number, t: number, cause: string, by?: Actor) {
  const life = lifeOf(a);
  if (a.dead || amount <= 0) return;
  a.life = life - amount;
  addLog(state, {
    kind: 'effect',
    text: `${josa(shortName(a.name), '이', '가')} ${cause}에 생명 ${amount}을 잃었다 (생명 ${a.life}).`,
    regions: [a.region],
    actors: [a.id],
    t,
  });
  if (a.life > 0) return;
  if (by && by.id !== a.id && by.kind === 'npc' && a.kind === 'npc') {
    a.life = 1;
    knockOut(state, a, t, cause, false);
  } else die(state, a, t, `${cause}에 생명이 다함`);
}

export function gainLife(state: State, a: Actor, amount: number, t: number, cause: string) {
  const life = lifeOf(a);
  if (a.dead || amount <= 0) return;
  a.lifeGained = gameDay(t);
  a.life = life + amount;
  addLog(state, {
    kind: 'effect',
    text: `${josa(shortName(a.name), '이', '가')} ${toward(cause)} 생명 ${amount}을 얻었다 (생명 ${a.life}).`,
    regions: [a.region],
    actors: [a.id],
    t,
  });
}

// "Double their life total": gain as much life as they have.
export function doubleLife(state: State, a: Actor, t: number, cause: string) {
  const life = lifeOf(a);
  if (life <= 0) return;
  gainLife(state, a, life, t, cause);
}

export function gainedLifeToday(a: Actor, t: number) {
  return a.lifeGained === gameDay(t);
}
