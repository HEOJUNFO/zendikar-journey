// Goblin Shortcutter (`sim.enter_no_block`): "When this enters, target creature can't block this
// turn." On its first arrival of the day (sim/abilities.ts `onEnter`), its controller (master, or
// itself) picks one on its tile (no planeswalker), after the hour; one must be. That one can't
// block until midnight: can't stand against one who falls on their master (the ability
// `cant_block`, as Hagra Crocodile's; they still strike back at one who falls on them).
import { untapTime } from './clock.ts';
import { creatureColors } from './mana.ts';
import { masterOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, present, targetable, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

export function shortcutTargets(state: State, world: World, a: Actor, t: number): Actor[] {
  if (!npcDef(state, world, a.id)?.enterNoBlock || a.dead || powersSealed(state, world, a, t)) return [];
  return present(state, a.region, a.tile).filter((x) => x.id !== a.id && !x.dead && x.loyalty === undefined && targetable(x, t, creatureColors(npcDef(state, world, a.id))));
}

export function enterNoBlock(state: State, world: World, a: Actor, t: number) {
  const candidates = shortcutTargets(state, world, a, t).map((x) => x.id);
  if (!candidates.length) return;
  const controller = masterOf(state, a) ?? a;
  (state.choices ??= []).push({ by: controller.id, land: a.region, effect: { type: 'shortcut', source: a.id }, candidates, t });
}

export function applyShortcut(state: State, world: World, source: Actor, target: Actor, t: number) {
  if (!together(source, target) || !shortcutTargets(state, world, source, t).some((x) => x.id === target.id)) return;
  const until = untapTime(t);
  if (!target.abilities.includes('cant_block') || target.granted?.some((g) => g.ability === 'cant_block')) {
    target.granted = [...(target.granted ?? []).filter((g) => g.ability !== 'cant_block'), { ability: 'cant_block', until }];
    if (!target.abilities.includes('cant_block')) target.abilities = [...target.abilities, 'cant_block'];
  }
  addLog(state, { kind: 'combat', text: `${josa(shortName(source.name), '이', '가')} 지름길로 빠져나가며 ${josa(shortName(target.name), '을', '를')} 휘저어 놓았다. ${josa(shortName(target.name), '은', '는')} 자정까지 누구도 막아 주지 못한다.`, regions: [source.region], actors: [source.id, target.id], t });
}
