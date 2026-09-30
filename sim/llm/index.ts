// The LLM hooks for sim/run.ts. Throws when CHAT_PROVIDER or its key is missing.
import type { Llm } from '../run.ts';
import { getHostedChat } from './chat.ts';
import { gmDay } from './gm.ts';
import { interpret } from './interpret.ts';
import { narrate } from './narrate.ts';
import { planDay } from './planner.ts';
import { converse } from './converse.ts';
import { evade, reply } from './reply.ts';
import { choose, chooseColor, chooseSummon } from './choose.ts';

export function createLlm(): Required<Llm> {
  getHostedChat(); // fail early on a missing key
  return { planDay, gmDay, narrate, interpret, reply, evade, converse, choose, chooseColor, summon: chooseSummon };
}
