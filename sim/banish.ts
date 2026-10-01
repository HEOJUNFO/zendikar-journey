// "When this enters, exile target <color> permanent" (Devout Lightcaster, `sim.enter_exile`): on
// its first arrival of the day (sim/abilities.ts `onEnter`), its controller (master, or itself)
// picks one permanent of that color on its tile, an hour on (an NPC by the LLM, the player as a
// pick they owe); one there must be picked. A permanent (user decision 2026-10-01):
// - a being of that color (a card's color; one with none, the colors of their lands; the player
//   too; a planeswalker too): exiled, they are gone from the world (sim/erase.ts; the player's
//   life ends) if the player is in it (its controller, or the one exiled); between NPCs it is a
//   death instead (user decision 2026-10-01);
// - an aura of that color on someone there, an item of that color standing or carried there:
//   gone;
// - a land of that color someone there holds: their bond with it broken for good, never to be
//   made again (`Actor.exiledLands`).
import { die } from './combat.ts';
import { eraseFromWorld } from './erase.ts';
import { actorColors } from './mana.ts';
import type { Color } from './mana.ts';
import { masterOf } from './retainers.ts';
import { crushRelic, relicsHere } from './relics.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, present, targetable } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { creatureColors } from './mana.ts';
import { region, spellColors } from './world.ts';
import type { World } from './world.ts';

export type Banishable = { id: string; label: string };

// What `a` could exile on its tile now.
export function banishOptions(state: State, world: World, a: Actor, color: Color, t: number): Banishable[] {
  const own = creatureColors(npcDef(state, world, a.id));
  const here = present(state, a.region, a.tile).filter((x) => !x.dead && x.id !== a.id && targetable(x, t, own));
  const beings = here.filter((x) => actorColors(state, world, x).includes(color)).map((x) => ({ id: `being:${x.id}`, label: `${shortName(x.name)}${x.kind === 'player' ? ' (플레이어)' : ''}` }));
  const relics = relicsHere(state, world, a.region, a.tile).filter((r) => {
    const [kind, ...rest] = r.id.split(':');
    if (kind === 'item') return Object.keys(world.items.find((x) => x.id === rest[0])?.cost.colored ?? {}).includes(color);
    const s = world.spells.find((x) => x.id === rest[2]);
    return !!s && spellColors(s).includes(color);
  });
  const lands = here.flatMap((x) =>
    (x.bonds ?? [])
      .filter((id) => (world.regions.find((r) => r.id === id)?.color ?? '').split('/').includes(color))
      .map((id) => ({ id: `land:${x.id}:${id}`, label: `${shortName(x.name)}이(가) 쥔 ${region(world, id).name}` })),
  );
  return [...beings, ...relics, ...lands];
}

export function enterExile(state: State, world: World, a: Actor, t: number) {
  const ex = npcDef(state, world, a.id)?.enterExile;
  if (!ex || a.dead || powersSealed(state, world, a, t)) return;
  const options = banishOptions(state, world, a, ex.color, t);
  if (!options.length) return;
  const controller = masterOf(state, a) ?? a;
  (state.choices ??= []).push({ by: controller.id, land: a.region, effect: { type: 'exile', source: a.id }, candidates: options.map((o) => o.id), t });
}

// The pick lands (if it is still there to take).
export function applyExile(state: State, world: World, source: Actor, pick: string, t: number) {
  const ex = npcDef(state, world, source.id)?.enterExile;
  if (!ex || source.dead || !banishOptions(state, world, source, ex.color, t).some((o) => o.id === pick)) return false;
  const [kind, ...rest] = pick.split(':');
  const by = shortName(source.name);
  if (kind === 'being') {
    const x = state.actors[rest[0]];
    // Between NPCs, a death (the body and the memories stay; user decision 2026-10-01, as a fight
    // between them ends in a knockout); with the player in it, gone from the world.
    const controller = masterOf(state, source) ?? source;
    if (controller.kind !== 'player' && x.kind !== 'player') {
      addLog(state, { kind: 'event', text: `${by}의 빛이 ${josa(shortName(x.name), '을', '를')} 감싸 태워 버렸다.`, regions: [x.region], actors: [source.id, x.id], t });
      die(state, x, t, `${by}의 빛에 추방됨`, source);
      return true;
    }
    addLog(state, { kind: 'event', text: `${by}의 빛이 ${josa(shortName(x.name), '을', '를')} 감싸, 세상에서 지워 버렸다.`, regions: [x.region], actors: [source.id, x.id], t });
    die(state, x, t, `${by}의 빛에 추방됨`);
    if (x.kind !== 'player') eraseFromWorld(state, x.id);
    return true;
  }
  if (kind === 'land') {
    const [whoId, landId] = rest;
    const x = state.actors[whoId];
    x.bonds = (x.bonds ?? []).filter((b) => b !== landId);
    x.exiledLands = [...new Set([...(x.exiledLands ?? []), landId])];
    addLog(state, { kind: 'event', text: `${by}의 빛이 ${shortName(x.name)}과(와) ${region(world, landId).name} 사이를 끊었다. 다시는 이어지지 않는다.`, regions: [x.region], actors: [source.id, x.id], t });
    return true;
  }
  addLog(state, { kind: 'event', text: `${by}의 빛이 그림자를 몰아낸다.`, regions: [source.region], actors: [source.id], t });
  return crushRelic(state, world, pick, source, t);
}
