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
  trap: z.string().optional(),
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
  // Secrets of the world they came to know by drawing (sim/knowledge.ts).
  knowledge?: string[];
  // What they think of the people they know ("- 이오나 (…): …").
  relations?: string[];
  // Items no one holds that they could tame today ("- itm-… in loc-…: …").
  items?: string[];
  // A land they hold that keeps days (Magosi, sim/eons.ts): days left in it, and whether they
  // can leave one or take one back today.
  days?: { land: string; cost: string; held: number; store: boolean; spend: boolean };
  // A land they hold like Oran-Rief, and the creatures it would strengthen today (when any).
  grow?: { land: string; creatures: string[] };
  // A Sea Gate Loremaster they control they could tap today, and how many spells it would bring.
  recall?: { who: string; count: number };
  // One they control bearing Predatory Urge who could bite someone today (sim/bite.ts), and their power.
  bite?: { who: string; power: number };
  // A Noble Vestige they control that could ward someone today (sim/tapper.ts), and how much.
  shield?: { who: string; amount: number };
  // A Reckless Scholar they control that could tell someone what it has heard today.
  loot?: { who: string; amount: number };
  // A Caller of Gales they control that could make someone fly today.
  gale?: { who: string; amount: number };
  // A Frontier Guide they control that could find them a basic land today.
  scout?: { who: string; amount: number };
  // A Carnage Altar they own: where it stands, and whom of theirs they could offer there.
  altar?: { name: string; at: string; who: { id: string; text: string }[] };
  // An Ior Ruin Expedition they own with enough quest counters to end, and the secrets it brings.
  expedition?: { name: string; reward: string };
  // A Luminarch Ascension they own that could call down a token now: its name and what it brings.
  ascend?: { name: string; cost: string; token: string };
  // Traps they hold and could set where they stand (Trapmaker's Snare): id, what it does, its cost.
  traps?: { id: string; text: string }[];
  // What a Vampire Hexmage they control could strip of counters (target ids and what they are).
  hex?: { who: string; targets: { id: string; text: string }[] };
  // A Blazing Torch of theirs someone bears, ready to throw: its name, the bearer, and whom it could hit.
  fling?: { name: string; bearer: string; damage: number; targets: { id: string; text: string }[] };
  // Lands they could seek out today by giving up a fetch land they hold (Arid Mesa...).
  fetch?: { id: string; text: string }[];
  // Spells they could learn (where each is taught), and spells they hold and could pay for.
  learn?: { id: string; at: string; text: string }[];
  cast?: { id: string; text: string }[];
  // Beasts that may follow someone who wins their trust, and where each is now.
  court?: { id: string; at: string; text: string }[];
  // Mercenaries they could afford to hire, and where each is now.
  hire?: { id: string; at: string; text: string }[];
  // Equipment they hold and could pay to put on someone: what it gives, and on whom (themselves
  // and their retainers).
  equip?: { text: string; who: { id: string; text: string }[] };
  // Others in the world and where each is now: whom they could seek out to talk with (not
  // beasts) or go after (attack), as the player may anyone standing with them.
  people?: { id: string; at: string; text: string; talk: boolean; attack: boolean; bite?: boolean; shield?: boolean; loot?: boolean; gale?: boolean }[];
};

// Kinds of blocks they may plan: no meals without hunger, taming only if there is an item for
// them to tame, keeping days only with a land that keeps them.
function kindsFor(input: Pick<PlanDayInput, 'needs' | 'items' | 'equip' | 'days' | 'grow' | 'recall' | 'bite' | 'shield' | 'loot' | 'gale' | 'scout' | 'altar' | 'expedition' | 'ascend' | 'traps' | 'hex' | 'fling' | 'fetch' | 'learn' | 'cast' | 'court' | 'hire' | 'people'>) {
  return LIFE_KINDS.filter(
    (k) =>
      (k !== 'eat' || input.needs.includes('hunger')) &&
      (k !== 'claim' || !!input.items?.length) &&
      (k !== 'equip' || !!input.equip) &&
      (k !== 'store_day' || !!input.days?.store) &&
      (k !== 'spend_day' || !!input.days?.spend) &&
      (k !== 'grow' || !!input.grow) &&
      (k !== 'recall' || !!input.recall) &&
      (k !== 'shield' || !!input.shield) &&
      (k !== 'loot' || !!input.loot) &&
      (k !== 'gale' || !!input.gale) &&
      (k !== 'scout' || !!input.scout) &&
      (k !== 'altar' || !!input.altar?.who.length) &&
      (k !== 'expedition' || !!input.expedition) &&
      (k !== 'ascend' || !!input.ascend) &&
      (k !== 'set_trap' || !!input.traps?.length) &&
      (k !== 'hex' || !!input.hex?.targets.length) &&
      (k !== 'fling' || !!input.fling?.targets.length) &&
      (k !== 'fetch' || !!input.fetch?.length) &&
      (k !== 'learn' || !!input.learn?.length) &&
      (k !== 'cast' || !!input.cast?.length) &&
      (k !== 'court' || !!input.court?.length) &&
      (k !== 'hire' || !!input.hire?.length) &&
      (k !== 'attack' || !!input.people?.some((x) => x.attack)) &&
      (k !== 'bite' || (!!input.bite && !!input.people?.some((x) => x.bite))),
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
    (b.kind === 'equip' && !!b.who && !input.equip?.who.some((x) => x.id === b.who)) ||
    (b.kind === 'social' && !!b.who && !people.get(b.who)?.talk) ||
    (b.kind === 'attack' && !people.get(b.who ?? '')?.attack) ||
    (b.kind === 'bite' && !people.get(b.who ?? '')?.bite) ||
    (b.kind === 'shield' && !!b.who && b.who !== input.id && !people.get(b.who)?.shield) ||
    (b.kind === 'loot' && !!b.who && b.who !== input.id && !people.get(b.who)?.loot) ||
    (b.kind === 'gale' && !!b.who && b.who !== input.id && !people.get(b.who)?.gale) ||
    (b.kind === 'set_trap' && !input.traps?.some((x) => x.id === b.trap)) ||
    (b.kind === 'hex' && !input.hex?.targets.some((x) => x.id === b.who)) ||
    (b.kind === 'fling' && !input.fling?.targets.some((x) => x.id === b.who)) ||
    (b.kind === 'altar' && (b.regionId !== input.altar?.at || !input.altar?.who.some((x) => x.id === b.who)));
  if (blocks?.some(bad)) blocks = null;
  if (!blocks) console.warn(`Unusable plan for ${input.name}:`, content);
  return blocks;
}

const SYSTEM_PROMPT = `You plan one day in the life of a character in a simulated fantasy world (the plane of Zendikar).
No one has written a routine for them: you decide their whole day from who they are, their
role and goals, their needs, what they know happened, and the people they know.
Answer with JSON only, no prose.`;

function userPrompt(input: PlanDayInput) {
  const { day, now, name, persona, goal, role, home, here, stats, life, needs, regions, news, foresight, knowledge = [], stranded, relations = [], items = [], days, grow, recall, fetch = [], learn = [], cast = [], court = [], hire = [], people = [] } = input;
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
    knowledge.length ? `\nSecrets of the world they have come to know (hidden traps, relics, where spells are taught, what is coming today):\n${knowledge.map((n) => `- ${n}`).join('\n')}\n` : ''
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
    kinds.includes('equip')
      ? `\n- "equip" takes 1 hour, and may have "who": the one to bear it (themselves if left out). They pay its mana and put ${input.equip!.text} on them. Who could bear it:\n${input.equip!.who.map((x) => `  - "${x.id}": ${x.text}`).join('\n')}`
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
    kinds.includes('recall')
      ? `\n- "recall" takes 1 hour, anywhere: ${recall!.who}, who remembers everything their band has seen, is tapped (bound until midnight) and they come to know ${recall!.count} hidden secret(s) of the world (one per Ally of their party): traps and what sets them off, where relics stand, where spells are taught, what is coming today.`
      : ''
  }${
    kinds.includes('shield')
      ? `\n- "shield" takes 1 hour; "who" is the id of one to ward (leave it out for themselves): ${input.shield!.who}, a spirit of hope, goes with them to that one and is tapped (bound until midnight), and the next ${input.shield!.amount} damage that one would take today is prevented. Once a day; for one about to be hurt.`
      : ''
  }${
    kinds.includes('altar')
      ? `\n- "altar" takes 1 hour, in the region where their ${input.altar!.name} stands (regionId "${input.altar!.at}"), and needs "who": one of theirs to offer on it; that one dies, and they come to know a hidden secret of the world. Only when, in character, it is worth a life. Whom they could offer: ${input.altar!.who.map((x) => `"${x.id}" (${x.text})`).join(', ')}.`
      : ''
  }${
    kinds.includes('expedition')
      ? `\n- "expedition" takes 1 hour, anywhere: they end their ${input.expedition!.name} (it is gone for good) and, from what it found, ${input.expedition!.reward}. Each land they bond with adds to it, so they may also wait.`
      : ''
  }${
    kinds.includes('fling')
      ? `\n- "fling" takes 1 hour and needs "who": one standing with ${input.fling!.bearer}, who bears their ${input.fling!.name}; ${input.fling!.bearer} throws it (bound until midnight; the torch is gone) and that one takes ${input.fling!.damage} damage (it may kill). Whom it could hit now: ${input.fling!.targets.map((x) => `"${x.id}" (${x.text})`).join(', ')}.`
      : ''
  }${
    kinds.includes('hex')
      ? `\n- "hex" takes 1 hour and needs "who": one of the targets; ${input.hex!.who}, a vampire hexmage standing with them, sacrifices itself (it dies; the target must be on their tile then) to strip every counter from it: a being's +1/+1 counters, a planeswalker's loyalty (it leaves the plane), an item's counters. Only when, in character, it is worth her life. Targets: ${input.hex!.targets.map((x) => `"${x.id}" (${x.text})`).join(', ')}.`
      : ''
  }${
    kinds.includes('set_trap')
      ? `\n- "set_trap" takes 1 hour, in the region of the block, and needs "trap": one they hold; they pay its cost and hide it on the tile where they stand, for whoever comes there (they know where it is; it can catch them too). Traps they hold: ${input.traps!.map((x) => `"${x.id}" (${x.text})`).join(', ')}.`
      : ''
  }${
    kinds.includes('ascend')
      ? `\n- "ascend" takes 1 hour, anywhere: they pay ${input.ascend!.cost} and through their ${input.ascend!.name} ${input.ascend!.token} comes down to serve them at their side. They may do it again later, while they have the mana.`
      : ''
  }${
    kinds.includes('scout')
      ? `\n- "scout" takes 1 hour, anywhere: ${input.scout!.who}, a frontier guide, is tapped (bound until midnight) and finds them the way to a basic land of the world they don't hold yet: they may bond with it from afar (not their land for the day; no mana from it today). It costs mana. Once a day.`
      : ''
  }${
    kinds.includes('gale')
      ? `\n- "gale" takes 1 hour; "who" is the id of one to lift (leave it out for themselves): ${input.gale!.who}, a caller of gales, goes with them to that one and is tapped (bound until midnight); they pay its cost and that one flies until midnight (can fly from those who can't, reach the sky ruins). Once a day.`
      : ''
  }${
    kinds.includes('loot')
      ? `\n- "loot" takes 1 hour; "who" is the id of one to tell (leave it out for themselves): ${input.loot!.who}, a reckless scholar, goes with them to that one and is tapped (bound until midnight); that one comes to know one hidden secret of the world, then lets go of (forgets) one spell they hold, their pick. Once a day.`
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
        }${
          kinds.includes('bite')
            ? `\n- "bite" takes 1 hour and needs "who": the id of one to bite. ${input.bite!.who} (power ${input.bite!.power}), seized by a predatory urge, goes to that one and bites: each deals the other damage equal to their power at once, and ${input.bite!.who} is then tapped (bound, unable to move or strike back) until midnight, while the one bitten becomes their foe for the day. Once a day; only when, in character, it is worth it.`
            : ''
        }\n  Others in the world, and where each is now:\n${people.map((x) => `  - "${x.id}" in ${x.at}: ${x.text}${x.talk ? '' : ' (no talking)'}${kinds.includes('attack') && !x.attack ? ' (not to attack)' : ''}${kinds.includes('bite') && !x.bite ? ' (not to bite)' : ''}`).join('\n')}\n`
      : ''
  }- Travel between regions takes hours; only change region when there is a reason.
- Let today follow from their state, news, goal and the people they know; days need not repeat.
- activity is a short Korean phrase shown on screen (e.g. "폐허 순찰"); emoji is a single emoji.

Answer: {"blocks":[{"start":0,"end":360,"regionId":"...","activity":"...","emoji":"...","kind":"sleep"}, ...]}${
    kinds.includes('fetch') || kinds.includes('learn') || kinds.includes('cast') || kinds.includes('court') || kinds.includes('hire') || kinds.includes('attack') || kinds.includes('bite')
      ? ` (${[kinds.includes('fetch') && 'a "fetch" block also has "land"', (kinds.includes('learn') || kinds.includes('cast')) && '"learn" and "cast" blocks also have "spell"', (kinds.includes('court') || kinds.includes('hire') || kinds.includes('attack') || kinds.includes('bite')) && '"court", "hire", "attack" and "bite" blocks also have "who" (a "social", "shield" or "loot" block may)'].filter(Boolean).join('; ')})`
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
