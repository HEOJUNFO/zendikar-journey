// One game hour of the world, rules only (no LLM, no I/O). The LLM prepares the day's plans
// ahead of time (sim/run.ts): every NPC's day, and the day's events and powers. This applies
// them. The world doesn't move on without every NPC's plan; without the day's events plan
// nothing is raised that day.
//
// Order within an hour: raised events -> factions -> regions -> characters -> meetings.
import { formatClock, gameDay, minuteOfDay, STEP_MINUTES, untapTime } from './clock.ts';
import {
  applyEffect,
  BOND_HOURS,
  COLLAPSE_HOURS,
  EXPLORE_EFFECT,
  FIGHT_EFFECT,
  DEPLETED_HOURS,
  DESTROYED_DAYS,
  DEPLETED_LABEL,
  KIND_EFFECTS,
  STARVING,
  STARVING_ENERGY,
  TRAVEL_EFFECT,
} from './rules.ts';
import { gainedLifeToday, loseLife } from './life.ts';
import { forget, forgetAbout } from './relations.ts';
import { addLog, alive, landUnusable, needsOf, npcDef, outOfTime, present, ptOf, random } from './state.ts';
import { addFoe, attackBlocked, dealDamage, foesOf, hostileNpcs } from './combat.ts';
import { bondBlocked, bondLand, expireGranted, FETCH_HOURS, fetchLand, fetchSource, growBlocked, growEntered, growLand, spawnWild, summonLibrary, upkeepRevive, useAbility } from './abilities.ts';
import { CLAIM_HOURS, claimBlocked, claimItem, itemsAt } from './items.ts';
import { EON_HOURS, eonLand, holdStill, spendBlocked, spendDay, storeBlocked, storeDay, timeNews } from './eons.ts';
import { upkeepWins } from './win.ts';
import { CRAWL_FACTOR, dryOut, stranded } from './stranded.ts';
import { wanderHour, withPositions } from './wander.ts';
import { anthemHour, upkeepSacrifice } from './monument.ts';
import { HIRE_HOURS, hireBlocked, hireMerc } from './allies.ts';
import { COURT_HOURS, courtBlocked, followsMaster, masterOf, readyCourt, refusedToday, upkeepPossessions } from './retainers.ts';
import { learnBlocked, learnSpell, npcCastBlocked, readyCast, spellDef } from './spells.ts';
import { payMana } from './mana.ts';
import type { Actor, GmPlan, State, Task } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import { currentBlock } from './types.ts';
import { ABILITY_LABELS, affectedRegions, hasPowers, region, TERRAINS, travelHours } from './world.ts';
import type { EventDef, World } from './world.ts';

export function step(state: State, placed: World) {
  const t = state.minutes;
  // Wandering places (Goma Fada) walk first; the hour then measures the map as it is now.
  wanderHour(state, placed, t);
  const world = withPositions(state, placed);
  startDay(state, world, t);
  gmLayer(state, world, t);
  // Factions: none yet (world/entities/factions is empty).
  regionLayer(state, world, t);
  anthemHour(state, world);
  dryOut(state, world, t);
  hostileNpcs(state, world, t);
  for (const a of alive(state)) {
    // Out of time (a day left in Magosi, or someone else's extra day): nothing moves for them.
    if (outOfTime(state, a, t)) {
      holdStill(a);
      continue;
    }
    actorHour(state, world, a, t);
    // A timed task done: the player's action, or an NPC's bonding, taming or keeping days.
    const done = a.task?.until !== undefined && a.task.until <= t + STEP_MINUTES && !a.travel;
    const timed = ['bond', 'claim', 'store_day', 'spend_day', 'grow', 'fetch', 'learn', 'cast', 'court', 'hire'];
    if (done && (a.kind === 'player' || timed.includes(a.task!.kind))) {
      const at = t + STEP_MINUTES;
      if (a.task!.kind === 'bond') bondLand(state, world, a, at, a.region, a.task!.target);
      if (a.task!.kind === 'learn' && a.task!.spell) learnSpell(state, world, a, a.task!.spell, at);
      if (a.task!.kind === 'claim' && a.task!.item) claimItem(state, world, a, a.task!.item, at);
      if (a.task!.kind === 'fetch' && a.task!.from && a.task!.land) fetchLand(state, world, a, a.task!.from, a.task!.land, at, a.task!.target);
      if (a.task!.kind === 'store_day' && a.task!.land) storeDay(state, world, a, a.task!.land, at);
      if (a.task!.kind === 'spend_day' && a.task!.land) spendDay(state, world, a, a.task!.land, at);
      if (a.task!.kind === 'grow' && a.task!.land) growEntered(state, world, a, a.task!.land, at);
      // An NPC's spell: whom it falls on is asked of the LLM after the hour (the player's was cast as they began).
      if (a.task!.kind === 'cast' && a.kind === 'npc' && a.task!.spell) readyCast(state, world, a, a.task!.spell, at);
      // A court: the beast decides after the hour whether to follow them.
      if (a.task!.kind === 'court' && a.task!.who) readyCourt(state, world, a, a.task!.who, at);
      if (a.task!.kind === 'hire' && a.task!.who) hireMerc(state, world, a, a.task!.who, at);
      a.task = undefined;
    }
  }
  enterEvents(state, world, t + STEP_MINUTES);
  attackEvents(state, world, t);
  meetings(state, world);
  state.minutes = t + STEP_MINUTES;
}

// --- day start ---------------------------------------------------------------------------

function startDay(state: State, world: World, t: number) {
  const day = gameDay(t);
  // The upkeep: at a turn's start. Who is out of time today hears so first.
  if (minuteOfDay(t) === 0) {
    timeNews(state, world, t);
    expireGranted(state, t);
    upkeepRevive(state, world, t);
    upkeepWins(state, world, t);
    upkeepSacrifice(state, world, t);
    upkeepPossessions(state, t);
  }
  if (state.gm.day !== day) state.gm = { day, source: 'none', fires: [] };
  if (state.met.day !== day) state.met = { day, pairs: [] };
  // "Until end of turn" wears off.
  for (const a of alive(state)) {
    if (!a.boost || a.boost.until > t) continue;
    delete a.boost;
    addLog(state, { kind: 'status', text: `${shortName(a.name)}의 기세가 가라앉았다 (${ptOf(a).join('/')}).`, regions: [a.region], actors: [a.id] });
  }
}

function onCooldown(state: State, ev: EventDef, t: number) {
  const last = state.events[ev.id]?.lastFired;
  return last !== undefined && t - last < ev.cooldownHours * 60;
}

// Events the morning LLM may raise today. One someone must pay for needs them alive.
export function eligibleGmEvents(state: State, world: World, t: number) {
  return world.events.filter(
    (e) =>
      e.trigger === 'gm' &&
      !onCooldown(state, e, t) &&
      !state.pending.some((p) => p.eventId === e.id) &&
      !(e.cost && state.actors[e.cost.by]?.dead),
  );
}

// --- raised events -----------------------------------------------------------------------

function gmLayer(state: State, world: World, t: number) {
  const due = state.pending.filter((p) => p.at <= t);
  state.pending = state.pending.filter((p) => p.at > t);
  for (const p of due) {
    const ev = world.events.find((e) => e.id === p.eventId);
    if (ev) fire(state, world, ev, t, true, p);
  }

  const hour = Math.floor(minuteOfDay(t) / 60);
  if (state.gm.day === gameDay(t)) {
    for (const f of state.gm.fires) {
      const ev = world.events.find((e) => e.id === f.eventId);
      if (ev && f.hour === hour) trigger(state, world, ev, t, { by: [], lands: [] });
    }
    for (const u of state.gm.uses ?? []) {
      if (u.hour !== hour) continue;
      const [by, on] = [state.actors[u.being], u.target ? state.actors[u.target] : undefined];
      if ((by && outOfTime(state, by, t)) || (on && outOfTime(state, on, t))) continue;
      const why = useAbility(state, world, u.being, u.ability, u.target, t);
      if (why) console.warn(`Ability ${u.being}/${u.ability} on ${u.target} skipped: ${why}`);
    }
  }

  // Landfall: someone bonded with the region (it came under their control) as this hour began,
  // standing there or from afar (a fetch land), and it is at least their Nth land this turn (a
  // land is a region, a turn is a game day).
  for (const ev of world.events) {
    if (ev.trigger !== 'landfall' || onCooldown(state, ev, t)) continue;
    if (state.pending.some((p) => p.eventId === ev.id)) continue;
    const by = alive(state).filter(
      (a) =>
        a.landfallAt === t &&
        a.landfalls?.day === gameDay(t) &&
        a.landfalls.regions.at(-1) === ev.region &&
        a.landfalls.regions.length >= (ev.landfalls ?? 1),
    );
    if (!by.length) continue;
    // Their lands this turn, latest first: what a land-destroying effect hits.
    const lands = [...new Set(by.flatMap((a) => [...a.landfalls!.regions].reverse()))];
    trigger(state, world, ev, t, { by: by.map((a) => a.id), lands });
  }
}

// Enter: someone arrived in the region at `at` (the end of this hour). Checked right after
// the characters move, so a traveller is met at the gate, not an hour later.
function enterEvents(state: State, world: World, at: number) {
  for (const ev of world.events) {
    // Those here who drew enough spells today, each once a day (this spring included).
    if (ev.trigger === 'drew') {
      if (onCooldown(state, ev, at)) continue;
      const here = new Set([ev.region, ...world.regions.filter((r) => r.parent === ev.region).map((r) => r.id)]);
      const day = gameDay(at);
      const by = alive(state).filter(
        (a) => here.has(a.region) && !a.travel && !outOfTime(state, a, at) && a.drawn?.day === day && a.drawn.count >= ev.cards! && !a.drawn.sprung?.includes(ev.id),
      );
      for (const a of by) a.drawn!.sprung = [...(a.drawn!.sprung ?? []), ev.id];
      if (by.length) trigger(state, world, ev, at, { by: by.map((a) => a.id), lands: [] });
      continue;
    }
    if (ev.trigger !== 'enter' || onCooldown(state, ev, at)) continue;
    if (state.pending.some((p) => p.eventId === ev.id)) continue;
    const by = present(state, ev.region).filter((a) => a.arrivedAt === at && (!ev.gained_life || gainedLifeToday(a, at)) && (!ev.refused || refusedToday(a, at)) && (!ev.searched || a.searched === gameDay(at)) && (!ev.claimed || a.claimed === gameDay(at)));
    if (by.length) trigger(state, world, ev, at, { by: by.map((a) => a.id), lands: [] });
  }
}

// Those who struck as attackers this hour, where an `attacked` event lies: enough of them set
// it off (Arrow Volley Trap).
function attackEvents(state: State, world: World, t: number) {
  for (const ev of world.events) {
    if (ev.trigger !== 'attacked' || onCooldown(state, ev, t)) continue;
    const by = alive(state).filter((a) => a.region === ev.region && a.attackedAt === t);
    if (by.length >= ev.attackers!) trigger(state, world, ev, t, { by: by.map((a) => a.id), lands: [] });
  }
}

// Land destruction: the land is destroyed for everyone for DESTROYED_DAYS (bonds with it are
// kept and give mana again when it comes back). `by`: whose doing (its `destroyed` events
// answer, e.g. the Cobra Trap).
export function destroyLand(state: State, world: World, id: string, by: string[], t: number, source: string, scope: 'region' | 'world' = 'region') {
  state.regions[id] ??= { conditions: [] };
  if (state.regions[id].destroyed) return false;
  state.regions[id].destroyed = { at: t, source, until: ruinsUntil(t) };
  addLog(state, {
    kind: 'condition',
    text: `${region(world, id).name}: 땅이 부서졌다. ${formatClock(ruinsUntil(t))}까지 이곳에서는 아무것도 얻을 수 없다.`,
    regions: [id],
    scope,
  });
  permanentDestroyed(state, world, id, by, t);
  return true;
}

// A noncreature permanent in `regionId` (for now the land itself) was destroyed by `by`'s
// doing: the land's `destroyed` events answer.
function permanentDestroyed(state: State, world: World, regionId: string, by: string[], t: number) {
  for (const ev of world.events) {
    if (ev.trigger !== 'destroyed' || ev.region !== regionId || onCooldown(state, ev, t)) continue;
    trigger(state, world, ev, t, { by, lands: [] });
  }
}

// Who set an event off and the lands they made landfall on this turn (latest first).
type Cause = { by: string[]; lands: string[] };

function trigger(state: State, world: World, ev: EventDef, t: number, cause: Cause) {
  state.events[ev.id] = { lastFired: t };
  if (!ev.omen) return fire(state, world, ev, t, false, cause);
  const regions = affectedRegions(world, ev).map((r) => r.id);
  addLog(state, { kind: 'omen', text: ev.omen, regions: [ev.region, ...regions], scope: ev.scope });
  state.pending.push({ eventId: ev.id, at: t + STEP_MINUTES, ...cause });
}

function fire(state: State, world: World, ev: EventDef, t: number, omened: boolean, cause: Partial<Cause>) {
  const regions = affectedRegions(world, ev).map((r) => r.id);
  const targets = alive(state).filter((a) => !a.travel && regions.includes(a.region) && !outOfTime(state, a, t));
  addLog(state, {
    kind: 'event',
    text: ev.text,
    regions: [ev.region, ...regions],
    scope: ev.scope,
    actors: targets.map((a) => a.id),
  });
  // "You may pay X. If you do, ...": the effects need someone to pay.
  if (ev.cost) {
    const payer = state.actors[ev.cost.by];
    const who = shortName(payer?.name ?? ev.cost.by);
    if (!payer || payer.dead || !payMana(state, world, payer, ev.cost.mana, t)) {
      addLog(state, { kind: 'effect', text: `${who}에게는 힘이 남아 있지 않았다 (${ev.cost.text}).`, regions: [ev.region, ...regions], scope: ev.scope });
      return;
    }
  }
  const dodged = (a: (typeof targets)[number]) => {
    if (!omened || a.pace !== 'careful') return false;
    addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '은', '는')} 전조를 알아채고 몸을 피했다.`, regions: [a.region], actors: [a.id] });
    return true;
  };
  for (const eff of ev.effects) {
    if (eff.type === 'damage') {
      for (const a of targets) if (!dodged(a)) dealDamage(state, a, eff.amount, t, ev.name);
    } else if (eff.type === 'stat') {
      for (const a of targets) {
        const name = shortName(a.name);
        if (dodged(a)) continue;
        applyEffect(a.stats, eff, 60, needsOf(a));
        addLog(state, { kind: 'effect', text: `${josa(name, '이', '가')} 휘말렸다 (${describeStat(eff)}).`, regions: [a.region], actors: [a.id] });
      }
    } else if (eff.type === 'tap') {
      const until = untapTime(t, eff.skip_untap);
      const people = targets.filter((a) => !a.dead && a.boundUntil === undefined);
      for (let i = people.length - 1; i > 0; i--) {
        const j = Math.floor(random(state) * (i + 1));
        [people[i], people[j]] = [people[j], people[i]];
      }
      const tappedPeople = people.slice(0, eff.max);
      for (const a of tappedPeople) {
        a.boundUntil = until;
        a.task = undefined;
        a.forced = undefined;
        addLog(state, {
          kind: 'effect',
          text: `${josa(shortName(a.name), '이', '가')} 묶였다. ${formatClock(until)}까지 움직일 수 없다.`,
          regions: [a.region],
          actors: [a.id],
        });
      }
      for (const id of regions.slice(0, eff.max - tappedPeople.length)) {
        state.regions[id] ??= { conditions: [] };
        state.regions[id].conditions.push({ label: eff.land_label, until, blocksTravel: false, tapped: true, source: ev.id });
        addLog(state, { kind: 'condition', text: `${region(world, id).name}: ${eff.land_label} (${formatClock(until)}까지 쓸 수 없다)`, regions: [id], scope: ev.scope });
      }
    } else if (eff.type === 'damage_hand') {
      for (const id of cause.by ?? []) {
        const a = state.actors[id];
        if (!a || a.dead || a.travel) continue;
        const n = a.spells?.length ?? 0;
        if (n) dealDamage(state, a, n, t, `${ev.name} (쥔 주문 ${n})`);
        else addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '은', '는')} 쥔 주문이 없어 불길이 비껴갔다.`, regions: [a.region], actors: [a.id], t });
      }
    } else if (eff.type === 'lose_life') {
      for (const id of cause.by ?? []) {
        const a = state.actors[id];
        if (a && regions.includes(a.region) && !a.travel) loseLife(state, a, eff.amount, t, ev.name);
      }
    } else if (eff.type === 'destroy_lands') {
      for (const id of (cause.lands ?? []).slice(0, eff.count)) destroyLand(state, world, id, cause.by ?? [], t, ev.id, ev.scope);
    } else if (eff.type === 'create') {
      const born = spawnWild(state, world, eff.creature, eff.pt, eff.count, ev.region, eff.colors);
      const kind = world.lore.find((l) => l.id === eff.creature)?.name ?? eff.creature;
      addLog(state, { kind: 'event', text: `${kind} ${eff.count}마리가 쏟아져 나왔다 (${eff.pt.join('/')}).`, regions: [ev.region], actors: born.map((b) => b.id) });
      // They turn on whoever set it off, for the rest of the day.
      for (const b of born) for (const id of cause.by ?? []) addFoe(b, id, t);
    } else if (eff.type === 'volley') {
      // How it falls among them is the trap's, asked after the hour.
      if (cause.by?.length) (state.volleys ??= []).push({ event: ev.id, amount: eff.amount, by: cause.by, region: ev.region, t });
    } else if (eff.type === 'forget') {
      for (const id of cause.by ?? []) {
        const a = state.actors[id];
        if (!a || a.dead || a.travel) continue;
        const name = shortName(a.name);
        // The player: those who know them forget them.
        if (a.kind === 'player') {
          const forgot = forgetAbout(alive(state), a.id, eff.count, () => random(state));
          addLog(state, {
            kind: 'effect',
            text: forgot.length
              ? `${forgot.map((x) => shortName(x.name)).join(', ')}의 기억에서 ${josa(name, '이', '가')} 지워졌다 (${forgot.length}명).`
              : `${josa(name, '을', '를')} 기억하는 이가 없어 지워질 것도 없었다.`,
            regions: [a.region],
            actors: [a.id, ...forgot.map((x) => x.id)],
            t,
          });
          continue;
        }
        const gone = forget(a, eff.count, () => random(state));
        addLog(state, {
          kind: 'effect',
          text: gone.length
            ? `${josa(name, '이', '가')} 기억 ${gone.length}개를 잃었다 (${josa(gone.join(', '), '을', '를')} 어떻게 여겼는지 잊었다).`
            : `${josa(name, '은', '는')} 잃을 기억이 없었다.`,
          regions: [a.region],
          actors: [a.id],
          t,
        });
      }
    } else if (eff.type === 'summon') {
      // Which of the creatures looked at is drawn here (if any) is the trap's, asked after the hour.
      const creatures = summonLibrary(state, world, ev.region, cause.by ?? []).slice(0, eff.look);
      if (creatures.length) (state.summons ??= []).push({ event: ev.id, creatures, by: cause.by ?? [], region: ev.region, t });
    } else {
      for (const id of regions) {
        state.regions[id] ??= { conditions: [] };
        state.regions[id].conditions.push({ label: eff.label, until: t + eff.hours * 60, blocksTravel: eff.blocks_travel, source: ev.id });
        addLog(state, { kind: 'condition', text: `${region(world, id).name}: ${eff.label}`, regions: [id], scope: ev.scope });
      }
    }
  }
}

const STAT_LABELS = { energy: '기력', hunger: '배고픔', coin: '돈' } as const;
function describeStat(eff: { energy?: number; hunger?: number; coin?: number }) {
  return (['energy', 'hunger', 'coin'] as const)
    .filter((k) => eff[k])
    .map((k) => `${STAT_LABELS[k]} ${eff[k]! > 0 ? '+' : ''}${eff[k]}`)
    .join(', ');
}

// --- regions -----------------------------------------------------------------------------

// When a land destroyed at `at` comes back: the midnight DESTROYED_DAYS days on.
export function ruinsUntil(at: number) {
  return untapTime(at) + (DESTROYED_DAYS - 1) * 1440;
}

function regionLayer(state: State, world: World, t: number) {
  for (const [id, rs] of Object.entries(state.regions)) {
    const r = world.regions.find((x) => x.id === id);
    // A destroyed land comes back (bonds with it held all along give mana again).
    if (rs.destroyed && (rs.destroyed.until ?? ruinsUntil(rs.destroyed.at)) <= t) {
      delete rs.destroyed;
      if (r) addLog(state, { kind: 'condition', text: `${r.name}: 부서졌던 땅이 되살아났다. 다시 유대를 맺고 마나를 얻을 수 있다.`, regions: [id], scope: 'world' });
    }
    for (const c of rs.conditions.filter((c) => c.until <= t)) {
      if (r) addLog(state, { kind: 'condition', text: c.tapped ? `${r.name}: 다시 쓸 수 있게 되었다 (${c.label} 풀림).` : `${r.name}: ${josa(c.label, '이', '가')} 걷혔다.`, regions: [id] });
    }
    rs.conditions = rs.conditions.filter((c) => c.until > t);
  }
}

// Why `a` can't go to `to` now, or null.
export function travelBlocked(state: State, world: World, a: Actor, to: string): string | null {
  if (to === a.region) return '이미 그곳에 있다.';
  const dest = world.regions.find((r) => r.id === to);
  if (!dest) return '알 수 없는 곳이다.';
  if (a.abilities.includes('aquatic')) {
    if (!TERRAINS[dest.terrain].sea) return `물에 사는 이라 뭍(${dest.name})에 오를 수 없다.`;
  } else if (TERRAINS[dest.terrain].sea) return `${josa(dest.name, '은', '는')} 바다다. 배도 항로도 아직 없다.`;
  const from = region(world, a.region);
  for (const r of [from, dest]) {
    const need = TERRAINS[r.terrain].requires;
    if (need && !a.abilities.includes(need) && !r.climbHours)
      return `${r.name}(${TERRAINS[r.terrain].label})에 오가려면 ${josa(ABILITY_LABELS[need], '이', '가')} 필요하다.`;
  }
  for (const r of [from, dest]) {
    const c = state.regions[r.id]?.conditions.find((c) => c.blocksTravel);
    if (c) return `${r.name}: ${c.label}`;
  }
  return null;
}

export function startTravel(state: State, world: World, a: Actor, to: string, t: number) {
  const from = region(world, a.region);
  const dest = region(world, to);
  // One of the sea on land crawls toward the water (sim/stranded.ts).
  const crawl = stranded(world, a);
  const hours = travelHours(from, dest, a.abilities) * (crawl ? CRAWL_FACTOR : 1);
  a.travel = { to, arrive: t + hours * 60 };
  a.task = { kind: 'travel', activity: `${toward(dest.name)} 이동`, emoji: '🧭', until: a.travel.arrive };
  addLog(state, {
    kind: 'move',
    text: `${josa(shortName(a.name), '이', '가')} ${josa(from.name, '을', '를')} 떠나 ${toward(dest.name)} ${crawl ? '기어 ' : ''}향했다 (${hours}시간 거리).`,
    regions: [from.id],
    actors: [a.id],
  });
}

// --- characters --------------------------------------------------------------------------

function actorHour(state: State, world: World, a: Actor, t: number) {
  const name = shortName(a.name);
  if (a.boundUntil !== undefined) {
    if (t < a.boundUntil) {
      applyEffect(a.stats, KIND_EFFECTS.leisure, 60, needsOf(a));
      return;
    }
    delete a.boundUntil;
    // One tapped by their own power just untaps; others were held and are let go.
    if (!hasPowers(npcDef(state, world, a.id))) addLog(state, { kind: 'status', text: `${josa(name, '이', '가')} 풀려났다.`, regions: [a.region], actors: [a.id] });
  }
  if (a.travel) return travelHour(state, world, a, t);

  if (a.forced && a.forced.until !== undefined && a.forced.until <= t) delete a.forced;
  if (!a.forced && needsOf(a).includes('energy') && a.stats.energy <= 0) {
    a.forced = { kind: 'sleep', activity: '지쳐 쓰러짐', emoji: '💤', until: t + COLLAPSE_HOURS * 60 };
    if (a.kind === 'player') a.task = undefined;
    addLog(state, { kind: 'status', text: `${josa(name, '이', '가')} 지쳐 쓰러졌다.`, regions: [a.region], actors: [a.id] });
  }

  // The player seized (Roil Elemental) is dragged wherever what holds them goes.
  const holder = a.kind === 'player' && a.seized ? masterOf(state, a) : undefined;
  const dragged = holder && (holder.travel?.to ?? holder.region);
  if (dragged && dragged !== a.region && !travelBlocked(state, world, a, dragged)) startTravel(state, world, a, dragged, t);
  const task = a.forced ?? (a.kind === 'npc' ? npcTask(state, world, a, t) : a.task);
  if (a.travel) return travelHour(state, world, a, t);
  if (!task) {
    applyEffect(a.stats, KIND_EFFECTS.leisure, 60, needsOf(a));
    return;
  }
  const needs = needsOf(a);
  const effect =
    task.kind === 'explore' ? EXPLORE_EFFECT
    : task.kind === 'fight' ? FIGHT_EFFECT
    : KIND_EFFECTS[task.kind === 'travel' ? 'leisure' : task.kind];
  applyEffect(a.stats, effect, 60, needs);
  if (needs.includes('hunger') && a.stats.hunger >= STARVING) applyEffect(a.stats, { energy: STARVING_ENERGY }, 60, needs);
  // A beast feeding hunts the land out: it will have to move on.
  if (task.kind === 'eat' && a.kind === 'npc' && npcDef(state, world, a.id)?.beast) {
    const rs = (state.regions[a.region] ??= { conditions: [] });
    if (!rs.conditions.some((c) => c.label === DEPLETED_LABEL)) {
      rs.conditions.push({ label: DEPLETED_LABEL, until: t + DEPLETED_HOURS * 60, blocksTravel: false, source: a.id });
      addLog(state, { kind: 'condition', text: `${region(world, a.region).name}: ${DEPLETED_LABEL} (${shortName(a.name)}의 사냥)`, regions: [a.region] });
    }
  }
}

// A token who serves someone goes where their master goes, sleeps when they sleep, and
// otherwise keeps at their side.
function followTask(state: State, world: World, a: Actor, m: Actor, t: number): Task | undefined {
  const where = m.travel?.to ?? m.region;
  if (where !== a.region && !travelBlocked(state, world, a, where)) {
    startTravel(state, world, a, where, t);
    return a.task;
  }
  const master = shortName(m.name);
  const task: Task =
    (m.forced ?? m.task)?.kind === 'sleep'
      ? { kind: 'sleep', activity: `${master} 곁에서 잠`, emoji: '💤' }
      : { kind: 'leisure', activity: `${master} 곁을 따름`, emoji: '🐾' };
  if (a.task?.activity !== task.activity) addLog(state, { kind: 'activity', text: `${shortName(a.name)}: ${task.emoji} ${task.activity}`, regions: [a.region], actors: [a.id] });
  a.task = task;
  return task;
}

// The NPC's schedule block for this hour. Starts travel when the block is elsewhere.
function npcTask(state: State, world: World, a: Actor, t: number): Task | undefined {
  const lead = followsMaster(state, a);
  if (lead) return followTask(state, world, a, lead, t);
  const block = a.schedule && currentBlock(a.schedule.blocks, minuteOfDay(t));
  if (!block) return a.task;
  // A retainer lives its day at its master's side.
  const m = masterOf(state, a);
  // One they seek out (to talk) or go after (to attack): wherever that one is now.
  const sought = (block.kind === 'social' || block.kind === 'attack') && block.who ? state.actors[block.who] : undefined;
  const where = m ? (m.travel?.to ?? m.region) : sought && !sought.dead && !outOfTime(state, sought, t) ? (sought.travel?.to ?? sought.region) : block.regionId;
  if (where !== a.region && !travelBlocked(state, world, a, where)) {
    startTravel(state, world, a, where, t);
    return a.task;
  }
  // Can't get there (or already there): do it here. Nothing can be worked on a destroyed or
  // tapped land. Bonding takes BOND_HOURS, taming CLAIM_HOURS and keeping a day EON_HOURS; each
  // carries on until done (step).
  const item = block.kind === 'claim' ? itemsAt(world, a.region).find((x) => !claimBlocked(state, world, a, x.id, t)) : undefined;
  // A land's power (Magosi's days, Oran-Rief's growth): the land they hold that has it.
  const power = block.kind === 'store_day' || block.kind === 'spend_day' || block.kind === 'grow';
  const land = block.kind === 'grow' ? growLand(world, a) : power ? eonLand(world, a) : undefined;
  // A fetch: the land sought, and a fetch land they hold that can reach it.
  const fetchFrom = block.kind === 'fetch' ? fetchSource(state, world, a, block.land) : undefined;
  // A spell to learn here, or to cast on someone here.
  const spell = block.kind === 'learn' || block.kind === 'cast' ? spellDef(world, block.spell ?? '') : undefined;
  const cannot =
    block.kind === 'bond' ? bondBlocked(state, world, a, t)
    : fetchFrom && 'why' in fetchFrom ? fetchFrom.why
    : (block.kind === 'learn' || block.kind === 'cast') && !spell ? '그런 주문은 없다.'
    : block.kind === 'learn' ? learnBlocked(world, a, spell!.id)
    : block.kind === 'cast' ? npcCastBlocked(state, world, a, spell!.id, t)
    : block.kind === 'court' ? courtBlocked(state, world, a, block.who)
    : block.kind === 'hire' ? hireBlocked(state, world, a, block.who)
    : block.kind === 'attack' ? attackBlocked(state, a, block.who, t)
    : block.kind === 'claim' && !item ? (itemsAt(world, a.region).map((x) => claimBlocked(state, world, a, x.id, t))[0] ?? '길들일 것이 없다.')
    : power && !land ? '그런 힘을 가진 땅이 없다.'
    : block.kind === 'store_day' ? storeBlocked(state, world, a, land!.id, t)
    : block.kind === 'spend_day' ? spendBlocked(state, world, a, land!.id, t)
    : block.kind === 'grow' ? growBlocked(state, world, a, land!.id, t)
    : null;
  const timed = ['bond', 'claim', 'store_day', 'spend_day', 'grow', 'fetch', 'learn', 'cast', 'court', 'hire'];
  if (!cannot && timed.includes(block.kind) && a.task?.kind === block.kind) return a.task;
  const task: Task =
    block.kind === 'work' && landUnusable(state, a.region)
      ? { kind: 'leisure', activity: `${block.activity} (${landUnusable(state, a.region)}, 손을 놓음)`, emoji: '🥀' }
      : cannot
        ? { kind: 'leisure', activity: `${block.activity} (${cannot.replace(/\.$/, '')})`, emoji: block.emoji }
        : block.kind === 'bond'
          ? { kind: 'bond', activity: block.activity, emoji: block.emoji, until: t + BOND_HOURS * 60 }
          : spell
            ? { kind: block.kind, activity: block.activity, emoji: block.emoji, until: t + (block.kind === 'learn' ? spell.learnHours : 1) * 60, spell: spell.id }
          : block.kind === 'court' || block.kind === 'hire'
            ? { kind: block.kind, activity: block.activity, emoji: block.emoji, until: t + (block.kind === 'court' ? COURT_HOURS : HIRE_HOURS) * 60, who: block.who }
          : block.kind === 'attack' || (block.kind === 'social' && block.who)
            ? { kind: block.kind, activity: block.activity, emoji: block.emoji, who: block.who }
          : fetchFrom && 'from' in fetchFrom
            ? { kind: 'fetch', activity: block.activity, emoji: block.emoji, until: t + FETCH_HOURS * 60, from: fetchFrom.from.id, land: block.land }
          : item
            ? { kind: 'claim', activity: block.activity, emoji: block.emoji, until: t + CLAIM_HOURS * 60, item: item.id }
            : land
              ? { kind: block.kind, activity: block.activity, emoji: block.emoji, until: t + EON_HOURS * 60, land: land.id }
              : { kind: block.kind, activity: block.activity, emoji: block.emoji };
  if (a.task?.activity !== task.activity || a.task?.kind !== task.kind) {
    addLog(state, {
      kind: 'activity',
      text: `${shortName(a.name)}: ${task.emoji} ${task.activity}`,
      regions: [a.region],
      actors: [a.id],
    });
  }
  a.task = task;
  // Going after someone, and here: they fall on them, and fight from the next hour on.
  const foe = task.kind === 'attack' && task.who ? state.actors[task.who] : undefined;
  if (foe && !foesOf(a, t).includes(foe.id)) {
    addFoe(a, foe.id, t);
    addLog(state, {
      kind: 'combat',
      text: `${josa(shortName(a.name), '이', '가')} ${shortName(foe.name)}에게 덤벼들었다.`,
      regions: [a.region],
      actors: [a.id, foe.id],
    });
  }
  return task;
}

function travelHour(state: State, world: World, a: Actor, t: number) {
  applyEffect(a.stats, TRAVEL_EFFECT, 60, needsOf(a));
  if (!a.travel || t + STEP_MINUTES < a.travel.arrive) return;
  a.region = a.travel.to;
  a.arrivedAt = t + STEP_MINUTES;
  delete a.travel;
  a.task = undefined;
  addLog(state, {
    kind: 'arrive',
    text: `${josa(shortName(a.name), '이', '가')} ${region(world, a.region).name}에 도착했다.`,
    regions: [a.region],
    actors: [a.id],
  });
}

// NPCs meet once a day: one seeking another out (a social block's `who`) meets them where
// they stand, whatever they are doing, as the player talks to anyone there; and those both
// eating or socialising in the same region meet by chance. Sought meetings come first.
function meetings(state: State, world: World) {
  const free = (a: Actor) => a.kind === 'npc' && !a.dead && !a.travel && a.boundUntil === undefined && !outOfTime(state, a);
  // The player, sought out: they are met as they stand (they will be spoken to first, sim/run.ts).
  const findable = (b: Actor) => (b.kind === 'player' ? !b.dead && !b.travel && !outOfTime(state, b) : free(b));
  const pairs: { x: Actor; y: Actor; seeker?: Actor }[] = [];
  for (const a of alive(state)) {
    const b = a.task?.kind === 'social' && a.task.who ? state.actors[a.task.who] : undefined;
    if (b && free(a) && findable(b) && a.region === b.region) pairs.push({ x: a, y: b, seeker: a });
  }
  const open = alive(state).filter((a) => free(a) && (a.task?.kind === 'social' || a.task?.kind === 'eat'));
  for (let i = 0; i < open.length; i++) for (let j = i + 1; j < open.length; j++) if (open[i].region === open[j].region) pairs.push({ x: open[i], y: open[j] });
  for (const { x: p, y: q, seeker } of pairs) {
    const [x, y] = [p, q].sort((a, b) => a.id.localeCompare(b.id));
    const key = `${x.id}|${y.id}`;
    if (state.met.pairs.includes(key)) continue;
    state.met.pairs.push(key);
    const other = seeker && (seeker === x ? y : x);
    addLog(state, {
      kind: 'meet',
      text: seeker
        ? `${josa(shortName(seeker.name), '이', '가')} ${region(world, x.region).name}에서 ${josa(shortName(other!.name), '을', '를')} 찾아가 마주했다.`
        : `${josa(shortName(x.name), '과', '와')} ${josa(shortName(y.name), '이', '가')} ${region(world, x.region).name}에서 마주쳤다.`,
      regions: [x.region],
      actors: [x.id, y.id],
    });
  }
}
