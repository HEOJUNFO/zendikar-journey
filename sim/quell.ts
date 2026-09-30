// "At the beginning of your upkeep, you may choose a card type. If you do, each player
// sacrifices a permanent of their choice of that type" (World Queller, `sim.quell`). At 00:00
// its controller (its master, or itself) may name a type (an NPC by the LLM, `llm.pick`; the
// player as a pick they owe); then everyone standing with it (itself and its controller too,
// "each player" = those there) gives up one of theirs of that type, their own pick:
// - a land: the bond with one land they hold is broken (as a fetch land's sacrifice);
// - a creature: one they control dies (their retainers, themselves if a creature card's
//   character: not the player, not planeswalkers; sim/monument.ts `controlledCreatures`);
// - an artifact: an item they own is gone;
// - an enchantment: an aura on them is gone, and what it gave.
import { die } from './combat.ts';
import { controlledCreatures } from './monument.ts';
import { masterOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, alive, npcDef, outOfTime, present } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { region } from './world.ts';
import type { World } from './world.ts';

export const QUELL_KINDS = ['land', 'creature', 'artifact', 'enchantment'] as const;
export type QuellKind = (typeof QUELL_KINDS)[number];
export const QUELL_LABELS: Record<QuellKind, string> = { land: '땅', creature: '생물', artifact: '마법물체', enchantment: '부여마법' };

export type Permanent = { id: string; label: string };

// What `a` has of `kind` to give up.
export function permanentsOf(state: State, world: World, a: Actor, kind: QuellKind): Permanent[] {
  if (kind === 'land') return [...new Set(a.bonds ?? [])].map((id) => ({ id: `land:${id}`, label: `${region(world, id).name}과의 유대` }));
  if (kind === 'creature') return controlledCreatures(state, world, a).map((x) => ({ id: `creature:${x.id}`, label: x.id === a.id ? `${shortName(x.name)} (자신)` : shortName(x.name) }));
  if (kind === 'artifact')
    return world.items
      .filter((x) => state.items?.[x.id]?.owner === a.id && !state.items[x.id].gone)
      .map((x) => ({ id: `item:${x.id}`, label: x.name }));
  return (a.auras ?? []).map((au, i) => ({ id: `aura:${i}:${au.spell}`, label: `${au.name} (오라)` }));
}

// The upkeep (00:00): each queller's controller may name a type (after the hour).
export function upkeepQuell(state: State, world: World, t: number) {
  for (const a of alive(state)) {
    if (!npcDef(state, world, a.id)?.quell || a.travel || outOfTime(state, a, t) || powersSealed(state, world, a, t)) continue;
    const controller = masterOf(state, a) ?? a;
    (state.choices ??= []).push({ by: controller.id, land: a.region, effect: { type: 'quell', source: a.id }, candidates: [...QUELL_KINDS], optional: true, t });
  }
}

// The type is named: everyone there gives up one of theirs. One with a single one gives it; one
// with several picks (after the hour); one with none gives nothing.
export function applyQuell(state: State, world: World, source: Actor, kind: QuellKind, t: number) {
  if (source.dead) return;
  const here = present(state, source.region, source.tile);
  addLog(state, {
    kind: 'event',
    text: `${josa(shortName(source.name), '이', '가')} 땅을 울리며 몸을 일으키자, 곁의 모두가 저마다 ${QUELL_LABELS[kind]} 하나를 내놓아야 한다.`,
    regions: [source.region],
    actors: [source.id, ...here.map((x) => x.id)],
    t,
  });
  for (const x of here) {
    const owned = permanentsOf(state, world, x, kind);
    if (owned.length === 1) quellGive(state, world, x, owned[0].id, source, t);
    // The player picks at once (a pick they owe); an NPC, by the LLM, after the hour.
    else if (owned.length > 1) (x.kind === 'player' ? (state.asks ??= []) : (state.choices ??= [])).push(quellOwed(x, kind, source, owned, t));
  }
}

export function quellOwed(x: Actor, kind: QuellKind, source: Actor, owned: Permanent[], t: number): Choice {
  return { by: x.id, land: x.region, effect: { type: 'quelled', kind, source: source.id }, candidates: owned.map((p) => p.id), t };
}

// `x` gives up `id` (a permanent of theirs, as permanentsOf names it), if it is still theirs.
export function quellGive(state: State, world: World, x: Actor, id: string, source: Actor, t: number) {
  const [kind, ...rest] = id.split(':');
  const cause = `${shortName(source.name)}에게 바쳐짐`;
  const name = shortName(x.name);
  if (kind === 'land') {
    if (!(x.bonds ?? []).includes(rest[0])) return;
    x.bonds = (x.bonds ?? []).filter((b) => b !== rest[0]);
    addLog(state, { kind: 'effect', text: `${josa(name, '이', '가')} ${region(world, rest[0]).name}과의 유대를 내놓았다 (${cause}).`, regions: [x.region], actors: [x.id], t });
  } else if (kind === 'creature') {
    const c = state.actors[rest[0]];
    if (!c || c.dead) return;
    addLog(state, { kind: 'event', text: `${josa(name, '이', '가')} ${c.id === x.id ? '제 몸을' : `${josa(shortName(c.name), '을', '를')}`} 내놓았다.`, regions: [x.region], actors: [x.id, c.id], t });
    die(state, c, t, cause);
  } else if (kind === 'item') {
    const def = world.items.find((y) => y.id === rest[0]);
    const s = state.items?.[rest[0]];
    if (!def || !s || s.owner !== x.id || s.gone) return;
    state.items![def.id] = { ...s, owner: undefined, gone: true };
    addLog(state, { kind: 'event', text: `${josa(name, '이', '가')} ${josa(def.name, '을', '를')} 내놓았다. ${josa(def.name, '은', '는')} 무너져 사라졌다 (${cause}).`, regions: [x.region, def.at], actors: [x.id], t });
  } else if (kind === 'aura') {
    const auras = x.auras ?? [];
    const [index, spell] = rest;
    const i = auras[Number(index)]?.spell === spell ? Number(index) : auras.findIndex((au) => au.spell === spell);
    if (i < 0) return;
    const [gone] = auras.splice(i, 1);
    x.auras = auras;
    if (gone.added?.length) x.abilities = x.abilities.filter((ab) => !gone.added!.includes(ab));
    addLog(state, { kind: 'effect', text: `${josa(name, '이', '가')} 몸에 걸린 ${josa(gone.name, '을', '를')} 내놓았다 (${cause}).`, regions: [x.region], actors: [x.id], t });
  }
}
