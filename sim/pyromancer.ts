// Pyromancer Ascension (an item, effect `spell_quest`): "Whenever you cast an instant or sorcery
// spell that has the same name as a card in your graveyard, you may put a quest counter on this.
// Whenever you cast an instant or sorcery spell while this has two or more quest counters on it,
// you may copy that spell. You may choose new targets for the copy." Its owner casting a spell
// that is no enchantment (no aura, no Journey to Nowhere) that they once let go of and learned
// again (in their graveyard too: user decision 2026-10-02, as the card) puts a counter on it
// (always, a boon). With enough as they cast, they may cast it once more, free, on anyone it could
// fall on there (the copy: their pick after the hour, sim/run.ts / sim/asks.ts `cast` free).
import { addLog } from './state.ts';
import type { Actor, State } from './state.ts';
import { castTargets } from './spells.ts';
import { shortName } from './text.ts';
import type { SpellDef, World } from './world.ts';

// Instants and sorceries: no enchantment (aura, a held exile).
export function instantOrSorcery(s: SpellDef) {
  return !s.effects.some((e) => e.type === 'aura' || e.type === 'exile_until');
}

// `a` casts `s` (paid, not free): the copy first (counted as it stood), then the counter.
export function pyromancerCast(state: State, world: World, a: Actor, s: SpellDef, t: number) {
  if (!instantOrSorcery(s)) return;
  for (const x of world.items) {
    const e = x.effects.find((y) => y.type === 'spell_quest');
    const st = state.items?.[x.id];
    if (e?.type !== 'spell_quest' || !st || st.gone || st.owner !== a.id) continue;
    if (st.counters >= e.counters) {
      const candidates = castTargets(state, a, s, world).map((y) => y.id);
      if (candidates.length) {
        (state.choices ??= []).push({ by: a.id, land: a.region, effect: { type: 'cast', spell: s.id, free: true }, candidates, optional: true, t });
        addLog(state, { kind: 'effect', text: `${x.name}: ${shortName(a.name)}의 ${s.name}이(가) 불길 속에서 둘로 갈라진다. 하나 더 걸 수 있다.`, regions: [a.region], actors: [a.id], t });
      }
    }
    if (a.graveyard?.includes(s.id)) {
      st.counters += 1;
      addLog(state, { kind: 'effect', text: `${shortName(a.name)}의 ${x.name}에 탐색 카운터가 하나 쌓였다 (${st.counters}/${e.counters}): 한 번 잊었던 ${s.name}을(를) 다시 불렀다.${st.counters === e.counters ? ' 이제 쓰는 주문마다 불길이 둘로 갈라진다.' : ''}`, regions: [a.region], actors: [a.id], t });
    }
  }
}
