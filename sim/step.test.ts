import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, parseTimeOfDay } from './clock.ts';
import { loadWorld } from './load.ts';
import { act as runAct, advance as runAdvance } from './run.ts';
import type { Llm } from './run.ts';
import type { PlanDayInput } from './llm/planner.ts';
import type { Action } from './actions.ts';
import { startAction } from './actions.ts';
import type { World } from './world.ts';
import { addFoe, attackBlocked, clash, die, foesOf, intimidated, knockedOut, landwalked, unblockable, woundsOf } from './combat.ts';
import { landSealed, powersSealed, sealedBy, sealToday, setSeal } from './seal.ts';
import { castBlocked, castSpell, castTargets, readyCast } from './spells.ts';
import { actorColors, COLORS, formatMana, manaAvailable, manaCapacity, parseManaCost, planPayment } from './mana.ts';
import { MAX_TALKS_PER_DAY, usableAbilities, volleyShares } from './run.ts';
import { eligibleGmEvents, moveHours, startTravel, travelBlocked } from './step.ts';
import { gainLife, lifeOf } from './life.ts';
import { awayText, hasAbility, here, needsOf, newState, npcDef, outOfTime, PLAYER_ID, present, ptOf, syncWorld, targetable, together } from './state.ts';
import { foresightText } from './foresight.ts';
import { withPositions } from './wander.ts';
import { nodeAt } from '../web/view.ts';
import { crushRelic, relicsHere } from './relics.ts';
import { recallBlocked, recallCount } from './loremaster.ts';
import { drawKnowledge, handSize, knownSecrets, secretsOf } from './knowledge.ts';
import { claimBlocked } from './items.ts';
import { spendBlocked, storeBlocked } from './eons.ts';
import { applyEnterDestroy, bondBlocked, enterDestroy, onEnter, bondLand, bondTargets, callForth, fetchTargets, fireTargets, firesOnBond, growBlocked, spawnWild, summonLibrary, useAbility } from './abilities.ts';
import { DEPLETED_LABEL, DESTROYED_DAYS, TRAVEL_UNITS_PER_HOUR } from './rules.ts';
import { bindRetainer, retainersOf, swayBlocked } from './retainers.ts';
import { joinedToday } from './bounce.ts';
import { centroid, fixedTile, nearestTile, ownsTile, sameTile, TILE, tileCenter, tilesOf, tileSteps, tooSmall } from './tiles.ts';
import { applyQuell, upkeepQuell } from './quell.ts';
import { upkeepWins } from './win.ts';
import { hirePrice } from './allies.ts';
import { askOptions, askText } from './asks.ts';
import type { Actor, State } from './state.ts';
import { affectedRegions, buildWorld, distance, landTypes, realmOf, region, travelHours } from './world.ts';
import type { RawEntity } from './world.ts';

// Puts `a` in a land, on its middle tile (as arriving there would).
const put = (world: World, a: Actor, regionId: string) => {
  a.region = regionId;
  a.tile = nearestTile(world, regionId);
};
const loc = (id: string, x: number, y: number, terrain: string): RawEntity => ({
  id,
  kind: 'location',
  name: id,
  status: 'canon',
  map: { x, y, terrain, tiles: 1 },
});
// No one's day is written anywhere: the LLM plans it. Here a fake planner stands in, giving
// each character the day a test writes for them (`plan` in these helpers, as
// [start, end, region, kind, activity, emoji, land?, spell?, who?] rows), or a day at leisure where they stand.
const PLANS = new Map<string, unknown[][]>();
const planned = (e: RawEntity): RawEntity => {
  const { plan, ...sim } = e.sim as { plan?: unknown[][] };
  if (plan) PLANS.set(e.id, plan);
  else PLANS.delete(e.id);
  return { ...e, sim };
};
const planDay: Llm['planDay'] = async (input) =>
  (PLANS.get(input.id) ?? [['00:00', '24:00', input.here, 'leisure', '머무름', '🙂']]).map(([start, end, regionId, kind, activity, emoji, land, spell, who]) => ({
    start: parseTimeOfDay(start as string),
    end: parseTimeOfDay(end as string),
    regionId: regionId as string,
    kind: kind as never,
    activity: activity as string,
    emoji: emoji as string,
    ...(land ? { land: land as string } : {}),
    ...(spell ? { spell: spell as string } : {}),
    ...(who ? { who: who as string } : {}),
  }));
const act = (state: State, world: World, action: Action | string, llm: Llm = {}) => runAct(state, world, action, { planDay, ...llm });
const advance = (state: State, world: World, hours: number, llm: Llm = {}) => runAdvance(state, world, hours, { planDay, ...llm });
const npc = (id: string, sim: object): RawEntity => planned({ id, kind: 'character', name: `${id}, 누군가`, status: 'canon', sim });
const allDay = (region: string, kind = 'social') => [['00:00', '24:00', region, kind, '이야기', '💬']];
const npcSim = (region: string, kind = 'social', pt = [1, 1]) => ({ pt, role: 'r', home: region, persona: 'p', goal: 'g', plan: allDay(region, kind) });

function fixture(extra: RawEntity[] = []) {
  const { world, errors } = buildWorld([
    loc('loc-a', 10, 10, 'grassland'),
    loc('loc-b', 30, 10, 'forest'),
    loc('loc-c', 10, 14, 'rocky'),
    loc('loc-sky', 50, 10, 'sky'),
    loc('loc-sea', 10, 30, 'deepsea'),
    ...extra,
  ]);
  assert.deepEqual(errors, []);
  return world;
}
const trap: RawEntity = {
  id: 'evt-trap',
  kind: 'event',
  name: '함정',
  status: 'canon',
  sim: {
    region: 'loc-b',
    trigger: 'landfall',
    landfalls: 2,
    cooldown_hours: 100,
    omen: '땅이 울린다.',
    text: '함정이 터졌다.',
    effects: [
      { type: 'damage', amount: 4 },
      { type: 'destroy_lands', count: 2 },
    ],
  },
};
const tide: RawEntity = {
  id: 'evt-tide',
  kind: 'event',
  name: '조수',
  status: 'canon',
  sim: {
    region: 'loc-sea',
    range: 25,
    trigger: 'gm',
    chance: 1,
    cooldown_hours: 1000,
    scope: 'world',
    text: '조수가 덮쳤다.',
    effects: [
      { type: 'tap', max: 2, skip_untap: true, land_label: '잠긴 해안' },
    ],
  },
};
const character = (world: ReturnType<typeof fixture>, region = 'loc-a', seed = 1) =>
  newState(world, { seed, mode: 'character', player: { name: '나', background: '떠돌이', region } });
const texts = (s: State) => s.log.map((e) => e.text);
// Whether the player could start `action` now (without running the world).
const startActionOk = (state: State, world: World, action: Action) => {
  const copy = structuredClone(state);
  return startAction(copy, world, action) === null;
};

test('the real world loads and runs a day', async () => {
  const world = loadWorld();
  const state = newState(world, { seed: 7, mode: 'observer' });
  assert.equal((await advance(state, world, 24)).error, undefined);
  assert.equal(formatClock(state.minutes), '2일차 06:00');
});

test('an angel flies to the sky island it keeps and lives by energy alone', async () => {
  const world = fixture([npc('chr-angel', { ...npcSim('loc-sky', 'work', [7, 7]), abilities: ['fly'], needs: ['energy'] })]);
  const state = newState(world, { seed: 7, mode: 'observer' });
  await advance(state, world, 24);
  const angel = state.actors['chr-angel'];
  assert.equal(angel.region, 'loc-sky');
  assert.equal(angel.schedule?.day, 1);
  assert.ok(angel.stats.energy >= 0 && angel.stats.energy <= 100);
  // No hunger, no pay.
  assert.deepEqual([angel.stats.hunger, angel.stats.coin], [20, 20]);
});

test('sky and sea regions cannot be reached without the means', async () => {
  const world = fixture();
  const state = character(world);
  assert.match((await act(state, world, { type: 'move', to: 'loc-sky' })).error!, /비행/);
  assert.match((await act(state, world, { type: 'move', to: 'loc-sea' })).error!, /바다/);
});

test('travel takes distance / TRAVEL_UNITS_PER_HOUR hours and the player sees the arrival', async () => {
  const world = fixture();
  const state = character(world);
  const start = state.minutes;
  const { error, entries } = await act(state, world, { type: 'move', to: 'loc-b' });
  assert.equal(error, undefined);
  assert.equal(state.minutes - start, Math.ceil(20 / TRAVEL_UNITS_PER_HOUR) * 60); // 20 units, rounded up
  assert.equal(state.actors[PLAYER_ID].region, 'loc-b');
  assert.ok(entries.some((e) => e.kind === 'arrive' && e.seen));
});

// Landfall = bonding with a land, one a day. To reach a second landfall in one day (which
// only extra-land effects could give), seed an earlier one: loc-a, then bond with loc-b (the
// trap's land) from 06:00 to 10:00.
async function twoLandfalls(world: ReturnType<typeof fixture>) {
  const state = character(world, 'loc-b');
  const me = state.actors[PLAYER_ID];
  me.bonds = ['loc-a'];
  await act(state, world, { type: 'bond' }); // 06:00-10:00
  me.landfalls!.regions.unshift('loc-a'); // as if an extra-land effect had given loc-a earlier today
  return state;
}

test('landfall is bonding with a land: one a day, each gives its mana', async () => {
  const world = fixture();
  const state = character(world, 'loc-a');
  const me = state.actors[PLAYER_ID];
  assert.deepEqual(manaCapacity(state, world, me), {});
  await act(state, world, { type: 'bond' });
  assert.deepEqual(me.bonds, ['loc-a']);
  assert.deepEqual(manaCapacity(state, world, me), { W: 1 }); // grassland
  assert.match((await act(state, world, { type: 'bond' })).error!, /이미/);
  await act(state, world, { type: 'move', to: 'loc-c' });
  assert.match((await act(state, world, { type: 'bond' })).error!, /하루에 하나/);
  await act(state, world, { type: 'wait', hours: 24 });
  await act(state, world, { type: 'bond' });
  assert.deepEqual(manaCapacity(state, world, me), { W: 1, R: 1 }); // rocky
});

test('the trap answers only when its land is the second landfall of the day', async () => {
  const world = fixture([trap]);
  const once = character(world, 'loc-b');
  await act(once, world, { type: 'bond' });
  await act(once, world, { type: 'wait', hours: 2 });
  assert.ok(!texts(once).includes('땅이 울린다.'));

  const twice = await twoLandfalls(world);
  await act(twice, world, { type: 'wait', hours: 2 });
  assert.ok(texts(twice).includes('땅이 울린다.'));
  assert.ok(texts(twice).includes('하던 일을 멈췄다.'));
});

test('the trap hurts those there and lays waste to the lands the intruder came through', async () => {
  const world = fixture([trap]);
  const state = await twoLandfalls(world);
  state.actors[PLAYER_ID].pt = [1, 5]; // tough enough to live through 4 damage
  await act(state, world, { type: 'wait', hours: 1 }); // omen
  await act(state, world, { type: 'wait', hours: 1 }); // the trap
  assert.ok(texts(state).includes('함정이 터졌다.'));
  assert.equal(state.actors[PLAYER_ID].wounds?.amount, 4);
  for (const id of ['loc-a', 'loc-b']) assert.ok(state.regions[id].destroyed);
  assert.ok(!state.regions['loc-c'].destroyed);
  assert.match((await act(state, world, { type: 'explore', hours: 1, pace: 'normal' })).error!, /부서/);
  // Wounds heal when the turn ends; destroyed land lies in ruins for a week.
  await act(state, world, { type: 'wait', hours: 24 });
  await act(state, world, { type: 'wait', hours: 24 });
  assert.equal(woundsOf(state.actors[PLAYER_ID], state.minutes), 0);
  assert.ok(state.regions['loc-b'].destroyed);
  const until = state.regions['loc-b'].destroyed!.until!;
  assert.equal(until % 1440, 0); // a midnight
  assert.equal(Math.floor(until / 1440) - Math.floor(state.regions['loc-b'].destroyed!.at / 1440), DESTROYED_DAYS);
  while (state.minutes < until) await act(state, world, { type: 'wait', hours: 24 });
  for (const id of ['loc-a', 'loc-b']) assert.equal(state.regions[id].destroyed, undefined);
  assert.ok(texts(state).some((x) => x.includes('부서졌던 땅이 되살아났다')));
  // Bonds held all along give mana again.
  assert.deepEqual(manaCapacity(state, world, state.actors[PLAYER_ID], state.minutes), { W: 1, G: 1 });
});

test('a land\'s destroyed-trap answers when that land is laid waste: wild snakes turn on the one who did it', async () => {
  const snakeTrap: RawEntity = {
    id: 'evt-snakes',
    kind: 'event',
    name: '뱀 함정',
    status: 'canon',
    sim: { region: 'loc-a', trigger: 'destroyed', text: '뱀이 쏟아졌다.', effects: [{ type: 'create', creature: 'cre-s', count: 4, pt: [1, 1], colors: ['G'] }] },
  };
  const world = fixture([trap, snakeTrap, lore('cre-s', 'creature')]);
  const state = await twoLandfalls(world);
  state.actors[PLAYER_ID].pt = [1, 5];
  await act(state, world, { type: 'wait', hours: 1 }); // omen
  await act(state, world, { type: 'wait', hours: 1 }); // the lava trap lays loc-a and loc-b waste
  assert.ok(state.regions['loc-a'].destroyed);
  assert.ok(texts(state).includes('뱀이 쏟아졌다.'));
  const snakes = Object.values(state.actors).filter((a) => state.tokens?.[a.id]?.creature === 'cre-s');
  assert.equal(snakes.length, 4);
  assert.ok(snakes.every((s) => s.region === 'loc-a' && !s.master && s.foes?.ids.includes(PLAYER_ID)));
  assert.ok(snakes.every((s) => state.tokens![s.id].colors?.join() === 'G')); // green Snakes
});

test('4 damage kills an ordinary 1/1 person and ends their life', async () => {
  const world = fixture([trap]);
  const state = await twoLandfalls(world);
  await act(state, world, { type: 'wait', hours: 1 });
  await act(state, world, { type: 'wait', hours: 1 });
  assert.ok(state.actors[PLAYER_ID].dead);
  assert.ok(state.over);
  assert.match((await act(state, world, { type: 'wait', hours: 1 })).error!, /끝났다/);
});

test('the careful dodge an omened trap', async () => {
  const world = fixture([trap]);
  const state = await twoLandfalls(world);
  await act(state, world, { type: 'explore', hours: 2, pace: 'careful' }); // omen, stops
  await act(state, world, { type: 'wait', hours: 1 });
  assert.ok(texts(state).some((t) => t.includes('몸을 피했다')));
});

test('the tide taps people first, then coastal lands, and they skip the next untap', async () => {
  const world = fixture([tide]);
  const state = character(world, 'loc-a');
  const gmDay: Llm['gmDay'] = async ({ day, hour, eligible }) => ({
    day,
    source: 'llm',
    fires: eligible.map((e) => ({ eventId: e.id, hour })),
  });
  await act(state, world, { type: 'wait', hours: 24 }, { gmDay });
  const me = state.actors[PLAYER_ID];
  assert.ok(texts(state).includes('조수가 덮쳤다.'));
  // Tapped on day 1: misses day 2's untap, freed at the start of day 3.
  assert.ok(texts(state).some((t) => t.includes('묶였다. 3일차 00:00까지')));
  assert.ok(texts(state).some((t) => t.includes('풀려났다')));
  assert.equal(me.boundUntil, undefined);
  assert.ok(formatClock(state.minutes).startsWith('3일차'));
  // max 2: the player and one coastal land (loc-a), not the second (loc-c).
  assert.ok(texts(state).some((t) => t.startsWith('loc-a: 잠긴 해안')));
  assert.ok(!texts(state).some((t) => t.startsWith('loc-c: 잠긴 해안')));
});

test('combat: both strike at once; a 1/1 attacking a 2/2 dies', async () => {
  const world = fixture([npc('chr-x', npcSim('loc-a', 'work', [2, 2]))]);
  const state = character(world, 'loc-a');
  await act(state, world, { type: 'attack', to: 'chr-x' });
  assert.ok(state.actors[PLAYER_ID].dead);
  assert.equal(state.actors['chr-x'].wounds?.amount, 1);
  assert.ok(!state.actors['chr-x'].dead);
});

test('combat: the attacked NPC fights back each hour until someone falls', async () => {
  const world = fixture([npc('chr-x', npcSim('loc-a', 'work', [1, 3]))]);
  const state = character(world, 'loc-a');
  state.actors[PLAYER_ID].pt = [1, 5];
  await act(state, world, { type: 'attack', to: 'chr-x' }); // x 1, me 1 (one exchange that hour)
  await act(state, world, { type: 'wait', hours: 1 }); // x attacks: x 2, me 2
  await act(state, world, { type: 'attack', to: 'chr-x' }); // x 3: dead, me 3
  assert.ok(state.actors['chr-x'].dead);
  assert.equal(state.actors[PLAYER_ID].wounds?.amount, 3);
  assert.ok(!state.actors[PLAYER_ID].dead);
});

test('combat: a flyer may take to the air; an NPC may turn hostile while talking', async () => {
  const flyer = { ...npcSim('loc-a', 'work', [7, 7]), abilities: ['fly'] };
  const world = fixture([npc('chr-x', flyer)]);
  const state = character(world, 'loc-a');
  await act(state, world, { type: 'attack', to: 'chr-x' }, { evade: async () => true });
  assert.ok(texts(state).some((t) => t.includes('날아올라 공격을 피했다')));
  assert.ok(!state.actors[PLAYER_ID].dead);

  const world2 = fixture([npc('chr-y', npcSim('loc-a', 'work', [1, 1]))]);
  const s2 = character(world2, 'loc-a');
  s2.actors[PLAYER_ID].pt = [0, 5];
  await act(s2, world2, { type: 'talk', to: 'chr-y', say: '비켜' }, { reply: async () => ({ say: '감히!', attack: true }) });
  assert.ok(texts(s2).some((t) => t.includes('적의를 드러냈다')));
  assert.ok(texts(s2).some((t) => t.includes('공격했다')));
  assert.equal(s2.actors[PLAYER_ID].wounds?.amount, 1);
});

const lore = (id: string, kind: string): RawEntity => ({ id, kind, name: id, status: 'canon' });
// A character of legend: powers of their own, no needs. By default one who lives in the sea.
const being = (id: string, sim: object): RawEntity =>
  planned({ id, kind: 'character', name: `${id}, 존재`, status: 'canon', sim: { role: 'r', persona: 'p', goal: 'g', needs: ['energy'], home: 'loc-sea', abilities: ['aquatic'], ...sim } });
const kalitas = being('chr-k', {
  home: 'loc-c',
  abilities: [],
  pt: [5, 5],
  mana: { B: 7 },
  activated: [
    {
      id: 'kin',
      name: '혈족으로 들이기',
      cost: '{B}{B}{B}',
      tap: true,
      effects: [{ type: 'destroy' }, { type: 'raise', creature: 'cre-v', faction: 'fac-g', colors: ['B'] }],
    },
  ],
});

test('a character of legend pays mana and taps to destroy someone, who rises as its retainer', async () => {
  const world = fixture([kalitas, lore('cre-v', 'creature'), lore('fac-g', 'faction'), npc('chr-x', npcSim('loc-a', 'work', [2, 3]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const gmDay: Llm['gmDay'] = async ({ day, hour, abilities }) => ({
    day,
    source: 'llm',
    fires: [],
    uses: abilities.map((x) => ({ being: x.being.id, ability: x.ability.id, target: 'chr-x', hour })),
  });
  await advance(state, world, 2, { gmDay });
  assert.ok(state.actors['chr-x'].dead);
  const token = Object.values(state.actors).find((a) => a.id.startsWith('tok-'))!;
  assert.deepEqual(token.pt, [2, 3]);
  // It rose where the victim fell (loc-a) and went to its master's side.
  assert.ok(texts(state).some((t) => t.includes('되살아났다')));
  assert.equal(token.master, 'chr-k');
  assert.equal(token.region, 'loc-c');
  assert.match(state.tokens![token.id].role, /fac-g/);
  assert.equal(token.schedule, undefined); // a token who serves: no day of its own
  assert.match(token.task?.activity ?? '', /곁/);
  assert.deepEqual(state.tokens![token.id].colors, ['B']); // a black Vampire
  const bs = state.actors['chr-k'];
  assert.equal(formatClock(bs.boundUntil!), '2일차 00:00');
  assert.deepEqual(manaAvailable(state, world, bs, state.minutes), { B: 4 });
  assert.deepEqual(usableAbilities(state, world, state.minutes), []); // tapped
  // It lives its master's day, not one planned for it; freed (its master dead), it plans its own.
  const planned: string[] = [];
  const llm: Llm = { planDay: async (input) => (planned.push(input.id), planDay!(input)), gmDay: async ({ day }) => ({ day, source: 'llm', fires: [] }) };
  await advance(state, world, 24, llm);
  assert.ok(!planned.includes(token.id));
  assert.equal(state.actors[token.id].region, bs.region);
  (await import('./combat.ts')).die(state, bs, state.minutes, '시험');
  await advance(state, world, 24, llm);
  assert.ok(planned.includes(token.id));
});

test('Lorthos taps only if he can pay his {8}', async () => {
  const tideCost = (mana: number): RawEntity[] => [
    being('chr-l', { pt: [8, 8], mana: { U: mana } }),
    { ...tide, sim: { ...(tide.sim as object), cost: { by: 'chr-l', mana: '{8}' } } },
  ];
  const gmDay: Llm['gmDay'] = async ({ day, hour, eligible }) => ({ day, source: 'llm', fires: eligible.map((e) => ({ eventId: e.id, hour })) });
  const rich = fixture(tideCost(8));
  const a = character(rich, 'loc-a');
  await act(a, rich, { type: 'wait', hours: 1 }, { gmDay });
  assert.ok(texts(a).some((t) => t.includes('묶였다')));
  const poor = fixture(tideCost(5));
  const b = character(poor, 'loc-a');
  await act(b, poor, { type: 'wait', hours: 1 }, { gmDay });
  assert.ok(texts(b).some((t) => t.includes('힘이 남아 있지 않았다')));
  assert.ok(!texts(b).some((t) => t.includes('묶였다')));
});

test('characters of legend live planned days like anyone; those of the sea never leave it', async () => {
  const world = fixture([
    being('chr-k', { ...(kalitas.sim as object), plan: allDay('loc-a', 'work') }),
    lore('cre-v', 'creature'),
    lore('fac-g', 'faction'),
    being('chr-l', { pt: [8, 8], plan: allDay('loc-a', 'work') }),
  ]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  await advance(state, world, 30);
  assert.equal(state.actors['chr-k'].kind, 'npc');
  assert.equal(state.actors['chr-k'].region, 'loc-a');
  assert.ok(state.actors['chr-k'].stats.energy < 80); // every being tires
  assert.equal(state.actors['chr-k'].stats.hunger, 20); // but he doesn't eat
  assert.equal(state.actors['chr-l'].region, 'loc-sea');
  assert.match(travelBlocked(state, world, state.actors['chr-l'], 'loc-a')!, /뭍/);
});

test('without a day planned for everyone the world halts, and moves on once the plans come', async () => {
  const world = fixture([npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.match((await runAdvance(state, world, 3)).error!, /LLM 설정이 없어/);
  let calls = 0;
  const failing: Llm = { planDay: async () => (calls++, null) };
  const r = await runAdvance(state, world, 3, failing);
  assert.match(r.error!, /x의 하루를 짜지 못해 세계가 멈췄다/);
  assert.equal(calls, 2); // asked again before halting
  assert.equal(formatClock(state.minutes), '1일차 06:00');
  assert.equal((await advance(state, world, 3)).error, undefined);
  assert.equal(formatClock(state.minutes), '1일차 09:00');
});

test('the player can fight a being where it stays; it strikes back, and a dead being loses its powers', async () => {
  const world = fixture([kalitas, lore('cre-v', 'creature'), lore('fac-g', 'faction')]);
  const state = character(world, 'loc-c');
  await act(state, world, { type: 'attack', to: 'chr-k' }, {});
  assert.equal(state.actors['chr-k'].wounds?.amount, 1);
  assert.ok(state.over); // 5 power against a 1/1

  const weak = fixture([
    being('chr-k', { ...(kalitas.sim as object), home: 'loc-c', pt: [0, 1] }),
    lore('cre-v', 'creature'),
    lore('fac-g', 'faction'),
  ]);
  const s = character(weak, 'loc-c');
  await act(s, weak, { type: 'attack', to: 'chr-k' }, {});
  assert.ok(s.actors['chr-k'].dead);
  assert.equal(s.over, undefined);
  assert.deepEqual(usableAbilities(s, weak, s.minutes), []);
});

test('an event its being must pay for stops when the being is dead', async () => {
  const world = fixture([being('chr-l', { pt: [8, 8], mana: { U: 8 } }), { ...tide, sim: { ...(tide.sim as object), cost: { by: 'chr-l', mana: '{8}' } } }]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.deepEqual(eligibleGmEvents(state, world, state.minutes).map((e) => e.id), ['evt-tide']);
  state.actors['chr-l'].dead = { at: state.minutes, cause: '시험' };
  assert.deepEqual(eligibleGmEvents(state, world, state.minutes), []);
});

test('an old save gets its beings as actors, keeping their mana and tap', () => {
  const world = fixture([kalitas, lore('cre-v', 'creature'), lore('fac-g', 'faction')]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const old = newState(world, { seed: 1, mode: 'observer' });
  delete state.actors['chr-k'];
  state.beings = { 'chr-k': { id: 'chr-k', boundUntil: 1440, manaSpent: { day: 0, spent: { B: 3 } } } };
  syncWorld(state, world);
  // Saves from when such characters were 'beings' who stayed at home.
  (old.actors['chr-k'] as { kind: string }).kind = 'being';
  syncWorld(old, world);
  assert.equal(old.actors['chr-k'].kind, 'npc');
  assert.equal(state.actors['chr-k'].region, 'loc-c');
  assert.equal(state.actors['chr-k'].boundUntil, 1440);
  assert.deepEqual(manaAvailable(state, world, state.actors['chr-k'], state.minutes), { B: 4 });
  assert.equal(state.beings, undefined);
});

test('areas: a land inside a region, an hour from it, reached by events on the region', async () => {
  const world = fixture([
    { id: 'loc-in', kind: 'location', name: '안뜰', status: 'canon', map: { in: 'loc-a', terrain: 'swamp', tiles: 1 } },
    npc('chr-x', npcSim('loc-in')),
  ]);
  const inner = world.regions.find((r) => r.id === 'loc-in')!;
  const [a, b] = ['loc-a', 'loc-b'].map((id) => world.regions.find((r) => r.id === id)!);
  assert.deepEqual([inner.x, inner.y, inner.color], [10, 10, 'B']);
  assert.equal(travelHours(a, inner), 1);
  assert.equal(travelHours(b, inner), travelHours(b, a) + 1); // through the region
  // Someone on the region's open ground doesn't meet those in the area.
  const state = character(world, 'loc-a');
  assert.match((await act(state, world, { type: 'talk', to: 'chr-x', say: '안녕' }, {})).error ?? '', /여기 없다/);
  await act(state, world, { type: 'move', to: 'loc-in' }, {});
  assert.equal(state.actors[PLAYER_ID].region, 'loc-in');
  // An event on the region reaches the area; one in the area stays there.
  assert.deepEqual(affectedRegions(world, { region: 'loc-a', range: 0 } as never).map((r) => r.id).sort(), ['loc-a', 'loc-in']);
  assert.deepEqual(affectedRegions(world, { region: 'loc-in', range: 0 } as never).map((r) => r.id), ['loc-in']);
});

test('buildWorld rejects areas in nowhere, in areas, or in a sea; a sea may be an area of a land (a bay)', () => {
  const area = (id: string, parent: string, terrain = 'swamp'): RawEntity => ({ id, kind: 'location', name: id, status: 'canon', map: { in: parent, terrain } });
  const { errors } = buildWorld([
    loc('loc-a', 10, 10, 'grassland'),
    loc('loc-sea', 10, 30, 'deepsea'),
    area('loc-in', 'loc-a'),
    area('loc-nowhere', 'loc-moon'),
    area('loc-nested', 'loc-in'),
    area('loc-wet', 'loc-sea', 'deepsea'),
    area('loc-bay', 'loc-a', 'deepsea'),
  ]);
  const has = (id: string) => errors.some((e) => e.startsWith(`${id}:`));
  assert.ok(!has('loc-in'));
  assert.ok(has('loc-nowhere'));
  assert.ok(has('loc-nested'));
  assert.ok(has('loc-wet'));
  assert.ok(!has('loc-bay'));
});

const needle: RawEntity = {
  id: 'evt-needle',
  kind: 'event',
  name: '바늘 함정',
  status: 'canon',
  sim: { region: 'loc-b', trigger: 'enter', gained_life: true, text: '가시가 물었다.', effects: [{ type: 'lose_life', amount: 5 }] },
};

test('an enter trap bites only those who gained life today, and takes life', async () => {
  const world = fixture([needle]);
  const fed = character(world, 'loc-a');
  const p = fed.actors[PLAYER_ID];
  // Food and sleep don't count as gaining life.
  await act(fed, world, { type: 'move', to: 'loc-b' }, {});
  assert.ok(!texts(fed).some((t) => t.includes('가시가 물었다')));

  const drained = character(world, 'loc-a');
  const q = drained.actors[PLAYER_ID];
  gainLife(drained, q, 1, drained.minutes, '시험');
  assert.equal(q.life, 21); // from 20; energy is apart
  assert.equal(q.stats.energy, 80);
  await act(drained, world, { type: 'move', to: 'loc-b' }, {});
  assert.ok(texts(drained).some((t) => t.includes('생명 5을 잃었다')));
  assert.equal(q.life, 16);
  assert.equal(q.dead, undefined);
  assert.equal(p.stats.energy, q.stats.energy);
});

const beast = (plan: unknown[][], extra: object = {}): RawEntity => planned({
  id: 'cre-b',
  kind: 'creature',
  name: '짐승',
  status: 'canon',
  sim: {
    pt: [4, 4],
    role: 'r',
    home: 'loc-a',
    persona: 'p',
    goal: 'g',
    needs: ['energy', 'hunger'],
    beast: true,
    landfall: { pt: [4, 4], trample: true },
    plan,
    ...extra,
  },
});
const beastDay = [
  ['00:00', '06:00', 'loc-a', 'sleep', '잠', '💤'],
  ['06:00', '10:00', 'loc-a', 'bond', '사냥터 차지', '🐾'],
  ['10:00', '12:00', 'loc-a', 'eat', '사냥', '🍖'],
  ['12:00', '24:00', 'loc-a', 'leisure', '어슬렁', '🌳'],
];

test('a beast bonds as its day is planned, surges until midnight, hunts the land out and cannot claim it again', async () => {
  const world = fixture([beast(beastDay)]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const b = state.actors['cre-b'];
  await advance(state, world, 4); // 06:00 -> 10:00
  assert.deepEqual(b.bonds, ['loc-a']);
  assert.deepEqual(ptOf(b), [8, 8]);
  assert.ok(texts(state).some((t) => t.includes('힘이 치솟았다')));
  await advance(state, world, 2);
  assert.ok(state.regions['loc-a'].conditions.some((c) => c.label === DEPLETED_LABEL));
  await advance(state, world, 14); // past midnight
  assert.deepEqual(ptOf(b), [4, 4]);
  assert.match(bondBlocked(state, world, b, state.minutes) ?? '', /이미|바닥/);
  // A new land replaces the old hunting ground.
  b.region = 'loc-c';
  bondLand(state, world, b, state.minutes);
  assert.deepEqual(b.bonds, ['loc-c']);
});

test('a hungry beast hunts the weakest one with it, feeds on a kill, and tramples on', async () => {
  const world = fixture([beast([['00:00', '24:00', 'loc-a', 'leisure', '어슬렁', '🌳']]), npc('chr-x', npcSim('loc-a', 'social', [1, 3]))]);
  const state = character(world, 'loc-a');
  const b = state.actors['cre-b'];
  b.stats.hunger = 80;
  b.boost = { until: 1440, pt: [4, 4], trample: true };
  await act(state, world, { type: 'wait', hours: 1 }, {});
  assert.ok(texts(state).some((t) => t.includes('덮쳤다')));
  assert.ok(state.actors[PLAYER_ID].dead); // the weakest: 1/1
  assert.ok(texts(state).some((t) => t.includes('먹어치웠다')));
  assert.ok(b.stats.hunger < 30);
  // 8 power against 1 toughness: 7 more runs on into the only other one there (1/3), an NPC,
  // who is knocked out rather than killed (no player between them).
  assert.ok(texts(state).some((t) => t.includes('돌진이')));
  assert.equal(state.actors['chr-x'].dead, undefined);
  assert.ok(knockedOut(state.actors['chr-x']));
});

test('a beast only growls when spoken to', async () => {
  const world = fixture([beast([['00:00', '24:00', 'loc-a', 'leisure', '어슬렁', '🌳']])]);
  const state = character(world, 'loc-a');
  await act(state, world, { type: 'talk', to: 'cre-b', say: '안녕' }, { reply: async () => ({ say: '말한다', attack: false }) });
  assert.ok(texts(state).some((t) => t.includes('으르렁')));
  assert.ok(!texts(state).some((t) => t.includes('말한다')));
});

test('NPCs who meet talk, remember each other, and may fall out; their fight knocks out, not kills', async () => {
  const world = fixture([npc('chr-x', npcSim('loc-a', 'social', [3, 3])), npc('chr-y', npcSim('loc-a', 'social', [1, 2]))]);
  const state = newState(world, { seed: 3, mode: 'observer' });
  let calls = 0;
  const converse: Llm['converse'] = async ({ a, b }) => {
    calls++;
    return {
      lines: [
        { by: a.id, say: '비켜라.' },
        { by: b.id, say: '싫다.' },
      ],
      impressions: { [a.id]: '건방지다', [b.id]: '거칠다' },
      attacker: a.id,
    };
  };
  await advance(state, world, 3, { converse });
  assert.equal(calls, 1); // they meet once a day
  assert.ok(texts(state).some((t) => t.includes('“비켜라.”')));
  const [x, y] = [state.actors['chr-x'], state.actors['chr-y']];
  assert.ok(x.relations?.['chr-y'] && y.relations?.['chr-x']);
  assert.ok(texts(state).some((t) => t.includes('적의를 드러냈다')));
  assert.equal(y.dead, undefined);
  assert.ok(knockedOut(y));
  assert.ok(texts(state).some((t) => t.includes('기절했다')));
  assert.match(y.relations!['chr-x'].text, /나를 공격했다/);
  // The fight is over once one is down.
  const fights = state.log.filter((e) => e.kind === 'combat' && e.text.includes('공격했다')).length;
  await advance(state, world, 2, { converse });
  assert.equal(state.log.filter((e) => e.kind === 'combat' && e.text.includes('공격했다')).length, fights);
});

test('NPC conversations are capped per day', async () => {
  const people = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => npc(`chr-${s}`, npcSim('loc-a')));
  const world = fixture(people);
  const state = newState(world, { seed: 3, mode: 'observer' });
  let calls = 0;
  await advance(state, world, 1, { converse: async () => (calls++, null) });
  assert.equal(calls, MAX_TALKS_PER_DAY);
});

test('an NPC remembers what it thinks of the player', async () => {
  const world = fixture([npc('chr-x', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  await act(state, world, { type: 'talk', to: 'chr-x', say: '안녕' }, { reply: async () => ({ say: '반갑소.', attack: false, impression: '예의 바른 떠돌이' }) });
  assert.equal(state.actors['chr-x'].relations?.[PLAYER_ID]?.text, '예의 바른 떠돌이');
});

const tribute = (learnAt = 'loc-swamp'): RawEntity => ({
  id: 'spl-t',
  kind: 'spell',
  name: '공물',
  status: 'canon',
  sim: {
    cost: '{1}{B}',
    learn_at: learnAt,
    kicker: { tap: 'cre-v' },
    effects: [{ type: 'lose_half_life' }, { type: 'gain_life_lost', if_kicked: true }],
  },
});

test('a spell is learned where it is taught, then cast with mana on someone here', async () => {
  const world = fixture([loc('loc-swamp', 12, 10, 'swamp'), tribute(), lore('cre-v', 'creature'), npc('chr-x', npcSim('loc-swamp'))]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  assert.match((await act(state, world, { type: 'learn', spell: 'spl-t' })).error ?? '', /에서 배울 수 있다/);
  await act(state, world, { type: 'move', to: 'loc-swamp' });
  await act(state, world, { type: 'learn', spell: 'spl-t' });
  assert.deepEqual(p.spells, ['spl-t']);
  // No mana yet: two lands, one of them black.
  assert.match((await act(state, world, { type: 'cast', spell: 'spl-t', to: 'chr-x', kick: false })).error ?? '', /마나가 모자라다/);
  p.bonds = ['loc-swamp', 'loc-a'];
  const x = state.actors['chr-x'];
  x.life = 9;
  await act(state, world, { type: 'cast', spell: 'spl-t', to: 'chr-x', kick: false });
  assert.ok(texts(state).some((t) => t.includes('공물을 걸었다')));
  assert.equal(x.life, 4); // half of 9, rounded up
  assert.ok(x.relations?.[PLAYER_ID]);
  assert.equal(p.lifeGained, undefined); // not kicked
});

test('kicker: tapping a vampire you control drains the life lost into you', async () => {
  const world = fixture([loc('loc-swamp', 12, 10, 'swamp'), tribute(), lore('cre-v', 'creature'), npc('chr-x', npcSim('loc-swamp'))]);
  const state = character(world, 'loc-swamp');
  const p = state.actors[PLAYER_ID];
  p.spells = ['spl-t'];
  p.bonds = ['loc-swamp', 'loc-a'];
  p.life = 10;
  state.actors['chr-x'].life = 8;
  assert.match((await act(state, world, { type: 'cast', spell: 'spl-t', to: 'chr-x', kick: true })).error ?? '', /탭할 것이 없다/);
  // A vampire who serves the player.
  state.tokens = { 'tok-1': { ...world.npcs[0], id: 'tok-1', name: '흡혈귀', creature: 'cre-v' } };
  state.actors['tok-1'] = { ...state.actors['chr-x'], id: 'tok-1', name: '흡혈귀', relations: undefined, master: PLAYER_ID };
  await act(state, world, { type: 'cast', spell: 'spl-t', to: 'chr-x', kick: true });
  assert.ok(state.actors['tok-1'].boundUntil !== undefined);
  assert.equal(p.life, 14); // 10 + the 4 drained
  assert.equal(p.lifeGained, 0);
});

test('a persuaded NPC becomes the player\'s retainer: follows them and joins their fights', async () => {
  const world = fixture([npc('chr-x', npcSim('loc-a', 'social', [2, 2])), npc('chr-y', npcSim('loc-b', 'social', [1, 1]))]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  await act(state, world, { type: 'talk', to: 'chr-x', say: '함께 가자' }, { reply: async () => ({ say: '따르겠소.', attack: false, follow: true }) });
  const x = state.actors['chr-x'];
  assert.equal(x.master, PLAYER_ID);
  assert.ok(texts(state).some((t) => t.includes('권속이 되었다')));
  // Can't be won twice.
  assert.match(swayBlocked(state, world, x) ?? '', /이미/);
  // Follows the player to the forest.
  await act(state, world, { type: 'move', to: 'loc-b' });
  await act(state, world, { type: 'wait', hours: 6 });
  assert.equal(x.region, 'loc-b');
  // Joins the player's fight (the player's foe is theirs), and the player's death frees them.
  p.foes = { day: 0, ids: ['chr-y'] };
  p.stats.energy = 80;
  await act(state, world, { type: 'wait', hours: 1 });
  assert.ok(state.log.some((e) => e.kind === 'combat' && e.actors[0] === 'chr-x'));
  x.master = PLAYER_ID;
  (await import('./combat.ts')).die(state, p, state.minutes, '시험');
  assert.equal(x.master, undefined);
});

const mantle: RawEntity = {
  id: 'spl-m',
  kind: 'spell',
  name: '망토',
  status: 'canon',
  sim: { cost: '{W}', learn_at: 'loc-a', target: 'any_here', effects: [{ type: 'aura', pt: [3, 3], double_life_on_hit: true }] },
};

test('an aura stays on its bearer, and when they hit someone their controller\'s life doubles', async () => {
  const world = fixture([mantle, npc('chr-x', npcSim('loc-a', 'social', [0, 9]))]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.spells = ['spl-m'];
  p.bonds = ['loc-a'];
  await act(state, world, { type: 'cast', spell: 'spl-m', to: PLAYER_ID, kick: false });
  assert.deepEqual(ptOf(p), [4, 4]);
  assert.equal(state.actors['chr-x'].foes, undefined); // a blessing, not an attack
  p.life = 13;
  await act(state, world, { type: 'attack', to: 'chr-x' });
  assert.ok(texts(state).some((t) => t.includes('생명') && t.includes('얻었다')));
  assert.equal(p.life, 26); // doubled, no cap
  assert.equal(p.lifeGained, 0);
  // Still there the next day.
  await act(state, world, { type: 'wait', hours: 24 });
  assert.deepEqual(ptOf(p), [4, 4]);
});

const bolt: RawEntity = {
  id: 'spl-bolt',
  kind: 'spell',
  name: '불덩이',
  status: 'canon',
  sim: { cost: '{R}', learn_at: 'loc-c', effects: [{ type: 'lose_half_life' }] },
};
const walker = being('chr-w', {
  home: 'loc-a',
  abilities: [],
  pt: [0, 5],
  loyalty: 5,
  knows_colors: ['R'],
  activated: [
    { id: 'plus', name: '불꽃 던지기', loyalty: 1, effects: [{ type: 'discard_spell', if_color: 'R', damage: 4 }] },
    { id: 'wheel', name: '기억을 태우는 불길', loyalty: -2, target: false, effects: [{ type: 'wheel', draw: 3 }] },
    { id: 'ult', name: '되살아나는 불꽃', loyalty: -7, effects: [{ type: 'flashback', color: 'R' }] },
  ],
});

test('a planeswalker: loyalty abilities once a day, a red spell let go becomes fire, damage wears loyalty down', async () => {
  const world = fixture([walker, bolt, npc('chr-x', npcSim('loc-a', 'social', [1, 5]))]);
  const state = character(world, 'loc-a');
  const w = state.actors['chr-w'];
  assert.equal(w.loyalty, 5);
  assert.deepEqual(w.spells, ['spl-bolt']); // holds every red spell
  assert.equal(useAbility(state, world, 'chr-w', 'plus', 'chr-x', state.minutes), null);
  assert.equal(w.loyalty, 6);
  assert.deepEqual(w.graveyard, ['spl-bolt']);
  assert.equal(woundsOf(state.actors['chr-x'], state.minutes), 4);
  assert.match(useAbility(state, world, 'chr-w', 'wheel', '', state.minutes) ?? '', /이미 기세/);
  assert.deepEqual(usableAbilities(state, world, state.minutes), []);
  // Next day: everyone here lets go of their spells and recalls some at random.
  state.minutes += 1440;
  state.actors[PLAYER_ID].spells = ['spl-bolt'];
  assert.equal(useAbility(state, world, 'chr-w', 'wheel', '', state.minutes), null);
  assert.equal(w.loyalty, 4);
  assert.ok(state.actors[PLAYER_ID].graveyard?.includes('spl-bolt'));
  assert.deepEqual(state.actors[PLAYER_ID].spells, []); // let go of
  assert.ok((state.actors[PLAYER_ID].knowledge?.length ?? 0) > 0); // draws: secrets of the world
  // Blows come off loyalty; at 0 the walker leaves this plane (not a death).
  state.actors[PLAYER_ID].pt = [4, 4];
  await act(state, world, { type: 'attack', to: 'chr-w' });
  assert.equal(w.left, true);
  assert.ok(texts(state).some((t) => t.includes('이 차원을 떠났다')));
  assert.equal(state.over, undefined);
});

test('the ultimate casts every red spell let go of, free', () => {
  const world = fixture([walker, bolt, npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const w = state.actors['chr-w'];
  w.loyalty = 8;
  w.graveyard = ['spl-bolt'];
  state.actors['chr-x'].life = 8;
  assert.equal(useAbility(state, world, 'chr-w', 'ult', 'chr-x', state.minutes), null);
  assert.ok(texts(state).some((t) => t.includes('값 없이')));
  assert.equal(state.actors['chr-x'].life, 4);
  assert.equal(w.loyalty, 1);
});

test('NPCs socialising in the same region meet once a day', async () => {
  const world = fixture([npc('chr-x', npcSim('loc-a')), npc('chr-y', npcSim('loc-a'))]);
  const state = newState(world, { seed: 3, mode: 'observer' });
  await advance(state, world, 30);
  assert.equal(state.log.filter((e) => e.kind === 'meet').length, 2);
});

test('LLM hooks: plans move NPCs, free text becomes an action, narration is logged', async () => {
  const world = fixture([npc('chr-x', npcSim('loc-a', 'work'))]);
  const state = character(world, 'loc-a');
  const r = await act(state, world, '숲으로 간다', {
    planDay: async () => [{ start: 0, end: 1440, regionId: 'loc-b', kind: 'work', activity: '벌목', emoji: '🪓' }],
    interpret: async ({ text }) => (text.includes('숲') ? { type: 'move', to: 'loc-b' } : null),
    narrate: async ({ entries }) => `이야기 ${entries.length}줄`,
  });
  assert.equal(r.error, undefined);
  assert.equal(state.actors['chr-x'].region, 'loc-b');
  assert.equal(state.actors['chr-x'].schedule!.source, 'llm');
  assert.equal(state.actors[PLAYER_ID].region, 'loc-b');
  assert.equal(r.entries.at(-1)!.kind, 'narration');
});

test('a saved state replays the same way', async () => {
  const world = fixture([trap, tide, npc('chr-x', npcSim('loc-b', 'work'))]);
  const a = newState(world, { seed: 42, mode: 'observer' });
  await advance(a, world, 30);
  const b = JSON.parse(JSON.stringify(a)) as State;
  await advance(a, world, 50);
  await advance(b, world, 50);
  assert.deepEqual(a, b);
});

test('buildWorld reports bad game data', () => {
  const { errors } = buildWorld([
    loc('loc-a', 10, 10, 'grassland'),
    loc('loc-sky', 50, 10, 'sky'),
    { id: 'loc-bad', kind: 'location', name: 'x', map: { x: 500, y: 1, terrain: 'lava' } },
    // An island can only belong to a region that is on the map.
    { id: 'loc-stray', kind: 'location', name: 'x', map: { x: 20, y: 20, terrain: 'beach', size: 'island', of: 'loc-moon' } },
    // A written routine or a GM flag: no longer (the LLM plans every day).
    { id: 'chr-routine', kind: 'character', name: 'x', sim: { ...npcSim('loc-a'), plan: undefined, routine: allDay('loc-a') } },
    { id: 'chr-gm', kind: 'character', name: 'x', sim: { ...npcSim('loc-a'), plan: undefined, gm: true } },
    npc('chr-nowhere', npcSim('loc-moon')),
    npc('chr-grounded', npcSim('loc-sky')),
    npc('chr-fish', { ...npcSim('loc-a'), abilities: ['aquatic'] }),
    { id: 'evt-colorless', kind: 'event', name: 'x', status: 'canon', sim: { region: 'loc-a', trigger: 'gm', chance: 0.1, text: 't', effects: [{ type: 'create', creature: 'loc-a', count: 1, pt: [1, 1] }] } },
    { ...tribute('loc-moon'), id: 'spl-lost' },
  ]);
  const has = (id: string) => errors.some((e) => e.startsWith(`${id}:`));
  assert.ok(has('loc-bad'));
  assert.ok(has('loc-stray'));
  assert.ok(has('chr-routine'));
  assert.ok(has('chr-gm'));
  assert.ok(has('chr-nowhere'));
  assert.ok(has('chr-grounded'));
  assert.ok(has('chr-fish'));
  assert.ok(has('evt-colorless')); // a token's colors must be written, [] if colorless
  assert.ok(has('spl-lost'));
});

const vessel: RawEntity = {
  id: 'itm-v',
  kind: 'item',
  name: '그릇',
  status: 'canon',
  sim: { cost: '{1}', at: 'loc-a', effects: [{ type: 'charge_life' }, { type: 'landfall_set_life' }] },
};

test('an item is tamed with mana where it stands; it holds its owner\'s life and gives it back on landfall', async () => {
  const world = fixture([vessel]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  assert.match((await act(state, world, { type: 'claim', item: 'itm-v' })).error!, /마나가 모자라다/);
  await act(state, world, { type: 'bond' });
  p.life = 28;
  await act(state, world, { type: 'claim', item: 'itm-v' });
  assert.equal(state.actors[PLAYER_ID].claimed, Math.floor(state.minutes / 1440)); // an artifact entered under their control today
  assert.deepEqual(state.items?.['itm-v'], { name: '그릇', owner: PLAYER_ID, counters: 28 });
  assert.match((await act(state, world, { type: 'claim', item: 'itm-v' })).error!, /이미 그릇을 길들였다/);
  // Worn down, then a new land the next day: life becomes what the vessel holds.
  await act(state, world, { type: 'wait', hours: 24 });
  p.life = 8;
  await act(state, world, { type: 'move', to: 'loc-c' });
  await act(state, world, { type: 'bond' });
  assert.equal(p.life, 28);
  assert.equal(p.lifeGained, 1);
  assert.ok(texts(state).some((t) => t.includes('그릇으로 생명')));
  // Never lowered: above what it holds, the vessel leaves it be.
  await act(state, world, { type: 'wait', hours: 24 });
  p.life = 35;
  await act(state, world, { type: 'move', to: 'loc-b' });
  await act(state, world, { type: 'bond' });
  assert.equal(p.life, 35);
});

test('an NPC tames an item by a claim block, and lets go of it when they die', async () => {
  const world = fixture([vessel, npc('chr-x', { ...npcSim('loc-a', 'claim'), mana: { W: 1 } }), npc('chr-y', { ...npcSim('loc-a', 'claim'), mana: { W: 1 } })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  await advance(state, world, 2);
  const owner = state.items?.['itm-v']?.owner;
  assert.ok(owner === 'chr-x' || owner === 'chr-y');
  const other = owner === 'chr-x' ? 'chr-y' : 'chr-x';
  assert.equal(state.actors[other].task?.kind, 'leisure'); // already someone's
  die(state, state.actors[owner!], state.minutes, '시험');
  assert.equal(state.items?.['itm-v']?.owner, undefined);
  await advance(state, world, 2);
  assert.equal(state.items?.['itm-v']?.owner, other);
});

const refuge: RawEntity = {
  id: 'loc-refuge',
  kind: 'location',
  name: '피난처',
  status: 'canon',
  map: { in: 'loc-c', terrain: 'settlement', color: ['B', 'R'], tiles: 1 },
  sim: { enters_tapped: true, on_bond: [{ type: 'gain_life', amount: 1 }] },
};

test('a refuge: enters tapped (no mana the day it is bonded), gives life on bonding, and its mana is either color', async () => {
  const world = fixture([refuge]);
  const state = character(world, 'loc-refuge');
  const p = state.actors[PLAYER_ID];
  await act(state, world, { type: 'bond' });
  assert.equal(p.life, 21);
  assert.equal(p.lifeGained, 0);
  assert.deepEqual(manaCapacity(state, world, p, state.minutes), {});
  await act(state, world, { type: 'wait', hours: 24 });
  assert.deepEqual(manaAvailable(state, world, p, state.minutes), { 'B/R': 1 });
  const cost = (text: string) => parseManaCost(text)!;
  assert.deepEqual(planPayment({ 'B/R': 1 }, cost('{R}')), { 'B/R': 1 });
  assert.deepEqual(planPayment({ 'B/R': 1, R: 1 }, cost('{B}{R}')), { R: 1, 'B/R': 1 });
  assert.equal(planPayment({ 'B/R': 1 }, cost('{B}{R}')), null);
  assert.deepEqual(planPayment({ 'B/R': 1, G: 1 }, cost('{1}')), { G: 1 }); // two-color mana kept for last
});

const mesa: RawEntity = {
  id: 'loc-mesa',
  kind: 'location',
  name: '메사',
  status: 'canon',
  map: { x: 12, y: 12, terrain: 'rocky' },
  sim: { nonbasic: true, no_mana: true, fetch: { types: ['mountain', 'plains'], life: 1 } },
};

test('a fetch land gives no mana; given up with 1 life, it bonds a mountain or plains from afar as a second landfall', async () => {
  const world = fixture([mesa]);
  const state = character(world, 'loc-mesa');
  const p = state.actors[PLAYER_ID];
  await act(state, world, { type: 'bond' });
  assert.deepEqual(manaCapacity(state, world, p, state.minutes), {});
  // loc-a is grassland (plains), loc-c rocky (mountain); loc-b is a forest, and the mesa itself is no mountain.
  assert.deepEqual(fetchTargets(state, world, p, 'loc-mesa').map((r) => r.id), ['loc-a', 'loc-c']);
  assert.match((await act(state, world, { type: 'fetch', from: 'loc-mesa', to: 'loc-b' })).error!, /평원/);
  // No one pays the last of their life.
  p.life = 1;
  assert.match((await act(state, world, { type: 'fetch', from: 'loc-mesa', to: 'loc-c' })).error!, /생명이 모자라다/);
  p.life = 20;
  await act(state, world, { type: 'fetch', from: 'loc-mesa', to: 'loc-c' });
  assert.equal(p.region, 'loc-mesa'); // never went there
  assert.deepEqual(p.bonds, ['loc-c']);
  assert.deepEqual(p.landfalls?.regions, ['loc-mesa', 'loc-c']); // the day's second landfall
  assert.deepEqual(p.fetched, ['loc-c']);
  assert.equal(p.searched, 0); // searched their library today (Archive Trap)
  assert.equal(p.life, 19);
  assert.deepEqual(manaCapacity(state, world, p, state.minutes), { R: 1 });
  assert.match((await act(state, world, { type: 'fetch', from: 'loc-mesa', to: 'loc-a' })).error!, /유대를 맺고 있어야/);
});

test('a landfall trap answers a land bonded from afar', async () => {
  const world = fixture([mesa, { ...trap, sim: { ...(trap.sim as object), region: 'loc-c' } }]);
  const state = character(world, 'loc-mesa');
  await act(state, world, { type: 'bond' });
  await act(state, world, { type: 'fetch', from: 'loc-mesa', to: 'loc-c' });
  await act(state, world, { type: 'wait', hours: 2 });
  assert.ok(texts(state).includes('땅이 울린다.')); // the second landfall of the day, on loc-c
});

test('bonding with a land after seeking one out: the land sought is not the day\'s one land', async () => {
  const world = fixture([mesa]);
  const state = character(world, 'loc-mesa');
  const p = state.actors[PLAYER_ID];
  p.bonds = ['loc-mesa'];
  await act(state, world, { type: 'fetch', from: 'loc-mesa', to: 'loc-c' });
  assert.equal(bondBlocked(state, world, p, state.minutes), null);
  await act(state, world, { type: 'bond' });
  assert.deepEqual(p.bonds, ['loc-c', 'loc-mesa']);
  assert.match(bondBlocked(state, world, { ...p, region: 'loc-a' }, state.minutes)!, /하루에 하나/);
});

test('an NPC seeks out the land its plan names with a fetch land it holds, and may still bond that day', async () => {
  const plan = [
    ['00:00', '07:00', 'loc-a', 'sleep', '잠', '😴'],
    ['07:00', '08:00', 'loc-a', 'fetch', '길 찾기', '🧭', 'loc-c'],
    ['08:00', '12:00', 'loc-a', 'bond', '유대', '🌿'],
    ['12:00', '24:00', 'loc-a', 'leisure', '쉼', '🙂'],
  ];
  const world = fixture([mesa, npc('npc-f', { ...npcSim('loc-a'), plan })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const f = state.actors['npc-f'];
  f.bonds = ['loc-mesa'];
  let offered: unknown;
  const llm: Llm = { planDay: async (input) => ((offered = input.fetch), planDay!(input)) };
  await advance(state, world, 7, llm);
  // Plains and mountains they don't hold yet, each once.
  assert.deepEqual((offered as { id: string }[]).map((x) => x.id), ['loc-a', 'loc-c']);
  assert.equal(f.region, 'loc-a'); // never went there
  assert.deepEqual(f.bonds, ['loc-c', 'loc-a']);
  assert.deepEqual(f.fetched, ['loc-c']);
  assert.ok(texts(state).some((x) => x.includes('메사를 내어 주고')));
});

const crypt: RawEntity = {
  id: 'loc-crypt',
  kind: 'location',
  name: '묘실',
  status: 'canon',
  map: { in: 'loc-c', terrain: 'ruins', color: 'B', tiles: 1 },
  sim: { nonbasic: true, fallen_mana: { color: 'B', cost: 2 } },
};

test('a crypt gives one black mana, and more for each black retainer who died serving its holder, less its cost', async () => {
  const world = fixture([crypt, ...[1, 2, 3, 4].map((i) => npc(`chr-v${i}`, { ...npcSim('loc-crypt'), mana: { B: 1 } })), npc('chr-g', { ...npcSim('loc-crypt'), mana: { G: 1 } })]);
  const state = character(world, 'loc-crypt');
  const p = state.actors[PLAYER_ID];
  p.bonds = ['loc-crypt'];
  assert.deepEqual(manaCapacity(state, world, p), { B: 1 });
  for (const id of ['chr-v1', 'chr-v2', 'chr-v3', 'chr-v4', 'chr-g']) {
    state.actors[id].master = PLAYER_ID;
    die(state, state.actors[id], state.minutes, '시험');
  }
  assert.deepEqual(p.fallen, ['chr-v1', 'chr-v2', 'chr-v3', 'chr-v4', 'chr-g']);
  assert.deepEqual(manaCapacity(state, world, p), { B: 2 }); // four black fallen, less {2}; the green one doesn't count
});

test('a save whose map changed: characters gone from the world leave it, and those on a vanished land go home', () => {
  const before = fixture([npc('chr-x', npcSim('loc-b')), npc('chr-y', npcSim('loc-a'))]);
  const state = character(before, 'loc-c');
  state.actors['chr-x'].region = 'loc-gone';
  state.actors[PLAYER_ID].region = 'loc-gone';
  const after = fixture([npc('chr-x', npcSim('loc-b'))]);
  syncWorld(state, after);
  assert.equal(state.actors['chr-y'], undefined);
  assert.equal(state.actors['chr-x'].region, 'loc-b');
  assert.equal(state.actors[PLAYER_ID].region, 'loc-a');
});

const skyRuin: RawEntity = {
  id: 'loc-ruin',
  kind: 'location',
  name: '하늘 폐허',
  status: 'canon',
  map: { in: 'loc-a', terrain: 'sky', tiles: 1 },
  sim: { nonbasic: true, climb_hours: 6, upkeep_revive: { plains: 2 } },
};

test('a sky ruin that can be climbed: those who cannot fly get there by rope, six hours more', async () => {
  const world = fixture([skyRuin]);
  const state = character(world, 'loc-a');
  const [a, ruin] = [region(world, 'loc-a'), region(world, 'loc-ruin')];
  assert.equal(travelHours(a, ruin, []), 7);
  assert.equal(travelHours(a, ruin, ['fly']), 1);
  assert.equal(travelBlocked(state, world, state.actors[PLAYER_ID], 'loc-ruin'), null);
  assert.match(travelBlocked(state, world, state.actors[PLAYER_ID], 'loc-sky')!, /비행/); // a sky island with no ropes
  await act(state, world, { type: 'move', to: 'loc-ruin' });
  assert.equal(state.actors[PLAYER_ID].region, 'loc-ruin');
  assert.equal(formatClock(state.minutes), '1일차 13:00'); // a tile on foot, and six hours of rope
});

test('at dawn, one holding the ruin and enough plains gets back the last retainer who died serving them', async () => {
  const world = fixture([skyRuin, loc('loc-p', 20, 20, 'grassland'), npc('chr-x', npcSim('loc-a')), npc('chr-y', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.bonds = ['loc-ruin', 'loc-a'];
  for (const id of ['chr-x', 'chr-y']) {
    state.actors[id].master = PLAYER_ID;
    die(state, state.actors[id], state.minutes, '시험');
  }
  await act(state, world, { type: 'wait', hours: 20 }); // past midnight: one plains only
  assert.ok(state.actors['chr-y'].dead);
  p.bonds.push('loc-p');
  await act(state, world, { type: 'wait', hours: 24 });
  const y = state.actors['chr-y'];
  assert.equal(y.dead, undefined);
  assert.equal(y.master, PLAYER_ID);
  assert.ok(state.actors['chr-x'].dead); // one a day
  assert.deepEqual(p.fallen, ['chr-x']);
});

const magosi: RawEntity = {
  id: 'loc-magosi',
  kind: 'location',
  name: '마고시',
  status: 'canon',
  map: { in: 'loc-a', terrain: 'river', tiles: 1 },
  sim: { nonbasic: true, enters_tapped: true, eon: { cost: '{U}' } },
};
const blue = loc('loc-u', 20, 20, 'beach');

test('a day left in Magosi (its tap and {U}): the next day is lost, out of time and unchanged', async () => {
  const world = fixture([magosi, blue]);
  const state = character(world, 'loc-magosi');
  const p = state.actors[PLAYER_ID];
  p.bonds = ['loc-magosi'];
  // Magosi's own mana can't pay: tapping it is the cost.
  assert.match(storeBlocked(state, world, p, 'loc-magosi', state.minutes)!, /마나가 모자라다/);
  p.bonds.push('loc-u');
  await act(state, world, { type: 'store_day', land: 'loc-magosi' });
  assert.deepEqual(p.eons, { 'loc-magosi': 1 });
  assert.equal(p.skipDay, 1);
  assert.equal(formatMana(manaAvailable(state, world, p, state.minutes)), '없음'); // Magosi tapped, {U} paid
  assert.match(storeBlocked(state, world, p, 'loc-magosi', state.minutes)!, /오늘 이미 마고시를 썼다/);
  await advance(state, world, 17); // to 2일차 00:00
  assert.ok(outOfTime(state, p));
  assert.ok(!present(state, 'loc-magosi', null).includes(p));
  const energy = p.stats.energy;
  await advance(state, world, 24);
  assert.equal(formatClock(state.minutes), '3일차 00:00');
  assert.equal(p.stats.energy, energy); // time didn't touch them
  assert.ok(!outOfTime(state, p));
  assert.ok(texts(state).some((x) => x.includes('시간 밖에 있다')));
});

test('a day taken back from Magosi: the land leaves, and the next day the world stands still for them alone', async () => {
  const world = fixture([magosi, npc('chr-x', { ...npcSim('loc-a'), plan: allDay('loc-b', 'work') }), npc('chr-y', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.bonds = ['loc-magosi'];
  assert.match(spendBlocked(state, world, p, 'loc-magosi', state.minutes)!, /맡겨 둔 하루가 없다/);
  p.eons = { 'loc-magosi': 2 };
  const y = state.actors['chr-y'];
  y.skipDay = 1; // meant to lose tomorrow: now the day after, as tomorrow is no one's turn but the player's
  await act(state, world, { type: 'spend_day', land: 'loc-magosi' });
  assert.deepEqual(p.bonds, []);
  assert.deepEqual(p.eons, {}); // gone with the land
  assert.deepEqual(state.extraDays, [{ actor: PLAYER_ID, day: 1 }]);
  assert.equal(y.skipDay, 2);
  await advance(state, world, 17); // 2일차 00:00: the extra day
  const x = state.actors['chr-x'];
  const [where, energy] = [x.region, x.stats.energy];
  assert.ok(outOfTime(state, x));
  await act(state, world, { type: 'move', to: 'loc-c' });
  assert.equal(p.region, 'loc-c');
  await advance(state, world, 20);
  assert.equal(x.region, where);
  assert.equal(x.stats.energy, energy);
  assert.equal(x.schedule?.day, 0); // no day planned for them
  assert.ok(texts(state).some((t) => t.startsWith('세상이 멈췄다')));
  await advance(state, world, 4); // 3일차: everyone's turn again (but chr-y's, lost)
  assert.ok(!outOfTime(state, x));
  assert.ok(outOfTime(state, y));
});

test('an NPC leaves a day in Magosi by a store_day block, and loses the next day', async () => {
  const world = fixture([magosi, blue, npc('chr-m', { ...npcSim('loc-a'), plan: [['00:00', '24:00', 'loc-a', 'store_day', '폭포에 하루 맡기기', '⏳']] })]);
  const state = character(world, 'loc-a');
  const m = state.actors['chr-m'];
  m.bonds = ['loc-magosi', 'loc-u'];
  await advance(state, world, 2);
  assert.deepEqual(m.eons, { 'loc-magosi': 1 });
  assert.equal(m.skipDay, 1);
  await advance(state, world, 20); // into 2일차
  assert.ok(outOfTime(state, m));
  assert.equal(m.schedule?.day, 0); // not planned: the day isn't theirs
});

const oranRief: RawEntity = {
  id: 'loc-rief',
  kind: 'location',
  name: '오란리프',
  status: 'canon',
  map: { in: 'loc-b', terrain: 'forest', color: 'G', tiles: 1 },
  sim: { nonbasic: true, enters_tapped: true, grow_entered: { color: 'G' } },
};

test('Oran-Rief: tapped, each green creature that came into play today gets a +1/+1 counter, whoever it serves', async () => {
  const world = fixture([oranRief, npc('chr-g', { ...npcSim('loc-b'), mana: { G: 1 } })]);
  const state = character(world, 'loc-rief');
  const p = state.actors[PLAYER_ID];
  p.bonds = ['loc-rief'];
  assert.match(growBlocked(state, world, p, 'loc-rief', state.minutes)!, /새로 나온 녹색 생물이 없다/);
  const [snake] = spawnWild(state, world, 'cre-snake', [1, 1], 1, 'loc-b', ['G']);
  const [bat] = spawnWild(state, world, 'cre-bat', [1, 1], 1, 'loc-b', ['B']);
  await act(state, world, { type: 'grow', land: 'loc-rief' });
  assert.deepEqual(ptOf(snake), [2, 2]);
  assert.deepEqual(ptOf(bat), [1, 1]); // not green
  assert.deepEqual(ptOf(state.actors['chr-g']), [1, 1]); // green, but here since the start
  assert.equal(formatMana(manaAvailable(state, world, p, state.minutes)), '없음'); // tapped for it, no {G} today
  assert.match(growBlocked(state, world, p, 'loc-rief', state.minutes)!, /오늘 이미/);
  await act(state, world, { type: 'wait', hours: 20 }); // the next day: the snake is no longer new
  assert.match(growBlocked(state, world, p, 'loc-rief', state.minutes)!, /없다/);
  assert.deepEqual(ptOf(snake), [2, 2]); // the counter stays
});

const piranhas: RawEntity = {
  id: 'loc-piranha',
  kind: 'location',
  name: '피라냐 습지',
  status: 'canon',
  map: { in: 'loc-b', terrain: 'swamp', color: 'B', tiles: 1 },
  sim: { nonbasic: true, enters_tapped: true, on_bond: [{ type: 'lose_life', amount: 1 }] },
};

test('a land that takes a life: the player picks someone there as they bond, and they lose 1 life', async () => {
  const world = fixture([piranhas, npc('chr-x', npcSim('loc-piranha', 'leisure'))]);
  const state = character(world, 'loc-piranha');
  const x = state.actors['chr-x'];
  assert.match((await act(state, world, { type: 'bond' })).error!, /골라야 한다/);
  const [snake] = spawnWild(state, world, 'cre-snake', [1, 1], 1, 'loc-piranha', ['G']);
  assert.ok(bondTargets(state, world, state.actors[PLAYER_ID], 'loc-piranha', { type: 'lose_life', amount: 1 }).includes(snake)); // a beast may be picked too
  await act(state, world, { type: 'bond', target: 'chr-x' });
  assert.deepEqual(state.actors[PLAYER_ID].bonds, ['loc-piranha']);
  assert.equal(x.life, 19);
});

test('an NPC bonding with it picks by the LLM whom it falls on; alone, it falls on no one', async () => {
  const world = fixture([piranhas, npc('chr-x', { ...npcSim('loc-piranha'), plan: [['00:00', '24:00', 'loc-piranha', 'bond', '늪과 유대', '🌱']] })]);
  const state = character(world, 'loc-piranha');
  const p = state.actors[PLAYER_ID];
  const asked: string[][] = [];
  const choose: Llm['choose'] = async ({ candidates }) => (asked.push(candidates.map((a) => a.id)), PLAYER_ID);
  await act(state, world, { type: 'wait', hours: 4 }, { choose });
  assert.deepEqual(asked, [[PLAYER_ID]]);
  assert.equal(p.life, 19);
  assert.ok(texts(state).some((t) => t.includes('피라냐 습지에 내주었다')));

  const alone = character(fixture([piranhas, npc('chr-x', { ...npcSim('loc-piranha'), plan: [['00:00', '24:00', 'loc-piranha', 'bond', '늪과 유대', '🌱']] })]), 'loc-a');
  await advance(alone, world, 4, { choose });
  assert.deepEqual(alone.actors['chr-x'].bonds, ['loc-piranha']);
  assert.equal(asked.length, 1); // no one to pick
});

const seacliff: RawEntity = {
  id: 'loc-cliff',
  kind: 'location',
  name: '바다절벽',
  status: 'canon',
  map: { in: 'loc-a', terrain: 'beach', color: 'U', tiles: 1 },
  sim: { nonbasic: true, enters_tapped: true, on_bond: [{ type: 'grant', ability: 'fly' }] },
};

test('a seacliff: the one bonding picks someone there (themselves too) to fly until midnight', async () => {
  const world = fixture([seacliff]);
  const state = character(world, 'loc-cliff');
  const p = state.actors[PLAYER_ID];
  assert.match((await act(state, world, { type: 'bond' })).error!, /골라야 한다/);
  await act(state, world, { type: 'bond', target: PLAYER_ID });
  assert.ok(p.abilities.includes('fly'));
  assert.equal(travelBlocked(state, world, p, 'loc-sky'), null);
  await act(state, world, { type: 'move', to: 'loc-sky' });
  assert.equal(p.region, 'loc-sky');
  await act(state, world, { type: 'wait', hours: 14 }); // past midnight
  assert.ok(!p.abilities.includes('fly'));
  assert.match(travelBlocked(state, world, p, 'loc-a')!, /비행/); // stranded on a sky island with no ropes
  assert.ok(texts(state).some((t) => t.includes('비행이(가) 사라졌다')));
});

test('an NPC bonding with the seacliff may pick itself for the wings', async () => {
  const world = fixture([seacliff, npc('chr-x', { ...npcSim('loc-cliff'), plan: [['00:00', '24:00', 'loc-cliff', 'bond', '절벽과 유대', '🌱']] })]);
  const state = character(world, 'loc-a');
  const asked: string[][] = [];
  await advance(state, world, 4, { choose: async ({ candidates, npc }) => (asked.push(candidates.map((a) => a.id)), npc.id) });
  assert.deepEqual(asked, [['chr-x']]);
  assert.ok(state.actors['chr-x'].abilities.includes('fly'));
});

test('teetering peaks: the one bonding picks someone there (themselves too) to hit harder until midnight', async () => {
  const peaks: RawEntity = {
    id: 'loc-peaks',
    kind: 'location',
    name: '봉우리',
    status: 'canon',
    map: { in: 'loc-c', terrain: 'rocky', color: 'R', tiles: 1 },
    sim: { nonbasic: true, enters_tapped: true, on_bond: [{ type: 'pump', pt: [2, 0] }] },
  };
  const world = fixture([peaks]);
  const state = character(world, 'loc-peaks');
  const p = state.actors[PLAYER_ID];
  await act(state, world, { type: 'bond', target: PLAYER_ID });
  assert.deepEqual(ptOf(p), [3, 1]);
  await act(state, world, { type: 'wait', hours: 16 }); // past midnight
  assert.deepEqual(ptOf(p), [1, 1]);
});

const valakut: RawEntity = {
  id: 'loc-valakut',
  kind: 'location',
  name: '발라쿠트',
  status: 'canon',
  map: { in: 'loc-c', terrain: 'volcanic', color: 'R', tiles: 1 },
  sim: { nonbasic: true, enters_tapped: true, mountain_fire: { others: 5, damage: 3 } },
};
const peaks = [1, 2, 3, 4, 5, 6].map((i) => loc(`loc-m${i}`, 60 + i * 2, 60, 'rocky'));

test('Valakut: bonding with a sixth mountain, its holder may burn someone in its land for 3', async () => {
  const world = fixture([valakut, ...peaks, npc('chr-x', { ...npcSim('loc-c', 'leisure'), pt: [1, 4] })]);
  const state = character(world, 'loc-m6');
  const p = state.actors[PLAYER_ID];
  p.bonds = ['loc-valakut', 'loc-m1', 'loc-m2', 'loc-m3', 'loc-m4'];
  assert.deepEqual(firesOnBond(state, world, { ...p, bonds: [...p.bonds, 'loc-m6'] }, 'loc-m6'), []); // four others: asleep
  p.bonds.push('loc-m5');
  assert.deepEqual(fireTargets(state, world, p, region(world, 'loc-valakut')).map((x) => x.id), ['chr-x']);
  await act(state, world, { type: 'bond', target: 'chr-x' });
  assert.equal(woundsOf(state.actors['chr-x'], state.minutes), 3);
});

test('Valakut: an NPC waking it may send the fire at no one', async () => {
  const world = fixture([valakut, ...peaks, npc('chr-v', { ...npcSim('loc-m6'), plan: [['00:00', '24:00', 'loc-m6', 'bond', '산과 유대', '🌋']] })]);
  const state = character(world, 'loc-c');
  state.actors['chr-v'].bonds = ['loc-valakut', 'loc-m1', 'loc-m2', 'loc-m3', 'loc-m4', 'loc-m5'];
  let asked = 0;
  await advance(state, world, 5, { choose: async ({ optional }) => (asked++, assert.ok(optional), null) });
  assert.equal(asked, 1);
  assert.equal(woundsOf(state.actors[PLAYER_ID], state.minutes), 0);
});

test('Iona: entering a fight she names a color, and those she fights cannot cast it until midnight', async () => {
  const world = fixture([mantle, tribute('loc-a'), lore('cre-v', 'creature'), npc('chr-iona', { ...npcSim('loc-a', 'leisure', [0, 7]), seal: true }), npc('chr-y', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  const iona = state.actors['chr-iona'];
  p.spells = ['spl-m', 'spl-t'];
  p.bonds = ['loc-a'];
  const asked: string[][] = [];
  const llm: Llm = { chooseColor: async ({ opponents }) => (asked.push(opponents.map((x) => x.id)), 'W') };
  await act(state, world, { type: 'wait', hours: 1 }, llm);
  assert.equal(iona.seal, undefined); // no fight, no color
  addFoe(iona, PLAYER_ID, state.minutes); // she turns on the player
  await act(state, world, { type: 'wait', hours: 1 }, llm);
  assert.deepEqual(asked, [[PLAYER_ID]]);
  assert.equal(sealToday(iona, state.minutes), 'W');
  assert.match(castBlocked(state, world, p, 'spl-m', PLAYER_ID, false, state.minutes)!, /백색을 봉인/);
  // Another color, or someone not in the fight, is free to cast.
  assert.doesNotMatch(castBlocked(state, world, p, 'spl-t', 'chr-y', false, state.minutes) ?? '', /봉인/);
  const y = state.actors['chr-y'];
  y.spells = ['spl-m'];
  assert.equal(sealedBy(state, y, world.spells.find((s) => s.id === 'spl-m')!, state.minutes), undefined);
  // Cast for free (a power), it is still stopped.
  castSpell(state, world, p, 'spl-m', PLAYER_ID, false, state.minutes, true);
  assert.equal(p.auras, undefined);
  // At midnight the fight and the seal are over.
  const day = Math.floor(state.minutes / 1440);
  while (Math.floor(state.minutes / 1440) === day) await act(state, world, { type: 'wait', hours: 1 }, llm);
  assert.equal(castBlocked(state, world, p, 'spl-m', PLAYER_ID, false, state.minutes), null);
});

test('Iona with no answer from the LLM still names a color', async () => {
  const world = fixture([npc('chr-iona', { ...npcSim('loc-a', 'leisure', [0, 7]), seal: true })]);
  const state = character(world, 'loc-a');
  addFoe(state.actors['chr-iona'], PLAYER_ID, state.minutes);
  await act(state, world, { type: 'wait', hours: 1 });
  assert.ok(COLORS.includes(sealToday(state.actors['chr-iona'], state.minutes)!));
});

test('the real Valakut: seeking out a land with a fetch land, then bonding Valakut the same day, wakes the lavaball trap', async () => {
  const world = loadWorld();
  const state = newState(world, { seed: 3, mode: 'character', player: { name: '나', background: '떠돌이', region: 'loc-valakut' } });
  const p = state.actors[PLAYER_ID];
  p.bonds = ['loc-arid-mesa'];
  await act(state, world, { type: 'fetch', from: 'loc-arid-mesa', to: 'loc-akoum' });
  await act(state, world, { type: 'bond' });
  assert.deepEqual(p.landfalls?.regions, ['loc-akoum', 'loc-valakut']);
  // The land answers as the next hour begins, with an omen; an hour later, the fire.
  await act(state, world, { type: 'wait', hours: 1 });
  assert.ok(texts(state).some((x) => x.includes('발라쿠트의 땅이 울리고')));
  await act(state, world, { type: 'wait', hours: 1 });
  // The intruder's two lands of the day are gone, and the fire hit everyone at Valakut.
  assert.ok(state.regions['loc-valakut']?.destroyed);
  assert.ok(state.regions['loc-akoum']?.destroyed);
  assert.ok(p.dead);
});

test('the real Sunder Bay offing: Lorthos\'s tides reach Murasa and its areas, not Tazeem nor Ondu', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-lorthos-emerges')!;
  const coast = affectedRegions(world, ev).map((r) => r.id);
  for (const id of ['loc-murasa', 'loc-misty-rainforest', 'loc-kazandu-refuge', 'loc-kazuul-cliffs']) assert.ok(coast.includes(id), id);
  assert.ok(!coast.includes('loc-tazeem'));
  assert.ok(!coast.includes('loc-ondu'));
  assert.equal(world.npcs.find((n) => n.id === 'chr-lorthos')?.home, 'loc-sunder-offing');
  assert.equal(region(world, 'loc-sunder-offing').oneLandWith, 'loc-thunder-bay');
  assert.equal(region(world, 'loc-thunder-bay').parent, 'loc-murasa');
});

test('the real Malakir: one who gained life today walks in and the needlebite trap bites; one who did not walks in freely', async () => {
  const world = loadWorld();
  const state = newState(world, { seed: 5, mode: 'character', player: { name: '나', background: '떠돌이', region: 'loc-guul-draz' } });
  const p = state.actors[PLAYER_ID];
  await act(state, world, { type: 'move', to: 'loc-malakir' });
  assert.equal(p.region, 'loc-malakir');
  assert.ok(!texts(state).some((x) => x.includes('가시가 튀어나와')));
  await act(state, world, { type: 'move', to: 'loc-guul-draz' });
  gainLife(state, p, 1, state.minutes, '피난처');
  // The trap lies on one tile of Malakir: they step onto it.
  await act(state, world, { type: 'move', to: 'loc-malakir', tile: fixedTile(world, 'loc-malakir', 'evt-needlebite-trap')! });
  assert.ok(texts(state).some((x) => x.includes('가시가 튀어나와')));
  assert.equal(p.life, 16); // 20 + 1 - 5
});

test('the real baloth starts out in the jungle of Murasa', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['cre-baloth']?.region, 'loc-murasa');
});

test('an NPC learns a spell by a learn block where it is taught, then casts it by a cast block on the one the LLM picks', async () => {
  const plan = [
    ['00:00', '06:00', 'loc-a', 'sleep', '잠', '😴'],
    ['06:00', '10:00', 'loc-a', 'learn', '주문 익히기', '📖', undefined, 'spl-t'],
    ['10:00', '11:00', 'loc-a', 'cast', '주문', '🩸', undefined, 'spl-t'],
    ['11:00', '24:00', 'loc-a', 'leisure', '쉼', '🙂'],
  ];
  const world = fixture([tribute('loc-a'), lore('cre-v', 'creature'), npc('chr-v', { ...npcSim('loc-a'), mana: { B: 2 }, plan }), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const v = state.actors['chr-v'];
  const x = state.actors['chr-x'];
  let offered: PlanDayInput | undefined;
  const asked: string[][] = [];
  const llm: Llm = {
    planDay: async (input) => (input.id === 'chr-v' && (offered = input), planDay!(input)),
    choose: async ({ candidates }) => (asked.push(candidates.map((c) => c.id)), 'chr-x'),
  };
  await advance(state, world, 4, llm); // 06:00 → 10:00
  assert.deepEqual(offered?.learn?.map((s) => [s.id, s.at]), [['spl-t', 'loc-a']]);
  assert.deepEqual(v.spells, ['spl-t']);
  await advance(state, world, 1, llm); // the cast
  assert.deepEqual(asked, [['chr-x']]); // not themselves: "target opponent"
  assert.ok(texts(state).some((t) => t.includes('공물을 걸었다')));
  assert.equal(x.life, 10); // half of 20
  assert.deepEqual(x.foes?.ids, ['chr-v']);
  assert.equal(formatMana(manaAvailable(state, world, v, state.minutes)), '없음'); // paid
});

test('an NPC who readies a spell may hold it back, keeping its mana', async () => {
  const plan = [['00:00', '24:00', 'loc-a', 'cast', '주문', '🩸', undefined, 'spl-t']];
  const world = fixture([tribute('loc-a'), lore('cre-v', 'creature'), npc('chr-v', { ...npcSim('loc-a'), mana: { B: 2 }, plan }), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  state.actors['chr-v'].spells = ['spl-t'];
  await advance(state, world, 1, { choose: async () => null });
  assert.equal(state.actors['chr-x'].foes, undefined);
  assert.deepEqual(manaAvailable(state, world, state.actors['chr-v'], state.minutes), { B: 2 });
});

test('the real Emeria teaches the celestial mantle, and Iona, who lives there, is offered it in her plan', async () => {
  const world = loadWorld();
  assert.equal(world.spells.find((s) => s.id === 'spl-celestial-mantle')?.learnAt, 'loc-emeria');
  const state = newState(world, { seed: 1, mode: 'observer' });
  let offered: PlanDayInput['learn'];
  await advance(state, world, 1, { planDay: async (input) => (input.id === 'chr-iona' && (offered = input.learn), planDay!(input)) });
  assert.ok(offered?.some((s) => s.id === 'spl-celestial-mantle' && s.at === 'loc-emeria'));
});

test('the real Chandra wanders Akoum', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['chr-chandra']?.region, 'loc-akoum');
  assert.equal(state.actors['chr-chandra']?.loyalty, 5);
});

test('the real cobra trap lies in the Turntimber Grove (the serpentine forest): laid waste, it looses four snakes on the one who did it', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-cobra-trap')!;
  assert.equal(ev.region, 'loc-turntimber-grove');
  assert.equal(ev.trigger, 'destroyed');
});

test('the real eternity vessel stands on Ondu', () => {
  const world = loadWorld();
  assert.equal(world.items.find((x) => x.id === 'itm-eternity-vessel')?.at, 'loc-ondu');
});

const felidar = (plan?: unknown[][]): RawEntity => planned({
  id: 'cre-f',
  kind: 'creature',
  name: '펠리다르',
  status: 'canon',
  sim: {
    name: '펠리다르 군주',
    pt: [4, 6],
    role: 'r',
    home: 'loc-a',
    persona: 'p',
    goal: 'g',
    needs: ['energy'],
    beast: true,
    tamable: true,
    abilities: ['vigilance', 'lifelink'],
    wins_at_life: 40,
    ...(plan ? { plan } : {}),
  },
});

test('lifelink: the damage a lifelinked one deals gains its controller that much life', async () => {
  const world = fixture([felidar(), npc('chr-y', npcSim('loc-a', 'social', [1, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const f = state.actors['cre-f'];
  assert.equal(f.name, '펠리다르 군주');
  addFoe(f, 'chr-y', state.minutes);
  await advance(state, world, 1);
  assert.ok(texts(state).some((t) => t.includes('생명연결') && t.includes('생명 4을 얻었다')));
  assert.equal(f.lifeGained, 0); // day 1
  assert.equal(f.life, 24);
});

test('a beast that may follow answers the player in deeds, and may follow them; with it, 40 life at midnight wins', async () => {
  const world = fixture([felidar()]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  let beast: boolean | undefined;
  await act(state, world, { type: 'talk', to: 'cre-f', say: '함께 가자' }, { reply: async (x) => ((beast = x.beast), { say: '펠리다르 군주가 고개를 숙인다.', attack: false, follow: true }) });
  assert.equal(beast, true);
  assert.ok(texts(state).includes('펠리다르 군주가 고개를 숙인다.'));
  assert.equal(state.actors['cre-f'].master, PLAYER_ID);
  // Full energy is not life: short of 40, no win.
  p.stats.energy = 100;
  p.life = 39;
  upkeepWins(state, world, state.minutes);
  assert.equal(state.winners?.length ?? 0, 0);
  p.life = 40;
  upkeepWins(state, world, state.minutes);
  upkeepWins(state, world, state.minutes);
  assert.deepEqual(state.winners?.map((w) => [w.id, w.by]), [[PLAYER_ID, '펠리다르 군주']]);
  assert.ok(state.log.some((e) => e.scope === 'world' && e.text.includes('세계의 승자')));
});

test('an NPC courts the beast by a court block; the beast (the LLM) follows them, and with 40 life at midnight they win', async () => {
  const plan = [
    ['00:00', '06:00', 'loc-a', 'sleep', '잠', '😴'],
    ['06:00', '08:00', 'loc-a', 'court', '펠리다르 곁에 머묾', '🐾', undefined, undefined, 'cre-f'],
    ['08:00', '24:00', 'loc-a', 'sleep', '잠', '😴'],
  ];
  const world = fixture([felidar(), npc('chr-m', { ...npcSim('loc-a'), needs: ['energy'], plan })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const f = state.actors['cre-f'];
  let offered: PlanDayInput | undefined;
  const asked: [string, string[]][] = [];
  const llm: Llm = {
    planDay: async (input) => (input.id === 'chr-m' && (offered = input), planDay!(input)),
    choose: async ({ npc, candidates }) => (asked.push([npc.id, candidates.map((c) => c.id)]), candidates[0].id),
  };
  // Alone, the beast wins nothing.
  f.life = 40;
  upkeepWins(state, world, state.minutes);
  assert.equal(state.winners?.length ?? 0, 0);
  await advance(state, world, 2, llm); // 06:00 → 08:00
  assert.deepEqual(offered?.court?.map((x) => [x.id, x.at]), [['cre-f', 'loc-a']]);
  assert.deepEqual(asked, [['cre-f', ['chr-m']]]);
  assert.equal(f.master, 'chr-m');
  assert.ok(texts(state).some((t) => t.includes('권속이 되었다 (인정)')));
  // A beast that follows someone is no longer courted.
  assert.equal(swayBlocked(state, world, f)?.includes('이미'), true);
  state.actors['chr-m'].life = 40;
  await advance(state, world, 17, llm); // through the upkeep at 00:00 of day 2
  assert.deepEqual(state.winners?.map((w) => w.id), ['chr-m']);
});

test('a beast that follows no one may turn a suitor away', async () => {
  const plan = [['00:00', '24:00', 'loc-a', 'court', '곁에 머묾', '🐾', undefined, undefined, 'cre-f']];
  const world = fixture([felidar(), npc('chr-m', { ...npcSim('loc-a'), plan })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  await advance(state, world, 2, { choose: async () => null });
  assert.equal(state.actors['cre-f'].master, undefined);
  assert.ok(texts(state).some((t) => t.includes('곁을 내주지 않았다')));
});

test('the real Felidar Sovereign lives in Sejiri, with lifelink, and may follow someone', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const f = state.actors['cre-felidar'];
  assert.equal(f?.name, '펠리다르 군주');
  assert.equal(f.region, 'loc-sejiri');
  assert.ok(f.abilities.includes('lifelink'));
  assert.equal(swayBlocked(state, world, f), null);
});

test('life never comes back by itself; at 0 one dies, but an NPC who takes it from an NPC only knocks them out', async () => {
  const world = fixture([piranhas, npc('chr-x', npcSim('loc-piranha', 'leisure')), npc('chr-y', { ...npcSim('loc-piranha'), plan: [['00:00', '24:00', 'loc-piranha', 'bond', '늪과 유대', '🌱']] })]);
  const state = character(world, 'loc-piranha');
  const x = state.actors['chr-x'];
  // An NPC's land takes an NPC's last life: out cold, back with 1.
  x.life = 1;
  await advance(state, world, 4, { choose: async () => 'chr-x' });
  assert.equal(x.dead, undefined);
  assert.equal(x.life, 1);
  assert.ok(texts(state).some((t) => t.includes('쓰러져 기절했다')));
  // The player's doing: they die.
  const world2 = fixture([piranhas, npc('chr-x', npcSim('loc-piranha', 'leisure'))]);
  const other = character(world2, 'loc-piranha');
  // Sleep restores energy, not life.
  const p = other.actors[PLAYER_ID];
  p.life = 5;
  p.stats.energy = 20;
  await act(other, world2, { type: 'rest', hours: 8 });
  assert.equal(p.life, 5);
  assert.ok(p.stats.energy > 20);
  other.actors['chr-x'].life = 1;
  await act(other, world2, { type: 'bond', target: 'chr-x' });
  assert.ok(other.actors['chr-x'].dead);
});

const hellkite = (mana: object): RawEntity => planned({
  id: 'cre-h',
  kind: 'creature',
  name: '용',
  status: 'canon',
  sim: { pt: [5, 5], mana, role: 'r', home: 'loc-a', persona: 'p', goal: 'g', needs: ['energy'], beast: true, abilities: ['fly', 'haste'], extra_combat: { cost: '{5}{R}{R}' } },
});

test('haste halves the way, never under an hour', () => {
  const world = fixture([loc('loc-far', 10 + 3 * TRAVEL_UNITS_PER_HOUR, 10, 'grassland')]);
  const [a, b] = [region(world, 'loc-a'), region(world, 'loc-far')];
  assert.equal(travelHours(a, b), 3);
  assert.equal(travelHours(a, b, ['haste']), 2);
  assert.equal(travelHours(a, region(world, 'loc-b'), ['haste']), 1);
  assert.equal(travelHours(a, region(world, 'loc-sea'), ['haste']), Math.ceil(travelHours(a, region(world, 'loc-sea')) / 2));
});

test('a hellkite that strikes and can pay strikes once more that hour; without the mana, once', async () => {
  const world = fixture([hellkite({ R: 7 }), npc('chr-y', npcSim('loc-a', 'social', [0, 30]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const h = state.actors['cre-h'];
  const strikes = () => state.log.filter((e) => e.kind === 'combat' && e.text.includes('공격했다') && e.actors[0] === 'cre-h').length;
  addFoe(h, 'chr-y', state.minutes);
  await advance(state, world, 1);
  assert.equal(strikes(), 2);
  assert.ok(texts(state).some((t) => t.includes('한 번 더 싸운다')));
  assert.equal(woundsOf(state.actors['chr-y'], state.minutes - 60), 10);
  assert.equal(formatMana(manaAvailable(state, world, h, state.minutes)), '없음');
  await advance(state, world, 1);
  assert.equal(strikes(), 3);

  const poorWorld = fixture([hellkite({ R: 6 }), npc('chr-y', npcSim('loc-a', 'social', [0, 30]))]);
  const poor = newState(poorWorld, { seed: 1, mode: 'observer' });
  addFoe(poor.actors['cre-h'], 'chr-y', poor.minutes);
  await advance(poor, poorWorld, 1);
  assert.ok(!texts(poor).some((t) => t.includes('한 번 더 싸운다')));
});

test('the real Hellkite Charger flies over Akoum, with haste', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const h = state.actors['cre-hellkite'];
  assert.equal(h?.name, '헬카이트 돌격대');
  assert.equal(h.region, 'loc-akoum');
  assert.deepEqual(h.abilities, ['fly', 'haste']);
  assert.equal(world.npcs.find((x) => x.id === 'cre-hellkite')?.extraCombat?.costText, '{5}{R}{R}');
});

const pyro = (region = 'loc-a', plan?: unknown[][]) =>
  npc('chr-p', { ...npcSim(region), pt: [3, 2], mana: { R: 6 }, ally: true, hireable: true, rally: [{ type: 'damage_allies' }], ...(plan ? { plan } : {}) });

test('the player hires a mercenary for his mana value × 10 coin; as an Ally joins, the player picks whom his fire falls on', async () => {
  const world = fixture([pyro(), npc('chr-y', npcSim('loc-a', 'social', [1, 5])), npc('chr-a', { ...npcSim('loc-a'), ally: true })]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  assert.match((await act(state, world, { type: 'hire', to: 'chr-p' })).error!, /돈이 모자라다 \(60코인\)/);
  assert.match((await act(state, world, { type: 'hire', to: 'chr-y' })).error!, /고용할 수 있는 이가 아니다/);
  p.stats.coin = 70;
  await act(state, world, { type: 'hire', to: 'chr-p' });
  assert.equal(state.actors['chr-p'].master, PLAYER_ID);
  assert.equal(p.stats.coin, 10);
  // The pick comes first; nothing else until it is made.
  assert.equal(state.asks?.length, 1);
  assert.deepEqual(state.asks![0].candidates.sort(), ['chr-a', 'chr-y', PLAYER_ID].sort());
  assert.match((await act(state, world, { type: 'wait', hours: 1 })).error!, /먼저 골라야 한다: .*피해 1/);
  const at = state.minutes;
  await act(state, world, { type: 'choose', pick: 'chr-y' });
  assert.equal(state.minutes, at); // no time passes
  assert.equal(woundsOf(state.actors['chr-y'], state.minutes), 1);
  assert.deepEqual(state.actors['chr-y'].foes?.ids, ['chr-p']);
  // Another Ally joins the party: the fire grows with it.
  await act(state, world, { type: 'talk', to: 'chr-a', say: '함께 가자' }, { reply: async () => ({ say: '좋소.', attack: false, follow: true }) });
  assert.equal(state.asks?.length, 1);
  assert.match(askText(state, world, state.asks![0]), /피해 2/);
  await act(state, world, { type: 'choose', pick: null });
  assert.equal(state.asks?.length, 0);
  assert.ok(texts(state).some((t) => t.includes('불길을 거두었다')));
});

test('a non-Ally joining wakes no rally', async () => {
  const world = fixture([pyro(), npc('chr-y', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  state.actors['chr-p'].master = PLAYER_ID;
  await act(state, world, { type: 'talk', to: 'chr-y', say: '함께 가자' }, { reply: async () => ({ say: '좋소.', attack: false, follow: true }) });
  assert.equal(state.actors['chr-y'].master, PLAYER_ID);
  assert.equal(state.asks?.length ?? 0, 0);
});

test('an NPC hires the mercenary by a hire block; the LLM picks, for them, whom the fire falls on', async () => {
  const plan = [['00:00', '24:00', 'loc-a', 'hire', '용병 고용', '🪙', undefined, undefined, 'chr-p']];
  const world = fixture([pyro(), npc('chr-m', { ...npcSim('loc-a'), plan }), npc('chr-y', npcSim('loc-a', 'social', [1, 5]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const m = state.actors['chr-m'];
  m.stats.coin = 100;
  let offered: PlanDayInput | undefined;
  const asked: [string, string[]][] = [];
  const llm: Llm = {
    planDay: async (input) => (input.id === 'chr-m' && (offered = input), planDay!(input)),
    choose: async ({ npc, candidates }) => (asked.push([npc.id, candidates.map((c) => c.id).sort()]), 'chr-y'),
  };
  await advance(state, world, 1, llm);
  assert.deepEqual(offered?.hire?.map((x) => [x.id, x.at]), [['chr-p', 'loc-a']]);
  assert.equal(state.actors['chr-p'].master, 'chr-m');
  assert.equal(m.stats.coin, 40);
  assert.deepEqual(asked, [['chr-m', ['chr-m', 'chr-y']]]);
  assert.equal(woundsOf(state.actors['chr-y'], state.minutes), 1);
});

test('the real Murasa Pyromancer roams Murasa, for 60 coin', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['chr-murasa-pyromancer']?.region, 'loc-murasa');
  const def = world.npcs.find((x) => x.id === 'chr-murasa-pyromancer')!;
  assert.equal(def.ally, true);
  assert.equal(hirePrice(def), 60);
});

test('a herd with landfall tokens: each land it bonds with, a new 4/4 of its kind is born at its side and follows it; trample is its own', async () => {
  const plan = [
    ['00:00', '06:00', 'loc-b', 'sleep', '잠', '💤'],
    ['06:00', '10:00', 'loc-b', 'bond', '사냥터 차지', '🐾'],
    ['10:00', '24:00', 'loc-b', 'leisure', '어슬렁', '🌳'],
  ];
  const world = fixture([
    lore('cre-bal', 'creature'),
    npc('chr-herd', { ...npcSim('loc-b', 'social', [6, 6]), needs: ['energy'], beast: true, abilities: ['trample'], landfall_token: { creature: 'cre-bal', pt: [4, 4], colors: ['G'] }, plan }),
    npc('chr-y', npcSim('loc-b', 'social', [1, 1])),
    npc('chr-z', npcSim('loc-b', 'social', [1, 9])),
  ]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const herd = state.actors['chr-herd'];
  await advance(state, world, 4); // 06:00 → 10:00
  const young = Object.values(state.actors).filter((x) => x.master === 'chr-herd');
  assert.equal(young.length, 1);
  assert.deepEqual(ptOf(young[0]), [4, 4]);
  assert.equal(young[0].enteredAt !== undefined, true);
  assert.equal(young[0].schedule, undefined); // it lives its herd's day
  assert.ok(texts(state).some((t) => t.includes('새로 났다')));
  // Trample without a landfall surge: 6 into a 1/1, 5 spills onto someone else there.
  addFoe(herd, 'chr-y', state.minutes);
  await advance(state, world, 1);
  assert.ok(texts(state).some((t) => t.includes('돌진이')));
});

test('the real Rampaging Baloths roam Bala Ged; the Woodcrasher moved to Murasa', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['chr-rampaging-baloths']?.region, 'loc-bala-ged');
  assert.ok(state.actors['chr-rampaging-baloths'].abilities.includes('trample'));
  assert.equal(world.npcs.find((x) => x.id === 'chr-rampaging-baloths')?.landfallToken?.creature, 'cre-baloth');
});

const roil = (plan: unknown[][]): RawEntity => planned({
  id: 'cre-r',
  kind: 'creature',
  name: '정령',
  status: 'canon',
  sim: { pt: [3, 2], mana: { U: 6 }, role: 'r', home: 'loc-a', persona: 'p', goal: 'g', needs: ['energy'], beast: true, abilities: ['fly'], landfall_seize: true, plan },
});
const roilDay = [
  ['00:00', '06:00', 'loc-a', 'leisure', '맴돎', '🌀'],
  ['06:00', '10:00', 'loc-a', 'bond', '땅을 삼킴', '🌀'],
  ['10:00', '24:00', 'loc-b', 'leisure', '맴돎', '🌀'],
];

test('a Roil Elemental bonding may seize anyone there, from their master too; only its end frees them', async () => {
  const world = fixture([roil(roilDay), npc('chr-m', npcSim('loc-a')), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const x = state.actors['chr-x'];
  x.master = 'chr-m';
  const asked: string[][] = [];
  await advance(state, world, 4, { choose: async ({ npc, candidates }) => (asked.push([npc.id, ...candidates.map((c) => c.id).sort()]), 'chr-x') });
  assert.deepEqual(asked, [['cre-r', 'chr-m', 'chr-x']]);
  assert.equal(x.master, 'cre-r');
  assert.equal(x.seized, true);
  assert.ok(texts(state).some((t) => t.includes('소용돌이가') && t.includes('삼켰다')));
  // Struck by it, they stay its; its end frees them.
  (await import('./combat.ts')).clash(state, world, state.actors['cre-r'], x, state.minutes);
  assert.equal(x.master, 'cre-r');
  die(state, state.actors['cre-r'], state.minutes, '시험');
  assert.equal(x.master, undefined);
  assert.equal(x.seized, undefined);
});

test('the player seized is dragged along and can only wait; they can\'t turn on what holds them', async () => {
  const world = fixture([roil(roilDay)]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  await act(state, world, { type: 'wait', hours: 4 }, { choose: async () => PLAYER_ID });
  assert.equal(p.master, 'cre-r');
  assert.match((await act(state, world, { type: 'move', to: 'loc-c' })).error!, /붙들려 있다/);
  assert.match((await act(state, world, { type: 'attack', to: 'cre-r' })).error!, /기다릴 수만/);
  await act(state, world, { type: 'wait', hours: 4 });
  assert.equal(p.region, 'loc-b'); // dragged where it went
});

test('the real Roil Elemental drifts over Tazeem', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const r = state.actors['cre-roil-elemental'];
  assert.equal(r?.region, 'loc-tazeem');
  assert.equal(world.npcs.find((x) => x.id === 'cre-roil-elemental')?.landfallSeize, true);
});

const runeflare: RawEntity = {
  id: 'evt-rune',
  kind: 'event',
  name: '룬불꽃',
  status: 'canon',
  sim: { region: 'loc-a', trigger: 'drew', cards: 3, text: '룬이 불길을 뿜었다.', effects: [{ type: 'damage_hand' }] },
};
const spell = (id: string): RawEntity => ({ ...bolt, id, name: id });

test('a drew trap burns, once a day, each one here who drew three, for what they hold in mind', async () => {
  const world = fixture([walker, bolt, spell('spl-2'), spell('spl-3'), runeflare, npc('chr-x', npcSim('loc-a', 'social', [1, 5])), npc('chr-y', npcSim('loc-b', 'social', [1, 5]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const x = state.actors['chr-x'];
  const w = state.actors['chr-w'];
  assert.equal(useAbility(state, world, 'chr-w', 'wheel', '', state.minutes), null);
  assert.deepEqual(x.drawn, { day: 0, count: 3, sprung: undefined });
  await advance(state, world, 1);
  assert.ok(texts(state).some((t) => t.includes('룬이 불길을 뿜었다')));
  assert.equal(woundsOf(x, state.minutes), 3);
  assert.equal(w.left, true); // loyalty 5 − 2, then 3 of fire
  assert.equal(state.actors['chr-y'].drawn, undefined); // elsewhere: untouched
  const fired = state.log.filter((e) => e.text.includes('룬이 불길을')).length;
  await advance(state, world, 1);
  assert.equal(state.log.filter((e) => e.text.includes('룬이 불길을')).length, fired); // once a day
});

test('the real Runeflare Trap lies over Akoum', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-runeflare-trap');
  assert.equal(ev?.region, 'loc-akoum');
  assert.equal(ev?.trigger, 'drew');
  assert.equal(ev?.cards, 3);
});

test('defender never strikes first; landfall takes it away until midnight', async () => {
  const plan = [
    ['00:00', '06:00', 'loc-a', 'leisure', '잠김', '🌊'],
    ['06:00', '10:00', 'loc-a', 'bond', '여울 차지', '🌊'],
    ['10:00', '24:00', 'loc-a', 'leisure', '잠김', '🌊'],
  ];
  const world = fixture([npc('chr-s', { ...npcSim('loc-a', 'social', [5, 5]), needs: ['energy'], abilities: ['defender'], landfall_lose: ['defender'], plan }), npc('chr-y', npcSim('loc-a', 'social', [1, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const s = state.actors['chr-s'];
  const strikes = () => state.log.filter((e) => e.kind === 'combat' && e.text.includes('공격했다') && e.actors[0] === 'chr-s').length;
  addFoe(s, 'chr-y', state.minutes);
  await advance(state, world, 1);
  assert.equal(strikes(), 0);
  // Struck, it strikes back in that exchange, but doesn't go after them on its own.
  const y = state.actors['chr-y'];
  y.pt = [1, 20];
  addFoe(y, 'chr-s', state.minutes);
  await advance(state, world, 1);
  assert.equal(woundsOf(y, state.minutes - 60), 5);
  assert.equal(strikes(), 0);
  y.foes = undefined;
  s.foes = undefined;
  await advance(state, world, 2); // bonded at 10:00
  assert.ok(texts(state).some((t) => t.includes('수비대를 잃었다')));
  assert.equal(hasAbility(s, 'defender', state.minutes), false);
  addFoe(s, 'chr-y', state.minutes);
  await advance(state, world, 1);
  assert.equal(strikes(), 1);
  assert.equal(hasAbility(s, 'defender', state.minutes + 1440), true); // back tomorrow
});

test('the real Shoal Serpent lurks in the new Silundi Sea', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const s = state.actors['cre-shoal-serpent'];
  assert.equal(s?.region, 'loc-silundi-sea');
  assert.deepEqual(s.abilities, ['aquatic', 'defender']);
  assert.equal(region(world, 'loc-silundi-sea').terrain, 'deepsea');
});

const sorin = being('chr-so', {
  home: 'loc-a',
  abilities: [],
  pt: [0, 4],
  loyalty: 4,
  activated: [
    { id: 'plus', name: '피의 일격', loyalty: 2, effects: [{ type: 'damage', amount: 2 }, { type: 'gain_life', amount: 2 }] },
    { id: 'ten', name: '생명의 저울', loyalty: -3, effects: [{ type: 'set_life', amount: 10 }] },
    { id: 'rule', name: '지배', loyalty: -7, effects: [{ type: 'possess_next_turn' }] },
  ],
});

test('Sorin: +2 strikes and drinks, −3 sets a life to 10, −7 takes someone\'s next day; planeswalkers have life apart from loyalty', async () => {
  const world = fixture([sorin, npc('chr-x', npcSim('loc-a', 'social', [1, 5])), npc('chr-k2', { ...npcSim('loc-a'), needs: ['energy'] })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const so = state.actors['chr-so'];
  const x = state.actors['chr-x'];
  assert.equal(lifeOf(so), 20); // a planeswalker's life, apart from loyalty
  assert.equal(useAbility(state, world, 'chr-so', 'plus', 'chr-x', state.minutes), null);
  assert.equal(woundsOf(x, state.minutes), 2);
  assert.equal(so.life, 22);
  assert.equal(so.loyalty, 6);
  // −3: down to 10, or up to 10.
  state.minutes += 1440;
  assert.equal(useAbility(state, world, 'chr-so', 'ten', 'chr-x', state.minutes), null);
  assert.equal(x.life, 10);
  state.minutes += 1440;
  so.loyalty = 9;
  x.life = 4;
  assert.equal(useAbility(state, world, 'chr-so', 'ten', 'chr-x', state.minutes), null);
  assert.equal(x.life, 10);
  // Those who never tire have life too (user decision 2026-09-30).
  state.minutes += 1440;
  assert.equal(useAbility(state, world, 'chr-so', 'ten', 'chr-k2', state.minutes), null);
  assert.equal(state.actors['chr-k2'].life, 10);
  // −7: tomorrow is Sorin's; the day after, theirs again.
  state.minutes += 1440;
  so.loyalty = 8;
  assert.equal(useAbility(state, world, 'chr-so', 'rule', 'chr-x', state.minutes), null);
  assert.equal(x.master, undefined); // not yet: their next day
  const day = Math.floor(state.minutes / 1440);
  state.minutes = (day + 1) * 1440 - 60;
  await advance(state, world, 2); // through 00:00
  assert.equal(x.master, 'chr-so');
  assert.equal(x.seized, true);
  await advance(state, world, 24); // through the next 00:00
  assert.equal(x.master, undefined);
  assert.ok(texts(state).some((t) => t.includes('지배가 끝남')));
});

test('the real Sorin Markov walks Ondu by Graypelt; Chandra has life too', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const so = state.actors['chr-sorin-markov'];
  assert.equal(so?.region, 'loc-ondu');
  assert.equal(so.loyalty, 4);
  assert.equal(lifeOf(so), 20);
  assert.equal(lifeOf(state.actors['chr-chandra']), 20);
});

const sphinx = (): RawEntity => planned({
  id: 'cre-sx',
  kind: 'creature',
  name: '스핑크스',
  status: 'canon',
  sim: { pt: [5, 5], mana: { U: 6 }, role: 'r', home: 'loc-a', persona: 'p', goal: 'g', needs: ['energy'], abilities: ['fly', 'shroud'], foresight: true },
});

test('shroud: no spell, power, land or seizing may pick the sphinx, not even its own side; it can still be fought', async () => {
  const world = fixture([sphinx(), sorin, tribute('loc-a'), lore('cre-v', 'creature'), roil(roilDay), npc('chr-x', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const [p, sx, x] = [state.actors[PLAYER_ID], state.actors['cre-sx'], state.actors['chr-x']];
  assert.equal(targetable(sx, state.minutes), false);
  // A planeswalker's power, a spell (the player's own), a land's gift.
  assert.match(useAbility(state, world, 'chr-so', 'plus', 'cre-sx', state.minutes)!, /방어막/);
  assert.equal(woundsOf(sx, state.minutes), 0);
  p.spells = ['spl-t'];
  p.bonds = ['loc-a'];
  assert.match(castBlocked(state, world, p, 'spl-t', 'cre-sx', false, state.minutes)!, /방어막/);
  assert.ok(!bondTargets(state, world, x, 'loc-a', { type: 'pump', pt: [2, 0] }).some((y) => y.id === 'cre-sx'));
  // The Roil Elemental can't swallow it.
  const asked: string[][] = [];
  await act(state, world, { type: 'wait', hours: 4 }, { choose: async ({ npc, candidates }) => (asked.push([npc.id, ...candidates.map((c) => c.id).sort()]), null) });
  assert.equal(asked.length, 1);
  assert.equal(asked[0][0], 'cre-r');
  assert.ok(asked[0].includes('chr-x') && !asked[0].includes('cre-sx'));
  // A fight is no targeting.
  (await import('./combat.ts')).clash(state, world, x, sx, state.minutes);
  assert.equal(woundsOf(sx, state.minutes), 1);
});

test('one who foresees plans after the morning picks, knowing what is still to come today', async () => {
  const world = fixture([sphinx(), tide, npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const seen = new Map<string, string[] | undefined>();
  const llm: Llm = {
    planDay: async (input) => (seen.set(input.id, input.foresight), planDay!(input)),
    gmDay: async ({ day }) => ({ day, source: 'llm', fires: [{ eventId: 'evt-tide', hour: 20 }] }),
  };
  await advance(state, world, 1, llm);
  assert.equal(seen.get('cre-sx')?.length, 1);
  assert.match(seen.get('cre-sx')![0], /^20:00 loc-sea에서 조수/);
  assert.ok(seen.has('chr-x'));
  assert.equal(seen.get('chr-x'), undefined);
  // Past 20:00, nothing is left to come.
  assert.deepEqual(foresightText(state, world, state.minutes + 15 * 60), []);
});

test('the real Sphinx of Jwar Isle lives on Jwar Isle, shrouded, seeing ahead', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const sx = state.actors['cre-sphinx'];
  assert.equal(sx?.region, 'loc-jwar-isle');
  assert.deepEqual(sx.abilities, ['fly', 'shroud']);
  assert.equal(world.npcs.find((x) => x.id === 'cre-sphinx')?.foresight, true);
  assert.ok(!world.npcs.find((x) => x.id === 'cre-sphinx')?.beast); // it talks, if rarely
});

// NPCs among themselves have what the player has with them (user decision 2026-09-30).
test('an NPC may seek out another to talk, wherever they are and whatever they do', async () => {
  const seeker = { ...npcSim('loc-a'), plan: [['00:00', '24:00', 'loc-a', 'social', '벗을 찾아감', '💬', null, null, 'chr-y']] };
  const world = fixture([npc('chr-x', seeker), npc('chr-y', npcSim('loc-b', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const talks: string[][] = [];
  await advance(state, world, 4, { converse: async ({ a, b }) => (talks.push([a.id, b.id]), null) });
  assert.equal(state.actors['chr-x'].region, 'loc-b'); // went to them
  assert.ok(texts(state).some((t) => t.includes('찾아가 마주했다')));
  assert.equal(talks.length, 1);
});

test('an NPC may pledge to serve another in talk, as to the player; not if they serve someone', async () => {
  const world = fixture([npc('chr-x', npcSim('loc-a')), npc('chr-y', npcSim('loc-a')), npc('chr-z', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  state.actors['chr-z'].master = 'chr-y';
  const pledge: Llm['converse'] = async ({ a, b }) => ({ lines: [{ by: a.id, say: '따르겠소' }], impressions: {}, attacker: null, follower: [a.id, b.id].includes('chr-x') ? 'chr-x' : 'chr-z' });
  await advance(state, world, 1, { converse: pledge });
  const x = state.actors['chr-x'];
  assert.ok(x.master === 'chr-y' || x.master === 'chr-z');
  assert.equal(state.actors['chr-z'].master, 'chr-y'); // already served: no pledge
  assert.ok(texts(state).some((t) => t.includes('권속이 되었다 (설득)')));
});

test('an NPC may go after another and fall on them; a defender may not', async () => {
  const hunter = { ...npcSim('loc-a', 'work', [3, 3]), plan: [['00:00', '24:00', 'loc-a', 'attack', '원수를 쫓음', '⚔️', null, null, 'chr-y']] };
  const world = fixture([npc('chr-x', hunter), npc('chr-y', npcSim('loc-b', 'work', [1, 2]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  await advance(state, world, 4);
  assert.equal(state.actors['chr-x'].region, 'loc-b');
  assert.ok(texts(state).some((t) => t.includes('에게 덤벼들었다')));
  assert.ok(woundsOf(state.actors['chr-y'], state.minutes) > 0 || knockedOut(state.actors['chr-y']));
  assert.equal(attackBlocked(state, world, { ...state.actors['chr-x'], abilities: ['defender'] }, 'chr-y', state.minutes), '먼저 덤비지 않는다.');
});

test('a flyer NPC set on by an NPC who can\'t fly may take to the air until midnight, as from the player', async () => {
  const flyer = { ...npcSim('loc-a', 'work', [2, 7]), abilities: ['fly'] };
  const world = fixture([npc('chr-x', npcSim('loc-a', 'work', [3, 3])), npc('chr-f', flyer)]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  addFoe(state.actors['chr-x'], 'chr-f', state.minutes);
  const asked: string[] = [];
  await advance(state, world, 3, { evade: async ({ npc, attacker }) => (asked.push(`${npc.id}<${attacker.id}`), true) });
  assert.deepEqual(asked, ['chr-f<chr-x']); // once for the day
  assert.ok(texts(state).some((t) => t.includes('공격을 피했다 (자정까지')));
  assert.equal(woundsOf(state.actors['chr-f'], state.minutes), 0);
  // Standing to fight instead: the blow lands the hour after.
  const s2 = newState(world, { seed: 1, mode: 'observer' });
  addFoe(s2.actors['chr-x'], 'chr-f', s2.minutes);
  await advance(s2, world, 2, { evade: async () => false });
  assert.ok(woundsOf(s2.actors['chr-f'], s2.minutes) > 0);
});

// And NPCs toward the player, what the player may toward them (user decision 2026-09-30).
test('an NPC may seek out the player and speak first, and ask them to serve; the player answers', async () => {
  const seeker = { ...npcSim('loc-b', 'work'), plan: [['00:00', '24:00', 'loc-b', 'social', '그를 찾아감', '💬', null, null, PLAYER_ID]] };
  const world = fixture([npc('chr-x', seeker)]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  const heard: (string | undefined)[] = [];
  const reply: Llm['reply'] = async ({ say }) => (heard.push(say), { say: '나를 따르게.', attack: false, recruit: true });
  await act(state, world, { type: 'wait', hours: 8 }, { reply });
  assert.deepEqual(heard, [undefined]); // they spoke first
  assert.equal(state.actors['chr-x'].region, 'loc-a');
  assert.ok(texts(state).some((t) => t.includes('나를 따르게')));
  assert.equal(state.asks?.[0]?.effect.type, 'pledge');
  assert.match((await act(state, world, { type: 'wait', hours: 1 })).error!, /먼저 골라야/);
  await act(state, world, { type: 'choose', pick: 'chr-x' });
  assert.equal(p.master, 'chr-x');
});

test('an NPC may go after the player; a flying player picks whether to take to the air', async () => {
  const hunter = { ...npcSim('loc-a', 'work', [3, 3]), plan: [['00:00', '24:00', 'loc-a', 'attack', '그를 노림', '⚔️', null, null, PLAYER_ID]] };
  const world = fixture([npc('chr-x', hunter)]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.abilities = [...p.abilities, 'fly'];
  p.pt = [1, 9];
  await act(state, world, { type: 'wait', hours: 4 });
  assert.ok(texts(state).some((t) => t.includes('에게 덤벼들었다'))); // the player stops what they were doing
  await act(state, world, { type: 'wait', hours: 1 });
  assert.equal(state.asks?.[0]?.effect.type, 'evade');
  assert.equal(woundsOf(p, state.minutes), 0);
  await act(state, world, { type: 'choose', pick: 'chr-x' });
  await act(state, world, { type: 'wait', hours: 3 });
  assert.equal(woundsOf(p, state.minutes), 0); // out of reach until midnight
  assert.ok(!state.asks?.length);
});

const summoning: RawEntity = {
  id: 'evt-sum',
  kind: 'event',
  name: '소환 함정',
  status: 'canon',
  sim: { region: 'loc-b', trigger: 'enter', refused: true, text: '룬이 빛났다.', effects: [{ type: 'summon', look: 7 }] },
};
const beastKind = (id: string, abilities: string[], home = 'loc-c'): RawEntity =>
  planned({ id, kind: 'creature', name: id.slice(4), status: 'canon', sim: { name: `${id} 한 마리`, pt: [4, 4], role: 'r', home, persona: 'p', goal: 'g', needs: ['energy'], abilities } });

test('a summoning trap: one refused today who enters draws a creature card there from anywhere (the sea too), turned on them', async () => {
  const world = fixture([summoning, beastKind('cre-sea', ['aquatic'], 'loc-sea'), npc('chr-far', npcSim('loc-c')), npc('chr-x', npcSim('loc-b')), npc('chr-y', npcSim('loc-b'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [x, y] = [state.actors['chr-x'], state.actors['chr-y']];
  x.region = y.region = 'loc-a';
  x.refused = 0; // turned down today
  const offered: string[][] = [];
  const summon: Llm['summon'] = async ({ creatures, intruders }) => (offered.push([...creatures.map((c) => c.id).sort(), '|', ...intruders.map((a) => a.id)]), 'cre-sea');
  const before = Object.keys(state.actors).length;
  await advance(state, world, 3, { summon });
  // Anyone of a creature card, not already there, not the one who sprang it; y was not refused.
  assert.deepEqual(offered, [['chr-far', 'cre-sea', '|', 'chr-x']]);
  assert.equal(state.actors['cre-sea'].region, 'loc-b'); // moved, not made
  assert.equal(Object.keys(state.actors).length, before);
  assert.ok(texts(state).some((t) => t.includes('끌려와 문간의 어둠에서 걸어 나왔다')));
});

const whiplash: RawEntity = {
  id: 'evt-whip',
  kind: 'event',
  name: '채찍 함정',
  status: 'canon',
  sim: { region: 'loc-b', trigger: 'enter', joined: 2, text: '줄기가 휘몰아쳤다.', effects: [{ type: 'bounce', count: 2 }] },
};

test('tiles: every land holds as many tiles as the lore gives it, at least 100 a continent and 10 any other land; seas share the water', () => {
  const world = loadWorld();
  const owners = Object.values(world.tileOwner!);
  for (const r of world.regions.filter((x) => !x.wanders)) {
    const n = tilesOf(world, r.id).length;
    if (r.parent) assert.equal(n, r.tileCount ?? 10, r.id);
    assert.equal(owners.filter((o) => o === r.id).length, n, r.id); // one land to a tile
  }
  assert.deepEqual(tooSmall(world), []);
  assert.equal(tilesOf(world, 'loc-makindi').length, 50);
  assert.equal(tilesOf(world, 'loc-oran-rief').length, 80);
  assert.equal(tilesOf(world, 'loc-silundi-sea').length, 120);
  // A continent: its open ground and its areas.
  const ondu = ['loc-ondu', ...world.regions.filter((x) => x.parent === 'loc-ondu').map((x) => x.id)];
  assert.equal(ondu.reduce((n, id) => n + tilesOf(world, id).length, 0), 200);
});

test('tiles: only those on the same tile meet; one seeking another walks to their tile, an hour a step', async () => {
  const wide: RawEntity = { id: 'loc-w', kind: 'location', name: '넓은 땅', status: 'canon', map: { x: 200, y: 200, terrain: 'grassland', size: 'continent' } };
  const seeker = { ...npcSim('loc-w', 'social'), plan: [['00:00', '24:00', 'loc-w', 'social', '그를 찾아감', '💬', null, null, 'chr-b']] };
  const world = fixture([wide, npc('chr-a', seeker), npc('chr-b', npcSim('loc-w', 'social'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [a, b] = [state.actors['chr-a'], state.actors['chr-b']];
  // The two tiles of the land farthest apart.
  const ts = tilesOf(world, 'loc-w');
  const [near, far] = ts.flatMap((x) => ts.map((y) => [x, y] as const)).sort((p, q) => tileSteps(q[0], q[1]) - tileSteps(p[0], p[1]))[0];
  assert.ok(tileSteps(near, far) >= 3);
  Object.assign(a, { tile: near });
  Object.assign(b, { tile: far });
  assert.equal(together(a, b), false);
  assert.deepEqual(here(state, a).map((x) => x.id), ['chr-a']);
  assert.match(awayText(world, a, b)!, /이 땅의 다른 곳/);
  await advance(state, world, 1, {});
  assert.ok(a.travel && sameTile(a.travel.tile, far)); // walking to b's tile
  assert.equal(moveHours(world, { ...a, travel: undefined, tile: near }, 'loc-w', far), tileSteps(near, far));
  await advance(state, world, tileSteps(near, far) + 1, {});
  assert.ok(together(a, b));
  assert.ok(texts(state).some((l) => l.includes('찾아가 마주했다')));
});

test('tiles: the player walks to a tile of their land, and seeks someone out; exploring drifts a tile', async () => {
  const wide: RawEntity = { id: 'loc-w', kind: 'location', name: '넓은 땅', status: 'canon', map: { x: 200, y: 200, terrain: 'grassland', size: 'continent' } };
  const world = fixture([wide, npc('chr-b', npcSim('loc-w', 'work'))]);
  const state = character(world, 'loc-w');
  const p = state.actors[PLAYER_ID];
  const b = state.actors['chr-b'];
  const ts = tilesOf(world, 'loc-w');
  const other = ts.find((t) => tileSteps(t, p.tile!) === 2)!;
  await act(state, world, { type: 'move', to: 'loc-w', tile: other });
  assert.ok(sameTile(p.tile, other));
  assert.match((await act(state, world, { type: 'move', to: 'loc-w', tile: other })).error ?? '', /이미 그곳에/);
  b.tile = ts.find((t) => tileSteps(t, other) === 3)!;
  await act(state, world, { type: 'seek', to: 'chr-b' });
  assert.ok(together(p, b));
  const before = p.tile!;
  await act(state, world, { type: 'explore', hours: 1, pace: 'normal' });
  assert.equal(tileSteps(before, p.tile!), 1);
});

test('tiles: each lives on their own tile of their home (as the lore puts it, `home_pos`, or one by name); an old save spreads them', () => {
  const wide: RawEntity = { id: 'loc-w', kind: 'location', name: '넓은 땅', status: 'canon', map: { x: 200, y: 200, terrain: 'grassland', size: 'continent' } };
  const world = fixture([wide, npc('chr-e', { ...npcSim('loc-w'), home_pos: [0.9, 0] }), npc('chr-n', { ...npcSim('loc-w'), home_pos: [0, -0.9] }), npc('chr-x', npcSim('loc-w'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [e, n] = [state.actors['chr-e'], state.actors['chr-n']];
  const mid = centroid(world, 'loc-w')!;
  assert.ok(tileCenter(e.tile!).x > mid.x + TILE); // east
  assert.ok(tileCenter(n.tile!).y < mid.y - TILE); // north
  assert.ok(!together(e, n));
  // A save from when all stood on the middle tile: at home, they go to their own.
  const old = newState(world, { seed: 1, mode: 'observer' });
  delete old.spread;
  for (const a of Object.values(old.actors)) a.tile = nearestTile(world, 'loc-w');
  syncWorld(old, world);
  assert.ok(sameTile(old.actors['chr-e'].tile, e.tile));
  // The real world: no crowd on one tile at the start.
  const real = loadWorld();
  const rs = newState(real, { seed: 1, mode: 'observer' });
  const counts = new Map<string, number>();
  for (const a of Object.values(rs.actors)) counts.set(`${a.region}|${a.tile}`, (counts.get(`${a.region}|${a.tile}`) ?? 0) + 1);
  assert.ok(Math.max(...counts.values()) <= 2, JSON.stringify([...counts].filter(([, c]) => c > 2)));
});

test('tiles: an old save gets everyone a tile of their land', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  for (const a of Object.values(state.actors)) delete a.tile;
  syncWorld(state, world);
  for (const a of Object.values(state.actors)) assert.ok(ownsTile(world, a.region, a.tile), a.id);
});

test('a whiplash trap: one with two joined today who enters sets it off; two there are flung: stripped, freed, landed nearby, stunned; a token is gone', async () => {
  const world = fixture([
    whiplash,
    lore('cre-w', 'creature'),
    { id: 'loc-bz', kind: 'location', name: '곁의 숲', status: 'canon', map: { in: 'loc-b', terrain: 'forest', tiles: 1 } },
    npc('chr-x', npcSim('loc-b')),
    npc('chr-m', { ...npcSim('loc-b'), mana: { R: 5 }, ally: true, hireable: true }),
    npc('chr-y', npcSim('loc-b')),
  ]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [x, m, y] = [state.actors['chr-x'], state.actors['chr-m'], state.actors['chr-y']];
  // The trap lies on one tile of loc-b: they stand on another and walk onto it.
  const trap = fixedTile(world, 'loc-b', 'evt-whip')!;
  const start = tilesOf(world, 'loc-b').find((t) => !sameTile(t, trap))!;
  for (const a of [x, m]) Object.assign(a, { region: 'loc-b', tile: start });
  bindRetainer(state, world, m, x, state.minutes, '고용');
  m.plusCounters = 2;
  const [wolf] = spawnWild(state, world, 'cre-w', [2, 2], 1, 'loc-b', ['G'], start);
  wolf.master = x.id;
  assert.equal(joinedToday(state, x, state.minutes), 2);
  for (const a of [x, m, wolf]) startTravel(state, world, a, 'loc-b', state.minutes, trap);
  const asked: string[][] = [];
  const bounce: Llm['bounce'] = async ({ creatures, count }) => (asked.push(creatures.map((c) => c.id).sort()), assert.equal(count, 2), [m.id, wolf.id]);
  await advance(state, world, 2, { bounce });
  assert.equal(asked.length, 1);
  assert.ok(asked[0].includes(m.id) && asked[0].includes(wolf.id) && !asked[0].includes(PLAYER_ID));
  assert.equal(m.master, undefined); // freed
  assert.equal(m.plusCounters, undefined); // stripped
  assert.equal(m.region, 'loc-bz'); // landed in another area of the region
  assert.ok(wolf.dead && wolf.left); // a token: gone
  assert.ok(texts(state).some((t) => t.includes('내동댕이쳐져 곁의 숲에 떨어졌다')));
  // One with only one joined today: nothing.
  const s2 = newState(world, { seed: 1, mode: 'observer' });
  const [x2, m2] = [s2.actors['chr-x'], s2.actors['chr-m']];
  for (const a of [x2, m2]) Object.assign(a, { region: 'loc-b', tile: start });
  bindRetainer(s2, world, m2, x2, s2.minutes, '고용');
  for (const a of [x2, m2]) startTravel(s2, world, a, 'loc-b', s2.minutes, trap);
  let sprung = false;
  await advance(s2, world, 3, { bounce: async () => ((sprung = true), []) });
  assert.equal(sprung, false);
  assert.equal(m2.master, 'chr-x');
});

test('world queller: at upkeep its controller names a type; all there give up one of theirs (the player picks), itself too', async () => {
  const queller = { ...npcSim('loc-a', 'work', [4, 4]), mana: { W: 5 }, needs: ['energy'], beast: true, quell: true };
  const world = fixture([npc('chr-q', queller), npc('chr-x', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const [p, q, x] = [state.actors[PLAYER_ID], state.actors['chr-q'], state.actors['chr-x']];
  p.bonds = ['loc-a', 'loc-b'];
  x.bonds = ['loc-c'];
  upkeepQuell(state, world, state.minutes);
  assert.deepEqual(state.choices?.map((c) => [c.by, c.effect.type]), [['chr-q', 'quell']]);
  const asked: string[] = [];
  await act(state, world, { type: 'wait', hours: 1 }, { pick: async ({ what, options }) => (asked.push(what), options.some((o) => o.id === 'land') ? 'land' : options[0].id) });
  assert.equal(asked.length, 1); // the queller named it; x had one land: given, no pick
  assert.deepEqual(x.bonds, []);
  assert.ok(texts(state).some((t) => t.includes('땅 하나를 내놓아야 한다')));
  // The player holds two: a pick they owe.
  assert.equal(state.asks?.[0]?.effect.type, 'quelled');
  assert.match(askText(state, world, state.asks![0]), /땅 하나를 내놓아야/);
  await act(state, world, { type: 'choose', pick: 'land:loc-b' });
  assert.deepEqual(p.bonds, ['loc-a']);
  // Creatures, and it controls only itself: it gives itself.
  applyQuell(state, world, q, 'creature', state.minutes);
  assert.ok(q.dead);
});

test('the real World Queller rises in Ondu', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const q = state.actors['cre-world-queller'];
  assert.equal(q.region, 'loc-ondu');
  assert.ok(npcDef(state, world, q.id)?.quell);
  assert.deepEqual(ptOf(q), [4, 4]);
});

test('turned down: the player refusing to serve, or refusing the player, marks the one refused that day', async () => {
  const seeker = { ...npcSim('loc-a', 'work'), plan: [['00:00', '24:00', 'loc-a', 'social', '그를 찾아감', '💬', null, null, PLAYER_ID]] };
  const world = fixture([npc('chr-x', seeker)]);
  const state = character(world, 'loc-a');
  await act(state, world, { type: 'wait', hours: 2 }, { reply: async () => ({ say: '나를 따르게.', attack: false, recruit: true }) });
  await act(state, world, { type: 'choose', pick: null });
  assert.equal(state.actors['chr-x'].refused, 0);
  // The player turned down by one they sought to win.
  const w2 = fixture([npc('chr-y', npcSim('loc-a'))]);
  const s2 = character(w2, 'loc-a');
  await act(s2, w2, { type: 'talk', to: 'chr-y', say: '나와 함께 가자' }, { reply: async () => ({ say: '싫소.', attack: false, refused: true }) });
  assert.equal(s2.actors[PLAYER_ID].refused, 0);
});

test('the real Whiplash Trap lies in Tazeem: two joined today, two flung', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-whiplash-trap')!;
  assert.equal(ev.region, 'loc-tazeem');
  assert.equal(ev.trigger, 'enter');
  assert.equal(ev.joined, 2);
  assert.deepEqual(ev.effects, [{ type: 'bounce', count: 2 }]);
});

test('the real Summoning Trap lies in Bala Ged and may draw any creature card there, the Shoal Serpent too', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-summoning-trap');
  assert.equal(ev?.region, 'loc-bala-ged');
  assert.equal(ev?.refused, true);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const lib = summonLibrary(state, world, 'loc-bala-ged');
  // Creature cards anywhere, the sea's too; not planeswalkers, not those already there.
  assert.ok(lib.includes('cre-shoal-serpent') && lib.includes('chr-iona') && lib.includes('cre-sphinx'));
  assert.ok(!lib.includes('chr-sorin-markov') && !lib.includes('chr-chandra') && !lib.includes('chr-rampaging-baloths'));
});

test('one of the sea on land dries out, 1 toughness every 3 hours, unless it crawls back to the water', async () => {
  // A shore two hours from the sea (so four crawling).
  const world = fixture([beastKind('cre-sea', ['aquatic'], 'loc-sea'), loc('loc-shore', 10, 30 + 2 * TRAVEL_UNITS_PER_HOUR, 'beach')]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const fish = state.actors['cre-sea'];
  put(world, fish, 'loc-a'); // drawn onto land
  PLANS.set('cre-sea', [['00:00', '24:00', 'loc-a', 'leisure', '버둥거림', '🐟']]); // stays and fights
  await advance(state, world, 13);
  assert.ok(fish.dead);
  assert.ok(texts(state).some((t) => t.includes('말라 간다 (4/1)')));
  // Crawling back instead: twice as long, and back in the water it recovers at midnight.
  const s2 = newState(world, { seed: 1, mode: 'observer' });
  const f2 = s2.actors['cre-sea'];
  put(world, f2, 'loc-shore');
  PLANS.set('cre-sea', [['00:00', '24:00', 'loc-sea', 'leisure', '바다로', '🐟']]);
  await advance(s2, world, 6);
  assert.ok(texts(s2).some((t) => t.includes('기어 향했다 (4시간 거리)')));
  assert.equal(f2.region, 'loc-sea');
  assert.equal(ptOf(f2)[1], 3); // dried once on the way
  await advance(s2, world, 18); // through 00:00
  assert.equal(ptOf(f2)[1], 4);
  PLANS.delete('cre-sea');
});

test('every being has life: those who never tire too', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(lifeOf(state.actors['chr-lorthos']), 20);
  assert.equal(lifeOf(state.actors['chr-kalitas']), 20);
});

test('the real Terra Stomper hunts in Turntimber Grove, 8/8 with trample', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const s = state.actors['cre-terra-stomper'];
  assert.equal(s?.region, 'loc-turntimber-grove');
  assert.deepEqual(ptOf(s), [8, 8]);
  assert.ok(hasAbility(s, 'trample', state.minutes));
  assert.ok(world.npcs.find((x) => x.id === 'cre-terra-stomper')?.beast);
});

test('the real Vastwood Gorger hunts in Oran-Rief, the Vastwood', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['cre-vastwood-gorger'];
  assert.equal(g?.region, 'loc-oran-rief');
  assert.deepEqual(ptOf(g), [5, 6]);
  assert.ok(world.npcs.find((x) => x.id === 'cre-vastwood-gorger')?.beast);
});

test('an archive trap: one who searched out a land today and enters forgets those they knew', async () => {
  const archive: RawEntity = {
    id: 'evt-arc',
    kind: 'event',
    name: '기록보관소 함정',
    status: 'canon',
    sim: { region: 'loc-b', trigger: 'enter', searched: true, text: '천장이 무너졌다.', effects: [{ type: 'forget', count: 13 }] },
  };
  const world = fixture([archive, npc('chr-x', npcSim('loc-b')), npc('chr-y', npcSim('loc-b')), npc('chr-z', npcSim('loc-c'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [x, y, z] = [state.actors['chr-x'], state.actors['chr-y'], state.actors['chr-z']];
  x.region = y.region = 'loc-a';
  x.relations = { 'chr-z': { name: 'z', text: '벗', t: 0 }, 'chr-y': { name: 'y', text: '길동무', t: 0 } };
  y.relations = { 'chr-z': { name: 'z', text: '벗', t: 0 } };
  x.searched = 0; // sought a land with a fetch land today
  await advance(state, world, 3);
  assert.deepEqual(Object.keys(x.relations ?? {}).filter((id) => id === 'chr-z'), []); // forgotten
  assert.equal(y.relations?.['chr-z']?.text, '벗'); // didn't search: nothing
  assert.ok(texts(state).some((t) => t.includes('기억 2개를 잃었다')));
  assert.equal(z.dead, undefined);
});

test('the real Archive Trap lies on Jwar Isle, for those who searched', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-archive-trap');
  assert.equal(ev?.region, 'loc-jwar-isle');
  assert.equal(ev?.searched, true);
});

test('an archive trap on the player: those who know them forget them', async () => {
  const archive: RawEntity = {
    id: 'evt-arc',
    kind: 'event',
    name: '기록보관소 함정',
    status: 'canon',
    sim: { region: 'loc-b', trigger: 'enter', searched: true, text: '천장이 무너졌다.', effects: [{ type: 'forget', count: 13 }] },
  };
  const world = fixture([archive, npc('chr-x', npcSim('loc-c')), npc('chr-y', npcSim('loc-c'))]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  state.actors['chr-x'].relations = { [PLAYER_ID]: { name: 'me', text: '은인', t: 0 }, 'chr-y': { name: 'y', text: '벗', t: 0 } };
  p.searched = 0;
  await act(state, world, { type: 'move', to: 'loc-b' });
  assert.equal(state.actors['chr-x'].relations?.[PLAYER_ID], undefined); // forgot the player
  assert.equal(state.actors['chr-x'].relations?.['chr-y']?.text, '벗'); // not the others
  assert.ok(texts(state).some((t) => t.includes('의 기억에서') && t.includes('지워졌다 (1명)')));
});

const volleyTrap: RawEntity = {
  id: 'evt-vol',
  kind: 'event',
  name: '화살 세례 함정',
  status: 'canon',
  sim: { region: 'loc-a', trigger: 'attacked', attackers: 4, text: '화살이 쏟아졌다.', effects: [{ type: 'volley', amount: 5 }] },
};

test('an arrow volley trap: four or more striking in the same hour there, the trap divides 5 damage among them', async () => {
  const band = ['chr-a1', 'chr-a2', 'chr-a3', 'chr-a4'];
  const world = fixture([volleyTrap, npc('chr-t', npcSim('loc-a', 'work', [0, 30])), ...band.map((id) => npc(id, npcSim('loc-a', 'work', [1, 9])))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  for (const id of band) addFoe(state.actors[id], 'chr-t', state.minutes);
  const asked: string[][] = [];
  const volley: Llm['volley'] = async ({ targets, amount }) => (asked.push([...targets.map((a) => a.id).sort(), String(amount)]), { 'chr-a1': 3, 'chr-a2': 2 });
  await advance(state, world, 1, { volley });
  assert.deepEqual(asked, [[...band, '5']]);
  assert.equal(woundsOf(state.actors['chr-a1'], state.minutes), 3);
  assert.equal(woundsOf(state.actors['chr-a2'], state.minutes), 2);
  assert.equal(woundsOf(state.actors['chr-a3'], state.minutes), 0);
  assert.equal(woundsOf(state.actors['chr-t'], state.minutes), 4); // the four blows it took
});

test('an arrow volley trap sleeps for three; a bad division falls around them, strongest first', async () => {
  const world = fixture([volleyTrap, npc('chr-t', npcSim('loc-a', 'work', [0, 30])), ...['chr-a1', 'chr-a2', 'chr-a3'].map((id) => npc(id, npcSim('loc-a', 'work', [1, 9])))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  for (const id of ['chr-a1', 'chr-a2', 'chr-a3']) addFoe(state.actors[id], 'chr-t', state.minutes);
  let asked = 0;
  await advance(state, world, 1, { volley: async () => (asked++, null) });
  assert.equal(asked, 0);
  const [a, b] = [state.actors['chr-a1'], state.actors['chr-a2']];
  b.pt = [3, 9];
  assert.deepEqual(volleyShares([a, b], 5, { 'chr-a1': 9 }), { 'chr-a2': 3, 'chr-a1': 2 });
});

test('the real Arrow Volley Trap lies in Ondu', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-arrow-volley-trap');
  assert.equal(ev?.region, 'loc-ondu');
  assert.equal(ev?.attackers, 4);
});

test('a baloth cage trap: one who tamed an item today enters, and a hungry 4/4 baloth breaks out at them', async () => {
  const cage: RawEntity = {
    id: 'evt-cage',
    kind: 'event',
    name: '발로스 우리 함정',
    status: 'canon',
    sim: { region: 'loc-b', trigger: 'enter', claimed: true, text: '우리가 열렸다.', effects: [{ type: 'create', creature: 'cre-bal', count: 1, pt: [4, 4], colors: ['G'] }] },
  };
  const world = fixture([cage, planned({ id: 'cre-bal', kind: 'creature', name: '발로스', status: 'canon', sim: { pt: [4, 4], role: 'r', home: 'loc-c', persona: 'p', goal: 'g', needs: ['energy', 'hunger'], beast: true } }), npc('chr-x', npcSim('loc-b')), npc('chr-y', npcSim('loc-b'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [x, y] = [state.actors['chr-x'], state.actors['chr-y']];
  x.region = y.region = 'loc-a';
  x.claimed = 0; // tamed an item today
  await advance(state, world, 3);
  const born = Object.values(state.actors).filter((a) => a.id.startsWith('tok-') && a.name === '발로스');
  assert.equal(born.length, 1);
  assert.deepEqual(born[0].needs, ['energy', 'hunger']); // it lives as a baloth: it will hunt
  assert.ok(texts(state).some((t) => t.includes('우리가 열렸다')));
});

test('the real Baloth Cage Trap lies in Bala Ged, for those who tamed an item', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-baloth-cage-trap');
  assert.equal(ev?.region, 'loc-bala-ged');
  assert.equal(ev?.claimed, true);
});

test('a hungry token hunts only with no master: a herd\'s young keeps to its master', async () => {
  const world = fixture([planned({ id: 'cre-bal', kind: 'creature', name: '발로스', status: 'canon', sim: { pt: [4, 4], role: 'r', home: 'loc-c', persona: 'p', goal: 'g', needs: ['energy', 'hunger'], beast: true } }), npc('chr-m', npcSim('loc-a', 'work', [1, 9])), npc('chr-x', npcSim('loc-a', 'work', [1, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [young, wild] = spawnWild(state, world, 'cre-bal', [4, 4], 2, 'loc-a', ['G']);
  young.master = 'chr-m';
  young.stats.hunger = wild.stats.hunger = 90;
  await advance(state, world, 1);
  assert.ok(texts(state).some((t) => t.includes(`굶주린`) && t.includes('덮쳤다')));
  assert.equal(state.log.filter((e) => e.kind === 'combat' && e.text.includes('굶주린') && e.actors[0] === young.id).length, 0);
  assert.ok(state.log.some((e) => e.kind === 'combat' && e.text.includes('굶주린') && e.actors[0] === wild.id));
});

test('swampwalk: one bonded with a swamp can\'t strike back at it, nor fly from it', async () => {
  const wraith = { ...npcSim('loc-a', 'work', [4, 2]), needs: ['energy'], beast: true, abilities: ['swampwalk'] };
  const world = fixture([loc('loc-swamp', 12, 10, 'swamp'), npc('chr-w', wraith), npc('chr-x', npcSim('loc-a', 'work', [3, 9])), npc('chr-f', { ...npcSim('loc-a', 'work', [3, 9]), abilities: ['fly'] })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [w, x, f] = [state.actors['chr-w'], state.actors['chr-x'], state.actors['chr-f']];
  x.bonds = ['loc-swamp'];
  f.bonds = ['loc-swamp'];
  addFoe(w, 'chr-x', state.minutes);
  let asked = 0;
  await advance(state, world, 1, { evade: async () => (asked++, true) });
  assert.equal(woundsOf(x, state.minutes), 4);
  assert.equal(woundsOf(w, state.minutes), 0); // no blow back
  assert.ok(texts(state).some((t) => t.includes('늪을 걷는 적에게 맞서지 못한다')));
  // A flyer bonded with a swamp can't take to the air from it.
  x.region = 'loc-b';
  addFoe(w, 'chr-f', state.minutes);
  await advance(state, world, 1, { evade: async () => (asked++, true) });
  assert.equal(asked, 0);
  assert.equal(woundsOf(f, state.minutes), 4);
  // One with no swamp strikes back.
  f.bonds = [];
  x.bonds = [];
  assert.equal(landwalked(world, w, x, state.minutes), null);
});

test('forestwalk: one bonded with a forest can\'t strike back at it; a swamp is no forest', async () => {
  const guide = { ...npcSim('loc-a', 'work', [3, 3]), needs: ['energy'], beast: true, abilities: ['forestwalk'] };
  const world = fixture([loc('loc-wood', 12, 10, 'forest'), loc('loc-swamp', 14, 10, 'swamp'), npc('chr-g', guide), npc('chr-x', npcSim('loc-a', 'work', [3, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [g, x] = [state.actors['chr-g'], state.actors['chr-x']];
  x.bonds = ['loc-swamp'];
  assert.equal(landwalked(world, g, x, state.minutes), null);
  x.bonds = ['loc-wood'];
  assert.equal(landwalked(world, g, x, state.minutes), 'forest');
  addFoe(g, 'chr-x', state.minutes);
  await advance(state, world, 1);
  assert.equal(woundsOf(x, state.minutes), 3);
  assert.equal(woundsOf(g, state.minutes), 0); // no blow back
  assert.ok(texts(state).some((t) => t.includes('숲을 걷는 적에게 맞서지 못한다')));
});

test('the real Zendikar Farguide walks Bala Ged, forestwalking', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['cre-zendikar-farguide'];
  assert.equal(g?.region, 'loc-bala-ged');
  assert.ok(hasAbility(g, 'forestwalk', state.minutes));
  assert.ok(!npcDef(state, world, g.id)?.needs.includes('hunger'));
});

test('the real Bog Tatters drifts in Piranha Marsh, swampwalking', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const w = state.actors['cre-bog-tatters'];
  assert.equal(w?.region, 'loc-piranha-marsh');
  assert.ok(hasAbility(w, 'swampwalk', state.minutes));
});

test('the real Caravan Hurda hauls for Goma Fada, for 50 coin; the walking city is a mountain', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const h = state.actors['cre-hurda'];
  assert.equal(h?.region, 'loc-goma-fada');
  assert.ok(region(world, 'loc-goma-fada').wanders); // it walks Akoum
  assert.deepEqual(ptOf(h), [1, 5]);
  assert.ok(hasAbility(h, 'lifelink', state.minutes));
  assert.equal(hirePrice(world.npcs.find((x) => x.id === 'cre-hurda')!), 50);
  assert.deepEqual(landTypes(region(world, 'loc-goma-fada')), ['mountain']); // a walking mountain
});

test('a wandering place walks toward the stop the LLM picks, carries those in it, and journeys to it are as long as it is far today', async () => {
  const caravan: RawEntity = {
    id: 'loc-car',
    kind: 'location',
    name: '대상단',
    status: 'canon',
    map: { x: 10, y: 10, terrain: 'settlement', color: 'C' },
    sim: { not_land: true, wanders: { per_day: 24, stops: [{ name: '동쪽 길', x: 34, y: 10 }, { name: '서쪽 길', x: 10, y: 10 }] } },
  };
  const world = fixture([caravan, npc('chr-h', npcSim('loc-car'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const asked: (string | undefined)[] = [];
  const wander: Llm['wander'] = async ({ at, stops }) => (asked.push(at), stops.includes('동쪽 길') ? '동쪽 길' : stops[0]);
  await advance(state, world, 1, { wander });
  assert.deepEqual(asked, [undefined]);
  assert.equal(state.wanderers?.['loc-car']?.to, '동쪽 길');
  await advance(state, world, 12, { wander });
  const w = state.wanderers!['loc-car'];
  assert.ok(w.x > 20 && w.x < 24); // 1 a hour
  assert.equal(state.actors['chr-h'].region, 'loc-car'); // carried along
  // Travel to it is measured to where it is now.
  const placed = withPositions(state, world);
  assert.ok(distance(region(placed, 'loc-b'), region(placed, 'loc-car')) < distance(region(world, 'loc-b'), region(world, 'loc-car')));
  await advance(state, world, 13, { wander });
  assert.ok(texts(state).some((t) => t.includes('동쪽 길에 닿았다')));
  assert.equal(asked[1], '동쪽 길'); // at a stop, it picks the next
  assert.equal(state.wanderers!['loc-car'].to, '서쪽 길');
});

test('the real Goma Fada walks Akoum\'s roads', () => {
  const world = loadWorld();
  const r = region(world, 'loc-goma-fada');
  assert.equal(r.parent, undefined);
  assert.deepEqual(r.wanders?.stops.map((s) => s.name), ['로가 대로', '아쿰의 띠', '비탄의 고개']);
  assert.equal(r.notLand, undefined);
});

const pledge: RawEntity = {
  id: 'spl-p',
  kind: 'spell',
  name: '서약',
  status: 'canon',
  sim: { cost: '{1}', learn_at: 'loc-a', target: 'self', kicker: { mana: '{1}' }, effects: [{ type: 'create_retainers', creature: 'cre-ks', count: 2, kicked_count: 4, pt: [1, 1], colors: ['W'] }] },
};

test('a spell of one\'s own: soldiers born at the caster\'s side as retainers; a mana kicker doubles them', async () => {
  const world = fixture([pledge, lore('cre-ks', 'creature')]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.spells = ['spl-p'];
  p.bonds = ['loc-a'];
  assert.match(castBlocked(state, world, p, 'spl-p', p.id, true, state.minutes)!, /킥커까지/); // 1 mana: no kicker
  await act(state, world, { type: 'cast', spell: 'spl-p', to: p.id, kick: false });
  const mine = () => Object.values(state.actors).filter((a) => a.master === PLAYER_ID);
  assert.equal(mine().length, 2);
  assert.ok(texts(state).some((t) => t.includes('2명이 나타나') && t.includes('서약했다')));
  // Two lands: the kicked one.
  const s2 = character(world, 'loc-a');
  const p2 = s2.actors[PLAYER_ID];
  p2.spells = ['spl-p'];
  p2.bonds = ['loc-a', 'loc-b'];
  assert.equal(castBlocked(s2, world, p2, 'spl-p', p2.id, true, s2.minutes), null);
  await act(s2, world, { type: 'cast', spell: 'spl-p', to: p2.id, kick: true });
  assert.equal(Object.values(s2.actors).filter((a) => a.master === PLAYER_ID).length, 4);
  assert.ok(texts(s2).some((t) => t.includes('킥커 {1}')));
  // An NPC casts it as they finish readying it, kicked if they can pay.
  const w3 = fixture([pledge, lore('cre-ks', 'creature'), npc('chr-c', { ...npcSim('loc-a'), mana: { W: 2 } })]);
  const s3 = newState(w3, { seed: 1, mode: 'observer' });
  s3.actors['chr-c'].spells = ['spl-p'];
  readyCast(s3, w3, s3.actors['chr-c'], 'spl-p', s3.minutes);
  assert.equal(Object.values(s3.actors).filter((a) => a.master === 'chr-c').length, 4);
  assert.equal(s3.choices?.length ?? 0, 0); // no one to pick
});

test('the real Conqueror\'s Pledge is taught in Ondu: six Kor Soldiers, twelve kicked for {6}', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-conquerors-pledge')!;
  assert.equal(s.learnAt, 'loc-ondu');
  assert.equal(s.target, 'self');
  assert.equal(s.kicker?.manaText, '{6}');
  assert.deepEqual(s.effects[0], { type: 'create_retainers', creature: 'cre-kor-soldier', count: 6, kicked_count: 12, pt: [1, 1], colors: ['W'] });
});

const desecrate: RawEntity = {
  id: 'spl-d',
  kind: 'spell',
  name: '더럽힘',
  status: 'canon',
  sim: { cost: '{1}', learn_at: 'loc-a', effects: [{ type: 'destroy_land' }, { type: 'discard' }] },
};

test('desecrated earth: the target\'s latest land is destroyed (its destroyed events answer), and they let go of a spell of their pick', async () => {
  const snakes: RawEntity = {
    id: 'evt-sn',
    kind: 'event',
    name: '뱀 함정',
    status: 'canon',
    sim: { region: 'loc-c', trigger: 'destroyed', text: '뱀들이 쏟아졌다.', effects: [{ type: 'create', creature: 'cre-sn', count: 1, pt: [1, 1], colors: ['G'] }] },
  };
  const world = fixture([desecrate, tribute('loc-a'), mantle, lore('cre-v', 'creature'), lore('cre-sn', 'creature'), snakes, npc('chr-x', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const [p, x] = [state.actors[PLAYER_ID], state.actors['chr-x']];
  p.spells = ['spl-d'];
  p.bonds = ['loc-a'];
  p.pt = [0, 30]; // x turns on them for it
  assert.match(castBlocked(state, world, p, 'spl-d', 'chr-x', false, state.minutes)!, /부술 땅/);
  x.bonds = ['loc-b', 'loc-c'];
  x.spells = ['spl-t', 'spl-m'];
  const asked: string[][] = [];
  await act(state, world, { type: 'cast', spell: 'spl-d', to: 'chr-x', kick: false }, { discard: async ({ spells }) => (asked.push(spells.map((s) => s.id)), 'spl-m') });
  assert.ok(state.regions['loc-c']?.destroyed);
  assert.equal(state.regions['loc-b']?.destroyed, undefined);
  assert.ok(texts(state).some((t) => t.includes('뱀들이 쏟아졌다'))); // destroyed by someone: its trap answers
  await act(state, world, { type: 'wait', hours: 1 }, { discard: async ({ spells }) => (asked.push(spells.map((s) => s.id)), 'spl-m') });
  assert.deepEqual(asked, [['spl-t', 'spl-m']]);
  assert.deepEqual(x.spells, ['spl-t']);
  assert.deepEqual(x.graveyard, ['spl-m']);
});

test('desecrated earth on the player: they pick which spell to let go of', async () => {
  const world = fixture([desecrate, tribute('loc-a'), mantle, lore('cre-v', 'creature'), npc('chr-c', { ...npcSim('loc-a'), mana: { B: 1 } })]);
  const state = character(world, 'loc-a');
  const [p, c] = [state.actors[PLAYER_ID], state.actors['chr-c']];
  p.bonds = ['loc-b'];
  p.spells = ['spl-t', 'spl-m'];
  c.spells = ['spl-d'];
  castSpell(state, world, c, 'spl-d', PLAYER_ID, false, state.minutes);
  assert.ok(state.regions['loc-b']?.destroyed);
  await act(state, world, { type: 'wait', hours: 1 });
  assert.equal(state.asks?.[0]?.effect.type, 'discard');
  assert.match(askText(state, world, state.asks![0]), /주문 하나를 잊어야/);
  await act(state, world, { type: 'choose', pick: 'spl-t' });
  assert.deepEqual(p.spells, ['spl-m']);
});

test('the real Desecrated Earth is taught in Agadeem\'s Crypt', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-desecrated-earth')!;
  assert.equal(s.learnAt, 'loc-agadeem-crypt');
  assert.deepEqual(s.effects.map((e) => e.type), ['destroy_land', 'discard']);
});

const monument: RawEntity = {
  id: 'itm-mon',
  kind: 'item',
  name: '기념비',
  status: 'canon',
  sim: { cost: '{0}', at: 'loc-a', effects: [{ type: 'anthem', pt: [1, 1], abilities: ['fly', 'indestructible'] }, { type: 'upkeep_sacrifice' }] },
};

test('an Eldrazi Monument: its owner\'s creatures (themselves too, a creature card) are blessed; each midnight one is given, their pick', async () => {
  const world = fixture([monument, npc('chr-o', npcSim('loc-a', 'work', [2, 2])), npc('chr-r1', npcSim('loc-a', 'work', [1, 1])), npc('chr-r2', npcSim('loc-a', 'work', [1, 1])), npc('chr-x', npcSim('loc-a', 'work', [1, 1]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [o, r1, r2, x] = ['chr-o', 'chr-r1', 'chr-r2', 'chr-x'].map((id) => state.actors[id]);
  r1.master = r2.master = 'chr-o';
  state.items = { 'itm-mon': { name: '기념비', owner: 'chr-o', counters: 0 } };
  await advance(state, world, 1);
  for (const a of [o, r1, r2]) {
    assert.deepEqual(ptOf(a), a === o ? [3, 3] : [2, 2]);
    assert.ok(hasAbility(a, 'fly', state.minutes) && hasAbility(a, 'indestructible', state.minutes));
  }
  assert.equal(ptOf(x)[1], 1);
  // Lethal damage leaves them standing.
  (await import('./combat.ts')).dealDamage(state, r1, 5, state.minutes, '시험');
  assert.equal(r1.dead, undefined);
  // Midnight: the owner gives one.
  const asked: string[][] = [];
  state.minutes = 1440 - 60;
  await advance(state, world, 2, { choose: async ({ npc, candidates }) => (asked.push([npc.id, ...candidates.map((c) => c.id).sort()]), 'chr-r2') });
  assert.deepEqual(asked, [['chr-o', 'chr-o', 'chr-r1', 'chr-r2']]);
  assert.ok(r2.dead);
  assert.ok(texts(state).some((t) => t.includes('기념비에 바쳐졌다')));
  // Released from it (the owner lost it), the blessing leaves them.
  state.items['itm-mon'].owner = undefined;
  await advance(state, world, 1);
  assert.equal(hasAbility(r1, 'fly', state.minutes), false);
  assert.deepEqual(ptOf(o), [2, 2]);
});

test('an Eldrazi Monument whose owner has nothing to give crumbles away; the player picks from theirs', async () => {
  const world = fixture([monument, npc('chr-r', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  state.items = { 'itm-mon': { name: '기념비', owner: PLAYER_ID, counters: 0 } };
  state.minutes = 1440 - 60;
  await act(state, world, { type: 'wait', hours: 2 });
  assert.equal(state.items['itm-mon'].gone, true); // the player is no creature, and has no retainer
  assert.match(claimBlocked(state, world, p, 'itm-mon', state.minutes)!, /그런 것은 없다/);
  // With a retainer: the player gives it.
  const s2 = character(world, 'loc-a');
  s2.actors['chr-r'].master = PLAYER_ID;
  s2.items = { 'itm-mon': { name: '기념비', owner: PLAYER_ID, counters: 0 } };
  s2.minutes = 1440 - 60;
  await act(s2, world, { type: 'wait', hours: 2 });
  assert.equal(s2.asks?.[0]?.effect.type, 'sacrifice');
  await act(s2, world, { type: 'choose', pick: 'chr-r' });
  assert.ok(s2.actors['chr-r'].dead);
});

test('the real Eldrazi Monument sits in Emeria', () => {
  const world = loadWorld();
  const m = world.items.find((x) => x.id === 'itm-eldrazi-monument')!;
  assert.equal(m.at, 'loc-emeria');
  assert.deepEqual(m.effects.map((e) => e.type), ['anthem', 'upkeep_sacrifice']);
});

test('landfall grant: bonding with a land, it flies until midnight', async () => {
  const glider = planned({ id: 'cre-gg', kind: 'creature', name: '활공자', status: 'canon', sim: { pt: [4, 4], role: 'r', home: 'loc-a', persona: 'p', goal: 'g', needs: ['energy'], beast: true, landfall_grant: ['fly'], plan: [['00:00', '06:00', 'loc-a', 'leisure', '쉼', '🔥'], ['06:00', '10:00', 'loc-a', 'bond', '땅을 차지', '🔥'], ['10:00', '24:00', 'loc-a', 'leisure', '쉼', '🔥']] } });
  const world = fixture([glider]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['cre-gg'];
  assert.equal(hasAbility(g, 'fly', state.minutes), false);
  await advance(state, world, 4);
  assert.ok(hasAbility(g, 'fly', state.minutes));
  await advance(state, world, 15); // through 00:00
  assert.equal(hasAbility(g, 'fly', state.minutes), false);
});

test('the real Geyser Glider hunts in the Makindi Trenches, Ondu\'s canyons: plains', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['cre-geyser-glider'];
  assert.equal(g?.region, 'loc-makindi');
  assert.deepEqual(world.npcs.find((x) => x.id === 'cre-geyser-glider')?.landfallGrant, ['fly']);
  const mk = region(world, 'loc-makindi');
  assert.equal(mk.parent, 'loc-ondu');
  assert.deepEqual(landTypes(mk), ['plains']);
});

const giant: RawEntity = {
  id: 'spl-g',
  kind: 'spell',
  name: '거대화',
  status: 'canon',
  sim: { cost: '{1}', learn_at: 'loc-a', target: 'any_here', kicker: { mana: '{1}' }, effects: [{ type: 'aura', base_pt: [8, 8], abilities: ['trample'] }, { type: 'copy_if_kicked' }] },
};

test('gigantiform: base 8/8 and trample, other bonuses on top; kicked, one more free on someone else, the caster\'s pick', async () => {
  const world = fixture([giant, npc('chr-x', npcSim('loc-a')), npc('chr-y', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const [p, x] = [state.actors[PLAYER_ID], state.actors['chr-x']];
  p.spells = ['spl-g'];
  p.bonds = ['loc-a', 'loc-b'];
  p.plusCounters = 1;
  await act(state, world, { type: 'cast', spell: 'spl-g', to: p.id, kick: true });
  assert.deepEqual(ptOf(p), [9, 9]); // base 8/8, +1/+1 counter on top
  assert.ok(p.abilities.includes('trample'));
  await act(state, world, { type: 'wait', hours: 1 });
  assert.equal(state.asks?.[0]?.effect.type, 'cast');
  assert.deepEqual(askOptions(state, world, state.asks![0]).map((o) => o.pick), [...state.asks![0].candidates, null]);
  assert.ok(!state.asks![0].candidates.includes(PLAYER_ID)); // someone else
  await act(state, world, { type: 'choose', pick: 'chr-x' });
  assert.deepEqual(ptOf(x), [8, 8]);
  // Unkicked: no second.
  const s2 = character(world, 'loc-a');
  const p2 = s2.actors[PLAYER_ID];
  p2.spells = ['spl-g'];
  p2.bonds = ['loc-a'];
  await act(s2, world, { type: 'cast', spell: 'spl-g', to: 'chr-y', kick: false });
  await act(s2, world, { type: 'wait', hours: 1 });
  assert.equal(s2.asks?.length ?? 0, 0);
  assert.deepEqual(ptOf(s2.actors['chr-y']), [8, 8]);
});

test('the real Gigantiform is taught in Oran-Rief', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-gigantiform')!;
  assert.equal(s.learnAt, 'loc-oran-rief');
  assert.equal(s.kicker?.manaText, '{4}');
});

test('an Ally with a life-draining rally: hired, the player picks one there to lose life equal to the party\'s Allies', async () => {
  const ogre = { ...npcSim('loc-a', 'work', [3, 2]), mana: { B: 5 }, ally: true, hireable: true, rally: [{ type: 'lose_life_allies' }] };
  const world = fixture([npc('chr-o', ogre), npc('chr-x', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.stats.coin = 60;
  await act(state, world, { type: 'hire', to: 'chr-o' });
  assert.equal(state.actors['chr-o'].master, PLAYER_ID);
  assert.equal(p.stats.coin, 10);
  assert.equal(state.asks?.[0]?.effect.type, 'rally');
  assert.match(askText(state, world, state.asks![0]), /생명 1을 잃는다/);
  await act(state, world, { type: 'choose', pick: 'chr-x' });
  assert.equal(state.actors['chr-x'].life, 19);
  assert.ok(texts(state).some((t) => t.includes('저주를 퍼부었다')));
});

test('the real Hagra Diabolist lives in the Hagra swamp of Guul Draz, for 50 coin', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const o = state.actors['chr-hagra-diabolist'];
  assert.equal(o?.region, 'loc-hagra');
  assert.equal(region(world, 'loc-hagra').parent, 'loc-guul-draz');
  assert.deepEqual(landTypes(region(world, 'loc-hagra')), ['swamp']); // a swamp
  const def = world.npcs.find((x) => x.id === 'chr-hagra-diabolist')!;
  assert.equal(hirePrice(def), 50);
  assert.deepEqual(def.rally, [{ type: 'lose_life_allies' }]);
});

test('intimidate: one who shares none of its colors can\'t strike back at it, nor fly from it', async () => {
  const demon = { ...npcSim('loc-a', 'work', [6, 3]), mana: { B: 5 }, needs: ['energy'], beast: true, abilities: ['intimidate'] };
  const world = fixture([loc('loc-swamp', 12, 10, 'swamp'), npc('chr-d', demon), npc('chr-x', npcSim('loc-a', 'work', [3, 9])), npc('chr-f', { ...npcSim('loc-a', 'work', [3, 9]), abilities: ['fly'] })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [d, x, f] = [state.actors['chr-d'], state.actors['chr-x'], state.actors['chr-f']];
  assert.deepEqual(actorColors(state, world, d), ['B']);
  assert.deepEqual(actorColors(state, world, x), []);
  addFoe(d, 'chr-x', state.minutes);
  let asked = 0;
  await advance(state, world, 1, { evade: async () => (asked++, true) });
  assert.equal(woundsOf(x, state.minutes), 6);
  assert.equal(woundsOf(d, state.minutes), 0); // no blow back
  assert.ok(texts(state).some((t) => t.includes('흑의 기운이 없어 위협하는 적에게 맞서지 못한다')));
  // A flyer with no black can't take to the air from it.
  x.region = 'loc-b';
  addFoe(d, 'chr-f', state.minutes);
  await advance(state, world, 1, { evade: async () => (asked++, true) });
  assert.equal(asked, 0);
  assert.equal(woundsOf(f, state.minutes), 6);
  // One bonded with a black land (a swamp) shares its color: they block.
  x.bonds = ['loc-swamp'];
  assert.deepEqual(actorColors(state, world, x), ['B']);
  assert.equal(intimidated(state, world, d, x, state.minutes), false);
  assert.equal(unblockable(state, world, d, x, state.minutes), null);
  // An artifact creature blocks it, colors or not.
  x.bonds = [];
  (world.npcs.find((n) => n.id === 'chr-x')!).types = ['artifact'];
  assert.equal(intimidated(state, world, d, x, state.minutes), false);
});

test('first strike: one who has it strikes first, and one it fells never strikes back; both have it, simultaneous', () => {
  const fs = (pt: [number, number]) => ({ ...npcSim('loc-a', 'work', pt), needs: ['energy'], abilities: ['first_strike'] });
  const world = fixture([npc('chr-s', fs([3, 3])), npc('chr-s2', fs([3, 3])), npc('chr-x', npcSim('loc-a', 'work', [3, 3])), npc('chr-y', npcSim('loc-a', 'work', [3, 3])), npc('chr-big', npcSim('loc-a', 'work', [2, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [s, s2, x, y, big] = ['chr-s', 'chr-s2', 'chr-x', 'chr-y', 'chr-big'].map((id) => state.actors[id]);
  const t = state.minutes;
  // It attacks: its blow fells the other first.
  clash(state, world, s, x, t);
  assert.ok(knockedOut(x));
  assert.equal(woundsOf(s, t), 0);
  assert.ok(texts(state).some((l) => l.includes('먼저 쳐') && l.includes('선제공격')));
  // It is attacked: the attacker falls before its blow lands.
  clash(state, world, y, s2, t);
  assert.ok(knockedOut(y));
  assert.equal(woundsOf(s2, t), 0);
  // One it doesn't fell strikes back.
  clash(state, world, big, s, t);
  assert.equal(woundsOf(big, t), 3);
  assert.equal(woundsOf(s, t), 2);
  // Both have it: simultaneous.
  s.forced = undefined;
  const [a1, b1] = [state.actors['chr-s'], state.actors['chr-s2']];
  a1.wounds = undefined; b1.wounds = undefined;
  clash(state, world, a1, b1, t + 60);
  assert.ok(knockedOut(a1) && knockedOut(b1));
});

test('the real Sky Ruin Drake hunts about Emeria, the sky ruin, a flying beast', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const d = state.actors['cre-sky-ruin-drake'];
  assert.equal(d.region, 'loc-emeria');
  assert.ok(hasAbility(d, 'fly', state.minutes));
  assert.ok(npcDef(state, world, d.id)?.beast);
  assert.deepEqual(needsOf(d), ['energy', 'hunger']);
});

test('caught asleep: one sleeping can\'t strike back (nor fly) the first exchange; vigilance is never caught asleep', () => {
  const world = fixture([npc('chr-a', npcSim('loc-a', 'work', [2, 9])), npc('chr-x', npcSim('loc-a', 'work', [2, 9])), npc('chr-v', { ...npcSim('loc-a', 'work', [2, 9]), abilities: ['vigilance', 'fly'] })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [a, x, v] = ['chr-a', 'chr-x', 'chr-v'].map((id) => state.actors[id]);
  const t = state.minutes;
  const sleep = { kind: 'sleep' as const, activity: '잠', emoji: '💤' };
  x.task = { ...sleep };
  v.task = { ...sleep };
  assert.equal(unblockable(state, world, a, x, t), '잠든 채 덮쳐져');
  clash(state, world, a, x, t, unblockable(state, world, a, x, t));
  assert.equal(woundsOf(a, t), 0);
  assert.ok(texts(state).some((l) => l.includes('잠든 채 덮쳐져 맞서지 못한다')));
  // Awake to them now: the next exchange, they strike back.
  assert.equal(unblockable(state, world, a, x, t + 60), null);
  clash(state, world, a, x, t + 60, unblockable(state, world, a, x, t + 60));
  assert.equal(woundsOf(a, t + 60), 2);
  // Vigilance: never caught asleep.
  assert.equal(unblockable(state, world, a, v, t), null);
});

test('the real Shepherd of the Lost keeps Emeria: a 3/3 Angel with flying, first strike, vigilance', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const s = state.actors['cre-shepherd-of-the-lost'];
  assert.equal(s.region, 'loc-emeria');
  for (const ab of ['fly', 'first_strike', 'vigilance'] as const) assert.ok(hasAbility(s, ab, state.minutes));
  assert.deepEqual(npcDef(state, world, s.id)?.types, ['angel']);
});

test('enter_destroy: arriving where an Angel is, the hunter may destroy it; shroud and indestructible are spared', async () => {
  const hunter = { ...npcSim('loc-c', 'work', [6, 3]), home: 'loc-a', mana: { B: 5 }, needs: ['energy'], types: ['demon'], enter_destroy: 'angel' };
  const angel = (extra: object = {}) => ({ ...npcSim('loc-c', 'work', [7, 7]), needs: ['energy'], types: ['angel'], ...extra });
  const world = fixture([npc('chr-h', hunter), npc('chr-an', angel()), npc('chr-sh', angel({ abilities: ['shroud'] })), npc('chr-y', npcSim('loc-c', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['chr-h'].region, 'loc-a');
  const asked: string[][] = [];
  await advance(state, world, 3, { choose: async ({ candidates, optional }) => (asked.push(candidates.map((c) => c.id)), assert.ok(optional), 'chr-an') });
  assert.equal(state.actors['chr-h'].region, 'loc-c');
  assert.deepEqual(asked, [['chr-an']]); // not the shrouded one, not a non-angel
  assert.ok(state.actors['chr-an'].dead);
  assert.ok(!state.actors['chr-sh'].dead);
  // Indestructible: not destroyed.
  const t = state.minutes;
  const g = state.actors['chr-sh'];
  g.abilities = ['indestructible'];
  applyEnterDestroy(state, world, state.actors['chr-h'], g, t);
  assert.ok(!g.dead);
  // Once a day: the first arrival only (it already came today).
  state.choices = [];
  g.abilities = [];
  put(world, g, 'loc-b');
  callForth(state, world, 'chr-h', 'loc-b', [], t);
  assert.equal(state.choices.length, 0);
  // Brought there by a trap on another day, it answers.
  callForth(state, world, 'chr-h', 'loc-b', [], t + 24 * 60);
  assert.equal(state.choices.at(-1)?.effect.type, 'destroy');
});

test('the real Halo Hunter lairs in Tazeem below Emeria, intimidating, hunting Iona the Angel', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const h = state.actors['cre-halo-hunter'];
  assert.equal(h.region, 'loc-tazeem');
  assert.ok(hasAbility(h, 'intimidate', state.minutes));
  assert.equal(npcDef(state, world, h.id)?.enterDestroy, 'angel');
  assert.deepEqual(npcDef(state, world, 'chr-iona')?.types, ['angel']);
});

test('a sealed color is sealed itself: a being of it has no powers against the sealer, its lands only give mana', () => {
  const iona = { ...npcSim('loc-a', 'work', [7, 7]), needs: ['energy'], mana: { W: 9 }, seal: true, types: ['angel'] };
  const demon = { ...npcSim('loc-a', 'work', [6, 3]), needs: ['energy'], mana: { B: 5 }, abilities: ['intimidate', 'fly'], enter_destroy: 'angel' };
  const world = fixture([loc('loc-swamp', 12, 10, 'swamp'), npc('chr-io', iona), npc('chr-d', demon), npc('chr-d2', demon)]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [io, d, d2] = [state.actors['chr-io'], state.actors['chr-d'], state.actors['chr-d2']];
  const t = state.minutes;
  addFoe(io, 'chr-d', t);
  setSeal(state, world, io, 'B', t);
  assert.ok(texts(state).some((x) => x.includes('흑색의 주문도 힘도 쓸 수 없다')));
  // Keywords gone, triggers off.
  assert.ok(powersSealed(state, world, d, t));
  assert.equal(hasAbility(d, 'fly', t), false);
  assert.equal(hasAbility(d, 'intimidate', t), false);
  assert.equal(unblockable(state, world, d, io, t), null);
  state.choices = [];
  enterDestroy(state, world, d, t);
  assert.equal(state.choices.length, 0);
  // One not fighting her keeps theirs.
  assert.ok(hasAbility(d2, 'fly', t));
  enterDestroy(state, world, d2, t);
  assert.equal(state.choices.length, 1);
  // A black land does nothing for him but give mana; a land of another color still does.
  assert.ok(landSealed(state, d, region(world, 'loc-swamp'), t));
  assert.equal(landSealed(state, d, region(world, 'loc-a'), t), undefined);
  // Until midnight.
  assert.ok(hasAbility(d, 'fly', t + 24 * 60));
});

test('an Ally\'s war cry: each Ally joining puts a +1/+1 counter on every Ally of the party, not other retainers', async () => {
  const minotaur = { ...npcSim('loc-a', 'work', [3, 3]), mana: { R: 5 }, ally: true, hireable: true, rally: [{ type: 'counters_allies' }] };
  const ogre = { ...npcSim('loc-a', 'work', [3, 2]), mana: { B: 5 }, ally: true, hireable: true, rally: [{ type: 'lose_life_allies' }] };
  const world = fixture([npc('chr-m', minotaur), npc('chr-o', ogre), npc('chr-x', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  const [m, o, x] = [state.actors['chr-m'], state.actors['chr-o'], state.actors['chr-x']];
  x.master = PLAYER_ID; // one who serves, no Ally
  p.stats.coin = 100;
  await act(state, world, { type: 'hire', to: 'chr-m' });
  assert.equal(m.plusCounters, 1);
  assert.deepEqual(ptOf(m), [4, 4]);
  assert.equal(state.asks?.length ?? 0, 0); // nothing to pick
  await act(state, world, { type: 'hire', to: 'chr-o' });
  assert.equal(m.plusCounters, 2);
  assert.equal(o.plusCounters, 1);
  assert.equal(x.plusCounters, undefined);
  assert.equal(p.plusCounters, undefined);
  assert.ok(texts(state).some((t) => t.includes('함성에 무리의 동료들이 힘을 얻었다')));
  // The ogre's curse still asks whom.
  assert.equal(state.asks?.[0]?.effect.type, 'rally');
  assert.doesNotMatch(askText(state, world, state.asks![0]), /함성/);
});

test('the real Kazuul Warlord lives on Kazuul\'s Cliffs, a mountain in Murasa, for 50 coin', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['chr-kazuul-warlord']?.region, 'loc-kazuul-cliffs');
  assert.equal(region(world, 'loc-kazuul-cliffs').parent, 'loc-murasa');
  assert.deepEqual(landTypes(region(world, 'loc-kazuul-cliffs')), ['mountain']);
  const def = world.npcs.find((x) => x.id === 'chr-kazuul-warlord')!;
  assert.equal(hirePrice(def), 50);
  assert.deepEqual(def.rally, [{ type: 'counters_allies' }]);
});

test('goblins grow with the crowd: each Ally joining puts a +1/+1 counter on the grunts only', async () => {
  const grunts = { ...npcSim('loc-a', 'work', [2, 2]), mana: { R: 5 }, ally: true, hireable: true, abilities: ['haste'], rally: [{ type: 'counter_self' }] };
  const other = { ...npcSim('loc-a', 'work', [3, 3]), mana: { R: 5 }, ally: true, hireable: true };
  const world = fixture([npc('chr-g', grunts), npc('chr-o', other)]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  const [g, o] = [state.actors['chr-g'], state.actors['chr-o']];
  p.stats.coin = 100;
  await act(state, world, { type: 'hire', to: 'chr-g' });
  assert.equal(g.plusCounters, 1);
  assert.equal(state.asks?.length ?? 0, 0); // nothing to pick
  await act(state, world, { type: 'hire', to: 'chr-o' });
  assert.equal(g.plusCounters, 2);
  assert.equal(o.plusCounters, undefined);
  assert.deepEqual(ptOf(g), [4, 4]);
  assert.ok(texts(state).some((t) => t.includes('더 사나워졌다')));
});

test('the real Tuktuk Grunts roam Akoum, hasty goblin Allies for 50 coin', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['chr-tuktuk-grunts']?.region, 'loc-akoum');
  const def = world.npcs.find((x) => x.id === 'chr-tuktuk-grunts')!;
  assert.equal(hirePrice(def), 50);
  assert.ok(def.ally && def.abilities.includes('haste'));
  assert.deepEqual(def.rally, [{ type: 'counter_self' }]);
});

test('a ranger calls a wolf: each Ally joining brings a 2/2 green Wolf to the controller, and the ranger grows', async () => {
  const ranger = { ...npcSim('loc-a', 'work', [2, 2]), mana: { G: 5 }, ally: true, hireable: true, rally: [{ type: 'token_counter', creature: 'cre-w', pt: [2, 2], colors: ['G'] }] };
  const other = { ...npcSim('loc-a', 'work', [3, 3]), mana: { R: 5 }, ally: true, hireable: true };
  const world = fixture([lore('cre-w', 'creature'), npc('chr-r', ranger), npc('chr-o', other)]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  const r = state.actors['chr-r'];
  p.stats.coin = 100;
  await act(state, world, { type: 'hire', to: 'chr-r' });
  await act(state, world, { type: 'hire', to: 'chr-o' });
  assert.equal(r.plusCounters, 2);
  const wolves = retainersOf(state, PLAYER_ID).filter((x) => state.tokens?.[x.id]?.creature === 'cre-w');
  assert.equal(wolves.length, 2);
  assert.deepEqual(ptOf(wolves[0]), [2, 2]);
  assert.equal(state.asks?.length ?? 0, 0);
  assert.ok(texts(state).some((t) => t.includes('의 부름에') && t.includes('권속')));
  // A rally with no such creature is bad data.
  const bad = buildWorld([loc('loc-a', 10, 10, 'grassland'), npc('chr-r', ranger)]);
  assert.ok(bad.errors.some((e) => e.includes('rally: creature cre-w 가 없음')));
});

test('the real Turntimber Ranger rides the Turntimber Grove, calling wolves, for 50 coin', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['chr-turntimber-ranger']?.region, 'loc-turntimber-grove');
  const def = world.npcs.find((x) => x.id === 'chr-turntimber-ranger')!;
  assert.equal(hirePrice(def), 50);
  assert.deepEqual(def.rally, [{ type: 'token_counter', creature: 'cre-wolf', pt: [2, 2], colors: ['G'] }]);
});

test('a ritual of the land: the caster gains 2 life for each plains they hold (not a destroyed one); an NPC too', async () => {
  const ritual: RawEntity = { id: 'spl-r', kind: 'spell', name: '의식', status: 'canon', sim: { cost: '{1}', learn_at: 'loc-a', target: 'self', effects: [{ type: 'gain_life_per_land', land: 'plains', amount: 2 }] } };
  const world = fixture([ritual, loc('loc-p2', 14, 10, 'grassland'), npc('chr-c', { ...npcSim('loc-a'), mana: { W: 1 } })]);
  assert.deepEqual(landTypes(region(world, 'loc-a')), ['plains']);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.spells = ['spl-r'];
  p.bonds = ['loc-a', 'loc-p2', 'loc-b']; // two plains, a forest
  state.regions['loc-p2'] = { conditions: [], destroyed: { at: 0, source: 'x', until: 99999 } };
  await act(state, world, { type: 'cast', spell: 'spl-r', to: p.id, kick: false });
  assert.equal(lifeOf(p), 22); // one standing plains
  // No plains: nothing.
  const c = state.actors['chr-c'];
  c.spells = ['spl-r'];
  readyCast(state, world, c, 'spl-r', state.minutes);
  assert.equal(lifeOf(c), 20);
  assert.ok(texts(state).some((t) => t.includes('평원과 이어져 있지 않아')));
});

test('the real Landbind Ritual is taught on the Arid Mesa of Ondu: 2 life per plains', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-landbind-ritual')!;
  assert.equal(s.learnAt, 'loc-arid-mesa');
  assert.equal(s.target, 'self');
  assert.deepEqual(s.effects, [{ type: 'gain_life_per_land', land: 'plains', amount: 2 }]);
});

test('enter_drain: on the first arrival of the day, all others there lose life per Vampire of her side; her controller gains it', async () => {
  const witch = { ...npcSim('loc-c', 'work', [4, 4]), home: 'loc-a', mana: { B: 5 }, needs: ['energy'], creature: 'cre-v', enter_drain: { per: 'cre-v' } };
  const world = fixture([lore('cre-v', 'creature'), npc('chr-w', witch), npc('chr-v', { ...npcSim('loc-c'), creature: 'cre-v' }), npc('chr-x', npcSim('loc-c')), npc('chr-y', npcSim('loc-c'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [w, v, x, y] = [state.actors['chr-w'], state.actors['chr-v'], state.actors['chr-x'], state.actors['chr-y']];
  v.master = 'chr-w'; // a Vampire of her side
  v.region = 'loc-a';
  await advance(state, world, 2);
  assert.equal(w.region, 'loc-c');
  // Two Vampires (herself and hers): x and y lose 2 each, she gains 4. Hers is spared.
  assert.equal(lifeOf(x), 18);
  assert.equal(lifeOf(y), 18);
  assert.equal(lifeOf(w), 24);
  assert.ok(texts(state).some((t) => t.includes('생명 2씩을 빨아들인다')));
  assert.ok(texts(state).some((t) => t.includes('chr-x가 chr-w를 공격했다'))); // it took her for a foe
  // Once a day.
  onEnter(state, world, w, state.minutes);
  assert.equal(lifeOf(x), 18);
});

test('protection from white: white does not hurt her, block her, nor pick her', async () => {
  const witch = { ...npcSim('loc-a', 'work', [4, 4]), mana: { B: 5 }, needs: ['energy'], protection: ['W'] };
  const white = (pt: number[]) => ({ ...npcSim('loc-a', 'work', pt), mana: { W: 3 }, needs: ['energy'] });
  const mantle: RawEntity = { id: 'spl-wm', kind: 'spell', name: '백색 오라', status: 'canon', sim: { cost: '{W}', learn_at: 'loc-a', target: 'any_here', effects: [{ type: 'aura', pt: [1, 1] }] } };
  const world = fixture([mantle, npc('chr-w', witch), npc('chr-k', white([5, 9])), npc('chr-g', { ...npcSim('loc-a', 'work', [2, 9]), mana: { G: 2 }, needs: ['energy'] })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [w, k, g] = [state.actors['chr-w'], state.actors['chr-k'], state.actors['chr-g']];
  const t = state.minutes;
  assert.deepEqual(w.protection, ['W']);
  // A white one strikes her: no damage. She strikes it: it can't strike back.
  clash(state, world, k, w, t);
  assert.equal(woundsOf(w, t), 0);
  assert.ok(texts(state).some((x) => x.includes('백색으로부터 보호받아')));
  assert.match(unblockable(state, world, w, k, t)!, /백색이라/);
  assert.equal(unblockable(state, world, w, g, t), null);
  // A white spell can't pick her; the player bonded with plains is white too.
  assert.equal(targetable(w, t, ['W']), false);
  assert.equal(targetable(w, t, ['G']), true);
  const s2 = character(world, 'loc-a');
  const p = s2.actors[PLAYER_ID];
  p.spells = ['spl-wm'];
  p.bonds = ['loc-a'];
  assert.match(castBlocked(s2, world, p, 'spl-wm', 'chr-w', false, s2.minutes)!, /백색으로부터 보호받아 대상이 될 수 없다/);
  assert.equal(castTargets(s2, p, world.spells.find((x) => x.id === 'spl-wm')!).some((x) => x.id === 'chr-w'), false);
});

test('the real Malakir Bloodwitch flies over Malakir, a Vampire shielded from white', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const w = state.actors['chr-malakir-bloodwitch'];
  assert.equal(w.region, 'loc-malakir');
  assert.ok(hasAbility(w, 'fly', state.minutes));
  assert.deepEqual(w.protection, ['W']);
  assert.deepEqual(npcDef(state, world, w.id)?.enterDrain, { per: 'cre-vampire' });
  assert.equal(npcDef(state, world, w.id)?.creature, 'cre-vampire');
});

const sludge: RawEntity = { id: 'spl-s', kind: 'spell', name: '오물', status: 'canon', sim: { cost: '{1}', learn_at: 'loc-a', effects: [{ type: 'discard_per_land', land: 'swamp' }] } };

test('mind sludge: the target lets go of a spell for each swamp the caster holds, one pick at a time', async () => {
  const world = fixture([sludge, desecrate, tribute('loc-a'), mantle, lore('cre-v', 'creature'), loc('loc-s1', 12, 10, 'swamp'), loc('loc-s2', 14, 10, 'swamp'), npc('chr-x', npcSim('loc-a')), npc('chr-c', { ...npcSim('loc-a'), mana: { B: 1 } })]);
  // The player casts it on an NPC: the LLM picks twice, from what is left.
  const state = character(world, 'loc-a');
  const [p, x] = [state.actors[PLAYER_ID], state.actors['chr-x']];
  p.spells = ['spl-s'];
  p.bonds = ['loc-a', 'loc-s1', 'loc-s2'];
  p.pt = [0, 30];
  x.spells = ['spl-t', 'spl-m', 'spl-d'];
  const asked: string[][] = [];
  const discard = async ({ spells }: { spells: { id: string }[] }) => (asked.push(spells.map((s) => s.id)), spells[0].id);
  await act(state, world, { type: 'cast', spell: 'spl-s', to: 'chr-x', kick: false }, { discard });
  await act(state, world, { type: 'wait', hours: 1 }, { discard });
  assert.deepEqual(asked, [['spl-t', 'spl-m', 'spl-d'], ['spl-m', 'spl-d']]);
  assert.deepEqual(x.spells, ['spl-d']);
  // An NPC casts it on the player: two picks they owe, one after the other.
  const s2 = character(world, 'loc-a');
  const [p2, c] = [s2.actors[PLAYER_ID], s2.actors['chr-c']];
  p2.spells = ['spl-t', 'spl-m', 'spl-d'];
  c.spells = ['spl-s'];
  c.bonds = ['loc-s1', 'loc-s2'];
  castSpell(s2, world, c, 'spl-s', PLAYER_ID, false, s2.minutes);
  await act(s2, world, { type: 'wait', hours: 1 });
  assert.match(askText(s2, world, s2.asks![0]), /주문 2개를 잊어야/);
  await act(s2, world, { type: 'choose', pick: 'spl-m' });
  assert.equal(s2.asks?.[0]?.effect.type, 'discard');
  assert.deepEqual(s2.asks![0].candidates, ['spl-t', 'spl-d']);
  await act(s2, world, { type: 'choose', pick: 'spl-d' });
  assert.deepEqual(p2.spells, ['spl-t']);
  // No swamps: nothing.
  c.bonds = ['loc-a'];
  castSpell(s2, world, c, 'spl-s', PLAYER_ID, false, s2.minutes);
  assert.deepEqual(p2.spells, ['spl-t']);
  assert.ok(texts(s2).some((t) => t.includes('늪과 이어져 있지 않아')));
});

test('the real Mind Sludge is taught at the Ghet estate: a discard per swamp', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-mind-sludge')!;
  assert.equal(s.learnAt, 'loc-ghet-estate');
  assert.deepEqual(s.effects, [{ type: 'discard_per_land', land: 'swamp' }]);
});

test('the real Territorial Baloth lurks in the Misty Rainforest: a 4/4 baloth, +2/+2 on landfall', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const b = state.actors['chr-territorial-baloth'];
  assert.equal(b.region, 'loc-misty-rainforest');
  const def = npcDef(state, world, b.id)!;
  assert.equal(def.creature, 'cre-baloth');
  assert.ok(def.beast);
  assert.deepEqual(def.landfall, { pt: [2, 2], trample: false });
  assert.deepEqual(ptOf(b), [4, 4]);
});

test('spire barrage: damage to one there for each mountain the caster holds; none, nothing', () => {
  const barrage: RawEntity = { id: 'spl-b', kind: 'spell', name: '폭격', status: 'canon', sim: { cost: '{1}', learn_at: 'loc-a', effects: [{ type: 'damage_per_land', land: 'mountain' }] } };
  const world = fixture([barrage, loc('loc-m1', 12, 10, 'rocky'), loc('loc-m2', 14, 10, 'rocky'), loc('loc-m3', 16, 10, 'volcanic'), npc('chr-x', npcSim('loc-a', 'work', [2, 9])), npc('chr-c', { ...npcSim('loc-a'), mana: { R: 5 } })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [x, c] = [state.actors['chr-x'], state.actors['chr-c']];
  const t = state.minutes;
  c.spells = ['spl-b'];
  c.bonds = ['loc-m1', 'loc-m2', 'loc-m3', 'loc-a'];
  castSpell(state, world, c, 'spl-b', 'chr-x', false, t);
  assert.equal(woundsOf(x, t), 3);
  assert.ok(foesOf(x, t).includes('chr-c'));
  c.bonds = ['loc-a'];
  castSpell(state, world, c, 'spl-b', 'chr-x', false, t);
  assert.equal(woundsOf(x, t), 3);
  assert.ok(texts(state).some((l) => l.includes('산과 이어져 있지 않아')));
});

test('the real Spire Barrage is taught in Akoum: damage per mountain', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-spire-barrage')!;
  assert.equal(s.learnAt, 'loc-akoum');
  assert.deepEqual(s.effects, [{ type: 'damage_per_land', land: 'mountain' }]);
});

test('landfall drain: as he bonds, one there he picks loses 3 life and he grows three +1/+1 counters; or none', async () => {
  const demon = { ...npcSim('loc-a', 'work', [3, 3]), mana: { B: 5 }, needs: ['energy'], landfall_drain: { life: 3, counters: 3 } };
  const world = fixture([npc('chr-o', demon), npc('chr-x', npcSim('loc-a')), npc('chr-s', { ...npcSim('loc-a'), abilities: ['shroud'] })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [o, x] = [state.actors['chr-o'], state.actors['chr-x']];
  bondLand(state, world, o, state.minutes);
  assert.deepEqual(state.choices?.at(-1)?.effect, { type: 'drain_grow', life: 3, counters: 3 });
  assert.deepEqual(state.choices?.at(-1)?.candidates, ['chr-x']); // not the shrouded one
  const asked: boolean[] = [];
  await advance(state, world, 1, { choose: async ({ optional }) => (asked.push(!!optional), 'chr-x') });
  assert.deepEqual(asked, [true]);
  assert.equal(lifeOf(x), 17);
  assert.equal(o.plusCounters, 3);
  assert.deepEqual(ptOf(o), [6, 6]);
  // None picked: no one loses, he does not grow.
  o.bonds = [];
  o.landfalls = undefined;
  bondLand(state, world, o, state.minutes);
  await advance(state, world, 1, { choose: async () => null });
  assert.equal(o.plusCounters, 3);
});

test('the real Ob Nixilis, the Fallen walks Bala Ged, a flightless Demon', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const o = state.actors['chr-ob-nixilis'];
  assert.equal(o.region, 'loc-bala-ged');
  assert.equal(hasAbility(o, 'fly', state.minutes), false);
  assert.deepEqual(npcDef(state, world, o.id)?.landfallDrain, { life: 3, counters: 3 });
  assert.deepEqual(npcDef(state, world, o.id)?.types, ['demon']);
});

const crush: RawEntity = { id: 'spl-rc', kind: 'spell', name: '분쇄', status: 'canon', sim: { cost: '{1}', speed: 'instant', learn_at: 'loc-a', target: 'self', effects: [{ type: 'destroy_relics', count: 2 }] } };
const bigAura: RawEntity = { id: 'spl-g', kind: 'spell', name: '거대', status: 'canon', sim: { cost: '{0}', learn_at: 'loc-a', target: 'any_here', effects: [{ type: 'aura', base_pt: [8, 8], abilities: ['trample'] }] } };

test('relic crush: an NPC destroys an aura (and what it gave) and an item standing there, one pick at a time', async () => {
  const world = fixture([crush, bigAura, vessel, npc('chr-c', { ...npcSim('loc-a'), mana: { G: 1 } }), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, x] = [state.actors['chr-c'], state.actors['chr-x']];
  castSpell(state, world, x, 'spl-g', 'chr-x', false, state.minutes);
  assert.deepEqual(ptOf(x), [8, 8]);
  assert.ok(x.abilities.includes('trample'));
  assert.deepEqual(relicsHere(state, world, 'loc-a', state.actors['chr-c']?.tile ?? state.actors['chr-x'].tile).map((r) => r.id), ['item:itm-v', 'aura:chr-x:0:spl-g']);
  c.spells = ['spl-rc'];
  readyCast(state, world, c, 'spl-rc', state.minutes);
  const asked: [string[], boolean][] = [];
  await advance(state, world, 1, { pick: async ({ options, optional }) => (asked.push([options.map((o) => o.id), !!optional]), options.at(-1)!.id) });
  assert.deepEqual(asked, [[['item:itm-v', 'aura:chr-x:0:spl-g'], false], [['item:itm-v'], true]]);
  assert.equal(x.auras?.length, 0);
  assert.equal(x.abilities.includes('trample'), false);
  assert.deepEqual(ptOf(x), [1, 1]);
  assert.ok(state.items?.['itm-v']?.gone);
  assert.match(castBlocked(state, world, c, 'spl-rc', c.id, false, state.minutes)!, /부술 마법물체도 부여마법도 없다/);
});

test('relic crush by the player: the first must go, the second they may let be', async () => {
  const world = fixture([crush, bigAura, vessel, npc('chr-x', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const [p, x] = [state.actors[PLAYER_ID], state.actors['chr-x']];
  castSpell(state, world, x, 'spl-g', 'chr-x', false, state.minutes);
  p.spells = ['spl-rc'];
  p.bonds = ['loc-a'];
  await act(state, world, { type: 'cast', spell: 'spl-rc', to: p.id, kick: false });
  await act(state, world, { type: 'wait', hours: 1 });
  const first = state.asks![0];
  assert.equal(first.effect.type, 'crush');
  assert.equal(askOptions(state, world, first).some((o) => o.pick === null), false);
  await act(state, world, { type: 'choose', pick: 'item:itm-v' });
  assert.ok(state.items?.['itm-v']?.gone);
  assert.ok(askOptions(state, world, state.asks![0]).some((o) => o.pick === null));
  await act(state, world, { type: 'choose', pick: null });
  assert.equal(x.auras?.length, 1); // let be
});

test('the real Relic Crush is taught in Bala Ged', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-relic-crush')!;
  assert.equal(s.learnAt, 'loc-bala-ged');
  assert.deepEqual(s.effects, [{ type: 'destroy_relics', count: 2 }]);
});

test('relic crush reaches an enchantment that is no aura, standing in a place', () => {
  const ench: RawEntity = { id: 'itm-e', kind: 'item', name: '결계', status: 'canon', sim: { card_type: 'enchantment', cost: '{1}', at: 'loc-a', effects: [{ type: 'charge_life' }] } };
  const world = fixture([ench, npc('chr-c', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(world.items[0].cardType, 'enchantment');
  assert.deepEqual(relicsHere(state, world, 'loc-a', nearestTile(world, 'loc-a')), [{ id: 'item:itm-e', label: '결계 (부여마법)' }]);
  assert.ok(crushRelic(state, world, 'item:itm-e', state.actors['chr-c'], state.minutes));
  assert.ok(state.items?.['itm-e']?.gone);
});

test('a loremaster: whoever controls him taps him to come to know a secret per Ally of their party', async () => {
  const lore1 = { ...npcSim('loc-a', 'work', [1, 3]), mana: { U: 5 }, ally: true, hireable: true, tap_draw_allies: true };
  const ogre = { ...npcSim('loc-a', 'work', [3, 2]), mana: { B: 5 }, ally: true, hireable: true };
  const world = fixture([tribute('loc-a'), mantle, desecrate, sludge, lore('cre-v', 'creature'), npc('chr-l', lore1), npc('chr-o', ogre)]);
  const state = character(world, 'loc-a');
  const [p, l] = [state.actors[PLAYER_ID], state.actors['chr-l']];
  assert.match(recallBlocked(state, world, p, state.minutes)!, /부릴 전승술사가 없다/);
  p.stats.coin = 200;
  await act(state, world, { type: 'hire', to: 'chr-l' });
  await act(state, world, { type: 'hire', to: 'chr-o' });
  assert.equal(recallCount(state, world, p), 2);
  await act(state, world, { type: 'recall' });
  assert.equal(p.knowledge?.length, 2);
  assert.equal(p.spells, undefined);
  assert.equal(p.drawn?.count, 2);
  assert.ok(l.boundUntil !== undefined); // tapped until midnight
  assert.match(recallBlocked(state, world, p, state.minutes)!, /지금 쓸 수 없다/);
  assert.ok(texts(state).some((t) => t.includes('의 기억 (동료 2)') && t.includes('숨은 것 2가지를 알게 되었다')));
  // Alone, he draws on himself: his own plan's recall block.
  const w2 = fixture([tribute('loc-a'), mantle, lore('cre-v', 'creature'), npc('chr-l', { ...lore1, plan: [['00:00', '24:00', 'loc-a', 'recall', '기억 빌리기', '📜']] })]);
  const s2 = newState(w2, { seed: 1, mode: 'observer' });
  await advance(s2, w2, 2);
  assert.equal(s2.actors['chr-l'].knowledge?.length, 1);
});

test('the real Sea Gate Loremaster lives in Sea Gate, an island in Tazeem, for 50 coin', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['chr-sea-gate-loremaster']?.region, 'loc-sea-gate');
  assert.equal(region(world, 'loc-sea-gate').parent, 'loc-tazeem');
  assert.deepEqual(landTypes(region(world, 'loc-sea-gate')), ['island']);
  const def = world.npcs.find((x) => x.id === 'chr-sea-gate-loremaster')!;
  assert.equal(hirePrice(def), 50);
  assert.ok(def.tapDrawAllies && def.ally);
});

test('drawing is coming to know secrets of the world: traps and what sets them off, relics, where spells are taught, what comes today', () => {
  const world = fixture([runeflare, bolt, vessel, npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const x = state.actors['chr-x'];
  const all = secretsOf(state, world, state.minutes).map((s) => s.id);
  assert.deepEqual(all.sort(), ['item:itm-v', 'spell:spl-bolt', 'trap:evt-rune']);
  assert.match(secretsOf(state, world, state.minutes).find((s) => s.id === 'trap:evt-rune')!.text, /비밀을 3가지 이상 알게 된 이가/);
  const got = drawKnowledge(state, world, x, 5, state.minutes, '시험');
  assert.equal(got.length, 3); // no more than there is
  assert.equal(handSize(x, state.minutes), 3);
  assert.deepEqual(drawKnowledge(state, world, x, 1, state.minutes, '시험'), []);
  assert.ok(texts(state).some((t) => t.includes('더 알아낼 것이 없었다')));
  // A secret of the day passes with it.
  x.knowledge!.push({ id: 'today:0:0', text: '오늘 무엇', day: 0 });
  assert.equal(knownSecrets(x, state.minutes + 1440).some((k) => k.id === 'today:0:0'), false);
});

test('enter_draw: arriving, the sphinx learns three secrets; kicked from its own mana it keeps its spells, unkicked it lets three go', () => {
  const sphinx = (mana: object) => ({ ...npcSim('loc-a', 'work', [3, 5]), needs: ['energy'], mana, abilities: ['fly'], enter_draw: { count: 3, discard: 3, kicker: '{1}{U}' } });
  const world = fixture([runeflare, bolt, vessel, npc('chr-s', sphinx({ U: 5 })), npc('chr-p', sphinx({ U: 1 }))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [s, p] = [state.actors['chr-s'], state.actors['chr-p']];
  const t = state.minutes;
  s.spells = ['spl-bolt'];
  p.spells = ['spl-bolt'];
  onEnter(state, world, s, t);
  assert.equal(knownSecrets(s, t).length, 3);
  assert.deepEqual(manaAvailable(state, world, s, t), { U: 3 }); // paid {1}{U}
  assert.deepEqual(s.spells, ['spl-bolt']);
  assert.ok(texts(state).some((l) => l.includes('되찾은 진실')));
  // Once a day.
  onEnter(state, world, s, t);
  assert.deepEqual(manaAvailable(state, world, s, t), { U: 3 });
  // Can't pay the kicker: learns, then lets its spells go (no more than three: all, no pick).
  onEnter(state, world, p, t);
  assert.equal(knownSecrets(p, t).length, 3);
  assert.deepEqual(p.spells, []);
  assert.deepEqual(p.graveyard, ['spl-bolt']);
});

test('the real Sphinx of Lost Truths broods on Sejiri\'s snow', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const s = state.actors['cre-sphinx-of-lost-truths'];
  assert.equal(s.region, 'loc-sejiri');
  assert.ok(hasAbility(s, 'fly', state.minutes));
  assert.deepEqual(npcDef(state, world, s.id)?.enterDraw, { count: 3, discard: 3, kicker: parseManaCost('{1}{U}')!, kickerText: '{1}{U}' });
});

test('both seas count as islands', () => {
  const world = loadWorld();
  assert.deepEqual(landTypes(region(world, 'loc-silundi-sea')), ['island']);
  assert.deepEqual(landTypes(region(world, 'loc-thunder-bay')), ['island']);
  assert.deepEqual(landTypes(region(world, 'loc-malakir')), ['swamp']);
  assert.deepEqual(landTypes(region(world, 'loc-turntimber-grove')), ['forest']);
});

test('an Ally\'s gift of the sky: each Ally joining gives every Ally of the party flying until midnight, not other retainers', async () => {
  const aerialist = { ...npcSim('loc-a', 'work', [2, 3]), mana: { U: 5 }, ally: true, hireable: true, rally: [{ type: 'grant_allies', ability: 'fly' }] };
  const ogre = { ...npcSim('loc-a', 'work', [3, 2]), mana: { B: 5 }, ally: true, hireable: true };
  const world = fixture([npc('chr-s', aerialist), npc('chr-o', ogre), npc('chr-x', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const [p, s, o, x] = [state.actors[PLAYER_ID], state.actors['chr-s'], state.actors['chr-o'], state.actors['chr-x']];
  x.master = PLAYER_ID;
  p.stats.coin = 200;
  await act(state, world, { type: 'hire', to: 'chr-s' });
  await act(state, world, { type: 'hire', to: 'chr-o' });
  assert.ok(hasAbility(s, 'fly', state.minutes));
  assert.ok(hasAbility(o, 'fly', state.minutes));
  assert.equal(hasAbility(x, 'fly', state.minutes), false);
  assert.equal(hasAbility(p, 'fly', state.minutes), false);
  assert.equal(state.asks?.length ?? 0, 0); // nothing to pick
  const midnight = (Math.floor(state.minutes / 1440) + 1) * 1440;
  await act(state, world, { type: 'wait', hours: Math.ceil((midnight - state.minutes) / 60) + 1 });
  assert.equal(hasAbility(o, 'fly', state.minutes), false);
});

test('the real Seascape Aerialist lives on the Silundi Coast, a shore of Ondu', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const a = state.actors['chr-seascape-aerialist'];
  assert.equal(a?.region, 'loc-silundi-coast');
  assert.equal(region(world, 'loc-silundi-coast').parent, 'loc-ondu');
  assert.deepEqual(landTypes(region(world, 'loc-silundi-coast')), ['island']);
  assert.equal(travelBlocked(state, world, a, 'loc-tazeem'), null);
  assert.deepEqual(world.npcs.find((x) => x.id === 'chr-seascape-aerialist')?.rally, [{ type: 'grant_allies', ability: 'fly' }]);
});

test('Valakut stands on Beyeen, an island of Ondu: its fire reaches Ondu, its areas and its islands, not Akoum', () => {
  const world = loadWorld();
  assert.equal(region(world, 'loc-valakut').parent, 'loc-beyeen');
  assert.equal(region(world, 'loc-beyeen').of, 'loc-ondu');
  assert.deepEqual(landTypes(region(world, 'loc-beyeen')), ['mountain']);
  assert.equal(region(world, 'loc-teetering-peaks').parent, 'loc-ondu');
  const realm = realmOf(world, 'loc-valakut');
  for (const id of ['loc-ondu', 'loc-makindi', 'loc-beyeen', 'loc-valakut', 'loc-jwar-isle', 'loc-agadeem', 'loc-agadeem-crypt']) assert.ok(realm.includes(id), id);
  assert.equal(realm.includes('loc-akoum'), false);
});

test('areas are drawn where the lore puts them (map.pos), inside their region', () => {
  const world = loadWorld();
  const akoum = region(world, 'loc-akoum');
  const tarn = nodeAt(world, region(world, 'loc-scalding-tarn'));
  assert.ok(tarn.x < akoum.x && tarn.y > akoum.y); // west-southwest
  const sea = nodeAt(world, region(world, 'loc-sea-gate'));
  assert.ok(sea.y > region(world, 'loc-tazeem').y); // south, on Halimar
});

test('when the world moves a character\'s home, they go there in a running game (not one who serves someone)', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const l = state.actors['chr-lorthos'];
  assert.equal(l.region, 'loc-sunder-offing');
  assert.equal(l.home, 'loc-sunder-offing');
  // As a save from when his home was the bay.
  l.region = 'loc-thunder-bay';
  l.home = 'loc-thunder-bay';
  syncWorld(state, world);
  assert.equal(l.region, 'loc-sunder-offing');
  // Moved about since: left where he is.
  l.region = 'loc-thunder-bay';
  syncWorld(state, world);
  assert.equal(l.region, 'loc-thunder-bay');
  // A region gone from the world leaves no state behind.
  state.regions['loc-gone'] = { conditions: [] };
  syncWorld(state, world);
  assert.equal(state.regions['loc-gone'], undefined);
  // A wandering place kept far off its roads (the map redrawn) goes back to its start.
  state.wanderers = { 'loc-goma-fada': { x: 10, y: 10, to: '로가 대로' } };
  syncWorld(state, world);
  assert.deepEqual(state.wanderers['loc-goma-fada'], { x: region(world, 'loc-goma-fada').x, y: region(world, 'loc-goma-fada').y });
  // One who serves someone stays at their side.
  const k = state.actors['chr-kazuul-warlord'];
  k.master = 'chr-kalitas';
  k.region = 'loc-ghet-estate';
  k.home = 'loc-somewhere-else';
  syncWorld(state, world);
  assert.equal(k.region, 'loc-ghet-estate');
});

test('one land in two places: bonding at the coast is bonding with the sea; an hour between them; one for a fetch', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'character', player: { name: '나', background: '떠돌이', region: 'loc-silundi-coast' } });
  const p = state.actors[PLAYER_ID];
  assert.equal(bondBlocked(state, world, p, state.minutes), null);
  bondLand(state, world, p, state.minutes);
  assert.deepEqual(p.bonds, ['loc-silundi-sea']);
  assert.deepEqual(manaCapacity(state, world, p, state.minutes), { U: 1 });
  // The sea is that same land: already bonded with it.
  p.landfalls = undefined;
  p.region = 'loc-silundi-sea';
  assert.match(bondBlocked(state, world, p, state.minutes)!, /이미/);
  assert.equal(travelHours(region(world, 'loc-silundi-coast'), region(world, 'loc-silundi-sea'), ['aquatic']), 1);
  assert.equal(travelHours(region(world, 'loc-sunder-offing'), region(world, 'loc-thunder-bay'), ['aquatic']), 1);
  // A fetch finds the land once.
  const island = world.regions.filter((r) => landTypes(r).includes('island'));
  assert.ok(island.some((r) => r.id === 'loc-silundi-coast'));
  p.bonds = ['loc-scalding-tarn'];
  const found = fetchTargets(state, world, p, 'loc-scalding-tarn').map((r) => r.id);
  assert.ok(found.includes('loc-silundi-sea') && !found.includes('loc-silundi-coast'));
  assert.ok(found.includes('loc-thunder-bay') && !found.includes('loc-sunder-offing'));
});
