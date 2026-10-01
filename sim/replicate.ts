// "Create a token that's a copy of target creature" (Rite of Replication): a likeness drawn up
// out of water at the caster's side, who serves them (user decision 2026-10-01). It copies what
// is printed on the original: their name, base power/toughness, keywords, powers (landfall, enter,
// activated), colors, mana and needs; one who speaks speaks, with their persona and goal. Not what
// befell them: counters, auras, today's boosts, damage, memories, spells, bonds, a graveyard. A
// token's "exile it at end of turn" is no part of it (a delayed trigger in MTG): a copy of Elemental
// Appeal's elemental stays. Anyone but a planeswalker may be copied, the player too: one with no
// card is copied by their body (base power/toughness, own keywords, the colors of their lands).
// Tokens go to no graveyard; a copy's enter powers wake as it enters, under its new master.
import { onEnter } from './abilities.ts';
import { actorColors } from './mana.ts';
import { bindRetainer } from './retainers.ts';
import { addLog, npcDef, PLAYER_PT, ptOf } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import type { NpcDef, World } from './world.ts';

// Whether `b` can be copied: any being but a planeswalker.
export function copyable(b: Actor) {
  return !b.dead && b.loyalty === undefined;
}

// The card a copy of `b` is made from.
function likeness(state: State, world: World, b: Actor): Omit<NpcDef, 'id' | 'role' | 'home'> {
  const def = npcDef(state, world, b.id);
  if (def) {
    const { vanishAt: _v, homePos: _h, loyalty: _l, knowsColors: _k, id: _i, role: _r, home: _o, ...card } = structuredClone(def);
    return card;
  }
  // One with no card (the player): their body as it is by nature, without what auras gave.
  const given = new Set((b.auras ?? []).flatMap((x) => x.added ?? []));
  return {
    name: b.name,
    summary: b.name,
    persona: b.background ?? `${josa(b.name, '을', '를')} 빼닮은 이.`,
    goal: '나를 빚은 이를 섬긴다.',
    pt: [...(b.pt ?? PLAYER_PT)],
    abilities: b.abilities.filter((x) => !given.has(x)),
    needs: [...(b.needs ?? ['energy', 'hunger', 'coin'])],
    colors: actorColors(state, world, b),
  };
}

// `n` copies of `b` at `a`'s side, `a`'s retainers. Returns them.
export function replicate(state: State, world: World, a: Actor, b: Actor, n: number, t: number, cause: string) {
  const card = likeness(state, world, b);
  const out: Actor[] = [];
  for (let i = 0; i < n; i++) {
    let id = `tok-${state.nextLogId}-copy-${i}`;
    for (let k = 2; state.actors[id]; k++) id = `tok-${state.nextLogId}-copy-${i}-${k}`;
    state.tokens ??= {};
    state.tokens[id] = {
      ...structuredClone(card),
      id,
      role: `${josa(shortName(a.name), '이', '가')} ${toward(cause)} 빚은 ${shortName(b.name)}의 분신`,
      home: a.region,
      persona: `${card.persona} (물로 빚어진 ${shortName(b.name)}의 분신이다. 원본의 몸과 힘, 성품을 그대로 지녔지만 원본이 겪은 일은 기억하지 못하고, 자신을 빚은 ${josa(shortName(a.name), '을', '를')} 섬긴다.)`,
      copyOf: b.id,
    };
    const x: Actor = {
      id,
      name: card.name,
      kind: 'npc',
      region: a.region,
      home: a.region,
      tile: a.tile,
      stats: { energy: 80, hunger: 0, coin: 0 },
      pt: [...card.pt],
      pace: 'normal',
      abilities: [...card.abilities],
      needs: [...card.needs],
      enteredAt: t,
      ...(card.protection?.length ? { protection: [...card.protection] } : {}),
    };
    state.actors[id] = x;
    out.push(x);
  }
  addLog(state, {
    kind: 'event',
    text: `${josa(shortName(a.name), '이', '가')} ${toward(cause)} 물에서 ${shortName(b.name)}의 분신 ${n === 1 ? '하나를' : `${n}명을`} 빚었다 (${ptOf(out[0]).join('/')}, 권속).`,
    regions: [a.region],
    actors: [a.id, b.id, ...out.map((x) => x.id)],
    t,
  });
  for (const x of out) {
    bindRetainer(state, world, x, a, t, cause);
    onEnter(state, world, x, t);
  }
  return out;
}
