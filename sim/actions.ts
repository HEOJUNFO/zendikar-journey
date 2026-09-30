// What the player character can do in one turn. Free text is turned into one of these by
// the LLM (sim/llm/interpret.ts); the UI buttons send them directly.
import { z } from 'zod';
import { STEP_MINUTES } from './clock.ts';
import { BOND_HOURS, KIND_EFFECTS } from './rules.ts';
import { addLog, isPerson, landUnusable, outOfTime, player } from './state.ts';
import type { State, Task } from './state.ts';
import { startTravel, travelBlocked } from './step.ts';
import { bondBlocked, bondVictims, fetchBlocked, growBlocked } from './abilities.ts';
import { CLAIM_HOURS, claimBlocked, itemDef } from './items.ts';
import { EON_HOURS, spendBlocked, storeBlocked } from './eons.ts';
import { castBlocked, learnBlocked, spellDef } from './spells.ts';
import { josa, shortName, toward } from './text.ts';
import { PACES } from './types.ts';
import { region } from './world.ts';
import type { World } from './world.ts';

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), to: z.string() }),
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
  // Give up a fetch land you hold to seek out a land of its types, from wherever you are.
  z.object({ type: z.literal('fetch'), from: z.string(), to: z.string() }),
  // Leave a day in a land that keeps days (losing tomorrow), or take one back (an extra day).
  z.object({ type: z.literal('store_day'), land: z.string() }),
  z.object({ type: z.literal('spend_day'), land: z.string() }),
  // Tap a land like Oran-Rief: every creature of its color that came into play today grows.
  z.object({ type: z.literal('grow'), land: z.string() }),
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
  if (action.type !== 'wait') {
    if (p.boundUntil !== undefined) return '묶여 있어 움직일 수 없다. 기다릴 수만 있다.';
    if (p.forced) return '지쳐 쓰러져 있다. 기다릴 수만 있다.';
  }
  const until = (hours: number) => t + hours * STEP_MINUTES;
  let task: Task;
  let text: string;
  switch (action.type) {
    case 'move': {
      const why = travelBlocked(state, world, p, action.to);
      if (why) return why;
      p.pace = 'normal';
      startTravel(state, world, p, action.to, t);
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
      // "Target player loses N life": pick someone here, when anyone is.
      const drain = region(world, p.region).onBond.find((x) => x.type === 'lose_life');
      const victims = drain ? bondVictims(state, world, p, p.region) : [];
      if (victims.length && !victims.some((x) => x.id === action.target))
        return `이 땅은 곁의 한 사람의 생명을 앗아 간다. 누구에게 내줄지 골라야 한다: ${victims.map((x) => shortName(x.name)).join(', ')}.`;
      const target = victims.find((x) => x.id === action.target);
      task = { kind: 'bond', activity: '땅과 유대 맺기', emoji: '🌱', until: until(BOND_HOURS), ...(target ? { target: target.id } : {}) };
      text = `${BOND_HOURS}시간 동안 이 땅과 유대를 맺는다.${target ? ` ${josa(shortName(target.name), '이', '가')} 이 땅에 생명을 앗길 것이다.` : ''}`;
      break;
    }
    case 'attack': {
      const npc = state.actors[action.to];
      if (!npc || !isPerson(npc) || npc.dead) return '그런 인물은 없다.';
      const name = shortName(npc.name);
      if (npc.travel || npc.region !== p.region) return `${josa(name, '은', '는')} 여기 없다.`;
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
    case 'fetch': {
      const why = fetchBlocked(state, world, p, action.from, action.to);
      if (why) return why;
      const [from, to] = [region(world, action.from), region(world, action.to)];
      task = { kind: 'fetch', activity: `${from.name}에서 길 찾기`, emoji: '🧭', until: until(1), from: from.id, land: to.id };
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
    case 'talk': {
      const npc = state.actors[action.to];
      if (!npc || !isPerson(npc) || npc.dead) return '그런 인물은 없다.';
      const name = shortName(npc.name);
      if (npc.travel || npc.region !== p.region) return `${josa(name, '은', '는')} 여기 없다.`;
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
