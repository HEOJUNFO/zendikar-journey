// Guul Draz Vampire (`low_life_boost`) shares the scent: +P/+T and abilities while it holds.
// Bloodghast. "This creature has haste as long as an opponent has 10 or less life": recounted every
// hour, its foes of today (or its controller's) at that life or below (sim/step.ts). "Landfall —
// you may return this card from your graveyard to the battlefield": one lying dead in someone's
// creature graveyard (`fallen`) rises again at that one's side, theirs, whenever they bond with a
// land (always: it only helps, [가공]), as Emeria brings one back.
import { allyJoined } from './allies.ts';
import { foesOf } from './combat.ts';
import { lifeOf, loseLife } from './life.ts';
import { masterOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { addLog, alive, npcDef, ptOf } from './state.ts';
import { ABILITY_LABELS } from './world.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// Whether one of `a`'s foes of today (or its controller's) is at `n` life or below.
function onScent(state: State, a: Actor, n: number, t: number) {
  const controller = masterOf(state, a) ?? a;
  const foes = new Set([...foesOf(a, t), ...foesOf(controller, t)]);
  return [...foes].some((id) => state.actors[id] && !state.actors[id].dead && lifeOf(state.actors[id]) <= n);
}

// Guul Draz Vampire: "As long as an opponent has 10 or less life, this gets +2/+1 and has
// intimidate", the same scent recounted every hour.
function bloodBoostHour(state: State, world: World, a: Actor, t: number) {
  const b = npcDef(state, world, a.id)?.lowLifeBoost;
  if (!b) return;
  const scent = !powersSealed(state, world, a, t) && onScent(state, a, b.at, t);
  if (scent && !a.bloodBoost) {
    const added = b.abilities.filter((x) => !a.abilities.includes(x));
    a.abilities = [...a.abilities, ...added];
    a.bloodBoost = { pt: [b.pt[0], b.pt[1]], added };
    addLog(state, { kind: 'status', text: `${josa(shortName(a.name), '이', '가')} 피 냄새를 맡고 사나워졌다 (+${b.pt[0]}/+${b.pt[1]}${b.abilities.length ? `, ${b.abilities.map((x) => ABILITY_LABELS[x]).join('·')}` : ''}, ${ptOf(a).join('/')}).`, regions: [a.region], actors: [a.id], t });
  } else if (!scent && a.bloodBoost) {
    a.abilities = a.abilities.filter((x) => !a.bloodBoost!.added.includes(x));
    delete a.bloodBoost;
  }
}

// Haste on the scent of blood: given or taken away as the hour finds it.
export function bloodHasteHour(state: State, world: World, t: number) {
  for (const a of alive(state)) {
    bloodBoostHour(state, world, a, t);
    const n = npcDef(state, world, a.id)?.hasteLowLife;
    if (n === undefined) continue;
    const scent = onScent(state, a, n, t);
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

// Vampire Lacerator (`sim.upkeep_bleed`): "At the beginning of your upkeep, you lose 1 life unless
// an opponent has 10 or less life." At 00:00 whoever controls it (its master, or itself) loses that
// much, unless one of the foes of the day just ended was at that life or below then (the same
// scent). One who lets it bleed long enough dies of it, no one's doing.
export function upkeepBleed(state: State, world: World, t: number) {
  for (const a of alive(state)) {
    const b = npcDef(state, world, a.id)?.upkeepBleed;
    if (!b || powersSealed(state, world, a, t)) continue;
    if (onScent(state, a, b.unlessAt, t - 1)) continue;
    const controller = masterOf(state, a) ?? a;
    addLog(state, { kind: 'effect', text: `새벽 전, 피를 먹지 못한 ${josa(shortName(a.name), '이', '가')} 제 몸의 상처에서 피를 흘린다: ${josa(shortName(controller.name), '이', '가')} 생명 ${b.life}을 잃는다.`, regions: [a.region], actors: [a.id, controller.id], t });
    loseLife(state, controller, b.life, t, `${shortName(a.name)}의 상처`);
  }
}
