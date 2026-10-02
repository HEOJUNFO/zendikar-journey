// "Return target permanent you control to its owner's hand. You gain 4 life" (Narrow Escape).
// In this world (user decision 2026-10-01), after casting, the caster picks one of what they
// control: themselves or a retainer on their tile, a land they hold, an item of theirs, or an aura
// they cast on someone on their tile. One must be picked: an NPC's by the LLM (sim/run.ts), the
// player's a pick they owe (sim/asks.ts).
// - A being slips away: it leaves play and comes back (all that was on it falls away, as
//   Whiplash Trap's, sim/bounce.ts `shed`), today's foes are foes no more, and it lands, awake, in
//   another area of its region. Back in its controller's own hand it stays theirs; one held by
//   force (seized) goes back to its owner, itself. A token has no hand: it is gone.
// - A land: the bond is let go, to be made again (a landfall anew).
// - An item: it stays its owner's, but what was on it falls away (counters, the one it was
//   fastened to).
// - An aura: it leaves the one it was on, and the caster may cast it again (not used).
// "Return target nonland permanent to its owner's hand" (Into the Roil, `any`): the same, but of
// anyone's on the caster's tile, no land: a being of theirs or anyone's there (not shrouded nor
// protected from blue), an item someone owns there, an aura on anyone there. A being not theirs
// is flung by the roil as Whiplash Trap flings (user decision 2026-10-02, sim/bounce.ts): all on
// it falls away, it goes free of whoever controlled it, lands in another area, stunned an hour; a
// planeswalker comes back with its loyalty anew. An aura's caster may cast it again.
import { addLog, npcDef, outOfTime, present, targetable } from './state.ts';
import { masterOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import type { Actor, Choice, State } from './state.ts';
import { bounce, landing, shed, vanishToken } from './bounce.ts';
import { itemDef, itemWhere, unequip } from './items.ts';
import { remember } from './relations.ts';
import { controlledCreatures } from './retainers.ts';
import { josa, shortName, toward } from './text.ts';
import { nearestTile, sameTile, tileCenter } from './tiles.ts';
import { placeName, region } from './world.ts';
import type { World } from './world.ts';

export type EscapeOption = { id: string; label: string };

// What `a` could return: beings (themselves, retainers on their tile), lands they hold, items of
// theirs, auras they cast on those on their tile. `any` (Into the Roil): no land, but anyone's
// there (beings it can pick, items someone owns, auras whoever cast them).
export function escapeOptions(state: State, world: World, a: Actor, any = false): EscapeOption[] {
  const t = state.minutes;
  const mine = controlledCreatures(state, world, a);
  const own = mine
    .filter((x) => x.id === a.id || (x.region === a.region && sameTile(x.tile, a.tile) && !x.travel && !outOfTime(state, x)))
    .filter((x) => !any || targetable(x, t, ['U']))
    .map((x) => ({ id: `being:${x.id}`, label: x.id === a.id ? `${shortName(x.name)} 자신 (몸을 빼 달아남)` : `${shortName(x.name)} (권속, 몸을 빼 달아남)` }));
  const others = any
    ? present(state, a.region, a.tile)
        .filter((x) => x.id !== a.id && !mine.includes(x) && targetable(x, t, ['U']))
        .map((x) => ({ id: `being:${x.id}`, label: `${shortName(x.name)} (물살에 내동댕이침)` }))
    : [];
  const lands = any ? [] : (a.bonds ?? []).filter((id) => world.regions.some((r) => r.id === id)).map((id) => ({ id: `land:${id}`, label: `${placeName(world, region(world, id))} (유대를 거둠)` }));
  const items = Object.entries(state.items ?? {})
    .filter(([id, s]) => !s.gone && (any ? !!s.owner && here(state, world, a, id) : s.owner === a.id))
    .map(([id, s]) => ({ id: `item:${id}`, label: s.owner === a.id ? `${itemDef(world, id)?.name ?? s.name} (아이템)` : `${itemDef(world, id)?.name ?? s.name} (${shortName(state.actors[s.owner!]?.name ?? '')}의 아이템)` }));
  const auras = Object.values(state.actors)
    .filter((x) => !x.dead && x.region === a.region && sameTile(x.tile, a.tile))
    .flatMap((x) => (x.auras ?? []).map((au, i) => ({ au, i, x })).filter(({ au }) => any || au.by === a.id))
    .map(({ au, i, x }) => ({ id: `aura:${x.id}:${i}`, label: au.by === a.id ? `${shortName(x.name)}에게 건 ${au.name} (오라)` : `${shortName(x.name)}에게 걸린 ${au.name} (오라)` }));
  return [...own, ...others, ...lands, ...items, ...auras];
}

// Whether item `id` is on `a`'s tile (standing, lying or carried there).
function here(state: State, world: World, a: Actor, id: string) {
  const def = itemDef(world, id);
  const w = def && itemWhere(state, world, def);
  return !!w && w.region === a.region && sameTile(w.tile, a.tile);
}

export function escapeOwed(state: State, world: World, a: Actor, spell: string, t: number, any = false): Choice | null {
  const options = escapeOptions(state, world, a, any);
  if (!options.length) return null;
  return { by: a.id, land: a.region, effect: any ? { type: 'escape', spell, any } : { type: 'escape', spell }, candidates: options.map((o) => o.id), t };
}

// Returns the picked one, if it is still to be had.
export function applyEscape(state: State, world: World, a: Actor, pick: string, spell: string, t: number, any = false) {
  if (!escapeOptions(state, world, a, any).some((o) => o.id === pick)) return false;
  const [kind, id, idx] = pick.split(':');
  if (kind === 'being' && !controlledCreatures(state, world, a).some((x) => x.id === id)) {
    // Anyone else's: flung by the roil, off the field (no one's foe of today, nor they anyone's).
    const x = state.actors[id];
    delete x.foes;
    for (const y of Object.values(state.actors)) if (y.foes?.ids.includes(x.id)) y.foes = { ...y.foes, ids: y.foes.ids.filter((f) => f !== x.id), struck: y.foes.struck?.filter((f) => f !== x.id) };
    const loyalty = npcDef(state, world, x.id)?.loyalty;
    if (x.loyalty !== undefined && loyalty !== undefined) x.loyalty = loyalty;
    if (!state.tokens?.[x.id]) remember(x, a, `${spell}(으)로 나를 물살에 휩쓸어 내동댕이쳤다`, t);
    bounce(state, world, x, t, spell);
  } else if (kind === 'being') {
    const x = state.actors[id];
    const name = shortName(x.name);
    if (state.tokens?.[x.id]) {
      vanishToken(state, x, t, spell, '손을 거쳐 돌아갈 곳이 없어 흔적도 없이 사라졌다.');
      return true;
    }
    shed(state, world, x, spell, !x.seized);
    // Off the field: no one's foe of today, nor they anyone's.
    delete x.foes;
    for (const y of Object.values(state.actors)) if (y.foes?.ids.includes(x.id)) y.foes = { ...y.foes, ids: y.foes.ids.filter((f) => f !== x.id), struck: y.foes.struck?.filter((f) => f !== x.id) };
    const to = landing(state, world, x);
    if (to) Object.assign(x, { region: to.id, tile: nearestTile(world, to.id, x.tile && tileCenter(x.tile)) });
    Object.assign(x, { travel: undefined, task: undefined, forced: undefined });
    addLog(state, { kind: 'event', text: `${spell}: ${josa(name, '이', '가')} 아슬아슬하게 몸을 빼${to ? ` ${toward(to.name)}` : ''} 달아났다. 몸에 붙었던 힘이 모두 떨어져 나가고, 그날의 싸움에서 벗어났다.`, regions: [x.region, a.region], actors: [x.id, a.id], t });
  } else if (kind === 'land') {
    a.bonds = (a.bonds ?? []).filter((b) => b !== id);
    addLog(state, { kind: 'status', text: `${spell}: ${josa(shortName(a.name), '이', '가')} ${josa(region(world, id).name, '과', '와')}의 유대를 거두어들였다 (다시 맺을 수 있다).`, regions: [a.region, id], actors: [a.id], t });
  } else if (kind === 'item') {
    const s = state.items![id];
    unequip(state, id);
    s.counters = 0;
    const owner = state.actors[s.owner!];
    const whose = owner && owner.id !== a.id ? `${shortName(owner.name)}의 ` : '';
    addLog(state, { kind: 'status', text: `${spell}: ${josa(shortName(a.name), '이', '가')} ${whose}${josa(itemDef(world, id)?.name ?? s.name, '을', '를')} ${whose ? '주인의 손으로 되돌렸다' : '거두었다가 다시 내놓았다'}. 쌓였던 것이 모두 흩어졌다.`, regions: [a.region], actors: [a.id, ...(whose ? [owner.id] : [])], t });
  } else {
    const x = state.actors[id];
    const au = x.auras![Number(idx)];
    x.auras = x.auras!.filter((_, i) => i !== Number(idx));
    if (!x.auras.length) delete x.auras;
    if (au.added?.length) x.abilities = x.abilities.filter((ab) => !au.added!.includes(ab));
    const caster = state.actors[au.by];
    if (caster?.used) delete caster.used[au.spell];
    const whose = caster && caster.id !== a.id ? caster : undefined;
    addLog(state, { kind: 'status', text: whose ? `${spell}: ${josa(shortName(a.name), '이', '가')} ${shortName(x.name)}에게 걸린 ${josa(au.name, '을', '를')} 걷어 냈다. ${josa(shortName(whose.name), '은', '는')} 그것을 다시 걸 수 있다.` : `${spell}: ${josa(shortName(a.name), '이', '가')} ${shortName(x.name)}에게 건 ${josa(au.name, '을', '를')} 거두어들였다. 다시 걸 수 있다.`, regions: [a.region], actors: [a.id, x.id], t });
  }
  return true;
}

// Kor Skyfisher (`sim.enter_return`): "When this enters, return a permanent you control to its
// owner's hand." On its first arrival of the day (sim/abilities.ts `onEnter`), its controller
// (master, or itself) must return one of what they control, as Narrow Escape's pick (user decision
// 2026-10-02: as the card, every day; the skyfisher itself may be the one).
export function enterReturn(state: State, world: World, a: Actor, t: number) {
  if (!npcDef(state, world, a.id)?.enterReturn || a.dead || powersSealed(state, world, a, t)) return;
  const owed = escapeOwed(state, world, masterOf(state, a) ?? a, shortName(a.name), t);
  if (owed) (state.choices ??= []).push(owed);
}
