// Landfall (bonding with a land) and activated abilities of GM-driven beings.
import { gameDay, untapTime } from './clock.ts';
import { die } from './combat.ts';
import { payMana } from './mana.ts';
import { addLog, beingState, ptOf } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { region } from './world.ts';
import type { World } from './world.ts';

// Why `a` can't bond with the land they stand on now, or null. One land per turn, as one
// land drop per turn in MTG.
export function bondBlocked(state: State, world: World, a: Actor, t: number): string | null {
  const r = region(world, a.region);
  if (a.bonds?.includes(r.id)) return `이미 ${r.name}과 유대를 맺었다.`;
  if (state.regions[r.id]?.destroyed) return '부서진 땅과는 유대를 맺을 수 없다.';
  if (a.landfalls?.day === gameDay(t) && a.landfalls.regions.length >= 1) return '오늘은 이미 한 땅과 유대를 맺었다. 땅은 하루에 하나.';
  return null;
}

// Landfall: the land comes under their control.
export function bondLand(state: State, world: World, a: Actor, t: number) {
  const r = region(world, a.region);
  a.bonds = [...(a.bonds ?? []), r.id];
  const day = gameDay(t);
  if (a.landfalls?.day !== day) a.landfalls = { day, regions: [] };
  a.landfalls.regions.push(r.id);
  a.landfallAt = t;
  addLog(state, {
    kind: 'status',
    text: `${josa(shortName(a.name), '이', '가')} ${josa(r.name, '과', '와')} 유대를 맺었다.`,
    regions: [r.id],
    actors: [a.id],
    t,
  });
}

// A GM-driven being uses an activated ability on a living character. Returns why not, or null.
export function useAbility(state: State, world: World, beingId: string, abilityId: string, targetId: string, t: number) {
  const being = world.beings.find((b) => b.id === beingId);
  const ability = being?.activated.find((x) => x.id === abilityId);
  const target = state.actors[targetId];
  if (!being || !ability) return '그런 능력은 없다.';
  if (!target || target.dead) return '대상이 없다.';
  const bs = beingState(state, beingId);
  const name = shortName(being.name);
  if (bs.boundUntil !== undefined && bs.boundUntil > t) return `${josa(name, '은', '는')} 탭되어 있다.`;
  if (!payMana(state, world, bs, ability.cost, t)) return '마나가 모자라다.';
  if (ability.tap) bs.boundUntil = untapTime(t);
  addLog(state, {
    kind: 'event',
    text: `${josa(name, '이', '가')} ${josa(ability.name, '을', '를')} 썼다. 대상은 ${shortName(target.name)}.`,
    regions: [target.region],
    actors: [target.id],
  });
  let died = false;
  for (const eff of ability.effects) {
    if (eff.type === 'destroy') {
      die(state, target, t, `${name}의 ${ability.name}`);
      died = true;
    } else if (eff.type === 'raise' && died) {
      raiseToken(state, world, target, eff.creature, eff.faction, being.id);
    }
  }
  return null;
}

// A token: a new character born in play from `from`, with its power/toughness.
function raiseToken(state: State, world: World, from: Actor, creature: string, faction: string | undefined, master: string) {
  const kind = world.lore.find((l) => l.id === creature);
  const masterName = shortName(world.beings.find((b) => b.id === master)?.name ?? master);
  const factionName = faction ? world.lore.find((l) => l.id === faction)?.name : undefined;
  const id = `tok-${state.nextLogId}`;
  const was = shortName(from.name);
  const name = `${kind?.name ?? creature}이 된 ${was}`;
  state.tokens ??= {};
  state.tokens[id] = {
    id,
    name,
    summary: `${masterName}에게 죽어 ${kind?.name ?? creature}로 되살아난 ${was}`,
    role: `${factionName ?? masterName}의 ${kind?.name ?? creature}`,
    home: from.region,
    persona: `${was}은(는) ${masterName}에게 죽어 ${kind?.name ?? creature}로 되살아났다. 살아 있을 때의 기억은 흐릿하고, ${factionName ? `${factionName}과 ` : ''}${masterName}를 따른다.${from.background ? ` 살아 있을 때: ${from.background}` : ''}`,
    goal: `${masterName}를 섬기고 ${factionName ?? '혈족'}을 늘린다.`,
    pt: [...ptOf(from)],
    abilities: [],
    needs: ['energy'],
    routine: [{ start: 0, end: 1440, regionId: from.region, kind: 'leisure', activity: `${masterName}의 부름을 기다림`, emoji: '🦇' }],
  };
  const def = state.tokens[id];
  state.actors[id] = {
    id,
    name,
    kind: 'npc',
    region: from.region,
    stats: { energy: 80, hunger: 0, coin: 0 },
    pt: [...def.pt],
    pace: 'normal',
    abilities: [],
    needs: ['energy'],
  };
  addLog(state, {
    kind: 'event',
    text: `${josa(was, '이', '가')} ${kind?.name ?? creature}로 되살아났다 (${def.pt.join('/')}).`,
    regions: [from.region],
    actors: [id],
  });
}
