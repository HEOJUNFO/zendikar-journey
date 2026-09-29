// Free text from the player -> one Action the engine can run.
import { z } from 'zod';
import { ActionSchema } from '../actions.ts';
import type { Action } from '../actions.ts';
import { isPerson, player, present, ptOf } from '../state.ts';
import type { InterpretInput } from '../run.ts';
import { travelBlocked } from '../step.ts';
import { shortName } from '../text.ts';
import { placeName, region, TERRAINS, travelHours } from '../world.ts';
import { itemsAt, itemOwner } from '../items.ts';
import { fetchTargets } from '../abilities.ts';
import { spellsTaughtAt } from '../spells.ts';
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
      return `- ${r.id}: ${placeName(world, r)} (${r.summary}) — ${why ? `갈 수 없음: ${why}` : `${travelHours(here, r)}시간`}`;
    });
  const taught = spellsTaughtAt(world, p.region).filter((s) => !p.spells?.includes(s.id));
  const known = world.spells.filter((s) => p.spells?.includes(s.id));
  const items = itemsAt(world, p.region).filter((x) => !itemOwner(state, x.id));
  const fetches = world.regions
    .filter((r) => r.fetch && p.bonds?.includes(r.id))
    .flatMap((r) => fetchTargets(state, world, p, r.id).map((to) => `- {"type":"fetch","from":"${r.id}","to":"${to.id}"}  (give up ${r.name} and ${r.fetch!.life} life to bond with ${placeName(world, to)} from afar)`));
  const people = present(state, p.region)
    .filter(isPerson)
    .map((a) => `- ${a.id}: ${shortName(a.name)} (power/toughness ${ptOf(a).join('/')})`);
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
- {"type":"attack","to":"<person id>"}  (only when they clearly mean to fight; fights can be deadly)
- {"type":"bond"}  (bond with the land here, taking it as their own; 4 hours, one land a day)
${taught.length ? taught.map((s) => `- {"type":"learn","spell":"${s.id}"}  (learn ${s.name} here: ${s.summary}; ${s.learnHours} hours)`).join('\n') + '\n' : ''}${
          known.length
            ? known.map((s) => `- {"type":"cast","spell":"${s.id}","to":"<person id${s.target === 'any_here' ? ` or ${p.id} for themselves` : ''}>","kick":false}  (cast ${s.name} ${s.costText} on someone here: ${s.summary})`).join('\n') + '\n'
            : ''
        }${[...items.map((x) => `- {"type":"claim","item":"${x.id}"}  (tame ${x.name} ${x.costText}, making it theirs: ${x.summary})`), ...fetches].join('\n')}
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
