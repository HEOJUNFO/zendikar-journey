import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, parseTimeOfDay } from './clock.ts';
import { loadWorld } from './load.ts';
import { act as runAct, advance as runAdvance } from './run.ts';
import type { Llm } from './run.ts';
import type { Action } from './actions.ts';
import type { World } from './world.ts';
import { die, knockedOut, woundsOf } from './combat.ts';
import { formatMana, manaAvailable, manaCapacity, parseManaCost, planPayment } from './mana.ts';
import { MAX_TALKS_PER_DAY, usableAbilities } from './run.ts';
import { eligibleGmEvents, travelBlocked } from './step.ts';
import { gainLife } from './life.ts';
import { newState, outOfTime, PLAYER_ID, present, ptOf, syncWorld } from './state.ts';
import { spendBlocked, storeBlocked } from './eons.ts';
import { bondBlocked, bondLand, bondTargets, fetchTargets, fireTargets, firesOnBond, growBlocked, spawnWild, useAbility } from './abilities.ts';
import { DEPLETED_LABEL } from './rules.ts';
import { swayBlocked } from './retainers.ts';
import type { State } from './state.ts';
import { affectedRegions, buildWorld, region, travelHours } from './world.ts';
import type { RawEntity } from './world.ts';

const loc = (id: string, x: number, y: number, terrain: string): RawEntity => ({
  id,
  kind: 'location',
  name: id,
  status: 'canon',
  map: { x, y, terrain },
});
// No one's day is written anywhere: the LLM plans it. Here a fake planner stands in, giving
// each character the day a test writes for them (`plan` in these helpers, as
// [start, end, region, kind, activity, emoji, land?] rows), or a day at leisure where they stand.
const PLANS = new Map<string, unknown[][]>();
const planned = (e: RawEntity): RawEntity => {
  const { plan, ...sim } = e.sim as { plan?: unknown[][] };
  if (plan) PLANS.set(e.id, plan);
  else PLANS.delete(e.id);
  return { ...e, sim };
};
const planDay: Llm['planDay'] = async (input) =>
  (PLANS.get(input.id) ?? [['00:00', '24:00', input.here, 'leisure', '머무름', '🙂']]).map(([start, end, regionId, kind, activity, emoji, land]) => ({
    start: parseTimeOfDay(start as string),
    end: parseTimeOfDay(end as string),
    regionId: regionId as string,
    kind: kind as never,
    activity: activity as string,
    emoji: emoji as string,
    ...(land ? { land: land as string } : {}),
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

test('travel takes distance / 8 hours and the player sees the arrival', async () => {
  const world = fixture();
  const state = character(world);
  const start = state.minutes;
  const { error, entries } = await act(state, world, { type: 'move', to: 'loc-b' });
  assert.equal(error, undefined);
  assert.equal(state.minutes - start, 3 * 60); // 20 units / 8, rounded up
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
  // Wounds heal when the turn ends; destroyed land stays destroyed.
  await act(state, world, { type: 'wait', hours: 24 });
  await act(state, world, { type: 'wait', hours: 24 });
  assert.equal(woundsOf(state.actors[PLAYER_ID], state.minutes), 0);
  assert.ok(state.regions['loc-b'].destroyed);
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
  planned({ id, kind: 'character', name: `${id}, 존재`, status: 'canon', sim: { role: 'r', persona: 'p', goal: 'g', needs: [], home: 'loc-sea', abilities: ['aquatic'], ...sim } });
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
  assert.equal(token.schedule?.day, 0); // planned the hour it rose
  assert.deepEqual(state.tokens![token.id].colors, ['B']); // a black Vampire
  const bs = state.actors['chr-k'];
  assert.equal(formatClock(bs.boundUntil!), '2일차 00:00');
  assert.deepEqual(manaAvailable(state, world, bs, state.minutes), { B: 4 });
  assert.deepEqual(usableAbilities(state, world, state.minutes), []); // tapped
  // It lives a day like any NPC.
  await advance(state, world, 24, { gmDay: async ({ day }) => ({ day, source: 'llm', fires: [] }) });
  assert.equal(state.actors[token.id].schedule?.day, 1);
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
  assert.equal(state.actors['chr-k'].stats.energy, 80); // lives by no needs
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
    { id: 'loc-in', kind: 'location', name: '안뜰', status: 'canon', map: { in: 'loc-a', terrain: 'swamp' } },
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

test('buildWorld rejects areas in nowhere, in areas, or at sea', () => {
  const area = (id: string, parent: string): RawEntity => ({ id, kind: 'location', name: id, status: 'canon', map: { in: parent, terrain: 'swamp' } });
  const { errors } = buildWorld([
    loc('loc-a', 10, 10, 'grassland'),
    loc('loc-sea', 10, 30, 'deepsea'),
    area('loc-in', 'loc-a'),
    area('loc-nowhere', 'loc-moon'),
    area('loc-nested', 'loc-in'),
    area('loc-wet', 'loc-sea'),
  ]);
  const has = (id: string) => errors.some((e) => e.startsWith(`${id}:`));
  assert.ok(!has('loc-in'));
  assert.ok(has('loc-nowhere'));
  assert.ok(has('loc-nested'));
  assert.ok(has('loc-wet'));
});

const needle: RawEntity = {
  id: 'evt-needle',
  kind: 'event',
  name: '바늘 함정',
  status: 'canon',
  sim: { region: 'loc-b', trigger: 'enter', gained_life: true, text: '가시가 물었다.', effects: [{ type: 'lose_life', amount: 5 }] },
};

test('an enter trap bites only those who gained life today, and drains energy', async () => {
  const world = fixture([needle]);
  const fed = character(world, 'loc-a');
  const p = fed.actors[PLAYER_ID];
  // Food and sleep don't count as gaining life.
  await act(fed, world, { type: 'move', to: 'loc-b' }, {});
  assert.ok(!texts(fed).some((t) => t.includes('가시가 물었다')));

  const drained = character(world, 'loc-a');
  const q = drained.actors[PLAYER_ID];
  gainLife(drained, q, 1, drained.minutes, '시험');
  assert.equal(q.stats.energy, 90);
  await act(drained, world, { type: 'move', to: 'loc-b' }, {});
  assert.ok(texts(drained).some((t) => t.includes('생명 5을 잃었다')));
  assert.ok(q.stats.energy < 50);
  assert.equal(q.dead, undefined); // life loss isn't damage
  assert.ok(p.stats.energy > q.stats.energy);
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
  x.stats.energy = 80; // life 8
  await act(state, world, { type: 'cast', spell: 'spl-t', to: 'chr-x', kick: false });
  assert.ok(texts(state).some((t) => t.includes('공물을 걸었다')));
  assert.ok(x.stats.energy <= 40);
  assert.ok(x.relations?.[PLAYER_ID]);
  assert.equal(p.lifeGained, undefined); // not kicked
});

test('kicker: tapping a vampire you control drains the life lost into you', async () => {
  const world = fixture([loc('loc-swamp', 12, 10, 'swamp'), tribute(), lore('cre-v', 'creature'), npc('chr-x', npcSim('loc-swamp'))]);
  const state = character(world, 'loc-swamp');
  const p = state.actors[PLAYER_ID];
  p.spells = ['spl-t'];
  p.bonds = ['loc-swamp', 'loc-a'];
  p.stats.energy = 30;
  state.actors['chr-x'].stats.energy = 80;
  assert.match((await act(state, world, { type: 'cast', spell: 'spl-t', to: 'chr-x', kick: true })).error ?? '', /탭할 것이 없다/);
  // A vampire who serves the player.
  state.tokens = { 'tok-1': { ...world.npcs[0], id: 'tok-1', name: '흡혈귀', creature: 'cre-v' } };
  state.actors['tok-1'] = { ...state.actors['chr-x'], id: 'tok-1', name: '흡혈귀', relations: undefined, master: PLAYER_ID };
  await act(state, world, { type: 'cast', spell: 'spl-t', to: 'chr-x', kick: true });
  assert.ok(state.actors['tok-1'].boundUntil !== undefined);
  assert.ok(p.stats.energy >= 60); // 30 + 40, less the hour's wear
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
  p.stats.energy = 30;
  await act(state, world, { type: 'attack', to: 'chr-x' });
  assert.ok(texts(state).some((t) => t.includes('생명') && t.includes('얻었다')));
  assert.equal(p.stats.energy, 52); // 30 doubled to 60, less the fight hour (-8)
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
  assert.deepEqual(state.actors[PLAYER_ID].spells, ['spl-bolt']); // the only spell in this world
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
  state.actors['chr-x'].stats.energy = 80;
  assert.equal(useAbility(state, world, 'chr-w', 'ult', 'chr-x', state.minutes), null);
  assert.ok(texts(state).some((t) => t.includes('값 없이')));
  assert.equal(state.actors['chr-x'].stats.energy, 40);
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
    // A land between two regions joins regions on the map.
    { id: 'loc-bridge', kind: 'location', name: 'x', map: { x: 30, y: 20, terrain: 'ruins', joins: ['loc-a', 'loc-moon'] } },
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
  assert.ok(has('loc-bridge'));
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
  p.stats.energy = 70;
  await act(state, world, { type: 'claim', item: 'itm-v' });
  assert.deepEqual(state.items?.['itm-v'], { name: '그릇', owner: PLAYER_ID, counters: 7 }); // 69 energy: life 6.9
  assert.match((await act(state, world, { type: 'claim', item: 'itm-v' })).error!, /이미 그릇을 길들였다/);
  // Worn down, then a new land the next day: life becomes what the vessel holds.
  await act(state, world, { type: 'wait', hours: 24 });
  p.stats.energy = 20;
  await act(state, world, { type: 'move', to: 'loc-c' });
  await act(state, world, { type: 'bond' });
  assert.equal(p.stats.energy, 70);
  assert.equal(p.lifeGained, 1);
  assert.ok(texts(state).some((t) => t.includes('그릇으로 생명')));
  // Never lowered: full of energy, the vessel leaves it be.
  await act(state, world, { type: 'wait', hours: 24 });
  p.stats.energy = 95;
  await act(state, world, { type: 'move', to: 'loc-b' });
  const before = p.stats.energy;
  await act(state, world, { type: 'bond' });
  assert.ok(p.stats.energy < before);
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
  map: { in: 'loc-c', terrain: 'settlement', color: ['B', 'R'] },
  sim: { enters_tapped: true, on_bond: [{ type: 'gain_life', amount: 1 }] },
};

test('a refuge: enters tapped (no mana the day it is bonded), gives life on bonding, and its mana is either color', async () => {
  const world = fixture([refuge]);
  const state = character(world, 'loc-refuge');
  const p = state.actors[PLAYER_ID];
  p.stats.energy = 50;
  await act(state, world, { type: 'bond' });
  assert.equal(p.stats.energy, 56); // +10 life, less 4 hours of bonding
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
  p.stats.energy = 50;
  await act(state, world, { type: 'fetch', from: 'loc-mesa', to: 'loc-c' });
  assert.equal(p.region, 'loc-mesa'); // never went there
  assert.deepEqual(p.bonds, ['loc-c']);
  assert.deepEqual(p.landfalls?.regions, ['loc-mesa', 'loc-c']); // the day's second landfall
  assert.deepEqual(p.fetched, ['loc-c']);
  assert.equal(p.stats.energy, 39); // -10 for the life, -1 for the hour
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
  map: { in: 'loc-c', terrain: 'ruins', color: 'B' },
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
  map: { in: 'loc-a', terrain: 'sky' },
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
  assert.equal(formatClock(state.minutes), '1일차 13:00');
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
  map: { in: 'loc-a', terrain: 'river' },
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
  assert.ok(!present(state, 'loc-magosi').includes(p));
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
  map: { in: 'loc-b', terrain: 'forest', color: 'G' },
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
  map: { in: 'loc-b', terrain: 'swamp', color: 'B' },
  sim: { nonbasic: true, enters_tapped: true, on_bond: [{ type: 'lose_life', amount: 1 }] },
};

test('a land that takes a life: the player picks someone there as they bond, and they lose 1 life', async () => {
  const world = fixture([piranhas, npc('chr-x', npcSim('loc-piranha', 'leisure'))]);
  const state = character(world, 'loc-piranha');
  const x = state.actors['chr-x'];
  x.stats.energy = 50;
  assert.match((await act(state, world, { type: 'bond' })).error!, /골라야 한다/);
  const [snake] = spawnWild(state, world, 'cre-snake', [1, 1], 1, 'loc-piranha', ['G']);
  assert.ok(bondTargets(state, world, state.actors[PLAYER_ID], 'loc-piranha', { type: 'lose_life', amount: 1 }).includes(snake)); // a beast may be picked too
  await act(state, world, { type: 'bond', target: 'chr-x' });
  assert.deepEqual(state.actors[PLAYER_ID].bonds, ['loc-piranha']);
  assert.equal(x.stats.energy, 36); // -10 for the life, -1 an hour of leisure for 4 hours
});

test('an NPC bonding with it picks by the LLM whom it falls on; alone, it falls on no one', async () => {
  const world = fixture([piranhas, npc('chr-x', { ...npcSim('loc-piranha'), plan: [['00:00', '24:00', 'loc-piranha', 'bond', '늪과 유대', '🌱']] })]);
  const state = character(world, 'loc-piranha');
  const p = state.actors[PLAYER_ID];
  p.stats.energy = 50;
  const asked: string[][] = [];
  const choose: Llm['choose'] = async ({ candidates }) => (asked.push(candidates.map((a) => a.id)), PLAYER_ID);
  await act(state, world, { type: 'wait', hours: 4 }, { choose });
  assert.deepEqual(asked, [[PLAYER_ID]]);
  assert.equal(p.stats.energy, 36);
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
  map: { in: 'loc-a', terrain: 'beach', color: 'U' },
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
  await act(state, world, { type: 'wait', hours: 12 }); // past midnight
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
    map: { in: 'loc-c', terrain: 'rocky', color: 'R' },
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
  map: { in: 'loc-c', terrain: 'volcanic', color: 'R' },
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
