// Combat, MTG style (world/README.md: MTG 규칙 → 게임 대응). Damage piles up against
// toughness for the rest of the turn (game day); reaching toughness is death. One hour of
// fighting is one exchange: both sides strike at once, except that a tapped (bound) defender
// can't strike back. A fight with no player in it is not to the death: whoever goes down is
// knocked out for a few hours and the fight is over.
import { attackQuest } from './ascension.ts';
import { formatClock, gameDay, STEP_MINUTES, untapTime } from './clock.ts';
import { remember } from './relations.ts';
import { controlsKind, masterOf, releaseRetainer, retainersOf } from './retainers.ts';
import { releaseItems } from './items.ts';
import { owesDiscard } from './discard.ts';
import { gembladesHit } from './expedition.ts';
import { hooks } from './equipment.ts';
import { shielded } from './tapper.ts';
import { harrowOwed } from './harrow.ts';
import { doubleLife, gainLife, lifeOf } from './life.ts';
import { actorColors, COLOR_LABELS, manaAvailable, parseManaCost, payMana, planPayment } from './mana.ts';
import { HUNT_HUNGER, KILL_FEED, KO_ACTIVITY, KO_HOURS } from './rules.ts';
import { powersSealed } from './seal.ts';
import { landsOfType } from './spells.ts';
import { addLog, awayText, buryCount, hasAbility, needsOf, npcDef, outOfTime, present, protectedFrom, ptOf, random, together } from './state.ts';
import type { Actor, State } from './state.ts';
import { hasPowers, LAND_TYPE_LABELS, landTypes } from './world.ts';
import type { Ability, LandType, World } from './world.ts';
import { josa, shortName } from './text.ts';

export function woundsOf(a: Actor, t: number) {
  return a.wounds?.day === gameDay(t) ? a.wounds.amount : 0;
}

// Returns whether it killed them. Nonlethal damage knocks out instead of killing. A
// planeswalker's damage comes off their loyalty; at 0 they leave the plane. `by`: who dealt it,
// if anyone (where one with no master goes when they die: `die`). `dealer`: the creature the
// damage comes from itself (a blow, a bite, its own power), not a spell or land of theirs:
// deathtouch is its.
export function dealDamage(state: State, world: World, a: Actor, amount: number, t: number, cause: string, nonlethal = false, by?: Actor, dealer?: Actor) {
  if (a.dead || amount <= 0) return false;
  // A ward (Noble Vestige) takes what it can first.
  amount = shielded(state, a, amount, t);
  if (amount <= 0) return false;
  a.hurtDay = gameDay(t);
  if (a.loyalty !== undefined) {
    a.loyalty = Math.max(nonlethal ? 1 : 0, a.loyalty - amount);
    addLog(state, { kind: 'combat', text: `${josa(shortName(a.name), '이', '가')} 피해 ${amount}로 기세가 꺾였다 (기세 ${a.loyalty}).`, regions: [a.region], actors: [a.id] });
    if (a.loyalty <= 0) leavePlane(state, a, t, cause);
    return false;
  }
  const toughness = ptOf(a)[1];
  // Deathtouch (Giant Scorpion): any damage from it is enough, as wounds reaching toughness
  // (between NPCs, a knockout all the same; user decision 2026-10-01).
  const touched = !!dealer && hasAbility(dealer, 'deathtouch', t) && woundsOf(a, t) + amount < toughness;
  const total = touched ? Math.max(woundsOf(a, t) + amount, toughness) : woundsOf(a, t) + amount;
  if (touched) addLog(state, { kind: 'combat', text: `${shortName(dealer.name)}의 죽음의 손길이 ${josa(shortName(a.name), '을', '를')} 스쳤다.`, regions: [a.region], actors: [dealer.id, a.id] });
  // Indestructible: lethal damage leaves them standing (life loss and sacrifice still end them).
  if (total >= toughness && hasAbility(a, 'indestructible', t)) {
    a.wounds = { day: gameDay(t), amount: total };
    addLog(state, { kind: 'combat', text: `${josa(shortName(a.name), '이', '가')} 피해 ${amount}를 입었지만 쓰러지지 않는다 (${total}/${toughness}, 파괴불가).`, regions: [a.region], actors: [a.id] });
    return false;
  }
  if (total >= toughness && regenerate(state, world, a, t, cause)) return false;
  if (total >= toughness && nonlethal) {
    knockOut(state, a, t, cause);
    return false;
  }
  a.wounds = { day: gameDay(t), amount: total };
  if (total >= toughness) {
    die(state, a, t, cause, by);
    return true;
  }
  addLog(state, {
    kind: 'combat',
    text: `${josa(shortName(a.name), '이', '가')} 피해 ${amount}를 입었다 (${total}/${toughness}).`,
    regions: [a.region],
    actors: [a.id],
  });
  return false;
}

// "Regenerate this creature" (Savage Silhouette's aura): about to die or fall (damage, destroy),
// whoever controls them (their master, or they themselves) pays the cost if they can, by itself
// (user decision 2026-10-01), every time. Instead they are healed, tapped (bound until midnight)
// and taken out of today's fights. Life lost, sacrifice and exile are no destruction.
// Its own ("{G}: Regenerate this creature", River Boa; `sim.regenerate`) the same way, unless its
// powers are sealed.
function regenerate(state: State, world: World, a: Actor, t: number, cause: string) {
  const own = npcDef(state, world, a.id)?.regenerate;
  const aura = a.auras?.find((x) => x.regen) ?? (own && !powersSealed(state, world, a, t) ? { name: '제 힘', regen: own } : undefined);
  if (!aura || a.dead || a.loyalty !== undefined) return false;
  const payer = masterOf(state, a) ?? a;
  const cost = parseManaCost(aura.regen!)!;
  if (payer.dead || !payMana(state, world, payer, cost, t)) return false;
  delete a.wounds;
  a.boundUntil = untapTime(t);
  a.task = undefined;
  delete a.foes;
  for (const y of Object.values(state.actors)) if (y.foes?.ids.includes(a.id)) y.foes = { ...y.foes, ids: y.foes.ids.filter((f) => f !== a.id), struck: y.foes.struck?.filter((f) => f !== a.id) };
  addLog(state, { kind: 'effect', text: `${cause}: 쓰러지려던 ${josa(shortName(a.name), '이', '가')} ${aura.name}의 힘으로 되살아났다 (${aura.regen}${payer.id === a.id ? '' : `, ${shortName(payer.name)}이(가) 치름`}). 상처가 아물었지만 자정까지 꼼짝 못 하고 싸움에서 빠진다.`, regions: [a.region], actors: [a.id, payer.id], t });
  return true;
}

// `by`: whose doing it was, if anyone's.
export function die(state: State, a: Actor, t: number, cause: string, by?: Actor) {
  a.dead = { at: t, cause };
  // Into a graveyard (`fallen`, user decision 2026-10-01): a retainer's master's; one serving no
  // one, their killer's side (the killer's master, or the killer). Not a token (it ceases to be,
  // as in MTG), nor the player.
  const killer = by && (masterOf(state, by) ?? by);
  const m = a.master ? state.actors[a.master] : killer;
  // Nissa's Chosen: into no graveyard; it wakes at home some days on (sim/revive.ts).
  const revives = !!a.revives && a.kind !== 'player' && !state.tokens?.[a.id];
  if (revives) a.reviveAt = t + a.revives! * 24 * 60;
  if (m && a.kind !== 'player' && !state.tokens?.[a.id] && !revives) {
    m.fallen = [...(m.fallen ?? []), a.id];
    buryCount(m, 1, t);
  }
  for (const r of retainersOf(state, a.id)) releaseRetainer(state, r, `${shortName(a.name)}의 죽음`);
  releaseItems(state, a, t);
  a.task = undefined;
  a.forced = undefined;
  a.travel = undefined;
  delete a.boundUntil;
  if (a.kind === 'player') state.over = { at: t, cause };
  addLog(state, {
    kind: 'death',
    text: `${josa(shortName(a.name), '이', '가')} 죽었다 (${cause}).${revives ? ` 무덤에 들지 않고, ${a.revives}일 뒤 거처에서 다시 눈을 뜬다.` : ''}`,
    regions: [a.region],
    actors: [a.id],
  });
}

// A planeswalker whose loyalty is gone leaves this plane: gone from the world, not dead.
export function leavePlane(state: State, a: Actor, t: number, cause: string) {
  a.dead = { at: t, cause: `차원을 떠남: ${cause}` };
  a.left = true;
  a.task = undefined;
  a.forced = undefined;
  delete a.boundUntil;
  for (const r of retainersOf(state, a.id)) releaseRetainer(state, r, `${shortName(a.name)}이(가) 떠남`);
  releaseItems(state, a, t);
  addLog(state, { kind: 'death', text: `${josa(shortName(a.name), '이', '가')} 이 차원을 떠났다 (${cause}).`, regions: [a.region], actors: [a.id] });
}

// Down but alive: out cold for KO_HOURS, one short of their toughness in wounds (when it was
// wounds that felled them; life run out leaves none).
export function knockOut(state: State, a: Actor, t: number, cause: string, wounded = true) {
  if (wounded) a.wounds = { day: gameDay(t), amount: ptOf(a)[1] - 1 };
  a.task = undefined;
  a.forced = { kind: 'sleep', activity: KO_ACTIVITY, emoji: '😵', until: t + KO_HOURS * 60 };
  addLog(state, {
    kind: 'combat',
    text: `${josa(shortName(a.name), '이', '가')} 쓰러져 기절했다 (${cause}, ${KO_HOURS}시간).`,
    regions: [a.region],
    actors: [a.id],
  });
}

export function knockedOut(a: Actor) {
  return a.forced?.activity === KO_ACTIVITY;
}

// No one to fight: the unconscious and the dead.
export function down(a: Actor) {
  return !!a.dead || knockedOut(a);
}

export function addFoe(a: Actor, foeId: string, t: number) {
  const day = gameDay(t);
  if (a.foes?.day !== day) a.foes = { day, ids: [] };
  if (!a.foes.ids.includes(foeId)) a.foes.ids.push(foeId);
}

export function foesOf(a: Actor, t: number) {
  return a.foes?.day === gameDay(t) ? a.foes.ids : [];
}

// One exchange. The defender turns hostile to the attacker.
// Landwalk ("can't be blocked as long as defending player controls a Swamp/Forest"): one bonded
// with a land of that type can't strike back at the landwalker, nor fly from it. The type it
// walks, or null.
const LANDWALK: Partial<Record<Ability, LandType>> = { swampwalk: 'swamp', forestwalk: 'forest', islandwalk: 'island', mountainwalk: 'mountain' };
export function landwalked(world: World, attacker: Actor, defender: Actor, t: number, state?: State): LandType | null {
  for (const [ability, type] of Object.entries(LANDWALK) as [Ability, LandType][]) {
    if (!hasAbility(attacker, ability, t)) continue;
    const bonded = (defender.bonds ?? []).some((id) => {
      const r = world.regions.find((x) => x.id === id);
      return !!r && landTypes(r, state).includes(type);
    });
    if (bonded) return type;
  }
  return null;
}

// Intimidate ("can't be blocked except by artifact creatures and/or creatures that share a
// color with it"): one who shares none of its colors can't strike back at it, nor fly from it.
// Their colors: a card's, or the colors of the lands they have bonded with (sim/mana.ts).
export function intimidated(state: State, world: World, attacker: Actor, defender: Actor, t: number) {
  if (!hasAbility(attacker, 'intimidate', t)) return false;
  // An artifact creature (마법물체 생물) may block it, whatever its colors.
  if (npcDef(state, world, defender.id)?.types?.includes('artifact')) return false;
  const theirs = actorColors(state, world, defender);
  return !actorColors(state, world, attacker).some((c) => theirs.includes(c));
}

// Asleep (resting, sleeping, collapsed from exhaustion), not knocked out.
export function asleep(a: Actor) {
  return (a.forced ?? a.task)?.kind === 'sleep' && !knockedOut(a);
}

// Fallen on in their sleep: one asleep can't strike back (nor fly) the first exchange against
// one they don't yet hold a foe. Vigilance ("attacking doesn't cause it to tap"): never caught
// asleep (user decision 2026-09-30, as haste became half travel time).
export function caughtAsleep(attacker: Actor, defender: Actor, t: number) {
  return asleep(defender) && !hasAbility(defender, 'vigilance', t) && !foesOf(defender, t).includes(attacker.id);
}

// Why the defender can't block the attacker (strike back, or fly from them), or null.
// `flight`: whether they may still fly from them. Prey of a landwalker or an intimidator can't
// strike back but may take to the air (user decision 2026-10-01); one asleep, or of the color a
// protected one is shielded from, may not.
export function unblockable(state: State, world: World, attacker: Actor, defender: Actor, t: number, flight = false): string | null {
  if (caughtAsleep(attacker, defender, t)) return '잠든 채 덮쳐져';
  // A grappling hook: the one its bearer falls on is dragged down, no flying off.
  const hook = flight ? hooks(state, world, attacker) : undefined;
  if (hook) return `${hook.name}에 걸려 끌려 내려와`;
  // "Can't be blocked" (Aether Figment): no one strikes back; a flyer may still fly off (as from
  // a landwalker).
  if (!flight && hasAbility(attacker, 'unblockable', t)) return '막을 수 없는 적에게';
  const walked = !flight && landwalked(world, attacker, defender, t, state);
  if (walked) return `${LAND_TYPE_LABELS[walked]}과 이어진 몸이라 ${LAND_TYPE_LABELS[walked]}을 걷는 적에게`;
  // Protection from a color: one of that color can't block them.
  const shield = protectedFrom(attacker, actorColors(state, world, defender), t);
  if (shield) return `${COLOR_LABELS[shield]}색이라 ${COLOR_LABELS[shield]}색으로부터 보호받는 적에게`;
  if (!flight && intimidated(state, world, attacker, defender, t)) {
    const colors = actorColors(state, world, attacker).map((c) => COLOR_LABELS[c]).join('·');
    return `${colors}의 기운이 없어 위협하는 적에게`;
  }
  return null;
}

// "Destroy": they die, unless indestructible. Returns whether they died. `by`: whose doing it is.
export function destroy(state: State, world: World, target: Actor, t: number, cause: string, by?: Actor) {
  if (hasAbility(target, 'indestructible', t)) {
    addLog(state, { kind: 'effect', text: `${josa(shortName(target.name), '은', '는')} 파괴되지 않는다 (파괴불가).`, regions: [target.region], actors: [target.id], t });
    return false;
  }
  if (regenerate(state, world, target, t, cause)) return false;
  die(state, target, t, cause, by);
  return true;
}

// `unblocked`: why the defender can't strike back this exchange (landwalk, intimidate), if so.
// Guul Draz Specter: +P/+T while a foe of today standing with them holds no spell.
export function refreshEmptyHand(state: State, world: World, a: Actor, t: number) {
  const pt = npcDef(state, world, a.id)?.emptyHandPump;
  const on = !!pt && !powersSealed(state, world, a, t) && foesOf(a, t).some((id) => {
    const f = state.actors[id];
    return f && !f.dead && together(f, a) && !f.spells?.length;
  });
  if (on) a.emptyHand = [pt![0], pt![1]];
  else delete a.emptyHand;
}

// "Whenever this attacks, it gets +P/+T until end of turn for each <land type> you control"
// (Timbermaw Larva): the first time each day it falls on someone (the attacker of an exchange),
// +P/+T until midnight for each land of that type its controller (master, or itself) holds,
// not destroyed (user decision 2026-10-01: a turn is a day, it attacks once a day).
export function attackPump(state: State, world: World, a: Actor, t: number) {
  const ap = npcDef(state, world, a.id)?.attackPump;
  if (!ap || powersSealed(state, world, a, t)) return;
  const n = landsOfType(state, world, masterOf(state, a) ?? a, ap.land).length;
  if (n <= 0) return;
  a.pumps = [...(a.pumps ?? []), { pt: [ap.pt[0] * n, ap.pt[1] * n], until: untapTime(t) }];
  addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '이', '가')} 덤벼들며 부풀었다: ${LAND_TYPE_LABELS[ap.land]} ${n}곳의 힘으로 자정까지 +${ap.pt[0] * n}/+${ap.pt[1] * n} (${ptOf(a).join('/')}).`, regions: [a.region], actors: [a.id], t });
}

// "Whenever this (a creature you control) attacks": the first time each day one falls on
// someone (a turn is a day, user decision 2026-10-01).
function onAttack(state: State, world: World, a: Actor, t: number) {
  if (a.attackDay === gameDay(t)) return;
  a.attackDay = gameDay(t);
  attackPump(state, world, a, t);
  attackQuest(state, world, a, t);
}

export function clash(state: State, world: World, attacker: Actor, defender: Actor, t: number, unblocked: string | null = null) {
  // Foes are made as the blow falls: the specter sees an empty hand from the first exchange.
  // Not yet a foe: the attacker fell on them, a fight they defend.
  const setUpon = !foesOf(defender, t).includes(attacker.id);
  addFoe(defender, attacker.id, t);
  if (setUpon) (defender.foes!.struck ??= []).push(attacker.id);
  addFoe(attacker, defender.id, t);
  refreshEmptyHand(state, world, attacker, t);
  refreshEmptyHand(state, world, defender, t);
  onAttack(state, world, attacker, t);
  // Protection from a color: no damage from one of that color.
  const shielded = (from: Actor, to: Actor) => protectedFrom(to, actorColors(state, world, from), t);
  let [ap] = shielded(attacker, defender) ? [0] : ptOf(attacker);
  // A tapped (bound) or knocked-out defender can't strike back, nor one who can't block the attacker.
  const helpless = defender.boundUntil !== undefined ? '묶여 있어' : knockedOut(defender) ? '기절해 있어' : unblocked;
  const tapped = !!helpless;
  let [dp] = tapped || shielded(defender, attacker) ? [0] : ptOf(defender);
  const a = shortName(attacker.name);
  const d = shortName(defender.name);
  addLog(state, {
    kind: 'combat',
    text: `${josa(a, '이', '가')} ${josa(d, '을', '를')} 공격했다.${helpless ? ` ${josa(d, '은', '는')} ${helpless} 맞서지 못한다.` : ''}`,
    regions: [attacker.region],
    actors: [attacker.id, defender.id],
  });
  for (const [from, to] of [[attacker, defender], [defender, attacker]] as const) {
    const c = shielded(from, to);
    if (c && (from === attacker || !tapped)) addLog(state, { kind: 'combat', text: `${josa(shortName(to.name), '은', '는')} ${COLOR_LABELS[c]}색으로부터 보호받아 ${shortName(from.name)}의 공격에 다치지 않는다.`, regions: [attacker.region], actors: [to.id, from.id] });
  }
  attacker.lastClash = t;
  attacker.attackedAt = t;
  defender.lastClash = t;
  addFoe(defender, attacker.id, t);
  addFoe(attacker, defender.id, t);
  // Struck by one's own master (or striking them): the bond is broken.
  // Not those seized (Roil Elemental, Sorin): only their master's end (or its hour) frees them.
  if (defender.master === attacker.id && !defender.seized) releaseRetainer(state, defender, '주인에게 공격당함');
  if (attacker.master === defender.id && !attacker.seized) releaseRetainer(state, attacker, '주인에게 덤빔');
  remember(defender, attacker, `나를 공격했다 (${formatClock(t)})`, t);
  remember(attacker, defender, `내가 공격했다 (${formatClock(t)})`, t);
  // To the death only if the player is in it.
  const lethal = (x: Actor, y: Actor) => x.kind === 'player' || y.kind === 'player';
  // Trample: what the blow has beyond what kills goes on to someone else standing there.
  // With deathtouch, 1 is all it takes (MTG: lethal damage for a deathtouch source is 1).
  const spill = (from: Actor, to: Actor, power: number) => {
    const needed = Math.max(0, ptOf(to)[1] - woundsOf(to, t));
    const excess = power - (hasAbility(from, 'deathtouch', t) ? Math.min(1, needed) : needed);
    if (!(from.boost?.trample || hasAbility(from, 'trample', t)) || excess <= 0) return null;
    const others = present(state, from.region, from.tile).filter((x) => x.id !== from.id && x.id !== to.id && !down(x));
    return others.length ? { who: others[Math.floor(random(state) * others.length)], excess } : null;
  };
  const spills = [spill(attacker, defender, ap), tapped ? null : spill(defender, attacker, dp)];
  // First strike: if only one side has it, their blow lands first, and one it fells (dead or
  // knocked out) never strikes back. Both or neither: simultaneous. Double strike (Grappling
  // Hook): a first-strike blow and then a regular one too.
  const aDouble = hasAbility(attacker, 'double_strike', t);
  const dDouble = !tapped && hasAbility(defender, 'double_strike', t);
  const aFirst = aDouble || hasAbility(attacker, 'first_strike', t);
  const dFirst = !tapped && (dDouble || hasAbility(defender, 'first_strike', t));
  const hit = (to: Actor, n: number, by: string) => {
    const from = to === defender ? attacker : defender;
    hurt(to, from, n, t);
    return dealDamage(state, world, to, n, t, `${josa(by, '과', '와')}의 싸움`, !lethal(attacker, defender), from, from);
  };
  let [dealtA, dealtD] = [0, 0];
  if (!aFirst && !dFirst) {
    // Simultaneous: both blows land before either death counts.
    hit(defender, ap, a);
    hit(attacker, dp, d);
    [dealtA, dealtD] = [ap, dp];
  } else {
    // The first-strike step, then the regular one for those without first strike and those
    // with double strike, if both still stand.
    if (aFirst) (hit(defender, ap, a), (dealtA += ap));
    if (dFirst) (hit(attacker, dp, d), (dealtD += dp));
    const aAgain = (!aFirst || aDouble) && !down(attacker) && !down(defender);
    const dAgain = (!dFirst || dDouble) && !down(attacker) && !down(defender);
    if (aAgain) (hit(defender, ap, a), (dealtA += ap));
    if (dAgain) (hit(attacker, dp, d), (dealtD += dp));
    for (const [from, to, struck, double] of [[attacker, defender, aFirst, aDouble], [defender, attacker, dFirst, dDouble]] as const) {
      if (double && dealtOf(from) > 0) addLog(state, { kind: 'combat', text: `${josa(shortName(from.name), '이', '가')} 두 번 내리쳤다 (이중 타격).`, regions: [attacker.region], actors: [from.id, to.id] });
      else if (struck && down(to) && !(to === defender ? dFirst : aFirst))
        addLog(state, { kind: 'combat', text: `${josa(shortName(from.name), '이', '가')} 먼저 쳐 ${josa(shortName(to.name), '은', '는')} 되받아치지 못했다 (선제공격).`, regions: [attacker.region], actors: [from.id, to.id] });
    }
    if (!dealtD) spills[1] = null;
    if (!dealtA) spills[0] = null;
  }
  function dealtOf(x: Actor) {
    return x === attacker ? dealtA : dealtD;
  }
  // An aura that doubles its controller's life when its bearer deals combat damage.
  for (const [x, dealt] of [[attacker, dealtA], [defender, dealtD]] as const) {
    if (dealt <= 0) continue;
    lifelink(state, x, dealt, t);
    for (const aura of x.auras ?? []) {
      if (!aura.doubleLifeOnHit) continue;
      const controller = masterOf(state, x) ?? x;
      if (!controller.dead) doubleLife(state, controller, t, `${shortName(x.name)}의 ${aura.name}`);
    }
  }
  // Quest for the Gemblades: combat damage to a creature (no planeswalker).
  for (const [x, dealt, to] of [[attacker, dealtA, defender], [defender, dealtD, attacker]] as const) if (dealt > 0 && to.loyalty === undefined) gembladesHit(state, world, x, t);
  // "Deals combat damage to a player, that player discards a card": one who holds a spell lets one go.
  for (const [x, dealt, to] of [[attacker, dealtA, defender], [defender, dealtD, attacker]] as const) {
    if (dealt > 0 && !to.dead && to.spells?.length && npcDef(state, world, x.id)?.discardOnHit && !powersSealed(state, world, x, t)) owesDiscard(state, world, to, `${shortName(x.name)}의 손길`, t);
  }
  // "Whenever this deals damage to an opponent, sacrifice a land" (Ruinous Minotaur): whoever
  // controls it gives up a land they hold, their pick (with none, nothing).
  for (const [x, dealt] of [[attacker, dealtA], [defender, dealtD]] as const) {
    if (dealt <= 0 || x.dead || !npcDef(state, world, x.id)?.hitSacrificeLand || powersSealed(state, world, x, t)) continue;
    const controller = masterOf(state, x) ?? x;
    const owed = harrowOwed(state, world, controller, { type: 'harrow', spell: `${shortName(x.name)}의 파멸`, left: 0, given: false }, t);
    if (owed) (state.choices ??= []).push(owed);
  }
  // Someone went down: the fight is over.
  if (down(attacker) || down(defender)) {
    attacker.foes = attacker.foes && { ...attacker.foes, ids: attacker.foes.ids.filter((x) => x !== defender.id) };
    defender.foes = defender.foes && { ...defender.foes, ids: defender.foes.ids.filter((x) => x !== attacker.id) };
  }
  for (const [i, s] of spills.entries()) {
    if (!s) continue;
    const by = i === 0 ? a : d;
    const from = i === 0 ? attacker : defender;
    addLog(state, {
      kind: 'combat',
      text: `${by}의 돌진이 ${shortName(s.who.name)}까지 덮쳤다.`,
      regions: [attacker.region],
      actors: [s.who.id],
    });
    hurt(s.who, from, s.excess, t);
    dealDamage(state, world, s.who, s.excess, t, `${by}의 돌진`, !lethal(from, s.who), from, from);
    lifelink(state, from, s.excess, t);
  }
}

// Combat damage `from` dealt `to` today: who has hurt them (Inferno Trap).
export function hurt(to: Actor, from: Actor, n: number, t: number) {
  if (n <= 0) return;
  const day = gameDay(t);
  if (to.hurtBy?.day !== day) to.hurtBy = { day, ids: [] };
  if (!to.hurtBy.ids.includes(from.id)) to.hurtBy.ids.push(from.id);
}

// Lifelink: damage they deal also gains their controller (their master, or themselves) that
// much life.
export function lifelink(state: State, x: Actor, dealt: number, t: number) {
  if (!x.abilities.includes('lifelink') || dealt <= 0) return;
  const controller = masterOf(state, x) ?? x;
  if (controller.dead) return;
  gainLife(state, controller, dealt, t, `${shortName(x.name)}의 생명연결`);
}

// A hungry beast picks the weakest one standing with it (not those of legend, with powers).
function prey(state: State, world: World, a: Actor, t: number) {
  const def = npcDef(state, world, a.id);
  if (!def?.beast || !needsOf(a).includes('hunger') || a.stats.hunger < HUNT_HUNGER) return undefined;
  if (a.task?.kind === 'sleep') return undefined;
  // A token that serves someone (a herd's young) keeps to its master's side; only one with no
  // master hunts (user decision 2026-09-30).
  if (a.master && state.tokens?.[a.id]) return undefined;
  return present(state, a.region, a.tile)
    .filter((b) => b.id !== a.id && !hasPowers(npcDef(state, world, b.id)) && b.boundUntil === undefined && !down(b) && !foesOf(a, t).includes(b.id) && evasion(a, b, t) !== 'evade')
    .sort((x, y) => ptOf(x)[1] - ptOf(y)[1] || x.id.localeCompare(y.id))[0];
}

// "Whenever this attacks, you may pay …: untap all attacking creatures, an additional combat
// phase" (Hellkite Charger): having struck, if both still stand and they can pay, they pay
// ("may": always, [결정]) and strike once more this hour, with their retainers here who struck
// this hour too.
function extraCombat(state: State, world: World, a: Actor, foe: Actor, t: number) {
  const extra = npcDef(state, world, a.id)?.extraCombat;
  if (!extra || down(a) || down(foe) || powersSealed(state, world, a, t)) return;
  if (!planPayment(manaAvailable(state, world, a, t), extra.cost)) return;
  payMana(state, world, a, extra.cost, t);
  addLog(state, {
    kind: 'combat',
    text: `${josa(shortName(a.name), '이', '가')} 힘(${extra.costText})을 끌어올려 다시 날아들었다. 한 번 더 싸운다.`,
    regions: [a.region],
    actors: [a.id, foe.id],
  });
  const band = [a, ...retainersOf(state, a.id).filter((r) => together(r, a) && r.lastClash === t)];
  for (const x of band) if (!down(x) && !down(foe)) clash(state, world, x, foe, t, unblockable(state, world, x, foe, t));
}

// A flyer set on by one who can't fly may take to the air, as an NPC the player attacks (sim/run.ts
// `attack`): 'evade' if they are out of `a`'s reach until midnight, 'ask' if they have yet to
// answer (an NPC: the LLM, after the hour, sim/run.ts `evasions`; the player: a pick they owe,
// sim/asks.ts), null if they stand. Reach (Oran-Rief Recluse) reaches into the sky: none flies
// from one who has it (user decision 2026-10-01).
function evasion(a: Actor, b: Actor, t: number): 'evade' | 'ask' | null {
  if (!hasAbility(b, 'fly', t) || hasAbility(a, 'fly', t) || hasAbility(a, 'reach', t) || b.boundUntil !== undefined || down(b)) return null;
  const e = b.evasions?.find((x) => x.from === a.id && x.until > t);
  return e ? (e.evade ? 'evade' : null) : 'ask';
}

// Why an NPC can't go after `whoId` (an NPC or the player) now (a planned attack, sim/step.ts),
// or null. The player may attack anyone standing with them; an NPC too, but for these.
export function attackBlocked(state: State, world: World, a: Actor, whoId: string | undefined, t: number): string | null {
  const b = whoId ? state.actors[whoId] : undefined;
  if (!b || b.dead) return '그런 이는 없다.';
  if (b.id === a.id) return '자신에게 덤빌 수는 없다.';
  if (hasAbility(a, 'defender', t)) return '먼저 덤비지 않는다.';
  if (a.seized && a.master === b.id) return `붙들린 몸이라 ${shortName(b.name)}에게 덤빌 수 없다.`;
  if (outOfTime(state, b, t)) return `${josa(shortName(b.name), '은', '는')} 여기 없다.`;
  if (awayText(world, a, b)) return awayText(world, a, b);
  return null;
}

// NPCs attack a foe standing with them, one exchange per hour. Their hour goes
// to fighting. A hungry beast makes a foe of its prey; if it kills, it feeds.
export function hostileNpcs(state: State, world: World, t: number) {
  for (const a of Object.values(state.actors)) {
    if (a.kind === 'player' || a.dead || a.travel || a.boundUntil !== undefined || outOfTime(state, a, t)) continue;
    if (a.forced && a.forced.kind !== 'fight') continue; // collapsed
    if (a.lastClash === t) continue; // already fought this hour
    // Defender: they never strike first (they still strike back when struck), but they block:
    // one who fell on their master first, they stand against (user decision 2026-10-01, Makindi
    // Shieldmate). Never their master's own fights, never a hunt.
    const defender = hasAbility(a, 'defender', t);
    // Their own foes, and (a retainer) whoever their master is fighting right here.
    // "Can't block" (Hagra Crocodile): not one who fell on their master first; they only join the
    // fights their master started (user decision 2026-10-01).
    // "Can't block unless you control a Vampire" (Mindless Null): so only while its master's
    // creatures (the master too) hold one.
    const m = masterOf(state, a);
    const unless = npcDef(state, world, a.id)?.cantBlockUnless;
    const cantBlock = hasAbility(a, 'cant_block', t) || (!!unless && !!m && !controlsKind(state, world, m, unless));
    // One that can't be blocked (Aether Figment): no one stands against it for its master.
    const unblockedBy = (id: string) => !!m?.foes?.struck?.includes(id) && !!state.actors[id] && hasAbility(state.actors[id], 'unblockable', t);
    const guards = m && together(m, a) ? foesOf(m, t).filter((id) => !unblockedBy(id) && (defender ? !!m.foes?.struck?.includes(id) : !cantBlock || !m.foes?.struck?.includes(id))) : [];
    const theirs = defender ? guards : [...foesOf(a, t), ...guards];
    let foe = present(state, a.region, a.tile).find((b) => theirs.includes(b.id) && b.id !== a.master && !down(b) && (evasion(a, b, t) !== 'evade' || !!unblockable(state, world, a, b, t, true)));
    const hunted = !foe && !defender && prey(state, world, a, t);
    if (hunted) {
      foe = hunted;
      addFoe(a, foe.id, t);
      addLog(state, {
        kind: 'combat',
        text: `굶주린 ${josa(shortName(a.name), '이', '가')} ${josa(shortName(foe.name), '을', '를')} 덮쳤다.`,
        regions: [a.region],
        actors: [a.id, foe.id],
      });
    }
    if (!foe) continue;
    // A flyer yet to answer: the blow waits for it (asked after the hour).
    // One who can't block it (asleep, protection) can't fly from it either; prey of a landwalker or
    // an intimidator may.
    const walked = unblockable(state, world, a, foe, t);
    const pinned = unblockable(state, world, a, foe, t, true);
    // Pinned: no asking this hour. Hooked ("block it this turn"): they stand and fight it out today.
    if (pinned && evasion(a, foe, t) === 'ask') {
      if (hooks(state, world, a)) foe.evasions = [...(foe.evasions ?? []).filter((e) => e.until > t && e.from !== a.id), { from: a.id, evade: false, until: untapTime(t) }];
      addLog(state, { kind: 'combat', text: `${josa(shortName(foe.name), '은', '는')} ${pinned} 날아 달아나지 못한다.`, regions: [a.region], actors: [foe.id, a.id] });
    }
    if (!pinned && evasion(a, foe, t) === 'ask') {
      const f = foe;
      if (f.kind === 'player') {
        const owed = [...(state.choices ?? []), ...(state.asks ?? [])].some((c) => c.effect.type === 'evade' && c.effect.from === a.id);
        if (!owed) (state.choices ??= []).push({ by: f.id, land: f.region, effect: { type: 'evade', from: a.id }, candidates: [a.id], t });
      } else if (!state.evades?.some((e) => e.by === f.id && e.from === a.id)) (state.evades ??= []).push({ by: f.id, from: a.id, t });
      continue;
    }
    a.forced = { kind: 'fight', activity: `${josa(shortName(foe.name), '과', '와')} 싸움`, emoji: '⚔️', until: t + STEP_MINUTES };
    clash(state, world, a, foe, t, walked);
    extraCombat(state, world, a, foe, t);
    // A beast feeds on what it brought down (a kill, or an NPC knocked out).
    if (down(foe) && !down(a) && npcDef(state, world, a.id)?.beast) {
      a.stats.hunger = Math.max(0, a.stats.hunger - KILL_FEED);
      const text = foe.dead
        ? `${josa(shortName(a.name), '이', '가')} ${josa(shortName(foe.name), '을', '를')} 먹어치웠다.`
        : `${josa(shortName(a.name), '이', '가')} 쓰러진 ${josa(shortName(foe.name), '을', '를')} 물어뜯어 배를 채웠다.`;
      addLog(state, { kind: 'combat', text, regions: [a.region], actors: [a.id, foe.id] });
    }
  }
}
