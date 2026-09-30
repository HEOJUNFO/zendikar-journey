// Turn driver. Time only moves here: the observer advances N hours, the player acts and the
// world runs until the action is done. The game passes every LLM hook (sim/llm/index.ts);
// tests pass fakes or none.
import { formatClock, gameDay, untapTime } from './clock.ts';
import { startAction } from './actions.ts';
import type { Action } from './actions.ts';
import { addLog, hasAbility, npcDef, outOfTime, player, ptOf, random, speakerDef } from './state.ts';
import type { Actor, GmPlan, LogEntry, State } from './state.ts';
import { eligibleGmEvents, ruinsUntil, step } from './step.ts';
import { addFoe, clash, dealDamage } from './combat.ts';
import { relationsText, remember } from './relations.ts';
import { claimableItems } from './items.ts';
import { lifeOf } from './life.ts';
import { foresightText } from './foresight.ts';
import { setOff, wandersDue, withPositions } from './wander.ts';
import { letGo } from './discard.ts';
import { strandedText } from './stranded.ts';
import { applyRally, hireableFor, hireMerc, hirePrice, rallyText } from './allies.ts';
import { answerAsk, askText, canServe } from './asks.ts';
import { eonLand, eonsIn, spendBlocked, storeBlocked } from './eons.ts';
import { castableSpells, castBlocked, castSpell, harmful, learnableSpells, spellDef } from './spells.ts';
import { opponentsOf, sealsDue, setSeal } from './seal.ts';
import { COLORS } from './mana.ts';
import type { Color } from './mana.ts';
import { abilityBlocked, applyBondEffect, enteredToday, fetchBlocked, fetchTargets, growBlocked, growLand, callForth } from './abilities.ts';
import { bindRetainer, courtTargets, followsMaster, refuse, seize, swayBlocked } from './retainers.ts';
import { josa, shortName } from './text.ts';
import type { ScheduleBlock } from './types.ts';
import { ABILITY_LABELS, canStay, LAND_TYPE_LABELS, landTypes, placeName } from './world.ts';
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
// An NPC (`npc`) must let go of one of `spells` (their hand), for `cause`.
export type DiscardInput = { world: World; state: State; npc: Speaker; spells: SpellDef[]; cause: string };
// A wandering place (`place`), at stop `at` (if any), picks the next of `stops`.
export type WanderInput = { world: World; state: State; place: Region; at?: string; stops: string[] };
// A trap (`trap`) divides `amount` damage among `targets`, the attackers who set it off.
export type VolleyInput = { world: World; state: State; trap: EventDef; targets: Actor[]; amount: number };
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
  // One who must let go of a spell (discard): which of `spells` they give up.
  discard?: (input: DiscardInput) => Promise<string | null>;
  // A wandering place (Goma Fada) at a stop: which of `stops` it heads for next.
  wander?: (input: WanderInput) => Promise<string | null>;
  // An arrow volley (Arrow Volley Trap): how much of `amount` falls on each of `targets`, by id.
  volley?: (input: VolleyInput) => Promise<Record<string, number> | null>;
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
    addLog(state, { kind: 'system', text: `시간 밖에서 ${n}시간이 흘렀다. 이제 다시 움직일 수 있다.`, regions: [p.region], actors: [p.id] });
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
      bindRetainer(state, world, follower, follower === x ? y : x, state.minutes, '설득');
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
    const trap = world.events.find((e) => e.id === s.event);
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
    if (pick && creatures.some((c) => c.id === pick)) callForth(state, world, pick, s.region, intruders.map((a) => a.id), state.minutes);
    else addLog(state, { kind: 'event', text: `${trap.name}: 문간의 어둠은 끝내 잠잠했다.`, regions: [s.region] });
  }
}

// Arrow volleys loosed this hour (sim/step.ts): the LLM, as the trap, divides the damage among
// the attackers who set it off (all of it, as it chooses). With no usable answer, it falls one
// at a time around them, strongest first.
async function volleys(state: State, world: World, llm: Llm) {
  const due = state.volleys ?? [];
  state.volleys = [];
  for (const v of due) {
    const trap = world.events.find((e) => e.id === v.event);
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
      dealDamage(state, a, n, state.minutes, trap.name);
    }
  }
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
  await volleys(state, world, llm);
  const due = state.choices ?? [];
  state.choices = [];
  for (const c of due) {
    const by = state.actors[c.by];
    // The player's own picks wait for them (a "choose" action).
    if (by?.kind === 'player') {
      if (!by.dead) (state.asks ??= []).push(c);
      continue;
    }
    const npc = speakerDef(state, world, c.by);
    // A discard: which spell they let go of (candidates are spells, not people).
    if (c.effect.type === 'discard') {
      if (by && !by.dead && npc) await discardChoice(state, world, llm, by, npc, c.candidates, c.effect.cause);
      continue;
    }
    const land = world.regions.find((r) => r.id === c.land);
    const candidates = c.candidates.map((id) => state.actors[id]).filter((x) => x && !x.dead);
    if (!by || by.dead || !npc || !land || !candidates.length) continue;
    if (c.effect.type === 'pledge' || c.effect.type === 'evade') continue; // the player's alone
    if (c.effect.type === 'cast') {
      await castChoice(state, world, llm, by, npc, c.effect.spell, candidates);
      continue;
    }
    if (c.effect.type === 'follow') {
      await followChoice(state, world, llm, by, npc, candidates[0]);
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
      if (target && target.region === by.region && !target.travel) seize(state, target, by, state.minutes);
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
async function castChoice(state: State, world: World, llm: Llm, by: Actor, npc: Speaker, spellId: string, candidates: Actor[]) {
  const s = spellDef(world, spellId);
  if (!s || !llm.choose) return;
  let pick: string | null = null;
  try {
    const what = `당신은 주문 ${s.name}(${s.costText})을 걸 준비를 마쳤다: ${s.summary}.${harmful(s) ? ' 해로운 주문이라, 맞은 이는 당신을 적으로 삼는다.' : ''} 누구에게 걸지, 아니면 거두어들일지 고른다`;
    pick = await llm.choose({ world, state, npc, candidates, optional: true, what });
  } catch (e) {
    console.warn(`choose (cast) for ${by.id} failed:`, e);
  }
  if (!pick || !candidates.some((x) => x.id === pick)) return;
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
    const what = `${shortName(suitor.name)}이(가) 두 시간 동안 당신 곁에 머물며 당신의 마음을 얻으려 했다. 그를 주인으로 인정해 따르고 섬길지(고른다), 아니면 아무도 고르지 않고 홀로 남을지 정한다. 따르는 것은 드물고 큰 일이다`;
    pick = await llm.choose({ world, state, npc, candidates: [suitor], optional: true, what });
  } catch (e) {
    console.warn(`choose (follow) for ${by.id} failed:`, e);
  }
  if (pick !== suitor.id || suitor.dead || suitor.master || suitor.region !== by.region || swayBlocked(state, world, by)) {
    addLog(state, { kind: 'status', text: `${josa(shortName(by.name), '은', '는')} ${shortName(suitor.name)}에게 곁을 내주지 않았다.`, regions: [by.region], actors: [by.id, suitor.id] });
    refuse(state, suitor, state.minutes);
    return;
  }
  bindRetainer(state, world, by, suitor, state.minutes, '인정');
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
    setSeal(state, a, color ?? COLORS[Math.floor(random(state) * COLORS.length)], state.minutes);
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
  // A beast has no words. One that may follow someone still answers, in what it does.
  const def = npcDef(state, world, npcId);
  if (def?.beast && !def.tamable) {
    addLog(state, { kind: 'speech', text: `${josa(name, '은', '는')} 대꾸 없이 낮게 으르렁거린다.`, regions: [p.region], actors: [npcId, p.id] });
    return;
  }
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
  if (reply.follow && !reply.attack && !swayBlocked(state, world, me)) bindRetainer(state, world, me, p, state.minutes, '설득');
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
  const flies = (a: Actor) => a.abilities.includes('fly');
  if (flies(target) && !flies(p) && target.boundUntil === undefined && llm.evade) {
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
  clash(state, p, target, state.minutes);
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
          items: claimableItems(state, world, a, state.minutes).map((x) => `  - ${x.id} in ${x.at}: ${x.name} (${x.summary}), costs ${x.costText}`),
          days: daysInput(state, world, a),
          grow: growInput(state, world, a),
          fetch: fetchInput(state, world, a),
          court: courtInput(state, world, a),
          hire: hireInput(state, world, a),
          people: peopleInput(state, world, a),
          ...(npc.foresight ? { foresight: foresightText(state, world, state.minutes) } : {}),
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
  if (!missing.length) return null;
  return `LLM이 ${missing.map((a) => shortName(a.name)).join(', ')}의 하루를 짜지 못해 세계가 멈췄다. 다시 진행하면 이어서 짠다.`;
}

// Activated abilities characters could use today: untapped and able to pay.
export function usableAbilities(state: State, world: World, t: number) {
  return world.npcs
    .filter((being) => state.actors[being.id] && !outOfTime(state, state.actors[being.id], t))
    .flatMap((being) => (being.activated ?? []).filter((x) => !abilityBlocked(state, world, being.id, x, t)).map((ability) => ({ being, ability })));
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
      };
    });
  return out.length ? out : undefined;
}

// Whether `a` may pledge to serve `master` in a talk: free to (not bound to anyone, not one
// with powers), and not to one who serves them.
export function canPledge(state: State, world: World, a: Actor, master: Actor) {
  return !swayBlocked(state, world, a) && !master.dead && master.master !== a.id;
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

