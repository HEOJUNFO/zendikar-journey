// A dead one exiled from a graveyard (Ravenous Trap) is erased from the world (user decision
// 2026-10-01): no longer a dead body anywhere, but gone from existence. They leave the save,
// every memory of them goes (what others thought of them, what was known of their
// whereabouts), and every list that named them lets them go. They never come back: the world
// does not make them anew from their card (`State.erased`, `syncWorld`). What the log tells of
// them stays: that is the chronicle, not anyone's memory.
import type { State } from './state.ts';

export function eraseFromWorld(state: State, id: string) {
  if (!state.actors[id]?.dead) return;
  delete state.actors[id];
  delete state.tokens?.[id];
  state.erased = [...new Set([...(state.erased ?? []), id])];
  const drop = (ids: string[] | undefined) => ids?.filter((x) => x !== id);
  for (const a of Object.values(state.actors)) {
    if (a.relations?.[id]) delete a.relations[id];
    if (a.fallen) a.fallen = drop(a.fallen);
    if (a.foes) a.foes = { ...a.foes, ids: drop(a.foes.ids)!, ...(a.foes.struck ? { struck: drop(a.foes.struck) } : {}) };
    if (a.hurtBy) a.hurtBy = { ...a.hurtBy, ids: drop(a.hurtBy.ids)! };
    if (a.master === id) delete a.master;
    // What was known of their whereabouts (a creature's trail, sim/knowledge.ts).
    if (a.knowledge) a.knowledge = a.knowledge.filter((k) => !k.id.startsWith(`creature:${id}:`));
  }
  if (state.possessions) state.possessions = state.possessions.filter((p) => p.target !== id && p.by !== id);
  state.met = { ...state.met, pairs: state.met.pairs.filter((p) => !p.split('|').includes(id)) };
  if (state.choices)
    state.choices = state.choices
      .filter((c) => c.by !== id)
      .map((c) => ({ ...c, candidates: drop(c.candidates)! }));
}
