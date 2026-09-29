// The LLM hooks for sim/run.ts. Throws when CHAT_PROVIDER or its key is missing.
import type { Llm } from '../run.ts';
import { getHostedChat } from './chat.ts';
import { gmDay } from './gm.ts';
import { interpret } from './interpret.ts';
import { narrate } from './narrate.ts';
import { planDay } from './planner.ts';
import { evade, reply } from './reply.ts';

export function createLlm(): Required<Llm> {
  getHostedChat(); // fail early on a missing key
  return { planDay, gmDay, narrate, interpret, reply, evade };
}
