// Journey to Nowhere (spell effect `exile_until`): "When this enters, exile target creature. When
// this leaves the battlefield, return the exiled card to the battlefield under its owner's
// control." In this world (user decision 2026-10-02), the one it falls on (a creature or the
// player, no planeswalker) is taken nowhere: gone from the world, no one can reach them and no
// time passes for them (as one out of time, sim/state.ts `outOfTime`). They leave play: all that
// was on them falls away and so does whoever controlled them (sim/bounce.ts `shed`); a token is
// gone for good. The enchantment is the caster's, held as an aura on them (nothing to their
// strength): when it is gone (destroyed, returned, sacrificed, or its caster dies or leaves the
// plane), the one taken comes back, on the tile they vanished from, under their own control.
import { shed, vanishToken } from './bounce.ts';
import { remember } from './relations.ts';
import { addLog } from './state.ts';
import type { Actor, State } from './state.ts';
import { josa, shortName } from './text.ts';
import type { World } from './world.ts';

// Takes `target` nowhere, held by `caster`'s enchantment `spell`.
export function sendNowhere(state: State, world: World, caster: Actor, target: Actor, spell: { id: string; name: string }, t: number) {
  if (state.tokens?.[target.id]) return vanishToken(state, target, t, spell.name, '빛의 소용돌이 속으로 녹아들어 영영 사라졌다.');
  shed(state, world, target, spell.name);
  // Off the field: no one's foe of today, nor they anyone's.
  delete target.foes;
  for (const y of Object.values(state.actors)) if (y.foes?.ids.includes(target.id)) y.foes = { ...y.foes, ids: y.foes.ids.filter((f) => f !== target.id), struck: y.foes.struck?.filter((f) => f !== target.id) };
  Object.assign(target, { task: undefined, travel: undefined, forced: undefined, nowhere: { by: caster.id, spell: spell.id } });
  caster.auras = [...(caster.auras ?? []), { spell: spell.id, name: `${spell.name} (${shortName(target.name)})`, by: caster.id, pt: [0, 0], doubleLifeOnHit: false, nowhere: target.id }];
  remember(target, caster, `${spell.name}(으)로 나를 어디에도 없는 곳에 가두었다`, t);
  addLog(state, { kind: 'event', text: `${spell.name}: ${josa(shortName(target.name), '이', '가')} 빛의 소용돌이 속으로 풍경처럼 녹아들어 사라졌다. ${josa(shortName(caster.name), '이', '가')} 지닌 그 마법이 사라질 때까지 어디에도 없다.`, regions: [target.region], actors: [target.id, caster.id], t });
}

// Whether the enchantment holding `a` nowhere is still in the world.
function held(state: State, a: Actor) {
  const by = a.nowhere && state.actors[a.nowhere.by];
  return !!by && !by.dead && !by.left && !!by.auras?.some((au) => au.nowhere === a.id);
}

// Those whose enchantment is gone come back where they vanished (each hour, sim/step.ts).
export function nowhereHour(state: State, t: number) {
  for (const a of Object.values(state.actors)) {
    if (!a.nowhere || a.dead || held(state, a)) continue;
    delete a.nowhere;
    addLog(state, { kind: 'event', text: `${josa(shortName(a.name), '을', '를')} 가두던 마법이 사라져, ${josa(shortName(a.name), '이', '가')} 사라졌던 자리에 다시 나타났다.`, regions: [a.region], actors: [a.id], t });
  }
}
