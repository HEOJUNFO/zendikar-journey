// "At the beginning of your upkeep, sacrifice this creature unless you return a land you control
// to its owner's hand" (Living Tsunami, `sim.upkeep_return_land`). At 00:00 its master gives
// back one of their lands (the bond breaks; they may bond with it again) or lets it go: it
// collapses and dies. One with no master pays nothing: the sea is its own (user decision
// 2026-10-01). The master picks (the player by a pick, an NPC by the LLM after the hour).
import { die } from './combat.ts';
import { addLog, npcDef, outOfTime } from './state.ts';
import type { Actor, State } from './state.ts';
import { masterOf } from './retainers.ts';
import { josa, shortName } from './text.ts';
import { region } from './world.ts';
import type { World } from './world.ts';

export function upkeepTide(state: State, world: World, t: number) {
  for (const x of Object.values(state.actors)) {
    if (x.dead || !npcDef(state, world, x.id)?.upkeepReturnLand || outOfTime(state, x, t)) continue;
    const m = masterOf(state, x);
    if (!m || m.dead) continue;
    if (!(m.bonds ?? []).length) {
      collapse(state, x, `${shortName(m.name)}에게 내어 줄 땅이 없어`, t);
      continue;
    }
    (state.choices ??= []).push({ by: m.id, land: m.region, effect: { type: 'tide', source: x.id }, candidates: [...m.bonds!], optional: true, t });
  }
}

// Their answer: a land of theirs given back keeps it; none (or one no longer theirs), it goes.
export function answerTide(state: State, world: World, m: Actor, sourceId: string, pick: string | null, t: number) {
  const x = state.actors[sourceId];
  if (!x || x.dead || masterOf(state, x)?.id !== m.id) return;
  if (!pick || !(m.bonds ?? []).includes(pick)) {
    collapse(state, x, `${josa(shortName(m.name), '이', '가')} 땅을 내어 주지 않아`, t);
    return;
  }
  m.bonds = m.bonds!.filter((b) => b !== pick);
  addLog(state, {
    kind: 'effect',
    text: `${josa(shortName(m.name), '이', '가')} ${region(world, pick).name}과의 유대를 ${shortName(x.name)}에게 내어 주었다 (다시 맺을 수 있다). 물결이 다시 차오른다.`,
    regions: [m.region],
    actors: [m.id, x.id],
    t,
  });
}

function collapse(state: State, x: Actor, why: string, t: number) {
  addLog(state, { kind: 'event', text: `${why} ${josa(shortName(x.name), '이', '가')} 썰물처럼 무너져 흩어졌다.`, regions: [x.region], actors: [x.id], t });
  die(state, x, t, '썰물');
}
