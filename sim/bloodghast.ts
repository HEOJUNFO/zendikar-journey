// Bloodghast. "This creature has haste as long as an opponent has 10 or less life": recounted every
// hour, its foes of today (or its controller's) at that life or below (sim/step.ts). "Landfall —
// you may return this card from your graveyard to the battlefield": one lying dead in someone's
// creature graveyard (`fallen`) rises again at that one's side, theirs, whenever they bond with a
// land (always: it only helps, [가공]), as Emeria brings one back.
import { allyJoined } from './allies.ts';
import { foesOf } from './combat.ts';
import { lifeOf } from './life.ts';
import { masterOf } from './retainers.ts';
import { addLog, alive, npcDef } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// Haste on the scent of blood: given or taken away as the hour finds it.
export function bloodHasteHour(state: State, world: World, t: number) {
  for (const a of alive(state)) {
    const n = npcDef(state, world, a.id)?.hasteLowLife;
    if (n === undefined) continue;
    const controller = masterOf(state, a) ?? a;
    const foes = new Set([...foesOf(a, t), ...foesOf(controller, t)]);
    const scent = [...foes].some((id) => state.actors[id] && !state.actors[id].dead && lifeOf(state.actors[id]) <= n);
    if (scent && !a.bloodHaste && !a.abilities.includes('haste')) {
      a.abilities = [...a.abilities, 'haste'];
      a.bloodHaste = true;
      addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} 피 냄새를 맡고 날래졌다 (속공).`, regions: [a.region], actors: [a.id], t });
    } else if (!scent && a.bloodHaste) {
      a.abilities = a.abilities.filter((x) => x !== 'haste');
      delete a.bloodHaste;
    }
  }
}

// `holder` bonded with a land: what of theirs lies dead in their graveyard and rises on landfall
// comes back at their side.
export function landfallReturn(state: State, world: World, holder: Actor, t: number) {
  for (const id of [...(holder.fallen ?? [])]) {
    const back = state.actors[id];
    if (!back?.dead || back.left || !npcDef(state, world, id)?.landfallReturn) continue;
    delete back.dead;
    Object.assign(back, { region: holder.region, tile: holder.tile, master: holder.id, travel: undefined, task: undefined, forced: undefined, wounds: undefined, schedule: undefined, plusCounters: undefined, enteredAt: t });
    holder.fallen = holder.fallen!.filter((x) => x !== id);
    allyJoined(state, world, back, holder, t);
    addLog(state, { kind: 'event', text: `${shortName(holder.name)}이(가) 땅과 이어지자, 무덤에서 ${josa(shortName(back.name), '이', '가')} 피를 흩날리며 되살아나 그 곁에 섰다.`, regions: [holder.region], actors: [back.id, holder.id], t });
  }
}
