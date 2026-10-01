// "{B}: This creature gets +1/+1 until end of turn" (Crypt Ripper; `sim.pump`): before each hour
// it stands in a fight (a foe of today on its tile), its controller (itself, or its master)
// pours as much of its mana as they will into it, each payment +P/+T until midnight (user
// decision 2026-10-01: the LLM decides how much, as it would hold mana back for a spell). An
// NPC's pick is the LLM's (sim/run.ts `pumps`), the player's a pick they owe (sim/asks.ts).
import { untapTime } from './clock.ts';
import { down, foesOf } from './combat.ts';
import { addCosts, manaAvailable, payMana, planPayment } from './mana.ts';
import { masterOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// How many times `a` could pay for its pump now (0: none, or no pump).
export function pumpMax(state: State, world: World, a: Actor, t: number) {
  const pump = npcDef(state, world, a.id)?.pump;
  if (!pump || a.dead || powersSealed(state, world, a, t)) return 0;
  const have = manaAvailable(state, world, a, t);
  let n = 0;
  let cost = pump.cost;
  while (n < 20 && planPayment(have, cost)) {
    n++;
    cost = addCosts(cost, pump.cost);
  }
  return n;
}

// Pumpers about to fight this hour, who could pay: a foe of today stands with them, up.
export function pumpsDue(state: State, world: World, t: number) {
  return Object.values(state.actors).filter(
    (a) => !down(a) && pumpMax(state, world, a, t) > 0 && foesOf(a, t).some((id) => state.actors[id] && !down(state.actors[id]) && together(a, state.actors[id])),
  );
}

// Whose pick it is: its master's, or its own.
export function pumpController(state: State, a: Actor) {
  return masterOf(state, a) ?? a;
}

// `a` pays `n` times: +nP/+nT until midnight.
export function applyPump(state: State, world: World, a: Actor, n: number, t: number) {
  const pump = npcDef(state, world, a.id)?.pump;
  const k = Math.min(n, pumpMax(state, world, a, t));
  if (!pump || k <= 0) return;
  for (let i = 0; i < k; i++) payMana(state, world, a, pump.cost, t);
  const pt: [number, number] = [pump.pt[0] * k, pump.pt[1] * k];
  a.pumps = [...(a.pumps ?? []), { pt, until: untapTime(t) }];
  addLog(state, {
    kind: 'combat',
    text: `${josa(shortName(a.name), '이', '가')} 마나 ${pump.costText}×${k}를 빨아들여 부풀었다 (자정까지 +${pt[0]}/+${pt[1]}).`,
    regions: [a.region],
    actors: [a.id],
    t,
  });
}
