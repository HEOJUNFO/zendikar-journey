// Trapmaker's Snare (spell effect `snare_trap`): "Search your library for a Trap card, reveal it,
// put it into your hand." In this world (user decision 2026-10-02), the caster comes by one of the
// world's traps at random (any trap of a card: `trigger` not the morning's) and holds it
// (`Actor.traps`). They may set it later where they stand, paying the trap card's cost
// (`cardCost`) over an hour: a copy of that trap then lies hidden on their tile
// (`state.placedTraps`), springing as the trap does, on anyone, the one who set it too. They know
// where it lies (a secret of theirs); others may come to know it as any trap. The player sets it
// by an action, an NPC by a `set_trap` block in their plan.
import { formatMana, manaAvailable, payMana, planPayment } from './mana.ts';
import { addLog, random } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { tileLabel } from './tiles.ts';
import { placeName, region } from './world.ts';
import type { EventDef, World } from './world.ts';

// Hours setting a trap takes.
export const SET_TRAP_HOURS = 1;

// The traps of the world one may come by (the world's own, not the copies set).
function trapPool(world: World) {
  return world.events.filter((ev) => ev.trigger !== 'gm' && !ev.setBy && ev.cardCost);
}

// The caster comes by a trap at random.
export function snareTrap(state: State, world: World, a: Actor, t: number, cause: string) {
  const pool = trapPool(world);
  if (!pool.length) return;
  const ev = pool[Math.floor(random(state) * pool.length)];
  a.traps = [...(a.traps ?? []), ev.id];
  addLog(state, { kind: 'effect', text: `${cause}: ${josa(shortName(a.name), '이', '가')} ${josa(ev.name, '을', '를')} 손에 넣었다. 어디든 선 자리에 ${ev.cardCost!.text}를 들여 놓을 수 있다.`, regions: [a.region], actors: [a.id], t });
}

// Why `a` can't set trap `evId` where they stand now, or null.
export function setTrapBlocked(state: State, world: World, a: Actor, evId: string | undefined, t: number): string | null {
  const ev = world.events.find((x) => x.id === evId);
  if (!ev || !a.traps?.includes(ev.id)) return '지닌 함정이 아니다.';
  if (region(world, a.region).notLand) return '여기엔 함정을 놓을 수 없다.';
  if (!planPayment(manaAvailable(state, world, a, t), ev.cardCost!.mana)) return `마나가 모자라다 (${ev.cardCost!.text}, 지금 ${formatMana(manaAvailable(state, world, a, t))}).`;
  return null;
}

export function setTrap(state: State, world: World, a: Actor, evId: string, t: number) {
  const why = setTrapBlocked(state, world, a, evId, t);
  const ev = world.events.find((x) => x.id === evId);
  if (why || !ev) {
    addLog(state, { kind: 'status', text: `${shortName(a.name)}: 함정을 놓지 못했다 (${why}).`, regions: [a.region], actors: [a.id], t });
    return;
  }
  payMana(state, world, a, ev.cardCost!.mana, t);
  const i = a.traps!.indexOf(ev.id);
  a.traps = a.traps!.filter((_, j) => j !== i);
  if (!a.traps.length) delete a.traps;
  state.trapCount = (state.trapCount ?? 0) + 1;
  const id = `${ev.id}@${state.trapCount}`;
  (state.placedTraps ??= []).push({ id, event: ev.id, region: a.region, ...(a.tile ? { tile: a.tile } : {}), by: a.id, at: t });
  const where = `${placeName(world, region(world, a.region))}${a.tile ? `(${tileLabel(world, a.region, a.tile)})` : ''}`;
  a.knowledge = [...(a.knowledge ?? []), { id: `trap:${id}`, text: `${where}에 내가 놓은 ${ev.name}: ${ev.summary}.` }];
  addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} ${where}에 ${josa(ev.name, '을', '를')} 숨겨 놓았다 (${ev.cardCost!.text}).`, regions: [a.region], actors: [a.id], t });
}

// The copies set, as the world's events (sim/wander.ts `withPositions` adds them).
export function placedEvents(state: State, world: World): EventDef[] {
  return (state.placedTraps ?? []).flatMap((p) => {
    const ev = world.events.find((x) => x.id === p.event);
    return ev ? [{ ...ev, id: p.id, region: p.region, pos: undefined, ...(p.tile ? { tile: p.tile } : {}), setBy: p.by }] : [];
  });
}

// The traps `a` holds, for their plan and the player's buttons.
export function trapsHeld(world: World, a: Actor) {
  return (a.traps ?? []).map((id) => world.events.find((x) => x.id === id)).filter((x): x is EventDef => !!x);
}

// An event by id: the world's own, or a copy someone set.
export function eventDefOf(state: State, world: World, id: string) {
  return world.events.find((x) => x.id === id) ?? placedEvents(state, world).find((x) => x.id === id);
}
