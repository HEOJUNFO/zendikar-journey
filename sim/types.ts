// What a character is doing in a schedule block. Drives stat effects (rules.ts) and
// whether characters in the same region meet (step.ts).
// bond: bonding with the land they stand on (landfall), one land a day.
// claim: taming an item that stands where they are (sim/items.ts), when one is theirs to take.
// store_day / spend_day: leaving a day in a land that keeps them, or taking one back (sim/eons.ts).
// grow: tapping a land like Oran-Rief for the creatures that came into play today (abilities.ts).
// fetch: giving up a fetch land they hold to bond with the block's `land` from afar (abilities.ts).
// learn / cast: learning the block's `spell` where it is taught, or casting one they hold on
// someone there (spells.ts).
export const LIFE_KINDS = ['sleep', 'eat', 'work', 'social', 'leisure', 'bond', 'claim', 'store_day', 'spend_day', 'grow', 'fetch', 'learn', 'cast'] as const;
export type LifeKind = (typeof LIFE_KINDS)[number];

// start/end are minutes of the game day, 0..1440, end exclusive.
export type ScheduleBlock = {
  start: number;
  end: number;
  regionId: string;
  activity: string;
  emoji: string;
  kind: LifeKind;
  // fetch: the land sought.
  land?: string;
  // learn / cast: the spell.
  spell?: string;
};

export type Schedule = {
  day: number;
  // 'routine' only in saves from when characters had written routines.
  source: 'routine' | 'llm';
  blocks: ScheduleBlock[];
};

export function currentBlock(blocks: ScheduleBlock[], minute: number) {
  return blocks.find((b) => b.start <= minute && minute < b.end);
}

// Which stats a being lives by. People have all three; an angel may only tire.
export const NEEDS = ['energy', 'hunger', 'coin'] as const;
export type Need = (typeof NEEDS)[number];

export type Stats = {
  energy: number; // 0 exhausted .. 100 rested
  hunger: number; // 0 full .. 100 starving
  coin: number;
};

// How carefully someone moves through a region. Ancient traps wake more easily for
// those who push in fast (law-ruin-traps); the careful may dodge an omened event.
export const PACES = ['careful', 'normal', 'hasty'] as const;
export type Pace = (typeof PACES)[number];
