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
  HUNT_HUNGER,
  KIND_EFFECTS,
  STARVING,
  STARVING_ENERGY,
  TRAVEL_EFFECT,
} from './rules.ts';
import { gainedLifeToday, loseLife } from './life.ts';
import { forget, forgetAbout } from './relations.ts';
import { markSealed } from './seal.ts';
import { handSize } from './knowledge.ts';
import { recall, RECALL_HOURS, recallBlocked } from './loremaster.ts';
import { addLog, alive, here, landUnusable, needsOf, npcDef, outOfTime, present, ptOf, random, together } from './state.ts';
import { addFoe, attackBlocked, dealDamage, foesOf, hostileNpcs } from './combat.ts';
import { bondBlocked, bondLand, expireGranted, upkeepFleeting, onEnter, FETCH_HOURS, fetchLand, fetchSource, growBlocked, growEntered, growLand, spawnWild, summonLibrary, TOP, upkeepRevive, useAbility } from './abilities.ts';
import { CLAIM_HOURS, claimBlocked, claimItem, itemsAt, itemWhere } from './items.ts';
import { EQUIP_HOURS, equipBlocked, equipItem, equipmentOf, syncEquipment } from './equipment.ts';
import { EON_HOURS, eonLand, holdStill, spendBlocked, spendDay, storeBlocked, storeDay, timeNews } from './eons.ts';
import { upkeepWins } from './win.ts';
import { CRAWL_FACTOR, dryOut, stranded } from './stranded.ts';
import { wanderHour, withPositions } from './wander.ts';
import { anthemHour, upkeepSacrifice } from './monument.ts';
import { upkeepQuell } from './quell.ts';
import { upkeepTide } from './tide.ts';
import { upkeepBlaze } from './blaze.ts';
import { upkeepOracle } from './oracle.ts';
import { HIRE_HOURS, hireBlocked, hireMerc } from './allies.ts';
import { bounceCandidates, joinedToday } from './bounce.ts';
import { eventTile, fixedTile, homeTile, nearestTile, sameTile, tileCenter, tileLabel, tilesOf, tileSteps } from './tiles.ts';
import type { Tile } from './tiles.ts';
import { COURT_HOURS, courtBlocked, followsMaster, masterOf, readyCourt, refusedToday, upkeepPossessions } from './retainers.ts';
import { learnBlocked, learnSpell, npcCastBlocked, readyCast, spellDef } from './spells.ts';
import { payMana } from './mana.ts';
import type { Actor, GmPlan, State, Task } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import { currentBlock } from './types.ts';
import { ABILITY_LABELS, affectedRegions, descendantsOf, hasPowers, region, TERRAINS, travelHours, within } from './world.ts';
import type { EventDef, Region, World } from './world.ts';

export function step(state: State, placed: World) {
  const t = state.minutes;
  // Wandering places (Goma Fada) walk first; the hour then measures the map as it is now.
  wanderHour(state, placed, t);
  const world = withPositions(state, placed);
  startDay(state, world, t);
  markSealed(state, world, t);
  gmLayer(state, world, t);
  // Factions: none yet (world/entities/factions is empty).
  regionLayer(state, world, t);
  syncEquipment(state, world);
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
    const timed = ['bond', 'claim', 'equip', 'store_day', 'spend_day', 'grow', 'fetch', 'learn', 'cast', 'court', 'hire', 'recall'];
    if (done && (a.kind === 'player' || timed.includes(a.task!.kind))) {
      const at = t + STEP_MINUTES;
      if (a.task!.kind === 'bond') bondLand(state, world, a, at, a.region, a.task!.target);
      if (a.task!.kind === 'learn' && a.task!.spell) learnSpell(state, world, a, a.task!.spell, at);
      if (a.task!.kind === 'claim' && a.task!.item) claimItem(state, world, a, a.task!.item, at);
      if (a.task!.kind === 'equip' && a.task!.item) equipItem(state, world, a, a.task!.item, a.task!.who, at);
      if (a.task!.kind === 'fetch' && a.task!.from && a.task!.land) fetchLand(state, world, a, a.task!.from, a.task!.land, at, a.task!.target);
      if (a.task!.kind === 'store_day' && a.task!.land) storeDay(state, world, a, a.task!.land, at);
      if (a.task!.kind === 'spend_day' && a.task!.land) spendDay(state, world, a, a.task!.land, at);
      if (a.task!.kind === 'grow' && a.task!.land) growEntered(state, world, a, a.task!.land, at);
      if (a.task!.kind === 'recall') recall(state, world, a, at);
      // An NPC's spell: whom it falls on is asked of the LLM after the hour (the player's was cast as they began).
      if (a.task!.kind === 'cast' && a.kind === 'npc' && a.task!.spell) readyCast(state, world, a, a.task!.spell, at);
      // A court: the beast decides after the hour whether to follow them.
      if (a.task!.kind === 'court' && a.task!.who) readyCourt(state, world, a, a.task!.who, at);
      if (a.task!.kind === 'hire' && a.task!.who) hireMerc(state, world, a, a.task!.who, at);
      a.task = undefined;
    }
  }
  enterEvents(state, world, t + STEP_MINUTES);
  for (const a of alive(state)) if (a.arrivedAt === t + STEP_MINUTES) onEnter(state, world, a, t + STEP_MINUTES);
  attackEvents(state, world, t);
  hurtEvents(state, world, t);
  meetings(state, world);
  state.minutes = t + STEP_MINUTES;
}

// --- day start ---------------------------------------------------------------------------

function startDay(state: State, world: World, t: number) {
  const day = gameDay(t);
  // The upkeep: at a turn's start. Who is out of time today hears so first.
  if (minuteOfDay(t) === 0) {
    timeNews(state, world, t);
    upkeepFleeting(state, t);
    expireGranted(state, t);
    upkeepRevive(state, world, t);
    upkeepWins(state, world, t);
    upkeepSacrifice(state, world, t);
    upkeepTide(state, world, t);
    upkeepBlaze(state, world, t);
    upkeepOracle(state, world, t);
    upkeepQuell(state, world, t);
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

// Enter: someone stepped onto the tile of the land where the trap lies at `at` (the end of this hour). Checked right after
// the characters move, so a traveller is met at the gate, not an hour later.
function enterEvents(state: State, world: World, at: number) {
  for (const ev of world.events) {
    // Those here who drew enough spells today, each once a day (this spring included).
    if (ev.trigger === 'drew') {
      if (onCooldown(state, ev, at)) continue;
      const here = new Set([ev.region, ...descendantsOf(world, ev.region).map((r) => r.id)]);
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
    // A trap lies on one tile of its land: those who stepped onto it this hour.
    const by = present(state, ev.region, eventTile(world, ev)).filter((a) => a.steppedAt === at && (!ev.gained_life || gainedLifeToday(a, at)) && (!ev.refused || refusedToday(a, at)) && (!ev.searched || a.searched === gameDay(at)) && (!ev.claimed || a.claimed === gameDay(at)) && (!ev.joined || joinedToday(state, a, at) >= ev.joined));
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

// `a` casts a spell (not for free): their count for today rises, and a `cast` event of their land
// (or the land their area lies in) whose count they reach goes off, once a day for them. Whether
// one that counters it went off (sim/spells.ts `castSpell` then voids the spell).
export function castEvents(state: State, world: World, a: Actor, t: number) {
  const day = gameDay(t);
  if (a.cast?.day !== day) a.cast = { day, count: 0 };
  a.cast.count++;
  let countered = false;
  for (const ev of world.events) {
    if (ev.trigger !== 'cast' || onCooldown(state, ev, t) || a.cast.count < ev.spells! || a.cast.sprung?.includes(ev.id)) continue;
    if (!within(world, a.region, ev.region)) continue;
    a.cast.sprung = [...(a.cast.sprung ?? []), ev.id];
    trigger(state, world, ev, t, { by: [a.id], lands: [] });
    if (ev.effects.some((e) => e.type === 'counter_spell')) countered = true;
  }
  return countered;
}

// Those in a `hurt` event's land (or its areas) dealt combat damage by enough beings today set it
// off, in the hour it comes to pass (Inferno Trap), each once a day.
function hurtEvents(state: State, world: World, t: number) {
  for (const ev of world.events) {
    if (ev.trigger !== 'hurt' || onCooldown(state, ev, t)) continue;
    const here = new Set([ev.region, ...descendantsOf(world, ev.region).map((r) => r.id)]);
    const day = gameDay(t);
    const by = alive(state).filter(
      (a) => here.has(a.region) && !a.travel && !outOfTime(state, a, t) && a.hurtBy?.day === day && a.hurtBy.ids.length >= ev.creatures! && !a.hurtBy.sprung?.includes(ev.id),
    );
    for (const a of by) a.hurtBy!.sprung = [...(a.hurtBy!.sprung ?? []), ev.id];
    if (by.length) trigger(state, world, ev, t, { by: by.map((a) => a.id), lands: [] });
  }
}

// Land destruction: the land is destroyed for everyone for DESTROYED_DAYS (bonds with it are
// kept and give mana again when it comes back). `by`: whose doing (its `destroyed` events
// answer, e.g. the Cobra Trap).
export function destroyLand(state: State, world: World, id: string, by: string[], t: number, source: string, scope: 'region' | 'world' = 'region') {
  state.regions[id] ??= { conditions: [] };
  if (state.regions[id].destroyed) return false;
  state.regions[id].destroyed = { at: t, source, until: ruinsUntil(t) };
  // Its counters go with it: a burning land stops burning.
  delete state.regions[id].blaze;
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
        // Their hand: the spells they hold (sim/knowledge.ts).
        const n = handSize(a);
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
    } else if (eff.type === 'pump_attackers') {
      // Each who struck as an attacker: until midnight.
      for (const id of cause.by ?? []) {
        const a = state.actors[id];
        if (!a || a.dead) continue;
        (a.pumps ??= []).push({ pt: eff.pt, until: untapTime(t) });
        addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '은', '는')} 힘이 빠졌다 (${eff.pt.map((n) => (n >= 0 ? `+${n}` : `${n}`)).join('/')}, ${ptOf(a).join('/')}).`, regions: [a.region], actors: [a.id], t });
      }
    } else if (eff.type === 'burn') {
      // Which of those who hurt them it falls on is the trap's, asked after the hour.
      if (cause.by?.length) (state.burns ??= []).push({ event: ev.id, amount: eff.amount, ...(eff.color ? { color: eff.color } : {}), by: cause.by, region: ev.region, t });
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
    } else if (eff.type === 'bounce') {
      // Whom it flings is the trap's, asked after the hour.
      const tile = eventTile(world, ev);
      if (bounceCandidates(state, world, ev.region, tile, t).length) (state.bounces ??= []).push({ event: ev.id, count: eff.count, by: cause.by ?? [], region: ev.region, tile, t });
    } else if (eff.type === 'summon') {
      // Which of the creatures looked at is drawn here (if any) is the trap's, asked after the hour.
      const creatures = summonLibrary(state, world, ev.region, cause.by ?? []).slice(0, eff.look);
      if (creatures.length) (state.summons ??= []).push({ event: ev.id, creatures, by: cause.by ?? [], region: ev.region, t });
    } else if (eff.type === 'counter_spell') {
      // The spell itself is voided where it is cast (sim/spells.ts `castSpell`).
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

// Sets out for `to` (a land), to stand on `tile` of it: the tile of it nearest where they stand
// when none is asked. Within one region (its open ground and its areas) they walk tile by tile,
// an hour a step (sim/tiles.ts); between regions it is the road between them (`travelHours`).
// `to` may be their own land: a walk to another tile of it.
export function startTravel(state: State, world: World, a: Actor, to: string, t: number, tile?: Tile) {
  const from = region(world, a.region);
  const dest = region(world, to);
  const at = tile ?? nearestTile(world, to, a.tile && tileCenter(a.tile));
  // One of the sea on land crawls toward the water (sim/stranded.ts).
  const crawl = stranded(world, a);
  const hours = moveHours(world, a, to, at) * (crawl ? CRAWL_FACTOR : 1);
  a.travel = { to, arrive: t + hours * 60, ...(at ? { tile: at } : {}) };
  const where = to === a.region && at ? tileLabel(world, to, at) : dest.name;
  a.task = { kind: 'travel', activity: `${toward(where)} 이동`, emoji: '🧭', until: a.travel.arrive };
  addLog(state, {
    kind: 'move',
    text:
      to === a.region
        ? `${josa(shortName(a.name), '이', '가')} ${toward(where)} 걸어갔다 (${hours}시간 거리).`
        : `${josa(shortName(a.name), '이', '가')} ${josa(from.name, '을', '를')} 떠나 ${toward(dest.name)} ${crawl ? '기어 ' : ''}향했다 (${hours}시간 거리).`,
    regions: [from.id],
    actors: [a.id],
  });
}

// Hours from where `a` stands to `tile` of `to`: the tiles between them, an hour a step (at
// least one; a place one land with another, an hour), and the climb into or out of a sky land
// for one who can't fly. Haste halves it. With no tiles to go by: the road between the lands'
// middles (`travelHours`).
export function moveHours(world: World, a: Actor, to: string, tile: Tile | undefined) {
  const from = region(world, a.region);
  const dest = region(world, to);
  if (!a.tile || !tile || from.wanders || dest.wanders) return travelHours(from, dest, a.abilities);
  const climb = (r: Region) => {
    const need = TERRAINS[r.terrain].requires;
    return need && !a.abilities.includes(need) ? (r.climbHours ?? 0) : 0;
  };
  const one = from.oneLandWith === dest.id || dest.oneLandWith === from.id;
  const hours = (one ? 1 : Math.max(1, tileSteps(a.tile, tile))) + (from.id === dest.id ? 0 : climb(from) + climb(dest));
  return a.abilities.includes('haste') ? Math.max(1, Math.ceil(hours / 2)) : hours;
}

// Sets out for where `b` stands (or is bound): their land and tile. Whether they went.
function goTo(state: State, world: World, a: Actor, b: Actor, t: number) {
  const where = b.travel?.to ?? b.region;
  const tile = b.travel ? b.travel.tile : b.tile;
  if (where === a.region && sameTile(tile, a.tile)) return false;
  if (where !== a.region && travelBlocked(state, world, a, where)) return false;
  startTravel(state, world, a, where, t, tile);
  return true;
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
  if (holder) goTo(state, world, a, holder, t);
  const task = a.forced ?? (a.kind === 'npc' ? npcTask(state, world, a, t) : a.task);
  if (a.travel) return travelHour(state, world, a, t);
  if (!task) {
    applyEffect(a.stats, KIND_EFFECTS.leisure, 60, needsOf(a));
    return;
  }
  // Searching the land (exploring), or a hungry beast with nothing to hunt beside it: a step to
  // a tile next to theirs, of the same land.
  const def = a.kind === 'npc' ? npcDef(state, world, a.id) : undefined;
  const hunting = def?.beast && needsOf(a).includes('hunger') && a.stats.hunger >= HUNT_HUNGER && task.kind !== 'sleep' && here(state, a).length <= 1;
  if (task.kind === 'explore' || hunting) drift(state, world, a, t);
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

// A step to a tile next to theirs, of the same land, at random (none: they stay).
function drift(state: State, world: World, a: Actor, t: number) {
  if (!a.tile) return;
  const next = tilesOf(world, a.region).filter((x) => tileSteps(x, a.tile!) === 1);
  if (!next.length) return;
  a.tile = next[Math.floor(random(state) * next.length)];
  a.steppedAt = t + STEP_MINUTES;
}

// A token who serves someone goes where their master goes, sleeps when they sleep, and
// otherwise keeps at their side.
function followTask(state: State, world: World, a: Actor, m: Actor, t: number): Task | undefined {
  if (goTo(state, world, a, m, t)) return a.task;
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
  // One they seek out (to talk, to win over, to hire) or go after (to attack): wherever that
  // one is now, to their very tile.
  const sought = (block.kind === 'social' || block.kind === 'attack' || block.kind === 'court' || block.kind === 'hire') && block.who ? state.actors[block.who] : undefined;
  const target = m ?? (sought && !sought.dead && !outOfTime(state, sought, t) ? sought : undefined);
  if (target) {
    if (goTo(state, world, a, target, t)) return a.task;
  } else if (block.regionId !== a.region && !travelBlocked(state, world, a, block.regionId)) {
    // Home: to their own tile of it.
    const def = npcDef(state, world, a.id);
    startTravel(state, world, a, block.regionId, t, def && 'home' in def && def.home === block.regionId ? homeTile(world, def) : undefined);
    return a.task;
  } else if (block.kind === 'sleep' && block.regionId === a.region && a.region === npcDef(state, world, a.id)?.home) {
    // They sleep at home, on their own tile.
    const def = npcDef(state, world, a.id)!;
    const own = 'home' in def ? homeTile(world, def) : undefined;
    if (own && !sameTile(own, a.tile)) {
      startTravel(state, world, a, a.region, t, own);
      return a.task;
    }
  } else if (block.kind === 'claim') {
    // An item to tame stands on one tile of its land: they walk to it.
    const x = itemsAt(state, world, a.region).find((y) => !state.items?.[y.id]?.owner);
    const at = x && itemWhere(state, world, x)?.tile;
    if (at && !sameTile(at, a.tile)) {
      startTravel(state, world, a, a.region, t, at);
      return a.task;
    }
  }
  // Can't get there (or already there): do it here. Nothing can be worked on a destroyed or
  // tapped land. Bonding takes BOND_HOURS, taming CLAIM_HOURS and keeping a day EON_HOURS; each
  // carries on until done (step).
  const item = block.kind === 'claim' ? itemsAt(state, world, a.region).find((x) => !claimBlocked(state, world, a, x.id, t)) : undefined;
  // Equipment they hold, to put on themselves or the block's `who`.
  const gear = block.kind === 'equip' ? equipmentOf(state, world, a)[0] : undefined;
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
    : block.kind === 'attack' ? attackBlocked(state, world, a, block.who, t)
    : block.kind === 'equip' ? (gear ? equipBlocked(state, world, a, gear.id, block.who ?? a.id, t) : '맬 것이 없다.')
    : block.kind === 'claim' && !item ? (itemsAt(state, world, a.region).map((x) => claimBlocked(state, world, a, x.id, t))[0] ?? '길들일 것이 없다.')
    : power && !land ? '그런 힘을 가진 땅이 없다.'
    : block.kind === 'store_day' ? storeBlocked(state, world, a, land!.id, t)
    : block.kind === 'spend_day' ? spendBlocked(state, world, a, land!.id, t)
    : block.kind === 'grow' ? growBlocked(state, world, a, land!.id, t)
    : block.kind === 'recall' ? recallBlocked(state, world, a, t)
    : null;
  const timed = ['bond', 'claim', 'equip', 'store_day', 'spend_day', 'grow', 'fetch', 'learn', 'cast', 'court', 'hire', 'recall'];
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
          : block.kind === 'recall'
            ? { kind: 'recall', activity: block.activity, emoji: block.emoji, until: t + RECALL_HOURS * 60 }
          : block.kind === 'attack' || (block.kind === 'social' && block.who)
            ? { kind: block.kind, activity: block.activity, emoji: block.emoji, who: block.who }
          : fetchFrom && 'from' in fetchFrom
            ? { kind: 'fetch', activity: block.activity, emoji: block.emoji, until: t + FETCH_HOURS * 60, from: fetchFrom.from.id, land: block.land }
          : fetchFrom && 'top' in fetchFrom
            ? { kind: 'fetch', activity: block.activity, emoji: block.emoji, until: t + FETCH_HOURS * 60, from: TOP, land: block.land }
          : gear
            ? { kind: 'equip', activity: block.activity, emoji: block.emoji, until: t + EQUIP_HOURS * 60, item: gear.id, who: block.who ?? a.id }
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
  const walk = a.travel.to === a.region;
  a.region = a.travel.to;
  a.tile = a.travel.tile ?? nearestTile(world, a.region, a.tile && tileCenter(a.tile));
  a.steppedAt = t + STEP_MINUTES;
  // Arriving in a land (not a walk within it): "when this enters" (sim/abilities.ts onEnter).
  if (!walk) a.arrivedAt = t + STEP_MINUTES;
  delete a.travel;
  a.task = undefined;
  addLog(state, {
    kind: 'arrive',
    text: `${josa(shortName(a.name), '이', '가')} ${walk && a.tile ? tileLabel(world, a.region, a.tile) : region(world, a.region).name}에 ${walk ? '닿았다' : '도착했다'}.`,
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
    if (b && free(a) && findable(b) && together(a, b)) pairs.push({ x: a, y: b, seeker: a });
  }
  const open = alive(state).filter((a) => free(a) && (a.task?.kind === 'social' || a.task?.kind === 'eat'));
  for (let i = 0; i < open.length; i++) for (let j = i + 1; j < open.length; j++) if (together(open[i], open[j])) pairs.push({ x: open[i], y: open[j] });
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
