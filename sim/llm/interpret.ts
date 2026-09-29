// Free text from the player -> one Action the engine can run.
import { z } from 'zod';
import { ActionSchema } from '../actions.ts';
import type { Action } from '../actions.ts';
import { player, present } from '../state.ts';
import type { InterpretInput } from '../run.ts';
import { travelBlocked } from '../step.ts';
import { shortName } from '../text.ts';
import { region, TERRAINS, travelHours } from '../world.ts';
import { chatCompletion, extractJson } from './chat.ts';
import { playerText } from './context.ts';

const AnswerSchema = z.object({ action: ActionSchema.nullable() });

const SYSTEM_PROMPT = `You translate what a player types in a text life-simulation into one game action.
The player writes in Korean. Pick the single action that best matches their intent.
If they speak to someone who is here, that is "talk" with their words in "say" (keep them in Korean).
If nothing fits, answer {"action": null}. Answer with JSON only, no prose.`;

export async function interpret({ world, state, text }: InterpretInput): Promise<Action | null> {
  const p = player(state);
  if (!p) return null;
  const here = region(world, p.region);
  const places = world.regions
    .filter((r) => r.id !== p.region && !TERRAINS[r.terrain].sea)
    .map((r) => {
      const why = travelBlocked(state, world, p, r.id);
      return `- ${r.id}: ${r.name} (${r.summary}) — ${why ? `갈 수 없음: ${why}` : `${travelHours(here, r)}시간`}`;
    });
  const people = present(state, p.region)
    .filter((a) => a.kind === 'npc')
    .map((a) => `- ${a.id}: ${shortName(a.name)}`);
  const content = await chatCompletion(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Player: ${playerText(state)}
Now in: ${here.id} ${here.name} (${here.summary})

Other regions:
${places.join('\n') || '(none)'}

People here:
${people.join('\n') || '(nobody)'}

Actions:
- {"type":"move","to":"<region id>"}
- {"type":"rest","hours":1-12}
- {"type":"explore","hours":1-8,"pace":"careful"|"normal"|"hasty"}
- {"type":"eat"}
- {"type":"wait","hours":1-24}
- {"type":"talk","to":"<person id>","say":"<what they say>"}

Player typed: ${text}

Answer: {"action": {...}}`,
      },
    ],
    800,
  );
  const parsed = AnswerSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    console.warn('Unusable action:', content);
    return null;
  }
  return parsed.data.action;
}
