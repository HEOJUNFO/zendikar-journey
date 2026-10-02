// Turn driver. Time only moves here: the observer advances N hours, the player acts and the
// world runs until the action is done. The game passes every LLM hook (sim/llm/index.ts);
// tests pass fakes or none.
import { applyStrike, strikeTargets } from './electro.ts';
import { applyExile, banishOptions } from './banish.ts';
import { answerCounter, answerCounterCast, answerName, summon } from './counter.ts';
import { formatClock, gameDay, untapTime } from './clock.ts';
import { startAction } from './actions.ts';
import type { Action } from './actions.ts';
import { addLog, hasAbility, npcDef, outOfTime, player, ptOf, random, speakerDef, targetable, together } from './state.ts';
import type { Actor, Choice, GmPlan, LogEntry, State } from './state.ts';
import { eligibleGmEvents, ruinsUntil, step } from './step.ts';
import { addFoe, clash, dealDamage, unblockable } from './combat.ts';
import { relationsText, remember } from './relations.ts';
import { answerReturnLand, claimableItems, itemWhere } from './items.ts';
import { equipBlocked, equipmentOf, equipTargets } from './equipment.ts';
import { lifeOf } from './life.ts';
import { foresightText } from './foresight.ts';
import { knowledgeText } from './knowledge.ts';
import { setOff, wandersDue, withPositions } from './wander.ts';
import { cardLabel, discardOwed, handOf, letGo } from './discard.ts';
import { applyShatter, crushRelic, demolish, demolishOptions, relicsHere, shatterOptions } from './relics.ts';
import { applyEscape, escapeOptions } from './escape.ts';
import { applyTorch } from './torch.ts';
import { applyLift } from './aeronaut.ts';
import { applyOutfit, outfitOptions } from './outfitter.ts';
import { applyToll } from './toll.ts';
import { applyShortcut } from './shortcut.ts';
import { applySacrament } from './sacrament.ts';
import { applyDiscovery, discoveryOptions } from './discovery.ts';
import type { SacramentEffect } from './sacrament.ts';
import { loremastersOf, recallBlocked, recallCount } from './loremaster.ts';
import { biteable, readyBiter } from './bite.ts';
import { readyTapper, tapAmount, tapBlocked, tapTargetable } from './tapper.ts';
import { altarOf } from './altar.ts';
import { applyFlood, floodOptions } from './flood.ts';
import { applyGust, gustOptions } from './owl.ts';
import { eventDefOf, trapsHeld } from './snare.ts';
import { hexmagesOf, hexTargets } from './hexmage.ts';
import { applyInstigate } from './instigator.ts';
import { flingTargets, torchesOf } from './fling.ts';
import type { GustEffect } from './owl.ts';
import { applyGem, expeditionBlocked, expeditionOf, expeditionReward } from './expedition.ts';
import { ascendBlocked, ascensionOf } from './luminarch.ts';
import type { TapPower } from './tapper.ts';
import { crumble, sacrifice, sacrificeDefault } from './monument.ts';
import { answerTide } from './tide.ts';
import { topLand } from './oracle.ts';
import { strandedText } from './stranded.ts';
import { bounce, bounceCandidates } from './bounce.ts';
import { eventTile } from './tiles.ts';
import { applyQuell, permanentsOf, QUELL_KINDS, QUELL_LABELS, quellGive } from './quell.ts';
import { applyBrave, applyRally, applyWard, hireableFor, hireMerc, hirePrice, rallyText } from './allies.ts';
import { answerAsk, askText, canServe } from './asks.ts';
import { eonLand, eonsIn, spendBlocked, storeBlocked } from './eons.ts';
import { castableSpells, castBlocked, castSpell, harmful, learnableSpells, spellDef } from './spells.ts';
import { opponentsOf, sealsDue, setSeal } from './seal.ts';
import { applyPump, pumpController, pumpMax, pumpsDue } from './pump.ts';
import { applyBind, bindsDue, bindTargets } from './bind.ts';
import { applyEngulf, engulfsDue, engulfTargets, ENGULF_HOURS } from './engulf.ts';
import { applyHarrow, harrowOptions } from './harrow.ts';
import { applyHook } from './hook.ts';
import type { HarrowEffect } from './harrow.ts';
import { COLOR_LABELS, COLORS } from './mana.ts';
import type { Color } from './mana.ts';
import { abilityBlocked, applyBondEffect, applyDrainGrow, applyEnterDestroy, applyLure, applySearch, enteredToday, fetchBlocked, fetchSource, fetchTargets, growBlocked, growLand, callForth } from './abilities.ts';
import { bindRetainer, courtTargets, followBlocked, followsMaster, refuse, retainersOf, seize, swayBlocked } from './retainers.ts';
import { josa, shortName } from './text.ts';
import type { ScheduleBlock } from './types.ts';
import { ABILITY_LABELS, canStay, CREATURE_TYPE_LABELS, LAND_TYPE_LABELS, landTypes, placeName, region } from './world.ts';
import type { ActivatedAbility, EventDef, NpcDef, Region, Speaker, SpellDef, World } from './world.ts';
import type { PlanDayInput } from './llm/planner.ts';

export type GmDayInput = {
  day: number;
  hour: number;
  world: World;
  state: State;
  eligible: EventDef[];
  abilities: { being: NpcDef; ability: ActivatedAbility }[];
  news: string[];
};
export type NarrateInput = { world: World; state: State; entries: LogEntry[] };
export type InterpretInput = { world: World; state: State; text: string };
// `beast`: they have no words (a beast that may still follow someone, sim/retainers.ts): the
// reply is what they do, narrated.
// Without `say`, the NPC sought the player out and speaks first.
export type ReplyInput = { world: World; state: State; npc: Speaker; say?: string; beast?: boolean };
// What the NPC says, whether they now attack the player or pledge to serve them (become their
// retainer), and what they now think of them.
// `recruit`: they ask the player to follow and serve them (the player answers: sim/asks.ts).
// `refused`: the player sought to make them follow and they turned it down.
export type Reply = { say: string; attack: boolean; follow?: boolean; recruit?: boolean; refused?: boolean; impression?: string };
export type EvadeInput = { world: World; state: State; npc: Speaker; attacker: Actor };
export type ConverseInput = { world: World; state: State; a: Speaker; b: Speaker };
// An NPC picks whom an effect falls on (e.g. a land's "target player loses 1 life"): one of
// `candidates`, by id.
// `optional`: they may pick no one (null).
export type ChooseInput = { world: World; state: State; npc: Speaker; what: string; candidates: Actor[]; optional?: boolean };
// One who seals a color (Iona) names it as a fight begins: against `opponents`.
export type ChooseColorInput = { world: World; state: State; npc: Speaker; opponents: Actor[] };
// A trap (`trap`) sprung by `intruders` picks one of `creatures` (anywhere in the world) to draw there.
export type SummonInput = { world: World; state: State; trap: EventDef; creatures: Actor[]; intruders: Actor[] };
// A trap (`trap`) flings up to `count` of `creatures` (those there), set off by `intruders`.
export type BounceInput = { world: World; state: State; trap: EventDef; creatures: Actor[]; intruders: Actor[]; count: number };
// An NPC (`npc`) must let go of one of `spells` (their hand), for `cause`.
export type DiscardInput = { world: World; state: State; npc: Speaker; spells: SpellDef[]; cause: string };
// An NPC (`npc`) picks one of `options` (things, not people: e.g. relics to destroy), or none if `optional`.
export type PickInput = { world: World; state: State; npc: Speaker; what: string; options: { id: string; label: string }[]; optional?: boolean };
// A wandering place (`place`), at stop `at` (if any), picks the next of `stops`.
export type WanderInput = { world: World; state: State; place: Region; at?: string; stops: string[] };
// A trap (`trap`) divides `amount` damage among `targets`, the attackers who set it off.
export type VolleyInput = { world: World; state: State; trap: EventDef; targets: Actor[]; amount: number };
// A trap (`trap`) set off by `beset` (those dealt damage by many) loosing `amount` damage on one of `targets` (who hurt them).
export type AimInput = { world: World; state: State; trap: EventDef; beset: Actor[]; targets: Actor[]; amount: number };
// Two NPCs' exchange: the lines, what each now thinks of the other (by id), and who, if
// anyone, now attacks the other.
// `follower`: one who, won over, now pledges to serve the other (as an NPC may to the player).
// `refused`: one who sought to make the other follow them and was turned down.
export type Conversation = { lines: { by: string; say: string }[]; impressions: Record<string, string>; attacker: string | null; follower?: string | null; refused?: string | null };

export type Llm = {
  planDay?: (input: PlanDayInput) => Promise<ScheduleBlock[] | null>;
  gmDay?: (input: GmDayInput) => Promise<GmPlan | null>;
  narrate?: (input: NarrateInput) => Promise<string | null>;
  interpret?: (input: InterpretInput) => Promise<Action | null>;
  reply?: (input: ReplyInput) => Promise<Reply | null>;
  // A flyer attacked by someone who can't fly: fly off (true) or stand and fight.
  evade?: (input: EvadeInput) => Promise<boolean>;
  converse?: (input: ConverseInput) => Promise<Conversation | null>;
  choose?: (input: ChooseInput) => Promise<string | null>;
  chooseColor?: (input: ChooseColorInput) => Promise<Color | null>;
  // A summoning trap sprung (Summoning Trap): which of `creatures` it draws there, or none.
  summon?: (input: SummonInput) => Promise<string | null>;
  // A whiplash trap sprung (Whiplash Trap): which of `creatures` it flings (up to `count`), by id.
  bounce?: (input: BounceInput) => Promise<string[] | null>;
  // One who must let go of a spell (discard): which of `spells` they give up.
  discard?: (input: DiscardInput) => Promise<string | null>;
  // One of some things (not people): which, or none.
  pick?: (input: PickInput) => Promise<string | null>;
  // A wandering place (Goma Fada) at a stop: which of `stops` it heads for next.
  wander?: (input: WanderInput) => Promise<string | null>;
  // An arrow volley (Arrow Volley Trap): how much of `amount` falls on each of `targets`, by id.
  volley?: (input: VolleyInput) => Promise<Record<string, number> | null>;
  // A fire loosed (Inferno Trap): which of `targets` it falls on, by id.
  aim?: (input: AimInput) => Promise<string | null>;
};

// NPC conversations written per game day at most (each is one LLM call).
export const MAX_TALKS_PER_DAY = 6;

// Longest a single player action may run before control comes back.
const MAX_ACT_HOURS = 48;

export type TurnResult = { error?: string; entries: LogEntry[] };

export async function advance(state: State, world: World, hours: number, llm: Llm = {}): Promise<TurnResult> {
  const firstId = state.nextLogId;
  let error: string | undefined;
  for (let i = 0; i < hours; i++) {
    error = (await prepare(state, world, llm)) ?? undefined;
    if (error) break;
    const before = state.nextLogId;
    step(state, world);
    await conversations(state, world, before, llm);
    await choices(state, world, llm);
  }
  await narrate(state, world, firstId, llm);
  return { error, entries: state.log.filter((e) => e.id >= firstId) };
}

export async function act(state: State, world: World, input: Action | string, llm: Llm = {}): Promise<TurnResult> {
  const p = player(state);
  if (!p) return { error: '관찰자 모드에서는 행동할 수 없다.', entries: [] };
  let action: Action | null;
  if (typeof input === 'string') {
    if (!llm.interpret) throw new Error('free text needs llm.interpret');
    action = await llm.interpret({ world: withPositions(state, world), state, text: input });
    if (!action) return { error: '무슨 행동인지 알아듣지 못했다. 다르게 말해 보자.', entries: [] };
  } else action = input;

  // A pick they owe comes first, and takes no time.
  if (state.asks?.length) {
    if (action.type !== 'choose') return { error: `먼저 골라야 한다: ${askText(state, world, state.asks[0])}`, entries: [] };
    const from = state.nextLogId;
    answerAsk(state, world, action.pick, state.minutes);
    return { entries: state.log.filter((e) => e.id >= from) };
  }

  const halted = await prepare(state, world, llm);
  if (halted) return { error: halted, entries: [] };
  const firstId = state.nextLogId;
  // Out of time (their day left in Magosi, or someone else's extra day): the day passes them by.
  if (outOfTime(state, p)) {
    let n = 0;
    for (; outOfTime(state, p) && !state.over && n < MAX_ACT_HOURS; n++) {
      const stop = await prepare(state, world, llm);
      if (stop) return { error: stop, entries: state.log.filter((e) => e.id >= firstId) };
      const before = state.nextLogId;
      step(state, world);
      await conversations(state, world, before, llm);
    await choices(state, world, llm);
    }
    addLog(state, { kind: 'system', text: p.nowhere ? `어디에도 없는 곳에서 ${n}시간이 흘렀다. 아직 돌아가지 못했다.` : `${n}시간이 흐르고, 다시 움직일 수 있다.`, regions: [p.region], actors: [p.id] });
    await narrate(state, world, firstId, llm);
    return { entries: state.log.filter((e) => e.id >= firstId) };
  }
  // Wandering places where they are now (a journey to Goma Fada is as long as it is today).
  const error = startAction(state, withPositions(state, world), action);
  if (error) return { error, entries: [] };
  if (action.type === 'talk') await talk(state, world, p, action.to, action.say, llm);
  if (action.type === 'attack') await attack(state, world, p, action.to, llm);
  if (action.type === 'cast') castSpell(state, world, p, action.spell, action.to, action.kick, state.minutes);
  if (action.type === 'hire') hireMerc(state, world, p, action.to, state.minutes);

  let halt: string | undefined;
  // A pick they owe stops the world until they answer.
  for (let n = 0; busy(state, p) && !state.over && !state.asks?.length && n < MAX_ACT_HOURS; n++) {
    halt = (await prepare(state, world, llm)) ?? undefined;
    if (halt) break;
    const before = state.nextLogId;
    step(state, world);
    await conversations(state, world, before, llm);
    await choices(state, world, llm);
    // Something is happening right here: stop and let the player decide. News from afar
    // (world-scope events elsewhere) doesn't interrupt.
    // So is someone speaking to them (one who sought them out).
    const alarm = state.log.some(
      (e) =>
        e.id >= before &&
        (((e.kind === 'omen' || e.kind === 'event' || e.kind === 'combat') && e.regions.includes(p.region)) || (e.kind === 'speech' && e.actors.includes(p.id))),
    );
    if (alarm && p.task && p.task.kind !== 'fight' && !p.travel && !p.forced && p.boundUntil === undefined) {
      p.task = undefined;
      addLog(state, { kind: 'system', text: '하던 일을 멈췄다.', regions: [p.region], actors: [p.id] });
    }
  }
  await narrate(state, world, firstId, llm);
  return { error: halt, entries: state.log.filter((e) => e.id >= firstId) };
}

// NPCs who met this hour talk (step.ts logs the meeting; the words need the LLM). What they
// think of each other is remembered, and one may turn on the other: they fight next hour. One
// who sought out the player speaks to them first.
async function conversations(state: State, world: World, since: number, llm: Llm) {
  const day = gameDay(state.minutes);
  const met = state.log.filter((e) => e.id >= since && e.kind === 'meet' && e.actors.length === 2);
  for (const m of met) {
    if (state.talks?.day !== day) state.talks = { day, count: 0 };
    if (state.talks.count >= MAX_TALKS_PER_DAY) return;
    const [x, y] = m.actors.map((id) => state.actors[id]);
    if (!x || !y || x.dead || y.dead || npcDef(state, world, x.id)?.beast || npcDef(state, world, y.id)?.beast) continue;
    const p = [x, y].find((a) => a.kind === 'player');
    if (p) {
      state.talks.count++;
      await approach(state, world, p === x ? y : x, p, llm);
      continue;
    }
    if (!llm.converse) continue;
    const [a, b] = [speakerDef(state, world, x.id), speakerDef(state, world, y.id)];
    if (!a || !b) continue;
    state.talks.count++;
    let talk: Conversation | null = null;
    try {
      talk = await llm.converse({ world, state, a, b });
    } catch (e) {
      console.warn(`converse ${x.id}/${y.id} failed:`, e);
    }
    if (!talk) continue;
    for (const l of talk.lines) {
      const by = l.by === x.id ? x : y;
      addLog(state, { kind: 'speech', text: `${shortName(by.name)}: “${l.say}”`, regions: [x.region], actors: [x.id, y.id] });
    }
    if (talk.impressions[x.id]) remember(x, y, talk.impressions[x.id], state.minutes);
    if (talk.impressions[y.id]) remember(y, x, talk.impressions[y.id], state.minutes);
    // One won over pledges to serve the other, as an NPC may to the player (not both ways, not
    // with a fight).
    const follower = talk.follower === x.id ? x : talk.follower === y.id ? y : undefined;
    if (follower && !talk.attacker && canPledge(state, world, follower, follower === x ? y : x))
      summon(state, world, follower, follower === x ? y : x, state.minutes, '설득');
    const refused = talk.refused === x.id ? x : talk.refused === y.id ? y : undefined;
    if (refused && !follower) refuse(state, refused, state.minutes);
    if (talk.attacker === x.id || talk.attacker === y.id) {
      const [from, to] = talk.attacker === x.id ? [x, y] : [y, x];
      addFoe(from, to.id, state.minutes);
      addLog(state, {
        kind: 'combat',
        text: `${josa(shortName(from.name), '이', '가')} ${shortName(to.name)}에게 적의를 드러냈다.`,
        regions: [x.region],
        actors: [from.id, to.id],
      });
    }
  }
}

// An NPC lets go of one of the spells they hold (sim/discard.ts): the LLM picks, as them; with
// no usable answer, one at random.
async function discardChoice(state: State, world: World, llm: Llm, a: Actor, npc: Speaker, ids: string[], cause: string) {
  const spells = ids.filter((id) => a.spells?.includes(id)).map((id) => spellDef(world, id)).filter((s) => !!s);
  if (!spells.length) return;
  let pick: string | null = null;
  if (llm.discard) {
    try {
      pick = await llm.discard({ world, state, npc, spells, cause });
    } catch (e) {
      console.warn(`discard for ${a.id} failed:`, e);
    }
  }
  if (!pick || !spells.some((s) => s.id === pick)) pick = spells[Math.floor(random(state) * spells.length)].id;
  letGo(state, world, a, pick, state.minutes);
}

// Bala Ged Thief: the NPC controller picks which of what was shown the one robbed forgets (the
// LLM; with no usable answer, one at random). One must go.
async function pilferChoice(state: State, world: World, llm: Llm, a: Actor, npc: Speaker, c: Choice & { effect: { type: 'pilfer' } }) {
  const target = state.actors[c.effect.target];
  if (!target || target.dead) return;
  const hand = handOf(target);
  const shown = c.candidates.filter((x) => hand.includes(x));
  if (!shown.length) return;
  let pick: string | null = null;
  if (llm.pick) {
    try {
      const what = `${shortName(state.actors[c.effect.source]?.name ?? '')}의 손길에 ${shortName(target.name)}의 주문이 드러났다. 그가 잊을 하나를 고른다`;
      pick = await llm.pick({ world, state, npc, what, options: shown.map((x) => ({ id: x, label: cardLabel(world, x) })) });
    } catch (e) {
      console.warn(`pick (pilfer) for ${a.id} failed:`, e);
    }
  }
  if (!pick || !shown.includes(pick)) pick = shown[Math.floor(random(state) * shown.length)];
  letGo(state, world, target, pick, state.minutes);
}

// Harrow: the NPC caster's picks, one at a time (the LLM). The land to give up must go (with no
// usable answer, the first); a land to seek they may pass on.
async function harrowChoice(state: State, world: World, llm: Llm, a: Actor, npc: Speaker, first: HarrowEffect) {
  let eff: HarrowEffect | undefined = first;
  while (eff) {
    const options = harrowOptions(state, world, a, eff);
    if (!options.length) return;
    let pick: string | null = null;
    if (llm.pick) {
      try {
        const what = eff.given
          ? `${eff.spell}: 아직 이어지지 않은 기본 땅(세계 어디든) 하나와 멀리서 유대를 맺는다 (${eff.tapped ? '탭된 채라 그날 마나는 내지 않는다' : '그날 마나를 낸다'}, 하루 한 땅에 들지 않는다). 그만둘 수도 있다 (남은 수 ${eff.left})`
          : `${eff.spell}: ${eff.left > 0 ? '먼저 ' : ''}유대를 맺은 땅 하나를 내어 준다 (다시 맺을 수 있다). 어느 땅을?`;
        pick = await llm.pick({ world, state, npc, what, options, optional: eff.given });
      } catch (e) {
        console.warn(`pick (harrow) for ${a.id} failed:`, e);
      }
    }
    const next = applyHarrow(state, world, a, eff, pick, state.minutes);
    eff = next?.effect.type === 'harrow' ? next.effect : undefined;
  }
}

// Relic Crush: the NPC caster picks what to destroy, one at a time (the LLM); the first must go
// (with no usable answer, one at random), the rest they may let be.
async function crushChoice(state: State, world: World, llm: Llm, a: Actor, npc: Speaker, eff: { spell: string; left: number; first: boolean }) {
  let { left, first } = eff;
  while (left > 0) {
    const relics = relicsHere(state, world, a.region, a.tile);
    if (!relics.length) return;
    let pick: string | null = null;
    if (llm.pick) {
      try {
        const what = `${eff.spell}: 이 자리의 마법물체(아이템)와 부여마법(누군가에게 걸린 오라) 가운데 ${first ? '하나를 골라 부순다' : '하나를 더 부술 수 있다. 그만둘 수도 있다'}`;
        pick = await llm.pick({ world, state, npc, what, options: relics, optional: !first });
      } catch (e) {
        console.warn(`pick (crush) for ${a.id} failed:`, e);
      }
    }
    if (!relics.some((r) => r.id === pick)) {
      if (!first) return;
      pick = relics[Math.floor(random(state) * relics.length)].id;
    }
    crushRelic(state, world, pick!, a, state.minutes);
    left--;
    first = false;
  }
}

// World Queller's upkeep, as the LLM picks for its controller: which type all there must give
// up ("you may": none); or, for one who must give one up, which of theirs (with no usable
// answer: the first).
async function quellChoice(state: State, world: World, llm: Llm, a: Actor, npc: Speaker, c: Choice) {
  const source = state.actors[(c.effect as { source: string }).source];
  if (!source || source.dead) return;
  if (c.effect.type === 'quell') {
    const options = QUELL_KINDS.map((k) => ({ id: k as string, label: QUELL_LABELS[k] }));
    let pick: string | null = null;
    if (llm.pick) {
      try {
        const what = `${shortName(source.name)}의 새벽: 카드 유형 하나(땅·생물·마법물체·부여마법)를 부르면, ${shortName(source.name)} 곁의 모두(${shortName(source.name)}와 그를 부리는 이도)가 저마다 그 유형의 제 것 하나를 내놓는다 (땅: 유대 하나가 끊김, 생물: 부리는 생물 하나나 자신이 죽음, 마법물체: 길들인 아이템 하나가 사라짐, 부여마법: 몸의 오라 하나가 사라짐). 부르지 않을 수도 있다`;
        pick = await llm.pick({ world, state, npc, what, options, optional: true });
      } catch (e) {
        console.warn(`pick (quell) for ${a.id} failed:`, e);
      }
    }
    const kind = QUELL_KINDS.find((k) => k === pick);
    if (kind) applyQuell(state, world, source, kind, state.minutes);
    return;
  }
  if (c.effect.type !== 'quelled') return;
  const owned = permanentsOf(state, world, a, c.effect.kind);
  if (!owned.length) return;
  let pick: string | null = null;
  if (llm.pick) {
    try {
      pick = await llm.pick({ world, state, npc, what: `${shortName(source.name)} 앞에서 제 ${QUELL_LABELS[c.effect.kind]} 하나를 내놓아야 한다`, options: owned });
    } catch (e) {
      console.warn(`pick (quelled) for ${a.id} failed:`, e);
    }
  }
  quellGive(state, world, a, owned.find((p) => p.id === pick)?.id ?? owned[0].id, source, state.minutes);
}

// Wandering places at a stop (sim/wander.ts): the LLM, for the place's folk, picks where it
// goes next. With no answer, a stop at random (not the one it is at).
async function wanderings(state: State, world: World, llm: Llm) {
  for (const r of wandersDue(state, world)) {
    const at = state.wanderers?.[r.id]?.at;
    const stops = r.wanders!.stops.filter((s) => s.name !== at);
    let pick: string | null = null;
    if (llm.wander) {
      try {
        pick = await llm.wander({ world, state, place: r, at, stops: stops.map((s) => s.name) });
      } catch (e) {
        console.warn(`wander for ${r.id} failed:`, e);
      }
    }
    if (!pick || !stops.some((s) => s.name === pick)) pick = stops[Math.floor(random(state) * stops.length)].name;
    setOff(state, world, r, pick, state.minutes);
  }
}

// Summoning traps sprung this hour (sim/step.ts): the LLM, as the trap, draws one of the
// creatures looked at there ("you may": none). With no answer, the first of them (the top card).
async function summons(state: State, world: World, llm: Llm) {
  const due = state.summons ?? [];
  state.summons = [];
  for (const s of due) {
    const trap = eventDefOf(state, world, s.event);
    const creatures = s.creatures.map((id) => state.actors[id]).filter((a) => a && !a.dead);
    const intruders = s.by.map((id) => state.actors[id]).filter((a) => a && !a.dead);
    if (!trap || !creatures.length) continue;
    let pick: string | null = creatures[0].id;
    if (llm.summon) {
      try {
        pick = await llm.summon({ world, state, trap, creatures, intruders });
      } catch (e) {
        console.warn(`summon for ${trap.id} failed:`, e);
      }
    }
    if (pick && creatures.some((c) => c.id === pick)) callForth(state, world, pick, s.region, intruders.map((a) => a.id), state.minutes, eventTile(world, trap));
    else addLog(state, { kind: 'event', text: `${trap.name}: 문간의 어둠은 끝내 잠잠했다.`, regions: [s.region] });
  }
}

// Whiplash traps sprung this hour (sim/step.ts): the LLM, as the trap, flings up to `count` of
// the creatures there (sim/bounce.ts). With no usable answer, those who came to serve whoever
// sprang it first, then the rest, in order.
async function bounces(state: State, world: World, llm: Llm) {
  const due = state.bounces ?? [];
  state.bounces = [];
  for (const b of due) {
    const trap = eventDefOf(state, world, b.event);
    const creatures = bounceCandidates(state, world, b.region, b.tile, state.minutes);
    const intruders = b.by.map((id) => state.actors[id]).filter((a) => a && !a.dead);
    if (!trap || !creatures.length) continue;
    let picks: string[] | null = null;
    if (llm.bounce) {
      try {
        picks = await llm.bounce({ world, state, trap, creatures, intruders, count: b.count });
      } catch (e) {
        console.warn(`bounce for ${trap.id} failed:`, e);
      }
    }
    const ok = picks && picks.every((id) => creatures.some((c) => c.id === id)) ? [...new Set(picks)].slice(0, b.count) : null;
    const theirs = (c: Actor) => (c.master && b.by.includes(c.master) ? 0 : 1);
    const flung = ok ?? [...creatures].sort((x, y) => theirs(x) - theirs(y)).slice(0, b.count).map((c) => c.id);
    if (!flung.length) addLog(state, { kind: 'event', text: `${trap.name}: 줄기들은 허공만 휘젓고 잠잠해졌다.`, regions: [b.region] });
    for (const id of flung) bounce(state, world, state.actors[id], state.minutes, trap.name);
  }
}

// Arrow volleys loosed this hour (sim/step.ts): the LLM, as the trap, divides the damage among
// the attackers who set it off (all of it, as it chooses). With no usable answer, it falls one
// at a time around them, strongest first.
async function volleys(state: State, world: World, llm: Llm) {
  const due = state.volleys ?? [];
  state.volleys = [];
  for (const v of due) {
    const trap = eventDefOf(state, world, v.event);
    const targets = v.by.map((id) => state.actors[id]).filter((a) => a && !a.dead);
    if (!trap || !targets.length) continue;
    let split: Record<string, number> | null = null;
    if (llm.volley) {
      try {
        split = await llm.volley({ world, state, trap, targets, amount: v.amount });
      } catch (e) {
        console.warn(`volley for ${trap.id} failed:`, e);
      }
    }
    const shares = volleyShares(targets, v.amount, split);
    for (const a of targets) {
      const n = shares[a.id] ?? 0;
      if (n <= 0 || a.dead) continue;
      addLog(state, { kind: 'combat', text: `${trap.name}: 화살 ${n}대가 ${shortName(a.name)}에게 꽂혔다.`, regions: [a.region], actors: [a.id] });
      dealDamage(state, world, a, n, state.minutes, trap.name);
    }
  }
}

// Fires loosed this hour (Inferno Trap, sim/step.ts): the LLM, as the trap, picks which of those
// who hurt the ones beset (still alive, standing with one of them, open to its color) takes it
// all. With no usable answer, the strongest.
async function burns(state: State, world: World, llm: Llm) {
  const due = state.burns ?? [];
  state.burns = [];
  for (const b of due) {
    const trap = eventDefOf(state, world, b.event);
    const beset = b.by.map((id) => state.actors[id]).filter((a) => a && !a.dead);
    const targets = burnTargets(state, beset, b.color, state.minutes);
    if (!trap || !targets.length) continue;
    let pick: string | null = null;
    if (llm.aim) {
      try {
        pick = await llm.aim({ world, state, trap, beset, targets, amount: b.amount });
      } catch (e) {
        console.warn(`aim for ${trap.id} failed:`, e);
      }
    }
    const target = targets.find((a) => a.id === pick) ?? [...targets].sort((x, y) => ptOf(y)[0] - ptOf(x)[0] || x.id.localeCompare(y.id))[0];
    addLog(state, { kind: 'combat', text: `${trap.name}: 불길이 ${josa(shortName(target.name), '을', '를')} 휘감았다.`, regions: [target.region], actors: [target.id] });
    dealDamage(state, world, target, b.amount, state.minutes, trap.name);
  }
}

// Those who hurt the ones beset today, alive and standing with one of them, whom a trap of
// `color` may target.
export function burnTargets(state: State, beset: Actor[], color: Color | undefined, t: number) {
  const ids = new Set(beset.flatMap((a) => (a.hurtBy?.day === gameDay(t) ? a.hurtBy.ids : [])));
  return [...ids]
    .map((id) => state.actors[id])
    .filter((x) => x && !x.dead && beset.some((a) => together(a, x)) && targetable(x, t, color ? [color] : []));
}

// A division of `amount` among `targets`: the one asked for if it adds up (whole, not over,
// only to them), else one at a time around them, strongest first.
export function volleyShares(targets: Actor[], amount: number, split: Record<string, number> | null) {
  const ids = new Set(targets.map((a) => a.id));
  const ok =
    split &&
    Object.entries(split).every(([id, n]) => ids.has(id) && Number.isInteger(n) && n >= 0) &&
    Object.values(split).reduce((s, n) => s + n, 0) === amount;
  if (ok) return split!;
  const order = [...targets].sort((x, y) => ptOf(y)[0] - ptOf(x)[0] || x.id.localeCompare(y.id));
  const out: Record<string, number> = {};
  for (let i = 0; i < amount; i++) out[order[i % order.length].id] = (out[order[i % order.length].id] ?? 0) + 1;
  return out;
}

// Flyer NPCs set on this hour by one who can't fly (sim/combat.ts): do they take to the air?
// Their answer holds until midnight: out of that one's reach, or standing to fight.
async function evasions(state: State, world: World, llm: Llm) {
  const asks = state.evades ?? [];
  state.evades = [];
  for (const e of asks) {
    const [b, a, npc] = [state.actors[e.by], state.actors[e.from], speakerDef(state, world, e.by)];
    if (!b || !a || !npc || b.dead || a.dead) continue;
    let evade = false;
    if (llm.evade) {
      try {
        evade = await llm.evade({ world, state, npc, attacker: a });
      } catch (err) {
        console.warn(`evade for ${b.id} failed:`, err);
      }
    }
    const until = untapTime(e.t);
    b.evasions = [...(b.evasions ?? []).filter((x) => x.until > state.minutes && x.from !== a.id), { from: a.id, evade, until }];
    if (evade)
      addLog(state, {
        kind: 'combat',
        text: `${josa(shortName(b.name), '은', '는')} 날아올라 ${shortName(a.name)}의 공격을 피했다 (자정까지 닿지 않는다).`,
        regions: [b.region],
        actors: [b.id, a.id],
      });
  }
}

// Still doing something, or out of time (their action waits until they are back).
// Picks NPCs owe from this hour (state.choices), made by the LLM. When it can't answer, the
// engine picks at random among the candidates, so the effect still lands.
async function choices(state: State, world: World, llm: Llm) {
  await wanderings(state, world, llm);
  await evasions(state, world, llm);
  await summons(state, world, llm);
  await bounces(state, world, llm);
  await volleys(state, world, llm);
  await burns(state, world, llm);
  const due = state.choices ?? [];
  state.choices = [];
  for (const c of due) {
    const by = state.actors[c.by];
    // The player's own picks wait for them (a "choose" action).
    if (by?.kind === 'player') {
      if (!by.dead) (state.asks ??= []).push(c);
      // A joining that waited on them goes through.
      else if (c.effect.type === 'counter') answerCounter(state, world, by, c.effect, false, state.minutes);
      else if (c.effect.type === 'counter_cast') answerCounterCast(state, world, by, c.effect, false, state.minutes);
      else if (c.effect.type === 'strike' || c.effect.type === 'exile') {} // nothing waits on these
      continue;
    }
    const npc = speakerDef(state, world, c.by);
    // A discard: which spell they let go of (candidates are spells, not people).
    if (c.effect.type === 'discard') {
      // One at a time, from what they still hold.
      for (let i = 0; i < (c.effect.count ?? 1); i++) {
        const next = i === 0 ? c : discardOwed(state, world, by!, c.effect.cause, state.minutes, (c.effect.count ?? 1) - i);
        if (!next || !by || by.dead || !npc) break;
        await discardChoice(state, world, llm, by, npc, next.candidates, c.effect.cause);
      }
      continue;
    }
    // Pours and binds are asked before the hour (`pumps`, `binds`), not after.
    if (c.effect.type === 'pour' || c.effect.type === 'bind' || c.effect.type === 'engulf') continue;
    // What a thief turned up of someone's hand (candidates are spells and secrets).
    if (c.effect.type === 'pilfer') {
      if (by && !by.dead && npc) await pilferChoice(state, world, llm, by, npc, c as Choice & { effect: { type: 'pilfer' } });
      continue;
    }
    // Tempest Owl, arriving: up to three to tap there, one at a time (or none).
    if (c.effect.type === 'gust') {
      if (!by || by.dead || !npc || !llm.pick) continue;
      let eff: GustEffect | undefined = c.effect;
      while (eff) {
        const owl = state.actors[eff.source];
        const options = owl ? gustOptions(state, world, owl, state.minutes) : [];
        if (!options.length) break;
        let pick: string | null = null;
        try {
          pick = await llm.pick({ world, state, npc, what: `${shortName(owl!.name)}이(가) 들어섰다. ${eff.paid ? '' : '힘을 더 들여 '}폭풍으로 이 자리의 하나를 자정까지 묶거나, 누군가 쥔 땅을 흩어 오늘 그 땅의 마나를 못 쓰게 한다 (남은 수 ${eff.left}). 그만둘 수도 있다`, options, optional: true });
        } catch (e) {
          console.warn(`pick (gust) for ${by.id} failed:`, e);
        }
        const next = applyGust(state, world, by, eff, pick, state.minutes);
        eff = next?.effect.type === 'gust' ? next.effect : undefined;
      }
      continue;
    }
    // Spreading Seas: a land someone there holds for the sea to spread over; one must.
    if (c.effect.type === 'flood') {
      if (!by || by.dead || !npc) continue;
      const options = floodOptions(state, world, by);
      if (!options.length) continue;
      let pick: string | null = null;
      if (llm.pick) {
        try {
          pick = await llm.pick({ world, state, npc, what: `${c.effect.spell}: 이 자리의 누군가 쥐고 있는 땅 하나에 바다를 번지게 한다. 그 땅은 섬이 되어, 유대를 맺은 모두에게 청 마나만 내고 제 힘을 잃는다`, options });
        } catch (e) {
          console.warn(`pick (flood) for ${by.id} failed:`, e);
        }
      }
      if (!options.some((o) => o.id === pick)) pick = options[Math.floor(random(state) * options.length)].id;
      applyFlood(state, world, by, pick!, c.effect.spell, state.minutes);
      continue;
    }
    // Demolish: an artifact or a land to destroy; one must go (with no usable answer, at random).
    if (c.effect.type === 'demolish') {
      if (!by || by.dead || !npc) continue;
      const options = demolishOptions(state, world, by);
      if (!options.length) continue;
      let pick: string | null = null;
      if (llm.pick) {
        try {
          pick = await llm.pick({ world, state, npc, what: `${c.effect.spell}: 이 자리의 마법물체 하나나 땅 하나를 골라 부순다 (땅은 7일 동안 누구에게도 아무것도 내주지 않는다)`, options });
        } catch (e) {
          console.warn(`pick (demolish) for ${by.id} failed:`, e);
        }
      }
      if (!options.some((o) => o.id === pick)) pick = options[Math.floor(random(state) * options.length)].id;
      demolish(state, world, by, pick!, c.effect.spell, state.minutes);
      continue;
    }
    // Grim Discovery: of their graveyard, a creature to raise or a land to have in hand (or not).
    if (c.effect.type === 'discovery') {
      if (!by || by.dead || !npc || !llm.pick) continue;
      const eff = c.effect;
      const options = discoveryOptions(state, world, by, eff.kind);
      if (!options.length) continue;
      let pick: string | null = null;
      try {
        pick = await llm.pick({ world, state, npc, what: eff.kind === 'creature' ? `${eff.spell}: 당신의 무덤에 든 생물 하나를 되살릴 수 있다 (제 거처에서 눈을 뜨고, 누구도 섬기지 않는다). 누구를? 그만둘 수도 있다` : `${eff.spell}: 한때 이어졌다 끊긴 땅 하나를 손에 쥘 수 있다 (언제든 멀리서 그날의 땅으로 이을 수 있다). 어느 땅을? 그만둘 수도 있다`, options, optional: true });
      } catch (e) {
        console.warn(`pick (discovery) for ${by.id} failed:`, e);
      }
      applyDiscovery(state, world, by, eff.kind, pick, eff.spell, state.minutes);
      continue;
    }
    // Sadistic Sacrament: spells of the target's to exile, one at a time; they may stop.
    if (c.effect.type === 'sacrament') {
      if (!by || by.dead || !npc || !llm.pick) continue;
      let next: Choice | null = c;
      while (next && next.effect.type === 'sacrament') {
        const eff: SacramentEffect = next.effect;
        const target = state.actors[eff.target];
        const options = next.candidates.map((id) => ({ id, label: world.spells.find((s) => s.id === id)?.name ?? id }));
        let pick: string | null = null;
        try {
          pick = await llm.pick({ world, state, npc, what: `${eff.spell}: ${shortName(target?.name ?? '')}이(가) 아직 익히지 않은 주문 하나를 그의 앞날에서 도려낸다 (영영 익힐 수 없게 된다). 남은 수 ${eff.left}. 그만둘 수도 있다`, options, optional: true });
        } catch (e) {
          console.warn(`pick (sacrament) for ${by.id} failed:`, e);
        }
        next = applySacrament(state, world, by, eff, pick, state.minutes);
      }
      continue;
    }
    // Narrow Escape: one of what they control to return (Into the Roil: anyone's there, no land); one must (with no usable answer, at random).
    if (c.effect.type === 'escape') {
      if (!by || by.dead || !npc) continue;
      const any = c.effect.any;
      const options = escapeOptions(state, world, by, any);
      if (!options.length) continue;
      let pick: string | null = null;
      if (llm.pick) {
        try {
          pick = await llm.pick({ world, state, npc, what: any ? `${c.effect.spell}: 이 자리의 땅 아닌 것 하나를 뒤틀림 물살로 되돌린다. 남의 존재면 몸에 붙은 힘(카운터·오라·그날의 힘·상처)이 떨어지고 섬기던 이에게서 풀려나 같은 지역의 다른 곳으로 내동댕이쳐져 1시간 정신을 잃고(토큰은 사라짐), 자신이나 곁의 권속이면 그날의 싸움에서 벗어나 다른 곳으로 달아나고, 아이템이면 쌓인 것이 흩어지고 매인 것이 풀리고, 오라면 떨어진다(건 이는 다시 걸 수 있다)` : `${c.effect.spell}: 당신이 조종하는 것 하나를 거두어들인다. 자신이나 곁의 권속이면 몸에 붙은 힘이 떨어지는 대신 그날의 싸움에서 벗어나 같은 지역의 다른 곳으로 달아나고(토큰은 사라짐), 땅이면 유대를 거두어 다시 맺을 수 있고, 아이템이면 쌓인 것이 흩어지고, 오라면 다시 걸 수 있다`, options });
        } catch (e) {
          console.warn(`pick (escape) for ${by.id} failed:`, e);
        }
      }
      if (!options.some((o) => o.id === pick)) pick = options[Math.floor(random(state) * options.length)].id;
      applyEscape(state, world, by, pick!, c.effect.spell, state.minutes, any);
      continue;
    }
    // Kabira Evangel's rally: a color for the party's Allies to be protected from, or none.
    if (c.effect.type === 'brave') {
      if (!by || by.dead || !npc) continue;
      let pick: string | null = null;
      if (llm.pick) {
        try {
          pick = await llm.pick({ world, state, npc, what: `${c.effect.spell}: 색 하나를 고르면 당신과 곁의 권속 가운데 백색인 이들이 자정까지 그 색으로부터 보호받는다 (그 색 존재의 싸움 피해를 받지 않고, 그 색 주문·능력에 골라지지 않는다)`, options: COLORS.map((x) => ({ id: x, label: `${COLOR_LABELS[x]}색` })) });
        } catch (e) {
          console.warn(`pick (brave) for ${by.id} failed:`, e);
        }
      }
      applyBrave(state, world, by, COLORS.find((x) => x === pick) ?? COLORS[Math.floor(random(state) * COLORS.length)], c.effect.spell, state.minutes);
      continue;
    }
    if (c.effect.type === 'ward') {
      if (!by || by.dead || !npc || !llm.pick) continue;
      let pick: string | null = null;
      try {
        const what = `당신 무리에 동료가 들었다. ${shortName(state.actors[c.effect.source]?.name ?? '')}의 설교: 색 하나를 고르면 무리의 동료 모두가 자정까지 그 색으로부터 보호받는다 (그 색 존재의 싸움 피해를 받지 않고, 그 색 주문·능력에 골라지지 않는다). 고르지 않을 수도 있다`;
        pick = await llm.pick({ world, state, npc, what, options: COLORS.map((x) => ({ id: x, label: `${COLOR_LABELS[x]}색` })), optional: true });
      } catch (e) {
        console.warn(`pick (ward) for ${by.id} failed:`, e);
      }
      const color = COLORS.find((x) => x === pick);
      if (color) applyWard(state, world, by, c.effect.source, color, state.minutes);
      continue;
    }
    // Harrow: the land to give up (one must), then the basic lands to seek out, one at a time.
    if (c.effect.type === 'harrow') {
      if (by && !by.dead && npc) await harrowChoice(state, world, llm, by, npc, c.effect);
      continue;
    }
    // Relics to destroy (candidates are things, not people).
    if (c.effect.type === 'crush') {
      if (by && !by.dead && npc) await crushChoice(state, world, llm, by, npc, c.effect);
      continue;
    }
    // Khalni Gem: which land they give back (one must go; with no usable answer, the first).
    if (c.effect.type === 'return_lands') {
      // One at a time, all now.
      let owed: Choice | undefined = c;
      while (owed?.effect.type === 'return_lands' && by && !by.dead && npc) {
        const eff = owed.effect;
        const options = (by.bonds ?? []).map((id) => ({ id, label: region(world, id).name }));
        let pick: string | null = null;
        if (llm.pick && options.length) {
          try {
            pick = await llm.pick({ world, state, npc, what: `${state.items?.[eff.item]?.name ?? ''}을(를) 길들인 값으로 유대를 맺은 땅 하나를 내어 주어야 한다 (다시 맺을 수 있다, 하루 한 땅)`, options });
          } catch (e) {
            console.warn(`pick (return_lands) for ${by.id} failed:`, e);
          }
        }
        owed = answerReturnLand(state, world, by, pick, eff, state.minutes);
      }
      continue;
    }
    // Mold Shambler (Goblin Ruinblaster: a nonbasic land), arriving: which noncreature permanent on its tile it destroys (or none).
    if (c.effect.type === 'shatter') {
      if (by && !by.dead && npc && llm.pick) {
        const options = shatterOptions(state, world, by).filter((o) => c.candidates.includes(o.id));
        let pick: string | null = null;
        try {
          const sh = npcDef(state, world, by.id)?.enterShatter;
          const which = sh?.nonbasic ? '이름 있는 땅(기본 땅이 아닌 곳) 하나: 7일 부서진다' : sh?.relics ? '마법물체나 부여마법(아이템, 누군가에게 걸린 오라) 하나' : '생물이 아닌 것 하나(마법물체, 부여마법, 땅: 땅은 7일 부서진다)';
          pick = await llm.pick({ world, state, npc, what: `당신이 이곳에 들어섰다. 힘을 더 들여(${sh?.kickerText ?? ''}) 이 자리의 ${which}를 무너뜨릴 수 있다. 무너뜨리지 않을 수도 있다`, options, optional: true });
        } catch (e) {
          console.warn(`pick (shatter) for ${by.id} failed:`, e);
        }
        if (pick && options.some((o) => o.id === pick)) applyShatter(state, world, by, pick, state.minutes);
      }
      continue;
    }
    // Summoner's Bane: whether they answer someone joining another (sim/counter.ts). The joining
    // waits on this; with no answer, it goes through.
    if (c.effect.type === 'counter') {
      const eff = c.effect;
      let pick: string | null = null;
      const [joiner, master] = [state.actors[eff.joiner], state.actors[eff.master]];
      const s = answerName(world, eff.spell);
      if (by && !by.dead && npc && llm.pick && joiner && master) {
        try {
          const rest = s.chorus ? '' : ', 당신 곁에 2/2 청색 환영이 나 당신을 섬긴다';
          pick = await llm.pick({ world, state, npc, what: `${josa(shortName(joiner.name), '이', '가')} ${shortName(master.name)}의 곁에 들려 한다 (${eff.how}). ${s.name}(${s.costText})로 무산시킬 수 있다: 그러면 그는 들지 못하고(고용비 등 치른 것은 돌아오지 않는다)${rest}. 두고 볼 수도 있다`, options: [{ id: joiner.id, label: '무산시킨다' }], optional: true });
        } catch (e) {
          console.warn(`pick (counter) for ${c.by} failed:`, e);
        }
      }
      answerCounter(state, world, by, eff, pick === eff.joiner, state.minutes);
      continue;
    }
    // Electropotence: one come to serve them may strike someone there, if they pay (or no one).
    if (c.effect.type === 'strike') {
      const x = state.actors[c.effect.creature];
      if (by && !by.dead && npc && x && llm.choose) {
        const targets = strikeTargets(state, world, x, state.minutes).filter((y) => c.candidates.includes(y.id));
        let pick: string | null = null;
        if (targets.length) {
          try {
            pick = await llm.choose({ world, state, npc, candidates: targets, optional: true, what: `${josa(shortName(x.name), '이', '가')} 당신을 섬기러 들었다. ${state.items?.[c.effect.item]?.name ?? ''}에 힘을 들이면 그가 붉은 번개를 휘감고 곁의 하나에게 공격력(${ptOf(x)[0]})만큼 피해를 준다. 누구에게, 아니면 아무에게도` });
          } catch (e) {
            console.warn(`choose (strike) for ${c.by} failed:`, e);
          }
        }
        if (pick) applyStrike(state, world, by, c.effect, pick, state.minutes);
      }
      continue;
    }
    // Devout Lightcaster, arriving: which permanent of its color there its controller exiles (one
    // must go; with no usable answer, the first).
    if (c.effect.type === 'exile') {
      const source = state.actors[c.effect.source];
      const ex = source && npcDef(state, world, source.id)?.enterExile;
      if (by && !by.dead && npc && source && ex) {
        const options = banishOptions(state, world, source, ex.color, state.minutes).filter((o) => c.candidates.includes(o.id));
        if (!options.length) continue;
        let pick: string | null = null;
        if (llm.pick) {
          try {
            pick = await llm.pick({ world, state, npc, what: `${shortName(source.name)}의 빛이 이 자리의 ${COLOR_LABELS[ex.color]}색 지속물 하나를 추방한다 (반드시 하나). 존재는 세상에서 지워지고, 오라·아이템은 사라지고, 땅은 그 이와의 유대가 영영 끊긴다. 무엇을?`, options });
          } catch (e) {
            console.warn(`pick (exile) for ${c.by} failed:`, e);
          }
        }
        applyExile(state, world, source, options.find((o) => o.id === pick)?.id ?? options[0].id, state.minutes);
      }
      continue;
    }
    // Cancel: whether they answer a spell cast where they stand (sim/counter.ts). The spell waits
    // on this; with no answer, it takes hold.
    if (c.effect.type === 'counter_cast') {
      const eff = c.effect;
      let pick: string | null = null;
      const [caster, cast, s, target] = [state.actors[eff.caster], spellDef(world, eff.cast), answerName(world, eff.spell), state.actors[eff.target]];
      if (by && !by.dead && npc && llm.pick && caster && cast) {
        try {
          const on = !target || target.id === caster.id ? '' : ` ${shortName(target.name)}에게`;
          pick = await llm.pick({ world, state, npc, what: `${josa(shortName(caster.name), '이', '가')}${on} ${josa(cast.name, '을', '를')} 걸려 한다: ${cast.summary}. ${s.name}(${s.costText})로 무효화할 수 있다 (그 주문은 허공에서 흩어지고, 치른 마나는 돌아오지 않는다). 두고 볼 수도 있다`, options: [{ id: caster.id, label: '무효화한다' }], optional: true });
        } catch (e) {
          console.warn(`pick (counter_cast) for ${c.by} failed:`, e);
        }
      }
      answerCounterCast(state, world, by, eff, pick === eff.caster, state.minutes);
      continue;
    }
    // Living Tsunami at midnight: which land its master gives back to keep it (or none: it goes).
    if (c.effect.type === 'tide') {
      if (by && !by.dead && npc) {
        const options = c.candidates.filter((id) => (by.bonds ?? []).includes(id)).map((id) => ({ id, label: region(world, id).name }));
        let pick: string | null = null;
        if (llm.pick && options.length) {
          try {
            pick = await llm.pick({ world, state, npc, what: `당신을 섬기는 ${shortName(state.actors[c.effect.source]?.name ?? '')}이(가) 썰물에 무너지려 한다. 유대를 맺은 땅 하나를 내어 주면(다시 맺을 수 있다, 하루 한 땅) 남고, 내어 주지 않으면 흩어져 죽는다`, options, optional: true });
          } catch (e) {
            console.warn(`pick (tide) for ${by.id} failed:`, e);
          }
        }
        answerTide(state, world, by, c.effect.source, pick, state.minutes);
      }
      continue;
    }
    // Kor Cartographer, arriving: which land of that type its controller seeks out (or none).
    if (c.effect.type === 'search') {
      if (by && !by.dead && npc) {
        const options = c.candidates.map((id) => ({ id, label: region(world, id).name }));
        let pick: string | null = null;
        if (llm.pick) {
          try {
            pick = await llm.pick({ world, state, npc, what: `${shortName(state.actors[c.effect.source]?.name ?? '')}이(가) 잊힌 길을 안다. 아직 유대가 없는 땅 하나와 멀리서 유대를 맺을 수 있다 (하루 한 땅에 들지 않고, 오늘은 마나를 내지 않는다). 맺지 않을 수도 있다`, options, optional: true });
          } catch (e) {
            console.warn(`pick (search) for ${by.id} failed:`, e);
          }
        }
        if (pick && c.candidates.includes(pick)) applySearch(state, world, by, pick, c.effect.source, state.minutes);
      }
      continue;
    }
    // World Queller: a type to name (or none), then what each there gives up.
    if (c.effect.type === 'quell' || c.effect.type === 'quelled') {
      if (by && !by.dead && npc) await quellChoice(state, world, llm, by, npc, c);
      continue;
    }
    const land = world.regions.find((r) => r.id === c.land);
    const candidates = c.candidates.map((id) => state.actors[id]).filter((x) => x && !x.dead);
    if (!by || by.dead || !npc || !land || !candidates.length) continue;
    if (c.effect.type === 'pledge' || c.effect.type === 'evade') continue; // the player's alone
    if (c.effect.type === 'cast') {
      await castChoice(state, world, llm, by, npc, c.effect.spell, candidates, !!c.effect.free, !!c.effect.second);
      continue;
    }
    if (c.effect.type === 'follow') {
      await followChoice(state, world, llm, by, npc, candidates[0]);
      continue;
    }
    // A creature owed to an item (Eldrazi Monument): one given, or the item let go (user decision
    // 2026-10-01). The LLM picks, as the owner; with no usable answer, the weakest who serves
    // them, or else the item goes (never themselves unasked).
    if (c.effect.type === 'sacrifice') {
      const item = c.effect.item;
      const name = state.items?.[item]?.name ?? item;
      let pick: string | null = null;
      if (llm.pick) {
        try {
          const options = [...candidates.map((x) => ({ id: x.id, label: x.id === by.id ? `${shortName(x.name)} (당신 자신: 죽는다)` : shortName(x.name) })), { id: item, label: `${name}을(를) 무너뜨려 내놓는다 (축복도 사라진다)` }];
          pick = await llm.pick({ world, state, npc, what: `${name}이(가) 오늘의 제물을 요구한다. 당신이 부리는 생물(당신 자신도 든다) 가운데 하나를 바치거나(바친 이는 죽는다), ${josa(name, '을', '를')} 무너뜨려 내놓는다`, options });
        } catch (e) {
          console.warn(`pick (sacrifice) for ${c.by} failed:`, e);
        }
      }
      const x = pick === item ? undefined : (candidates.find((y) => y.id === pick) ?? sacrificeDefault(state, by, candidates));
      if (x) sacrifice(state, world, x, item, state.minutes);
      else crumble(state, world, by, item, state.minutes, `${josa(shortName(by.name), '이', '가')} 제물 대신 내놓아`);
      continue;
    }
    // Turntimber Basilisk, bonding: whom (if anyone) its gaze catches.
    if (c.effect.type === 'lure') {
      const source = state.actors[c.effect.source];
      if (!source || !llm.choose) continue;
      let pick: string | null = null;
      try {
        pick = await llm.choose({ world, state, npc, candidates, optional: true, what: `${land.name}: ${source.id === by.id ? '당신' : shortName(source.name)}이(가) 이 땅과 유대를 맺자 그 눈이 번득인다. 여기 있는 이 하나를 사로잡아 오늘 그와 맞서게 할 수 있다 (서로 적이 되고, 날아 피하지 못한다. 그의 손길은 닿기만 해도 쓰러뜨린다). 아무도 고르지 않을 수도 있다` });
      } catch (e) {
        console.warn(`choose (lure) for ${c.by} failed:`, e);
      }
      const target = candidates.find((x) => x.id === pick);
      if (target) applyLure(state, world, source, target, state.minutes);
      continue;
    }
    // Ob Nixilis, bonding: whom (if anyone) he drains, growing for it.
    if (c.effect.type === 'drain_grow') {
      if (!llm.choose) continue;
      let pick: string | null = null;
      try {
        pick = await llm.choose({ world, state, npc, candidates, optional: true, what: `${land.name}: 당신이 이 땅과 유대를 맺자 땅의 타락한 마나가 당신에게 흐른다. 고른 하나가 생명 ${c.effect.life}을 잃고(당신을 적으로 삼는다), 그러면 당신은 +1/+1 카운터 ${c.effect.counters}을 얻어 영영 커진다. 아무도 고르지 않을 수도 있다` });
      } catch (e) {
        console.warn(`choose (drain) for ${c.by} failed:`, e);
      }
      const target = candidates.find((x) => x.id === pick);
      if (target) applyDrainGrow(state, world, by, target, c.effect, state.minutes);
      continue;
    }
    // Kor Hookmaster, arriving: whom its controller binds in its ropes (one must be; with no usable
    // answer, one at random).
    if (c.effect.type === 'hook') {
      const source = state.actors[c.effect.source];
      if (!source) continue;
      let pick: string | null = null;
      if (llm.choose) {
        try {
          pick = await llm.choose({ world, state, npc, candidates, optional: false, what: `${land.name}: ${source.id === by.id ? '당신' : shortName(source.name)}이(가) 이곳에 들어섰다. 여기 있는 이 가운데 하나를 갈고리 밧줄로 묶는다 (다음 날 자정이 지나 그다음 자정까지 움직이지도 맞받아치지도 못한다). 누구를?` });
        } catch (e) {
          console.warn(`choose (hook) for ${c.by} failed:`, e);
        }
      }
      const target = candidates.find((x) => x.id === pick) ?? candidates[Math.floor(random(state) * candidates.length)];
      if (target) applyHook(state, world, source, target, state.minutes);
      continue;
    }
    // Goblin Shortcutter, arriving: whom its controller leaves unable to block today (one must be).
    if (c.effect.type === 'shortcut') {
      const source = state.actors[c.effect.source];
      if (!source) continue;
      let pick: string | null = null;
      if (llm.choose) {
        try {
          pick = await llm.choose({ world, state, npc, candidates, optional: false, what: `${land.name}: ${source.id === by.id ? '당신' : shortName(source.name)}이(가) 이곳에 들어섰다. 여기 있는 이 하나를 휘저어 놓아, 그 이는 자정까지 누구도 막아 주지 못한다 (주인에게 덤빈 이에게 맞서지 못한다). 누구를?` });
        } catch (e) {
          console.warn(`choose (shortcut) for ${c.by} failed:`, e);
        }
      }
      const target = candidates.find((x) => x.id === pick) ?? candidates[Math.floor(random(state) * candidates.length)];
      if (target) applyShortcut(state, world, source, target, state.minutes);
      continue;
    }
    // Gatekeeper of Malakir, arriving kicked: whom its controller makes pay the toll, or no one.
    if (c.effect.type === 'toll') {
      const source = state.actors[c.effect.source];
      if (!source || !llm.choose) continue;
      let pick: string | null = null;
      try {
        pick = await llm.choose({ world, state, npc, candidates, optional: true, what: `${land.name}: ${source.id === by.id ? '당신' : shortName(source.name)}이(가) 이곳에 들어섰다. 힘을 더 들여 여기 있는 이 하나에게 피의 통행세를 받아 낼 수 있다: 그 이는 거느린 생물 하나(제 몸도)를 골라 내놓아야 하고, 내놓은 것은 죽는다. 아무도 고르지 않을 수도 있다` });
      } catch (e) {
        console.warn(`choose (toll) for ${c.by} failed:`, e);
      }
      const target = candidates.find((x) => x.id === pick);
      if (target) applyToll(state, world, source, target, state.minutes);
      continue;
    }
    // Quest for the Gemblades, ended: who gets the counters (one must; with no answer, at random).
    if (c.effect.type === 'gem') {
      if (!npc) continue;
      let pick: string | null = null;
      if (llm.choose) {
        try {
          pick = await llm.choose({ world, state, npc, candidates, optional: false, what: `${c.effect.item}: 곁의 하나(당신 자신도)에게 +1/+1 카운터 ${c.effect.amount}을 영영 준다. 누구에게?` });
        } catch (e) {
          console.warn(`choose (gem) for ${c.by} failed:`, e);
        }
      }
      const target = candidates.find((x) => x.id === pick) ?? candidates[Math.floor(random(state) * candidates.length)];
      if (target) applyGem(state, by, target, c.effect.item, c.effect.amount, state.minutes);
      continue;
    }
    // Kor Outfitter, arriving: which of their equipment its controller has it put on whom, or none.
    if (c.effect.type === 'outfit') {
      const source = state.actors[c.effect.source];
      if (!source || !npc || !llm.pick) continue;
      const options = outfitOptions(state, world, source, state.minutes);
      if (!options.length) continue;
      let pick: string | null = null;
      try {
        pick = await llm.pick({ world, state, npc, what: `${land.name}: ${source.id === by.id ? '당신' : shortName(source.name)}이(가) 이곳에 들어섰다. 당신이 지닌 장비 하나를 당신이나 곁의 권속에게 값 없이 매어 줄 수 있다 (맨 이가 장비의 힘을 지닌다). 그만둘 수도 있다`, options, optional: true });
      } catch (e) {
        console.warn(`pick (outfit) for ${c.by} failed:`, e);
      }
      if (pick) applyOutfit(state, world, source, pick, state.minutes);
      continue;
    }
    // Warren Instigator, drawing blood: a goblin of the world to call to its side, or none.
    if (c.effect.type === 'instigate') {
      const source = state.actors[c.effect.source];
      if (!source || !llm.choose) continue;
      let pick: string | null = null;
      try {
        pick = await llm.choose({ world, state, npc, candidates, optional: true, what: `${source.id === by.id ? '당신' : shortName(source.name)}이(가) 싸움에서 피를 보고 외친다. 섬기는 이 없는 세계의 고블린 하나를 곁으로 불러 당신의 권속으로 삼을 수 있다. 아무도 부르지 않을 수도 있다` });
      } catch (e) {
        console.warn(`choose (instigate) for ${c.by} failed:`, e);
      }
      if (pick && candidates.some((x) => x.id === pick)) applyInstigate(state, world, source, pick, state.minutes);
      continue;
    }
    // Kor Aeronaut, arriving kicked: whom its controller has it lift into the air, or no one.
    if (c.effect.type === 'lift') {
      const source = state.actors[c.effect.source];
      if (!source || !llm.choose) continue;
      let pick: string | null = null;
      try {
        pick = await llm.choose({ world, state, npc, candidates, optional: true, what: `${land.name}: ${source.id === by.id ? '당신' : shortName(source.name)}이(가) 이곳에 들어섰다. 힘을 더 들여 여기 있는 이 하나(${source.id === by.id ? '당신' : '그'} 자신도)를 갈고리 밧줄로 끌어올려 자정까지 날 수 있게 할 수 있다 (날면 날지 못하는 이에게서 날아 피하고, 하늘의 땅에 오른다). 아무도 고르지 않을 수도 있다` });
      } catch (e) {
        console.warn(`choose (lift) for ${c.by} failed:`, e);
      }
      const target = candidates.find((x) => x.id === pick);
      if (target) applyLift(state, world, source, target, state.minutes);
      continue;
    }
    // Torch Slinger, arriving kicked: whom its controller has it throw its torch at, or no one.
    if (c.effect.type === 'torch') {
      const source = state.actors[c.effect.source];
      if (!source || !llm.choose) continue;
      let pick: string | null = null;
      try {
        pick = await llm.choose({ world, state, npc, candidates, optional: true, what: `${land.name}: ${source.id === by.id ? '당신' : shortName(source.name)}이(가) 이곳에 들어섰다. 힘을 더 들여 여기 있는 이 하나에게 타오르는 횃불을 던져 피해 ${npcDef(state, world, source.id)?.enterDamage?.amount ?? 2}를 줄 수 있다 (맞은 이는 적이 된다). 아무도 고르지 않을 수도 있다` });
      } catch (e) {
        console.warn(`choose (torch) for ${c.by} failed:`, e);
      }
      const target = candidates.find((x) => x.id === pick);
      if (target) applyTorch(state, world, source, target, state.minutes);
      continue;
    }
    // Halo Hunter, arriving: which one of the kind he hunts (if any) he destroys.
    if (c.effect.type === 'destroy') {
      if (!llm.choose) continue;
      let pick: string | null = null;
      try {
        pick = await llm.choose({ world, state, npc, candidates, optional: true, what: `${land.name}: 당신이 이곳에 들어섰다. 여기 있는 ${c.effect.flying ? '날 수 있는 ' : ''}${c.effect.kind ? CREATURE_TYPE_LABELS[c.effect.kind] : '이'} 가운데 하나를 골라 ${c.effect.kicker ? `힘(${c.effect.kicker})을 더 들여 ` : ''}파괴할 수 있다 (파괴된 이는 죽는다). 아무도 고르지 않을 수도 있다` });
      } catch (e) {
        console.warn(`choose (destroy) for ${c.by} failed:`, e);
      }
      const target = candidates.find((x) => x.id === pick);
      if (target) applyEnterDestroy(state, world, by, target, state.minutes);
      continue;
    }
    if (c.effect.type === 'seize') {
      if (!llm.choose) continue;
      let pick: string | null = null;
      try {
        pick = await llm.choose({ world, state, npc, candidates, optional: true, what: `${land.name}: 당신이 이 땅과 유대를 맺자 땅이 뒤틀리며 소용돌이가 인다. 고른 하나를 삼켜, 당신이 있는 한 당신을 따라 휩쓸려 다니게 한다 (그가 섬기던 이에게서도 빼앗는다). 아무도 삼키지 않을 수도 있다` });
      } catch (e) {
        console.warn(`choose (seize) for ${c.by} failed:`, e);
      }
      const target = candidates.find((x) => x.id === pick);
      if (target && together(target, by)) seize(state, target, by, state.minutes);
      continue;
    }
    if (c.effect.type === 'rally') {
      const source = c.effect.source;
      if (!llm.choose) continue;
      let pick: string | null = null;
      try {
        pick = await llm.choose({ world, state, npc, candidates, optional: true, what: `당신 무리에 동료가 들었다. ${rallyText(state, world, source)}. 누구에게 할지, 아니면 하지 않을지 고른다` });
      } catch (e) {
        console.warn(`choose (rally) for ${c.by} failed:`, e);
      }
      if (pick && candidates.some((x) => x.id === pick)) applyRally(state, world, source, pick, state.minutes);
      continue;
    }
    let pick: string | null = null;
    if (llm.choose) {
      try {
        const what =
          c.effect.type === 'lose_life'
            ? `고른 하나가 생명 ${c.effect.amount}을 잃는다`
            : c.effect.type === 'grant'
              ? `고른 하나(당신 자신도 된다)가 오늘 자정까지 ${ABILITY_LABELS[c.effect.ability]} 능력을 얻는다`
              : c.effect.type === 'pump'
                ? `고른 하나(당신 자신도 된다)가 오늘 자정까지 공격력/방어력 ${c.effect.pt.join('/')}만큼 강해진다`
                : `당신이 산과 유대를 맺어 ${land.name}이(가) 끓어오른다. 고른 하나에게 불길이 떨어져 피해 ${c.effect.amount}을 입는다 (죽을 수도 있다)`;
        const lead = c.effect.type === 'damage' ? `${land.name}: ${what}` : `${land.name}: 당신이 이 땅과 유대를 맺자, ${what}`;
        pick = await llm.choose({ world, state, npc, candidates, optional: c.optional, what: `${lead} (${land.summary})` });
      } catch (e) {
        console.warn(`choose for ${c.by} failed:`, e);
      }
    }
    // "You may": no answer, or no one, means they let it be. Otherwise the effect must land.
    if (!candidates.some((x) => x.id === pick)) {
      if (c.optional) continue;
      pick = candidates[Math.floor(random(state) * candidates.length)].id;
    }
    applyBondEffect(state, world, by, land.id, c.effect, pick!, state.minutes);
  }
  await seals(state, world, llm);
}

// An NPC casts a spell they readied (sim/spells.ts `readyCast`): the LLM picks whom, in
// character, or no one (they hold it back and keep their mana). The kicker is paid when they
// can ([가공]: it only ever helps them).
// `free`: a copy it gives (a kicked Gigantiform's second), paid for already.
async function castChoice(state: State, world: World, llm: Llm, by: Actor, npc: Speaker, spellId: string, candidates: Actor[], free = false, second = false) {
  const s = spellDef(world, spellId);
  if (!s) return;
  // The second target of a spell that needs two (Windborne Charge): one must be named; with no
  // usable answer, the first there.
  if (second) {
    let pick: string | null = null;
    if (llm.choose) {
      try {
        pick = await llm.choose({ world, state, npc, candidates, what: `${s.name}의 둘째 대상을 고른다: ${s.summary}. 당신 자신이나 곁의 권속 가운데 하나` });
      } catch (e) {
        console.warn(`choose (cast, second) for ${by.id} failed:`, e);
      }
    }
    const target = candidates.find((x) => x.id === pick && together(x, by)) ?? candidates.find((x) => together(x, by));
    if (target) castSpell(state, world, by, s.id, target.id, false, state.minutes, true);
    return;
  }
  if (!llm.choose) return;
  let pick: string | null = null;
  try {
    const what = free
      ? `${s.name}을(를) 하나 더, 값 없이 걸 수 있다: ${s.summary}. 누구에게 걸지, 아니면 걸지 않을지 고른다`
      : `당신은 주문 ${s.name}(${s.costText})을 걸 준비를 마쳤다: ${s.summary}.${harmful(s) ? ' 해로운 주문이라, 맞은 이는 당신을 적으로 삼는다.' : ''} 누구에게 걸지, 아니면 거두어들일지 고른다`;
    pick = await llm.choose({ world, state, npc, candidates, optional: true, what });
  } catch (e) {
    console.warn(`choose (cast) for ${by.id} failed:`, e);
  }
  if (!pick || !candidates.some((x) => x.id === pick)) return;
  if (free) {
    const target = state.actors[pick];
    if (target && !target.dead && together(target, by)) castSpell(state, world, by, s.id, pick, false, state.minutes, true);
    return;
  }
  const kick = !!s.kicker && !castBlocked(state, world, by, s.id, pick, true, state.minutes);
  const why = castBlocked(state, world, by, s.id, pick, kick, state.minutes);
  if (why) {
    addLog(state, { kind: 'status', text: `${josa(shortName(by.name), '은', '는')} ${josa(s.name, '을', '를')} 걸지 못했다: ${why}`, regions: [by.region], actors: [by.id], t: state.minutes });
    return;
  }
  castSpell(state, world, by, s.id, pick, kick, state.minutes);
}

// A beast that may follow someone was courted (sim/retainers.ts `readyCourt`): the LLM decides,
// as the beast, whether to follow them. With no answer it stays its own.
async function followChoice(state: State, world: World, llm: Llm, by: Actor, npc: Speaker, suitor: Actor) {
  if (!llm.choose) return;
  let pick: string | null = null;
  try {
    const what = `${shortName(suitor.name)}이(가) 두 시간 동안 당신 곁에 머물며 당신의 마음을 얻으려 했다. 그를 주인으로 인정해 따르고 섬길지(고른다), 아니면 아무도 고르지 않고 홀로 남을지 정한다. 얼마나 쉽게 마음을 여는지, 무엇이 있어야 따르는지는 당신의 본성대로 판단한다`;
    pick = await llm.choose({ world, state, npc, candidates: [suitor], optional: true, what });
  } catch (e) {
    console.warn(`choose (follow) for ${by.id} failed:`, e);
  }
  if (pick !== suitor.id || suitor.dead || suitor.master || !together(suitor, by) || followBlocked(state, world, by, suitor)) {
    addLog(state, { kind: 'status', text: `${josa(shortName(by.name), '은', '는')} ${shortName(suitor.name)}에게 곁을 내주지 않았다.`, regions: [by.region], actors: [by.id, suitor.id] });
    refuse(state, suitor, state.minutes);
    return;
  }
  summon(state, world, by, suitor, state.minutes, '인정');
}

// Those who seal a color (Iona) and just entered a fight name one (sim/seal.ts). The LLM
// picks; with no answer, a color at random (the card must name one).
async function seals(state: State, world: World, llm: Llm) {
  for (const a of sealsDue(state, world, state.minutes)) {
    const npc = speakerDef(state, world, a.id);
    if (!npc) continue;
    let color: Color | null = null;
    if (llm.chooseColor) {
      try {
        color = await llm.chooseColor({ world, state, npc, opponents: opponentsOf(state, a, state.minutes) });
      } catch (e) {
        console.warn(`chooseColor for ${a.id} failed:`, e);
      }
    }
    setSeal(state, world, a, color ?? COLORS[Math.floor(random(state) * COLORS.length)], state.minutes);
  }
}

// Crypt Ripper and its like (sim/pump.ts): before an hour of fighting, how much mana its
// controller pours into it. An NPC's by the LLM (with no usable answer: none); the player's, a
// pick they owe.
async function pumps(state: State, world: World, llm: Llm) {
  for (const a of pumpsDue(state, world, state.minutes)) {
    const max = pumpMax(state, world, a, state.minutes);
    const by = pumpController(state, a);
    const pump = npcDef(state, world, a.id)!.pump!;
    const options = Array.from({ length: max + 1 }, (_, n) => ({ id: String(n), label: n ? `${pump.costText}×${n}: 자정까지 +${pump.pt[0] * n}/+${pump.pt[1] * n}` : '붓지 않는다 (마나를 아낀다)' }));
    if (by.kind === 'player') {
      if (!state.asks?.some((c) => c.effect.type === 'pour' && c.effect.source === a.id)) (state.asks ??= []).push({ by: by.id, land: a.region, effect: { type: 'pour', source: a.id }, candidates: options.map((o) => o.id), t: state.minutes });
      continue;
    }
    const npc = speakerDef(state, world, by.id);
    if (!npc || !llm.pick) continue;
    let pick: string | null = null;
    try {
      const what = `${by.id === a.id ? '당신' : shortName(a.name)}의 싸움이 이어진다. 마나 ${pump.costText}를 낼 때마다 ${by.id === a.id ? '당신' : '그'}는 자정까지 +${pump.pt[0]}/+${pump.pt[1]} 커진다. 얼마나 부을지 고른다 (남은 마나는 주문 등에 쓸 수 있다)`;
      pick = await llm.pick({ world, state, npc, what, options });
    } catch (e) {
      console.warn(`pick (pump) for ${by.id} failed:`, e);
    }
    const n = Number(pick);
    if (Number.isInteger(n) && n > 0) applyPump(state, world, a, n, state.minutes);
  }
}

// Merfolk Seastalkers and their like (sim/bind.ts): before an hour of fighting, whether its
// controller pays to bind a foe there, and whom. An NPC's by the LLM (with no usable answer:
// none); the player's, a pick they owe.
async function binds(state: State, world: World, llm: Llm) {
  for (const a of bindsDue(state, world, state.minutes)) {
    const targets = bindTargets(state, world, a, state.minutes);
    const by = pumpController(state, a);
    const tap = npcDef(state, world, a.id)!.tapFoe!;
    if (by.kind === 'player') {
      if (!state.asks?.some((c) => c.effect.type === 'bind' && c.effect.source === a.id)) (state.asks ??= []).push({ by: by.id, land: a.region, effect: { type: 'bind', source: a.id }, candidates: targets.map((x) => x.id), optional: true, t: state.minutes });
      continue;
    }
    const npc = speakerDef(state, world, by.id);
    if (!npc || !llm.pick) continue;
    let pick: string | null = null;
    try {
      const what = `${by.id === a.id ? '당신' : shortName(a.name)}의 싸움이 이어진다. 마나 ${tap.costText}를 내면 날지 못하는 적 하나를 자정까지 묶을 수 있다 (묶인 이는 맞받아치지도 움직이지도 못한다). 누구를 묶을지, 아니면 묶지 않을지 고른다`;
      pick = await llm.pick({ world, state, npc, what, options: targets.map((x) => ({ id: x.id, label: `${shortName(x.name)} (${ptOf(x).join('/')})` })), optional: true });
    } catch (e) {
      console.warn(`pick (bind) for ${by.id} failed:`, e);
    }
    const target = targets.find((x) => x.id === pick);
    if (target) applyBind(state, world, a, target, state.minutes);
  }
}

// Gomazoa (sim/engulf.ts): before an hour of the fight it blocks, whether its controller drags
// one it blocks off with it. One with no master snaps shut by itself (a flytrap); an NPC master's
// by the LLM (with no usable answer: none); the player's, a pick they owe.
async function engulfs(state: State, world: World, llm: Llm) {
  for (const a of engulfsDue(state, world, state.minutes)) {
    const targets = engulfTargets(state, world, a, state.minutes);
    const by = pumpController(state, a);
    if (by.id === a.id && by.kind !== 'player') {
      applyEngulf(state, world, a, targets[0], state.minutes);
      continue;
    }
    if (by.kind === 'player') {
      if (!state.asks?.some((c) => c.effect.type === 'engulf' && c.effect.source === a.id)) (state.asks ??= []).push({ by: by.id, land: a.region, effect: { type: 'engulf', source: a.id }, candidates: targets.map((x) => x.id), optional: true, t: state.minutes });
      continue;
    }
    const npc = speakerDef(state, world, by.id);
    if (!npc || !llm.pick) continue;
    let pick: string | null = null;
    try {
      const what = `${shortName(a.name)}이(가) 덤벼든 이를 막고 있다. 그 촉수로 하나를 휘감아 함께 그것의 거처로 끌고 갈 수 있다 (둘 다 몸에 붙은 힘과 섬기던 이를 잃고, 끌려간 이는 ${ENGULF_HOURS}시간 묶인다. 고마조아도 당신 곁을 떠난다). 누구를 끌고 갈지, 아니면 그러지 않을지 고른다`;
      pick = await llm.pick({ world, state, npc, what, options: targets.map((x) => ({ id: x.id, label: `${shortName(x.name)} (${ptOf(x).join('/')})` })), optional: true });
    } catch (e) {
      console.warn(`pick (engulf) for ${by.id} failed:`, e);
    }
    const target = targets.find((x) => x.id === pick);
    if (target) applyEngulf(state, world, a, target, state.minutes);
  }
}

function busy(state: State, p: Actor) {
  return !!(p.task || p.travel || p.forced || p.boundUntil !== undefined || outOfTime(state, p));
}

async function talk(state: State, world: World, p: Actor, npcId: string, say: string, llm: Llm) {
  const npc = speakerDef(state, world, npcId)!;
  const name = shortName(npc.name);
  addLog(state, { kind: 'speech', text: `${shortName(p.name)}: “${say}”`, regions: [p.region], actors: [p.id, npc.id] });
  let reply: Reply | null = null;
  // A beast has no words: it answers in what it does (and may come to follow them).
  const def = npcDef(state, world, npcId);
  if (llm.reply) {
    try {
      reply = await llm.reply({ world, state, npc, say, beast: !!def?.beast });
    } catch (e) {
      console.warn(`reply from ${npc.id} failed:`, e);
    }
  }
  addLog(state, {
    kind: 'speech',
    text: reply ? (def?.beast ? reply.say : `${name}: “${reply.say}”`) : `${josa(name, '은', '는')} 말없이 당신을 바라본다.`,
    regions: [p.region],
    actors: [npc.id, p.id],
  });
  if (reply) applyReply(state, world, state.actors[npc.id], p, reply);
}

// What an NPC's words to the player lead to: what they now think of them, and whether they
// pledge to serve them, ask the player to serve them (the player answers: sim/asks.ts), or
// turn on them.
function applyReply(state: State, world: World, me: Actor, p: Actor, reply: Reply) {
  const name = shortName(me.name);
  if (reply.impression) remember(me, p, reply.impression, state.minutes);
  if (reply.refused && !reply.follow) refuse(state, p, state.minutes);
  const unwilling = reply.follow && !reply.attack && !swayBlocked(state, world, me) ? followBlocked(state, world, me, p) : null;
  if (unwilling) {
    addLog(state, { kind: 'status', text: unwilling, regions: [p.region], actors: [me.id, p.id] });
    refuse(state, p, state.minutes);
  } else if (reply.follow && !reply.attack && !swayBlocked(state, world, me)) summon(state, world, me, p, state.minutes, '설득');
  else if (reply.recruit && !reply.attack && canServe(p, me))
    (state.asks ??= []).push({ by: p.id, land: p.region, effect: { type: 'pledge', from: me.id }, candidates: [me.id], t: state.minutes });
  if (reply.attack) {
    addFoe(me, p.id, state.minutes);
    addLog(state, { kind: 'combat', text: `${josa(name, '이', '가')} 적의를 드러냈다.`, regions: [p.region], actors: [me.id, p.id] });
  }
}

// An NPC who sought the player out speaks to them first (the player answers by talking).
async function approach(state: State, world: World, me: Actor, p: Actor, llm: Llm) {
  const npc = speakerDef(state, world, me.id);
  if (!npc || !llm.reply) return;
  let reply: Reply | null = null;
  try {
    reply = await llm.reply({ world, state, npc });
  } catch (e) {
    console.warn(`approach from ${me.id} failed:`, e);
  }
  if (!reply) return;
  addLog(state, { kind: 'speech', text: `${shortName(me.name)}: “${reply.say}”`, regions: [p.region], actors: [me.id, p.id] });
  applyReply(state, world, me, p, reply);
}

// The player's blow. A flyer may take to the air instead (only if the attacker can't fly).
async function attack(state: State, world: World, p: Actor, npcId: string, llm: Llm) {
  const target = state.actors[npcId];
  const npc = speakerDef(state, world, npcId)!;
  // Reach (Oran-Rief Recluse) reaches a flyer as well as wings do.
  const flies = (a: Actor) => hasAbility(a, 'fly', state.minutes) || (a === p && hasAbility(a, 'reach', state.minutes));
  // One who can't block the player (asleep, protection) can't fly from them either; prey of a
  // landwalker or an intimidator may (user decision 2026-10-01).
  const inescapable = unblockable(state, world, p, target, state.minutes, true);
  if (inescapable && flies(target) && !flies(p) && target.boundUntil === undefined)
    addLog(state, { kind: 'combat', text: `${josa(shortName(target.name), '은', '는')} ${inescapable} 날아 달아나지 못한다.`, regions: [p.region], actors: [target.id, p.id] });
  if (!inescapable && flies(target) && !flies(p) && target.boundUntil === undefined && llm.evade) {
    let evades = false;
    try {
      evades = await llm.evade({ world, state, npc, attacker: p });
    } catch (e) {
      console.warn(`evade for ${npcId} failed:`, e);
    }
    if (evades) {
      addLog(state, {
        kind: 'combat',
        text: `${josa(shortName(target.name), '은', '는')} 날아올라 공격을 피했다.`,
        regions: [p.region],
        actors: [target.id, p.id],
      });
      return;
    }
  }
  clash(state, world, p, target, state.minutes, unblockable(state, world, p, target, state.minutes));
}

// An NPC's day is asked for this many times before the world halts.
const PLAN_TRIES = 2;

// What the LLM must give before the next hour: every living NPC's plan for today (a new day,
// or someone new in the world), and once a day the day's events and powers. The world does
// not move on without the NPCs' plans (there is no written routine to fall back on): returns
// why it halts, or null. The events plan may fail: then nothing is raised that day.
async function prepare(state: State, world: World, llm: Llm): Promise<string | null> {
  const day = gameDay(state.minutes);
  // Those out of time today have no day to plan.
  // Tokens who serve someone live their master's day (sim/retainers.ts `followsMaster`).
  const unplanned = Object.values(state.actors).filter((a) => a.kind === 'npc' && !a.dead && a.schedule?.day !== day && !outOfTime(state, a) && !followsMaster(state, a));
  if (unplanned.length && !llm.planDay) return 'LLM 설정이 없어 인물들의 하루를 짤 수 없다. 세계가 멈춰 있다.';
  const news = recentNews(state, world);
  // The day's events and powers, once a day. Those who foresee (sim/foresight.ts) plan after it.
  let gmJob: Promise<void> = Promise.resolve();
  if (state.preparedDay < day && llm.gmDay) {
    state.preparedDay = day;
    const gmDay = llm.gmDay;
    gmJob = (async () => {
      // Someone's extra day: the world stands still, nothing is raised; only they may use a power.
      const extra = state.extraDays?.find((x) => x.day === day);
      const eligible = extra ? [] : eligibleGmEvents(state, world, state.minutes);
      const abilities = usableAbilities(state, world, state.minutes);
      if (!eligible.length && !abilities.length) return void (state.gm = { day, source: 'llm', fires: [] });
      try {
        const hour = Math.floor((state.minutes % 1440) / 60);
        const plan = await gmDay({ day, hour, world, state, eligible, abilities, news });
        if (plan) state.gm = plan;
      } catch (e) {
        console.warn('gmDay failed, no events today:', e);
      }
    })();
  }
  const jobs: Promise<void>[] = unplanned.map(async (a) => {
    const npc = npcDef(state, world, a.id);
    if (!npc) return;
    if (npc.foresight) await gmJob;
    for (let i = 0; i < PLAN_TRIES && a.schedule?.day !== day; i++) {
      try {
        const blocks = await llm.planDay!({
          id: npc.id,
          day,
          now: state.minutes % 1440,
          name: npc.name,
          persona: npc.persona,
          goal: npc.goal,
          role: npc.role,
          home: npc.home,
          here: a.region,
          stats: a.stats,
          life: lifeOf(a),
          needs: npc.needs,
          relations: relationsText(a),
          // Where they could be today, and where they are (one of the sea may lie stranded on land).
          regions: world.regions.filter((r) => canStay(r, npc.abilities) || r.id === a.region).map((r) => ({ ...r, name: placeName(world, r) })),
          stranded: strandedText(world, a),
          items: claimableItems(state, world, a, state.minutes).map((x) => `  - ${x.id} in ${itemWhere(state, world, x)?.region ?? x.at}: ${x.name} (${x.summary}), costs ${x.costText}`),
          equip: equipInput(state, world, a),
          days: daysInput(state, world, a),
          grow: growInput(state, world, a),
          recall: recallInput(state, world, a),
          bite: biteInput(state, a),
          shield: tapInput(state, world, a, 'shield'),
          loot: tapInput(state, world, a, 'loot'),
          gale: tapInput(state, world, a, 'gale'),
          scout: tapBlocked(state, world, a, 'scout', a.id, state.minutes) ? undefined : tapInput(state, world, a, 'scout'),
          altar: altarInput(state, world, a),
          ascend: ascendInput(state, world, a),
          hex: hexInput(state, world, a),
          fling: flingInput(state, world, a),
          traps: trapsHeld(world, a).map((ev) => ({ id: ev.id, text: `${ev.name}: ${ev.summary} (${ev.cardCost?.text ?? ''})` })),
          expedition: expeditionBlocked(state, world, a) ? undefined : { name: expeditionOf(state, world, a)!.name, reward: expeditionReward(state, world, a).en },
          fetch: fetchInput(state, world, a),
          court: courtInput(state, world, a),
          hire: hireInput(state, world, a),
          people: peopleInput(state, world, a),
          ...(npc.foresight ? { foresight: foresightText(state, world, state.minutes) } : {}),
          knowledge: knowledgeText(a, state.minutes),
          ...spellsInput(state, world, a, npc),
          news,
        });
        if (blocks) a.schedule = { day, source: 'llm', blocks };
      } catch (e) {
        console.warn(`planDay for ${npc.id} failed:`, e);
      }
    }
  });
  await Promise.all([...jobs, gmJob]);
  const missing = unplanned.filter((a) => a.schedule?.day !== day);
  if (!missing.length) {
    await pumps(state, world, llm);
    await binds(state, world, llm);
    await engulfs(state, world, llm);
    return null;
  }
  return `LLM이 ${missing.map((a) => shortName(a.name)).join(', ')}의 하루를 짜지 못해 세계가 멈췄다. 다시 진행하면 이어서 짠다.`;
}

// Activated abilities characters could use today: untapped and able to pay.
export function usableAbilities(state: State, world: World, t: number) {
  // Those born in play too: a copy of a character of legend has their powers (Rite of Replication).
  return [...world.npcs, ...Object.values(state.tokens ?? {})]
    .filter((being) => state.actors[being.id] && !outOfTime(state, state.actors[being.id], t))
    .flatMap((being) => (being.activated ?? []).filter((x) => !abilityBlocked(state, world, being.id, x, t)).map((ability) => ({ being, ability })));
}

// Equipment they hold and could put on someone today, for their plan.
function equipInput(state: State, world: World, a: Actor): PlanDayInput['equip'] {
  const gear = equipmentOf(state, world, a)[0];
  if (!gear?.equip) return undefined;
  const who = equipTargets(state, a).filter((x) => !equipBlocked(state, world, a, gear.id, x.id, state.minutes));
  if (!who.length) return undefined;
  const bearer = state.items?.[gear.id]?.bearer;
  const gives = gear.equip.abilities.map((x) => ABILITY_LABELS[x]).join(', ');
  return {
    text: `${gear.name} (${gear.summary}; costs ${gear.equip.costText}; the bearer has ${gives}${gear.equip.lure ? ', and whoever they fall on cannot fly off' : ''}${bearer ? `; now on ${shortName(state.actors[bearer]?.name ?? bearer)}` : ''})`,
    who: who.map((x) => ({ id: x.id, text: x.id === a.id ? 'themselves' : `${shortName(x.name)}, who serves them` })),
  };
}

// A Blazing Torch of theirs someone bears, and whom it could hit now, for their plan.
function flingInput(state: State, world: World, a: Actor): PlanDayInput['fling'] {
  const x = torchesOf(state, world, a, state.minutes)[0];
  if (!x) return undefined;
  const b = state.actors[state.items![x.id].bearer!];
  const targets = flingTargets(state, world, x.id).map((y) => ({ id: y.id, text: shortName(y.name) }));
  return targets.length ? { name: x.name, bearer: b.id === a.id ? 'they themselves' : shortName(b.name), damage: x.equip!.sacDamage!, targets } : undefined;
}

// What a Vampire Hexmage they control could strip there, for their plan.
function hexInput(state: State, world: World, a: Actor): PlanDayInput['hex'] {
  const h = hexmagesOf(state, world, a).find((x) => !outOfTime(state, x));
  if (!h) return undefined;
  const targets = hexTargets(state, world, h, state.minutes).map((o) => ({ id: o.id, text: o.label }));
  return targets.length ? { who: shortName(h.name), targets } : undefined;
}

// A Luminarch Ascension they own that could call a token down now, for their plan.
function ascendInput(state: State, world: World, a: Actor): PlanDayInput['ascend'] {
  const x = ascensionOf(state, world, a);
  const e = x?.effects.find((y) => y.type === 'quest_token');
  if (!x || e?.type !== 'quest_token' || ascendBlocked(state, world, a, state.minutes)) return undefined;
  const kind = world.lore.find((l) => l.id === e.creature)?.name ?? e.creature;
  return { name: x.name, cost: e.cost, token: `a ${e.pt.join('/')} ${kind}${e.abilities.length ? ` (${e.abilities.join(', ')})` : ''}` };
}

// A Carnage Altar they own and whom of theirs they could offer on it, for their plan.
function altarInput(state: State, world: World, a: Actor): PlanDayInput['altar'] {
  const x = altarOf(state, world, a);
  const w = x && itemWhere(state, world, x);
  if (!x || !w) return undefined;
  const who = retainersOf(state, a.id).filter((y) => !y.dead).map((y) => ({ id: y.id, text: `${shortName(y.name)} (${ptOf(y).join('/')})` }));
  return { name: x.name, at: w.region, who };
}

// A creature they control with a tap power on someone (Noble Vestige, Reckless Scholar) that they
// could use today, for their plan.
function tapInput(state: State, world: World, a: Actor, power: TapPower) {
  const w = readyTapper(state, world, a, power, state.minutes);
  return w && { who: w.id === a.id ? 'they themselves' : shortName(w.name), amount: tapAmount(state, world, w, power) };
}

// One they control bearing Predatory Urge who could bite today, for their plan.
function biteInput(state: State, a: Actor): PlanDayInput['bite'] {
  const biter = readyBiter(state, a, state.minutes);
  return biter && { who: biter.id === a.id ? 'they themselves' : shortName(biter.name), power: ptOf(biter)[0] };
}

// A Sea Gate Loremaster they control they could tap today, for their plan.
function recallInput(state: State, world: World, a: Actor): PlanDayInput['recall'] {
  if (recallBlocked(state, world, a, state.minutes)) return undefined;
  return { who: shortName(loremastersOf(state, world, a)[0].name), count: recallCount(state, world, a) };
}

// A land like Oran-Rief they could tap today, and whom it would strengthen, for their plan.
function growInput(state: State, world: World, a: Actor): PlanDayInput['grow'] {
  const land = growLand(world, a);
  if (!land || growBlocked(state, world, a, land.id, state.minutes)) return undefined;
  return { land: land.name, creatures: enteredToday(state, world, land.growEntered!.color, state.minutes).map((x) => shortName(x.name)) };
}

// Spells they could learn (not beasts), and spells they hold and could pay for, for their plan.
function spellsInput(state: State, world: World, a: Actor, npc: NpcDef): Pick<PlanDayInput, 'learn' | 'cast'> {
  const text = (s: SpellDef) =>
    `${s.name} (${s.summary}), costs ${s.costText}${s.kicker?.mana ? ` (or ${s.kicker.manaText} more, kicked, if they can pay then)` : ''}${s.target === 'self' ? ', their own (no target)' : s.target === 'any_here' ? ', on someone there or themselves' : ', on someone else there'}`;
  const learn = npc.beast ? [] : learnableSpells(world, a).map((s) => ({ id: s.id, at: s.learnAt, text: `${text(s)}; learning takes ${s.learnHours} hours` }));
  const cast = castableSpells(state, world, a, state.minutes).map((s) => ({ id: s.id, text: text(s) }));
  return { ...(learn.length ? { learn } : {}), ...(cast.length ? { cast } : {}) };
}

// Beasts whose trust they could seek today, and where each is, for their plan.
function courtInput(state: State, world: World, a: Actor): PlanDayInput['court'] {
  const out = courtTargets(state, world, a)
    .filter((x) => !x.travel && world.regions.some((r) => r.id === x.region))
    .map((x) => ({ id: x.id, at: x.region, text: `${x.name}: ${npcDef(state, world, x.id)?.summary ?? ''}` }));
  return out.length ? out : undefined;
}

// Mercenaries they could hire today (not beasts, not those who serve someone), for their plan.
function hireInput(state: State, world: World, a: Actor): PlanDayInput['hire'] {
  if (a.master || npcDef(state, world, a.id)?.beast || !npcDef(state, world, a.id)?.needs.includes('coin')) return undefined;
  const out = hireableFor(state, world, a)
    .filter((x) => !x.travel)
    .map((x) => ({ id: x.id, at: x.region, text: `${x.name} (${npcDef(state, world, x.id)?.summary ?? ''}), costs ${hirePrice(npcDef(state, world, x.id)!)} coin (they have ${Math.floor(a.stats.coin)})` }));
  return out.length ? out : undefined;
}

// Everyone else in the world (the player too), and where each is now: whom they could seek out
// to talk with (not beasts) or go after, for their plan. A defender strikes no one first; one seized, not the
// one who holds them.
function peopleInput(state: State, world: World, a: Actor): PlanDayInput['people'] {
  const canAttack = !hasAbility(a, 'defender', state.minutes);
  const biter = readyBiter(state, a, state.minutes);
  const warden = readyTapper(state, world, a, 'shield', state.minutes);
  const scholar = readyTapper(state, world, a, 'loot', state.minutes);
  const caller = readyTapper(state, world, a, 'gale', state.minutes);
  const out = Object.values(state.actors)
    .filter((x) => !x.dead && x.id !== a.id && !outOfTime(state, x))
    .map((x) => {
      const def = npcDef(state, world, x.id);
      return {
        id: x.id,
        at: x.travel?.to ?? x.region,
        text: `${x.name} (${x.kind === 'player' ? 'the player' : def?.beast ? 'beast' : (def?.role ?? '')}, ${ptOf(x).join('/')})`,
        talk: !def?.beast,
        attack: canAttack && !(a.seized && a.master === x.id),
        bite: !!biter && biteable(state, world, biter, x, state.minutes),
        shield: !!warden && tapTargetable(state, world, warden, x, state.minutes),
        loot: !!scholar && tapTargetable(state, world, scholar, x, state.minutes),
        gale: !!caller && tapTargetable(state, world, caller, x, state.minutes),
      };
    });
  return out.length ? out : undefined;
}

// Whether `a` may pledge to serve `master` in a talk: free to (not bound to anyone, not one
// with powers), and not to one who serves them.
export function canPledge(state: State, world: World, a: Actor, master: Actor) {
  return !followBlocked(state, world, a, master) && !master.dead && master.master !== a.id;
}

// Lands they could seek out with the fetch lands they hold, for their plan.
function fetchInput(state: State, world: World, a: Actor): PlanDayInput['fetch'] {
  const seen = new Set<string>();
  const out = world.regions
    .filter((r) => r.fetch && a.bonds?.includes(r.id))
    .flatMap((from) =>
      fetchTargets(state, world, a, from.id)
        .filter((to) => !fetchBlocked(state, world, a, from.id, to.id) && !seen.has(to.id) && seen.add(to.id))
        .map((to) => ({ id: to.id, text: `${placeName(world, to)} (${landTypes(to).map((x) => LAND_TYPE_LABELS[x]).join('·')}), giving up ${from.name} and ${from.fetch!.life} life` })),
    );
  // The land on top of their library (Oracle of Mul Daya): from afar, as their land for the day.
  const top = topLand(state, a, state.minutes);
  // Lands in their hand (Merfolk Wayfinder): the same.
  for (const id of a.handLands ?? []) {
    if (seen.has(id) || !('hand' in fetchSource(state, world, a, id))) continue;
    seen.add(id);
    out.push({ id, text: `${placeName(world, region(world, id))} (${landTypes(region(world, id)).map((x) => LAND_TYPE_LABELS[x]).join('·')}), a way there shown to you (in your hand): from afar, your land for the day` });
  }
  if (top && !seen.has(top) && 'top' in fetchSource(state, world, a, top)) out.push({ id: top, text: `${placeName(world, region(world, top))} (${landTypes(region(world, top)).map((x) => LAND_TYPE_LABELS[x]).join('·') || 'named land'}), revealed on top of your library by your oracle: no fetch land given up, but it is your land for the day` });
  return out.length ? out : undefined;
}

// What they can do with a land that keeps days (Magosi) today, for their plan.
function daysInput(state: State, world: World, a: Actor): PlanDayInput['days'] {
  const land = eonLand(world, a);
  if (!land) return undefined;
  const t = state.minutes;
  return {
    land: land.name,
    cost: land.eon!.costText,
    held: eonsIn(a, land.id),
    store: !storeBlocked(state, world, a, land.id, t),
    spend: !spendBlocked(state, world, a, land.id, t),
  };
}

// What happened in the last day, for planning prompts.
export function recentNews(state: State, world: World) {
  const since = state.minutes - 1440;
  const lines = state.log
    .filter((e) => e.t >= since && (e.kind === 'event' || e.kind === 'condition' || e.kind === 'omen'))
    .map((e) => `${formatClock(e.t)} ${e.text}`);
  for (const [id, rs] of Object.entries(state.regions)) {
    const r = world.regions.find((x) => x.id === id);
    if (r && rs.destroyed) lines.push(`${r.name}: 땅이 부서져 있다 (${formatClock(rs.destroyed.at)}부터 ${formatClock(rs.destroyed.until ?? ruinsUntil(rs.destroyed.at))}까지)`);
    for (const c of rs.conditions) if (r) lines.push(`지금 ${r.name}: ${c.label} (${formatClock(c.until)}까지)`);
  }
  return lines.slice(-20);
}

async function narrate(state: State, world: World, firstId: number, llm: Llm) {
  if (!llm.narrate) return;
  const entries = state.log.filter((e) => e.id >= firstId && e.seen && e.kind !== 'narration');
  if (!entries.length) return;
  try {
    const text = await llm.narrate({ world, state, entries });
    if (text) addLog(state, { kind: 'narration', text, scope: 'world' });
  } catch (e) {
    console.warn('narration failed:', e);
  }
}

