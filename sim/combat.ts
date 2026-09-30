// Combat, MTG style (world/README.md: MTG 규칙 → 게임 대응). Damage piles up against
// toughness for the rest of the turn (game day); reaching toughness is death. One hour of
// fighting is one exchange: both sides strike at once, except that a tapped (bound) defender
// can't strike back. A fight with no player in it is not to the death: whoever goes down is
// knocked out for a few hours and the fight is over.
import { formatClock, gameDay, STEP_MINUTES } from './clock.ts';
import { remember } from './relations.ts';
import { masterOf, releaseRetainer, retainersOf } from './retainers.ts';
import { releaseItems } from './items.ts';
import { doubleLife, gainLife, lifeOf } from './life.ts';
import { manaAvailable, payMana, planPayment } from './mana.ts';
import { HUNT_HUNGER, KILL_FEED, KO_ACTIVITY, KO_HOURS } from './rules.ts';
import { addLog, hasAbility, needsOf, npcDef, outOfTime, present, ptOf, random } from './state.ts';
import type { Actor, State } from './state.ts';
import { hasPowers } from './world.ts';
import type { World } from './world.ts';
import { josa, shortName } from './text.ts';

export function woundsOf(a: Actor, t: number) {
  return a.wounds?.day === gameDay(t) ? a.wounds.amount : 0;
}

// Returns whether it killed them. Nonlethal damage knocks out instead of killing. A
// planeswalker's damage comes off their loyalty; at 0 they leave the plane.
export function dealDamage(state: State, a: Actor, amount: number, t: number, cause: string, nonlethal = false) {
  if (a.dead || amount <= 0) return false;
  if (a.loyalty !== undefined) {
    a.loyalty = Math.max(nonlethal ? 1 : 0, a.loyalty - amount);
    addLog(state, { kind: 'combat', text: `${josa(shortName(a.name), '이', '가')} 피해 ${amount}로 기세가 꺾였다 (기세 ${a.loyalty}).`, regions: [a.region], actors: [a.id] });
    if (a.loyalty <= 0) leavePlane(state, a, t, cause);
    return false;
  }
  const toughness = ptOf(a)[1];
  const total = woundsOf(a, t) + amount;
  if (total >= toughness && nonlethal) {
    knockOut(state, a, t, cause);
    return false;
  }
  a.wounds = { day: gameDay(t), amount: total };
  if (total >= toughness) {
    die(state, a, t, cause);
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

export function die(state: State, a: Actor, t: number, cause: string) {
  a.dead = { at: t, cause };
  // A retainer who dies goes to their master's graveyard.
  const m = a.master ? state.actors[a.master] : undefined;
  if (m) m.fallen = [...(m.fallen ?? []), a.id];
  for (const r of retainersOf(state, a.id)) releaseRetainer(state, r, `${shortName(a.name)}의 죽음`);
  releaseItems(state, a, t);
  a.task = undefined;
  a.forced = undefined;
  a.travel = undefined;
  delete a.boundUntil;
  if (a.kind === 'player') state.over = { at: t, cause };
  addLog(state, {
    kind: 'death',
    text: `${josa(shortName(a.name), '이', '가')} 죽었다 (${cause}).`,
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
function down(a: Actor) {
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
export function clash(state: State, attacker: Actor, defender: Actor, t: number) {
  const [ap] = ptOf(attacker);
  // A tapped (bound) or knocked-out defender can't strike back.
  const helpless = defender.boundUntil !== undefined ? '묶여' : knockedOut(defender) ? '기절해' : null;
  const tapped = !!helpless;
  const [dp] = tapped ? [0] : ptOf(defender);
  const a = shortName(attacker.name);
  const d = shortName(defender.name);
  addLog(state, {
    kind: 'combat',
    text: `${josa(a, '이', '가')} ${josa(d, '을', '를')} 공격했다.${helpless ? ` ${josa(d, '은', '는')} ${helpless} 있어 맞서지 못한다.` : ''}`,
    regions: [attacker.region],
    actors: [attacker.id, defender.id],
  });
  attacker.lastClash = t;
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
  const spill = (from: Actor, to: Actor, power: number) => {
    const excess = power - (ptOf(to)[1] - woundsOf(to, t));
    if (!(from.boost?.trample || from.abilities.includes('trample')) || excess <= 0) return null;
    const others = present(state, from.region).filter((x) => x.id !== from.id && x.id !== to.id && !down(x));
    return others.length ? { who: others[Math.floor(random(state) * others.length)], excess } : null;
  };
  const spills = [spill(attacker, defender, ap), tapped ? null : spill(defender, attacker, dp)];
  // Simultaneous: both blows land before either death counts.
  dealDamage(state, defender, ap, t, `${josa(a, '과', '와')}의 싸움`, !lethal(attacker, defender));
  dealDamage(state, attacker, dp, t, `${josa(d, '과', '와')}의 싸움`, !lethal(attacker, defender));
  // An aura that doubles its controller's life when its bearer deals combat damage.
  for (const [x, dealt] of [[attacker, ap], [defender, dp]] as const) {
    if (dealt <= 0) continue;
    lifelink(state, x, dealt, t);
    for (const aura of x.auras ?? []) {
      if (!aura.doubleLifeOnHit) continue;
      const controller = masterOf(state, x) ?? x;
      if (!controller.dead) doubleLife(state, controller, t, `${shortName(x.name)}의 ${aura.name}`);
    }
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
    dealDamage(state, s.who, s.excess, t, `${by}의 돌진`, !lethal(from, s.who));
    lifelink(state, from, s.excess, t);
  }
}

// Lifelink: damage they deal also gains their controller (their master, or themselves) that
// much life.
function lifelink(state: State, x: Actor, dealt: number, t: number) {
  if (!x.abilities.includes('lifelink') || dealt <= 0) return;
  const controller = masterOf(state, x) ?? x;
  if (controller.dead || lifeOf(controller) === null) return;
  gainLife(state, controller, dealt, t, `${shortName(x.name)}의 생명연결`);
}

// A hungry beast picks the weakest one standing with it (not those of legend, with powers).
function prey(state: State, world: World, a: Actor, t: number) {
  const def = npcDef(state, world, a.id);
  if (!def?.beast || !needsOf(a).includes('hunger') || a.stats.hunger < HUNT_HUNGER) return undefined;
  if (a.task?.kind === 'sleep') return undefined;
  return present(state, a.region)
    .filter((b) => b.id !== a.id && !hasPowers(npcDef(state, world, b.id)) && b.boundUntil === undefined && !down(b) && !foesOf(a, t).includes(b.id) && evasion(a, b, t) !== 'evade')
    .sort((x, y) => ptOf(x)[1] - ptOf(y)[1] || x.id.localeCompare(y.id))[0];
}

// "Whenever this attacks, you may pay …: untap all attacking creatures, an additional combat
// phase" (Hellkite Charger): having struck, if both still stand and they can pay, they pay
// ("may": always, [결정]) and strike once more this hour, with their retainers here who struck
// this hour too.
function extraCombat(state: State, world: World, a: Actor, foe: Actor, t: number) {
  const extra = npcDef(state, world, a.id)?.extraCombat;
  if (!extra || down(a) || down(foe)) return;
  if (!planPayment(manaAvailable(state, world, a, t), extra.cost)) return;
  payMana(state, world, a, extra.cost, t);
  addLog(state, {
    kind: 'combat',
    text: `${josa(shortName(a.name), '이', '가')} 힘(${extra.costText})을 끌어올려 다시 날아들었다. 한 번 더 싸운다.`,
    regions: [a.region],
    actors: [a.id, foe.id],
  });
  const band = [a, ...retainersOf(state, a.id).filter((r) => r.region === a.region && !r.travel && r.lastClash === t)];
  for (const x of band) if (!down(x) && !down(foe)) clash(state, x, foe, t);
}

// A flyer NPC set on by one who can't fly may take to the air, as when the player attacks them
// (sim/run.ts `attack`): 'evade' if they are out of `a`'s reach until midnight, 'ask' if they
// have yet to answer (the LLM, after the hour: sim/run.ts `evasions`), null if they stand.
function evasion(a: Actor, b: Actor, t: number): 'evade' | 'ask' | null {
  if (b.kind !== 'npc' || !hasAbility(b, 'fly', t) || hasAbility(a, 'fly', t) || b.boundUntil !== undefined || down(b)) return null;
  const e = b.evasions?.find((x) => x.from === a.id && x.until > t);
  return e ? (e.evade ? 'evade' : null) : 'ask';
}

// Why an NPC can't go after `whoId` now (a planned attack, sim/step.ts), or null. The player
// may attack anyone standing with them; an NPC too, but for these.
export function attackBlocked(state: State, a: Actor, whoId: string | undefined, t: number): string | null {
  const b = whoId ? state.actors[whoId] : undefined;
  if (!b || b.dead || b.kind !== 'npc') return '그런 이는 없다.';
  if (b.id === a.id) return '자신에게 덤빌 수는 없다.';
  if (hasAbility(a, 'defender', t)) return '먼저 덤비지 않는다.';
  if (a.seized && a.master === b.id) return `붙들린 몸이라 ${shortName(b.name)}에게 덤빌 수 없다.`;
  if (b.region !== a.region || b.travel || outOfTime(state, b, t)) return `${josa(shortName(b.name), '은', '는')} 여기 없다.`;
  return null;
}

// NPCs attack a foe standing with them, one exchange per hour. Their hour goes
// to fighting. A hungry beast makes a foe of its prey; if it kills, it feeds.
export function hostileNpcs(state: State, world: World, t: number) {
  for (const a of Object.values(state.actors)) {
    if (a.kind === 'player' || a.dead || a.travel || a.boundUntil !== undefined || outOfTime(state, a, t)) continue;
    if (a.forced && a.forced.kind !== 'fight') continue; // collapsed
    if (a.lastClash === t) continue; // already fought this hour
    // Defender: they never strike first (they still strike back when struck).
    if (hasAbility(a, 'defender', t)) continue;
    // Their own foes, and (a retainer) whoever their master is fighting right here.
    const m = masterOf(state, a);
    const theirs = [...foesOf(a, t), ...(m && m.region === a.region && !m.travel ? foesOf(m, t) : [])];
    let foe = present(state, a.region).find((b) => theirs.includes(b.id) && b.id !== a.master && !down(b) && evasion(a, b, t) !== 'evade');
    const hunted = !foe && prey(state, world, a, t);
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
    if (evasion(a, foe, t) === 'ask') {
      if (!state.evades?.some((e) => e.by === foe!.id && e.from === a.id)) (state.evades ??= []).push({ by: foe.id, from: a.id, t });
      continue;
    }
    a.forced = { kind: 'fight', activity: `${josa(shortName(foe.name), '과', '와')} 싸움`, emoji: '⚔️', until: t + STEP_MINUTES };
    clash(state, a, foe, t);
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
