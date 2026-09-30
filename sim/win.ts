// Winning the game (the Felidar Sovereign: "At the beginning of your upkeep, if you have 40 or
// more life, you win the game"). Its controller is its master: a beast alone is no player
// ([가공]). One who wins is named the world's winner, once; the game goes on ([결정] 2026-09-30).
import { formatClock } from './clock.ts';
import { lifeOf } from './life.ts';
import { masterOf } from './retainers.ts';
import { addLog, npcDef, outOfTime } from './state.ts';
import type { State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// At a turn's start (00:00).
export function upkeepWins(state: State, world: World, t: number) {
  for (const x of Object.values(state.actors)) {
    const need = npcDef(state, world, x.id)?.winsAtLife;
    if (need === undefined || x.dead || outOfTime(state, x, t)) continue;
    const who = masterOf(state, x);
    // Out of time: no upkeep for them today.
    if (!who || outOfTime(state, who, t) || state.winners?.some((w) => w.id === who.id)) continue;
    const life = lifeOf(who);
    if (life === null || life < need) continue;
    (state.winners ??= []).push({ id: who.id, name: who.name, at: t, by: x.name });
    addLog(state, {
      kind: 'event',
      text: `${josa(shortName(who.name), '이', '가')} ${josa(shortName(x.name), '을', '를')} 곁에 두고 생명 ${need} 이상으로 날을 맞았다. ${josa(shortName(who.name), '은', '는')} 세계의 승자다 (${formatClock(t)}).`,
      regions: [who.region],
      scope: 'world',
      actors: [who.id, x.id],
      t,
    });
  }
}

export function isWinner(state: State, id: string) {
  return !!state.winners?.some((w) => w.id === id);
}
