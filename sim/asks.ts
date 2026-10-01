// Picks the player owes (state.asks): nothing else happens until they answer (sim/run.ts `act`).
// What an NPC decides by the LLM, the player decides here: whom an Ally's rally in their party
// falls on (sim/allies.ts), whether to serve one who asks it of them, and whether to take to
// the air when one who can't fly sets on them.
import { applyStrike } from './electro.ts';
import { applyExile, banishOptions } from './banish.ts';
import { answerCounter, answerCounterCast, summon } from './counter.ts';
import { untapTime } from './clock.ts';
import { applyDrainGrow, applyEnterDestroy, applySearch } from './abilities.ts';
import { crushOwed, crushRelic, demolish, demolishOptions, relicsHere } from './relics.ts';
import { applyRally, rallyText, rallyWord } from './allies.ts';
import { bindRetainer, refuse } from './retainers.ts';
import { cardLabel, discardOwed, handOf, letGo } from './discard.ts';
import { crumble, sacrifice, sacrificeDefault } from './monument.ts';
import { applyQuell, permanentsOf, QUELL_KINDS, QUELL_LABELS, quellGive } from './quell.ts';
import { castSpell } from './spells.ts';
import { addLog, npcDef, player, together } from './state.ts';
import { applyPump } from './pump.ts';
import type { Actor, Choice, State } from './state.ts';
import { josa, shortName } from './text.ts';
import { CREATURE_TYPE_LABELS, region } from './world.ts';
import { answerReturnLand } from './items.ts';
import { answerTide } from './tide.ts';
import { applyBind } from './bind.ts';
import type { World } from './world.ts';

// What the pick is about, for them.
export function askText(state: State, world: World, c: Choice) {
  const from = 'from' in c.effect ? state.actors[c.effect.from] : undefined;
  if (c.effect.type === 'rally') return `${rallyText(state, world, c.effect.source)}. 누구에게?`;
  if (c.effect.type === 'pledge') return `${josa(shortName(from?.name ?? ''), '이', '가')} 자신을 따르고 섬기라 한다`;
  if (c.effect.type === 'evade') return `날지 못하는 ${josa(shortName(from?.name ?? ''), '이', '가')} 덤벼든다. 날아올라 피하면 자정까지 닿지 않는다`;
  if (c.effect.type === 'discard') return `${c.effect.cause}: 지닌 주문 ${c.effect.count ? `${c.effect.count}개를` : '하나를'} 잊어야 한다. 먼저 무엇을?`;
  if (c.effect.type === 'pilfer') return `${shortName(state.actors[c.effect.source]?.name ?? '')}의 손길에 ${shortName(state.actors[c.effect.target]?.name ?? '')}의 주문이 드러났다. 그가 잊을 하나를 고른다`;
  if (c.effect.type === 'pour') {
    const x = state.actors[c.effect.source];
    const pump = x && npcDef(state, world, x.id)?.pump;
    return `${shortName(x?.name ?? '')}의 싸움이 이어진다. 마나 ${pump?.costText ?? ''}를 낼 때마다 자정까지 +${pump?.pt[0]}/+${pump?.pt[1]}. 얼마나 부을까?`;
  }
  if (c.effect.type === 'cast' && c.effect.second) return `${world.spells.find((s) => s.id === (c.effect as { spell: string }).spell)?.name ?? ''}의 둘째 대상: 자신이나 곁의 권속 가운데 누구에게?`;
  if (c.effect.type === 'cast') return `${world.spells.find((s) => s.id === (c.effect as { spell: string }).spell)?.name ?? ''}을(를) 하나 더, 값 없이 걸 수 있다. 누구에게?`;
  if (c.effect.type === 'sacrifice') return `${state.items?.[c.effect.item]?.name ?? c.effect.item}이(가) 오늘의 제물을 요구한다. 부리는 이(당신 자신도) 가운데 누구를 바칠까? (바친 이는 죽는다) 아니면 그것을 무너뜨려 내놓는다.`;
  if (c.effect.type === 'demolish') return `${c.effect.spell}: 이 자리의 마법물체 하나나 땅 하나를 부순다 (땅은 7일 동안 누구에게도 아무것도 내주지 않는다). 무엇을?`;
  if (c.effect.type === 'crush') return `${c.effect.spell}: 이 자리의 마법물체나 부여마법을 ${c.effect.first ? '부순다. 무엇을?' : '하나 더 부술 수 있다. 무엇을?'}`;
  if (c.effect.type === 'drain_grow') return `땅의 타락한 마나가 흐른다. 누구에게서 생명 ${c.effect.life}을 빼앗아 +1/+1 카운터 ${c.effect.counters}을 얻을까?`;
  if (c.effect.type === 'quell') {
    const s = shortName(state.actors[c.effect.source]?.name ?? '');
    return `${s}의 새벽: 유형 하나를 부르면 ${s} 곁의 모두(당신도)가 그 유형의 제 것 하나를 내놓는다 (땅: 유대 하나, 생물: 부리는 생물 하나, 마법물체: 아이템 하나, 부여마법: 오라 하나). 무엇을?`;
  }
  if (c.effect.type === 'bind') return `${shortName(state.actors[c.effect.source]?.name ?? '')}의 싸움이 이어진다. 마나 ${npcDef(state, world, c.effect.source)?.tapFoe?.costText ?? ''}를 내면 날지 못하는 적 하나를 자정까지 묶을 수 있다. 누구를?`;
  if (c.effect.type === 'counter') {
    const s = world.spells.find((x) => x.id === (c.effect as { spell: string }).spell);
    return `${shortName(state.actors[c.effect.joiner]?.name ?? '')}이(가) ${shortName(state.actors[c.effect.master]?.name ?? '')}의 곁에 들려 한다 (${c.effect.how}). ${s?.name ?? ''}(${s?.costText ?? ''})로 무산시키면 그는 들지 못하고 당신 곁에 ${s?.summary ?? ''}. 어떻게?`;
  }
  if (c.effect.type === 'strike') return `${shortName(state.actors[c.effect.creature]?.name ?? '')}이(가) 당신을 섬기러 들었다. ${state.items?.[c.effect.item]?.name ?? ''}에 힘을 들이면 그가 곁의 하나에게 공격력만큼 번개를 내리꽂는다. 누구에게?`;
  if (c.effect.type === 'exile') return `${shortName(state.actors[c.effect.source]?.name ?? '')}의 빛이 이 자리의 지속물 하나를 추방한다 (반드시 하나: 존재는 세상에서 지워지고, 오라·아이템은 사라지고, 땅은 그 이와의 유대가 영영 끊긴다). 무엇을?`;
  if (c.effect.type === 'counter_cast') {
    const e = c.effect;
    const [cast, s, target] = [world.spells.find((x) => x.id === e.cast), world.spells.find((x) => x.id === e.spell), state.actors[e.target]];
    const on = !target || target.id === e.caster ? '' : ` ${shortName(target.name)}에게`;
    return `${shortName(state.actors[e.caster]?.name ?? '')}이(가)${on} ${cast?.name ?? ''}을(를) 걸려 한다 (${cast?.summary ?? ''}). ${s?.name ?? ''}(${s?.costText ?? ''})로 무효화할까?`;
  }
  if (c.effect.type === 'tide') return `나를 섬기는 ${shortName(state.actors[c.effect.source]?.name ?? '')}이(가) 썰물에 무너지려 한다. 유대를 맺은 땅 하나를 내어 주면(다시 맺을 수 있다) 남는다. 어느 땅을?`;
  if (c.effect.type === 'search') return `${shortName(state.actors[c.effect.source]?.name ?? '')}이(가) 잊힌 길을 안다. 아직 유대가 없는 땅 하나와 멀리서 유대를 맺을 수 있다 (하루 한 땅에 들지 않고, 오늘은 마나를 내지 않는다). 어느 땅과?`;
  if (c.effect.type === 'return_lands') return `${state.items?.[c.effect.item]?.name ?? c.effect.item}: 유대를 맺은 땅 ${c.effect.left}곳을 내어 주어야 한다 (다시 맺을 수 있다). 먼저 어느 땅을?`;
  if (c.effect.type === 'quelled') return `${shortName(state.actors[c.effect.source]?.name ?? '')} 앞에서 제 ${QUELL_LABELS[c.effect.kind]} 하나를 내놓아야 한다. 무엇을?`;
  if (c.effect.type === 'destroy') return `이곳에 들어서며 ${c.effect.kind ? `${CREATURE_TYPE_LABELS[c.effect.kind]} ` : ''}하나를 ${c.effect.kicker ? `힘(${c.effect.kicker})을 더 들여 ` : ''}파괴할 수 있다. 누구를? (파괴된 이는 죽는다)`;
  return '';
}

// The answers they may give: a pick (someone's id), or null.
export function askOptions(state: State, world: World, c: Choice): { pick: string | null; label: string }[] {
  if (c.effect.type === 'discard') return c.candidates.map((id) => ({ pick: id, label: world.spells.find((s) => s.id === id)?.name ?? id }));
  if (c.effect.type === 'pour') return c.candidates.map((n) => ({ pick: n, label: n === '0' ? '붓지 않는다' : `${n}번 붓는다` }));
  if (c.effect.type === 'pilfer') {
    const target = state.actors[c.effect.target];
    return c.candidates.map((id) => ({ pick: id, label: cardLabel(world, id) }));
  }
  if (c.effect.type === 'demolish') {
    const p = state.actors[c.by];
    return p ? demolishOptions(state, world, p).map((o) => ({ pick: o.id as string | null, label: o.label })) : [];
  }
  if (c.effect.type === 'crush') {
    const relics = relicsHere(state, world, c.land, state.actors[c.by]?.tile);
    const opts = c.candidates.map((id) => ({ pick: id as string | null, label: relics.find((r) => r.id === id)?.label ?? id }));
    return c.effect.first ? opts : [...opts, { pick: null, label: '그만둔다' }];
  }
  if (c.effect.type === 'quell') return [...QUELL_KINDS.map((k) => ({ pick: k as string | null, label: QUELL_LABELS[k] })), { pick: null, label: '부르지 않는다' }];
  if (c.effect.type === 'counter') return [{ pick: c.effect.joiner, label: `무산시킨다 (${world.spells.find((x) => x.id === (c.effect as { spell: string }).spell)?.costText ?? ''})` }, { pick: null, label: '두고 본다' }];
  if (c.effect.type === 'exile') {
    const source = state.actors[c.effect.source];
    const ex = source && npcDef(state, world, source.id)?.enterExile;
    return source && ex ? banishOptions(state, world, source, ex.color, state.minutes).filter((o) => c.candidates.includes(o.id)).map((o) => ({ pick: o.id as string | null, label: o.label })) : [];
  }
  if (c.effect.type === 'counter_cast') return [{ pick: c.effect.caster, label: `무효화한다 (${world.spells.find((x) => x.id === (c.effect as { spell: string }).spell)?.costText ?? ''})` }, { pick: null, label: '두고 본다' }];
  if (c.effect.type === 'tide') return [...c.candidates.map((id) => ({ pick: id as string | null, label: region(world, id).name })), { pick: null, label: '내어 주지 않는다 (흩어진다)' }];
  if (c.effect.type === 'search') return [...c.candidates.map((id) => ({ pick: id as string | null, label: region(world, id).name })), { pick: null, label: '맺지 않는다' }];
  if (c.effect.type === 'return_lands') {
    const p = state.actors[c.by];
    return (p?.bonds ?? []).map((id) => ({ pick: id as string | null, label: region(world, id).name }));
  }
  if (c.effect.type === 'quelled') {
    const p = state.actors[c.by];
    const owned = p ? permanentsOf(state, world, p, c.effect.kind) : [];
    return owned.map((x) => ({ pick: x.id, label: x.label }));
  }
  // One must be given: no "none".
  if (c.effect.type === 'sacrifice') return [...c.candidates.map((id) => ({ pick: id as string | null, label: id === c.by ? `${shortName(state.actors[id]?.name ?? id)} (자신)` : shortName(state.actors[id]?.name ?? id) })), { pick: c.effect.item, label: `${state.items?.[c.effect.item]?.name ?? c.effect.item}을(를) 무너뜨린다` }];
  if (c.effect.type === 'pledge') return [{ pick: c.effect.from, label: '따른다' }, { pick: null, label: '거절한다' }];
  if (c.effect.type === 'evade') return [{ pick: c.effect.from, label: '날아올라 피한다' }, { pick: null, label: '맞선다' }];
  // The second target of a spell that needs two: no "none".
  if (c.effect.type === 'cast' && c.effect.second) return c.candidates.map((id) => ({ pick: id, label: shortName(state.actors[id]?.name ?? id) }));
  return [...c.candidates.map((id) => ({ pick: id, label: shortName(state.actors[id]?.name ?? id) })), { pick: null, label: '하지 않는다' }];
}

// Whether the player may serve `master`: they serve no one, and `master` doesn't serve them.
export function canServe(p: Actor, master: Actor) {
  return !p.master && !master.dead && master.master !== p.id;
}

// The player answers the pick they owe first.
export function answerAsk(state: State, world: World, pick: string | null, t: number) {
  const c = state.asks?.shift();
  const p = player(state);
  if (!c || !p) return;
  if (c.effect.type === 'rally') {
    const target = pick ? state.actors[pick] : undefined;
    if (target && c.candidates.includes(target.id)) applyRally(state, world, c.effect.source, target.id, t);
    else addLog(state, { kind: 'status', text: `${shortName(state.actors[c.effect.source]?.name ?? '')}의 ${rallyWord(state, world, c.effect.source)}을 거두었다.`, regions: [c.land], actors: [c.by], t });
  } else if (c.effect.type === 'pledge') {
    const master = state.actors[c.effect.from];
    if (pick === master?.id && canServe(p, master)) summon(state, world, p, master, t, '설득');
    else if (master) {
      addLog(state, { kind: 'status', text: `${josa(shortName(master.name), '을', '를')} 따르기를 거절했다.`, regions: [p.region], actors: [p.id, master.id], t });
      refuse(state, master, t);
    }
  } else if (c.effect.type === 'sacrifice') {
    const living = c.candidates.map((id) => state.actors[id]).filter((x) => x && !x.dead);
    const x = pick === c.effect.item ? undefined : (living.find((y) => y.id === pick) ?? sacrificeDefault(state, p, living));
    if (x) sacrifice(state, world, x, c.effect.item, t);
    else crumble(state, world, p, c.effect.item, t, `${josa(shortName(p.name), '이', '가')} 제물 대신 내놓아`);
  } else if (c.effect.type === 'cast' && c.effect.free) {
    // A second target must be named: an answer that isn't one goes to the first there.
    const target = pick && c.candidates.includes(pick) ? state.actors[pick] : c.effect.second ? c.candidates.map((id) => state.actors[id]).find((x) => x && !x.dead && together(x, p)) : undefined;
    if (target && !target.dead && together(target, p)) castSpell(state, world, p, c.effect.spell, target.id, false, t, true);
  } else if (c.effect.type === 'discard') {
    // One they must give up: an answer that isn't one of theirs gives up the first.
    letGo(state, world, p, pick && c.candidates.includes(pick) ? pick : c.candidates[0], t);
    // More owed (Mind Sludge): the next pick comes first.
    const next = discardOwed(state, world, p, c.effect.cause, t, (c.effect.count ?? 1) - 1);
    if (next) (state.asks ??= []).unshift(next);
  } else if (c.effect.type === 'pour') {
    const x = state.actors[c.effect.source];
    const n = Number(pick);
    if (x && Number.isInteger(n) && n > 0) applyPump(state, world, x, n, t);
  } else if (c.effect.type === 'pilfer') {
    // One must go: an answer that isn't one shown takes the first still held.
    const target = state.actors[c.effect.target];
    if (!target || target.dead) return;
    const hand = handOf(target);
    const shown = c.candidates.filter((x) => hand.includes(x));
    const card = pick && shown.includes(pick) ? pick : shown[0];
    if (card) letGo(state, world, target, card, t);
  } else if (c.effect.type === 'demolish') {
    // One must go: an answer that isn't one goes to the first.
    const options = demolishOptions(state, world, p);
    const id = pick && options.some((o) => o.id === pick) ? pick : options[0]?.id;
    if (id) demolish(state, world, p, id, c.effect.spell, t);
  } else if (c.effect.type === 'crush') {
    // The first must go: an answer that isn't one goes to the first there.
    const relics = relicsHere(state, world, p.region, p.tile);
    const id = pick && relics.some((r) => r.id === pick) ? pick : c.effect.first ? relics[0]?.id : undefined;
    if (!id) return;
    crushRelic(state, world, id, p, t);
    const next = crushOwed(state, world, p, c.effect.spell, c.effect.left - 1, false, t);
    if (next) (state.asks ??= []).unshift(next);
  } else if (c.effect.type === 'quell') {
    const source = state.actors[c.effect.source];
    const kind = QUELL_KINDS.find((k) => k === pick);
    if (source && kind) applyQuell(state, world, source, kind, t);
  } else if (c.effect.type === 'bind') {
    const x = state.actors[c.effect.source];
    const target = pick && c.candidates.includes(pick) ? state.actors[pick] : undefined;
    if (x && target) applyBind(state, world, x, target, t);
  } else if (c.effect.type === 'strike') {
    if (pick && c.candidates.includes(pick)) applyStrike(state, world, p, c.effect, pick, t);
  } else if (c.effect.type === 'exile') {
    const source = state.actors[c.effect.source];
    const ex = source && npcDef(state, world, source.id)?.enterExile;
    const options = source && ex ? banishOptions(state, world, source, ex.color, t).filter((o) => c.candidates.includes(o.id)) : [];
    if (source && options.length) applyExile(state, world, source, options.find((o) => o.id === pick)?.id ?? options[0].id, t);
  } else if (c.effect.type === 'counter_cast') {
    answerCounterCast(state, world, p, c.effect, pick === c.effect.caster, t);
  } else if (c.effect.type === 'counter') {
    answerCounter(state, world, p, c.effect, pick === c.effect.joiner, t);
  } else if (c.effect.type === 'tide') {
    answerTide(state, world, p, c.effect.source, pick, t);
  } else if (c.effect.type === 'search') {
    if (pick && c.candidates.includes(pick)) applySearch(state, world, p, pick, c.effect.source, t);
  } else if (c.effect.type === 'return_lands') {
    const next = answerReturnLand(state, world, p, pick, c.effect, t);
    if (next) (state.asks ??= []).unshift(next);
  } else if (c.effect.type === 'quelled') {
    // One must be given: an answer that isn't one of theirs gives the first.
    const source = state.actors[c.effect.source];
    const owned = permanentsOf(state, world, p, c.effect.kind);
    if (source && owned.length) quellGive(state, world, p, owned.find((x) => x.id === pick)?.id ?? owned[0].id, source, t);
  } else if (c.effect.type === 'drain_grow') {
    const target = pick && c.candidates.includes(pick) ? state.actors[pick] : undefined;
    if (target) applyDrainGrow(state, world, p, target, c.effect, t);
  } else if (c.effect.type === 'destroy') {
    const target = pick && c.candidates.includes(pick) ? state.actors[pick] : undefined;
    if (target) applyEnterDestroy(state, world, p, target, t);
  } else if (c.effect.type === 'evade') {
    const from = state.actors[c.effect.from];
    if (!from) return;
    const evade = pick === from.id;
    p.evasions = [...(p.evasions ?? []).filter((x) => x.until > t && x.from !== from.id), { from: from.id, evade, until: untapTime(c.t) }];
    addLog(state, {
      kind: 'combat',
      text: evade ? `날아올라 ${shortName(from.name)}의 공격을 피했다 (자정까지 닿지 않는다).` : `${shortName(from.name)}에게 맞서기로 했다.`,
      regions: [p.region],
      actors: [p.id, from.id],
      t,
    });
  }
}
