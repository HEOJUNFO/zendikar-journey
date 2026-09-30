// Beings of the sea (`aquatic`) on land (a Summoning Trap draws them there, sim/abilities.ts
// `callForth`): they can't cross land but toward the sea, crawling (CRAWL_FACTOR times as
// long); out of water they dry out, 1 toughness every DRY_HOURS (user decision 2026-09-30),
// until they reach the sea or die of it. They may stay and fight where they lie. Back in the
// water, they recover at the next 00:00.
import { minuteOfDay } from './clock.ts';
import { die, woundsOf } from './combat.ts';
import { addLog, alive, outOfTime, ptOf } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { region, TERRAINS } from './world.ts';
import type { World } from './world.ts';

export const DRY_HOURS = 3;
export const CRAWL_FACTOR = 2;

export function stranded(world: World, a: Actor) {
  return a.abilities.includes('aquatic') && !TERRAINS[region(world, a.region).terrain].sea;
}

// What it means for them, for their plan.
export function strandedText(world: World, a: Actor) {
  return stranded(world, a)
    ? `stranded out of water on land: they lose 1 toughness every ${DRY_HOURS} hours until they die, unless they reach the sea (crawling there takes ${CRAWL_FACTOR} times as long); they may also stay and fight where they lie`
    : undefined;
}

// Each hour: those out of water dry out; those back in it recover at 00:00.
export function dryOut(state: State, world: World, t: number) {
  for (const a of alive(state)) {
    if (outOfTime(state, a, t)) continue;
    const name = shortName(a.name);
    if (!stranded(world, a)) {
      delete a.strandedSince;
      if (a.dried && minuteOfDay(t) === 0) {
        delete a.dried;
        addLog(state, { kind: 'status', text: `${josa(name, '이', '가')} 물속에서 되살아났다 (${ptOf(a).join('/')}).`, regions: [a.region], actors: [a.id], t });
      }
      continue;
    }
    if (a.strandedSince === undefined) {
      a.strandedSince = t;
      addLog(state, { kind: 'status', text: `${josa(name, '이', '가')} 물 밖에서 말라 가기 시작했다.`, regions: [a.region], actors: [a.id], t });
      continue;
    }
    if (t === a.strandedSince || (t - a.strandedSince) % (DRY_HOURS * 60) !== 0) continue;
    a.dried = (a.dried ?? 0) + 1;
    const [, toughness] = ptOf(a);
    addLog(state, { kind: 'status', text: `${josa(name, '이', '가')} 말라 간다 (${ptOf(a).join('/')}).`, regions: [a.region], actors: [a.id], t });
    if (toughness <= 0 || woundsOf(a, t) >= toughness) die(state, a, t, '물 밖에서 말라 죽음');
  }
}
