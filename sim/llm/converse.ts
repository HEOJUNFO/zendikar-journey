// Two NPCs who met talk, in character. What they now think of each other is remembered
// (sim/relations.ts); one of them may turn on the other, or pledge to serve the other. Each
// knows of the other what an NPC knows of the player they talk with (sim/llm/reply.ts): their
// bearing, what they carry, past words between them, and, for one who foresees, what is coming.
import { z } from 'zod';
import { formatClock } from '../clock.ts';
import type { Conversation, ConverseInput } from '../run.ts';
import { canPledge, recentNews } from '../run.ts';
import { relationsText, relationTo } from '../relations.ts';
import { foresees, foresightText } from '../foresight.ts';
import { knowledgeText } from '../knowledge.ts';
import { shortName } from '../text.ts';
import { placeName, region } from '../world.ts';
import { chatCompletion, extractJson } from './chat.ts';
import { bearingText, loreText } from './context.ts';

const ConverseSchema = z.object({
  lines: z.array(z.object({ who: z.enum(['a', 'b']), say: z.string().min(1) })).min(1).max(8),
  impressions: z.object({ a: z.string().min(1), b: z.string().min(1) }),
  attack: z.enum(['a', 'b']).nullable().default(null),
  follow: z.enum(['a', 'b']).nullable().default(null),
  refused: z.enum(['a', 'b']).nullable().default(null),
});

export async function converse({ world, state, a, b }: ConverseInput): Promise<Conversation | null> {
  const [x, y] = [state.actors[a.id], state.actors[b.id]];
  // Who may pledge to serve the other: free to, as an NPC the player talks with.
  const pledge = { a: canPledge(state, world, x, y), b: canPledge(state, world, y, x) };
  const who = (s: typeof a, me: typeof x, other: typeof y) => {
    const ahead = foresees(state, world, s.id) ? foresightText(state, world, state.minutes) : null;
    const others = relationsText(me).filter((l) => !l.includes(shortName(other.name)));
    const secrets = knowledgeText(me, state.minutes);
    return `${s.name} (${bearingText(state, me)}), doing: ${me.task?.activity ?? '(nothing)'}
  Who they are: ${s.persona}
  Goal: ${s.goal}
  Role: ${s.role}
  What they think of ${shortName(other.name)}: ${relationTo(me, other.id) ?? '(they have not met before)'}${others.length ? `\n  Others they know:\n${others.map((l) => `  ${l}`).join('\n')}` : ''}${
      ahead ? `\n  They see what is coming. Still to come today (theirs to tell or keep):\n${ahead.length ? ahead.map((n) => `  - ${n}`).join('\n') : '  - nothing out of the ordinary'}` : ''
    }${secrets.length ? `\n  Secrets they have come to know (theirs to tell or keep):\n${secrets.map((n) => `  - ${n}`).join('\n')}` : ''}`;
  };
  // Their past exchanges, oldest first.
  const history = state.log
    .filter((e) => e.kind === 'speech' && e.actors.includes(x.id) && e.actors.includes(y.id))
    .slice(-12)
    .map((e) => `${formatClock(e.t)} ${e.text}`);
  const news = recentNews(state, world);
  const pledgers = (['a', 'b'] as const).filter((k) => pledge[k]);
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: `You write a short exchange between two characters of the plane of Zendikar who just met. Stay true to each.
Answer with JSON only:
{"lines":[{"who":"a","say":"<Korean, one or two sentences, no name prefix>"},{"who":"b","say":"..."}],
 "impressions":{"a":"<Korean, one short line: what A now thinks of B>","b":"<what B now thinks of A>"},
 "attack":null}
2 to 6 lines. "attack" is "a" or "b" only if that one, in character, now attacks the other; this is rare. Fights between them knock out, not kill.${
          pledgers.length
            ? `\nAdd "follow": ${pledgers.map((k) => `"${k}"`).join(' or ')} only if that one, won over by what the other says and who they are, now pledges to follow and serve the other as their retainer; that is rare and a big step. Otherwise "follow": null.`
            : ''
        }
"refused": "a" or "b" only if that one sought to make the other follow or serve them and was turned down; otherwise null.`,
      },
      {
        role: 'user',
        content: `World lore:
${loreText(world)}

Now: ${formatClock(state.minutes)}, in ${placeName(world, region(world, x.region))}.
${news.length ? `Lately:\n${news.map((n) => `- ${n}`).join('\n')}\n` : ''}
A: ${who(a, x, y)}

B: ${who(b, y, x)}
${history.length ? `\nTheir past words together:\n${history.join('\n')}` : ''}`,
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
    follower: parsed.data.follow && pledge[parsed.data.follow] ? id[parsed.data.follow] : null,
    refused: parsed.data.refused ? id[parsed.data.refused] : null,
  };
}
