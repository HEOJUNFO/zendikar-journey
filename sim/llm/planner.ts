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
  land: z.string().optional(),
  spell: z.string().optional(),
  who: z.string().optional(),
});
const PlanSchema = z.object({ blocks: z.array(BlockSchema).min(1).max(24) });

export type PlanDayInput = {
  id: string;
  day: number;
  // Minute of the day it is now: planned for mid-day (someone new in the world), the hours
  // before are already past.
  now: number;
  name: string;
  persona: string;
  goal: string;
  role: string;
  home: string;
  // Where they are now.
  here: string;
  stats: Stats;
  // Their life total (sim/life.ts), for those who have one.
  life?: number;
  needs: readonly Need[];
  // Regions this character can be in today (reachable and not sea).
  regions: { id: string; name: string; summary: string }[];
  // One of the sea lying on land, drying out (sim/stranded.ts), in words.
  stranded?: string;
  // Today's news the character would know about (conditions, recent events).
  news: string[];
  // What is still to come today, for one who foresees (sim/foresight.ts).
  foresight?: string[];
  // What they think of the people they know ("- 이오나 (…): …").
  relations?: string[];
  // Items no one holds that they could tame today ("- itm-… in loc-…: …").
  items?: string[];
  // A land they hold that keeps days (Magosi, sim/eons.ts): days left in it, and whether they
  // can leave one or take one back today.
  days?: { land: string; cost: string; held: number; store: boolean; spend: boolean };
  // A land they hold like Oran-Rief, and the creatures it would strengthen today (when any).
  grow?: { land: string; creatures: string[] };
  // Lands they could seek out today by giving up a fetch land they hold (Arid Mesa...).
  fetch?: { id: string; text: string }[];
  // Spells they could learn (where each is taught), and spells they hold and could pay for.
  learn?: { id: string; at: string; text: string }[];
  cast?: { id: string; text: string }[];
  // Beasts that may follow someone who wins their trust, and where each is now.
  court?: { id: string; at: string; text: string }[];
  // Mercenaries they could afford to hire, and where each is now.
  hire?: { id: string; at: string; text: string }[];
  // Others in the world and where each is now: whom they could seek out to talk with (not
  // beasts) or go after (attack), as the player may anyone standing with them.
  people?: { id: string; at: string; text: string; talk: boolean; attack: boolean }[];
};

// Kinds of blocks they may plan: no meals without hunger, taming only if there is an item for
// them to tame, keeping days only with a land that keeps them.
function kindsFor(input: Pick<PlanDayInput, 'needs' | 'items' | 'days' | 'grow' | 'fetch' | 'learn' | 'cast' | 'court' | 'hire' | 'people'>) {
  return LIFE_KINDS.filter(
    (k) =>
      (k !== 'eat' || input.needs.includes('hunger')) &&
      (k !== 'claim' || !!input.items?.length) &&
      (k !== 'store_day' || !!input.days?.store) &&
      (k !== 'spend_day' || !!input.days?.spend) &&
      (k !== 'grow' || !!input.grow) &&
      (k !== 'fetch' || !!input.fetch?.length) &&
      (k !== 'learn' || !!input.learn?.length) &&
      (k !== 'cast' || !!input.cast?.length) &&
      (k !== 'court' || !!input.court?.length) &&
      (k !== 'hire' || !!input.hire?.length) &&
      (k !== 'attack' || !!input.people?.some((x) => x.attack)),
  );
}

// Asks the chat model for today's schedule. Returns null when the answer isn't a usable
// schedule; the caller asks again, and the world waits for it (sim/run.ts).
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
  // A fetch must name one of the lands it can reach; a learn, a spell taught where the block
  // is; a cast, a spell they can cast; a court, a beast where it is now.
  const sought = new Set(input.fetch?.map((x) => x.id));
  const taught = new Map(input.learn?.map((x) => [x.id, x.at]));
  const castable = new Set(input.cast?.map((x) => x.id));
  const beasts = new Map(input.court?.map((x) => [x.id, x.at]));
  const mercs = new Map(input.hire?.map((x) => [x.id, x.at]));
  const people = new Map(input.people?.map((x) => [x.id, x]));
  const bad = (b: ScheduleBlock) =>
    !kinds.has(b.kind) ||
    (b.kind === 'fetch' && !sought.has(b.land ?? '')) ||
    (b.kind === 'learn' && taught.get(b.spell ?? '') !== b.regionId) ||
    (b.kind === 'cast' && !castable.has(b.spell ?? '')) ||
    (b.kind === 'court' && beasts.get(b.who ?? '') !== b.regionId) ||
    (b.kind === 'hire' && mercs.get(b.who ?? '') !== b.regionId) ||
    (b.kind === 'social' && !!b.who && !people.get(b.who)?.talk) ||
    (b.kind === 'attack' && !people.get(b.who ?? '')?.attack);
  if (blocks?.some(bad)) blocks = null;
  if (!blocks) console.warn(`Unusable plan for ${input.name}:`, content);
  return blocks;
}

const SYSTEM_PROMPT = `You plan one day in the life of a character in a simulated fantasy world (the plane of Zendikar).
No one has written a routine for them: you decide their whole day from who they are, their
role and goals, their needs, what they know happened, and the people they know.
Answer with JSON only, no prose.`;

function userPrompt(input: PlanDayInput) {
  const { day, now, name, persona, goal, role, home, here, stats, life, needs, regions, news, foresight, stranded, relations = [], items = [], days, grow, fetch = [], learn = [], cast = [], court = [], hire = [], people = [] } = input;
  const kinds = kindsFor(input);
  const state = [
    needs.includes('energy') && `energy ${Math.round(stats.energy)}/100 (low = tired; sleep restores it)`,
    life !== undefined && `life ${life} (starts at 20; it never comes back by itself, only effects that gain life raise it; at 0 they die)`,
    needs.includes('hunger') && `hunger ${Math.round(stats.hunger)}/100 (high = hungry)`,
    needs.includes('coin') && `coin ${Math.round(stats.coin)}`,
  ].filter(Boolean);
  const regionList = regions.map((r) => `- ${r.id}: ${r.name} (${r.summary})`).join('\n');
  return `Plan day ${day + 1} for ${name}.

Who they are: ${persona}
Goal: ${goal}
Role: ${role}
Home: ${home}
Now: ${formatTimeOfDay(now)} in ${here}${now ? ' (the hours before now are already past; plan the whole day anyway)' : ''}
Current state: ${state.length ? state.join(', ') : 'never tires or hungers'}${needs.includes('hunger') || !state.length ? '' : ' (does not need food)'}${stranded ? `\nDanger: ${stranded}.` : ''}
${news.length ? `\nWhat they know happened lately:\n${news.map((n) => `- ${n}`).join('\n')}\n` : ''}${
    foresight ? `\nThey see what is coming (foresight). Still to come today, as the world has it set:\n${foresight.length ? foresight.map((n) => `- ${n}`).join('\n') : '- nothing out of the ordinary'}\n` : ''
  }${
    relations.length ? `\nPeople they know, and what they think of them:\n${relations.join('\n')}\n` : ''
  }
Regions (use these ids only):
${regionList}

Rules:
- Blocks are in minutes of the day (0 = 00:00, 1440 = 24:00), sorted, non-overlapping, start < end.
- The world moves in whole hours: start and end are multiples of 60.
- Cover the whole day from 0 to 1440, including sleep.
- kind is one of: ${kinds.join(', ')}. Use "social" only when they would seek out other people.
- "bond" takes 4 hours in one region: they make that land theirs and draw its mana each day (at most one land a day; not one already theirs or hunted out). Only if it fits who they are.${
    kinds.includes('claim')
      ? `\n- "claim" takes 1 hour where an item stands: they pay its mana and it becomes theirs (only if they would want it). Items no one holds:\n${items.join('\n')}`
      : ''
  }${
    kinds.includes('store_day')
      ? `\n- "store_day" takes 1 hour, anywhere: they pay ${days!.cost} and leave a day in ${days!.land}. Tomorrow is lost to them: they stand out of time all day, doing nothing. The day stays there for later (${days!.held} left in it now).`
      : ''
  }${
    kinds.includes('spend_day')
      ? `\n- "spend_day" takes 1 hour, anywhere: they take back a day left in ${days!.land}; the land leaves them (their bond with it ends). Tomorrow the whole world stands still and only they move: a day no one else has.`
      : ''
  }${
    kinds.includes('grow')
      ? `\n- "grow" takes 1 hour, anywhere: they call on ${grow!.land} (no mana from it today) to make stronger, for good, every creature of its color that came into the world today, whoever they belong to: ${grow!.creatures.join(', ')}.`
      : ''
  }${
    kinds.includes('fetch')
      ? `\n- "fetch" takes 1 hour, anywhere, and needs "land": the id of the land sought. They give up a fetch land they hold (the bond with it ends) and some life, and bond from afar with the land sought, drawing its mana from then on. It is not their one land of the day. Lands they could seek:\n${fetch.map((x) => `  - "${x.id}": ${x.text}`).join('\n')}`
      : ''
  }${
    kinds.includes('learn')
      ? `\n- "learn" takes the hours given, in the region where the spell is taught (regionId must be that region), and needs "spell": its id. They come to know it for good. Spells they could learn:\n${learn.map((x) => `  - "${x.id}" in ${x.at}: ${x.text}`).join('\n')}`
      : ''
  }${
    kinds.includes('cast')
      ? `\n- "cast" takes 1 hour, and needs "spell": its id. At the end they pay its mana and cast it on someone in the same region (who, is decided then; they may hold it back). A harmful spell makes its target their enemy. Only when it fits who they are. Spells they hold:\n${cast.map((x) => `  - "${x.id}": ${x.text}`).join('\n')}`
      : ''
  }${
    kinds.includes('court')
      ? `\n- "court" takes 2 hours, in the region where the beast is now (regionId must be that region), and needs "who": its id. They stay at its side and try to win its trust; at the end the beast decides whether to follow and serve them (it may not). Only when it fits who they are. Beasts that might follow someone:\n${court.map((x) => `  - "${x.id}" in ${x.at}: ${x.text}`).join('\n')}`
      : ''
  }${
    kinds.includes('hire')
      ? `\n- "hire" takes 1 hour, in the region where the mercenary is now (regionId must be that region), and needs "who": their id. They pay the price and the mercenary serves them for good, following them and fighting at their side. Only when it fits who they are and what they need. Mercenaries they could hire:\n${hire.map((x) => `  - "${x.id}" in ${x.at}: ${x.text}`).join('\n')}`
      : ''
  }
${
    people.length
      ? `- A "social" block may have "who": the id of one they seek out to talk with. They go wherever that one is and speak with them there, whatever the other is doing (once a day each).${
          kinds.includes('attack')
            ? `\n- "attack" needs "who": the id of one they go after. They go wherever that one is and fall on them; the two fight hour by hour until one falls (fights between characters knock out, not kill). Only when, in character, they have real cause.`
            : ''
        }\n  Others in the world, and where each is now:\n${people.map((x) => `  - "${x.id}" in ${x.at}: ${x.text}${x.talk ? '' : ' (no talking)'}${kinds.includes('attack') && !x.attack ? ' (not to attack)' : ''}`).join('\n')}\n`
      : ''
  }- Travel between regions takes hours; only change region when there is a reason.
- Let today follow from their state, news, goal and the people they know; days need not repeat.
- activity is a short Korean phrase shown on screen (e.g. "폐허 순찰"); emoji is a single emoji.

Answer: {"blocks":[{"start":0,"end":360,"regionId":"...","activity":"...","emoji":"...","kind":"sleep"}, ...]}${
    kinds.includes('fetch') || kinds.includes('learn') || kinds.includes('cast') || kinds.includes('court') || kinds.includes('hire') || kinds.includes('attack')
      ? ` (${[kinds.includes('fetch') && 'a "fetch" block also has "land"', (kinds.includes('learn') || kinds.includes('cast')) && '"learn" and "cast" blocks also have "spell"', (kinds.includes('court') || kinds.includes('hire') || kinds.includes('attack')) && '"court", "hire" and "attack" blocks also have "who" (a "social" block may)'].filter(Boolean).join('; ')})`
      : ''
  }`;
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
