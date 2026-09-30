// A land that keeps days (Magosi, the Waterveil; a location's `sim.eon`). A turn is a game day:
//
// - "{U}, {T}: Put an eon counter on this land. Skip your next turn": whoever holds the land
//   taps it, pays, and leaves a day in it. Their next day is lost: out of time all day
//   (state.ts `outOfTime`), standing where they are, untouched and unchanged.
// - "{T}, Remove an eon counter from this land and return it to its owner's hand: Take an
//   extra turn after this one": they take a day back. The land leaves them (the bond ends,
//   and any days still in it with it), and the next day is theirs alone: everyone else is out
//   of time until it ends.
//
// Either takes an hour, from wherever they are (as the land's mana does).
import { gameDay } from './clock.ts';
import { manaAvailable, manaCapacity, payMana, planPayment, formatMana } from './mana.ts';
import { addLog } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { region } from './world.ts';
import type { World } from './world.ts';

export const EON_HOURS = 1;

// The land that keeps days they hold, if any.
export function eonLand(world: World, a: Actor) {
  return (a.bonds ?? []).map((id) => world.regions.find((r) => r.id === id)).find((r) => r?.eon);
}

export function eonsIn(a: Actor, landId: string) {
  return a.eons?.[landId] ?? 0;
}

// `a` with `landId` tapped today, for checking what they would have left.
function withTapped(a: Actor, landId: string, t: number): Actor {
  const day = gameDay(t);
  const ids = a.landsTapped?.day === day ? a.landsTapped.ids : [];
  return { ...a, landsTapped: { day, ids: [...ids, landId] } };
}

// Why they can't tap the land for its ability now, or null.
function tapBlocked(state: State, world: World, a: Actor, landId: string, t: number): string | null {
  const r = world.regions.find((x) => x.id === landId);
  if (!r?.eon) return '날을 맡길 수 있는 땅이 아니다.';
  if (!a.bonds?.includes(r.id)) return `${r.name}과 유대를 맺지 않았다.`;
  const rs = state.regions[r.id];
  if (rs?.destroyed) return `${josa(r.name, '은', '는')} 부서졌다.`;
  if (rs?.conditions.some((c) => c.tapped)) return `${josa(r.name, '은', '는')} 지금 쓸 수 없다.`;
  const day = gameDay(t);
  if (r.entersTapped && a.landfalls?.day === day && a.landfalls.regions.includes(r.id)) return `오늘 유대를 맺어 ${josa(r.name, '은', '는')} 아직 쓸 수 없다.`;
  if (a.landsTapped?.day === day && a.landsTapped.ids.includes(r.id)) return `오늘 이미 ${josa(r.name, '을', '를')} 썼다.`;
  // Its mana already spent today: it is tapped.
  const cap = manaCapacity(state, world, withTapped(a, r.id, t), t);
  const spent = a.manaSpent?.day === day ? a.manaSpent.spent : {};
  if (Object.entries(spent).some(([c, n]) => (n ?? 0) > (cap[c as keyof typeof cap] ?? 0))) return `오늘 ${r.name}의 마나를 이미 썼다.`;
  return null;
}

function tap(a: Actor, landId: string, t: number) {
  const day = gameDay(t);
  if (a.landsTapped?.day !== day) a.landsTapped = { day, ids: [] };
  a.landsTapped.ids.push(landId);
}

// Out of time today, or with a day already set aside to lose.
function turnBlocked(state: State, a: Actor, t: number): string | null {
  if (a.skipDay !== undefined && a.skipDay > gameDay(t)) return '이미 다음 하루를 맡겨 두었다.';
  if (state.extraDays?.some((x) => x.actor === a.id && x.day > gameDay(t))) return '되찾은 하루가 아직 오지 않았다.';
  return null;
}

export function storeBlocked(state: State, world: World, a: Actor, landId: string, t: number): string | null {
  const why = tapBlocked(state, world, a, landId, t) ?? turnBlocked(state, a, t);
  if (why) return why;
  const r = region(world, landId);
  const left = manaAvailable(state, world, withTapped(a, r.id, t), t);
  if (!planPayment(left, r.eon!.cost)) return `마나가 모자라다 (${r.eon!.costText}, ${r.name} 말고 지금 ${formatMana(left)}).`;
  return null;
}

export function spendBlocked(state: State, world: World, a: Actor, landId: string, t: number): string | null {
  const why = tapBlocked(state, world, a, landId, t) ?? turnBlocked(state, a, t);
  if (why) return why;
  if (eonsIn(a, landId) < 1) return `${region(world, landId).name}에 맡겨 둔 하루가 없다.`;
  return null;
}

// The first day from `from` that is no one else's extra day: when `a`'s next turn comes.
function nextTurn(state: State, a: Actor, from: number) {
  let day = from;
  while (state.extraDays?.some((x) => x.day === day && x.actor !== a.id)) day++;
  return day;
}

export function storeDay(state: State, world: World, a: Actor, landId: string, t: number) {
  const why = storeBlocked(state, world, a, landId, t);
  const name = shortName(a.name);
  if (why) {
    addLog(state, { kind: 'status', text: `${josa(name, '은', '는')} 하루를 맡기지 못했다: ${why}`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const r = region(world, landId);
  tap(a, r.id, t);
  payMana(state, world, a, r.eon!.cost, t);
  a.eons = { ...a.eons, [r.id]: eonsIn(a, r.id) + 1 };
  a.skipDay = nextTurn(state, a, gameDay(t) + 1);
  addLog(state, {
    kind: 'event',
    text: `${josa(name, '이', '가')} ${r.name}에 하루를 맡겼다 (맡겨 둔 날 ${a.eons[r.id]}). 다음 하루는 그의 것이 아니다.`,
    regions: [a.region],
    actors: [a.id],
    t,
  });
}

export function spendDay(state: State, world: World, a: Actor, landId: string, t: number) {
  const why = spendBlocked(state, world, a, landId, t);
  const name = shortName(a.name);
  if (why) {
    addLog(state, { kind: 'status', text: `${josa(name, '은', '는')} 하루를 되찾지 못했다: ${why}`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const r = region(world, landId);
  // "Return it to its owner's hand": the land leaves them, and what was on it goes too.
  a.bonds = a.bonds!.filter((id) => id !== r.id);
  const eons = { ...a.eons };
  delete eons[r.id];
  a.eons = eons;
  // The extra day: the first after today that isn't already someone's. Everyone whose turn
  // it would have been moves on a day, and so does any day they meant to skip.
  let day = gameDay(t) + 1;
  while (state.extraDays?.some((x) => x.day === day)) day++;
  (state.extraDays ??= []).push({ actor: a.id, day });
  for (const x of Object.values(state.actors)) {
    if (x.id !== a.id && x.skipDay !== undefined && x.skipDay >= day) x.skipDay = nextTurn(state, x, x.skipDay + 1);
  }
  addLog(state, {
    kind: 'event',
    text: `${josa(name, '이', '가')} ${r.name}에 맡겨 둔 하루를 되찾았다. ${josa(r.name, '은', '는')} 그를 떠났다. 다음 하루, 세상은 멈추고 ${name}만이 움직인다.`,
    regions: [a.region],
    actors: [a.id],
    scope: 'world',
    t,
  });
}

// An hour out of time: nothing about them moves on. Whatever they were in the middle of
// waits for them, an hour later.
export function holdStill(a: Actor) {
  const hour = 60;
  if (a.travel) a.travel.arrive += hour;
  if (a.task?.until !== undefined) a.task.until += hour;
  if (a.forced?.until !== undefined) a.forced.until += hour;
  if (a.boundUntil !== undefined) a.boundUntil += hour;
}

// At 00:00: who is out of time today, told once.
export function timeNews(state: State, world: World, t: number) {
  const day = gameDay(t);
  const extra = state.extraDays?.find((x) => x.day === day);
  if (extra) {
    const who = state.actors[extra.actor];
    if (who && !who.dead)
      addLog(state, { kind: 'event', text: `세상이 멈췄다. 이 하루는 ${shortName(who.name)}만의 것이다.`, regions: [who.region], actors: [who.id], scope: 'world', t });
  }
  for (const a of Object.values(state.actors)) {
    if (a.dead || a.skipDay !== day) continue;
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} 폭포 너머에 하루를 맡겨 두어, 오늘은 시간 밖에 있다.`, regions: [a.region], actors: [a.id], t });
  }
  // Days gone by are forgotten.
  if (state.extraDays) state.extraDays = state.extraDays.filter((x) => x.day >= day);
}
