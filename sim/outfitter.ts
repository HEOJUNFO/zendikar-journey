// Kor Outfitter (`sim.enter_equip`): "When this enters, you may attach target Equipment you control
// to target creature you control." On its first arrival of the day (sim/abilities.ts `onEnter`),
// its controller (master, or itself), if standing there with it (the equipment goes with them),
// may have it put one of their equipment on themselves or one who serves them there, for nothing
// (no equip cost, no hour). One pick, an item and a bearer together ("item|bearer"), or none: an
// NPC's by the LLM (sim/run.ts), the player's a pick they owe (sim/asks.ts).
import { equipmentOf, equipBlocked, equipItem, equipTargets } from './equipment.ts';
import { masterOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { npcDef, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { shortName } from './text.ts';
import type { World } from './world.ts';

export type OutfitOption = { id: string; label: string };

// What `a`'s controller could have it put on whom now.
export function outfitOptions(state: State, world: World, a: Actor, t: number): OutfitOption[] {
  if (!npcDef(state, world, a.id)?.enterEquip || a.dead || powersSealed(state, world, a, t)) return [];
  const c = masterOf(state, a) ?? a;
  if (!together(c, a)) return [];
  return equipmentOf(state, world, c).flatMap((x) =>
    equipTargets(state, c)
      .filter((b) => !equipBlocked(state, world, c, x.id, b.id, t, true))
      .map((b) => ({ id: `${x.id}|${b.id}`, label: `${x.name} → ${b.id === c.id ? `${shortName(c.name)} 자신` : shortName(b.name)}` })),
  );
}

export function enterEquip(state: State, world: World, a: Actor, t: number) {
  const options = outfitOptions(state, world, a, t);
  if (!options.length) return;
  const c = masterOf(state, a) ?? a;
  (state.choices ??= []).push({ by: c.id, land: a.region, effect: { type: 'outfit', source: a.id }, candidates: options.map((o) => o.id), optional: true, t });
}

// The pick lands: the equipment put on for nothing (if it still can be).
export function applyOutfit(state: State, world: World, source: Actor, pick: string, t: number) {
  if (!outfitOptions(state, world, source, t).some((o) => o.id === pick)) return;
  const [itemId, bearerId] = pick.split('|');
  equipItem(state, world, masterOf(state, source) ?? source, itemId, bearerId, t, `${shortName(source.name)}의 손에서`);
}
