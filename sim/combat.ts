// Combat, MTG style (world/README.md: MTG 규칙 → 게임 대응). Damage piles up against
// toughness for the rest of the turn (game day); reaching toughness is death. One hour of
// fighting is one exchange: both sides strike at once, except that a tapped (bound) defender
// can't strike back.
import { gameDay, STEP_MINUTES } from './clock.ts';
import { HUNT_HUNGER, KILL_FEED } from './rules.ts';
import { addLog, needsOf, npcDef, present, ptOf, random } from './state.ts';
import type { Actor, State } from './state.ts';
import type { World } from './world.ts';
import { josa, shortName } from './text.ts';

export function woundsOf(a: Actor, t: number) {
  return a.wounds?.day === gameDay(t) ? a.wounds.amount : 0;
}

// Returns whether it killed them.
export function dealDamage(state: State, a: Actor, amount: number, t: number, cause: string) {
  if (a.dead || amount <= 0) return false;
  const total = woundsOf(a, t) + amount;
  a.wounds = { day: gameDay(t), amount: total };
  const toughness = ptOf(a)[1];
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
  const tapped = defender.boundUntil !== undefined;
  const [dp] = tapped ? [0] : ptOf(defender);
  const a = shortName(attacker.name);
  const d = shortName(defender.name);
  addLog(state, {
    kind: 'combat',
    text: `${josa(a, '이', '가')} ${josa(d, '을', '를')} 공격했다.${tapped ? ` ${josa(d, '은', '는')} 묶여 있어 맞서지 못한다.` : ''}`,
    regions: [attacker.region],
    actors: [attacker.id, defender.id],
  });
  attacker.lastClash = t;
  defender.lastClash = t;
  addFoe(defender, attacker.id, t);
  addFoe(attacker, defender.id, t);
  // Trample: what the blow has beyond what kills goes on to someone else standing there.
  const spill = (from: Actor, to: Actor, power: number) => {
    const excess = power - (ptOf(to)[1] - woundsOf(to, t));
    if (!from.boost?.trample || excess <= 0) return null;
    const others = present(state, from.region).filter((x) => x.id !== from.id && x.id !== to.id);
    return others.length ? { who: others[Math.floor(random(state) * others.length)], excess } : null;
  };
  const spills = [spill(attacker, defender, ap), tapped ? null : spill(defender, attacker, dp)];
  // Simultaneous: both blows land before either death counts.
  dealDamage(state, defender, ap, t, `${josa(a, '과', '와')}의 싸움`);
  dealDamage(state, attacker, dp, t, `${josa(d, '과', '와')}의 싸움`);
  for (const [i, s] of spills.entries()) {
    if (!s) continue;
    const by = i === 0 ? a : d;
    addLog(state, {
      kind: 'combat',
      text: `${by}의 돌진이 ${shortName(s.who.name)}까지 덮쳤다.`,
      regions: [attacker.region],
      actors: [s.who.id],
    });
    dealDamage(state, s.who, s.excess, t, `${by}의 돌진`);
  }
}

// A hungry beast picks the weakest one standing with it (not the great beings).
function prey(state: State, world: World, a: Actor, t: number) {
  const def = npcDef(state, world, a.id);
  if (!def?.beast || !needsOf(a).includes('hunger') || a.stats.hunger < HUNT_HUNGER) return undefined;
  if (a.task?.kind === 'sleep') return undefined;
  return present(state, a.region)
    .filter((b) => b.id !== a.id && b.kind !== 'being' && b.boundUntil === undefined && !foesOf(a, t).includes(b.id))
    .sort((x, y) => ptOf(x)[1] - ptOf(y)[1] || x.id.localeCompare(y.id))[0];
}

// NPCs (and beings) attack a foe standing with them, one exchange per hour. Their hour goes
// to fighting. A hungry beast makes a foe of its prey; if it kills, it feeds.
export function hostileNpcs(state: State, world: World, t: number) {
  for (const a of Object.values(state.actors)) {
    if (a.kind === 'player' || a.dead || a.travel || a.boundUntil !== undefined) continue;
    if (a.forced && a.forced.kind !== 'fight') continue; // collapsed
    if (a.lastClash === t) continue; // already fought this hour
    let foe = present(state, a.region).find((b) => foesOf(a, t).includes(b.id));
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
    a.forced = { kind: 'fight', activity: `${josa(shortName(foe.name), '과', '와')} 싸움`, emoji: '⚔️', until: t + STEP_MINUTES };
    clash(state, a, foe, t);
    if (foe.dead && !a.dead && npcDef(state, world, a.id)?.beast) {
      a.stats.hunger = Math.max(0, a.stats.hunger - KILL_FEED);
      addLog(state, { kind: 'combat', text: `${josa(shortName(a.name), '이', '가')} ${josa(shortName(foe.name), '을', '를')} 먹어치웠다.`, regions: [a.region], actors: [a.id] });
    }
  }
}
