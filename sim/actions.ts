// What the player character can do in one turn. Free text is turned into one of these by
// the LLM (sim/llm/interpret.ts); the UI buttons send them directly.
import { z } from 'zod';
import { STEP_MINUTES } from './clock.ts';
import { BOND_HOURS, KIND_EFFECTS } from './rules.ts';
import { addLog, isPerson, landUnusable, player } from './state.ts';
import type { State, Task } from './state.ts';
import { startTravel, travelBlocked } from './step.ts';
import { bondBlocked } from './abilities.ts';
import { CLAIM_HOURS, claimBlocked, itemDef } from './items.ts';
import { castBlocked, learnBlocked, spellDef } from './spells.ts';
import { josa, shortName } from './text.ts';
import { PACES } from './types.ts';
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
  z.object({ type: z.literal('bond') }),
  // Learn a spell taught here; cast a known one on someone here (kick: pay its kicker too).
  z.object({ type: z.literal('learn'), spell: z.string() }),
  z.object({ type: z.literal('cast'), spell: z.string(), to: z.string(), kick: z.boolean().default(false) }),
  // Tame an item that stands here: pay its cost and it becomes yours.
  z.object({ type: z.literal('claim'), item: z.string() }),
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
      task = { kind: 'bond', activity: '땅과 유대 맺기', emoji: '🌱', until: until(BOND_HOURS) };
      text = `${BOND_HOURS}시간 동안 이 땅과 유대를 맺는다.`;
      break;
    }
    case 'attack': {
      const npc = state.actors[action.to];
      if (!npc || !isPerson(npc) || npc.dead) return '그런 인물은 없다.';
      const name = shortName(npc.name);
      if (npc.travel || npc.region !== p.region) return `${josa(name, '은', '는')} 여기 없다.`;
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
    case 'talk': {
      const npc = state.actors[action.to];
      if (!npc || !isPerson(npc) || npc.dead) return '그런 인물은 없다.';
      const name = shortName(npc.name);
      if (npc.travel || npc.region !== p.region) return `${josa(name, '은', '는')} 여기 없다.`;
      if (npc.boundUntil !== undefined) return `${josa(name, '은', '는')} 묶여 있다.`;
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
