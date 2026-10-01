// Hellfire Mongrel (`sim.upkeep_burn`): "At the beginning of each opponent's upkeep, if that
// player has two or fewer cards in hand, this deals 2 damage to that player." An upkeep is
// 00:00, a hand the spells one holds (world/README.md). Each opponent is everyone on its tile
// but its side (whoever controls it, and their retainers: as Malakir Bloodwitch's "each
// opponent", user decision 2026-10-01): each of them holding that few spells or fewer takes the
// damage from it, as from a blow (between NPCs a knockout; user decision 2026-10-01, as
// Electropotence) and takes it for a foe for the day.
import { addFoe, dealDamage } from './combat.ts';
import { creatureColors } from './mana.ts';
import { remember } from './relations.ts';
import { masterOf, retainersOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, npcDef, outOfTime, present, protectedFrom } from './state.ts';
import type { State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

export function upkeepScorch(state: State, world: World, t: number) {
  for (const x of Object.values(state.actors)) {
    const def = npcDef(state, world, x.id);
    const burn = def?.upkeepBurn;
    if (!burn || x.dead || outOfTime(state, x, t) || powersSealed(state, world, x, t)) continue;
    const controller = masterOf(state, x) ?? x;
    const side = new Set([controller.id, x.id, ...retainersOf(state, controller.id).map((r) => r.id)]);
    const colors = creatureColors(def);
    const victims = present(state, x.region, x.tile).filter((y) => !side.has(y.id) && !y.dead && !outOfTime(state, y, t) && (y.spells?.length ?? 0) <= burn.maxHand && !protectedFrom(y, colors, t));
    for (const y of victims) {
      addLog(state, { kind: 'combat', text: `한밤, ${josa(shortName(x.name), '이', '가')} 쥔 것이 적은 ${shortName(y.name)}에게 불길을 토했다.`, regions: [x.region], actors: [x.id, y.id], t });
      const nonlethal = y.kind !== 'player' && controller.kind !== 'player';
      if (!dealDamage(state, world, y, burn.damage, t, `${shortName(x.name)}의 지옥불`, nonlethal, x, x) && !y.dead) {
        addFoe(y, x.id, t);
        remember(y, x, '한밤에 불길을 토해 나를 태웠다', t);
      }
    }
  }
}
