// An NPC answers the player, in character.
import { formatClock } from '../clock.ts';
import { z } from 'zod';
import { player, ptOf } from '../state.ts';
import type { EvadeInput, Reply, ReplyInput } from '../run.ts';
import { recentNews } from '../run.ts';
import { shortName } from '../text.ts';
import { region } from '../world.ts';
import { chatCompletion, extractJson } from './chat.ts';
import { loreText, playerText } from './context.ts';

const ReplySchema = z.object({ say: z.string().min(1), attack: z.boolean().default(false) });

export async function reply({ world, state, npc, say }: ReplyInput): Promise<Reply | null> {
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
Your power/toughness is ${ptOf(state.actors[npc.id]).join('/')}; theirs is ${ptOf(p).join('/')}. Fights here are deadly.
Answer with JSON only: {"say": "<your spoken words in Korean, 1 to 3 sentences, no name prefix or narration>", "attack": <true only if, in character, you now attack them>}`,
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
  const parsed = ReplySchema.safeParse(extractJson(content));
  if (!parsed.success) {
    console.warn(`Unusable reply from ${npc.id}:`, content);
    return null;
  }
  const text = parsed.data.say.trim().replace(/^["“”']+|["“”']+$/g, '').replace(new RegExp(`^${name}\\s*:\\s*`), '');
  return text ? { say: text, attack: parsed.data.attack } : null;
}

// Attacked by someone who can't fly: take to the air, or stand and fight?
export async function evade({ world, state, npc, attacker }: EvadeInput): Promise<boolean> {
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are ${npc.name}, a character in the plane of Zendikar. You can fly; the one attacking you cannot.
Who you are: ${npc.persona}
Your goal: ${npc.goal}
Answer with JSON only: {"evade": true} to fly out of reach, or {"evade": false} to stand and fight.`,
      },
      {
        role: 'user',
        content: `World lore:\n${loreText(world)}\n\n${shortName(attacker.name)} (power/toughness ${ptOf(attacker).join('/')}) attacks you (${ptOf(state.actors[npc.id]).join('/')}) in ${region(world, attacker.region).name}. ${playerText(state)}`,
      },
    ],
    400,
  );
  const parsed = z.object({ evade: z.boolean() }).safeParse(extractJson(content));
  return parsed.success ? parsed.data.evade : false;
}
