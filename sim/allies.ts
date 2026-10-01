// Allies (world/entities/laws/law-allies.md): the expedition parties of Zendikar. An Ally is a
// character of the card type (`sim.ally`). One's party is themselves (if an Ally) and the Allies
// who serve them; "Allies you control" are counted there. "An Ally enters the battlefield under
// your control" is an Ally joining one's party: becoming their retainer (hired, won over, raised
// back). Every Ally in that party with a rally power (`sim.rally`) then answers, the joiner too
// ("this or another Ally"). What it falls on is the controller's pick: the player's (state.asks,
// sim/asks.ts) or, for an NPC, the LLM's. Mercenaries (`sim.hireable`) serve whoever pays.
import { summon } from './counter.ts';
import { addFoe, dealDamage } from './combat.ts';
import { loseLife } from './life.ts';
import { revealHand } from './discard.ts';
import { bindRetainer, masterOf, retainersOf, swayBlocked } from './retainers.ts';
import { untapTime } from './clock.ts';
import { grantAbility, spawnWild } from './abilities.ts';
import { creatureColors } from './mana.ts';
import type { Color } from './mana.ts';
import { powersSealed } from './seal.ts';
import { addLog, awayText, npcDef, present, targetable, together } from './state.ts';
import type { Actor, State } from './state.ts';
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
    const rally = npcDef(state, world, x.id)?.rally ?? [];
    if (!rally.length || powersSealed(state, world, x, t)) continue;
    // "You may put a +1/+1 counter on each Ally creature you control": no one to pick, and it
    // only helps ("may": always, [가공]). Every Ally of the party, wherever they are.
    for (const eff of rally) if (eff.type === 'counters_allies') alliesCounter(state, world, x, master, t);
    // "You may put a +1/+1 counter on this": the same, on themselves only.
    for (const eff of rally) if (eff.type === 'counter_self') selfCounter(state, x, t);
    // "You may create a <token>. If you do, put a +1/+1 counter on this": born at their side, the
    // controller's; always.
    for (const eff of rally) if (eff.type === 'token_counter') tokenCounter(state, world, x, master, eff, t);
    // "You may have Ally creatures you control gain <ability> until end of turn": the same, no one
    // to pick, always.
    for (const eff of rally) if (eff.type === 'grant_allies') for (const y of alliesOf(state, world, master)) grantAbility(state, y, eff.ability, untapTime(t), `${shortName(x.name)}의 부름`, t);
    if (!rally.some(targeted)) continue;
    const candidates = present(state, x.region, x.tile).filter((y) => y.id !== x.id && targetable(y, t, creatureColors(npcDef(state, world, x.id)))).map((y) => y.id);
    if (candidates.length) (state.choices ??= []).push({ by: master.id, land: x.region, effect: { type: 'rally', source: x.id }, candidates, optional: true, t });
  }
}

// A rally that falls on someone picked (not the counters on the party's Allies).
function targeted(eff: { type: string }) {
  return eff.type !== 'counters_allies' && eff.type !== 'counter_self' && eff.type !== 'token_counter' && eff.type !== 'grant_allies';
}

// Kazuul Warlord's war cry: a +1/+1 counter (Actor.plusCounters, for good) on each Ally of the party.
function alliesCounter(state: State, world: World, x: Actor, master: Actor, t: number) {
  const party = alliesOf(state, world, master);
  for (const y of party) y.plusCounters = (y.plusCounters ?? 0) + 1;
  addLog(state, {
    kind: 'status',
    text: `${shortName(x.name)}의 함성에 무리의 동료들이 힘을 얻었다 (+1/+1 카운터: ${party.map((y) => shortName(y.name)).join(', ')}).`,
    regions: [...new Set(party.map((y) => y.region))],
    actors: party.map((y) => y.id),
    t,
  });
}

// Tuktuk Grunts: a +1/+1 counter on themselves, for good.
function selfCounter(state: State, x: Actor, t: number) {
  x.plusCounters = (x.plusCounters ?? 0) + 1;
  addLog(state, { kind: 'status', text: `무리가 늘자 ${josa(shortName(x.name), '이', '가')} 더 사나워졌다 (+1/+1 카운터).`, regions: [x.region], actors: [x.id], t });
}

// Turntimber Ranger: a Wolf comes to their side and serves their controller; they grow.
function tokenCounter(state: State, world: World, x: Actor, master: Actor, eff: { creature: string; pt: [number, number]; colors: Color[] }, t: number) {
  const [b] = spawnWild(state, world, eff.creature, eff.pt, 1, x.region, eff.colors, x.tile);
  b.master = master.id;
  x.plusCounters = (x.plusCounters ?? 0) + 1;
  addLog(state, {
    kind: 'event',
    text: `${shortName(x.name)}의 부름에 ${josa(shortName(b.name), '이', '가')} 나타나 ${shortName(master.name)}의 무리에 들었다 (${eff.pt.join('/')}, 권속). ${josa(shortName(x.name), '은', '는')} +1/+1 카운터를 얻었다.`,
    regions: [x.region],
    actors: [x.id, b.id, master.id],
    t,
  });
}

// What the picked rally is called: the fire, the curse, the hand.
export function rallyWord(state: State, world: World, sourceId: string) {
  const eff = (npcDef(state, world, sourceId)?.rally ?? []).find(targeted);
  return eff?.type === 'lose_life_allies' ? '저주' : eff?.type === 'reveal_discard' ? '손길' : '불길';
}

// What the rally of `sourceId` would do now, for the one picking.
export function rallyText(state: State, world: World, sourceId: string) {
  const x = state.actors[sourceId];
  const controller = x && (masterOf(state, x) ?? x);
  if (!x || !controller) return '';
  const n = alliesOf(state, world, controller).length;
  return (npcDef(state, world, x.id)?.rally ?? [])
    .filter(targeted)
    .map((eff) =>
      eff.type === 'lose_life_allies'
        ? `${shortName(x.name)}의 저주: 고른 하나가 생명 ${n}을 잃는다 (무리의 동료 수, 죽을 수도 있다)`
        : eff.type === 'reveal_discard'
          ? `${shortName(x.name)}의 손길: 고른 하나가 지닌 주문 가운데 ${n}가지(무리의 동료 수)가 드러나고, 그중 하나를 골라 잊게 한다`
          : `${shortName(x.name)}의 불길: 고른 하나에게 피해 ${n} (무리의 동료 수, 죽을 수도 있다)`,
    )
    .join(', ');
}

// The rally lands on `targetId` (Murasa Pyromancer: damage equal to the Allies its controller
// has). Whoever it strikes takes its source as a foe.
export function applyRally(state: State, world: World, sourceId: string, targetId: string, t: number) {
  const x = state.actors[sourceId];
  const target = state.actors[targetId];
  if (!x || x.dead || !target || target.dead || !together(target, x) || !targetable(target, t, creatureColors(npcDef(state, world, sourceId)))) return;
  const controller = masterOf(state, x) ?? x;
  for (const eff of (npcDef(state, world, x.id)?.rally ?? []).filter(targeted)) {
    const n = alliesOf(state, world, controller).length;
    // Bala Ged Thief: n of their hand shown to the controller, who picks one they forget.
    if (eff.type === 'reveal_discard') {
      const pick = revealHand(state, world, controller, x, target, n, t);
      if (pick && controller.kind === 'player') (state.asks ??= []).unshift(pick);
      else if (pick) (state.choices ??= []).push(pick);
      addFoe(target, x.id, t);
      continue;
    }
    if (eff.type === 'lose_life_allies') {
      addLog(state, {
        kind: 'combat',
        text: `${josa(shortName(x.name), '이', '가')} ${shortName(target.name)}에게 저주를 퍼부었다 (동료 ${n}).`,
        regions: [x.region],
        actors: [x.id, target.id],
      });
      loseLife(state, target, n, t, `${shortName(x.name)}의 저주`, x);
      if (!target.dead) addFoe(target, x.id, t);
      continue;
    }
    addLog(state, {
      kind: 'combat',
      text: `${josa(shortName(x.name), '이', '가')} ${shortName(target.name)}에게 불길을 퍼부었다 (동료 ${n}).`,
      regions: [x.region],
      actors: [x.id, target.id],
      t,
    });
    if (!dealDamage(state, target, n, t, `${shortName(x.name)}의 불길`, false, x)) addFoe(target, x.id, t);
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
  if (awayText(world, a, merc)) return awayText(world, a, merc);
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
  summon(state, world, merc, a, t, '고용');
}

// Mercenaries `a` could hire today, and where each is, for their plan.
export function hireableFor(state: State, world: World, a: Actor) {
  return Object.values(state.actors).filter((x) => {
    const def = npcDef(state, world, x.id);
    return def?.hireable && !x.dead && x.id !== a.id && !swayBlocked(state, world, x) && a.stats.coin >= hirePrice(def);
  });
}
