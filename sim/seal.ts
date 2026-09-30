// Iona, Shield of Emeria (a character's `sim.seal`): "As Iona enters, choose a color. Your
// opponents can't cast spells of the chosen color."
//
// Entering is entering a fight (user decision 2026-09-29): the first time in a day that they
// fight someone, they name a color (the LLM picks, sim/run.ts). Until 00:00, anyone they are
// fighting (their foe, or one who took them for a foe) can't cast spells of that color,
// wherever they are, player or NPC, paid for or free.
//
// It seals the color itself, not only spells (user decision 2026-09-30): a being of that color
// (their card's) has none of their powers against her side (keywords, abilities, triggers: `hasAbility`
// reads `Actor.sealedOut`), and a land of that color does nothing for them but give its mana.
import { gameDay } from './clock.ts';
import { foesOf } from './combat.ts';
import { COLOR_LABELS, creatureColors } from './mana.ts';
import type { Color } from './mana.ts';
import { addLog, npcDef, outOfTime } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { spellColors } from './world.ts';
import type { Region, SpellDef, World } from './world.ts';

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

export function setSeal(state: State, world: World, a: Actor, color: Color, t: number) {
  a.seal = { day: gameDay(t), color };
  const against = opponentsOf(state, a, t);
  addLog(state, {
    kind: 'event',
    text: `${josa(shortName(a.name), '이', '가')} ${COLOR_LABELS[color]}색을 봉인했다. 오늘 그와 맞선 이는 ${COLOR_LABELS[color]}색의 주문도 힘도 쓸 수 없다.`,
    regions: [...new Set([a.region, ...against.map((x) => x.region)])],
    actors: [a.id, ...against.map((x) => x.id)],
    t,
  });
  markSealed(state, world, t);
}

// Who keeps `caster` from casting `spell` now, if anyone.
export function sealedBy(state: State, caster: Actor, spell: SpellDef, t: number) {
  return sealedAgainst(state, caster, spellColors(spell), t);
}

// Who has sealed one of `colors` against `a` now (one they are fighting), if anyone.
export function sealedAgainst(state: State, a: Actor, colors: readonly string[], t: number) {
  return Object.values(state.actors).find((x) => {
    const c = !x.dead ? sealToday(x, t) : undefined;
    return c && colors.includes(c) && opponentsOf(state, x, t).some((o) => o.id === a.id);
  });
}

export function sealText(by: Actor, t: number) {
  return `${josa(shortName(by.name), '이', '가')} ${COLOR_LABELS[sealToday(by, t)!]}색을 봉인했다.`;
}

// A being of a color sealed against them (their card's): none of their powers, if anyone seals it.
export function powersSealed(state: State, world: World, a: Actor, t: number) {
  return sealedAgainst(state, a, creatureColors(npcDef(state, world, a.id)), t);
}

// A land of a color sealed against `a` does nothing for them (its mana still flows).
export function landSealed(state: State, a: Actor, r: Region, t: number) {
  return r.color ? sealedAgainst(state, a, r.color.split('/'), t) : undefined;
}

// Marks those whose powers are sealed today (Actor.sealedOut, read by hasAbility): each hour,
// and as a color is sealed. The seal and the foes last the day, so the mark does too.
export function markSealed(state: State, world: World, t: number) {
  for (const a of Object.values(state.actors)) if (!a.dead && powersSealed(state, world, a, t)) a.sealedOut = gameDay(t);
}
