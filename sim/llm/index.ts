// The LLM hooks for sim/run.ts, or none when the LLM is off (no CHAT_PROVIDER, or SIM_LLM=off).
import type { Llm } from '../run.ts';
import { getHostedChat, llmEnabled } from './chat.ts';
import { gmDay } from './gm.ts';
import { interpret } from './interpret.ts';
import { narrate } from './narrate.ts';
import { planDay } from './planner.ts';
import { reply } from './reply.ts';

export function createLlm(): Llm {
  if (!llmEnabled()) return {};
  getHostedChat(); // fail early on a missing key
  return { planDay, gmDay, narrate, interpret, reply };
}
