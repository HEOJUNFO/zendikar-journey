// Kor Hookmaster (`sim.enter_tap`): "When this enters, tap target creature an opponent controls.
// That creature doesn't untap during its controller's next untap step." On its first arrival of
// the day (sim/abilities.ts `onEnter`), its controller (master, or itself) picks one on its tile
// not of its side (not a planeswalker: no creature), after the hour; one there must be picked.
// They are bound in its ropes past the next 00:00, until the one after (tap = bound; the skipped
// untap, as a trap's `skip_untap`), and take it for a foe.
import { formatClock, untapTime } from './clock.ts';
import { addFoe } from './combat.ts';
import { creatureColors } from './mana.ts';
import { remember } from './relations.ts';
import { masterOf, retainersOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, present, targetable, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// Whom `a` could hook now.
export function hookTargets(state: State, world: World, a: Actor, t: number): Actor[] {
  const def = npcDef(state, world, a.id);
  if (!def?.enterTap || a.dead || powersSealed(state, world, a, t)) return [];
  const controller = masterOf(state, a) ?? a;
  const side = new Set([controller.id, a.id, ...retainersOf(state, controller.id).map((r) => r.id)]);
  return present(state, a.region, a.tile).filter((x) => !side.has(x.id) && !x.dead && x.loyalty === undefined && targetable(x, t, creatureColors(def)));
}

export function enterTap(state: State, world: World, a: Actor, t: number) {
  const candidates = hookTargets(state, world, a, t).map((x) => x.id);
  if (!candidates.length) return;
  const controller = masterOf(state, a) ?? a;
  (state.choices ??= []).push({ by: controller.id, land: a.region, effect: { type: 'hook', source: a.id }, candidates, t });
}

// The pick lands, if they are still there to hook.
export function applyHook(state: State, world: World, source: Actor, target: Actor, t: number) {
  if (!together(source, target) || !hookTargets(state, world, source, t).some((x) => x.id === target.id)) return;
  target.boundUntil = Math.max(target.boundUntil ?? 0, untapTime(t, true));
  target.task = undefined;
  target.forced = undefined;
  addLog(state, {
    kind: 'combat',
    text: `${josa(shortName(source.name), '이', '가')} 갈고리 밧줄을 던져 ${josa(shortName(target.name), '을', '를')} 꽁꽁 묶었다. ${formatClock(target.boundUntil)}까지 풀리지 않는다.`,
    regions: [source.region],
    actors: [source.id, target.id],
    t,
  });
  addFoe(target, source.id, t);
  remember(target, source, '갈고리 밧줄로 나를 묶었다', t);
}
