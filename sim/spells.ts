// Spells (world/entities/spells): learned at a place, cast with mana on someone standing in
// the same place. Only the player learns and casts them for now.
import { untapTime } from './clock.ts';
import { addFoe } from './combat.ts';
import { gainLife, lifeOf, loseLife } from './life.ts';
import { formatMana, manaAvailable, payMana, planPayment } from './mana.ts';
import { remember } from './relations.ts';
import { creatureOf, retainersOf } from './retainers.ts';
import { addLog, present, ptOf } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { placeName, region } from './world.ts';
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
  const target = state.actors[targetId];
  if (!target || target.dead || (target.id === a.id && s.target !== 'any_here')) return '그런 대상은 없다.';
  if (target.id !== a.id && !present(state, a.region).some((x) => x.id === target.id))
    return `${josa(shortName(target.name), '은', '는')} 여기 없다.`;
  if (!planPayment(manaAvailable(state, world, a, t), s.cost))
    return `마나가 모자라다 (${s.costText}, 지금 ${formatMana(manaAvailable(state, world, a, t))}).`;
  if (kick && !s.kicker) return '추가 비용이 없는 주문이다.';
  if (kick && !tappable(state, world, a, s.kicker!.tap).length) return '추가 비용으로 탭할 것이 없다.';
  return null;
}

// Whether a spell does harm (the target takes it as an attack).
export function harmful(s: SpellDef) {
  return s.effects.some((e) => e.type === 'lose_half_life');
}

// Pays and resolves. A harmful spell's target (if an NPC) takes it as an attack.
export function castSpell(state: State, world: World, a: Actor, spellId: string, targetId: string, kick: boolean, t: number) {
  const s = spellDef(world, spellId)!;
  const target = state.actors[targetId];
  payMana(state, world, a, s.cost, t);
  let kicked = false;
  if (kick && s.kicker) {
    const tapped = tappable(state, world, a, s.kicker.tap)[0];
    if (tapped) {
      tapped.boundUntil = untapTime(t);
      kicked = true;
      addLog(state, { kind: 'effect', text: `${josa(shortName(tapped.name), '이', '가')} 주문에 힘을 보태느라 묶였다.`, regions: [tapped.region], actors: [tapped.id] });
    }
  }
  const on = target.id === a.id ? '자신' : shortName(target.name);
  addLog(state, {
    kind: 'event',
    text: `${josa(shortName(a.name), '이', '가')} ${on}에게 ${josa(s.name, '을', '를')} 걸었다 (${s.costText}).`,
    regions: [a.region],
    actors: [a.id, target.id],
  });
  let lost = 0;
  for (const eff of s.effects) resolve(eff);
  function resolve(eff: SpellDef['effects'][number]) {
    if (eff.type === 'lose_half_life') {
      const life = lifeOf(target);
      if (life === null) {
        addLog(state, { kind: 'effect', text: `${josa(shortName(target.name), '은', '는')} 아무렇지 않다.`, regions: [a.region], actors: [target.id] });
        return;
      }
      lost = Math.ceil(life / 2);
      loseLife(state, target, lost, s.name);
    } else if (eff.type === 'gain_life_lost' && (!eff.if_kicked || kicked) && lost > 0) {
      gainLife(state, a, lost, t, s.name);
    } else if (eff.type === 'aura') {
      target.auras = [...(target.auras ?? []), { spell: s.id, name: s.name, by: a.id, pt: [...eff.pt], doubleLifeOnHit: eff.double_life_on_hit }];
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
