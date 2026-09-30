// Mana (world/README.md: MTG 규칙 → 게임 대응). Characters from cards hold their card's mana
// value in its colors; anyone gets one mana of a land's color per land they have bonded with.
// Everything refills when a turn starts (00:00). Destroyed and tapped lands give none (nor one
// its holder tapped for an ability today), nor does a land that enters tapped on the day it
// is bonded with.
import { gameDay } from './clock.ts';
import type { State } from './state.ts';
import type { NpcDef, World } from './world.ts';

export const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
export type Color = (typeof COLORS)[number];
// One of two colors, chosen when spent ({T}: Add {B} or {R}).
export type Hybrid = `${Color}/${Color}`;
// C: colorless mana (from a colorless land). Pays generic costs only.
export type ManaSymbol = Color | 'C' | Hybrid;
export type Mana = Partial<Record<ManaSymbol, number>>;
export const COLOR_LABELS: Record<Color | 'C', string> = { W: '백', U: '청', B: '흑', R: '적', G: '녹', C: '무색' };

// '흑', '무색', '흑/적'
export function manaLabel(sym: ManaSymbol) {
  return sym.split('/').map((c) => COLOR_LABELS[c as Color | 'C']).join('/');
}

// The colors a symbol can pay for.
function colorsOf(sym: ManaSymbol): string[] {
  return sym === 'C' ? [] : sym.split('/');
}

export type ManaCost = { generic: number; colored: Partial<Record<Color, number>> };

// Two costs paid together (a spell and its kicker).
export function addCosts(a: ManaCost, b: ManaCost): ManaCost {
  const colored: ManaCost['colored'] = { ...a.colored };
  for (const [c, n] of Object.entries(b.colored) as [Color, number][]) colored[c] = (colored[c] ?? 0) + n;
  return { generic: a.generic + b.generic, colored };
}

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
    .map(([c, n]) => `${manaLabel(c)} ${n}`)
    .join(', ') || '없음';
}

// A creature's colors: as given, or those of its mana.
export function creatureColors(def: NpcDef | undefined): Color[] {
  return def?.colors ?? (Object.keys(def?.mana ?? {}) as Color[]);
}

type Holder = {
  id: string;
  bonds?: string[];
  landfalls?: { day: number; regions: string[] };
  fallen?: string[];
  landsTapped?: { day: number; ids: string[] };
};

// What someone can draw on each turn (at `t`: a land that enters tapped gives nothing the day
// they bonded with it).
export function manaCapacity(state: State, world: World, a: Holder, t?: number): Mana {
  const def =
    world.npcs.find((n) => n.id === a.id) ?? state.tokens?.[a.id];
  const out: Mana = { ...(def?.mana ?? {}) };
  for (const id of a.bonds ?? []) {
    const r = world.regions.find((x) => x.id === id);
    const rs = state.regions[id];
    if (!r || r.noMana || rs?.destroyed || rs?.conditions.some((c) => c.tapped)) continue;
    if (r.entersTapped && t !== undefined && a.landfalls?.day === gameDay(t) && a.landfalls.regions.includes(id)) continue;
    if (t !== undefined && a.landsTapped?.day === gameDay(t) && a.landsTapped.ids.includes(id)) continue;
    if (r.fallenMana) {
      const { color, cost } = r.fallenMana;
      const n = (a.fallen ?? []).filter((id) => creatureColors(world.npcs.find((x) => x.id === id) ?? state.tokens?.[id]).includes(color)).length;
      out[color] = (out[color] ?? 0) + Math.max(1, n - cost);
      continue;
    }
    const sym: ManaSymbol = r.color ?? 'C';
    out[sym] = (out[sym] ?? 0) + 1;
  }
  return out;
}

type Spender = Holder & { manaSpent?: { day: number; spent: Mana } };

export function manaAvailable(state: State, world: World, a: Spender, t: number): Mana {
  const cap = manaCapacity(state, world, a, t);
  const spent = a.manaSpent?.day === gameDay(t) ? a.manaSpent.spent : {};
  const out: Mana = {};
  for (const [c, n] of Object.entries(cap) as [ManaSymbol, number][]) out[c] = Math.max(0, n - (spent[c] ?? 0));
  return out;
}

// Which mana would pay `cost`, or null if it can't be paid. Colored symbols first (from that
// color, then from two-color mana that can be it), then generic from colorless, then from
// whatever single color is most plentiful, then from two-color mana.
export function planPayment(available: Mana, cost: ManaCost): Mana | null {
  const rank = (s: ManaSymbol) => (s === 'C' ? 0 : s.includes('/') ? 2 : 1);
  const left: Mana = { ...available };
  const pay: Mana = {};
  const take = (c: ManaSymbol, n: number) => {
    left[c] = (left[c] ?? 0) - n;
    pay[c] = (pay[c] ?? 0) + n;
  };
  for (const [c, n] of Object.entries(cost.colored) as [Color, number][]) {
    let need = n;
    const exact = Math.min(need, left[c] ?? 0);
    if (exact) take(c, exact);
    need -= exact;
    while (need > 0) {
      const [h] = (Object.entries(left) as [ManaSymbol, number][])
        .filter(([s, k]) => k > 0 && s.includes('/') && colorsOf(s).includes(c))
        .sort((x, y) => y[1] - x[1])[0] ?? [];
      if (!h) return null;
      take(h, 1);
      need--;
    }
  }
  let generic = cost.generic;
  while (generic > 0) {
    const [c, n] = (Object.entries(left) as [ManaSymbol, number][])
      .filter(([, n]) => n > 0)
      .sort((x, y) => rank(x[0]) - rank(y[0]) || y[1] - x[1])[0] ?? [];
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
