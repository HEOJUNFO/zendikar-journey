// Items that bless the creatures their owner controls, at a price (Eldrazi Monument): "creatures
// you control get +P/+T and have <abilities>" (`anthem`), and "at the beginning of your upkeep,
// sacrifice a creature; if you can't, sacrifice this" (`upkeep_sacrifice`). The creatures one
// controls are their retainers, and themselves if they are a creature card's character (the
// player and planeswalkers are not creatures). What is sacrificed is the owner's pick: an NPC's
// by the LLM, the player's as a pick they owe (sim/run.ts `choices`).
import { die } from './combat.ts';
import { itemDef } from './items.ts';
import { retainersOf } from './retainers.ts';
import { addLog, alive } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { Ability, World } from './world.ts';

export function controlledCreatures(state: State, world: World, owner: Actor) {
  const self = owner.kind === 'npc' && world.npcs.some((n) => n.id === owner.id && n.loyalty === undefined) ? [owner] : [];
  return [...self, ...retainersOf(state, owner.id)].filter((x) => !x.dead);
}

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
      for (const x of controlledCreatures(state, world, owner)) {
        const w = want.get(x.id) ?? { pt: [0, 0], abilities: [] };
        want.set(x.id, { pt: [w.pt[0] + eff.pt[0], w.pt[1] + eff.pt[1]], abilities: [...new Set([...w.abilities, ...eff.abilities])] });
      }
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
      state.items![id] = { ...s, owner: undefined, gone: true };
      addLog(state, { kind: 'event', text: `바칠 것이 없어 ${josa(def.name, '이', '가')} 무너져 사라졌다.`, regions: [owner.region], actors: [owner.id], scope: 'world', t });
      continue;
    }
    (state.choices ??= []).push({ by: owner.id, land: owner.region, effect: { type: 'sacrifice', item: id }, candidates: creatures.map((x) => x.id), t });
  }
}

export function sacrifice(state: State, world: World, x: Actor, itemId: string, t: number) {
  if (x.dead) return;
  const name = itemDef(world, itemId)?.name ?? itemId;
  addLog(state, { kind: 'event', text: `${josa(shortName(x.name), '이', '가')} ${name}에 바쳐졌다.`, regions: [x.region], actors: [x.id], t });
  die(state, x, t, `${name}에 바쳐짐`);
}
