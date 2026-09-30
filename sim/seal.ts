// Iona, Shield of Emeria (a character's `sim.seal`): "As Iona enters, choose a color. Your
// opponents can't cast spells of the chosen color."
//
// Entering is entering a fight (user decision 2026-09-29): the first time in a day that they
// fight someone, they name a color (the LLM picks, sim/run.ts). Until 00:00, anyone they are
// fighting (their foe, or one who took them for a foe) can't cast spells of that color,
// wherever they are, player or NPC, paid for or free.
import { gameDay } from './clock.ts';
import { foesOf } from './combat.ts';
import { COLOR_LABELS } from './mana.ts';
import type { Color } from './mana.ts';
import { addLog, npcDef, outOfTime } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { spellColors } from './world.ts';
import type { SpellDef, World } from './world.ts';

// Whom `a` is fighting today: their foes, and those who took them for one.
export function opponentsOf(state: State, a: Actor, t: number) {
  return Object.values(state.actors).filter((x) => !x.dead && x.id !== a.id && (foesOf(a, t).includes(x.id) || foesOf(x, t).includes(a.id)));
}

export function sealToday(a: Actor, t: number) {
  return a.seal?.day === gameDay(t) ? a.seal.color : undefined;
}

// Those who can seal a color and are in a fight today without having named one yet.
export function sealsDue(state: State, world: World, t: number) {
  return Object.values(state.actors).filter(
    (a) => !a.dead && !outOfTime(state, a, t) && npcDef(state, world, a.id)?.seal && !sealToday(a, t) && opponentsOf(state, a, t).length > 0,
  );
}

export function setSeal(state: State, a: Actor, color: Color, t: number) {
  a.seal = { day: gameDay(t), color };
  const against = opponentsOf(state, a, t);
  addLog(state, {
    kind: 'event',
    text: `${josa(shortName(a.name), '이', '가')} ${COLOR_LABELS[color]}색을 봉인했다. 오늘 그와 맞선 이는 ${COLOR_LABELS[color]}색 주문을 쓸 수 없다.`,
    regions: [...new Set([a.region, ...against.map((x) => x.region)])],
    actors: [a.id, ...against.map((x) => x.id)],
    t,
  });
}

// Who keeps `caster` from casting `spell` now, if anyone.
export function sealedBy(state: State, caster: Actor, spell: SpellDef, t: number) {
  const colors = spellColors(spell);
  return Object.values(state.actors).find((x) => {
    const c = !x.dead ? sealToday(x, t) : undefined;
    return c && colors.includes(c) && opponentsOf(state, x, t).some((o) => o.id === caster.id);
  });
}

export function sealText(by: Actor, t: number) {
  return `${josa(shortName(by.name), '이', '가')} ${COLOR_LABELS[sealToday(by, t)!]}색을 봉인했다.`;
}
