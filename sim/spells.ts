// Spells (world/entities/spells): learned at a place, cast with mana on someone standing in
// the same place. The player learns and casts them by actions; NPCs by `learn` / `cast`
// blocks of their LLM-planned day (whom a spell falls on, the LLM picks as it is cast), and
// hold some by color (knows_colors) to cast by their powers (Chandra). A sealed color can't
// be cast (sim/seal.ts).
import { huntKnowledge } from './knowledge.ts';
import { formatClock, untapTime } from './clock.ts';
import { addFoe, dealDamage, destroy } from './combat.ts';
import { gainLife, lifeOf, loseLife } from './life.ts';
import { actorColors, addCosts, COLOR_LABELS, formatMana, manaAvailable, manaCapacity, payMana, planPayment } from './mana.ts';
import { spawnWild } from './abilities.ts';
import { castEvents, destroyLand } from './step.ts';
import { owesDiscard } from './discard.ts';
import { crushOwed, demolishOptions, demolishOwed, relicsHere } from './relics.ts';
import { harrowGive, harrowOwed } from './harrow.ts';
import { remember } from './relations.ts';
import { copyable, replicate } from './replicate.ts';
import { holdCast, reactionSpell } from './counter.ts';
import { controlledCreatures, creatureOf, masterOf, retainersOf } from './retainers.ts';
import { addLog, buryCount, npcDef, present, ptOf, targetable, together, untargetableText } from './state.ts';
import type { Actor, State } from './state.ts';
import { sealedBy, sealText } from './seal.ts';
import { josa, shortName } from './text.ts';
import { ABILITY_LABELS, LAND_TYPE_LABELS, landTypes, placeName, region, spellColors } from './world.ts';
import type { Ability, LandType } from './world.ts';
import type { SpellDef, World } from './world.ts';

export function spellDef(world: World, id: string) {
  return world.spells.find((s) => s.id === id);
}

// Spells that can be learned where `a` stands.
export function spellsTaughtAt(world: World, regionId: string) {
  return world.spells.filter((s) => s.learnAt === regionId);
}

export function learnBlocked(world: World, a: Actor, spellId: string): string | null {
  const s = spellDef(world, spellId);
  if (!s) return '그런 주문은 없다.';
  if (a.spells?.includes(s.id)) return `이미 ${josa(s.name, '을', '를')} 안다.`;
  if (a.exiled?.includes(s.id)) return `${josa(s.name, '은', '는')} 추방되어 영영 다시 익힐 수 없다.`;
  if (a.region !== s.learnAt) return `${josa(s.name, '은', '는')} ${placeName(world, region(world, s.learnAt))}에서 배울 수 있다.`;
  return null;
}

export function learnSpell(state: State, world: World, a: Actor, spellId: string, t: number) {
  const s = spellDef(world, spellId);
  if (!s || a.spells?.includes(s.id) || a.exiled?.includes(s.id)) return;
  a.spells = [...(a.spells ?? []), s.id];
  addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} ${josa(s.name, '을', '를')} 익혔다.`, regions: [a.region], actors: [a.id], t });
}

// `a`'s retainers of creature `kind` who could be tapped now (a kicker's "tap an untapped …
// you control").
export function tappable(state: State, world: World, a: Actor, kind: string) {
  return controlledCreatures(state, world, a).filter((x) => x.boundUntil === undefined && creatureOf(state, world, x.id) === kind);
}

// A spell's mana value: all of its cost (a kicker is no part of it).
export function manaValue(s: SpellDef) {
  return s.cost.generic + Object.values(s.cost.colored).reduce((n, k) => n + (k ?? 0), 0);
}

// Until when `a` can't cast `s` again (used: as many hours as its mana value from its casting;
// user decision 2026-10-01), or undefined.
export function usedUntil(a: Actor, s: SpellDef, t: number) {
  const until = a.used?.[s.id];
  return until !== undefined && until > t ? until : undefined;
}
function usedText(s: SpellDef, until: number) {
  return `${josa(s.name, '은', '는')} 방금 써서 ${formatClock(until)}까지 다시 쓸 수 없다.`;
}

export function castBlocked(state: State, world: World, a: Actor, spellId: string, targetId: string, kick: boolean, t: number): string | null {
  const s = spellDef(world, spellId);
  if (!s || !a.spells?.includes(s.id)) return '모르는 주문이다.';
  const used = usedUntil(a, s, t);
  if (used !== undefined) return usedText(s, used);
  if (reactionSpell(s)) return `${josa(s.name, '은', '는')} 곁에서 누군가 권속을 들일 때 그것을 막으려고만 쓴다.`;
  const by = sealedBy(state, a, s, t);
  if (by) return sealText(by, t);
  const target = state.actors[targetId];
  if (!target || target.dead || (target.id === a.id && s.target === 'other_here') || (s.target === 'self' && target.id !== a.id)) return '그런 대상은 없다.';
  if (target.id !== a.id && !present(state, a.region, a.tile).some((x) => x.id === target.id))
    return `${josa(shortName(target.name), '은', '는')} 여기 없다.`;
  if (s.effects.some((e) => e.type === 'destroy_land') && !landToDestroy(state, target))
    return `${josa(shortName(target.name), '은', '는')} 부술 땅을 쥐고 있지 않다.`;
  const need = ownOnly(s);
  if (need && !ownedBy(target, a)) return `${josa(s.name, '은', '는')} 자신이나 자신의 권속에게만 건다.`;
  if (need && castTargets(state, a, s).length < need) return `${josa(s.name, '은', '는')} 대상이 ${need === 2 ? '둘' : need}이 있어야 한다 (곁의 자신과 권속).`;
  const doom = destroyBarred(world, state, s, target);
  if (doom) return doom;
  if (s.effects.some((e) => e.type === 'copy_target') && !copyable(target)) return `${josa(shortName(target.name), '은', '는')} 생물이 아니다 (플레인즈워커). 복제할 수 없다.`;
  if (s.effects.some((e) => e.type === 'destroy_relics') && !relicsHere(state, world, a.region, a.tile).length) return '여기엔 부술 마법물체도 부여마법도 없다.';
  if (s.effects.some((e) => e.type === 'demolish') && !demolishOptions(state, world, a).length) return '여기엔 부술 마법물체도 땅도 없다.';
  if (s.effects.some((e) => e.type === 'harrow') && !harrowGive(world, a).length) return `${josa(s.name, '은', '는')} 땅 하나를 내어 주어야 쓴다 (유대를 맺은 땅이 없다).`;
  if (s.target !== 'self' && !targetable(target, t, spellColors(s))) return untargetableText(target, t, spellColors(s));
  if (!planPayment(manaAvailable(state, world, a, t), s.cost))
    return `마나가 모자라다 (${s.costText}, 지금 ${formatMana(manaAvailable(state, world, a, t))}).`;
  if (kick && !s.kicker) return '추가 비용이 없는 주문이다.';
  if (kick && s.kicker?.tap && !tappable(state, world, a, s.kicker.tap).length) return '추가 비용으로 탭할 것이 없다.';
  if (kick && s.kicker?.mana && !planPayment(manaAvailable(state, world, a, t), addCosts(s.cost, s.kicker.mana)))
    return `킥커까지 치를 마나가 모자라다 (${s.costText} + ${s.kicker.manaText}).`;
  return null;
}

// Whom `a` could cast `s` on where they stand: anyone else there, or themselves too.
export function castTargets(state: State, a: Actor, s: SpellDef, world?: World) {
  if (s.target === 'self') return [a];
  const needsLand = s.effects.some((e) => e.type === 'destroy_land');
  const copies = s.effects.some((e) => e.type === 'copy_target');
  return present(state, a.region, a.tile).filter(
    (x) =>
      (x.id !== a.id || s.target === 'any_here') &&
      targetable(x, state.minutes, spellColors(s)) &&
      (!needsLand || !!landToDestroy(state, x)) &&
      (!copies || copyable(x)) &&
      (!ownOnly(s) || ownedBy(x, a)) &&
      (!world || !destroyBarred(world, state, s, x)),
  );
}

// "Destroy target non<color> creature": why `x` can't be it, or null.
function destroyBarred(world: World, state: State, s: SpellDef, x: Actor) {
  const eff = s.effects.find((e) => e.type === 'destroy_target');
  if (eff?.type !== 'destroy_target') return null;
  if (x.loyalty !== undefined) return `${josa(shortName(x.name), '은', '는')} 생물이 아니다 (플레인즈워커).`;
  if (eff.not_color && actorColors(state, world, x).includes(eff.not_color)) return `${josa(shortName(x.name), '은', '는')} ${COLOR_LABELS[eff.not_color]}색이라 고를 수 없다.`;
  return null;
}

// A spell only for the caster's own ("target creatures you control", Windborne Charge), and how
// many it needs.
function ownOnly(s: SpellDef) {
  return s.effects.find((e) => e.type === 'pump_own')?.count;
}
// The caster's own: themselves, and those who serve them (user decision 2026-10-01).
function ownedBy(x: Actor, a: Actor) {
  return x.id === a.id || x.master === a.id;
}

// The land "target land" falls on for one: the one they most lately bonded with, standing.
export function landToDestroy(state: State, a: Actor) {
  return [...(a.bonds ?? [])].reverse().find((id) => !state.regions[id]?.destroyed);
}

// An NPC's cast block: why they can't cast `spellId` now (before picking whom), or null.
export function npcCastBlocked(state: State, world: World, a: Actor, spellId: string, t: number): string | null {
  const s = spellDef(world, spellId);
  if (!s || !a.spells?.includes(s.id)) return '모르는 주문이다.';
  if (reactionSpell(s)) return `${josa(s.name, '은', '는')} 곁에서 누군가 권속을 들일 때 그것을 막으려고만 쓴다.`;
  const used = usedUntil(a, s, t);
  if (used !== undefined) return usedText(s, used);
  const by = sealedBy(state, a, s, t);
  if (by) return sealText(by, t);
  if (s.effects.some((e) => e.type === 'harrow') && !harrowGive(world, a).length) return '내어 줄 땅이 없다.';
  if (!planPayment(manaAvailable(state, world, a, t), s.cost)) return `마나가 모자라다 (${s.costText}).`;
  return null;
}

// An NPC finished readying a spell: whom it falls on is theirs to pick (the LLM, after the
// hour), or no one (they hold it back). sim/run.ts `choices` casts it.
export function readyCast(state: State, world: World, a: Actor, spellId: string, t: number) {
  const s = spellDef(world, spellId);
  if (!s || npcCastBlocked(state, world, a, s.id, t)) return;
  // Their own (no target): cast as they finish, kicked if they can pay it.
  if (s.target === 'self') return castSpell(state, world, a, s.id, a.id, !!s.kicker && !castBlocked(state, world, a, s.id, a.id, true, t), t);
  const candidates = castTargets(state, a, s, world).map((x) => x.id);
  if (!candidates.length) return;
  (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'cast', spell: s.id }, candidates, optional: true, t });
}

// Spells an NPC could learn: those taught somewhere they don't know yet.
export function learnableSpells(world: World, a: Actor) {
  return world.spells.filter((s) => !a.spells?.includes(s.id) && !a.exiled?.includes(s.id));
}

// The lands of `type` they hold ("each Plains you control"): bonded with, not destroyed.
export function landsOfType(state: State, world: World, a: Actor, type: LandType) {
  return (a.bonds ?? []).filter((id) => {
    const r = world.regions.find((x) => x.id === id);
    return !!r && !state.regions[id]?.destroyed && landTypes(r).includes(type);
  });
}

// Spells an NPC holds and could pay for today.
export function castableSpells(state: State, world: World, a: Actor, t: number) {
  return world.spells.filter((s) => a.spells?.includes(s.id) && !reactionSpell(s) && usedUntil(a, s, t) === undefined && planPayment(manaCapacity(state, world, a, t), s.cost));
}

// Whether a spell does harm (the target takes it as an attack).
export function harmful(s: SpellDef) {
  return s.effects.some((e) => e.type === 'lose_half_life' || e.type === 'destroy_target' || e.type === 'destroy_land' || e.type === 'discard' || e.type === 'discard_per_land' || e.type === 'damage_per_land');
}

// Pays and resolves. A harmful spell's target (if an NPC) takes it as an attack. Returns whether
// it resolved (not sealed off, not broken by a trap), or 'held': a counterspell there may answer
// it, and it resolves (or not) an hour on (Cancel, sim/counter.ts).
export function castSpell(state: State, world: World, a: Actor, spellId: string, targetId: string, kick: boolean, t: number, free = false): boolean | 'held' {
  const s = spellDef(world, spellId)!;
  const by = sealedBy(state, a, s, t);
  if (by) {
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} ${josa(s.name, '을', '를')} 쓰지 못했다: ${sealText(by, t)}`, regions: [a.region], actors: [a.id, by.id], t });
    return false;
  }
  // A mana kicker is paid with the spell, if they can.
  const manaKick = kick && !!s.kicker?.mana && !free && !!planPayment(manaAvailable(state, world, a, t), addCosts(s.cost, s.kicker.mana));
  if (!free) payMana(state, world, a, manaKick ? addCosts(s.cost, s.kicker!.mana!) : s.cost, t);
  // Cast, it is used: not to be cast again for as many hours as its mana value, whatever becomes
  // of it (countered too), and cast free too (user decision 2026-10-01).
  a.used = { ...(a.used ?? {}), [s.id]: t + manaValue(s) * 60 };
  let kicked = manaKick;
  if (kick && s.kicker?.tap) {
    const tapped = tappable(state, world, a, s.kicker.tap)[0];
    if (tapped) {
      tapped.boundUntil = untapTime(t);
      kicked = true;
      addLog(state, { kind: 'effect', text: `${josa(shortName(tapped.name), '이', '가')} 주문에 힘을 보태느라 묶였다.`, regions: [tapped.region], actors: [tapped.id] });
    }
  }
  // A trap answering the count of spells cast today (Mindbreak Trap): the spell comes to nothing,
  // exiled: theirs never again, not even learned anew (user decision 2026-10-01, `Actor.exiled`).
  if (!free && castEvents(state, world, a, t)) {
    a.spells = (a.spells ?? []).filter((x) => x !== s.id);
    // Exile without the player in it is one step lighter (user decision 2026-10-01): an NPC's
    // spell goes to their graveyard (forgotten, to be learned again).
    if (a.kind !== 'player') {
      a.graveyard = [...new Set([...(a.graveyard ?? []), s.id])];
      buryCount(a, 1, t);
      addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '이', '가')} 쓰던 ${josa(s.name, '은', '는')} 허공에서 부서졌다. ${josa(shortName(a.name), '은', '는')} 그 주문을 잊었다.`, regions: [a.region], actors: [a.id], t });
      return false;
    }
    a.exiled = [...new Set([...(a.exiled ?? []), s.id])];
    addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '이', '가')} 쓰던 ${josa(s.name, '은', '는')} 허공에서 부서져 사라졌다. 그 주문은 영영 다시 쓰지도 익히지도 못한다.`, regions: [a.region], actors: [a.id], t });
    return false;
  }
  // Someone there holding a counterspell (Cancel) may answer it: it waits an hour. Not what comes
  // free with a spell already resolved, nor a counterspell itself (no wars of them).
  if (!free && !reactionSpell(s) && holdCast(state, world, a, s, targetId, kicked, t)) return 'held';
  return resolveSpell(state, world, a, s.id, targetId, kicked, t, free);
}

// The spell takes hold: what it does, on whom.
export function resolveSpell(state: State, world: World, a: Actor, spellId: string, targetId: string, kicked: boolean, t: number, free = false) {
  const s = spellDef(world, spellId)!;
  const target = state.actors[targetId];
  if (!target || target.dead) {
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} 쓴 ${josa(s.name, '은', '는')} 걸 이가 사라져 흩어졌다.`, regions: [a.region], actors: [a.id], t });
    return false;
  }
  const on = target.id === a.id ? '자신' : shortName(target.name);
  const paid = free && ownOnly(s) ? '둘째 대상' : free ? '값 없이' : kicked && s.kicker?.mana ? `${s.costText} + 킥커 ${s.kicker.manaText}` : s.costText;
  addLog(state, {
    kind: 'event',
    text: s.target === 'self' ? `${josa(shortName(a.name), '이', '가')} ${josa(s.name, '을', '를')} 썼다 (${paid}).` : `${josa(shortName(a.name), '이', '가')} ${on}에게 ${josa(s.name, '을', '를')} 걸었다 (${paid}).`,
    regions: [a.region],
    actors: [a.id, target.id],
  });
  let lost = 0;
  for (const eff of s.effects) resolve(eff);
  function resolve(eff: SpellDef['effects'][number]) {
    if (eff.type === 'lose_half_life') {
      const life = lifeOf(target);
      lost = Math.ceil(life / 2);
      loseLife(state, target, lost, t, s.name, a);
    } else if (eff.type === 'gain_life_lost' && (!eff.if_kicked || kicked) && lost > 0) {
      gainLife(state, a, lost, t, s.name);
    } else if (eff.type === 'copy_if_kicked' && kicked && !free) {
      // One more, free, on someone else here: the caster's pick after the hour.
      const others = castTargets(state, a, s, world).filter((x) => x.id !== target.id).map((x) => x.id);
      if (others.length) (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'cast', spell: s.id, free: true }, candidates: others, optional: true, t });
    } else if (eff.type === 'destroy_land') {
      const land = landToDestroy(state, target);
      if (land) destroyLand(state, world, land, [a.id], t, s.id);
    } else if (eff.type === 'discard') {
      owesDiscard(state, world, target, s.name, t);
    } else if (eff.type === 'demolish') {
      const owed = demolishOwed(state, world, a, s.name, t);
      if (owed) (state.choices ??= []).push(owed);
    } else if (eff.type === 'destroy_target') {
      // Whose it is, as it falls (a master lets go of the dead).
      const controller = masterOf(state, target) ?? target;
      destroy(state, target, t, s.name, a);
      if (eff.lose_life && !controller.dead) loseLife(state, controller, eff.lose_life, t, s.name, a);
    } else if (eff.type === 'harrow') {
      const owed = harrowOwed(state, world, a, { type: 'harrow', spell: s.name, left: eff.count, given: false }, t);
      if (owed) (state.choices ??= []).push(owed);
    } else if (eff.type === 'destroy_all') {
      judgment(state, world, a, s.name, t);
    } else if (eff.type === 'destroy_relics') {
      const owed = crushOwed(state, world, a, s.name, eff.count, true, t);
      if (owed) (state.choices ??= []).push(owed);
    } else if (eff.type === 'discard_per_land') {
      const n = landsOfType(state, world, a, eff.land).length;
      if (n > 0) owesDiscard(state, world, target, s.name, t, n);
      else addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} ${josa(LAND_TYPE_LABELS[eff.land], '과', '와')} 이어져 있지 않아 아무 일도 없었다.`, regions: [a.region], actors: [a.id], t });
    } else if (eff.type === 'damage_per_land') {
      const n = landsOfType(state, world, a, eff.land).length;
      if (n > 0) dealDamage(state, target, n, t, s.name, false, a);
      else addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} ${josa(LAND_TYPE_LABELS[eff.land], '과', '와')} 이어져 있지 않아 아무 일도 없었다.`, regions: [a.region], actors: [a.id], t });
    } else if (eff.type === 'hunt_creatures') {
      huntKnowledge(state, world, target, eff.count, t, s.name);
    } else if (eff.type === 'gain_life_per_land') {
      const n = landsOfType(state, world, target, eff.land).length;
      if (n > 0) gainLife(state, target, n * eff.amount, t, s.name);
      else addLog(state, { kind: 'status', text: `${josa(shortName(target.name), '은', '는')} ${josa(LAND_TYPE_LABELS[eff.land], '과', '와')} 이어져 있지 않아 얻은 것이 없다.`, regions: [target.region], actors: [target.id], t });
    } else if (eff.type === 'create_retainers') {
      const n = kicked && eff.kicked_count ? eff.kicked_count : eff.count;
      const born = spawnWild(state, world, eff.creature, eff.pt, n, a.region, eff.colors, a.tile, eff.abilities ?? []);
      for (const b of born) {
        b.master = a.id;
        if (eff.until_midnight) state.tokens![b.id].vanishAt = untapTime(t);
        if (kicked && eff.kicked_pump) b.pumps = [...(b.pumps ?? []), { pt: [...eff.kicked_pump], until: untapTime(t) }];
      }
      const kind = world.lore.find((l) => l.id === eff.creature)?.name ?? eff.creature;
      addLog(state, { kind: 'event', text: eff.until_midnight ? `${josa(shortName(a.name), '이', '가')} ${josa(kind, '을', '를')} 불러냈다 (${ptOf(born[0]).join('/')}${eff.abilities?.length ? `, ${eff.abilities.map((x) => ABILITY_LABELS[x]).join('·')}` : ''}, 권속, 자정에 사라진다).` : `${kind} ${n}명이 나타나 ${shortName(a.name)}에게 서약했다 (${eff.pt.join('/')}, 권속).`, regions: [a.region], actors: [a.id, ...born.map((b) => b.id)] });
    } else if (eff.type === 'pump_own') {
      boostTillMidnight(state, target, eff.pt, eff.abilities, t);
      // The other target(s): the caster's pick after the hour, one they must make.
      if (!free && eff.count > 1) {
        const others = castTargets(state, a, s, world).filter((x) => x.id !== target.id).map((x) => x.id);
        if (others.length) (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'cast', spell: s.id, free: true, second: true }, candidates: others, optional: false, t });
      }
    } else if (eff.type === 'pump_controlled') {
      const { pt, abilities } = kicked && eff.kicked ? eff.kicked : eff;
      for (const x of controlledCreatures(state, world, a).filter((y) => together(y, a))) boostTillMidnight(state, x, pt, abilities, t);
    } else if (eff.type === 'copy_target') {
      replicate(state, world, a, target, kicked && eff.kicked_count ? eff.kicked_count : eff.count, t, s.name);
    } else if (eff.type === 'aura') {
      const added = eff.abilities.filter((ab) => !target.abilities.includes(ab));
      target.auras = [...(target.auras ?? []), { spell: s.id, name: s.name, by: a.id, pt: [...eff.pt], ...(eff.base_pt ? { base: [...eff.base_pt] as [number, number] } : {}), doubleLifeOnHit: eff.double_life_on_hit, ...(added.length ? { added } : {}) }];
      // What it gives stays as long as the aura does: until they die.
      for (const ab of eff.abilities) if (!target.abilities.includes(ab)) target.abilities = [...target.abilities, ab];
      addLog(state, {
        kind: 'status',
        text: `${josa(shortName(target.name), '이', '가')} ${josa(s.name, '을', '를')} 둘렀다 (${ptOf(target).join('/')}).`,
        regions: [target.region],
        actors: [target.id],
      });
    }
  }
  if (target.kind !== 'player' && target.id !== a.id && harmful(s)) {
    addFoe(target, a.id, t);
    remember(target, a, `나에게 ${josa(s.name, '을', '를')} 걸었다`, t);
  }
  return true;
}

// +P/+T and abilities until midnight ("until end of turn"). What they have of their own stays
// theirs past midnight: only what they lacked is granted.
function boostTillMidnight(state: State, target: Actor, pt: readonly [number, number], abilities: readonly Ability[], t: number) {
  const until = untapTime(t);
  target.pumps = [...(target.pumps ?? []), { pt: [pt[0], pt[1]], until }];
  for (const ability of abilities) {
    if (target.abilities.includes(ability) && !target.granted?.some((g) => g.ability === ability)) continue;
    target.granted = [...(target.granted ?? []).filter((g) => g.ability !== ability), { ability, until }];
    if (!target.abilities.includes(ability)) target.abilities = [...target.abilities, ability];
  }
  addLog(state, { kind: 'effect', text: `${josa(shortName(target.name), '이', '가')} 자정까지 +${pt[0]}/+${pt[1]}${abilities.length ? `, ${abilities.map((x) => ABILITY_LABELS[x]).join('·')}` : ''}을 얻었다 (${ptOf(target).join('/')}).`, regions: [target.region], actors: [target.id], t });
}

// Day of Judgment: light falls on everyone on the caster's tile, the caster last; planeswalkers
// are no creatures, and the indestructible stand.
function judgment(state: State, world: World, a: Actor, name: string, t: number) {
  const all = present(state, a.region, a.tile).filter((x) => npcDef(state, world, x.id)?.loyalty === undefined);
  addLog(state, { kind: 'event', text: `${name}: 눈부신 빛이 ${shortName(a.name)}의 곁을 덮쳤다.`, regions: [a.region], actors: all.map((x) => x.id), t });
  for (const x of [...all.filter((y) => y.id !== a.id), ...all.filter((y) => y.id === a.id)]) if (!x.dead) destroy(state, x, t, name, a);
}
