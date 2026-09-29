// Two NPCs who met talk, in character. What they now think of each other is remembered
// (sim/relations.ts); one of them may turn on the other.
import { z } from 'zod';
import { formatClock } from '../clock.ts';
import type { Conversation, ConverseInput } from '../run.ts';
import { recentNews } from '../run.ts';
import { relationTo } from '../relations.ts';
import { ptOf } from '../state.ts';
import { shortName } from '../text.ts';
import { placeName, region } from '../world.ts';
import { chatCompletion, extractJson } from './chat.ts';
import { loreText } from './context.ts';

const ConverseSchema = z.object({
  lines: z.array(z.object({ who: z.enum(['a', 'b']), say: z.string().min(1) })).min(1).max(8),
  impressions: z.object({ a: z.string().min(1), b: z.string().min(1) }),
  attack: z.enum(['a', 'b']).nullable().default(null),
});

export async function converse({ world, state, a, b }: ConverseInput): Promise<Conversation | null> {
  const [x, y] = [state.actors[a.id], state.actors[b.id]];
  const who = (s: typeof a, me: typeof x, other: typeof y) =>
    `${s.name} (power/toughness ${ptOf(me).join('/')}), doing: ${me.task?.activity ?? '(nothing)'}
  Who they are: ${s.persona}
  Goal: ${s.goal}
  What they think of ${shortName(other.name)}: ${relationTo(me, other.id) ?? '(they have not met before)'}`;
  const news = recentNews(state, world);
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: `You write a short exchange between two characters of the plane of Zendikar who just met. Stay true to each.
Answer with JSON only:
{"lines":[{"who":"a","say":"<Korean, one or two sentences, no name prefix>"},{"who":"b","say":"..."}],
 "impressions":{"a":"<Korean, one short line: what A now thinks of B>","b":"<what B now thinks of A>"},
 "attack":null}
2 to 6 lines. "attack" is "a" or "b" only if that one, in character, now attacks the other; this is rare. Fights between them knock out, not kill.`,
      },
      {
        role: 'user',
        content: `World lore:
${loreText(world)}

Now: ${formatClock(state.minutes)}, in ${placeName(world, region(world, x.region))}.
${news.length ? `Lately:\n${news.map((n) => `- ${n}`).join('\n')}\n` : ''}
A: ${who(a, x, y)}

B: ${who(b, y, x)}`,
      },
    ],
    1200,
  );
  const parsed = ConverseSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    console.warn(`Unusable conversation between ${a.id} and ${b.id}:`, content);
    return null;
  }
  const id = { a: a.id, b: b.id };
  return {
    lines: parsed.data.lines.map((l) => ({ by: id[l.who], say: l.say.trim() })),
    impressions: { [a.id]: parsed.data.impressions.a, [b.id]: parsed.data.impressions.b },
    attacker: parsed.data.attack ? id[parsed.data.attack] : null,
  };
}
