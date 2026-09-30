// An NPC picks whom an effect of theirs falls on (a land's "target player loses 1 life"), in
// character: from the people there, by what they think of them.
import { z } from 'zod';
import { ptOf } from '../state.ts';
import type { ChooseInput } from '../run.ts';
import { relationsText } from '../relations.ts';
import { shortName } from '../text.ts';
import { chatCompletion, extractJson } from './chat.ts';

export async function choose({ state, npc, what, candidates }: ChooseInput): Promise<string | null> {
  const me = state.actors[npc.id];
  const people = candidates.map(
    (a) => `- ${a.id}: ${shortName(a.name)}${a.id === npc.id ? ' (you)' : a.kind === 'player' ? ' (the player)' : ''} (power/toughness ${ptOf(a).join('/')})`,
  );
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are ${npc.name}, a character in the plane of Zendikar.
Who you are: ${npc.persona}
Your goal: ${npc.goal}
You must pick exactly one of the people listed. Answer with JSON only: {"pick": "<id>"}.`,
      },
      {
        role: 'user',
        content: `${what}

People here:
${people.join('\n')}
${me ? `\nWhat you think of those you know:\n${relationsText(me).join('\n') || '(no one yet)'}` : ''}

Whom do you pick?`,
      },
    ],
    300,
  );
  const parsed = z.object({ pick: z.string() }).safeParse(extractJson(content));
  if (!parsed.success || !candidates.some((a) => a.id === parsed.data.pick)) {
    console.warn(`Unusable pick from ${npc.id}:`, content);
    return null;
  }
  return parsed.data.pick;
}
