// Tapping a land for an ability other than its mana ("{T}: ..."): it gives no mana that day
// (Actor.landsTapped), and it can't be done if its mana is already spent, it came in tapped
// today, or it was tapped for something already.
import { flooded } from './flood.ts';
import { gameDay } from './clock.ts';
import { manaCapacity } from './mana.ts';
import { landSealed, sealText } from './seal.ts';
import type { Actor, State } from './state.ts';
import { josa } from './text.ts';
import type { World } from './world.ts';

// `a` with `landId` tapped today, for checking what they would have left.
export function withTapped(a: Actor, landId: string, t: number): Actor {
  const day = gameDay(t);
  const ids = a.landsTapped?.day === day ? a.landsTapped.ids : [];
  return { ...a, landsTapped: { day, ids: [...ids, landId] } };
}

// Why they can't tap the land now, or null.
export function landTapBlocked(state: State, world: World, a: Actor, landId: string, t: number): string | null {
  const r = world.regions.find((x) => x.id === landId);
  if (!r) return '그런 땅은 없다.';
  if (!a.bonds?.includes(r.id)) return `${josa(r.name, '과', '와')} 유대를 맺지 않았다.`;
  const sealer = landSealed(state, a, r, t);
  if (sealer) return `${sealText(sealer, t)} ${josa(r.name, '은', '는')} 마나 말고는 아무것도 내주지 않는다.`;
  if (flooded(state, world, r)) return `${josa(r.name, '은', '는')} 바다에 잠겨 섬이 되었다. 제 힘이 잠겼다.`;
  const rs = state.regions[r.id];
  if (rs?.destroyed) return `${josa(r.name, '은', '는')} 부서졌다.`;
  if (rs?.conditions.some((c) => c.tapped)) return `${josa(r.name, '은', '는')} 지금 쓸 수 없다.`;
  const day = gameDay(t);
  if (r.entersTapped && a.landfalls?.day === day && a.landfalls.regions.includes(r.id)) return `오늘 유대를 맺어 ${josa(r.name, '은', '는')} 아직 쓸 수 없다.`;
  if (a.landsTapped?.day === day && a.landsTapped.ids.includes(r.id)) return `오늘 이미 ${josa(r.name, '을', '를')} 썼다.`;
  // Its mana already spent today: it is tapped.
  const cap = manaCapacity(state, world, withTapped(a, r.id, t), t);
  const spent = a.manaSpent?.day === day ? a.manaSpent.spent : {};
  if (Object.entries(spent).some(([c, n]) => (n ?? 0) > (cap[c as keyof typeof cap] ?? 0))) return `오늘 ${r.name}의 마나를 이미 썼다.`;
  return null;
}

export function tapLand(a: Actor, landId: string, t: number) {
  const day = gameDay(t);
  if (a.landsTapped?.day !== day) a.landsTapped = { day, ids: [] };
  a.landsTapped.ids.push(landId);
}
