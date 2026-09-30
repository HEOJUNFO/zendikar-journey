// An NPC picks whom an effect of theirs falls on (a land's "target player loses 1 life"), in
// character: from the people there, by what they think of them.
import { z } from 'zod';
import { ptOf } from '../state.ts';
import { COLOR_LABELS, COLORS, manaCapacity } from '../mana.ts';
import type { Color } from '../mana.ts';
import { region, spellColors } from '../world.ts';
import type { ChooseColorInput, ChooseInput, SummonInput, VolleyInput } from '../run.ts';
import { loreText } from './context.ts';
import { relationsText } from '../relations.ts';
import { shortName } from '../text.ts';
import { chatCompletion, extractJson } from './chat.ts';

export async function choose({ state, npc, what, candidates, optional }: ChooseInput): Promise<string | null> {
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
${optional ? 'Pick one of the people listed, or no one. Answer with JSON only: {"pick": "<id>"} or {"pick": null}.' : 'You must pick exactly one of the people listed. Answer with JSON only: {"pick": "<id>"}.'}`,
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
  const parsed = z.object({ pick: z.string().nullable() }).safeParse(extractJson(content));
  if (optional && parsed.success && parsed.data.pick === null) return null;
  if (!parsed.success || !candidates.some((a) => a.id === parsed.data.pick)) {
    console.warn(`Unusable pick from ${npc.id}:`, content);
    return null;
  }
  return parsed.data.pick;
}

// One who seals a color (Iona, sim/seal.ts), entering a fight, names the color their
// opponents can't cast today, from what they can tell of those opponents' magic.
export async function chooseColor({ state, world, npc, opponents }: ChooseColorInput): Promise<Color | null> {
  const colors = (xs: Iterable<string>) => [...new Set(xs)].map((c) => `${c} (${COLOR_LABELS[c as Color]})`).join(', ') || 'none';
  const lines = opponents.map((a) => {
    const spells = (a.spells ?? []).map((id) => world.spells.find((s) => s.id === id)).filter((s) => !!s);
    const mana = Object.keys(manaCapacity(state, world, a, state.minutes)).flatMap((k) => k.split('/')).filter((c) => c !== 'C');
    return `- ${shortName(a.name)}${a.kind === 'player' ? ' (the player)' : ''} (power/toughness ${ptOf(a).join('/')}): mana they draw ${colors(mana)}; spells they hold ${colors(spells.flatMap(spellColors))}`;
  });
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are ${npc.name}, a character in the plane of Zendikar.
Who you are: ${npc.persona}
Your goal: ${npc.goal}
As you enter a fight you name one color of magic (W white, U blue, B black, R red, G green). Until midnight, those you fight cannot cast spells of that color.
Answer with JSON only: {"color": "W" | "U" | "B" | "R" | "G"}.`,
      },
      { role: 'user', content: `You are entering a fight with:\n${lines.join('\n')}\n\nWhich color do you seal?` },
    ],
    200,
  );
  const parsed = z.object({ color: z.enum(COLORS) }).safeParse(extractJson(content));
  if (!parsed.success) {
    console.warn(`Unusable color from ${npc.id}:`, content);
    return null;
  }
  return parsed.data.color;
}

// A summoning trap (Summoning Trap), sprung by intruders, draws one of the creatures it looked
// at (wherever they are) to where it lies, or none ("you may"): the LLM decides, as the trap.
export async function chooseSummon({ world, trap, creatures, intruders }: SummonInput): Promise<string | null> {
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are an ancient trap of the plane of Zendikar: ${trap.name}. ${trap.summary}
Someone sprang you. You may draw one of the creatures below, from wherever they are now, to where you lie, to turn on those who sprang you; or none.
Answer with JSON only: {"pick": "<id>"} or {"pick": null}.`,
      },
      {
        role: 'user',
        content: `World lore:
${loreText(world)}

Who sprang you:
${intruders.map((a) => `- ${shortName(a.name)}${a.kind === 'player' ? ' (the player)' : ''} (power/toughness ${ptOf(a).join('/')})`).join('\n') || '- (no one is left)'}

Creatures you could draw here:
${creatures.map((c) => `- ${c.id}: ${c.name}, now in ${region(world, c.region).name} (power/toughness ${ptOf(c).join('/')})`).join('\n')}

Which do you draw here?`,
      },
    ],
    300,
  );
  const parsed = z.object({ pick: z.string().nullable() }).safeParse(extractJson(content));
  if (parsed.success && parsed.data.pick === null) return null;
  if (!parsed.success || !creatures.some((c) => c.id === parsed.data.pick)) {
    console.warn(`Unusable summon from ${trap.id}:`, content);
    return creatures[0]?.id ?? null;
  }
  return parsed.data.pick;
}

// An arrow volley trap (Arrow Volley Trap) divides its damage among the attackers who set it off,
// as it chooses: the LLM decides, as the trap (all of it must fall).
export async function divideVolley({ world, trap, targets, amount }: VolleyInput): Promise<Record<string, number> | null> {
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are an ancient trap of the plane of Zendikar: ${trap.name}. ${trap.summary}
Those below attacked on your ground. Divide exactly ${amount} damage among them as you choose (whole numbers, 0 or more each, adding up to ${amount}). Damage at or over one's toughness kills.
Answer with JSON only: {"damage": {"<id>": <n>, ...}}.`,
      },
      {
        role: 'user',
        content: `World lore:
${loreText(world)}

The attackers:
${targets.map((a) => `- ${a.id}: ${shortName(a.name)}${a.kind === 'player' ? ' (the player)' : ''} (power/toughness ${ptOf(a).join('/')})`).join('\n')}

How do you divide the ${amount} damage?`,
      },
    ],
    300,
  );
  const parsed = z.object({ damage: z.record(z.string(), z.number()) }).safeParse(extractJson(content));
  if (!parsed.success) {
    console.warn(`Unusable volley from ${trap.id}:`, content);
    return null;
  }
  return parsed.data.damage;
}
