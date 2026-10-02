// Warren Instigator (`sim.instigate`): "Whenever this deals damage to an opponent, you may put a
// Goblin creature card from your hand onto the battlefield." There are no goblin cards in hand in
// this world (user decision 2026-10-02): its cry calls a goblin of the world. Each fight hour it
// draws blood, whoever controls it (its master, or itself) may call one goblin who serves no one
// (creature type `goblin`, wherever they are) to its side: it comes running, serves the
// controller (sim/retainers.ts `bindRetainer`) and its arriving powers answer. An NPC's pick is
// the LLM's (sim/run.ts), the player's a pick they owe (sim/asks.ts).
import { callForth } from './abilities.ts';
import { masterOf, bindRetainer } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, outOfTime } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { canStay, region } from './world.ts';
import type { World } from './world.ts';

// The goblins of the world it could call: serving no one, not it, able to be where it is.
export function goblinsToCall(state: State, world: World, x: Actor) {
  const here = region(world, x.region);
  return Object.values(state.actors).filter((g) => {
    const def = npcDef(state, world, g.id);
    return g.id !== x.id && !g.dead && !g.left && !g.master && !g.seized && g.kind === 'npc' && !outOfTime(state, g) && def?.types?.includes('goblin') && canStay(here, g.abilities);
  });
}

// It drew blood in a fight: its controller may call a goblin.
export function instigate(state: State, world: World, x: Actor, t: number) {
  if (!npcDef(state, world, x.id)?.instigate || x.dead || powersSealed(state, world, x, t)) return;
  const candidates = goblinsToCall(state, world, x).map((g) => g.id);
  if (!candidates.length) return;
  const c = masterOf(state, x) ?? x;
  if ((state.choices ?? []).some((ch) => ch.effect.type === 'instigate' && ch.effect.source === x.id)) return;
  addLog(state, { kind: 'combat', text: `${josa(shortName(x.name), '이', '가')} 피를 보자 외친다: "위험이다! 위험! 안전한 굴에서 나와라!"`, regions: [x.region], actors: [x.id], t });
  (state.choices ??= []).push({ by: c.id, land: x.region, effect: { type: 'instigate', source: x.id }, candidates, optional: true, t });
}

// The goblin picked comes running and serves the controller.
export function applyInstigate(state: State, world: World, x: Actor, goblinId: string, t: number) {
  if (x.dead || !goblinsToCall(state, world, x).some((g) => g.id === goblinId)) return;
  const c = masterOf(state, x) ?? x;
  const g = callForth(state, world, goblinId, x.region, [], t, x.tile);
  if (!g) return;
  addLog(state, { kind: 'event', text: `${josa(shortName(g.name), '이', '가')} ${shortName(x.name)}의 외침을 듣고 굴에서 뛰쳐나와 곁에 섰다.`, regions: [x.region], actors: [g.id, x.id], t });
  bindRetainer(state, world, g, c, t, `${shortName(x.name)}의 외침`);
}
