// Turn driver. Time only moves here: the observer advances N hours, the player acts and the
// world runs until the action is done. The game passes every LLM hook (sim/llm/index.ts);
// tests pass fakes or none.
import { formatClock, gameDay } from './clock.ts';
import { startAction } from './actions.ts';
import type { Action } from './actions.ts';
import { addLog, npcDef, outOfTime, player, random, speakerDef } from './state.ts';
import type { Actor, GmPlan, LogEntry, State } from './state.ts';
import { eligibleGmEvents, step } from './step.ts';
import { addFoe, clash } from './combat.ts';
import { relationsText, remember } from './relations.ts';
import { claimableItems } from './items.ts';
import { eonLand, eonsIn, spendBlocked, storeBlocked } from './eons.ts';
import { castSpell } from './spells.ts';
import { abilityBlocked, applyBondEffect, enteredToday, growBlocked, growLand } from './abilities.ts';
import { bindRetainer, swayBlocked } from './retainers.ts';
import { josa, shortName } from './text.ts';
import type { ScheduleBlock } from './types.ts';
import { ABILITY_LABELS, canStay, placeName } from './world.ts';
import type { ActivatedAbility, EventDef, NpcDef, Speaker, World } from './world.ts';
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
export type ReplyInput = { world: World; state: State; npc: Speaker; say: string };
// What the NPC says, whether they now attack the player or pledge to serve them (become their
// retainer), and what they now think of them.
export type Reply = { say: string; attack: boolean; follow?: boolean; impression?: string };
export type EvadeInput = { world: World; state: State; npc: Speaker; attacker: Actor };
export type ConverseInput = { world: World; state: State; a: Speaker; b: Speaker };
// An NPC picks whom an effect falls on (e.g. a land's "target player loses 1 life"): one of
// `candidates`, by id.
export type ChooseInput = { world: World; state: State; npc: Speaker; what: string; candidates: Actor[] };
// Two NPCs' exchange: the lines, what each now thinks of the other (by id), and who, if
// anyone, now attacks the other.
export type Conversation = { lines: { by: string; say: string }[]; impressions: Record<string, string>; attacker: string | null };

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
    action = await llm.interpret({ world, state, text: input });
    if (!action) return { error: '무슨 행동인지 알아듣지 못했다. 다르게 말해 보자.', entries: [] };
  } else action = input;

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
  const error = startAction(state, world, action);
  if (error) return { error, entries: [] };
  if (action.type === 'talk') await talk(state, world, p, action.to, action.say, llm);
  if (action.type === 'attack') await attack(state, world, p, action.to, llm);
  if (action.type === 'cast') castSpell(state, world, p, action.spell, action.to, action.kick, state.minutes);

  let halt: string | undefined;
  for (let n = 0; busy(state, p) && !state.over && n < MAX_ACT_HOURS; n++) {
    halt = (await prepare(state, world, llm)) ?? undefined;
    if (halt) break;
    const before = state.nextLogId;
    step(state, world);
    await conversations(state, world, before, llm);
    await choices(state, world, llm);
    // Something is happening right here: stop and let the player decide. News from afar
    // (world-scope events elsewhere) doesn't interrupt.
    const alarm = state.log.some(
      (e) => e.id >= before && (e.kind === 'omen' || e.kind === 'event' || e.kind === 'combat') && e.regions.includes(p.region),
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
// think of each other is remembered, and one may turn on the other: they fight next hour.
async function conversations(state: State, world: World, since: number, llm: Llm) {
  if (!llm.converse) return;
  const day = gameDay(state.minutes);
  const met = state.log.filter((e) => e.id >= since && e.kind === 'meet' && e.actors.length === 2);
  for (const m of met) {
    if (state.talks?.day !== day) state.talks = { day, count: 0 };
    if (state.talks.count >= MAX_TALKS_PER_DAY) return;
    const [x, y] = m.actors.map((id) => state.actors[id]);
    if (!x || !y || x.dead || y.dead || npcDef(state, world, x.id)?.beast || npcDef(state, world, y.id)?.beast) continue;
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

// Still doing something, or out of time (their action waits until they are back).
// Picks NPCs owe from this hour (state.choices), made by the LLM. When it can't answer, the
// engine picks at random among the candidates, so the effect still lands.
async function choices(state: State, world: World, llm: Llm) {
  const due = state.choices ?? [];
  state.choices = [];
  for (const c of due) {
    const by = state.actors[c.by];
    const npc = speakerDef(state, world, c.by);
    const land = world.regions.find((r) => r.id === c.land);
    const candidates = c.candidates.map((id) => state.actors[id]).filter((x) => x && !x.dead);
    if (!by || by.dead || !npc || !land || !candidates.length) continue;
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
                : '';
        pick = await llm.choose({ world, state, npc, candidates, what: `${land.name}: 당신이 이 땅과 유대를 맺자, ${what} (${land.summary})` });
      } catch (e) {
        console.warn(`choose for ${c.by} failed:`, e);
      }
    }
    if (!candidates.some((x) => x.id === pick)) pick = candidates[Math.floor(random(state) * candidates.length)].id;
    applyBondEffect(state, world, by, land.id, c.effect, pick!, state.minutes);
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
  // A beast has no words.
  if (npcDef(state, world, npcId)?.beast) {
    addLog(state, { kind: 'speech', text: `${josa(name, '은', '는')} 대꾸 없이 낮게 으르렁거린다.`, regions: [p.region], actors: [npcId, p.id] });
    return;
  }
  if (llm.reply) {
    try {
      reply = await llm.reply({ world, state, npc, say });
    } catch (e) {
      console.warn(`reply from ${npc.id} failed:`, e);
    }
  }
  addLog(state, {
    kind: 'speech',
    text: reply ? `${name}: “${reply.say}”` : `${josa(name, '은', '는')} 말없이 당신을 바라본다.`,
    regions: [p.region],
    actors: [npc.id, p.id],
  });
  if (reply?.impression) remember(state.actors[npc.id], p, reply.impression, state.minutes);
  if (reply?.follow && !reply.attack && !swayBlocked(state, world, state.actors[npc.id]))
    bindRetainer(state, state.actors[npc.id], p, state.minutes, '설득');
  if (reply?.attack) {
    addFoe(state.actors[npc.id], p.id, state.minutes);
    addLog(state, { kind: 'combat', text: `${josa(name, '이', '가')} 적의를 드러냈다.`, regions: [p.region], actors: [npc.id, p.id] });
  }
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
  const unplanned = Object.values(state.actors).filter((a) => a.kind === 'npc' && !a.dead && a.schedule?.day !== day && !outOfTime(state, a));
  if (unplanned.length && !llm.planDay) return 'LLM 설정이 없어 인물들의 하루를 짤 수 없다. 세계가 멈춰 있다.';
  const news = recentNews(state, world);
  const jobs: Promise<void>[] = unplanned.map(async (a) => {
    const npc = npcDef(state, world, a.id);
    if (!npc) return;
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
          needs: npc.needs,
          relations: relationsText(a),
          regions: world.regions.filter((r) => canStay(r, npc.abilities)).map((r) => ({ ...r, name: placeName(world, r) })),
          items: claimableItems(state, world, a, state.minutes).map((x) => `  - ${x.id} in ${x.at}: ${x.name} (${x.summary}), costs ${x.costText}`),
          days: daysInput(state, world, a),
          grow: growInput(state, world, a),
          news,
        });
        if (blocks) a.schedule = { day, source: 'llm', blocks };
      } catch (e) {
        console.warn(`planDay for ${npc.id} failed:`, e);
      }
    }
  });
  if (state.preparedDay < day && llm.gmDay) {
    state.preparedDay = day;
    const gmDay = llm.gmDay;
    jobs.push(
      (async () => {
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
      })(),
    );
  }
  await Promise.all(jobs);
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
    if (r && rs.destroyed) lines.push(`${r.name}: 땅이 부서져 있다 (${formatClock(rs.destroyed.at)}부터)`);
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

