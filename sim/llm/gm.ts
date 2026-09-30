// Each morning the LLM decides which of the world's events happen today, and which activated
// abilities characters use on whom. It can only pick what world/entities defines; what it does
// is up to the engine.
import { z } from 'zod';
import { ptOf, targetable } from '../state.ts';
import type { GmPlan } from '../state.ts';
import type { GmDayInput } from '../run.ts';
import { chatCompletion, extractJson } from './chat.ts';
import { clockText, loreText, whereaboutsText } from './context.ts';

const GmSchema = z.object({
  fires: z.array(z.object({ eventId: z.string(), hour: z.number().int().min(0).max(23) })).max(3),
  uses: z
    .array(z.object({ being: z.string(), ability: z.string(), target: z.string().default(''), hour: z.number().int().min(0).max(23) }))
    .max(3)
    .default([]),
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
  const targets = Object.values(input.state.actors).filter((a) => !a.dead && targetable(a, input.state.minutes)).map((a) => a.id);
  const plan = parseGmPlan(content, { ...input, targets });
  if (!plan) console.warn('Unusable events plan, no events today:', content);
  return plan;
}

const SYSTEM_PROMPT = `You keep a living fantasy world (the plane of Zendikar) turning.
Each morning you decide which world events happen today, and whether characters of legend use their
powers. Events are rare and should feel earned: respect their
usual frequency, build on what happened lately, and often decide that nothing happens. Powers that
kill are grave; use them rarely, in character, and with a reason the world could come to know.
Answer with JSON only, no prose.`;

function describeEffect(e: GmDayInput['abilities'][number]['ability']['effects'][number]) {
  switch (e.type) {
    case 'destroy':
      return 'the target dies';
    case 'raise':
      return `it rises as their ${e.creature} retainer`;
    case 'discard_spell':
      return `they let go of a spell they hold; if it is ${e.if_color}, ${e.damage} damage to the target`;
    case 'wheel':
      return `everyone where they are forgets their spells and recalls ${e.draw} at random`;
    case 'flashback':
      return `they cast every ${e.color} spell they let go of on the target, free`;
    case 'damage':
      return `${e.amount} damage to the target (it can kill)`;
    case 'gain_life':
      return `they gain ${e.amount} life`;
    case 'set_life':
      return `the target's life becomes ${e.amount} (a loss if they have more, a gain if less)`;
    case 'possess_next_turn':
      return `the target's whole next day (from midnight to midnight) is theirs: the target follows and serves them that day`;
  }
}

function userPrompt({ day, hour, world, state, eligible, abilities, news }: GmDayInput) {
  const events = eligible
    .map((e) => `- ${e.id}: ${e.name} — ${e.summary} (usually on about ${Math.round((e.chance ?? 0) * 100)}% of days)`)
    .join('\n');
  const powers = abilities
    .map(
      ({ being, ability }) =>
        `- character ${being.id} (${being.name}, ${being.pt.join('/')}${state.actors[being.id]?.loyalty !== undefined ? `, loyalty ${state.actors[being.id].loyalty}` : ''}): ability ${ability.id} "${ability.name}" — ${ability.effects.map(describeEffect).join(' + ')}${ability.tap ? ' (then tapped until midnight)' : ''}${ability.loyalty !== undefined ? ` (loyalty ${ability.loyalty > 0 ? '+' : ''}${ability.loyalty}; one loyalty ability a day; at 0 loyalty they leave this plane)` : ''}${ability.target === false ? ' (no target: use "target": "")' : ''}`,
    )
    .join('\n');
  const targets = Object.values(state.actors)
    .filter((a) => !a.dead && targetable(a, state.minutes))
    .map((a) => `- ${a.id}: ${a.name}${a.kind === 'player' ? ' (the player)' : ''}, ${ptOf(a).join('/')}, in ${a.region}`)
    .join('\n');
  return `Day ${day + 1}, now ${clockText(state)}.

World lore:
${loreText(world)}

Regions and who is there:
${whereaboutsText(world, state)}
${news.length ? `\nLately:\n${news.map((n) => `- ${n}`).join('\n')}\n` : ''}
Events you may raise today:
${events || '(none)'}

Powers characters may use today (never on themselves):
${powers || '(none)'}

Characters a power may target:
${targets}

Rules:
- fires: zero or more of the events above, each at most once, with the hour (${hour}..23) it starts.
- uses: zero or more powers above, each at most once, on one of the characters, with the hour (${hour}..23).
- note: one short Korean line on why (only the developers see it).

Answer: {"fires":[{"eventId":"...","hour":${hour}}],"uses":[{"being":"...","ability":"...","target":"...","hour":${hour}}],"note":"..."}`;
}

export function parseGmPlan(
  content: string,
  { day, hour, eligible, abilities = [], targets = [] }: Pick<GmDayInput, 'day' | 'hour' | 'eligible'> & {
    abilities?: GmDayInput['abilities'];
    targets?: string[];
  },
): GmPlan | null {
  const parsed = GmSchema.safeParse(extractJson(content));
  if (!parsed.success) return null;
  const ids = new Set(eligible.map((e) => e.id));
  const { fires, uses } = parsed.data;
  if (fires.some((f) => !ids.has(f.eventId) || f.hour < hour)) return null;
  if (new Set(fires.map((f) => f.eventId)).size !== fires.length) return null;
  const powers = new Set(abilities.map((x) => `${x.being.id}/${x.ability.id}`));
  const targeted = new Set(abilities.filter((x) => x.ability.target !== false).map((x) => `${x.being.id}/${x.ability.id}`));
  const badTarget = (u: { being: string; ability: string; target: string }) =>
    targeted.has(`${u.being}/${u.ability}`) && (!targets.includes(u.target) || u.target === u.being);
  if (uses.some((u) => !powers.has(`${u.being}/${u.ability}`) || badTarget(u) || u.hour < hour)) return null;
  // A being uses at most one loyalty ability a day.
  const loyal = uses.filter((u) => abilities.find((x) => x.being.id === u.being && x.ability.id === u.ability)?.ability.loyalty !== undefined);
  if (new Set(loyal.map((u) => u.being)).size !== loyal.length) return null;
  if (new Set(uses.map((u) => `${u.being}/${u.ability}`)).size !== uses.length) return null;
  return { day, source: 'llm', fires, uses, note: parsed.data.note };
}
