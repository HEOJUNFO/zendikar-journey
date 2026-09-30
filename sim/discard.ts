// "Discards a card" (Desecrated Earth): one lets go of a spell they hold (their hand) into their
// graveyard. Which is theirs to pick, as in MTG: an NPC's by the LLM, the player's as a pick they
// owe (sim/asks.ts), both after the hour (sim/run.ts `choices`). One spell, or none: no pick.
import { addLog } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

export function letGo(state: State, world: World, a: Actor, spellId: string, t: number) {
  if (!a.spells?.includes(spellId)) return;
  a.spells = a.spells.filter((x) => x !== spellId);
  a.graveyard = [...(a.graveyard ?? []), spellId];
  const name = world.spells.find((s) => s.id === spellId)?.name ?? spellId;
  addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '이', '가')} ${josa(name, '을', '를')} 잊었다.`, regions: [a.region], actors: [a.id], t });
}

// `a` owes a discard for `cause`.
export function owesDiscard(state: State, world: World, a: Actor, cause: string, t: number) {
  const hand = a.spells ?? [];
  if (!hand.length) {
    addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '은', '는')} 잊을 주문이 없었다.`, regions: [a.region], actors: [a.id], t });
    return;
  }
  if (hand.length === 1) return letGo(state, world, a, hand[0], t);
  (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'discard', cause }, candidates: [...hand], t });
}
