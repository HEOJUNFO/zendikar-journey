import { z } from 'zod';
import { chatCompletion } from '../util/llm';
import { PLACES, PLACES_BY_ID } from '../../data/places';
import { DAY_MINUTES, formatTimeOfDay } from './clock';
import { LIFE_KINDS, LifeProfile, LifeStats, ScheduleBlock } from './types';

const BlockSchema = z.object({
  start: z.number().int().min(0).max(DAY_MINUTES),
  end: z.number().int().min(0).max(DAY_MINUTES),
  placeId: z.string(),
  activity: z.string().min(1).max(60),
  emoji: z.string().min(1).max(8),
  kind: z.enum(LIFE_KINDS as [string, ...string[]]),
});
const PlanSchema = z.object({ blocks: z.array(BlockSchema).min(1).max(24) });

export type PlanDayInput = {
  day: number;
  name: string;
  identity: string;
  plan: string;
  profile: LifeProfile;
  stats: LifeStats;
};

// Asks the chat model for today's schedule. Returns null when the answer isn't a
// usable schedule; the caller then keeps the routine.
export async function planDay(input: PlanDayInput): Promise<ScheduleBlock[] | null> {
  const { content } = await chatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt(input) },
    ],
    max_tokens: 2000,
  });
  const blocks = parsePlan(content);
  if (!blocks) console.warn(`Unusable plan for ${input.name}, keeping routine:`, content);
  return blocks;
}

const SYSTEM_PROMPT = `You plan one day in the life of a character in a simulated world.
The character lives by their role, personality and goals, and takes care of their needs.
Answer with JSON only, no prose.`;

function userPrompt({ day, name, identity, plan, profile, stats }: PlanDayInput) {
  const places = PLACES.map((p) => `- ${p.id}: ${p.name} (${p.description})`).join('\n');
  const routine = profile.routine
    .map((b) => `- ${formatTimeOfDay(b.start)}-${formatTimeOfDay(b.end)} ${b.placeId} ${b.kind}: ${b.activity}`)
    .join('\n');
  return `Plan day ${day + 1} for ${name}.

Who they are: ${identity}
Goal: ${plan}
Role: ${profile.role}
Home: ${profile.home}
Current state: energy ${Math.round(stats.energy)}/100 (low = tired), hunger ${Math.round(stats.hunger)}/100 (high = hungry), coin ${Math.round(stats.coin)}

Usual day:
${routine}

Places (use these ids only):
${places}

Rules:
- Blocks are in minutes of the day (0 = 00:00, 1440 = 24:00), sorted, non-overlapping, start < end.
- Cover the whole day from 0 to 1440, including sleep.
- kind is one of: ${LIFE_KINDS.join(', ')}. Use "social" only when they would seek out other people.
- Vary the usual day a little to fit today's state and goal; don't copy it blindly.
- activity is a short Korean phrase shown on screen (e.g. "밭에 물 주기"); emoji is a single emoji.

Answer: {"blocks":[{"start":0,"end":360,"placeId":"...","activity":"...","emoji":"...","kind":"sleep"}, ...]}`;
}

export function parsePlan(content: string): ScheduleBlock[] | null {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = PlanSchema.safeParse(json);
  if (!parsed.success) return null;
  const blocks = [...parsed.data.blocks].sort((a, b) => a.start - b.start) as ScheduleBlock[];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.start >= b.end || !PLACES_BY_ID.has(b.placeId)) return null;
    if (i > 0 && blocks[i - 1].end > b.start) return null;
  }
  return blocks;
}
