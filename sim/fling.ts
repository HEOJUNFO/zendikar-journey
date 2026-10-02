// Blazing Torch (equipment `sac_damage`, `unblockable_by`): "Equipped creature can't be blocked by
// Vampires or Zombies. Equipped creature has '{T}, Sacrifice Blazing Torch: it deals 2 damage to
// any target.'" Its owner may have its bearer (untapped, awake) throw it whenever they will, an
// hour: the bearer is tapped (bound until midnight), the torch is gone, and one standing with the
// bearer (anyone: a planeswalker loses loyalty) takes the damage (an ability's: it may kill). The
// player throws by an action, an NPC by a `fling` block in their plan. The unblocking is in
// sim/combat.ts `unblockable`.
import { untapTime } from './clock.ts';
import { dealDamage, down } from './combat.ts';
import { itemDef, unequip } from './items.ts';
import { addLog, outOfTime, present } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// Hours it takes.
export const FLING_HOURS = 1;

// The torches `a` owns that someone bears, ready to throw (the bearer untapped, awake).
export function torchesOf(state: State, world: World, a: Actor, t: number) {
  return world.items.filter((x) => {
    const s = state.items?.[x.id];
    const b = s?.bearer ? state.actors[s.bearer] : undefined;
    return x.equip?.sacDamage && s && !s.gone && s.owner === a.id && b && !b.dead && b.boundUntil === undefined && !down(b) && !outOfTime(state, b, t);
  });
}

// Whom a torch's bearer could throw it at: anyone standing with them, but themselves.
export function flingTargets(state: State, world: World, itemId: string) {
  const b = state.actors[state.items?.[itemId]?.bearer ?? ''];
  return b ? present(state, b.region, b.tile).filter((x) => x.id !== b.id) : [];
}

export function flingBlocked(state: State, world: World, a: Actor, itemId: string | undefined, toId: string | undefined, t: number): string | null {
  const x = torchesOf(state, world, a, t).find((y) => y.id === itemId) ?? (itemId ? undefined : torchesOf(state, world, a, t)[0]);
  if (!x) return '던질 수 있는 횃불이 없다 (매어 두어야 하고, 맨 이가 묶여 있지 않아야 한다).';
  if (!toId || !flingTargets(state, world, x.id).some((y) => y.id === toId)) return '맨 이 곁에 그런 이가 없다.';
  return null;
}

export function fling(state: State, world: World, a: Actor, itemId: string | undefined, toId: string, t: number) {
  const x = torchesOf(state, world, a, t).find((y) => y.id === itemId) ?? torchesOf(state, world, a, t)[0];
  if (!x || flingBlocked(state, world, a, x.id, toId, t)) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 횃불을 던지지 못했다.`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const s = state.items![x.id];
  const b = state.actors[s.bearer!];
  const target = state.actors[toId];
  b.boundUntil = untapTime(t);
  unequip(state, x.id);
  state.items![x.id] = { name: s.name, counters: 0, gone: true };
  addLog(state, { kind: 'combat', text: `${josa(shortName(b.name), '이', '가')} ${itemDef(world, x.id)?.name ?? s.name}을(를) ${shortName(target.name)}에게 내던졌다. 횃불은 부서져 흩어졌다.`, regions: [b.region], actors: [b.id, target.id, a.id], t });
  dealDamage(state, world, target, x.equip!.sacDamage!, t, x.name, false, a);
}
