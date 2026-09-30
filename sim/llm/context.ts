// World context shared by the prompts.
import { formatClock } from '../clock.ts';
import { player, ptOf } from '../state.ts';
import { lifeOf } from '../life.ts';
import { manaLabel } from '../mana.ts';
import type { Actor, State } from '../state.ts';
import { shortName } from '../text.ts';
import { bondEffectText, placeName } from '../world.ts';
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
      const land = `${r.noMana ? '마나 없는' : r.color ? `${manaLabel(r.color)}색` : '무색'} 땅${r.entersTapped ? ', 유대 맺은 날은 마나 없음' : ''}${r.onBond.map((x) => `, ${bondEffectText(x)}`).join('')}`;
      return `- ${r.id} ${placeName(world, r)} (${land}): ${r.summary}${conds.length ? ` [${conds.join(', ')}]` : ''}${here.length ? ` — ${here.join(', ')}` : ''}`;
    })
    .join('\n');
}

export function playerText(state: State) {
  const p = player(state);
  if (!p) return '';
  return `${p.name}. ${p.background ?? ''} (${bearingText(state, p)})`;
}

// What others can tell of someone standing before them: strength, state, what they carry.
// The same for the player and for an NPC another NPC talks with.
export function bearingText(state: State, a: Actor) {
  const s = a.stats;
  const items = Object.values(state.items ?? {}).filter((x) => x.owner === a.id).map((x) => x.name);
  const life = lifeOf(a);
  return `공격력/방어력 ${ptOf(a).join('/')}, 기력 ${Math.round(s.energy)}/100${life !== null ? `, 생명 ${life}` : ''}, 배고픔 ${Math.round(s.hunger)}/100, 돈 ${Math.round(s.coin)}${items.length ? `, 길들인 것: ${items.join(', ')}` : ''}`;
}

export function clockText(state: State) {
  return formatClock(state.minutes);
}
