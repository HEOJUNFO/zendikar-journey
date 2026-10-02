// Explorer's Scope (equipment, `equip.attack_reveal`): "Whenever equipped creature attacks, look at
// the top card of your library. If it's a land card, you may put it onto the battlefield tapped."
// The first time each day its bearer falls on someone (sim/combat.ts `onAttack`), the top of its
// owner's library shows: always a land, one of the world at random, as an oracle's (user decision
// 2026-10-02). One they don't hold yet, nor lost for good, nor broken, they bond with from afar,
// tapped (no mana from it today; not their land for the day); always, it only helps. One they
// hold already is nothing.
import { gameDay } from './clock.ts';
import { bondLand } from './abilities.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, random } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import { landIdOf, region } from './world.ts';
import type { World } from './world.ts';

// The top of someone's library: always a land, one of the world at random (user decision 2026-10-02).
function topOfLibrary(state: State, world: World) {
  const lands = [...new Set(world.regions.filter((r) => !r.notLand && !r.wanders).map((r) => landIdOf(world, r.id)))];
  return lands.length ? lands[Math.floor(random(state) * lands.length)] : undefined;
}

// Goblin Guide (`sim.attack_gift`): "Whenever this attacks, defending player reveals the top card
// of their library. If it's a land card, that player puts it into their hand." The first time each
// day it falls on someone, the top of their library shows; one they don't hold, nor have in hand,
// nor lost for good, comes into their hand (`Actor.handLands`, sim/oracle.ts).
export function guideOnAttack(state: State, world: World, a: Actor, defender: Actor, t: number) {
  if (!npcDef(state, world, a.id)?.attackGift || powersSealed(state, world, a, t) || defender.dead) return;
  const land = topOfLibrary(state, world);
  if (!land) return;
  const name = region(world, land).name;
  const why = defender.bonds?.includes(land) ? '이미 이어진 땅이다' : defender.handLands?.includes(land) ? '이미 손에 든 땅이다' : defender.exiledLands?.includes(land) ? '영영 잃은 땅이다' : null;
  if (why) {
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} 덤벼들며 떠벌렸다: "${name} 가 봤어?" ${shortName(defender.name)}에게는 ${why}.`, regions: [a.region], actors: [a.id, defender.id], t });
    return;
  }
  defender.handLands = [...(defender.handLands ?? []), land];
  addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} 덤벼들며 떠벌리다 ${shortName(defender.name)}에게 ${toward(name)} 가는 길을 흘렸다 (손에 든 땅: 언제든 멀리서 그날의 땅으로 이을 수 있다).`, regions: [a.region], actors: [a.id, defender.id], t });
}

export function scopeOnAttack(state: State, world: World, a: Actor, t: number) {
  for (const x of world.items) {
    const s = state.items?.[x.id];
    if (!x.equip?.attackReveal || !s || s.gone || s.bearer !== a.id || !s.owner) continue;
    const owner = state.actors[s.owner];
    if (!owner || owner.dead) continue;
    const land = topOfLibrary(state, world);
    if (!land) continue;
    const name = region(world, land).name;
    const why = owner.bonds?.includes(land) ? '이미 이어진 땅이다' : owner.exiledLands?.includes(land) ? '영영 잃은 땅이다' : state.regions[land]?.destroyed ? '부서진 땅이다' : null;
    if (why) {
      addLog(state, { kind: 'status', text: `${x.name}: ${josa(shortName(a.name), '이', '가')} 덤벼들며 먼 곳을 살폈다. ${josa(name, '이', '가')} 보였지만 ${why}.`, regions: [a.region], actors: [a.id, owner.id], t });
      continue;
    }
    addLog(state, { kind: 'status', text: `${x.name}: ${josa(shortName(a.name), '이', '가')} 덤벼들며 먼 곳을 살폈다. ${josa(shortName(owner.name), '이', '가')} ${toward(name)} 멀리서 이어졌다 (탭된 채, 오늘은 마나 없음).`, regions: [a.region, land], actors: [a.id, owner.id], t });
    owner.fetched = [...(owner.fetched ?? []), land];
    bondLand(state, world, owner, t, land);
    const day = gameDay(t);
    if (owner.landsTapped?.day !== day) owner.landsTapped = { day, ids: [] };
    owner.landsTapped.ids.push(land);
  }
}
