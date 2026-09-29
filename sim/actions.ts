// What the player character can do in one turn. Free text is turned into one of these by
// the GM LLM (sim/llm/interpret.ts); the UI buttons send them directly.
import { z } from 'zod';
import { STEP_MINUTES } from './clock.ts';
import { KIND_EFFECTS } from './rules.ts';
import { addLog, player } from './state.ts';
import type { State, Task } from './state.ts';
import { startTravel, travelBlocked } from './step.ts';
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
]);
export type Action = z.infer<typeof ActionSchema>;

export const PACE_LABELS = { careful: '조심스럽게', normal: '평소대로', hasty: '서둘러' } as const;
const MEAL_COST = -KIND_EFFECTS.eat.coin;

// Starts the action for the player. Returns why it can't be done now, or null.
export function startAction(state: State, world: World, action: Action): string | null {
  const p = player(state);
  if (!p) return '관찰자 모드에서는 행동할 수 없다.';
  const t = state.minutes;
  if (p.travel) return '이동 중이다.';
  if (action.type !== 'wait') {
    if (p.boundUntil !== undefined) return '붙잡혀 있어 움직일 수 없다. 기다릴 수만 있다.';
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
    case 'talk': {
      const npc = state.actors[action.to];
      if (!npc || npc.kind !== 'npc') return '그런 인물은 없다.';
      const name = shortName(npc.name);
      if (npc.travel || npc.region !== p.region) return `${josa(name, '은', '는')} 여기 없다.`;
      if (npc.boundUntil !== undefined) return `${josa(name, '은', '는')} 붙잡혀 있다.`;
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
