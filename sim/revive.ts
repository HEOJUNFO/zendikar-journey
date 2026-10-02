// Nissa's Chosen (`sim.revives_after`): "If this would be put into a graveyard from the battlefield,
// put it on the bottom of its owner's library instead." In this world (user decision 2026-10-02),
// it dies, but into no one's graveyard (none can raise it); N days on it wakes again where it
// lives, whole and serving no one, as a card drawn again from the library's bottom. A token is
// gone for good, as ever (sim/combat.ts `die`).
import { INITIAL_STATS } from './rules.ts';
import { addLog, npcDef } from './state.ts';
import type { State } from './state.ts';
import { josa, shortName } from './text.ts';
import { homeTile } from './tiles.ts';
import type { World } from './world.ts';

// Each hour: those of such a card mark it (for `die`), and those whose days are up wake at home.
export function reviveHour(state: State, world: World, t: number) {
  for (const a of Object.values(state.actors)) {
    const def = a.kind === 'npc' && !state.tokens?.[a.id] ? npcDef(state, world, a.id) : undefined;
    if (!def?.revivesAfter) continue;
    if (!a.dead) {
      a.revives = def.revivesAfter;
      continue;
    }
    if (a.left || a.reviveAt === undefined || a.reviveAt > t) continue;
    Object.assign(a, {
      dead: undefined,
      reviveAt: undefined,
      master: undefined,
      seized: undefined,
      region: def.home,
      tile: homeTile(world, def),
      life: 20,
      stats: { ...INITIAL_STATS },
      abilities: [...def.abilities],
      task: undefined,
      forced: undefined,
      travel: undefined,
      schedule: undefined,
    });
    for (const k of ['wounds', 'plusCounters', 'auras', 'boost', 'pumps', 'granted', 'warded', 'lost', 'foes', 'boundUntil'] as const) delete a[k];
    addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '이', '가')} 거처에서 다시 눈을 떴다. 쓰러졌던 그날의 일은 먼 기억처럼 희미하다.`, regions: [a.region], actors: [a.id], t });
  }
}

