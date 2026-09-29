// Turn driver. Time only moves here: the observer advances N hours, the player acts and the
// world runs until the action is done. The game passes every LLM hook (sim/llm/index.ts);
// tests pass fakes or none.
import { formatClock, gameDay } from './clock.ts';
import { startAction } from './actions.ts';
import type { Action } from './actions.ts';
import { addLog, npcDef, player, speakerDef } from './state.ts';
import type { Actor, GmPlan, LogEntry, State } from './state.ts';
import { eligibleGmEvents, step } from './step.ts';
import { addFoe, clash } from './combat.ts';
import { relationsText, remember } from './relations.ts';
import { manaAvailable, planPayment } from './mana.ts';
import { josa, shortName } from './text.ts';
import type { ScheduleBlock } from './types.ts';
import { canStay, placeName } from './world.ts';
import type { ActivatedAbility, BeingDef, EventDef, Speaker, World } from './world.ts';
import type { PlanDayInput } from './llm/planner.ts';

export type GmDayInput = {
  day: number;
  hour: number;
  world: World;
  state: State;
  eligible: EventDef[];
  abilities: { being: BeingDef; ability: ActivatedAbility }[];
  news: string[];
};
export type NarrateInput = { world: World; state: State; entries: LogEntry[] };
export type InterpretInput = { world: World; state: State; text: string };
export type ReplyInput = { world: World; state: State; npc: Speaker; say: string };
// What the NPC says, whether they now attack the player, and what they now think of them.
export type Reply = { say: string; attack: boolean; impression?: string };
export type EvadeInput = { world: World; state: State; npc: Speaker; attacker: Actor };
export type ConverseInput = { world: World; state: State; a: Speaker; b: Speaker };
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
};

// NPC conversations written per game day at most (each is one LLM call).
export const MAX_TALKS_PER_DAY = 6;

// Longest a single player action may run before control comes back.
const MAX_ACT_HOURS = 48;

export type TurnResult = { error?: string; entries: LogEntry[] };

export async function advance(state: State, world: World, hours: number, llm: Llm = {}): Promise<TurnResult> {
  const firstId = state.nextLogId;
  for (let i = 0; i < hours; i++) {
    await prepareDay(state, world, llm);
    const before = state.nextLogId;
    step(state, world);
    await conversations(state, world, before, llm);
  }
  await narrate(state, world, firstId, llm);
  return { entries: state.log.filter((e) => e.id >= firstId) };
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

  const firstId = state.nextLogId;
  const error = startAction(state, world, action);
  if (error) return { error, entries: [] };
  if (action.type === 'talk') await talk(state, world, p, action.to, action.say, llm);
  if (action.type === 'attack') await attack(state, world, p, action.to, llm);

  for (let n = 0; busy(p) && !state.over && n < MAX_ACT_HOURS; n++) {
    await prepareDay(state, world, llm);
    const before = state.nextLogId;
    step(state, world);
    await conversations(state, world, before, llm);
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
  return { entries: state.log.filter((e) => e.id >= firstId) };
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

function busy(p: Actor) {
  return !!(p.task || p.travel || p.forced || p.boundUntil !== undefined);
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

// Plans for the day, made once when the day starts: each NPC's schedule and the GM's
// events. If a call fails the NPC keeps their routine / the GM raises nothing (step.ts).
async function prepareDay(state: State, world: World, llm: Llm) {
  const day = gameDay(state.minutes);
  if (state.preparedDay >= day) return;
  state.preparedDay = day;
  const news = recentNews(state, world);
  const jobs: Promise<void>[] = [];
  for (const npc of [...world.npcs, ...Object.values(state.tokens ?? {})]) {
    const a = state.actors[npc.id];
    if (!a || a.dead) continue;
    a.schedule = { day, source: 'routine', blocks: npc.routine };
    if (!llm.planDay) continue;
    const planDay = llm.planDay;
    jobs.push(
      (async () => {
        try {
          const blocks = await planDay({
            day,
            name: npc.name,
            persona: npc.persona,
            goal: npc.goal,
            role: npc.role,
            home: npc.home,
            stats: a.stats,
            needs: npc.needs,
            routine: npc.routine,
            relations: relationsText(a),
            regions: world.regions.filter((r) => canStay(r, npc.abilities)).map((r) => ({ ...r, name: placeName(world, r) })),
            news,
          });
          if (blocks) a.schedule = { day, source: 'llm', blocks };
        } catch (e) {
          console.warn(`planDay for ${npc.id} failed, keeping routine:`, e);
        }
      })(),
    );
  }
  if (llm.gmDay) {
    const gmDay = llm.gmDay;
    jobs.push(
      (async () => {
        const eligible = eligibleGmEvents(state, world, state.minutes);
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
}

// Activated abilities GM-driven beings could use today: untapped and able to pay.
export function usableAbilities(state: State, world: World, t: number) {
  return world.beings.flatMap((being) => {
    const bs = state.actors[being.id];
    if (!bs || bs.dead) return [];
    if (bs.boundUntil !== undefined && bs.boundUntil > t) return [];
    const available = manaAvailable(state, world, bs, t);
    return being.activated.filter((x) => planPayment(available, x.cost)).map((ability) => ({ being, ability }));
  });
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

