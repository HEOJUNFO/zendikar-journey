// An NPC answers the player, in character.
import { formatClock } from '../clock.ts';
import { player } from '../state.ts';
import type { ReplyInput } from '../run.ts';
import { recentNews } from '../run.ts';
import { shortName } from '../text.ts';
import { region } from '../world.ts';
import { chatCompletion } from './chat.ts';
import { loreText, playerText } from './context.ts';

export async function reply({ world, state, npc, say }: ReplyInput): Promise<string | null> {
  const p = player(state)!;
  const me = state.actors[npc.id];
  const name = shortName(npc.name);
  // Their past exchanges, oldest first (the player's new line is already logged).
  const history = state.log
    .filter((e) => e.kind === 'speech' && e.actors.includes(npc.id) && e.actors.includes(p.id))
    .slice(-12)
    .map((e) => `${formatClock(e.t)} ${e.text}`);
  const news = recentNews(state, world);
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are ${npc.name}, a character in the plane of Zendikar. Stay in character.
Who you are: ${npc.persona}
Your goal: ${npc.goal}
Your role: ${npc.role}
Reply in Korean with only your spoken words (no name prefix, no narration, no quotes), 1 to 3 sentences.`,
      },
      {
        role: 'user',
        content: `World lore:
${loreText(world)}

Now: ${formatClock(state.minutes)}, in ${region(world, me.region).name}. You are doing: ${me.task?.activity ?? '(nothing)'}.
${news.length ? `Lately:\n${news.map((n) => `- ${n}`).join('\n')}\n` : ''}
The one speaking to you: ${playerText(state)}

Conversation so far:
${history.join('\n')}

Reply as ${name} to: ${say}`,
      },
    ],
    800,
  );
  const text = content.trim().replace(/^["“”']+|["“”']+$/g, '').replace(new RegExp(`^${name}\\s*:\\s*`), '');
  return text || null;
}
