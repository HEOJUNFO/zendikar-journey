// Tempest Owl (`sim.enter_tap_many`): "Kicker {4}{U}. When this enters, if it was kicked, tap up to
// three target permanents." On its first arrival of the day (sim/abilities.ts `onEnter`), its
// controller (its master, or itself) may pay the kicker from their own mana (user decision
// 2026-10-02: the master pays) and pick, one at a time, up to that many on its tile: a being there
// (bound until midnight) or a land someone there holds (no mana from it for them today). The
// kicker is paid as the first is picked. An NPC's picks are the LLM's (sim/run.ts), the player's
// picks they owe (sim/asks.ts).
import { gameDay, untapTime } from './clock.ts';
import { manaAvailable, payMana, planPayment } from './mana.ts';
import { masterOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, present, targetable } from './state.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { region } from './world.ts';
import type { World } from './world.ts';

export type GustEffect = { type: 'gust'; source: string; left: number; paid: boolean };

// What could be tapped there: beings not bound yet (not the owl), lands those there hold.
export function gustOptions(state: State, world: World, owl: Actor, t: number) {
  const here = present(state, owl.region, owl.tile);
  const beings = here.filter((x) => x.id !== owl.id && x.boundUntil === undefined && targetable(x, t, ['U'])).map((x) => ({ id: `being:${x.id}`, label: `${shortName(x.name)} (자정까지 묶임)` }));
  const day = gameDay(t);
  const lands = here.flatMap((x) =>
    (x.bonds ?? [])
      .filter((id) => world.regions.some((r) => r.id === id) && !(x.landsTapped?.day === day && x.landsTapped.ids.includes(id)))
      .map((id) => ({ id: `land:${x.id}:${id}`, label: `${shortName(x.name)}의 ${region(world, id).name} (오늘 마나를 못 씀)` })),
  );
  return [...beings, ...lands];
}

// Arriving: its controller may tap up to N there, if they can pay.
export function enterTapMany(state: State, world: World, owl: Actor, t: number) {
  const e = npcDef(state, world, owl.id)?.enterTapMany;
  if (!e || owl.dead || powersSealed(state, world, owl, t)) return;
  const c = masterOf(state, owl) ?? owl;
  if (c.dead || !planPayment(manaAvailable(state, world, c, t), e.kicker)) return;
  const owed = gustOwed(state, world, c, { type: 'gust', source: owl.id, left: e.count, paid: false }, t);
  if (owed) (state.choices ??= []).push(owed);
}

export function gustOwed(state: State, world: World, by: Actor, eff: GustEffect, t: number): Choice | null {
  const owl = state.actors[eff.source];
  if (!owl || owl.dead || eff.left <= 0) return null;
  const options = gustOptions(state, world, owl, t);
  if (!options.length) return null;
  return { by: by.id, land: owl.region, effect: eff, candidates: options.map((o) => o.id), optional: true, t };
}

// The pick lands (none: they stop). Returns the next pick, if any.
export function applyGust(state: State, world: World, by: Actor, eff: GustEffect, pick: string | null, t: number): Choice | null {
  const owl = state.actors[eff.source];
  const e = owl && npcDef(state, world, owl.id)?.enterTapMany;
  if (!owl || !e || !pick || !gustOptions(state, world, owl, t).some((o) => o.id === pick)) return null;
  if (!eff.paid) {
    if (!payMana(state, world, by, e.kicker, t)) return null;
    addLog(state, { kind: 'event', text: `${josa(shortName(owl.name), '이', '가')} ${e.kickerText}의 힘을 받아 날개로 폭풍을 일으킨다.`, regions: [owl.region], actors: [owl.id, by.id], t });
  }
  const [kind, a, b] = pick.split(':');
  if (kind === 'being') {
    const x = state.actors[a];
    x.boundUntil = untapTime(t);
    x.task = undefined;
    addLog(state, { kind: 'effect', text: `${josa(shortName(x.name), '이', '가')} 폭풍에 휘말려 자정까지 꼼짝 못 한다.`, regions: [x.region], actors: [x.id, owl.id], t });
  } else {
    const x = state.actors[a];
    const day = gameDay(t);
    if (x.landsTapped?.day !== day) x.landsTapped = { day, ids: [] };
    x.landsTapped.ids.push(b);
    addLog(state, { kind: 'effect', text: `폭풍이 ${shortName(x.name)}와 ${region(world, b).name}의 이음을 흩어 놓았다: 오늘은 그 땅의 마나를 쓸 수 없다.`, regions: [owl.region], actors: [x.id, owl.id], t });
  }
  return gustOwed(state, world, by, { ...eff, left: eff.left - 1, paid: true }, t);
}
