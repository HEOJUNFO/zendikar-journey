// Turns the engine's log lines into prose: a chronicle for the observer, second person for
// the player. It describes; it never decides what happened.
import { formatClock } from '../clock.ts';
import { player } from '../state.ts';
import type { NarrateInput } from '../run.ts';
import { region } from '../world.ts';
import { chatCompletion } from './chat.ts';
import { loreText, playerText } from './context.ts';

const SYSTEM_PROMPT = `You are the narrator of a living fantasy world (the plane of Zendikar).
You turn a simulation log into short Korean prose. Describe only what the log says happened:
you may add sensory detail and mood, but never new events, people, outcomes or dialogue.
Write plain prose (no headings, lists or quotes of the log), 2 to 6 sentences.`;

export async function narrate({ world, state, entries }: NarrateInput): Promise<string | null> {
  const p = player(state);
  const voice = p
    ? `Write in the second person ("당신") for the player character, ${p.name}, who is now in ${region(world, p.region).name}${p.travel ? ' (on the road)' : ''}. They only know what the log shows.
Player: ${playerText(state)}`
    : 'Write as a chronicle of the world, in the third person, like a historian recording the day.';
  const log = entries.map((e) => `${formatClock(e.t)} ${e.text}`).join('\n');
  const content = await chatCompletion(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `World lore:\n${loreText(world)}\n\n${voice}\n\nLog:\n${log}`,
      },
    ],
    1200,
  );
  const text = content.trim();
  return text || null;
}
