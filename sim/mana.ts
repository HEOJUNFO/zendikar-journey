// Mana (world/README.md: MTG 규칙 → 게임 대응). Beings from cards hold their card's mana
// value in its colors; the player gets one mana of a land's color per land they have bonded
// with. Everything refills when a turn starts (00:00). Destroyed and tapped lands give none.
import { gameDay } from './clock.ts';
import type { State } from './state.ts';
import type { World } from './world.ts';

export const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
export type Color = (typeof COLORS)[number];
// Colorless mana (from a colorless land). Pays generic costs only.
export type ManaSymbol = Color | 'C';
export type Mana = Partial<Record<ManaSymbol, number>>;
export const COLOR_LABELS: Record<ManaSymbol, string> = { W: '백', U: '청', B: '흑', R: '적', G: '녹', C: '무색' };

export type ManaCost = { generic: number; colored: Partial<Record<Color, number>> };

// "{5}{B}{B}" -> { generic: 5, colored: { B: 2 } }
export function parseManaCost(text: string): ManaCost | null {
  const cost: ManaCost = { generic: 0, colored: {} };
  const symbols = text.match(/\{[^}]+\}/g);
  if (!symbols || symbols.join('') !== text) return null;
  for (const s of symbols) {
    const inner = s.slice(1, -1);
    if (/^\d+$/.test(inner)) cost.generic += Number(inner);
    else if ((COLORS as readonly string[]).includes(inner)) {
      const c = inner as Color;
      cost.colored[c] = (cost.colored[c] ?? 0) + 1;
    } else return null;
  }
  return cost;
}

export function formatMana(mana: Mana) {
  return (Object.entries(mana) as [ManaSymbol, number][])
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${COLOR_LABELS[c]} ${n}`)
    .join(', ') || '없음';
}

// What someone can draw on each turn.
export function manaCapacity(state: State, world: World, a: { id: string; bonds?: string[] }): Mana {
  const def =
    world.npcs.find((n) => n.id === a.id) ?? state.tokens?.[a.id];
  const out: Mana = { ...(def?.mana ?? {}) };
  for (const id of a.bonds ?? []) {
    const r = world.regions.find((x) => x.id === id);
    const rs = state.regions[id];
    if (!r || rs?.destroyed || rs?.conditions.some((c) => c.tapped)) continue;
    const sym: ManaSymbol = r.color ?? 'C';
    out[sym] = (out[sym] ?? 0) + 1;
  }
  return out;
}

type Spender = { id: string; bonds?: string[]; manaSpent?: { day: number; spent: Mana } };

export function manaAvailable(state: State, world: World, a: Spender, t: number): Mana {
  const cap = manaCapacity(state, world, a);
  const spent = a.manaSpent?.day === gameDay(t) ? a.manaSpent.spent : {};
  const out: Mana = {};
  for (const [c, n] of Object.entries(cap) as [ManaSymbol, number][]) out[c] = Math.max(0, n - (spent[c] ?? 0));
  return out;
}

// Which mana would pay `cost`, or null if it can't be paid. Colored symbols first, then
// generic from colorless, then from whatever color is most plentiful.
export function planPayment(available: Mana, cost: ManaCost): Mana | null {
  const left: Mana = { ...available };
  const pay: Mana = {};
  const take = (c: ManaSymbol, n: number) => {
    left[c] = (left[c] ?? 0) - n;
    pay[c] = (pay[c] ?? 0) + n;
  };
  for (const [c, n] of Object.entries(cost.colored) as [Color, number][]) {
    if ((left[c] ?? 0) < n) return null;
    take(c, n);
  }
  let generic = cost.generic;
  while (generic > 0) {
    const [c, n] = (Object.entries(left) as [ManaSymbol, number][])
      .filter(([, n]) => n > 0)
      .sort((x, y) => (x[0] === 'C' ? -1 : y[0] === 'C' ? 1 : y[1] - x[1]))[0] ?? [];
    if (!c || !n) return null;
    take(c, 1);
    generic--;
  }
  return pay;
}

// Pays if possible. Returns whether it was paid.
export function payMana(state: State, world: World, a: Spender, cost: ManaCost, t: number) {
  const plan = planPayment(manaAvailable(state, world, a, t), cost);
  if (!plan) return false;
  const day = gameDay(t);
  if (a.manaSpent?.day !== day) a.manaSpent = { day, spent: {} };
  for (const [c, n] of Object.entries(plan) as [ManaSymbol, number][]) a.manaSpent.spent[c] = (a.manaSpent.spent[c] ?? 0) + n;
  return true;
}
