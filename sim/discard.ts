// "Discards a card" (Desecrated Earth): one lets go of a spell they hold (their hand) into their
// graveyard. Which is theirs to pick, as in MTG: an NPC's by the LLM, the player's as a pick they
// owe (sim/asks.ts), both after the hour (sim/run.ts `choices`). One spell, or none: no pick.
// "Discards N cards" (Mind Sludge): picked one at a time; holding no more than N, all go.
import { addLog, buryCount, random } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

export function letGo(state: State, world: World, a: Actor, spellId: string, t: number) {
  if (!a.spells?.includes(spellId)) return;
  a.spells = a.spells.filter((x) => x !== spellId);
  a.graveyard = [...(a.graveyard ?? []), spellId];
  buryCount(a, 1, t);
  const name = world.spells.find((s) => s.id === spellId)?.name ?? spellId;
  addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '이', '가')} ${josa(name, '을', '를')} 잊었다.`, regions: [a.region], actors: [a.id], t });
}

// `a` owes `count` discards for `cause`.
export function owesDiscard(state: State, world: World, a: Actor, cause: string, t: number, count = 1) {
  const hand = a.spells ?? [];
  if (!hand.length) {
    addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '은', '는')} 잊을 주문이 없었다.`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const choice = discardOwed(state, world, a, cause, t, count);
  if (choice) (state.choices ??= []).push(choice);
}

// What is left to pick of `count` discards, or null (all gone: no more than `count` held).
export function discardOwed(state: State, world: World, a: Actor, cause: string, t: number, count: number): Choice | null {
  const hand = a.spells ?? [];
  if (count <= 0 || !hand.length) return null;
  if (hand.length <= count) {
    for (const id of [...hand]) letGo(state, world, a, id, t);
    return null;
  }
  return { by: a.id, land: a.region, effect: { type: 'discard', cause, ...(count > 1 ? { count } : {}) }, candidates: [...hand], t };
}

// "Reveals N cards from their hand. You choose one of them. That player discards that card"
// (Bala Ged Thief): discarding is letting go of a spell (user decision 2026-10-01: the spells
// they hold, not the secrets they know). N of their spells, at random, are shown to `by`, who
// picks the one they let go of.
export function handOf(a: Actor) {
  return [...(a.spells ?? [])];
}

export function cardLabel(world: World, card: string) {
  return world.spells.find((s) => s.id === card)?.name ?? card;
}

// `n` of `target`'s spells shown to `by` (for `source`): what is left for `by` to pick, or null.
export function revealHand(state: State, world: World, by: Actor, source: Actor, target: Actor, n: number, t: number): Choice | null {
  const hand = handOf(target);
  if (!hand.length) {
    addLog(state, { kind: 'effect', text: `${josa(shortName(target.name), '은', '는')} 드러낼 주문이 없었다.`, regions: [target.region], actors: [target.id, source.id], t });
    return null;
  }
  const shown: string[] = [];
  const pool = [...hand];
  while (shown.length < n && pool.length) shown.push(pool.splice(Math.floor(random(state) * pool.length), 1)[0]);
  addLog(state, {
    kind: 'effect',
    text: `${josa(shortName(source.name), '이', '가')} ${shortName(target.name)}의 품을 뒤져 주문 ${shown.length}가지를 드러냈다: ${shown.map((c) => cardLabel(world, c)).join(', ')}.`,
    regions: [target.region],
    actors: [source.id, target.id, by.id],
    t,
  });
  return { by: by.id, land: target.region, effect: { type: 'pilfer', source: source.id, target: target.id }, candidates: shown, t };
}
