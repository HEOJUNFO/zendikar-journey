import { Infer, v } from 'convex/values';

// What an NPC is doing in a schedule block. Drives stat effects (rules.ts) and
// whether NPC-NPC conversations may start (executor.ts).
export const lifeKind = v.union(
  v.literal('sleep'),
  v.literal('eat'),
  v.literal('work'),
  v.literal('social'),
  v.literal('leisure'),
);
export type LifeKind = Infer<typeof lifeKind>;
export const LIFE_KINDS: LifeKind[] = ['sleep', 'eat', 'work', 'social', 'leisure'];

// start/end are minutes of the game day, 0..1440, end exclusive.
export const scheduleBlock = v.object({
  start: v.number(),
  end: v.number(),
  placeId: v.string(),
  activity: v.string(),
  emoji: v.string(),
  kind: lifeKind,
});
export type ScheduleBlock = Infer<typeof scheduleBlock>;

export const schedule = v.object({
  day: v.number(),
  source: v.union(v.literal('routine'), v.literal('llm')),
  blocks: v.array(scheduleBlock),
});
export type Schedule = Infer<typeof schedule>;

export function currentBlock(blocks: ScheduleBlock[], minute: number) {
  return blocks.find((b) => b.start <= minute && minute < b.end);
}

export const lifeStats = v.object({
  energy: v.number(), // 0 exhausted .. 100 rested
  hunger: v.number(), // 0 full .. 100 starving
  coin: v.number(),
});
export type LifeStats = Infer<typeof lifeStats>;

// Static per-character data (data/characters.ts): who they are in the world and
// their usual day, used as-is when LLM planning is off or fails.
export const lifeProfile = v.object({
  role: v.string(),
  home: v.string(),
  routine: v.array(scheduleBlock),
});
export type LifeProfile = Infer<typeof lifeProfile>;
