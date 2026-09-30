// Allies (world/entities/laws/law-allies.md): the expedition parties of Zendikar. An Ally is a
// character of the card type (`sim.ally`). One's party is themselves (if an Ally) and the Allies
// who serve them; "Allies you control" are counted there. "An Ally enters the battlefield under
// your control" is an Ally joining one's party: becoming their retainer (hired, won over, raised
// back). Every Ally in that party with a rally power (`sim.rally`) then answers, the joiner too
// ("this or another Ally"). What it falls on is the controller's pick: the player's (state.asks,
// sim/run.ts) or, for an NPC, the LLM's. Mercenaries (`sim.hireable`) serve whoever pays.
import { addFoe, dealDamage } from './combat.ts';
import { bindRetainer, masterOf, retainersOf, swayBlocked } from './retainers.ts';
import { addLog, npcDef, present, targetable } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { NpcDef, World } from './world.ts';

// Coin per point of the card's mana value, to hire a mercenary ([결정] 2026-09-30).
export const HIRE_COIN_PER_MANA = 10;
// Hours a hire takes (the bargain struck).
export const HIRE_HOURS = 1;

export function isAlly(state: State, world: World, id: string) {
  return !!npcDef(state, world, id)?.ally;
}

// Their party's Allies: themselves if an Ally, and the Allies who serve them.
export function alliesOf(state: State, world: World, a: Actor) {
  return [a, ...retainersOf(state, a.id)].filter((x) => !x.dead && isAlly(state, world, x.id));
}

// An Ally joined `master`'s party: every rally in it answers. What each falls on is `master`'s
// pick among those standing with the Ally that has it (made after the hour; "may": none).
export function allyJoined(state: State, world: World, a: Actor, master: Actor, t: number) {
  if (!isAlly(state, world, a.id)) return;
  for (const x of alliesOf(state, world, master)) {
    if (!npcDef(state, world, x.id)?.rally?.length) continue;
    const candidates = present(state, x.region).filter((y) => y.id !== x.id && targetable(y, t)).map((y) => y.id);
    if (candidates.length) (state.choices ??= []).push({ by: master.id, land: x.region, effect: { type: 'rally', source: x.id }, candidates, optional: true, t });
  }
}

// What the rally of `sourceId` would do now, for the one picking.
export function rallyText(state: State, world: World, sourceId: string) {
  const x = state.actors[sourceId];
  const controller = x && (masterOf(state, x) ?? x);
  if (!x || !controller) return '';
  return `${shortName(x.name)}의 불길: 고른 하나에게 피해 ${alliesOf(state, world, controller).length} (무리의 동료 수, 죽을 수도 있다)`;
}

// The rally lands on `targetId` (Murasa Pyromancer: damage equal to the Allies its controller
// has). Whoever it strikes takes its source as a foe.
export function applyRally(state: State, world: World, sourceId: string, targetId: string, t: number) {
  const x = state.actors[sourceId];
  const target = state.actors[targetId];
  if (!x || x.dead || !target || target.dead || target.region !== x.region || target.travel || !targetable(target, t)) return;
  const controller = masterOf(state, x) ?? x;
  for (const eff of npcDef(state, world, x.id)?.rally ?? []) {
    if (eff.type !== 'damage_allies') continue;
    const n = alliesOf(state, world, controller).length;
    addLog(state, {
      kind: 'combat',
      text: `${josa(shortName(x.name), '이', '가')} ${shortName(target.name)}에게 불길을 퍼부었다 (동료 ${n}).`,
      regions: [x.region],
      actors: [x.id, target.id],
      t,
    });
    if (!dealDamage(state, target, n, t, `${shortName(x.name)}의 불길`)) addFoe(target, x.id, t);
  }
}

export function hirePrice(def: NpcDef) {
  return Object.values(def.mana ?? {}).reduce((sum, n) => sum + (n ?? 0), 0) * HIRE_COIN_PER_MANA;
}

// Why `a` can't hire `mercId` now, or null.
export function hireBlocked(state: State, world: World, a: Actor, mercId: string | undefined): string | null {
  const merc = mercId ? state.actors[mercId] : undefined;
  const def = mercId ? npcDef(state, world, mercId) : undefined;
  if (!merc || merc.dead || !def?.hireable) return '고용할 수 있는 이가 아니다.';
  if (merc.id === a.id) return '자신을 고용할 수는 없다.';
  if (a.master) return '누군가를 섬기는 몸이라 고용할 수 없다.';
  if (npcDef(state, world, a.id)?.beast) return '짐승은 고용하지 않는다.';
  if (merc.region !== a.region || merc.travel) return `${josa(shortName(merc.name), '은', '는')} 여기 없다.`;
  const why = swayBlocked(state, world, merc);
  if (why) return why;
  const price = hirePrice(def);
  if (a.stats.coin < price) return `돈이 모자라다 (${price}코인).`;
  return null;
}

export function hireMerc(state: State, world: World, a: Actor, mercId: string, t: number) {
  const why = hireBlocked(state, world, a, mercId);
  if (why) {
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} 고용하지 못했다: ${why}`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const merc = state.actors[mercId];
  const price = hirePrice(npcDef(state, world, mercId)!);
  a.stats.coin -= price;
  addLog(state, {
    kind: 'event',
    text: `${josa(shortName(a.name), '이', '가')} ${shortName(merc.name)}에게 ${price}코인을 치렀다.`,
    regions: [a.region],
    actors: [a.id, merc.id],
    t,
  });
  bindRetainer(state, world, merc, a, t, '고용');
}

// Mercenaries `a` could hire today, and where each is, for their plan.
export function hireableFor(state: State, world: World, a: Actor) {
  return Object.values(state.actors).filter((x) => {
    const def = npcDef(state, world, x.id);
    return def?.hireable && !x.dead && x.id !== a.id && !swayBlocked(state, world, x) && a.stats.coin >= hirePrice(def);
  });
}

// What a pick the player owes is about (state.asks), for them.
export function askText(state: State, world: World, c: Choice) {
  return c.effect.type === 'rally' ? rallyText(state, world, c.effect.source) : '';
}

// The player answers the pick they owe first: someone (by id), or no one.
export function answerAsk(state: State, world: World, pick: string | null, t: number) {
  const c = state.asks?.shift();
  if (!c || c.effect.type !== 'rally') return;
  const target = pick ? state.actors[pick] : undefined;
  if (target && c.candidates.includes(target.id)) applyRally(state, world, c.effect.source, target.id, t);
  else addLog(state, { kind: 'status', text: `${shortName(state.actors[c.effect.source]?.name ?? '')}의 불길을 거두었다.`, regions: [c.land], actors: [c.by], t });
}
