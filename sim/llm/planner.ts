import { z } from 'zod';
import { DAY_MINUTES, formatTimeOfDay } from '../clock.ts';
import { LIFE_KINDS } from '../types.ts';
import type { Need, ScheduleBlock, Stats } from '../types.ts';
import { chatCompletion, extractJson } from './chat.ts';

const BlockSchema = z.object({
  start: z.number().int().min(0).max(DAY_MINUTES),
  end: z.number().int().min(0).max(DAY_MINUTES),
  regionId: z.string(),
  activity: z.string().min(1).max(60),
  emoji: z.string().min(1).max(8),
  kind: z.enum(LIFE_KINDS),
});
const PlanSchema = z.object({ blocks: z.array(BlockSchema).min(1).max(24) });

export type PlanDayInput = {
  day: number;
  name: string;
  persona: string;
  goal: string;
  role: string;
  home: string;
  stats: Stats;
  needs: readonly Need[];
  routine: ScheduleBlock[];
  // Regions this character can be in today (reachable and not sea).
  regions: { id: string; name: string; summary: string }[];
  // Today's news the character would know about (conditions, recent events).
  news: string[];
};

// Asks the chat model for today's schedule. Returns null when the answer isn't a
// usable schedule; the caller then keeps the routine.
// Kinds of blocks they may plan: no meals without hunger, bonding only if their routine bonds.
function kindsFor(input: Pick<PlanDayInput, "needs" | "routine">) {
  return LIFE_KINDS.filter(
    (k) => (k !== 'eat' || input.needs.includes('hunger')) && (k !== 'bond' || input.routine.some((b) => b.kind === 'bond')),
  );
}

export async function planDay(input: PlanDayInput): Promise<ScheduleBlock[] | null> {
  const kinds = new Set<string>(kindsFor(input));
  const content = await chatCompletion(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt(input) },
    ],
    2000,
  );
  let blocks = parsePlan(content, new Set(input.regions.map((r) => r.id)));
  if (blocks?.some((b) => !kinds.has(b.kind))) blocks = null;
  if (!blocks) console.warn(`Unusable plan for ${input.name}, keeping routine:`, content);
  return blocks;
}

const SYSTEM_PROMPT = `You plan one day in the life of a character in a simulated fantasy world (the plane of Zendikar).
The character lives by their role, personality and goals, and takes care of their needs.
Answer with JSON only, no prose.`;

function userPrompt(input: PlanDayInput) {
  const { day, name, persona, goal, role, home, stats, needs, routine, regions, news } = input;
  const kinds = kindsFor(input);
  const state = [
    needs.includes('energy') && `energy ${Math.round(stats.energy)}/100 (low = tired)`,
    needs.includes('hunger') && `hunger ${Math.round(stats.hunger)}/100 (high = hungry)`,
    needs.includes('coin') && `coin ${Math.round(stats.coin)}`,
  ].filter(Boolean);
  const regionList = regions.map((r) => `- ${r.id}: ${r.name} (${r.summary})`).join('\n');
  const usual = routine
    .map((b) => `- ${formatTimeOfDay(b.start)}-${formatTimeOfDay(b.end)} ${b.regionId} ${b.kind}: ${b.activity}`)
    .join('\n');
  return `Plan day ${day + 1} for ${name}.

Who they are: ${persona}
Goal: ${goal}
Role: ${role}
Home: ${home}
Current state: ${state.join(', ')}${needs.includes('hunger') ? '' : ' (does not need food)'}
${news.length ? `\nWhat they know happened lately:\n${news.map((n) => `- ${n}`).join('\n')}\n` : ''}
Usual day:
${usual}

Regions (use these ids only):
${regionList}

Rules:
- Blocks are in minutes of the day (0 = 00:00, 1440 = 24:00), sorted, non-overlapping, start < end.
- The world moves in whole hours: start and end are multiples of 60.
- Cover the whole day from 0 to 1440, including sleep.
- kind is one of: ${kinds.join(', ')}. Use "social" only when they would seek out other people.${
    kinds.includes('bond')
      ? '\n- "bond" takes 4 hours in one region: they make that land theirs (at most one land a day; not one already theirs or hunted out).'
      : ''
  }
- Travel between regions takes hours; only change region when there is a reason.
- Vary the usual day a little to fit today's state, news and goal; don't copy it blindly.
- activity is a short Korean phrase shown on screen (e.g. "폐허 순찰"); emoji is a single emoji.

Answer: {"blocks":[{"start":0,"end":360,"regionId":"...","activity":"...","emoji":"...","kind":"sleep"}, ...]}`;
}

export function parsePlan(content: string, regionIds: Set<string>): ScheduleBlock[] | null {
  const parsed = PlanSchema.safeParse(extractJson(content));
  if (!parsed.success) return null;
  const blocks = [...parsed.data.blocks].sort((a, b) => a.start - b.start);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.start >= b.end || !regionIds.has(b.regionId)) return null;
    if (i > 0 && blocks[i - 1].end > b.start) return null;
  }
  return blocks;
}
