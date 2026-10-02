// What a character is doing in a schedule block. Drives stat effects (rules.ts) and
// whether characters in the same region meet (step.ts).
// bond: bonding with the land they stand on (landfall), one land a day.
// claim: taming an item that stands where they are (sim/items.ts), when one is theirs to take.
// store_day / spend_day: leaving a day in a land that keeps them, or taking one back (sim/eons.ts).
// grow: tapping a land like Oran-Rief for the creatures that came into play today (abilities.ts).
// fetch: giving up a fetch land they hold to bond with the block's `land` from afar (abilities.ts).
// learn / cast: learning the block's `spell` where it is taught, or casting one they hold on
// someone there (spells.ts).
// recall: tapping a Sea Gate Loremaster they control to draw a spell per Ally (sim/loremaster.ts).
// equip: putting equipment they hold on the block's `who` (themselves if none; sim/equipment.ts).
// bite: having one they control bearing Predatory Urge bite the block's `who` (going to them;
// sim/bite.ts): the biter is tapped, the two deal each other their power.
// scout: tapping a Frontier Guide they control to bond from afar with a basic land (sim/tapper.ts).
// gale: tapping a Caller of Gales they control (paying its cost) so the block's `who` (themselves if
// none) flies until midnight (sim/tapper.ts).
// shield / loot: tapping a Noble Vestige (ward against the next damage today) or a Reckless
// Scholar (draw, then discard) they control for the block's `who` (themselves if none; going to
// them; sim/tapper.ts).
// altar: offering the block's `who` (one who serves them) at a Carnage Altar they own, walking to
// it (sim/altar.ts): they come to know a secret.
// expedition: ending an Ior Ruin Expedition they own (enough quest counters), anywhere
// (sim/expedition.ts): it is gone, they come to know secrets.
// chart: using an Expedition Map they own, anywhere (sim/chart.ts): it is gone, a land of the
// world comes into their hand.
// fling: having the bearer of a Blazing Torch they own throw it at the block's `who` on the
// bearer's tile (sim/fling.ts).
// hex: having a Vampire Hexmage they control sacrifice itself to strip the counters of the block's
// `who` ("being:<id>" or "item:<id>") on their tile (sim/hexmage.ts).
// set_trap: setting the block's `trap` (one they hold, Trapmaker's Snare) where they stand,
// paying its card's cost (sim/snare.ts).
// ascend: calling down an angel token with a Luminarch Ascension they own (enough quest counters,
// paying its cost), anywhere (sim/luminarch.ts).
// attack: going after the block's `who` (wherever they are) and falling on them: they become
// foes and fight from the next hour (sim/combat.ts), as the player's attack.
export const LIFE_KINDS = ['sleep', 'eat', 'work', 'social', 'leisure', 'bond', 'claim', 'store_day', 'spend_day', 'grow', 'fetch', 'learn', 'cast', 'court', 'hire', 'attack', 'recall', 'equip', 'bite', 'shield', 'loot', 'scout', 'altar', 'expedition', 'ascend', 'set_trap', 'hex', 'fling', 'gale', 'chart'] as const;
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
  // court: the beast whose trust they seek (sim/retainers.ts); hire: the mercenary (sim/allies.ts);
  // social: one they seek out to talk with (optional); attack: one they go after; bite: one to
  // bite; equip: who bears it.
  who?: string;
  // set_trap: the trap they set (sim/snare.ts).
  trap?: string;
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
