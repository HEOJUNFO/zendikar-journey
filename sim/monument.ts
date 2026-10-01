// Items that bless the creatures their owner controls, at a price (Eldrazi Monument): "creatures
// you control get +P/+T and have <abilities>" (`anthem`), and "at the beginning of your upkeep,
// sacrifice a creature; if you can't, sacrifice this" (`upkeep_sacrifice`): the owner may give up
// the item instead (user decision 2026-10-01). The creatures one
// controls are themselves and their retainers, the player too (user decision 2026-10-01: one
// rule everywhere); planeswalkers are no creatures. What is sacrificed is the owner's pick: an NPC's
// by the LLM, the player's as a pick they owe (sim/run.ts `choices`).
import { die } from './combat.ts';
import { itemDef } from './items.ts';
import { controlledCreatures, masterOf } from './retainers.ts';
import { addLog, alive, npcDef, ptOf } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { Ability, World } from './world.ts';

export { controlledCreatures };

// Items held, not gone, with an effect of this type.
function heldWith<T extends string>(state: State, world: World, type: T) {
  return Object.entries(state.items ?? {})
    .filter(([, s]) => s.owner && !s.gone)
    .map(([id, s]) => ({ id, s, def: itemDef(world, id)! }))
    .filter((x) => x.def?.effects.some((e) => e.type === type));
}

// Each hour: who is blessed now, and by how much. What they were given and no longer are is
// taken back (their own abilities stay).
export function anthemHour(state: State, world: World) {
  const want = new Map<string, { pt: [number, number]; abilities: Ability[] }>();
  for (const { s, def } of heldWith(state, world, 'anthem')) {
    const owner = state.actors[s.owner!];
    if (!owner || owner.dead) continue;
    for (const eff of def.effects) {
      if (eff.type !== 'anthem') continue;
      // Only with enough quest counters on it (Beastmaster Ascension).
      if (eff.counters && s.counters < eff.counters) continue;
      for (const x of controlledCreatures(state, world, owner)) {
        const w = want.get(x.id) ?? { pt: [0, 0], abilities: [] };
        want.set(x.id, { pt: [w.pt[0] + eff.pt[0], w.pt[1] + eff.pt[1]], abilities: [...new Set([...w.abilities, ...eff.abilities])] });
      }
    }
  }
  // "Other <type> creatures you control get +P/+T for each Equipment attached to this" (Armament
  // Master): what it bears, for the others of that type its controller has.
  for (const x of alive(state)) {
    const ea = npcDef(state, world, x.id)?.equipAnthem;
    if (!ea) continue;
    const n = Object.values(state.items ?? {}).filter((s) => s.bearer === x.id && !s.gone).length;
    if (!n) continue;
    const controller = masterOf(state, x) ?? x;
    for (const y of controlledCreatures(state, world, controller)) {
      if (y.id === x.id || !(npcDef(state, world, y.id)?.types ?? []).includes(ea.kind)) continue;
      const w = want.get(y.id) ?? { pt: [0, 0], abilities: [] };
      want.set(y.id, { pt: [w.pt[0] + ea.pt[0] * n, w.pt[1] + ea.pt[1] * n], abilities: w.abilities });
    }
  }
  for (const a of alive(state)) {
    const w = want.get(a.id);
    if (!w && !a.anthem) continue;
    if (a.anthem) a.abilities = a.abilities.filter((x) => !a.anthem!.added.includes(x));
    if (!w) {
      delete a.anthem;
      continue;
    }
    const added = w.abilities.filter((x) => !a.abilities.includes(x));
    a.abilities = [...a.abilities, ...added];
    a.anthem = { pt: w.pt, added };
  }
}

// The upkeep (00:00): each owner owes a creature, or the item is gone.
export function upkeepSacrifice(state: State, world: World, t: number) {
  for (const { id, s, def } of heldWith(state, world, 'upkeep_sacrifice')) {
    const owner = state.actors[s.owner!];
    if (!owner || owner.dead) continue;
    const creatures = controlledCreatures(state, world, owner);
    if (!creatures.length) {
      crumble(state, world, owner, id, t, '바칠 것이 없어');
      continue;
    }
    (state.choices ??= []).push({ by: owner.id, land: owner.region, effect: { type: 'sacrifice', item: id }, candidates: creatures.map((x) => x.id), t });
  }
}

// The owner gives up the item itself instead (user decision 2026-10-01: they are a creature they
// control, so "if you can't" would never come; they may let it go rather than give themselves).
export function crumble(state: State, world: World, owner: Actor, itemId: string, t: number, why: string) {
  const s = state.items?.[itemId];
  if (!s || s.gone) return;
  const name = itemDef(world, itemId)?.name ?? s.name;
  state.items![itemId] = { ...s, owner: undefined, gone: true };
  addLog(state, { kind: 'event', text: `${why} ${josa(name, '이', '가')} 무너져 사라졌다.`, regions: [owner.region], actors: [owner.id], scope: 'world', t });
}

// What a sacrifice owed comes to when no usable answer is given: the weakest of those who serve
// them, or else the item itself (never themselves unasked).
export function sacrificeDefault(state: State, owner: Actor, candidates: Actor[]) {
  return [...candidates].filter((x) => x.id !== owner.id).sort((p, q) => ptOf(p)[1] - ptOf(q)[1] || p.id.localeCompare(q.id))[0];
}

export function sacrifice(state: State, world: World, x: Actor, itemId: string, t: number) {
  if (x.dead) return;
  const name = itemDef(world, itemId)?.name ?? itemId;
  addLog(state, { kind: 'event', text: `${josa(shortName(x.name), '이', '가')} ${name}에 바쳐졌다.`, regions: [x.region], actors: [x.id], t });
  die(state, x, t, `${name}에 바쳐짐`);
}
