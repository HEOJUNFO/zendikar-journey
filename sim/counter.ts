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
import { down } from './combat.ts';
import { manaAvailable, planPayment } from './mana.ts';
import { remember } from './relations.ts';
import { bindRetainer, refuse } from './retainers.ts';
import { sealedBy } from './seal.ts';
import { castSpell, spellDef } from './spells.ts';
import { addLog, outOfTime, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import type { SpellDef, World } from './world.ts';

// A spell only cast in answer to someone joining another (Summoner's Bane).
export function reactionSpell(s: SpellDef) {
  return s.effects.some((e) => e.type === 'counter_creature');
}

// The spell `x` could answer `master`'s joining with now: held, not sealed, paid for.
function counterSpell(state: State, world: World, x: Actor, t: number) {
  return world.spells.find(
    (s) => reactionSpell(s) && x.spells?.includes(s.id) && !sealedBy(state, x, s, t) && !!planPayment(manaAvailable(state, world, x, t), s.cost),
  );
}

// Those on `master`'s tile who could answer `joiner` joining them: not the two of them.
export function counterHolders(state: State, world: World, joiner: Actor, master: Actor, t: number) {
  return Object.values(state.actors).filter(
    (x) => x.id !== joiner.id && x.id !== master.id && !x.dead && !down(x) && !outOfTime(state, x, t) && together(x, master) && !!counterSpell(state, world, x, t),
  );
}

// `joiner` is to serve `master` (`how`: 고용, 설득, 인정). With someone there able to answer it,
// it waits for them, an hour; otherwise it is done now.
export function summon(state: State, world: World, joiner: Actor, master: Actor, t: number, how: string) {
  const holder = counterHolders(state, world, joiner, master, t)[0];
  if (!holder) return bindRetainer(state, world, joiner, master, t, how);
  const spell = counterSpell(state, world, holder, t)!;
  (state.choices ??= []).push({ by: holder.id, land: master.region, effect: { type: 'counter', spell: spell.id, joiner: joiner.id, master: master.id, how }, candidates: [joiner.id], optional: true, t });
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
  const s = spellDef(world, eff.spell);
  const able = !!holder && !!s && !holder.dead && counterSpell(state, world, holder, t)?.id === s.id;
  if (counter && able && castSpell(state, world, holder, s.id, joiner.id, false, t)) {
    addLog(state, {
      kind: 'event',
      text: `${shortName(master.name)}의 부름이 무산되었다: ${josa(shortName(joiner.name), '은', '는')} 그의 곁에 들지 못했다.`,
      regions: [master.region],
      actors: [master.id, joiner.id, holder.id],
      t,
    });
    refuse(state, master, t);
    remember(master, holder, `${josa(shortName(joiner.name), '을', '를')} 들이려던 나의 부름을 ${toward(s.name)} 무산시켰다`, t);
    return;
  }
  bindRetainer(state, world, joiner, master, t, eff.how);
}
