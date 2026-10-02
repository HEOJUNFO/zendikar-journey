// Explorer's Scope (equipment, `equip.attack_reveal`): "Whenever equipped creature attacks, look at
// the top card of your library. If it's a land card, you may put it onto the battlefield tapped."
// The first time each day its bearer falls on someone (sim/combat.ts `onAttack`), the top of its
// owner's library shows: always a land, one of the world at random, as an oracle's (user decision
// 2026-10-02). One they don't hold yet, nor lost for good, nor broken, they bond with from afar,
// tapped (no mana from it today; not their land for the day); always, it only helps. One they
// hold already is nothing.
import { gameDay } from './clock.ts';
import { bondLand } from './abilities.ts';
import { addLog, random } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName, toward } from './text.ts';
import { landIdOf, region } from './world.ts';
import type { World } from './world.ts';

export function scopeOnAttack(state: State, world: World, a: Actor, t: number) {
  for (const x of world.items) {
    const s = state.items?.[x.id];
    if (!x.equip?.attackReveal || !s || s.gone || s.bearer !== a.id || !s.owner) continue;
    const owner = state.actors[s.owner];
    if (!owner || owner.dead) continue;
    const lands = [...new Set(world.regions.filter((r) => !r.notLand && !r.wanders).map((r) => landIdOf(world, r.id)))];
    if (!lands.length) continue;
    const land = lands[Math.floor(random(state) * lands.length)];
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
