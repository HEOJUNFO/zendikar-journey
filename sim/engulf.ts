// Gomazoa (`sim.engulf`): "{T}: Put this creature and each creature it's blocking on top of their
// owners' libraries." In this world (user decision 2026-10-01), a flytrap: it never falls on
// anyone (defender), but one who falls on it, or on its master with it there (blocking), may be
// wrapped in its tentacles and dragged off, the two of them, to where it lives. Before each hour
// that fight goes on, its controller decides: an NPC master by the LLM, the player by a pick they
// owe (sim/run.ts `engulfs`, sim/asks.ts); one with no master snaps shut by itself, as a flytrap
// does. Both leave play and come back (to a library): all that was on them falls away and so
// does whoever controlled them (sim/bounce.ts `shed`); a token is eaten, gone. The one caught
// lies bound in the tentacles for a few hours, the gomazoa feeds and is tapped (bound) until
// midnight.
import { untapTime } from './clock.ts';
import { down, foesOf } from './combat.ts';
import { shed, vanishToken } from './bounce.ts';
import { remember } from './relations.ts';
import { masterOf } from './retainers.ts';
import { KO_ACTIVITY } from './rules.ts';
import { powersSealed } from './seal.ts';
import { addLog, needsOf, npcDef, outOfTime, protectedFrom, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { homeTile } from './tiles.ts';
import { canStay, region } from './world.ts';
import type { World } from './world.ts';

// Hours the one caught lies bound in the tentacles.
export const ENGULF_HOURS = 4;

// Those `a` is blocking now: on its tile, who fell on it today, or fell first on its master
// standing there. Creatures (no planeswalker), not protected from blue (it can't block them),
// who could be where it lives.
export function engulfTargets(state: State, world: World, a: Actor, t: number): Actor[] {
  const def = npcDef(state, world, a.id);
  if (!def?.engulf || down(a) || a.boundUntil !== undefined || outOfTime(state, a, t) || powersSealed(state, world, a, t)) return [];
  const m = masterOf(state, a);
  const ids = new Set([...foesOf(a, t), ...(m && together(m, a) ? foesOf(m, t).filter((id) => m.foes?.struck?.includes(id)) : [])]);
  const home = region(world, def.home);
  return [...ids]
    .map((id) => state.actors[id])
    .filter((x) => x && x.id !== a.id && !down(x) && x.loyalty === undefined && together(a, x) && !protectedFrom(x, ['U'], t) && canStay(home, x.abilities));
}

// Gomazoas with someone to catch this hour.
export function engulfsDue(state: State, world: World, t: number) {
  return Object.values(state.actors).filter((a) => engulfTargets(state, world, a, t).length > 0);
}

// `a` wraps `target` and drags them both off to where it lives.
export function applyEngulf(state: State, world: World, a: Actor, target: Actor, t: number) {
  const def = npcDef(state, world, a.id);
  if (!def?.engulf || !engulfTargets(state, world, a, t).some((x) => x.id === target.id)) return;
  const [name, prey] = [shortName(a.name), shortName(target.name)];
  const cause = `${name}의 촉수`;
  const home = region(world, def.home);
  addLog(state, { kind: 'combat', text: `${josa(name, '이', '가')} 붉은 촉수로 ${josa(prey, '을', '를')} 휘감아, 함께 하늘로 떠올라 ${home.name} 쪽으로 끌고 간다.`, regions: [a.region], actors: [a.id, target.id], t });
  // Off the field, no longer foes of today: what comes back is not what left.
  for (const [x, y] of [[a, target], [target, a]] as const) if (x.foes) x.foes = { ...x.foes, ids: x.foes.ids.filter((id) => id !== y.id), struck: x.foes.struck?.filter((id) => id !== y.id) };
  const tile = homeTile(world, def);
  const drag = (x: Actor) => {
    shed(state, world, x, cause);
    Object.assign(x, { region: home.id, tile, task: undefined, travel: undefined, forced: undefined });
  };
  if (state.tokens?.[target.id]) vanishToken(state, target, t, cause, '촉수 속에서 녹아 흔적도 없이 사라졌다.');
  else {
    drag(target);
    target.forced = { kind: 'sleep', activity: KO_ACTIVITY, emoji: '🪼', until: t + ENGULF_HOURS * 60 };
    remember(target, a, `나를 촉수로 휘감아 ${home.name}까지 끌고 갔다`, t);
    addLog(state, { kind: 'event', text: `${cause}: ${josa(prey, '은', '는')} ${home.name}에 끌려와 몸에 붙었던 힘을 모두 잃고, 촉수에 묶여 ${ENGULF_HOURS}시간 꼼짝 못 한다.`, regions: [home.id], actors: [target.id, a.id], t });
  }
  if (state.tokens?.[a.id]) return vanishToken(state, a, t, cause, '먹이와 함께 하늘로 사라졌다.');
  drag(a);
  a.boundUntil = untapTime(t);
  if (needsOf(a).includes('hunger')) a.stats.hunger = 0;
}
