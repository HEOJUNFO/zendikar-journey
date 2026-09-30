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
  DEPLETED_LABEL,
  KIND_EFFECTS,
  STARVING,
  STARVING_ENERGY,
  TRAVEL_EFFECT,
} from './rules.ts';
import { gainedLifeToday, loseLife } from './life.ts';
import { addLog, alive, landUnusable, needsOf, npcDef, outOfTime, present, ptOf, random } from './state.ts';
import { addFoe, dealDamage, hostileNpcs } from './combat.ts';
import { bondBlocked, bondLand, fetchLand, growBlocked, growEntered, growLand, spawnWild, upkeepRevive, useAbility } from './abilities.ts';
import { CLAIM_HOURS, claimBlocked, claimItem, itemsAt } from './items.ts';
import { EON_HOURS, eonLand, holdStill, spendBlocked, spendDay, storeBlocked, storeDay, timeNews } from './eons.ts';
import { learnSpell } from './spells.ts';
import { masterOf } from './retainers.ts';
import { payMana } from './mana.ts';
import type { Actor, GmPlan, State, Task } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import { currentBlock } from './types.ts';
import { ABILITY_LABELS, affectedRegions, hasPowers, region, TERRAINS, travelHours } from './world.ts';
import type { EventDef, World } from './world.ts';

export function step(state: State, world: World) {
  const t = state.minutes;
  startDay(state, world, t);
  gmLayer(state, world, t);
  // Factions: none yet (world/entities/factions is empty).
  regionLayer(state, world, t);
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
    const timed = ['bond', 'claim', 'store_day', 'spend_day', 'grow'];
    if (done && (a.kind === 'player' || timed.includes(a.task!.kind))) {
      const at = t + STEP_MINUTES;
      if (a.task!.kind === 'bond') bondLand(state, world, a, at, a.region, a.task!.target);
      if (a.task!.kind === 'learn' && a.task!.spell) learnSpell(state, world, a, a.task!.spell, at);
      if (a.task!.kind === 'claim' && a.task!.item) claimItem(state, world, a, a.task!.item, at);
      if (a.task!.kind === 'fetch' && a.task!.from && a.task!.land) fetchLand(state, world, a, a.task!.from, a.task!.land, at);
      if (a.task!.kind === 'store_day' && a.task!.land) storeDay(state, world, a, a.task!.land, at);
      if (a.task!.kind === 'spend_day' && a.task!.land) spendDay(state, world, a, a.task!.land, at);
      if (a.task!.kind === 'grow' && a.task!.land) growEntered(state, world, a, a.task!.land, at);
      a.task = undefined;
    }
  }
  enterEvents(state, world, t + STEP_MINUTES);
  meetings(state, world);
  state.minutes = t + STEP_MINUTES;
}

// --- day start ---------------------------------------------------------------------------

function startDay(state: State, world: World, t: number) {
  const day = gameDay(t);
  // The upkeep: at a turn's start. Who is out of time today hears so first.
  if (minuteOfDay(t) === 0) {
    timeNews(state, world, t);
    upkeepRevive(state, world, t);
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
    if (ev.trigger !== 'enter' || onCooldown(state, ev, at)) continue;
    if (state.pending.some((p) => p.eventId === ev.id)) continue;
    const by = present(state, ev.region).filter((a) => a.arrivedAt === at && (!ev.gained_life || gainedLifeToday(a, at)));
    if (by.length) trigger(state, world, ev, at, { by: by.map((a) => a.id), lands: [] });
  }
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
    } else if (eff.type === 'lose_life') {
      for (const id of cause.by ?? []) {
        const a = state.actors[id];
        if (a && regions.includes(a.region) && !a.travel) loseLife(state, a, eff.amount, ev.name);
      }
    } else if (eff.type === 'destroy_lands') {
      for (const id of (cause.lands ?? []).slice(0, eff.count)) {
        state.regions[id] ??= { conditions: [] };
        if (state.regions[id].destroyed) continue;
        state.regions[id].destroyed = { at: t, source: ev.id };
        addLog(state, { kind: 'condition', text: `${region(world, id).name}: 땅이 부서졌다. 이제 이곳에서는 아무것도 얻을 수 없다.`, regions: [id], scope: ev.scope });
        permanentDestroyed(state, world, id, cause.by ?? [], t);
      }
    } else if (eff.type === 'create') {
      const born = spawnWild(state, world, eff.creature, eff.pt, eff.count, ev.region, eff.colors);
      const kind = world.lore.find((l) => l.id === eff.creature)?.name ?? eff.creature;
      addLog(state, { kind: 'event', text: `${kind} ${eff.count}마리가 쏟아져 나왔다 (${eff.pt.join('/')}).`, regions: [ev.region], actors: born.map((b) => b.id) });
      // They turn on whoever set it off, for the rest of the day.
      for (const b of born) for (const id of cause.by ?? []) addFoe(b, id, t);
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

function regionLayer(state: State, world: World, t: number) {
  for (const [id, rs] of Object.entries(state.regions)) {
    const r = world.regions.find((x) => x.id === id);
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
  const hours = travelHours(from, dest, a.abilities);
  a.travel = { to, arrive: t + hours * 60 };
  a.task = { kind: 'travel', activity: `${toward(dest.name)} 이동`, emoji: '🧭', until: a.travel.arrive };
  addLog(state, {
    kind: 'move',
    text: `${josa(shortName(a.name), '이', '가')} ${josa(from.name, '을', '를')} 떠나 ${toward(dest.name)} 향했다 (${hours}시간 거리).`,
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
    : KIND_EFFECTS[task.kind === 'travel' || task.kind === 'learn' || task.kind === 'cast' || task.kind === 'fetch' ? 'leisure' : task.kind];
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

// The NPC's schedule block for this hour. Starts travel when the block is elsewhere.
function npcTask(state: State, world: World, a: Actor, t: number): Task | undefined {
  const block = a.schedule && currentBlock(a.schedule.blocks, minuteOfDay(t));
  if (!block) return a.task;
  // A retainer lives its day at its master's side.
  const m = masterOf(state, a);
  const where = m ? (m.travel?.to ?? m.region) : block.regionId;
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
  const cannot =
    block.kind === 'bond' ? bondBlocked(state, world, a, t)
    : block.kind === 'claim' && !item ? (itemsAt(world, a.region).map((x) => claimBlocked(state, world, a, x.id, t))[0] ?? '길들일 것이 없다.')
    : power && !land ? '그런 힘을 가진 땅이 없다.'
    : block.kind === 'store_day' ? storeBlocked(state, world, a, land!.id, t)
    : block.kind === 'spend_day' ? spendBlocked(state, world, a, land!.id, t)
    : block.kind === 'grow' ? growBlocked(state, world, a, land!.id, t)
    : null;
  const timed = ['bond', 'claim', 'store_day', 'spend_day', 'grow'];
  if (!cannot && timed.includes(block.kind) && a.task?.kind === block.kind) return a.task;
  const task: Task =
    block.kind === 'work' && landUnusable(state, a.region)
      ? { kind: 'leisure', activity: `${block.activity} (${landUnusable(state, a.region)}, 손을 놓음)`, emoji: '🥀' }
      : cannot
        ? { kind: 'leisure', activity: `${block.activity} (${cannot.replace(/\.$/, '')})`, emoji: block.emoji }
        : block.kind === 'bond'
          ? { kind: 'bond', activity: block.activity, emoji: block.emoji, until: t + BOND_HOURS * 60 }
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

// NPCs who are both eating or socialising in the same region meet once a day.
function meetings(state: State, world: World) {
  const open = alive(state).filter(
    (a) =>
      a.kind === 'npc' && !a.travel && a.boundUntil === undefined && !outOfTime(state, a) && (a.task?.kind === 'social' || a.task?.kind === 'eat'),
  );
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      const [x, y] = [open[i], open[j]].sort((p, q) => p.id.localeCompare(q.id));
      const key = `${x.id}|${y.id}`;
      if (x.region !== y.region || state.met.pairs.includes(key)) continue;
      state.met.pairs.push(key);
      addLog(state, {
        kind: 'meet',
        text: `${josa(shortName(x.name), '과', '와')} ${josa(shortName(y.name), '이', '가')} ${region(world, x.region).name}에서 마주쳤다.`,
        regions: [x.region],
        actors: [x.id, y.id],
      });
    }
  }
}
