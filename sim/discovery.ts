// Grim Discovery (spell effect `grim_discovery`): "Choose one or both — return target creature card
// from your graveyard to your hand; return target land card from your graveyard to your hand." In
// this world (user decision 2026-10-01): after casting, the caster may pick one of their creature
// graveyard (`fallen`): it comes back to life at its home, free (no one's retainer: it must be won
// over again, there being no hand to cast it from); and/or one of their land graveyard (a land they
// once bonded with and hold no longer, `Actor.everBonded`; not one exiled): it becomes a land in
// their hand (`Actor.handLands`), to bond with from afar as their land for the day. One or both;
// each pick may be let be: an NPC's by the LLM (sim/run.ts), the player's picks they owe.
import { addLog, npcDef } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { homeTile } from './tiles.ts';
import { placeName, region } from './world.ts';
import type { World } from './world.ts';

export type DiscoveryKind = 'creature' | 'land';

// The dead in `a`'s creature graveyard who could rise (not erased, not tokens).
export function graveCreatures(state: State, a: Actor) {
  return (a.fallen ?? []).map((id) => state.actors[id]).filter((x): x is Actor => !!x && !!x.dead && !x.left && !state.tokens?.[x.id]);
}

// The lands in `a`'s land graveyard: once theirs, held no longer, not exiled, not in hand already.
export function graveLands(world: World, a: Actor) {
  return [...new Set(a.everBonded ?? [])].filter((id) => world.regions.some((r) => r.id === id) && !a.bonds?.includes(id) && !a.exiledLands?.includes(id) && !a.handLands?.includes(id));
}

export function discoveryOptions(state: State, world: World, a: Actor, kind: DiscoveryKind) {
  return kind === 'creature'
    ? graveCreatures(state, a).map((x) => ({ id: x.id, label: `${shortName(x.name)} (무덤의 생물)` }))
    : graveLands(world, a).map((id) => ({ id, label: `${placeName(world, region(world, id))} (무덤의 땅)` }));
}

// The picks the caster owes, one per kind with anything to pick.
export function discoveryOwed(state: State, world: World, a: Actor, spell: string, t: number): Choice[] {
  return (['creature', 'land'] as const)
    .map((kind) => ({ kind, options: discoveryOptions(state, world, a, kind) }))
    .filter((x) => x.options.length)
    .map(({ kind, options }) => ({ by: a.id, land: a.region, effect: { type: 'discovery', spell, kind }, candidates: options.map((o) => o.id), optional: true, t }));
}

export function applyDiscovery(state: State, world: World, a: Actor, kind: DiscoveryKind, pick: string | null, spell: string, t: number) {
  if (!pick || !discoveryOptions(state, world, a, kind).some((o) => o.id === pick)) return;
  if (kind === 'land') {
    a.handLands = [...(a.handLands ?? []), pick];
    addLog(state, { kind: 'status', text: `${spell}: ${josa(shortName(a.name), '이', '가')} 잃었던 ${region(world, pick).name}로 가는 길을 다시 손에 쥐었다 (언제든 멀리서 이을 수 있다).`, regions: [a.region], actors: [a.id], t });
    return;
  }
  const x = state.actors[pick];
  const def = npcDef(state, world, x.id);
  delete x.dead;
  Object.assign(x, { master: undefined, seized: undefined, travel: undefined, task: undefined, forced: undefined, wounds: undefined, schedule: undefined, plusCounters: undefined, auras: undefined, enteredAt: t });
  if (def && 'home' in def) Object.assign(x, { region: def.home, tile: homeTile(world, def) });
  a.fallen = (a.fallen ?? []).filter((id) => id !== x.id);
  addLog(state, { kind: 'event', text: `${spell}: ${josa(shortName(a.name), '이', '가')} 폐허에서 찾은 것으로 ${josa(shortName(x.name), '을', '를')} 되살렸다. ${josa(shortName(x.name), '은', '는')} 제 거처에서 눈을 떴다 (누구도 섬기지 않는다).`, regions: [x.region, a.region], actors: [x.id, a.id], t });
}
