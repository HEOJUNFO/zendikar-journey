// Oracle of Mul Daya (`sim.extra_lands`, `sim.reveal_top`): "You may play an additional land on
// each of your turns" — whoever controls one (itself, or its master) may bond with one more land
// a day, for each. "Play with the top card of your library revealed. You may play lands from the
// top of your library" — at each 00:00 a land of the whole world, at random, is revealed as the
// top of their library; if they don't hold it yet (nor is it in ruins), they may bond with it
// from afar that day, as their land for the day (user decision 2026-10-01: lands they already
// hold come up too, and are no use — the penalty of a top that isn't a land to play).
import { gameDay } from './clock.ts';
import { masterOf, retainersOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, alive, npcDef, outOfTime, random } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { landIdOf, region } from './world.ts';
import type { World } from './world.ts';

// The oracles `a` controls (themselves, their retainers), alive, their powers unsealed.
function oraclesOf(state: State, world: World, a: Actor, t: number) {
  return [a, ...retainersOf(state, a.id)].filter((x) => !x.dead && (npcDef(state, world, x.id)?.extraLands || npcDef(state, world, x.id)?.revealTop) && !powersSealed(state, world, x, t));
}

// How many lands more than one `a` may bond with a day.
export function extraLandDrops(state: State, world: World, a: Actor, t: number) {
  return oraclesOf(state, world, a, t).reduce((n, x) => n + (npcDef(state, world, x.id)?.extraLands ?? 0), 0);
}

// Every land of the world, once (one land in two places counts once).
function allLands(world: World) {
  return [...new Set(world.regions.filter((r) => !r.notLand && !r.wanders).map((r) => landIdOf(world, r.id)))];
}

// At 00:00: the top of their library, for each who controls an oracle that reveals it.
export function upkeepOracle(state: State, world: World, t: number) {
  const lands = allLands(world);
  if (!lands.length) return;
  for (const a of alive(state)) {
    if (masterOf(state, a) || outOfTime(state, a, t)) continue;
    const seer = oraclesOf(state, world, a, t).find((x) => npcDef(state, world, x.id)?.revealTop);
    if (!seer) continue;
    const land = lands[Math.floor(random(state) * lands.length)];
    a.topLand = { day: gameDay(t), land };
    const useless = (a.bonds ?? []).includes(land) ? ' 이미 이어진 땅이라 오늘은 쓸 데가 없다.' : state.regions[land]?.destroyed ? ' 부서진 땅이라 오늘은 쓸 데가 없다.' : ' 오늘은 멀리서도 유대를 맺을 수 있다.';
    addLog(state, {
      kind: 'status',
      text: `${shortName(seer.name)}${seer.id === a.id ? '' : `의 눈`}에 땅의 앞날이 비쳤다: ${josa(shortName(a.name), '이', '가')} 다음에 맺을 땅은 ${region(world, land).name}.${useless}`,
      regions: [a.region],
      actors: [a.id, seer.id],
      t,
    });
  }
}

// The land revealed on top of `a`'s library today, if any.
export function topLand(state: State, a: Actor, t: number) {
  return a.topLand?.day === gameDay(t) ? a.topLand.land : undefined;
}

// Why `a` can't bond from afar with the land on top today, or null.
export function topBlocked(state: State, world: World, a: Actor, toId: string, t: number, bondBlocked: (t: number) => string | null) {
  const land = topLand(state, a, t);
  if (!land || land !== landIdOf(world, toId)) return '서고 맨 위에 그 땅이 드러나지 않았다.';
  if (!oraclesOf(state, world, a, t).some((x) => npcDef(state, world, x.id)?.revealTop)) return '앞날을 비춰 줄 신탁자가 곁에 없다.';
  if ((a.bonds ?? []).includes(land)) return `이미 ${region(world, land).name}과 이어져 있다.`;
  if (a.exiledLands?.includes(land)) return `${region(world, land).name}과의 유대는 추방되어 다시는 맺을 수 없다.`;
  if (state.regions[land]?.destroyed) return '부서진 땅과는 유대를 맺을 수 없다.';
  // Their land for the day: the day's count holds.
  return bondBlocked(t);
}
