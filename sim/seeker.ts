// Blood Seeker (`sim.drain_on_join`): "Whenever a creature an opponent controls enters, you may have
// that player lose 1 life." One on its tile not of its side (its controller and theirs) gains a
// creature (a retainer joining: hired, won over, owned, raised back; or one born theirs): that one
// loses N life (always: [가공]). Counted at the end of each hour, for what came since the last.
import { loseLife } from './life.ts';
import { remember } from './relations.ts';
import { masterOf, retainersOf } from './retainers.ts';
import { powersSealed } from './seal.ts';
import { alive, npcDef, together } from './state.ts';
import type { State } from './state.ts';
import { shortName } from './text.ts';
import type { World } from './world.ts';

export function bloodSeekHour(state: State, world: World, now: number) {
  const since = state.seekScan ?? now;
  state.seekScan = now;
  const seekers = alive(state).filter((s) => npcDef(state, world, s.id)?.drainOnJoin && !powersSealed(state, world, s, now));
  if (!seekers.length) return;
  // Those who came under someone's control in [since, now).
  const come = alive(state).filter((x) => {
    if (!x.master) return false;
    const when = Math.max(x.joinedAt ?? -Infinity, state.tokens?.[x.id] ? (x.enteredAt ?? -Infinity) : -Infinity);
    return when >= since && when < now;
  });
  for (const s of seekers) {
    const controller = masterOf(state, s) ?? s;
    const side = new Set([controller.id, s.id, ...retainersOf(state, controller.id).map((r) => r.id)]);
    const n = npcDef(state, world, s.id)!.drainOnJoin!;
    for (const x of come) {
      const owner = state.actors[x.master!];
      if (!owner || owner.dead || side.has(owner.id) || !together(owner, s)) continue;
      loseLife(state, owner, n, now, `${shortName(s.name)}의 피 냄새 (${shortName(x.name)}이(가) 들어옴)`, s);
      if (!owner.dead) remember(owner, s, '내 피 한 방울을 앗아 갔다', now);
    }
  }
}
