// World context shared by the prompts.
import { formatClock } from '../clock.ts';
import { player, ptOf } from '../state.ts';
import { COLOR_LABELS } from '../mana.ts';
import type { State } from '../state.ts';
import { shortName } from '../text.ts';
import type { World } from '../world.ts';

export function loreText(world: World) {
  return world.lore.map((l) => `- [${l.kind}] ${l.name}: ${l.summary}`).join('\n');
}

export function whereaboutsText(world: World, state: State) {
  return world.regions
    .map((r) => {
      const here = Object.values(state.actors)
        .filter((a) => a.region === r.id && !a.travel && !a.dead)
        .map((a) => (a.kind === 'player' ? `${shortName(a.name)}(플레이어)` : shortName(a.name)));
      const conds = [
        ...(state.regions[r.id]?.destroyed ? ['부서진 땅'] : []),
        ...(state.regions[r.id]?.conditions.map((c) => c.label) ?? []),
      ];
      const land = r.color ? `${COLOR_LABELS[r.color]}색 땅` : '무색 땅';
      return `- ${r.id} ${r.name} (${land}): ${r.summary}${conds.length ? ` [${conds.join(', ')}]` : ''}${here.length ? ` — ${here.join(', ')}` : ''}`;
    })
    .join('\n');
}

export function playerText(state: State) {
  const p = player(state);
  if (!p) return '';
  const s = p.stats;
  return `${p.name}. ${p.background ?? ''} (공격력/방어력 ${ptOf(p).join('/')}, 기력 ${Math.round(s.energy)}/100, 배고픔 ${Math.round(s.hunger)}/100, 돈 ${Math.round(s.coin)})`;
}

export function clockText(state: State) {
  return formatClock(state.minutes);
}
