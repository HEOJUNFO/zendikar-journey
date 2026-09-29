// What a character is doing in a schedule block. Drives stat effects (rules.ts) and
// whether characters in the same region meet (step.ts).
export const LIFE_KINDS = ['sleep', 'eat', 'work', 'social', 'leisure'] as const;
export type LifeKind = (typeof LIFE_KINDS)[number];

// start/end are minutes of the game day, 0..1440, end exclusive.
export type ScheduleBlock = {
  start: number;
  end: number;
  regionId: string;
  activity: string;
  emoji: string;
  kind: LifeKind;
};

export type Schedule = {
  day: number;
  source: 'routine' | 'llm';
  blocks: ScheduleBlock[];
};

export function currentBlock(blocks: ScheduleBlock[], minute: number) {
  return blocks.find((b) => b.start <= minute && minute < b.end);
}

export type Stats = {
  energy: number; // 0 exhausted .. 100 rested
  hunger: number; // 0 full .. 100 starving
  coin: number;
};

// How carefully someone moves through a region. Ancient traps wake more easily for
// those who push in fast (law-ruin-traps); the careful may dodge an omened event.
export const PACES = ['careful', 'normal', 'hasty'] as const;
export type Pace = (typeof PACES)[number];
