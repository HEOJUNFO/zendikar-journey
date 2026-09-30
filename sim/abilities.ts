// Landfall (bonding with a land) and activated abilities, used as the morning LLM plans.
import { gameDay, untapTime } from './clock.ts';
import { dealDamage, die, leavePlane } from './combat.ts';
import { manaAvailable, payMana, planPayment } from './mana.ts';
import type { Color } from './mana.ts';
import { itemsOnLandfall } from './items.ts';
import { gainLife, loseLife } from './life.ts';
import { DEPLETED_LABEL } from './rules.ts';
import { castSpell, spellDef } from './spells.ts';
import { addLog, npcDef, outOfTime, present, ptOf, random } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import { LAND_TYPE_LABELS, landTypes, region, spellColors } from './world.ts';
import type { ActivatedAbility, World } from './world.ts';

// Why `a` can't bond with the land they stand on now, or null. One land per turn, as one
// land drop per turn in MTG.
export function bondBlocked(state: State, world: World, a: Actor, t: number): string | null {
  const r = region(world, a.region);
  if (a.bonds?.includes(r.id)) return `이미 ${josa(r.name, '과', '와')} 유대를 맺었다.`;
  if (state.regions[r.id]?.destroyed) return '부서진 땅과는 유대를 맺을 수 없다.';
  if (npcDef(state, world, a.id)?.beast && state.regions[r.id]?.conditions.some((c) => c.label === DEPLETED_LABEL))
    return '사냥감이 바닥난 땅이다.';
  if (a.landfalls?.day === gameDay(t) && a.landfalls.regions.length >= 1) return '오늘은 이미 한 땅과 유대를 맺었다. 땅은 하루에 하나.';
  return null;
}

// Landfall: the land comes under their control (the one they stand on, or one sought out from
// afar with a fetch land).
export function bondLand(state: State, world: World, a: Actor, t: number, regionId = a.region) {
  const r = region(world, regionId);
  const def = npcDef(state, world, a.id);
  // A beast holds only its latest hunting ground.
  a.bonds = def?.beast ? [r.id] : [...(a.bonds ?? []), r.id];
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
  // "Landfall — … gets +N/+N (and trample) until end of turn."
  if (def?.landfall) {
    a.boost = { until: untapTime(t), pt: [...def.landfall.pt], trample: def.landfall.trample };
    addLog(state, {
      kind: 'status',
      text: `${shortName(a.name)}의 힘이 치솟았다 (${ptOf(a).join('/')}${def.landfall.trample ? ', 돌진' : ''}, 자정까지).`,
      regions: [r.id],
      actors: [a.id],
      t,
    });
  }
  // The land's own: "enters tapped", "When this land enters, you gain N life".
  if (r.entersTapped)
    addLog(state, { kind: 'status', text: `${josa(r.name, '은', '는')} 탭된 채 들어왔다. 오늘은 마나를 내지 않는다.`, regions: [r.id], actors: [a.id], t });
  for (const eff of r.onBond) if (eff.type === 'gain_life') gainLife(state, a, eff.amount, t, r.name);
  itemsOnLandfall(state, world, a, t);
}

// Lands `a` could seek out with the fetch land `fromId`: of its types, not held, not destroyed.
export function fetchTargets(state: State, world: World, a: Actor, fromId: string) {
  const from = world.regions.find((r) => r.id === fromId);
  if (!from?.fetch) return [];
  return world.regions.filter(
    (r) => r.id !== from.id && !a.bonds?.includes(r.id) && !state.regions[r.id]?.destroyed && landTypes(r).some((x) => from.fetch!.types.includes(x)),
  );
}

// Why `a` can't give up `fromId` to seek out `toId` now, or null.
export function fetchBlocked(state: State, world: World, a: Actor, fromId: string, toId: string): string | null {
  const from = world.regions.find((r) => r.id === fromId);
  if (!from?.fetch) return '그런 땅은 없다.';
  if (!a.bonds?.includes(from.id)) return `${josa(from.name, '과', '와')} 유대를 맺고 있어야 한다.`;
  const rs = state.regions[from.id];
  if (rs?.destroyed || rs?.conditions.some((c) => c.tapped)) return `${josa(from.name, '은', '는')} 지금 쓸 수 없다.`;
  if (!fetchTargets(state, world, a, from.id).some((r) => r.id === toId))
    return `${from.fetch.types.map((x) => LAND_TYPE_LABELS[x]).join('이나 ')} 가운데 아직 유대가 없는 땅이어야 한다.`;
  return null;
}

// "{T}, Pay N life, Sacrifice this land: Search your library for a <type> card, put it onto
// the battlefield": they lose N life and their bond with the fetch land, and bond with the
// land sought from wherever they are. Not their land for the day: a landfall of its own.
export function fetchLand(state: State, world: World, a: Actor, fromId: string, toId: string, t: number) {
  const why = fetchBlocked(state, world, a, fromId, toId);
  if (why) {
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} 길을 찾지 못했다: ${why}`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const from = region(world, fromId);
  if (from.fetch!.life) loseLife(state, a, from.fetch!.life, from.name);
  a.bonds = a.bonds!.filter((id) => id !== from.id);
  addLog(state, {
    kind: 'status',
    text: `${josa(shortName(a.name), '이', '가')} ${josa(from.name, '을', '를')} 내어 주고 ${toward(region(world, toId).name)} 이어지는 길을 찾았다.`,
    regions: [a.region, toId],
    actors: [a.id],
    t,
  });
  a.fetched = [...(a.fetched ?? []), toId];
  bondLand(state, world, a, t, toId);
}

// At a turn's start (00:00): whoever holds a land like Emeria and enough plains gets back the
// last retainer who died serving them ("return target creature card from your graveyard to
// the battlefield"), at their side and theirs again.
export function upkeepRevive(state: State, world: World, t: number) {
  for (const holder of Object.values(state.actors)) {
    // Out of time: no upkeep for them today.
    if (holder.dead || outOfTime(state, holder, t)) continue;
    const held = (holder.bonds ?? []).map((id) => world.regions.find((r) => r.id === id)).filter((r) => r && !state.regions[r.id]?.destroyed);
    const plains = held.filter((r) => landTypes(r!).includes('plains')).length;
    const land = held.find((r) => r!.upkeepRevive && plains >= r!.upkeepRevive.plains);
    const back = [...(holder.fallen ?? [])].reverse().map((id) => state.actors[id]).find((x) => x?.dead && !x.left);
    if (!land || !back) continue;
    delete back.dead;
    Object.assign(back, { region: holder.region, master: holder.id, travel: undefined, task: undefined, forced: undefined, wounds: undefined, schedule: undefined });
    holder.fallen = holder.fallen!.filter((id) => id !== back.id);
    addLog(state, {
      kind: 'event',
      text: `${land!.name}의 힘으로 ${josa(shortName(back.name), '이', '가')} 되살아나 다시 ${shortName(holder.name)} 곁에 섰다.`,
      regions: [holder.region],
      actors: [back.id, holder.id],
      t,
    });
  }
}

// Why they can't use this ability now (loyalty, tap, mana), or null. The target is checked
// by useAbility.
export function abilityBlocked(state: State, world: World, beingId: string, ability: ActivatedAbility, t: number): string | null {
  const bs = state.actors[beingId];
  const name = shortName(bs?.name ?? beingId);
  if (!bs || bs.dead) return `${josa(name, '은', '는')} 이 세계에 없다.`;
  if (bs.boundUntil !== undefined && bs.boundUntil > t) return `${josa(name, '은', '는')} 탭되어 있다.`;
  if (ability.loyalty !== undefined) {
    if (bs.loyaltyDay === gameDay(t)) return '오늘은 이미 기세를 썼다.';
    if ((bs.loyalty ?? 0) + ability.loyalty < 0) return '기세가 모자라다.';
  }
  if (!planPayment(manaAvailable(state, world, bs, t), ability.cost)) return '마나가 모자라다.';
  return null;
}

// A character uses an activated ability (on a living character, if it targets). Returns why
// not, or null.
export function useAbility(state: State, world: World, beingId: string, abilityId: string, targetId: string, t: number) {
  const being = npcDef(state, world, beingId);
  const ability = being?.activated?.find((x) => x.id === abilityId);
  if (!being || !ability) return '그런 능력은 없다.';
  const target = ability.target ? state.actors[targetId] : undefined;
  if (ability.target && (!target || target.dead || target.id === beingId)) return '대상이 없다.';
  const why = abilityBlocked(state, world, beingId, ability, t);
  if (why) return why;
  const bs = state.actors[beingId];
  const name = shortName(being.name);
  payMana(state, world, bs, ability.cost, t);
  if (ability.tap) bs.boundUntil = untapTime(t);
  if (ability.loyalty !== undefined) {
    bs.loyalty = (bs.loyalty ?? 0) + ability.loyalty;
    bs.loyaltyDay = gameDay(t);
  }
  const loyalty = ability.loyalty === undefined ? '' : ` (기세 ${ability.loyalty > 0 ? '+' : ''}${ability.loyalty} → ${bs.loyalty})`;
  addLog(state, {
    kind: 'event',
    text: `${josa(name, '이', '가')} ${josa(ability.name, '을', '를')} 썼다${loyalty}.${target ? ` 대상은 ${shortName(target.name)}.` : ''}`,
    regions: [...new Set([bs.region, ...(target ? [target.region] : [])])],
    actors: target ? [bs.id, target.id] : [bs.id],
  });
  const cause = `${name}의 ${ability.name}`;
  let died = false;
  for (const eff of ability.effects) {
    if (eff.type === 'destroy' && target) {
      die(state, target, t, cause);
      died = true;
    } else if (eff.type === 'raise' && died && target) {
      raiseToken(state, world, target, eff.creature, eff.faction, eff.colors, being.id);
    } else if (eff.type === 'discard_spell') {
      const gone = discardSpell(state, world, bs, t);
      if (gone && spellColors(gone).includes(eff.if_color) && target) dealDamage(state, target, eff.damage, t, cause);
    } else if (eff.type === 'wheel') {
      for (const x of present(state, bs.region)) wheel(state, world, x, eff.draw);
    } else if (eff.type === 'flashback' && target) {
      for (const id of bs.graveyard ?? []) {
        const s = spellDef(world, id);
        if (s && spellColors(s).includes(eff.color) && !target.dead) castSpell(state, world, bs, s.id, target.id, false, t, true);
      }
    }
  }
  // Spent all their loyalty: gone from this plane.
  if (ability.loyalty !== undefined && (bs.loyalty ?? 0) <= 0) leavePlane(state, bs, t, `${ability.name}에 기세를 다 씀`);
  return null;
}

// Let go of one spell they hold, at random (a discard). Returns it.
function discardSpell(state: State, world: World, a: Actor, t: number) {
  const hand = a.spells ?? [];
  if (!hand.length) {
    addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '은', '는')} 불사를 주문이 없다.`, regions: [a.region], actors: [a.id], t });
    return undefined;
  }
  const id = hand[Math.floor(random(state) * hand.length)];
  a.spells = hand.filter((x) => x !== id);
  a.graveyard = [...(a.graveyard ?? []), id];
  const s = spellDef(world, id);
  addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '이', '가')} ${josa(s?.name ?? id, '을', '를')} 불살라 날렸다.`, regions: [a.region], actors: [a.id], t });
  return s;
}

// Let go of every spell held, then come to hold `draw` spells of the world at random.
function wheel(state: State, world: World, a: Actor, draw: number) {
  a.graveyard = [...(a.graveyard ?? []), ...(a.spells ?? [])];
  const pool = [...world.spells];
  const got: string[] = [];
  while (got.length < draw && pool.length) got.push(pool.splice(Math.floor(random(state) * pool.length), 1)[0].id);
  a.spells = got;
  addLog(state, {
    kind: 'effect',
    text: `${josa(shortName(a.name), '은', '는')} 알던 주문을 잊고${got.length ? ` ${got.map((id) => spellDef(world, id)!.name).join(', ')}${josa(spellDef(world, got.at(-1)!)!.name, '을', '를').slice(-1)} 떠올렸다` : ' 아무것도 떠올리지 못했다'}.`,
    regions: [a.region],
    actors: [a.id],
  });
}

// Someone risen in play (an MTG token) from `from`, with its power/toughness: a new character
// who serves `master`.
function raiseToken(state: State, world: World, from: Actor, creature: string, faction: string | undefined, colors: Color[], master: string) {
  const kind = world.lore.find((l) => l.id === creature);
  const masterName = shortName(npcDef(state, world, master)?.name ?? master);
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
    creature,
    colors: [...colors],
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
    master,
  };
  addLog(state, {
    kind: 'event',
    text: `${josa(was, '이', '가')} ${kind?.name ?? creature}로 되살아났다 (${def.pt.join('/')}).`,
    regions: [from.region],
    actors: [id],
  });
}

// New creatures of a kind (MTG tokens) come into being in `regionId` with no master: beasts
// that don't talk and keep to that land. Returns them.
export function spawnWild(state: State, world: World, creature: string, pt: [number, number], count: number, regionId: string, colors: Color[]) {
  const kind = world.lore.find((l) => l.id === creature);
  const kindName = kind?.name ?? creature;
  const out: Actor[] = [];
  for (let i = 0; i < count; i++) {
    const id = `tok-${state.nextLogId}-${i}`;
    state.tokens ??= {};
    state.tokens[id] = {
      id,
      name: kindName,
      summary: kind?.summary ?? kindName,
      role: `${region(world, regionId).name}의 ${kindName}`,
      home: regionId,
      persona: `말을 하지 않는 ${kindName}. ${kind?.summary ?? ''}`,
      goal: '제 땅을 지킨다.',
      pt: [...pt],
      abilities: [],
      needs: ['energy'],
      beast: true,
      creature,
      colors: [...colors],
    };
    state.actors[id] = {
      id,
      name: kindName,
      kind: 'npc',
      region: regionId,
      stats: { energy: 80, hunger: 0, coin: 0 },
      pt: [...pt],
      pace: 'normal',
      abilities: [],
      needs: ['energy'],
    };
    out.push(state.actors[id]);
  }
  return out;
}
