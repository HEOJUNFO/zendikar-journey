// Punishing Fire (spell `return_on_life_gain`): "Whenever an opponent gains life, you may pay {R}.
// If you do, return this card from your graveyard to your hand." A spell cast is used, not
// discarded; one let go of (forgotten, in their graveyard) may come back: when another in the same
// land as them (its areas too, user decision 2026-10-02) gains life, they pay its cost if they can
// (always: a boon) and hold the spell again. The gains are gathered as they come (sim/life.ts
// `gainLife`, no world there) and answered each hour (sim/step.ts).
import { manaAvailable, payMana, planPayment } from './mana.ts';
import { addLog } from './state.ts';
import type { State } from './state.ts';
import { josa, shortName } from './text.ts';
import { region, topOf } from './world.ts';
import type { World } from './world.ts';

export function punishHour(state: State, world: World, t: number) {
  const gains = state.lifeGains ?? [];
  delete state.lifeGains;
  if (!gains.length) return;
  const spells = world.spells.filter((s) => s.returnOnLifeGain);
  if (!spells.length) return;
  const topId = (regionId: string) => topOf(world, region(world, regionId)).id;
  for (const g of gains) {
    const gainer = state.actors[g.id];
    if (!gainer) continue;
    for (const a of Object.values(state.actors)) {
      if (a.dead || a.id === gainer.id || !a.graveyard?.length || a.travel || topId(a.region) !== topId(g.region)) continue;
      for (const s of spells) {
        if (!a.graveyard.includes(s.id) || a.exiled?.includes(s.id)) continue;
        const cost = s.returnOnLifeGain!;
        if (!planPayment(manaAvailable(state, world, a, t), cost.cost)) continue;
        payMana(state, world, a, cost.cost, t);
        a.graveyard = a.graveyard.filter((x) => x !== s.id);
        a.spells = [...new Set([...(a.spells ?? []), s.id])];
        addLog(state, { kind: 'effect', text: `${josa(shortName(gainer.name), '이', '가')} 생기를 얻자, ${josa(shortName(a.name), '이', '가')} ${cost.text}을 들여 잊었던 ${josa(s.name, '을', '를')} 다시 손에 쥐었다.`, regions: [a.region], actors: [a.id, gainer.id], t });
      }
    }
  }
}
