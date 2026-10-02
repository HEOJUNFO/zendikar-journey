// What the player character can do in one turn. Free text is turned into one of these by
// the LLM (sim/llm/interpret.ts); the UI buttons send them directly.
import { z } from 'zod';
import { STEP_MINUTES } from './clock.ts';
import { BOND_HOURS, KIND_EFFECTS } from './rules.ts';
import { addLog, awayText, isPerson, landUnusable, npcDef, outOfTime, player, together } from './state.ts';
import { HIRE_HOURS, hireBlocked, hirePrice } from './allies.ts';
import { masterOf } from './retainers.ts';
import type { State, Task } from './state.ts';
import { startTravel, travelBlocked } from './step.ts';
import { RECALL_HOURS, recallBlocked, recallCount } from './loremaster.ts';
import { BITE_HOURS, biteBlocked, readyBiter } from './bite.ts';
import { readyTapper, TAP_HOURS, tapAmount, tapBlocked } from './tapper.ts';
import { ALTAR_HOURS, altarBlocked } from './altar.ts';
import { ASCEND_HOURS, ascendBlocked, ascendText, ascensionOf } from './luminarch.ts';
import { SET_TRAP_HOURS, setTrapBlocked } from './snare.ts';
import { HEX_HOURS, hexBlocked } from './hexmage.ts';
import { EXPEDITION_HOURS, expeditionBlocked, expeditionOf, expeditionReward } from './expedition.ts';
import { bondBlocked, bondTargets, FETCH_HOURS, fetchBlocked, firesOnBond, growBlocked, HAND, landDropBlocked, targetedBondEffect, TOP } from './abilities.ts';
import { handBlocked, topBlocked } from './oracle.ts';
import { CLAIM_HOURS, claimBlocked, itemDef } from './items.ts';
import { EQUIP_HOURS, equipBlocked } from './equipment.ts';
import { EON_HOURS, spendBlocked, storeBlocked } from './eons.ts';
import { castBlocked, learnBlocked, spellDef } from './spells.ts';
import { josa, shortName, toward } from './text.ts';
import { PACES } from './types.ts';
import { bondEffectText, region } from './world.ts';
import { ownsTile, sameTile } from './tiles.ts';
import type { Tile } from './tiles.ts';
import type { World } from './world.ts';

export const ActionSchema = z.discriminatedUnion('type', [
  // Go to a land (`to`), to a tile of it if asked (`tile`; the nearest one otherwise). A tile
  // of the land they are in: a walk within it.
  z.object({ type: z.literal('move'), to: z.string(), tile: z.tuple([z.number().int(), z.number().int()]).optional() }),
  // Go to where someone stands: their land and tile.
  z.object({ type: z.literal('seek'), to: z.string() }),
  z.object({ type: z.literal('rest'), hours: z.number().int().min(1).max(12) }),
  z.object({ type: z.literal('explore'), hours: z.number().int().min(1).max(8), pace: z.enum(PACES) }),
  z.object({ type: z.literal('eat') }),
  z.object({ type: z.literal('wait'), hours: z.number().int().min(1).max(24) }),
  z.object({ type: z.literal('talk'), to: z.string(), say: z.string().min(1).max(300) }),
  z.object({ type: z.literal('attack'), to: z.string() }),
  // Bond with the land here: it comes under your control (landfall) and gives its mana each turn.
  // A land whose bonding makes someone here lose life ("target player loses 1 life"): `target`.
  z.object({ type: z.literal('bond'), target: z.string().optional() }),
  // Learn a spell taught here; cast a known one on someone here (kick: pay its kicker too).
  z.object({ type: z.literal('learn'), spell: z.string() }),
  z.object({ type: z.literal('cast'), spell: z.string(), to: z.string(), kick: z.boolean().default(false) }),
  // Tame an item that stands here: pay its cost and it becomes yours.
  z.object({ type: z.literal('claim'), item: z.string() }),
  // Put equipment you hold on yourself or a retainer here (`to`; yourself if none).
  z.object({ type: z.literal('equip'), item: z.string(), to: z.string().optional() }),
  // Give up a fetch land you hold to seek out a land of its types, from wherever you are.
  // `target`: whom a Valakut's fire falls on, if the land sought is a mountain that wakes it.
  z.object({ type: z.literal('fetch'), from: z.string(), to: z.string(), target: z.string().optional() }),
  // Leave a day in a land that keeps days (losing tomorrow), or take one back (an extra day).
  z.object({ type: z.literal('store_day'), land: z.string() }),
  z.object({ type: z.literal('spend_day'), land: z.string() }),
  // Tap a land like Oran-Rief: every creature of its color that came into play today grows.
  z.object({ type: z.literal('grow'), land: z.string() }),
  z.object({ type: z.literal('recall') }),
  // Have one you control bearing Predatory Urge (yourself, or one who serves you) bite `to`, one
  // standing with them: the biter is tapped until midnight, the two deal each other their power.
  z.object({ type: z.literal('bite'), to: z.string() }),
  // Have a Noble Vestige you control ward `to` (yourself if none), one standing with it: it is
  // tapped until midnight, and the next damage they would take today is prevented.
  z.object({ type: z.literal('shield'), to: z.string().optional() }),
  // Have a Reckless Scholar you control tell `to` (yourself if none), one standing with it, what it
  // has heard: they come to know a secret, then let go of a spell. It is tapped until midnight.
  z.object({ type: z.literal('loot'), to: z.string().optional() }),
  // Have a Frontier Guide you control find you the way to a basic land: pay its cost; it is tapped
  // until midnight, and you may bond from afar with a basic land you don't hold yet.
  z.object({ type: z.literal('scout') }),
  // Offer `to`, one who serves you standing with you, at your Carnage Altar (before it): they die,
  // you come to know a secret.
  z.object({ type: z.literal('altar'), to: z.string() }),
  // End the Ior Ruin Expedition you own (enough quest counters): it is gone, you come to know
  // secrets.
  z.object({ type: z.literal('expedition') }),
  // Call down an angel with the Luminarch Ascension you own (enough quest counters): pay its cost.
  z.object({ type: z.literal('ascend') }),
  // Set a trap you hold where you stand, paying its card's cost (Trapmaker's Snare).
  z.object({ type: z.literal('set_trap'), trap: z.string() }),
  // Have a Vampire Hexmage you control, standing with you, sacrifice itself to strip `to` ("being:<id>"
  // or "item:<id>") of its counters.
  z.object({ type: z.literal('hex'), to: z.string() }),
  // Hire a mercenary here: pay their price and they serve you for good (sim/allies.ts).
  z.object({ type: z.literal('hire'), to: z.string() }),
  // Answer the pick you owe (an Ally's rally in your party): someone's id, or null for no one.
  z.object({ type: z.literal('choose'), pick: z.string().nullable() }),
]);
export type Action = z.infer<typeof ActionSchema>;

export const PACE_LABELS = { careful: '조심스럽게', normal: '평소대로', hasty: '서둘러' } as const;
const MEAL_COST = -KIND_EFFECTS.eat.coin;
export { BOND_HOURS };

// Starts the action for the player. Returns why it can't be done now, or null.
export function startAction(state: State, world: World, action: Action): string | null {
  const p = player(state);
  if (!p) return '관찰자 모드에서는 행동할 수 없다.';
  if (p.dead) return '당신의 인생은 끝났다.';
  const t = state.minutes;
  if (p.travel) return '이동 중이다.';
  // Seized (Roil Elemental, Sorin): dragged about as another's, they can only wait.
  const holder = p.seized ? masterOf(state, p) : undefined;
  if (holder && action.type !== 'wait') return `${shortName(holder.name)}에게 붙들려 있다. 기다릴 수만 있다.`;
  if (action.type !== 'wait') {
    if (p.boundUntil !== undefined) return '묶여 있어 움직일 수 없다. 기다릴 수만 있다.';
    if (p.forced) return '지쳐 쓰러져 있다. 기다릴 수만 있다.';
  }
  const until = (hours: number) => t + hours * STEP_MINUTES;
  let task: Task;
  let text: string;
  switch (action.type) {
    case 'move': {
      const tile = action.tile as Tile | undefined;
      if (tile && !ownsTile(world, action.to, tile)) return '그 땅에 그런 곳은 없다.';
      if (action.to === p.region) {
        if (!tile || sameTile(tile, p.tile)) return '이미 그곳에 있다.';
      } else {
        const why = travelBlocked(state, world, p, action.to);
        if (why) return why;
      }
      p.pace = 'normal';
      startTravel(state, world, p, action.to, t, tile);
      return null;
    }
    case 'seek': {
      const b = state.actors[action.to];
      if (!b || b.dead || b.id === p.id) return '그런 이는 없다.';
      if (together(p, b)) return `${josa(shortName(b.name), '은', '는')} 이미 곁에 있다.`;
      const where = b.travel?.to ?? b.region;
      if (where !== p.region) {
        const why = travelBlocked(state, world, p, where);
        if (why) return why;
      }
      p.pace = 'normal';
      startTravel(state, world, p, where, t, b.travel ? b.travel.tile : b.tile);
      return null;
    }
    case 'rest':
      task = { kind: 'sleep', activity: '휴식', emoji: '💤', until: until(action.hours) };
      text = `${action.hours}시간 쉬기로 한다.`;
      break;
    case 'explore':
      const unusable = landUnusable(state, p.region);
      if (unusable) return `이 땅은 쓸 수 없다: ${unusable}.`;
      task = { kind: 'explore', activity: `${PACE_LABELS[action.pace]} 탐색`, emoji: '🧭', until: until(action.hours) };
      text = `${action.hours}시간 동안 ${PACE_LABELS[action.pace]} 주변을 탐색한다.`;
      break;
    case 'eat':
      if (p.stats.coin < MEAL_COST) return `먹을 것을 살 돈이 없다 (${MEAL_COST} 필요).`;
      task = { kind: 'eat', activity: '식사', emoji: '🍖', until: until(1) };
      text = '끼니를 챙긴다.';
      break;
    case 'wait':
      task = { kind: 'leisure', activity: '기다림', emoji: '⏳', until: until(action.hours) };
      text = `${action.hours}시간 기다린다.`;
      break;
    case 'bond': {
      const why = bondBlocked(state, world, p, t);
      if (why) return why;
      // A targeted effect ("target player loses N life", "target creature gains flying"): pick
      // someone here, when anyone is.
      const eff = targetedBondEffect(region(world, p.region));
      const targets = eff ? bondTargets(state, world, p, p.region, eff) : [];
      if (targets.length && !targets.some((x) => x.id === action.target))
        return `이 땅은 곁의 하나에게 힘을 미친다 (${bondEffectText(eff!)}). 누구로 할지 골라야 한다: ${targets.map((x) => (x.id === p.id ? '나' : shortName(x.name))).join(', ')}.`;
      // A mountain that wakes a Valakut they hold: `target`, if given, is whom its fire falls on.
      const fire = !eff && action.target && firesOnBond(state, world, { ...p, bonds: [...(p.bonds ?? []), p.region] }, p.region).length ? action.target : undefined;
      const target = targets.find((x) => x.id === action.target);
      task = { kind: 'bond', activity: '땅과 유대 맺기', emoji: '🌱', until: until(BOND_HOURS), ...(target ? { target: target.id } : fire ? { target: fire } : {}) };
      text = `${BOND_HOURS}시간 동안 이 땅과 유대를 맺는다.${
        !target ? ''
        : eff!.type === 'lose_life' ? ` ${josa(shortName(target.name), '이', '가')} 이 땅에 생명을 앗길 것이다.`
        : ` 이 땅의 힘은 ${target.id === p.id ? '나' : shortName(target.name)}에게 간다.`
      }`;
      break;
    }
    case 'attack': {
      const npc = state.actors[action.to];
      if (!npc || !isPerson(npc) || npc.dead) return '그런 인물은 없다.';
      const name = shortName(npc.name);
      if (awayText(world, p, npc)) return awayText(world, p, npc);
      if (outOfTime(state, npc)) return `${josa(name, '은', '는')} 시간 밖에 있다. 닿지 않는다.`;
      task = { kind: 'fight', activity: `${josa(name, '과', '와')} 싸움`, emoji: '⚔️', until: until(1) };
      text = `${name}에게 덤벼든다.`;
      break;
    }
    case 'learn': {
      const why = learnBlocked(world, p, action.spell);
      if (why) return why;
      const s = spellDef(world, action.spell)!;
      task = { kind: 'learn', activity: `${s.name} 배우기`, emoji: '📖', until: until(s.learnHours), spell: s.id };
      text = `${s.learnHours}시간 동안 ${josa(s.name, '을', '를')} 배운다.`;
      break;
    }
    case 'cast': {
      const why = castBlocked(state, world, p, action.spell, action.to, action.kick, t);
      if (why) return why;
      const s = spellDef(world, action.spell)!;
      task = { kind: 'cast', activity: `${s.name} 시전`, emoji: '✨', until: until(1) };
      text = `${shortName(state.actors[action.to].name)}에게 ${josa(s.name, '을', '를')} 건다.`;
      break;
    }
    case 'claim': {
      const why = claimBlocked(state, world, p, action.item, t);
      if (why) return why;
      const x = itemDef(world, action.item)!;
      task = { kind: 'claim', activity: `${x.name} 길들이기`, emoji: '🏺', until: until(CLAIM_HOURS), item: x.id };
      text = `${josa(x.name, '을', '를')} 길들인다 (${x.costText}).`;
      break;
    }
    case 'equip': {
      const why = equipBlocked(state, world, p, action.item, action.to, t);
      if (why) return why;
      const x = itemDef(world, action.item)!;
      const to = state.actors[action.to ?? p.id];
      task = { kind: 'equip', activity: `${x.name} 매기`, emoji: '🪝', until: until(EQUIP_HOURS), item: x.id, who: to.id };
      text = `${josa(x.name, '을', '를')} ${to.id === p.id ? '몸에' : `${shortName(to.name)}에게`} 맨다 (${x.equip!.costText}).`;
      break;
    }
    case 'fetch': {
      // The land on top of their library (Oracle of Mul Daya).
      if (action.from === TOP) {
        const why = topBlocked(state, world, p, action.to, state.minutes, (t) => landDropBlocked(state, world, p, t));
        if (why) return why;
        const to = region(world, action.to);
        task = { kind: 'fetch', activity: `${to.name}과 멀리서 이어지기`, emoji: '🔮', until: until(FETCH_HOURS), from: TOP, land: to.id, ...(action.target ? { target: action.target } : {}) };
        text = `앞날에 비친 ${toward(to.name)} 멀리서 이어진다 (오늘의 땅).`;
        break;
      }
      // A land in their hand (Merfolk Wayfinder).
      if (action.from === HAND) {
        const why = handBlocked(state, world, p, action.to, state.minutes, (t) => landDropBlocked(state, world, p, t));
        if (why) return why;
        const to = region(world, action.to);
        task = { kind: 'fetch', activity: `${to.name}과 멀리서 이어지기`, emoji: '🧭', until: until(FETCH_HOURS), from: HAND, land: to.id, ...(action.target ? { target: action.target } : {}) };
        text = `일러 받은 길을 따라 ${toward(to.name)} 멀리서 이어진다 (오늘의 땅).`;
        break;
      }
      const why = fetchBlocked(state, world, p, action.from, action.to);
      if (why) return why;
      const [from, to] = [region(world, action.from), region(world, action.to)];
      task = { kind: 'fetch', activity: `${from.name}에서 길 찾기`, emoji: '🧭', until: until(FETCH_HOURS), from: from.id, land: to.id, ...(action.target ? { target: action.target } : {}) };
      text = `${josa(from.name, '을', '를')} 내어 주고 ${toward(to.name)} 이어지는 길을 찾는다 (생명 ${from.fetch!.life}).`;
      break;
    }
    case 'store_day': {
      const why = storeBlocked(state, world, p, action.land, t);
      if (why) return why;
      const r = region(world, action.land);
      task = { kind: 'store_day', activity: `${r.name}에 하루 맡기기`, emoji: '⏳', until: until(EON_HOURS), land: r.id };
      text = `${r.name}에 하루를 맡긴다 (${r.eon!.costText}). 내일 하루는 시간 밖에서 보내게 된다.`;
      break;
    }
    case 'spend_day': {
      const why = spendBlocked(state, world, p, action.land, t);
      if (why) return why;
      const r = region(world, action.land);
      task = { kind: 'spend_day', activity: `${r.name}에서 하루 되찾기`, emoji: '⌛', until: until(EON_HOURS), land: r.id };
      text = `${r.name}에 맡겨 둔 하루를 되찾는다. ${josa(r.name, '은', '는')} 떠나고, 내일은 나만의 하루가 된다.`;
      break;
    }
    case 'grow': {
      const why = growBlocked(state, world, p, action.land, t);
      if (why) return why;
      const r = region(world, action.land);
      task = { kind: 'grow', activity: `${r.name}의 힘 불러내기`, emoji: '🌿', until: until(1), land: r.id };
      text = `${r.name}의 힘을 불러내 오늘 새로 난 생물들을 북돋운다.`;
      break;
    }
    case 'recall': {
      const why = recallBlocked(state, world, p, t);
      if (why) return why;
      task = { kind: 'recall', activity: '전승술사의 기억 빌리기', emoji: '📜', until: until(RECALL_HOURS) };
      text = `전승술사가 기억하는 것을 함께 짚어 본다. 동료 ${recallCount(state, world, p)}만큼 숨은 것을 알게 된다.`;
      break;
    }
    case 'bite': {
      const why = biteBlocked(state, world, p, action.to, t);
      if (why) return why;
      const b = state.actors[action.to];
      const biter = readyBiter(state, p, t, b)!;
      const name = shortName(b.name);
      task = { kind: 'bite', activity: `${name} 물어뜯기`, emoji: '🦷', until: until(BITE_HOURS), who: b.id };
      text = biter.id === p.id ? `포식 충동에 몸을 맡겨 ${josa(name, '을', '를')} 물어뜯으려 한다. 자정까지 묶인다.` : `${josa(shortName(biter.name), '이', '가')} ${josa(name, '을', '를')} 물어뜯게 한다.`;
      break;
    }
    case 'scout': {
      const why = tapBlocked(state, world, p, 'scout', p.id, t);
      if (why) return why;
      const w = readyTapper(state, world, p, 'scout', t)!;
      task = { kind: 'scout', activity: '길잡이와 길 찾기', emoji: '🧭', until: until(TAP_HOURS) };
      text = `${josa(shortName(w.name), '이', '가')} 아무도 찾아보지 않은 길을 더듬는다. 아직 유대 없는 기본 땅 하나와 멀리서 이어질 수 있다.`;
      break;
    }
    case 'shield':
    case 'loot': {
      const why = tapBlocked(state, world, p, action.type, action.to, t);
      if (why) return why;
      const b = state.actors[action.to ?? p.id];
      const w = readyTapper(state, world, p, action.type, t, b)!;
      const name = b.id === p.id ? '자신' : shortName(b.name);
      task = action.type === 'shield' ? { kind: 'shield', activity: `${name}에게 가호`, emoji: '🕯️', until: until(TAP_HOURS), who: b.id } : { kind: 'loot', activity: `${name}에게 학자의 이야기`, emoji: '🧭', until: until(TAP_HOURS), who: b.id };
      text =
        action.type === 'shield'
          ? `${josa(shortName(w.name), '이', '가')} ${name}에게 희망의 빛을 드리운다. 오늘 받을 다음 피해 ${tapAmount(state, world, w, 'shield')}를 막는다.`
          : `${josa(shortName(w.name), '이', '가')} ${name}에게 주워들은 것을 늘어놓는다. 숨은 것 하나를 알게 되고, 주문 하나를 잊는다.`;
      break;
    }
    case 'altar': {
      const why = altarBlocked(state, world, p, action.to, t);
      if (why) return why;
      const v = state.actors[action.to];
      task = { kind: 'altar', activity: `${shortName(v.name)}을(를) 제단에 바침`, emoji: '🩸', until: until(ALTAR_HOURS), who: v.id };
      text = `${josa(shortName(v.name), '을', '를')} 제단에 바친다. 그 피 속에서 숨은 것 하나를 알게 된다.`;
      break;
    }
    case 'expedition': {
      const why = expeditionBlocked(state, world, p);
      if (why) return why;
      task = { kind: 'expedition', activity: `${expeditionOf(state, world, p)!.name}을(를) 마침`, emoji: '🗺️', until: until(EXPEDITION_HOURS) };
      text = `원정을 마치고 원정대가 찾아낸 것을 짚어 본다. ${expeditionReward(state, world, p).ko}.`;
      break;
    }
    case 'hex': {
      const why = hexBlocked(state, world, p, action.to, t);
      if (why) return why;
      task = { kind: 'hex', activity: '흡혈귀 주술사의 저주', emoji: '🩸', until: until(HEX_HOURS), who: action.to };
      text = '흡혈귀 주술사가 제 피를 바쳐 저주를 걸려 한다. 그녀는 죽는다.';
      break;
    }
    case 'set_trap': {
      const why = setTrapBlocked(state, world, p, action.trap, t);
      if (why) return why;
      const ev = world.events.find((x) => x.id === action.trap)!;
      task = { kind: 'set_trap', activity: `${ev.name}을(를) 숨겨 놓음`, emoji: '🪤', until: until(SET_TRAP_HOURS), trap: ev.id };
      text = `${josa(ev.name, '을', '를')} 이 자리에 숨겨 놓는다 (${ev.cardCost!.text}).`;
      break;
    }
    case 'ascend': {
      const why = ascendBlocked(state, world, p, t);
      if (why) return why;
      task = { kind: 'ascend', activity: `${ascensionOf(state, world, p)!.name}의 빛을 부름`, emoji: '👼', until: until(ASCEND_HOURS) };
      text = `빛 속으로 두 팔을 벌린다. ${ascendText(state, world, p)}.`;
      break;
    }
    case 'hire': {
      const why = hireBlocked(state, world, p, action.to);
      if (why) return why;
      const name = shortName(state.actors[action.to].name);
      task = { kind: 'social', activity: `${name} 고용`, emoji: '🪙', until: until(HIRE_HOURS) };
      text = `${josa(name, '을', '를')} 고용한다 (${hirePrice(npcDef(state, world, action.to)!)}코인).`;
      break;
    }
    case 'choose':
      return '고를 것이 없다.';
    case 'talk': {
      const npc = state.actors[action.to];
      if (!npc || !isPerson(npc) || npc.dead) return '그런 인물은 없다.';
      const name = shortName(npc.name);
      if (awayText(world, p, npc)) return awayText(world, p, npc);
      if (npc.boundUntil !== undefined) return `${josa(name, '은', '는')} 묶여 있다.`;
      if (outOfTime(state, npc)) return `${josa(name, '은', '는')} 시간 밖에 있다. 대답이 없다.`;
      task = { kind: 'social', activity: `${josa(name, '과', '와')} 대화`, emoji: '💬', until: until(1) };
      text = `${name}에게 말을 건다.`;
      break;
    }
  }
  // Pace is how one moves through the region: set by exploring, kept while resting or waiting.
  if (action.type === 'explore') p.pace = action.pace;
  p.task = task;
  addLog(state, { kind: 'player', text, regions: [p.region], actors: [p.id] });
  return null;
}
