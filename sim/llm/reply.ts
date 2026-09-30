// An NPC answers the player, in character.
import { formatClock } from '../clock.ts';
import { foresees, foresightText } from '../foresight.ts';
import { z } from 'zod';
import { player, ptOf } from '../state.ts';
import type { EvadeInput, Reply, ReplyInput } from '../run.ts';
import { recentNews } from '../run.ts';
import { shortName } from '../text.ts';
import { region } from '../world.ts';
import { chatCompletion, extractJson } from './chat.ts';
import { bearingText, loreText, playerText } from './context.ts';
import { relationsText, relationTo } from '../relations.ts';
import { swayBlocked } from '../retainers.ts';

const ReplySchema = z.object({
  say: z.string().min(1),
  attack: z.boolean().default(false),
  follow: z.boolean().default(false),
  impression: z.string().optional(),
});

export async function reply({ world, state, npc, say, beast }: ReplyInput): Promise<Reply | null> {
  const p = player(state)!;
  const me = state.actors[npc.id];
  const canFollow = !swayBlocked(state, world, me);
  const name = shortName(npc.name);
  // Their past exchanges, oldest first (the player's new line is already logged).
  const history = state.log
    .filter((e) => e.kind === 'speech' && e.actors.includes(npc.id) && e.actors.includes(p.id))
    .slice(-12)
    .map((e) => `${formatClock(e.t)} ${e.text}`);
  const news = recentNews(state, world);
  // One who foresees knows what is still to come today (sim/foresight.ts); telling it is theirs to choose.
  const ahead = foresees(state, world, npc.id) ? foresightText(state, world, state.minutes) : null;
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are ${npc.name}, a character in the plane of Zendikar. Stay in character.
Who you are: ${npc.persona}
Your goal: ${npc.goal}
Your role: ${npc.role}
Your power/toughness is ${ptOf(state.actors[npc.id]).join('/')}; theirs is ${ptOf(p).join('/')}. Fights here are deadly.
${beast ? `You are a beast: you have no words and do not understand speech as people do, only tone, bearing and deeds.\n` : ''}${canFollow ? `You serve no one. If, in character and won over by ${beast ? 'who they are and how they carry themselves' : 'what they say and who they are'}, you now ${beast ? 'accept them as the one you follow' : 'pledge to follow and serve them as their retainer'}, set "follow": true. That is rare and a big step.\n` : ''}Answer with JSON only: {"say": "${beast ? `<in Korean, 1 or 2 sentences of third-person narration of what you do in answer (a look, a sound, a movement), beginning with ${shortName(npc.name)}; no speech>` : '<your spoken words in Korean, 1 to 3 sentences, no name prefix or narration>'}", "attack": <true only if, in character, you now attack them>,${canFollow ? ' "follow": <true only if you now pledge to serve them>,' : ''} "impression": "<Korean, one short line: what you now think of them>"}`,
      },
      {
        role: 'user',
        content: `World lore:
${loreText(world)}

Now: ${formatClock(state.minutes)}, in ${region(world, me.region).name}. You are doing: ${me.task?.activity ?? '(nothing)'}.
${news.length ? `Lately:\n${news.map((n) => `- ${n}`).join('\n')}\n` : ''}${ahead ? `You see what is coming. Still to come today (yours to tell or keep, in character):\n${ahead.length ? ahead.map((n) => `- ${n}`).join('\n') : '- nothing out of the ordinary'}\n` : ''}
The one speaking to you: ${playerText(state)}
What you think of them: ${relationTo(me, p.id) ?? '(you have not met before)'}
${relationsText(me).length ? `Others you know:\n${relationsText(me).join('\n')}\n` : ''}
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
  return text
    ? { say: text, attack: parsed.data.attack, follow: canFollow && parsed.data.follow, impression: parsed.data.impression?.trim() || undefined }
    : null;
}

// Attacked by someone who can't fly: take to the air, or stand and fight?
export async function evade({ world, state, npc, attacker }: EvadeInput): Promise<boolean> {
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are ${npc.name}, a character in the plane of Zendikar. You can fly; the one attacking you cannot. If you fly off, they can't reach you until midnight.
Who you are: ${npc.persona}
Your goal: ${npc.goal}
Answer with JSON only: {"evade": true} to fly out of reach, or {"evade": false} to stand and fight.`,
      },
      {
        role: 'user',
        content: `World lore:\n${loreText(world)}\n\n${shortName(attacker.name)} (${bearingText(state, attacker)}) attacks you (${ptOf(state.actors[npc.id]).join('/')}) in ${region(world, attacker.region).name}.${attacker.kind === 'player' ? ` ${playerText(state)}` : ''}\nWhat you think of them: ${relationTo(state.actors[npc.id], attacker.id) ?? '(you have not met before)'}`,
      },
    ],
    400,
  );
  const parsed = z.object({ evade: z.boolean() }).safeParse(extractJson(content));
  return parsed.success ? parsed.data.evade : false;
}
