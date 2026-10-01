// Landfall (bonding with a land) and activated abilities, used as the morning LLM plans.
import { enterExile } from './banish.ts';
import { gameDay, untapTime } from './clock.ts';
import { addFoe, dealDamage, destroy, leavePlane } from './combat.ts';
import { creatureColors, manaAvailable, payMana, planPayment } from './mana.ts';
import { landTapBlocked, tapLand } from './landtap.ts';
import type { Color } from './mana.ts';
import { itemsOnLandfall } from './items.ts';
import { enterShatter } from './relics.ts';
import { blazeLand } from './blaze.ts';
import { extraLandDrops, topBlocked, topLand } from './oracle.ts';
import { gainLife, lifeOf, loseLife, setLife } from './life.ts';
import { allyJoined } from './allies.ts';
import { bindRetainer, controlledCreatures, masterOf, releaseRetainer, retainersOf } from './retainers.ts';
import { DEPLETED_LABEL } from './rules.ts';
import { castSpell, spellDef } from './spells.ts';
import { drawKnowledge } from './knowledge.ts';
import { owesDiscard } from './discard.ts';
import { landSealed, powersSealed, sealText } from './seal.ts';
import { eraseFromWorld } from './erase.ts';
import { addLog, buryCount, hasAbility, npcDef, outOfTime, present, ptOf, random, targetable, together, untargetableText } from './state.ts';
import { nearestTile } from './tiles.ts';
import type { Tile } from './tiles.ts';
import type { Actor, Choice, ChoiceEffect, State } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import { ABILITY_LABELS, CREATURE_TYPE_LABELS, LAND_TYPE_LABELS, landIdOf, landTypes, realmOf, region, spellColors } from './world.ts';
import type { Ability, ActivatedAbility, BondEffect, LandType, Region, World } from './world.ts';

// Why `a` can't bond with the land they stand on now, or null. One land per turn, as one
// land drop per turn in MTG.
export function bondBlocked(state: State, world: World, a: Actor, t: number): string | null {
  // Where they stand may be one land with another place: that land is the one.
  const r = region(world, landIdOf(world, a.region));
  if (r.notLand) return `${josa(r.name, '은', '는')} 땅이 아니라 유대를 맺을 수 없다.`;
  if (a.bonds?.includes(r.id)) return `이미 ${josa(r.name, '과', '와')} 유대를 맺었다.`;
  if (a.exiledLands?.includes(r.id)) return `${josa(r.name, '과', '와')}의 유대는 빛에 추방되어 다시는 맺을 수 없다.`;
  if (state.regions[r.id]?.destroyed) return '부서진 땅과는 유대를 맺을 수 없다.';
  if (npcDef(state, world, a.id)?.beast && state.regions[r.id]?.conditions.some((c) => c.label === DEPLETED_LABEL))
    return '사냥감이 바닥난 땅이다.';
  return landDropBlocked(state, world, a, t);
}

// Whether `a` has a land for the day left: one, and one more for each oracle they control
// (sim/oracle.ts). A land sought out with a fetch land isn't the day's land.
export function landDropBlocked(state: State, world: World, a: Actor, t: number): string | null {
  const max = 1 + extraLandDrops(state, world, a, t);
  if (a.landfalls?.day === gameDay(t) && a.landfalls.regions.filter((id) => !a.fetched?.includes(id)).length >= max)
    return max > 1 ? `오늘은 이미 ${max} 땅과 유대를 맺었다.` : '오늘은 이미 한 땅과 유대를 맺었다. 땅은 하루에 하나.';
  return null;
}

// Landfall: the land comes under their control (the one they stand on, or one sought out from
// afar with a fetch land).
// A land's effect that falls on someone the bonder picks ("target player loses N life",
// "target creature gains flying"), if it has one.
export function targetedBondEffect(r: Region) {
  return r.onBond.find((x) => x.type !== 'gain_life');
}

// A land's colors (what it picks with).
export function landColorsOf(r: Region): string[] {
  return r.color ? r.color.split('/') : [];
}

// Whom it may fall on as `a` bonds with it: anyone standing with them (on their tile; a land
// fetched from afar: anyone on it), beasts too (user decision 2026-09-30); `a` too when it is
// a gift ("target creature" may be one's own), not when it takes life ("target player", as
// one's opponent).
export function bondTargets(state: State, world: World, a: Actor, regionId: string, eff: BondEffect) {
  const colors = landColorsOf(region(world, regionId));
  return present(state, regionId, regionId === a.region ? a.tile : null).filter((x) => (x.id !== a.id || eff.type !== 'lose_life') && targetable(x, state.minutes, colors));
}

// The effect falls on `target`, if they are still there.
export function applyBondEffect(state: State, world: World, a: Actor, regionId: string, eff: Exclude<ChoiceEffect, { type: 'cast' | 'follow' | 'rally' | 'seize' | 'pledge' | 'evade' | 'discard' | 'pilfer' | 'pour' | 'demolish' | 'sacrifice' | 'destroy' | 'drain_grow' | 'crush' | 'quell' | 'quelled' | 'return_lands' | 'search' | 'tide' | 'bind' | 'engulf' | 'shatter' | 'counter' | 'counter_cast' | 'exile' | 'strike' }>, targetId: string | undefined, t: number) {
  const r = region(world, regionId);
  if (eff.type === 'damage') return mountainFire(state, world, a, r, eff.amount, targetId, t);
  const target = targetId ? bondTargets(state, world, a, regionId, eff).find((x) => x.id === targetId) : undefined;
  if (!target) {
    if (targetId) addLog(state, { kind: 'status', text: `${r.name}: 노린 이가 이미 곁에 없다.`, regions: [r.id], actors: [a.id], t });
    return;
  }
  if (eff.type === 'lose_life') {
    addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} ${josa(shortName(target.name), '을', '를')} ${r.name}에 내주었다.`, regions: [r.id], actors: [a.id, target.id], t });
    loseLife(state, target, eff.amount, t, r.name, a);
  } else if (eff.type === 'grant') grantAbility(state, target, eff.ability, untapTime(t), r.name, t);
  else if (eff.type === 'pump') {
    target.pumps = [...(target.pumps ?? []), { pt: [...eff.pt], until: untapTime(t) }];
    addLog(state, { kind: 'event', text: `${r.name}의 기운이 ${shortName(target.name)}에게 깃들었다 (${ptOf(target).join('/')}, 자정까지).`, regions: [r.id], actors: [a.id, target.id], t });
  }
}

// `x` has `ability` until `until` ("until end of turn": 00:00).
export function grantAbility(state: State, x: Actor, ability: Ability, until: number, cause: string, t: number) {
  const label = ABILITY_LABELS[ability];
  if (x.abilities.includes(ability) && !x.granted?.some((g) => g.ability === ability)) {
    addLog(state, { kind: 'status', text: `${josa(shortName(x.name), '은', '는')} 이미 ${josa(label, '이', '가')} 있다.`, regions: [x.region], actors: [x.id], t });
    return;
  }
  x.granted = [...(x.granted ?? []).filter((g) => g.ability !== ability), { ability, until }];
  if (!x.abilities.includes(ability)) x.abilities = [...x.abilities, ability];
  addLog(state, { kind: 'event', text: `${cause}의 바람이 ${shortName(x.name)}에게 ${josa(label, '을', '를')} 주었다 (자정까지).`, regions: [x.region], actors: [x.id], t });
}

// What was given for a while (abilities, +N/+N) is gone at `t`.
export function expireGranted(state: State, t: number) {
  for (const x of Object.values(state.actors)) {
    if (x.pumps?.some((b) => b.until <= t)) {
      x.pumps = x.pumps.filter((b) => b.until > t);
      if (!x.dead) addLog(state, { kind: 'status', text: `${shortName(x.name)}에게 깃든 기운이 가라앉았다 (${ptOf(x).join('/')}).`, regions: [x.region], actors: [x.id], t });
    }
    const gone = (x.granted ?? []).filter((g) => g.until <= t);
    if (!gone.length) continue;
    x.granted = x.granted!.filter((g) => g.until > t);
    x.abilities = x.abilities.filter((ab) => !gone.some((g) => g.ability === ab));
    if (!x.dead)
      addLog(state, { kind: 'status', text: `${shortName(x.name)}의 ${gone.map((g) => ABILITY_LABELS[g.ability]).join(', ')}이(가) 사라졌다.`, regions: [x.region], actors: [x.id], t });
  }
}

// --- Valakut: "Whenever a Mountain enters under your control, if you control at least five
// other Mountains, you may have this land deal 3 damage to any target" ---

// Whom the fire may reach: anyone in the Valakut's realm (its continent, that continent's areas
// and islands, and theirs: Valakut stands on Beyeen, an island of Ondu; user decision
// 2026-09-30), not on the road, not out of time, not the one who calls it.
export function fireTargets(state: State, world: World, a: Actor, land: Region) {
  const lands = realmOf(world, land.id);
  return Object.values(state.actors).filter((x) => !x.dead && !x.travel && x.id !== a.id && lands.includes(x.region) && !outOfTime(state, x) && targetable(x, state.minutes, landColorsOf(land)));
}

// The lands like Valakut that answer as `a` bonds with `mountainId`: held, standing, and with
// enough other mountains held.
export function firesOnBond(state: State, world: World, a: Actor, mountainId: string) {
  const mountain = world.regions.find((r) => r.id === mountainId);
  if (!mountain || !landTypes(mountain).includes('mountain')) return [];
  const held = (a.bonds ?? []).map((id) => world.regions.find((r) => r.id === id)).filter((r) => r && !state.regions[r.id]?.destroyed) as Region[];
  const others = held.filter((r) => r.id !== mountainId && landTypes(r).includes('mountain')).length;
  return held.filter((r) => r.mountainFire && others >= r.mountainFire.others);
}

function mountainFire(state: State, world: World, a: Actor, land: Region, amount: number, targetId: string | undefined, t: number) {
  if (!targetId) return; // "you may": they let it be
  const target = fireTargets(state, world, a, land).find((x) => x.id === targetId);
  if (!target) {
    addLog(state, { kind: 'status', text: `${land.name}: 노린 이가 이미 닿지 않는 곳에 있다.`, regions: [land.id], actors: [a.id], t });
    return;
  }
  addLog(state, {
    kind: 'event',
    text: `${land.name}에서 불길이 치솟아 ${shortName(target.name)}에게 떨어졌다 (${shortName(a.name)}의 부름).`,
    regions: [land.id, target.region],
    actors: [a.id, target.id],
    t,
  });
  dealDamage(state, target, amount, t, land.name, false, a);
}

// `target`: whom the player picked for a land's targeted effect, or (a mountain, with Valakut
// ready) for its fire. An NPC's pick is asked of the LLM after the hour (state.choices).
export function bondLand(state: State, world: World, a: Actor, t: number, regionId = a.region, target?: string) {
  const r = region(world, landIdOf(world, regionId));
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
  // A color of theirs sealed against them (Iona): their landfall does nothing.
  const lf = powersSealed(state, world, a, t) ? undefined : def;
  // "Landfall — … gets +N/+N (and trample) until end of turn."
  if (lf?.landfall) {
    a.boost = { until: untapTime(t), pt: [...lf.landfall.pt], trample: lf.landfall.trample };
    addLog(state, {
      kind: 'status',
      text: `${shortName(a.name)}의 힘이 치솟았다 (${ptOf(a).join('/')}${lf.landfall.trample ? ', 돌진' : ''}, 자정까지).`,
      regions: [r.id],
      actors: [a.id],
      t,
    });
  }
  // "Landfall — this loses defender until end of turn".
  for (const ability of lf?.landfallLose ?? []) {
    if (!a.abilities.includes(ability)) continue;
    a.lost = [...(a.lost ?? []).filter((x) => x.until > t && x.ability !== ability), { ability, until: untapTime(t) }];
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} ${josa(ABILITY_LABELS[ability], '을', '를')} 잃었다 (자정까지).`, regions: [a.region], actors: [a.id], t });
  }
  // "Landfall — this gains flying until end of turn".
  for (const ability of lf?.landfallGrant ?? []) grantAbility(state, a, ability, untapTime(t), '땅에서 솟구친 열기', t);
  // "Landfall — you may gain N life": its controller gains it.
  if (lf?.landfallLife) gainLife(state, masterOf(state, a) ?? a, lf.landfallLife, t, `${shortName(a.name)}의 상륙`);
  // "Landfall — gain control of target creature": whom (if anyone) is theirs to pick, after the hour.
  if (lf?.landfallSeize) {
    const candidates = present(state, a.region, a.tile).filter((x) => x.id !== a.id && x.master !== a.id && targetable(x, t, creatureColors(def))).map((x) => x.id);
    if (candidates.length) (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'seize' }, candidates, optional: true, t });
  }
  // "Landfall — you may have target player lose N life; if you do, N +1/+1 counters on this."
  if (lf?.landfallDrain) {
    const colors = creatureColors(def);
    const candidates = present(state, a.region, a.tile).filter((x) => x.id !== a.id && targetable(x, t, colors)).map((x) => x.id);
    if (candidates.length) (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'drain_grow', ...lf.landfallDrain }, candidates, optional: true, t });
  }
  // "Landfall — create a token": one more of their kind, born at their side and theirs.
  if (lf?.landfallToken) {
    const tok = lf.landfallToken;
    const [born] = spawnWild(state, world, tok.creature, tok.pt, 1, a.region, tok.colors, a.tile, tok.abilities ?? []);
    born.master = a.id;
    addLog(state, {
      kind: 'event',
      text: `땅이 성나자 ${shortName(a.name)} 곁에 ${josa(shortName(born.name), '이', '가')} 새로 났다 (${tok.pt.join('/')}).`,
      regions: [a.region],
      actors: [a.id, born.id],
      t,
    });
  }
  // The land's own: "enters tapped", "When this land enters, you gain N life".
  if (r.entersTapped)
    addLog(state, { kind: 'status', text: `${josa(r.name, '은', '는')} 탭된 채 들어왔다. 오늘은 마나를 내지 않는다.`, regions: [r.id], actors: [a.id], t });
  // The land's color sealed against them: it gives them its mana, nothing else.
  for (const eff of landSealed(state, a, r, t) ? [] : r.onBond) {
    if (eff.type === 'gain_life') {
      gainLife(state, a, eff.amount, t, r.name);
      continue;
    }
    const targets = bondTargets(state, world, a, r.id, eff);
    if (a.kind === 'player' || !targets.length) applyBondEffect(state, world, a, r.id, eff, target, t);
    else (state.choices ??= []).push({ by: a.id, land: r.id, effect: eff, candidates: targets.map((x) => x.id), t });
  }
  // A mountain in: a Valakut they hold may answer (the count is of the mountains held before).
  for (const v of firesOnBond(state, world, a, r.id).filter((x) => !landSealed(state, a, x, t))) {
    const targets = fireTargets(state, world, a, v);
    if (!targets.length) continue;
    addLog(state, { kind: 'status', text: `${shortName(a.name)}의 산들이 모여 ${josa(v.name, '이', '가')} 끓어오른다.`, regions: [v.id], actors: [a.id], t });
    const eff = { type: 'damage' as const, amount: v.mountainFire!.damage };
    if (a.kind === 'player') applyBondEffect(state, world, a, v.id, eff, target, t);
    else (state.choices ??= []).push({ by: a.id, land: v.id, effect: eff, candidates: targets.map((x) => x.id), optional: true, t });
  }
  itemsOnLandfall(state, world, a, t);
}

// Giving up a fetch land takes an hour, from wherever they are.
export const FETCH_HOURS = 1;

// Lands `a` could seek out with the fetch land `fromId`: of its types, not held, not destroyed.
export function fetchTargets(state: State, world: World, a: Actor, fromId: string) {
  const from = world.regions.find((r) => r.id === fromId);
  if (!from?.fetch) return [];
  return world.regions.filter(
    (r) => r.id !== from.id && !r.oneLandWith && !a.bonds?.includes(r.id) && !a.exiledLands?.includes(r.id) && !state.regions[r.id]?.destroyed && landTypes(r).some((x) => from.fetch!.types.includes(x)),
  );
}

// Why `a` can't give up `fromId` to seek out `toId` now, or null.
export function fetchBlocked(state: State, world: World, a: Actor, fromId: string, toId: string): string | null {
  const from = world.regions.find((r) => r.id === fromId);
  if (!from?.fetch) return '그런 땅은 없다.';
  if (!a.bonds?.includes(from.id)) return `${josa(from.name, '과', '와')} 유대를 맺고 있어야 한다.`;
  const rs = state.regions[from.id];
  if (rs?.destroyed || rs?.conditions.some((c) => c.tapped)) return `${josa(from.name, '은', '는')} 지금 쓸 수 없다.`;
  // No one pays the last of their life ([가공]).
  const life = lifeOf(a);
  if (from.fetch.life && life <= from.fetch.life) return `생명이 모자라다 (생명 ${life}).`;
  if (!fetchTargets(state, world, a, from.id).some((r) => r.id === toId))
    return `${from.fetch.types.map((x) => LAND_TYPE_LABELS[x]).join('이나 ')} 가운데 아직 유대가 없는 땅이어야 한다.`;
  return null;
}

// For an NPC's `fetch` block: a fetch land they hold that can seek out `toId` now, or why none can.
export function fetchSource(state: State, world: World, a: Actor, toId: string | undefined): { from: Region } | { top: true } | { why: string } {
  // The land on top of their library (Oracle of Mul Daya): no fetch land needed.
  if (toId && topLand(state, a, state.minutes) === landIdOf(world, toId) && !topBlocked(state, world, a, toId, state.minutes, (t) => landDropBlocked(state, world, a, t))) return { top: true };
  const held = (a.bonds ?? []).map((id) => world.regions.find((r) => r.id === id)).filter((r) => r?.fetch) as Region[];
  if (!held.length) return { why: '내어 줄 길 찾기 땅이 없다.' };
  if (!toId) return { why: '찾을 땅을 정하지 않았다.' };
  const from = held.find((r) => !fetchBlocked(state, world, a, r.id, toId));
  return from ? { from } : { why: fetchBlocked(state, world, a, held[0].id, toId)! };
}

// "{T}, Pay N life, Sacrifice this land: Search your library for a <type> card, put it onto
// the battlefield": they lose N life and their bond with the fetch land, and bond with the
// land sought from wherever they are. Not their land for the day: a landfall of its own.
export function fetchLand(state: State, world: World, a: Actor, fromId: string, toId: string, t: number, target?: string) {
  if (fromId === TOP) return bondFromTop(state, world, a, toId, t, target);
  const why = fetchBlocked(state, world, a, fromId, toId);
  if (why) {
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} 길을 찾지 못했다: ${why}`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const from = region(world, fromId);
  if (from.fetch!.life) loseLife(state, a, from.fetch!.life, t, from.name, a);
  a.bonds = a.bonds!.filter((id) => id !== from.id);
  addLog(state, {
    kind: 'status',
    text: `${josa(shortName(a.name), '이', '가')} ${josa(from.name, '을', '를')} 내어 주고 ${toward(region(world, toId).name)} 이어지는 길을 찾았다.`,
    regions: [a.region, toId],
    actors: [a.id],
    t,
  });
  a.fetched = [...(a.fetched ?? []), toId];
  a.searched = gameDay(t);
  bondLand(state, world, a, t, toId, target);
}

// The source of a bond from the top of the library (Oracle of Mul Daya), as a fetch's `from`.
export const TOP = 'top';

// They bond from afar with the land on top of their library: their land for the day.
export function bondFromTop(state: State, world: World, a: Actor, toId: string, t: number, target?: string) {
  const why = topBlocked(state, world, a, toId, t, (u) => landDropBlocked(state, world, a, u));
  if (why) {
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '은', '는')} 드러난 땅과 이어지지 못했다: ${why}`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const land = landIdOf(world, toId);
  addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} 앞날에 비친 ${toward(region(world, land).name)} 멀리서 이어졌다.`, regions: [a.region, land], actors: [a.id], t });
  a.topLand = undefined;
  bondLand(state, world, a, t, land, target);
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
    const land = held.find((r) => r!.upkeepRevive && plains >= r!.upkeepRevive.plains && !landSealed(state, holder, r!, t));
    const back = [...(holder.fallen ?? [])].reverse().map((id) => state.actors[id]).find((x) => x?.dead && !x.left);
    if (!land || !back) continue;
    delete back.dead;
    // Back from the graveyard: a new object, counters gone, and it entered this turn.
    Object.assign(back, {
      region: holder.region,
      tile: holder.tile,
      master: holder.id,
      travel: undefined,
      task: undefined,
      forced: undefined,
      wounds: undefined,
      schedule: undefined,
      plusCounters: undefined,
      enteredAt: t,
    });
    holder.fallen = holder.fallen!.filter((id) => id !== back.id);
    // Back under their control: an Ally rejoining wakes the party's rallies.
    allyJoined(state, world, back, holder, t);
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
  const sealer = powersSealed(state, world, bs, t);
  if (sealer) return `${sealText(sealer, t)} ${josa(name, '은', '는')} 그 힘을 쓸 수 없다.`;
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
  const own = creatureColors(being);
  if (target && !targetable(target, t, own)) return untargetableText(target, t, own);
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
      if (destroy(state, target, t, cause, bs)) died = true;
    } else if (eff.type === 'raise' && died && target) {
      raiseToken(state, world, target, eff.creature, eff.faction, eff.colors, being.id);
    } else if (eff.type === 'discard_spell') {
      const gone = discardSpell(state, world, bs, t);
      if (gone && spellColors(gone).includes(eff.if_color) && target) dealDamage(state, target, eff.damage, t, cause, false, bs);
    } else if (eff.type === 'wheel') {
      for (const x of present(state, bs.region, bs.tile)) wheel(state, world, x, eff.draw, t, cause);
    } else if (eff.type === 'damage' && target) {
      if (dealDamage(state, target, eff.amount, t, cause, false, bs)) died = true;
    } else if (eff.type === 'gain_life') {
      gainLife(state, bs, eff.amount, t, cause);
    } else if (eff.type === 'set_life' && target) {
      setLife(state, target, eff.amount, t, cause, bs);
    } else if (eff.type === 'possess_next_turn' && target) {
      const from = untapTime(t);
      (state.possessions ??= []).push({ target: target.id, by: bs.id, from, until: from + 1440 });
      addLog(state, { kind: 'event', text: `${shortName(target.name)}의 내일은 ${name}의 것이 되었다.`, regions: [bs.region, target.region], actors: [bs.id, target.id], t });
    } else if (eff.type === 'create_token') {
      const [born] = spawnWild(state, world, eff.creature, eff.pt, 1, bs.region, eff.colors, bs.tile);
      if (eff.types.length) state.tokens![born.id].types = [...eff.types];
      born.master = bs.id;
      addLog(state, { kind: 'event', text: `${name}의 부름에 ${josa(shortName(born.name), '이', '가')} 곁에 나타났다 (${eff.pt.join('/')}).`, regions: [bs.region], actors: [bs.id, born.id], t });
    } else if (eff.type === 'gain_life_per') {
      const n = controlledCreatures(state, world, bs).filter((x) => (npcDef(state, world, x.id)?.types ?? []).includes(eff.kind)).length;
      if (n) gainLife(state, bs, eff.amount * n, t, `${cause} (${CREATURE_TYPE_LABELS[eff.kind]} ${n})`);
      else addLog(state, { kind: 'effect', text: `${josa(name, '은', '는')} 거느린 ${CREATURE_TYPE_LABELS[eff.kind]}가 없다.`, regions: [bs.region], actors: [bs.id], t });
    } else if (eff.type === 'call_kind') {
      const called = Object.values(state.actors).filter(
        (x) => !x.dead && x.id !== bs.id && x.kind === 'npc' && !x.master && !outOfTime(state, x, t) && npcDef(state, world, x.id)?.loyalty === undefined && (npcDef(state, world, x.id)?.types ?? []).includes(eff.kind),
      );
      for (const x of called) {
        x.region = bs.region;
        x.tile = bs.tile;
        x.travel = undefined;
        x.task = undefined;
        x.forced = undefined;
        bindRetainer(state, world, x, bs, t, cause);
      }
      addLog(state, {
        kind: 'event',
        text: called.length ? `${name}의 부름에 ${josa(called.map((x) => shortName(x.name)).join(', '), '이', '가')} 세계 곳곳에서 곁으로 모여들었다.` : `${name}의 부름에 답할 ${CREATURE_TYPE_LABELS[eff.kind]}가 없었다.`,
        regions: [bs.region],
        actors: [bs.id, ...called.map((x) => x.id)],
        t,
        scope: 'world',
      });
    } else if (eff.type === 'blaze_land' && target) {
      blazeLand(state, world, bs, target, t);
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
  buryCount(a, 1, t);
  const s = spellDef(world, id);
  addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '이', '가')} ${josa(s?.name ?? id, '을', '를')} 불살라 날렸다.`, regions: [a.region], actors: [a.id], t });
  return s;
}

// Let go of every spell held (discard the hand), then draw `draw`: come to know that many
// secrets of the world (sim/knowledge.ts).
function wheel(state: State, world: World, a: Actor, draw: number, t: number, cause: string) {
  const had = a.spells ?? [];
  a.graveyard = [...(a.graveyard ?? []), ...had];
  buryCount(a, had.length, t);
  a.spells = [];
  if (had.length) addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '은', '는')} 알던 주문을 모두 잊었다.`, regions: [a.region], actors: [a.id], t });
  drawKnowledge(state, world, a, draw, t, cause);
}

// A token id no one has yet (two tokens made with no log line between would share the base).
function freeTokenId(state: State, base: string) {
  let id = base;
  for (let n = 2; state.actors[id]; n++) id = `${base}-${n}`;
  return id;
}

// Someone risen in play (an MTG token) from `from`, with its power/toughness: a new character
// who serves `master`.
function raiseToken(state: State, world: World, from: Actor, creature: string, faction: string | undefined, colors: Color[], master: string) {
  const kind = world.lore.find((l) => l.id === creature);
  const masterName = shortName(npcDef(state, world, master)?.name ?? master);
  const factionName = faction ? world.lore.find((l) => l.id === faction)?.name : undefined;
  const id = freeTokenId(state, `tok-${state.nextLogId}`);
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
    tile: from.tile,
    stats: { energy: 80, hunger: 0, coin: 0 },
    pt: [...def.pt],
    pace: 'normal',
    abilities: [],
    needs: ['energy'],
    master,
    enteredAt: state.minutes,
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
export function spawnWild(state: State, world: World, creature: string, pt: [number, number], count: number, regionId: string, colors: Color[], tile?: Tile, abilities: Ability[] = []) {
  const kind = world.lore.find((l) => l.id === creature);
  const kindName = kind?.name ?? creature;
  // A kind that lives in the world as its own card lives by its needs (a baloth hunts when
  // hungry); others only tire.
  const needs = world.npcs.find((n) => n.id === creature)?.needs ?? ['energy'];
  const out: Actor[] = [];
  for (let i = 0; i < count; i++) {
    const id = freeTokenId(state, `tok-${state.nextLogId}-${i}`);
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
      abilities: [...abilities],
      needs: [...needs],
      beast: true,
      creature,
      colors: [...colors],
    };
    state.actors[id] = {
      id,
      name: kindName,
      kind: 'npc',
      region: regionId,
      tile: tile ?? nearestTile(world, regionId),
      stats: { energy: 80, hunger: 0, coin: 0 },
      pt: [...pt],
      pace: 'normal',
      abilities: [...abilities],
      needs: [...needs],
      enteredAt: state.minutes,
    };
    out.push(state.actors[id]);
  }
  return out;
}

// Tokens whose time is up ("exile it at the beginning of the next end step"): gone, no trace.
export function upkeepFleeting(state: State, t: number) {
  for (const [id, def] of Object.entries(state.tokens ?? {})) {
    const a = state.actors[id];
    if (def.vanishAt === undefined || def.vanishAt > t || !a || a.dead) continue;
    a.dead = { at: t, cause: '사라짐' };
    a.left = true;
    for (const r of retainersOf(state, a.id)) releaseRetainer(state, r, `${shortName(a.name)}이(가) 사라짐`);
    a.task = undefined;
    a.forced = undefined;
    a.travel = undefined;
    addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} 흩어져 사라졌다.`, regions: [a.region], actors: [a.id], t });
    // "Exile it": erased from the world (sim/erase.ts, user decision 2026-10-01). A token has no
    // graveyard to fall back to, so not even an NPC's is spared (user decision 2026-10-01).
    eraseFromWorld(state, id);
  }
}

// --- Summoning Trap: "look at the top N cards of your library, put a creature onto the battlefield" ---

// The world's creature cards, as a library: the characters that came of a creature card (every
// card character but planeswalkers; not tokens), wherever they are, living, in time, not
// already in `regionId` and not among `but`; in a random order. Those of the sea too.
export function summonLibrary(state: State, world: World, regionId: string, but: string[] = []) {
  const ids = world.npcs
    .filter((n) => n.loyalty === undefined)
    .map((n) => state.actors[n.id])
    .filter((a) => a && !a.dead && !outOfTime(state, a) && a.region !== regionId && !but.includes(a.id))
    .map((a) => a.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

// `id` is drawn to `regionId` from wherever they were (not a new one: the one that is), and
// turns on those in `foes` for the rest of the day. One of the sea stands on land until they
// make their way back.
export function callForth(state: State, world: World, id: string, regionId: string, foes: string[], t: number, tile?: Tile) {
  const x = state.actors[id];
  if (!x || x.dead) return undefined;
  const from = x.travel ? '길 위' : region(world, x.region).name;
  delete x.travel;
  x.task = undefined;
  x.forced = undefined;
  x.region = regionId;
  x.tile = tile ?? nearestTile(world, regionId);
  addLog(state, {
    kind: 'event',
    text: `${josa(shortName(x.name), '이', '가')} ${from}에서 끌려와 문간의 어둠에서 걸어 나왔다 (${ptOf(x).join('/')}).`,
    regions: [regionId],
    actors: [id],
    t,
  });
  for (const f of foes) addFoe(x, f, t);
  onEnter(state, world, x, t);
  return x;
}

// Ob Nixilis's pick lands: the one picked, still there, loses the life; he grows for good.
export function applyDrainGrow(state: State, world: World, a: Actor, target: Actor, eff: { life: number; counters: number }, t: number) {
  if (a.dead || target.dead || !together(target, a) || !targetable(target, t, creatureColors(npcDef(state, world, a.id)))) return;
  addLog(state, {
    kind: 'event',
    text: `땅의 타락한 마나가 ${shortName(a.name)}에게 흘러든다. ${josa(shortName(target.name), '이', '가')} 생명 ${eff.life}을 빼앗겼다.`,
    regions: [a.region],
    actors: [a.id, target.id],
    t,
  });
  loseLife(state, target, eff.life, t, `${shortName(a.name)}의 상륙`, a);
  if (!target.dead) addFoe(target, a.id, t);
  a.plusCounters = (a.plusCounters ?? 0) + eff.counters;
  addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} 커졌다 (+1/+1 카운터 ${eff.counters}, ${ptOf(a).join('/')}).`, regions: [a.region], actors: [a.id], t });
}

// "When this enters, …": on their first arrival in a land each day (or being brought there),
// once a day for balance (user decision 2026-09-30).
export function onEnter(state: State, world: World, a: Actor, t: number) {
  const def = npcDef(state, world, a.id);
  if (!def?.enterDestroy && !def?.enterDrain && !def?.enterDraw && !def?.enterSearch && !def?.enterShatter && !def?.enterExile) return;
  if (a.dead || a.enteredDay === gameDay(t)) return;
  a.enteredDay = gameDay(t);
  enterDestroy(state, world, a, t);
  enterDrain(state, world, a, t);
  enterDraw(state, world, a, t);
  enterSearch(state, world, a, t);
  enterShatter(state, world, a, t);
  enterExile(state, world, a, t);
}

// "When this enters, you may search your library for a <type> card, put it onto the
// battlefield tapped" (Kor Cartographer): their controller (master, or themselves) may pick a
// land of that type they don't hold yet (the player at once, an NPC by the LLM after the hour).
export function enterSearch(state: State, world: World, a: Actor, t: number) {
  const search = npcDef(state, world, a.id)?.enterSearch;
  if (!search || a.dead || powersSealed(state, world, a, t)) return;
  const controller = masterOf(state, a) ?? a;
  const candidates = searchTargets(state, world, controller, search.types).map((r) => r.id);
  if (!candidates.length) return;
  const owed: Choice = { by: controller.id, land: controller.region, effect: { type: 'search', source: a.id }, candidates, optional: true, t };
  (controller.kind === 'player' ? (state.asks ??= []) : (state.choices ??= [])).push(owed);
}

// Lands of these types `a` doesn't hold yet, that can be sought (as fetchTargets).
export function searchTargets(state: State, world: World, a: Actor, types: readonly LandType[]) {
  return world.regions.filter((r) => !r.oneLandWith && !r.notLand && !a.bonds?.includes(r.id) && !a.exiledLands?.includes(r.id) && !state.regions[r.id]?.destroyed && landTypes(r).some((x) => types.includes(x)));
}

// The pick lands: they bond with it from afar, a landfall of its own (not their land for the
// day); tapped, it gives no mana today.
export function applySearch(state: State, world: World, a: Actor, landId: string, sourceId: string, t: number) {
  const source = state.actors[sourceId];
  const search = source && npcDef(state, world, source.id)?.enterSearch;
  if (!search || !searchTargets(state, world, a, search.types).some((r) => r.id === landId)) return;
  addLog(state, {
    kind: 'status',
    text: `${josa(shortName(source.name), '이', '가')} 잊힌 길을 더듬어 ${josa(shortName(a.name), '을', '를')} ${toward(region(world, landId).name)} 이었다.`,
    regions: [a.region, landId],
    actors: [a.id, source.id],
    t,
  });
  a.fetched = [...(a.fetched ?? []), landId];
  a.searched = gameDay(t);
  bondLand(state, world, a, t, landId);
  if (search.tapped) {
    const day = gameDay(t);
    if (a.landsTapped?.day !== day) a.landsTapped = { day, ids: [] };
    a.landsTapped.ids.push(landId);
  }
}

// "Kicker {1}{U}. When this enters, draw three cards. Then if it wasn't kicked, discard three
// cards" (Sphinx of Lost Truths). Their controller (master, or themselves) learns the secrets
// (sim/knowledge.ts); the kicker comes out of their own mana, paid if they can ([결정]
// 2026-09-30, as an NPC's spell kicker); unkicked, the controller lets go of that many spells.
export function enterDraw(state: State, world: World, a: Actor, t: number) {
  const draw = npcDef(state, world, a.id)?.enterDraw;
  if (!draw || a.dead || powersSealed(state, world, a, t)) return;
  const controller = masterOf(state, a) ?? a;
  const kicked = !!draw.kicker && !!planPayment(manaAvailable(state, world, a, t), draw.kicker);
  if (kicked) {
    payMana(state, world, a, draw.kicker!, t);
    addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '이', '가')} 힘(${draw.kickerText})을 더 들여, 되찾은 진실을 하나도 흘리지 않는다.`, regions: [a.region], actors: [a.id], t });
  }
  const cause = `${josa(shortName(a.name), '이', '가')} 들어설 때`;
  drawKnowledge(state, world, controller, draw.count, t, cause);
  if (!kicked && draw.discard) owesDiscard(state, world, controller, cause, t, draw.discard);
}

// "When this enters, each opponent loses life equal to the number of <kind>s you control. You
// gain life equal to the life lost this way" (Malakir Bloodwitch). Everyone standing there but
// their side (their controller and the controller's retainers) loses it and takes them for a
// foe; the controller gains it all.
export function enterDrain(state: State, world: World, a: Actor, t: number) {
  const drain = npcDef(state, world, a.id)?.enterDrain;
  if (!drain || a.dead || powersSealed(state, world, a, t)) return;
  const controller = masterOf(state, a) ?? a;
  const side = [controller, ...retainersOf(state, controller.id)];
  const n = side.filter((x) => !x.dead && npcDef(state, world, x.id)?.creature === drain.per).length;
  const victims = present(state, a.region, a.tile).filter((x) => !side.some((y) => y.id === x.id));
  if (!n || !victims.length) return;
  const cause = `${shortName(a.name)}의 흡혈`;
  addLog(state, {
    kind: 'event',
    text: `${josa(shortName(a.name), '이', '가')} 들어서자 피가 붉은 안개처럼 피어올라 곁의 모두에게서 생명 ${n}씩을 빨아들인다.`,
    regions: [a.region],
    actors: [a.id, ...victims.map((x) => x.id)],
    t,
  });
  for (const v of victims) {
    loseLife(state, v, n, t, cause, a);
    if (!v.dead) addFoe(v, a.id, t);
  }
  gainLife(state, controller, n * victims.length, t, cause);
}

// "When this enters, destroy target <type>" (Halo Hunter: an Angel). On their first arrival of
// the day (onEnter), whom of that type there (if anyone) to destroy is theirs to pick, after
// the hour (state.choices). "Kicker …. When this enters, if it was kicked, destroy target
// creature" (Heartstabber Mosquito): anyone there but a planeswalker (no creature), and only
// if they can pay the kicker from their own mana ([결정] 2026-10-01, as the Sphinx's).
export function enterDestroy(state: State, world: World, a: Actor, t: number) {
  const ed = npcDef(state, world, a.id)?.enterDestroy;
  if (!ed || a.dead || powersSealed(state, world, a, t)) return;
  if (ed.kicker && !planPayment(manaAvailable(state, world, a, t), ed.kicker)) return;
  const candidates = present(state, a.region, a.tile)
    .filter((x) => x.id !== a.id && (ed.kind ? (npcDef(state, world, x.id)?.types ?? []).includes(ed.kind) : npcDef(state, world, x.id)?.loyalty === undefined) && targetable(x, t, creatureColors(npcDef(state, world, a.id))))
    .map((x) => x.id);
  if (candidates.length) (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'destroy', kind: ed.kind, ...(ed.kickerText ? { kicker: ed.kickerText } : {}) }, candidates, optional: true, t });
}

// Their pick lands: the one picked, still there, is destroyed.
export function applyEnterDestroy(state: State, world: World, a: Actor, target: Actor, t: number) {
  if (a.dead || target.dead || !together(target, a) || !targetable(target, t, creatureColors(npcDef(state, world, a.id)))) return;
  const sealer = powersSealed(state, world, a, t);
  if (sealer) {
    addLog(state, { kind: 'effect', text: `${sealText(sealer, t)} ${josa(shortName(a.name), '은', '는')} 그 힘을 쓰지 못한다.`, regions: [a.region], actors: [a.id, sealer.id], t });
    return;
  }
  // The kicker, paid as the blow falls; spent meanwhile, no blow.
  const ed = npcDef(state, world, a.id)?.enterDestroy;
  if (ed?.kicker) {
    if (!planPayment(manaAvailable(state, world, a, t), ed.kicker)) {
      addLog(state, { kind: 'effect', text: `${josa(shortName(a.name), '은', '는')} 힘(${ed.kickerText})이 모자라 ${josa(shortName(target.name), '을', '를')} 꿰뚫지 못했다.`, regions: [a.region], actors: [a.id, target.id], t });
      return;
    }
    payMana(state, world, a, ed.kicker, t);
  }
  addLog(state, {
    kind: 'event',
    text: ed?.kicker
      ? `${josa(shortName(a.name), '이', '가')} 힘(${ed.kickerText})을 더 들여 들어서자마자 ${josa(shortName(target.name), '을', '를')} 꿰뚫어 파괴하려 한다.`
      : `${josa(shortName(a.name), '이', '가')} 들어서자마자 ${josa(shortName(target.name), '을', '를')} 덮쳐 파괴하려 한다.`,
    regions: [a.region],
    actors: [a.id, target.id],
    t,
  });
  destroy(state, target, t, `${shortName(a.name)}의 사냥`, a);
}

// --- Oran-Rief: "{T}: Put a +1/+1 counter on each green creature that entered this turn" ---

// The land they hold that does this, if any.
export function growLand(world: World, a: Actor) {
  return (a.bonds ?? []).map((id) => world.regions.find((r) => r.id === id)).find((r) => r?.growEntered);
}

// Creatures of `color` that came into play today (born, raised or brought back), whoever they
// serve. Those out of time are out of reach.
export function enteredToday(state: State, world: World, color: Color, t: number) {
  return Object.values(state.actors).filter(
    (x) =>
      !x.dead &&
      x.enteredAt !== undefined &&
      gameDay(x.enteredAt) === gameDay(t) &&
      creatureColors(npcDef(state, world, x.id)).includes(color) &&
      !outOfTime(state, x, t),
  );
}

export function growBlocked(state: State, world: World, a: Actor, landId: string, t: number): string | null {
  const r = world.regions.find((x) => x.id === landId);
  if (!r?.growEntered) return '그런 힘이 없는 땅이다.';
  const why = landTapBlocked(state, world, a, landId, t);
  if (why) return why;
  if (!enteredToday(state, world, r.growEntered.color, t).length) return `오늘 새로 나온 ${COLOR_WORDS[r.growEntered.color]} 생물이 없다.`;
  return null;
}
const COLOR_WORDS: Record<Color, string> = { W: '백색', U: '청색', B: '흑색', R: '적색', G: '녹색' };

export function growEntered(state: State, world: World, a: Actor, landId: string, t: number) {
  const why = growBlocked(state, world, a, landId, t);
  const name = shortName(a.name);
  if (why) {
    addLog(state, { kind: 'status', text: `${josa(name, '은', '는')} 땅의 힘을 쓰지 못했다: ${why}`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const r = region(world, landId);
  tapLand(a, r.id, t);
  const grown = enteredToday(state, world, r.growEntered!.color, t);
  for (const x of grown) x.plusCounters = (x.plusCounters ?? 0) + 1;
  addLog(state, {
    kind: 'event',
    text: `${josa(name, '이', '가')} ${r.name}의 힘을 불러냈다. 오늘 새로 난 ${grown.map((x) => `${shortName(x.name)}(${ptOf(x).join('/')})`).join(', ')}에게 숲의 기운이 깃들었다.`,
    regions: [a.region, ...new Set(grown.map((x) => x.region))],
    actors: [a.id, ...grown.map((x) => x.id)],
    t,
  });
}
