// Spells (world/entities/spells): learned at a place, cast with mana on someone standing in
// the same place. The player learns and casts them by actions; NPCs by `learn` / `cast`
// blocks of their LLM-planned day (whom a spell falls on, the LLM picks as it is cast), and
// hold some by color (knows_colors) to cast by their powers (Chandra). A sealed color can't
// be cast (sim/seal.ts).
import { untapTime } from './clock.ts';
import { addFoe, dealDamage } from './combat.ts';
import { gainLife, lifeOf, loseLife } from './life.ts';
import { addCosts, formatMana, manaAvailable, manaCapacity, payMana, planPayment } from './mana.ts';
import { spawnWild } from './abilities.ts';
import { destroyLand } from './step.ts';
import { owesDiscard } from './discard.ts';
import { crushOwed, relicsHere } from './relics.ts';
import { remember } from './relations.ts';
import { creatureOf, retainersOf } from './retainers.ts';
import { addLog, present, ptOf, targetable, untargetableText } from './state.ts';
import type { Actor, State } from './state.ts';
import { sealedBy, sealText } from './seal.ts';
import { josa, shortName } from './text.ts';
import { LAND_TYPE_LABELS, landTypes, placeName, region, spellColors } from './world.ts';
import type { LandType } from './world.ts';
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
  if (a.region !== s.learnAt) return `${josa(s.name, '은', '는')} ${placeName(world, region(world, s.learnAt))}에서 배울 수 있다.`;
  return null;
}

export function learnSpell(state: State, world: World, a: Actor, spellId: string, t: number) {
  const s = spellDef(world, spellId);
  if (!s || a.spells?.includes(s.id)) return;
  a.spells = [...(a.spells ?? []), s.id];
  addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} ${josa(s.name, '을', '를')} 익혔다.`, regions: [a.region], actors: [a.id], t });
}

// `a`'s retainers of creature `kind` who could be tapped now (a kicker's "tap an untapped …
// you control").
export function tappable(state: State, world: World, a: Actor, kind: string) {
  return retainersOf(state, a.id).filter((x) => x.boundUntil === undefined && creatureOf(state, world, x.id) === kind);
}

export function castBlocked(state: State, world: World, a: Actor, spellId: string, targetId: string, kick: boolean, t: number): string | null {
  const s = spellDef(world, spellId);
  if (!s || !a.spells?.includes(s.id)) return '모르는 주문이다.';
  const by = sealedBy(state, a, s, t);
  if (by) return sealText(by, t);
  const target = state.actors[targetId];
  if (!target || target.dead || (target.id === a.id && s.target === 'other_here') || (s.target === 'self' && target.id !== a.id)) return '그런 대상은 없다.';
  if (target.id !== a.id && !present(state, a.region).some((x) => x.id === target.id))
    return `${josa(shortName(target.name), '은', '는')} 여기 없다.`;
  if (s.effects.some((e) => e.type === 'destroy_land') && !landToDestroy(state, target))
    return `${josa(shortName(target.name), '은', '는')} 부술 땅을 쥐고 있지 않다.`;
  if (s.effects.some((e) => e.type === 'destroy_relics') && !relicsHere(state, world, a.region).length) return '여기엔 부술 마법물체도 부여마법도 없다.';
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
export function castTargets(state: State, a: Actor, s: SpellDef) {
  if (s.target === 'self') return [a];
  const needsLand = s.effects.some((e) => e.type === 'destroy_land');
  return present(state, a.region).filter((x) => (x.id !== a.id || s.target === 'any_here') && targetable(x, state.minutes, spellColors(s)) && (!needsLand || !!landToDestroy(state, x)));
}

// The land "target land" falls on for one: the one they most lately bonded with, standing.
export function landToDestroy(state: State, a: Actor) {
  return [...(a.bonds ?? [])].reverse().find((id) => !state.regions[id]?.destroyed);
}

// An NPC's cast block: why they can't cast `spellId` now (before picking whom), or null.
export function npcCastBlocked(state: State, world: World, a: Actor, spellId: string, t: number): string | null {
  const s = spellDef(world, spellId);
  if (!s || !a.spells?.includes(s.id)) return '모르는 주문이다.';
  const by = sealedBy(state, a, s, t);
  if (by) return sealText(by, t);
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
  const candidates = castTargets(state, a, s).map((x) => x.id);
  if (!candidates.length) return;
  (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'cast', spell: s.id }, candidates, optional: true, t });
}

// Spells an NPC could learn: those taught somewhere they don't know yet.
export function learnableSpells(world: World, a: Actor) {
  return world.spells.filter((s) => !a.spells?.includes(s.id));
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
  return world.spells.filter((s) => a.spells?.includes(s.id) && planPayment(manaCapacity(state, world, a, t), s.cost));
}

// Whether a spell does harm (the target takes it as an attack).
export function harmful(s: SpellDef) {
  return s.effects.some((e) => e.type === 'lose_half_life' || e.type === 'destroy_land' || e.type === 'discard' || e.type === 'discard_per_land' || e.type === 'damage_per_land');
}

// Pays and resolves. A harmful spell's target (if an NPC) takes it as an attack.
export function castSpell(state: State, world: World, a: Actor, spellId: string, targetId: string, kick: boolean, t: number, free = false) {
  const s = spellDef(world, spellId)!;
  const target = state.actors[targetId];
  const by = sealedBy(state, a, s, t);
  if (by) {
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} ${josa(s.name, '을', '를')} 쓰지 못했다: ${sealText(by, t)}`, regions: [a.region], actors: [a.id, by.id], t });
    return;
  }
  // A mana kicker is paid with the spell, if they can.
  const manaKick = kick && !!s.kicker?.mana && !free && !!planPayment(manaAvailable(state, world, a, t), addCosts(s.cost, s.kicker.mana));
  if (!free) payMana(state, world, a, manaKick ? addCosts(s.cost, s.kicker!.mana!) : s.cost, t);
  let kicked = manaKick;
  if (kick && s.kicker?.tap) {
    const tapped = tappable(state, world, a, s.kicker.tap)[0];
    if (tapped) {
      tapped.boundUntil = untapTime(t);
      kicked = true;
      addLog(state, { kind: 'effect', text: `${josa(shortName(tapped.name), '이', '가')} 주문에 힘을 보태느라 묶였다.`, regions: [tapped.region], actors: [tapped.id] });
    }
  }
  const on = target.id === a.id ? '자신' : shortName(target.name);
  const paid = free ? '값 없이' : kicked && s.kicker?.mana ? `${s.costText} + 킥커 ${s.kicker.manaText}` : s.costText;
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
      const others = castTargets(state, a, s).filter((x) => x.id !== target.id).map((x) => x.id);
      if (others.length) (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'cast', spell: s.id, free: true }, candidates: others, optional: true, t });
    } else if (eff.type === 'destroy_land') {
      const land = landToDestroy(state, target);
      if (land) destroyLand(state, world, land, [a.id], t, s.id);
    } else if (eff.type === 'discard') {
      owesDiscard(state, world, target, s.name, t);
    } else if (eff.type === 'destroy_relics') {
      const owed = crushOwed(state, world, a, s.name, eff.count, true, t);
      if (owed) (state.choices ??= []).push(owed);
    } else if (eff.type === 'discard_per_land') {
      const n = landsOfType(state, world, a, eff.land).length;
      if (n > 0) owesDiscard(state, world, target, s.name, t, n);
      else addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} ${josa(LAND_TYPE_LABELS[eff.land], '과', '와')} 이어져 있지 않아 아무 일도 없었다.`, regions: [a.region], actors: [a.id], t });
    } else if (eff.type === 'damage_per_land') {
      const n = landsOfType(state, world, a, eff.land).length;
      if (n > 0) dealDamage(state, target, n, t, s.name);
      else addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} ${josa(LAND_TYPE_LABELS[eff.land], '과', '와')} 이어져 있지 않아 아무 일도 없었다.`, regions: [a.region], actors: [a.id], t });
    } else if (eff.type === 'gain_life_per_land') {
      const n = landsOfType(state, world, target, eff.land).length;
      if (n > 0) gainLife(state, target, n * eff.amount, t, s.name);
      else addLog(state, { kind: 'status', text: `${josa(shortName(target.name), '은', '는')} ${josa(LAND_TYPE_LABELS[eff.land], '과', '와')} 이어져 있지 않아 얻은 것이 없다.`, regions: [target.region], actors: [target.id], t });
    } else if (eff.type === 'create_retainers') {
      const n = kicked && eff.kicked_count ? eff.kicked_count : eff.count;
      const born = spawnWild(state, world, eff.creature, eff.pt, n, a.region, eff.colors);
      for (const b of born) b.master = a.id;
      const kind = world.lore.find((l) => l.id === eff.creature)?.name ?? eff.creature;
      addLog(state, { kind: 'event', text: `${kind} ${n}명이 나타나 ${shortName(a.name)}에게 서약했다 (${eff.pt.join('/')}, 권속).`, regions: [a.region], actors: [a.id, ...born.map((b) => b.id)] });
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
}
