// "Counter target creature spell" (Summoner's Bane): a creature spell is someone taking another
// into their service: a hire, one won over by talk, a beast's acknowledgment, a call to serve
// answered (world/README.md). When one is about to join someone, and another on that tile holds
// such a spell and can pay for it, the joining waits an hour (user decision 2026-10-01): the
// holder decides whether to answer it (an NPC by the LLM, sim/run.ts; the player by a pick they
// owe, sim/asks.ts). Answered, the spell is cast at the one coming in (a trap may break it in
// turn, sim/spells.ts `castSpell`): the joining comes to nothing, what was paid for it stays
// paid (a hire's coin, as a countered spell's mana), the would-be master is one refused today
// (Summoning Trap), and the rest of the spell resolves (an Illusion token serving the holder).
// It can't be cast any other way (`reactionSpell`). Left alone, the joining goes through.
import { untapTime } from './clock.ts';
import { down } from './combat.ts';
import { spawnWild } from './abilities.ts';
import { manaAvailable, parseManaCost, payMana, planPayment } from './mana.ts';
import { remember } from './relations.ts';
import { bindRetainer, controlledCreatures, masterOf, refuse } from './retainers.ts';
import { powersSealed, sealedBy } from './seal.ts';
import { castSpell, resolveSpell, spellDef, usedUntil } from './spells.ts';
import { addLog, npcDef, outOfTime, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import type { SpellDef, World } from './world.ts';

// A spell only cast in answer to another (Summoner's Bane: a creature spell, a joining; Cancel:
// any spell, joinings too).
export function reactionSpell(s: SpellDef) {
  return s.effects.some((e) => e.type === 'counter_creature' || e.type === 'counter_spell');
}

// The spell `x` could answer with now (a joining: `creature`; a spell cast: `spell`): held, not
// sealed, paid for.
function counterSpell(state: State, world: World, x: Actor, t: number, kind: 'creature' | 'spell' = 'creature') {
  return world.spells.find(
    (s) =>
      s.effects.some((e) => (e.type === 'counter_spell' && !(kind === 'creature' && e.noncreature)) || (kind === 'creature' && e.type === 'counter_creature')) &&
      x.spells?.includes(s.id) &&
      usedUntil(x, s, t) === undefined &&
      !sealedBy(state, x, s, t) &&
      !!planPayment(manaAvailable(state, world, x, t), s.cost),
  );
}

// Lullmage Mentor: "Tap seven untapped Merfolk you control: Counter target spell." The answer's id
// for it: this prefix and the mentor's id.
const CHORUS = 'chorus:';
const CHORUS_SIZE = 7;

function isMerfolk(state: State, world: World, x: Actor) {
  return (npcDef(state, world, x.id)?.types ?? []).includes('merfolk');
}

// The seven (or more) merfolk `x` controls standing with them, awake and unbound, if they have a
// mentor among those they control whose power is theirs to use.
function chorus(state: State, world: World, x: Actor, t: number) {
  const mine = controlledCreatures(state, world, x).filter((y) => !y.dead && !down(y) && together(y, x) && !outOfTime(state, y, t));
  const mentor = mine.find((y) => npcDef(state, world, y.id)?.counterTokens && !powersSealed(state, world, y, t));
  const voices = mine.filter((y) => isMerfolk(state, world, y) && y.boundUntil === undefined);
  return mentor && voices.length >= CHORUS_SIZE ? { mentor, voices: voices.slice(0, CHORUS_SIZE) } : undefined;
}

// What `x` would answer with now: a spell's id, or the mentor's chorus.
function answerOf(state: State, world: World, x: Actor, t: number, kind: 'creature' | 'spell') {
  const s = counterSpell(state, world, x, t, kind);
  if (s) return s.id;
  const c = chorus(state, world, x, t);
  return c ? `${CHORUS}${c.mentor.id}` : undefined;
}

// The answer's name and price, to speak of it.
export function answerName(world: World, id: string) {
  if (id.startsWith(CHORUS)) return { name: '잠재움의 합창', costText: `곁의 인어 ${CHORUS_SIZE}을 묶어`, chorus: true };
  const s = spellDef(world, id);
  return { name: s?.name ?? id, costText: s?.costText ?? '', chorus: false };
}

// The price a spell answered by `id` may still be saved with ("unless its controller pays").
function unlessOf(world: World, id: string) {
  const e = spellDef(world, id)?.effects.find((x) => x.type === 'counter_spell');
  return e?.type === 'counter_spell' && e.unless ? { cost: parseManaCost(e.unless)!, text: e.unless } : undefined;
}

// Those standing with `at` who could answer (not those named in `not`).
function holders(state: State, world: World, at: Actor, not: string[], t: number, kind: 'creature' | 'spell') {
  return Object.values(state.actors).filter(
    (x) => !not.includes(x.id) && !x.dead && !down(x) && !outOfTime(state, x, t) && together(x, at) && !!answerOf(state, world, x, t, kind),
  );
}

// `holder` answers with `id`, if they still can. Returns whether the answer stands (a spell may
// be broken in turn by a trap). The chorus binds its seven until midnight.
function answer(state: State, world: World, holder: Actor, id: string, targetId: string, kind: 'creature' | 'spell', t: number) {
  if (answerOf(state, world, holder, t, kind) !== id) return false;
  if (id.startsWith(CHORUS)) {
    const c = chorus(state, world, holder, t)!;
    for (const y of c.voices) y.boundUntil = untapTime(t);
    addLog(state, { kind: 'effect', text: `${shortName(c.mentor.name)}의 선창에 인어 ${CHORUS_SIZE}이 한목소리로 노래해 엮이던 힘을 잠재웠다 (자정까지 묶임).`, regions: [holder.region], actors: [holder.id, ...c.voices.map((y) => y.id)], t });
    return true;
  }
  return castSpell(state, world, holder, id, targetId, false, t) === true;
}

// "Whenever a spell or ability you control counters a spell, you may create a 1/1 blue Merfolk
// creature token" (Lullmage Mentor): for each mentor `holder` controls, one born at their side,
// theirs (always: a boon).
function counterTokens(state: State, world: World, holder: Actor, t: number) {
  const mentors = Object.values(state.actors).filter((y) => !y.dead && npcDef(state, world, y.id)?.counterTokens && (masterOf(state, y) ?? y).id === holder.id && !powersSealed(state, world, y, t));
  for (const m of mentors) {
    const tok = npcDef(state, world, m.id)!.counterTokens!;
    const [born] = spawnWild(state, world, tok.creature, tok.pt, 1, holder.region, tok.colors, holder.tile);
    state.tokens![born.id].types = ['merfolk'];
    born.master = holder.id;
    born.enteredAt = t;
    addLog(state, { kind: 'event', text: `${shortName(m.name)}의 가르침을 따라 ${josa(shortName(born.name), '이', '가')} ${shortName(holder.name)}의 곁에 나타났다 (${tok.pt.join('/')}).`, regions: [holder.region], actors: [holder.id, born.id, m.id], t });
  }
}

// Those on `master`'s tile who could answer `joiner` joining them: not the two of them.
export function counterHolders(state: State, world: World, joiner: Actor, master: Actor, t: number) {
  return holders(state, world, master, [joiner.id, master.id], t, 'creature');
}

// `joiner` is to serve `master` (`how`: 고용, 설득, 인정). With someone there able to answer it,
// it waits for them, an hour; otherwise it is done now.
export function summon(state: State, world: World, joiner: Actor, master: Actor, t: number, how: string) {
  const holder = counterHolders(state, world, joiner, master, t)[0];
  if (!holder) return bindRetainer(state, world, joiner, master, t, how);
  const spell = answerOf(state, world, holder, t, 'creature')!;
  (state.choices ??= []).push({ by: holder.id, land: master.region, effect: { type: 'counter', spell, joiner: joiner.id, master: master.id, how }, candidates: [joiner.id], optional: true, t });
  addLog(state, {
    kind: 'status',
    text: `${josa(shortName(joiner.name), '이', '가')} ${shortName(master.name)}의 곁에 들려는 참이다 (${how}).`,
    regions: [master.region],
    actors: [joiner.id, master.id],
    t,
  });
}

// The holder's answer: `counter` to cast the spell at it, or not. The joining goes through
// unless the spell is cast and stands.
export function answerCounter(state: State, world: World, holder: Actor | undefined, eff: { spell: string; joiner: string; master: string; how: string }, counter: boolean, t: number) {
  const [joiner, master] = [state.actors[eff.joiner], state.actors[eff.master]];
  if (!joiner || !master || joiner.dead || master.dead || joiner.master) return;
  const s = answerName(world, eff.spell);
  if (counter && holder && !holder.dead && answer(state, world, holder, eff.spell, joiner.id, 'creature', t)) {
    addLog(state, {
      kind: 'event',
      text: `${shortName(master.name)}의 부름이 무산되었다: ${josa(shortName(joiner.name), '은', '는')} 그의 곁에 들지 못했다.`,
      regions: [master.region],
      actors: [master.id, joiner.id, holder.id],
      t,
    });
    refuse(state, master, t);
    remember(master, holder, `${josa(shortName(joiner.name), '을', '를')} 들이려던 나의 부름을 ${toward(s.name)} 무산시켰다`, t);
    counterTokens(state, world, holder, t);
    return;
  }
  bindRetainer(state, world, joiner, master, t, eff.how);
}

// "Counter target spell" (Cancel): `a` cast `s` (paid for) with someone there holding one. It
// waits an hour on them; returns whether it does.
export function holdCast(state: State, world: World, a: Actor, s: SpellDef, targetId: string, kicked: boolean, t: number) {
  const holder = holders(state, world, a, [a.id], t, 'spell')[0];
  if (!holder) return false;
  const spell = answerOf(state, world, holder, t, 'spell')!;
  (state.choices ??= []).push({ by: holder.id, land: a.region, effect: { type: 'counter_cast', spell, caster: a.id, cast: s.id, target: targetId, kicked }, candidates: [a.id], optional: true, t });
  addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} ${josa(s.name, '을', '를')} 엮는다. 마나가 허공에서 맴돈다 (한 시간 뒤 풀린다).`, regions: [a.region], actors: [a.id], t });
  return true;
}

// The holder's answer to a spell cast: `counter` to cast theirs at it. Unless it is cast and
// stands, the spell takes hold.
export function answerCounterCast(state: State, world: World, holder: Actor | undefined, eff: { spell: string; caster: string; cast: string; target: string; kicked: boolean }, counter: boolean, t: number) {
  const caster = state.actors[eff.caster];
  const cast = spellDef(world, eff.cast);
  if (!caster || caster.dead || !cast) return;
  const s = answerName(world, eff.spell);
  if (counter && holder && !holder.dead && answer(state, world, holder, eff.spell, caster.id, 'spell', t)) {
    // Spell Pierce: "unless its controller pays {2}" (paid for them if they can: [가공]).
    const unless = unlessOf(world, eff.spell);
    if (unless && payMana(state, world, caster, unless.cost, t)) {
      addLog(state, { kind: 'event', text: `${shortName(caster.name)}이(가) 힘(${unless.text})을 더 쏟아 ${s.name}의 구멍을 메웠다. ${josa(cast.name, '이', '가')} 그대로 풀린다.`, regions: [caster.region], actors: [caster.id, holder.id], t });
      resolveSpell(state, world, caster, cast.id, eff.target, eff.kicked, t);
      return;
    }
    addLog(state, { kind: 'event', text: `${shortName(caster.name)}의 ${josa(cast.name, '이', '가')} 허공에서 흩어졌다. 치른 마나는 돌아오지 않는다.`, regions: [caster.region], actors: [caster.id, holder.id], t });
    remember(caster, holder, `나의 ${josa(cast.name, '을', '를')} ${toward(s.name)} 무산시켰다`, t);
    counterTokens(state, world, holder, t);
    return;
  }
  resolveSpell(state, world, caster, cast.id, eff.target, eff.kicked, t);
}
