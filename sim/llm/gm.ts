// The GM decides once a day which of the world's events happen today. It can only pick
// events defined in world/entities (sim blocks); what they do is up to the engine.
import { z } from 'zod';
import type { GmPlan } from '../state.ts';
import type { GmDayInput } from '../run.ts';
import { chatCompletion, extractJson } from './chat.ts';
import { clockText, loreText, whereaboutsText } from './context.ts';

const GmSchema = z.object({
  fires: z.array(z.object({ eventId: z.string(), hour: z.number().int().min(0).max(23) })).max(3),
  note: z.string().max(300).optional(),
});

export async function gmDay(input: GmDayInput): Promise<GmPlan | null> {
  const content = await chatCompletion(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt(input) },
    ],
    1500,
  );
  const plan = parseGmPlan(content, input);
  if (!plan) console.warn('Unusable GM plan, using the rules:', content);
  return plan;
}

const SYSTEM_PROMPT = `You are the game master of a living fantasy world (the plane of Zendikar).
Each morning you decide which world events happen today. Events are rare and should feel earned:
respect their usual frequency, build on what happened lately, and often decide that nothing happens.
Answer with JSON only, no prose.`;

function userPrompt({ day, hour, world, state, eligible, news }: GmDayInput) {
  const events = eligible
    .map((e) => `- ${e.id}: ${e.name} — ${e.summary} (usually on about ${Math.round(e.chance * 100)}% of days)`)
    .join('\n');
  return `Day ${day + 1}, now ${clockText(state)}.

World lore:
${loreText(world)}

Regions and who is there:
${whereaboutsText(world, state)}
${news.length ? `\nLately:\n${news.map((n) => `- ${n}`).join('\n')}\n` : ''}
Events you may raise today:
${events}

Rules:
- Pick zero or more of the events above, each at most once, with the hour (${hour}..23) it starts.
- note: one short Korean line on why (only the developers see it).

Answer: {"fires":[{"eventId":"...","hour":${hour}}],"note":"..."}`;
}

export function parseGmPlan(content: string, { day, hour, eligible }: Pick<GmDayInput, 'day' | 'hour' | 'eligible'>): GmPlan | null {
  const parsed = GmSchema.safeParse(extractJson(content));
  if (!parsed.success) return null;
  const ids = new Set(eligible.map((e) => e.id));
  const fires = parsed.data.fires;
  if (fires.some((f) => !ids.has(f.eventId) || f.hour < hour)) return null;
  if (new Set(fires.map((f) => f.eventId)).size !== fires.length) return null;
  return { day, source: 'llm', fires, note: parsed.data.note };
}
