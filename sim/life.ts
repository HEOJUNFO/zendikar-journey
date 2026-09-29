// Life (world/README.md: MTG 규칙 → 게임 대응). There is no life total: life rides on energy,
// ten energy to a point of life. Losing life can't kill, but a body drained to nothing
// collapses. Only effects that say "gain life" count as gaining it (sleep and food restore
// energy, not life).
import { gameDay } from './clock.ts';
import { applyEffect } from './rules.ts';
import { addLog, needsOf } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';

export const LIFE_ENERGY = 10;

export function loseLife(state: State, a: Actor, amount: number, cause: string) {
  if (a.dead || !needsOf(a).includes('energy') || amount <= 0) return;
  applyEffect(a.stats, { energy: -amount * LIFE_ENERGY }, 60, needsOf(a));
  addLog(state, {
    kind: 'effect',
    text: `${josa(shortName(a.name), '이', '가')} ${cause}에 생명 ${amount}을 잃었다 (기력 -${amount * LIFE_ENERGY}).`,
    regions: [a.region],
    actors: [a.id],
  });
}

export function gainLife(state: State, a: Actor, amount: number, t: number, cause: string) {
  if (a.dead) return;
  a.lifeGained = gameDay(t);
  applyEffect(a.stats, { energy: amount * LIFE_ENERGY }, 60, needsOf(a));
  addLog(state, {
    kind: 'effect',
    text: `${josa(shortName(a.name), '이', '가')} ${cause}로 생명 ${amount}을 얻었다 (기력 +${amount * LIFE_ENERGY}).`,
    regions: [a.region],
    actors: [a.id],
  });
}

// Life they have now (energy / LIFE_ENERGY), or null for those who live by no energy.
export function lifeOf(a: Actor) {
  return needsOf(a).includes('energy') ? a.stats.energy / LIFE_ENERGY : null;
}

export function gainedLifeToday(a: Actor, t: number) {
  return a.lifeGained === gameDay(t);
}
