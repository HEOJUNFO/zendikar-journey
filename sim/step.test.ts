import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock } from './clock.ts';
import { loadWorld } from './load.ts';
import { act, advance } from './run.ts';
import type { Llm } from './run.ts';
import { woundsOf } from './combat.ts';
import { manaAvailable, manaCapacity } from './mana.ts';
import { usableAbilities } from './run.ts';
import { eligibleGmEvents } from './step.ts';
import { gainLife } from './life.ts';
import { newState, PLAYER_ID, ptOf, syncWorld } from './state.ts';
import { bondBlocked, bondLand } from './abilities.ts';
import { DEPLETED_LABEL } from './rules.ts';
import type { State } from './state.ts';
import { affectedRegions, buildWorld, travelHours } from './world.ts';
import type { RawEntity } from './world.ts';

const loc = (id: string, x: number, y: number, terrain: string): RawEntity => ({
  id,
  kind: 'location',
  name: id,
  status: 'canon',
  map: { x, y, terrain },
});
const npc = (id: string, sim: object): RawEntity => ({ id, kind: 'character', name: `${id}, 누군가`, status: 'canon', sim });
const allDay = (region: string, kind = 'social') => [['00:00', '24:00', region, kind, '이야기', '💬']];
const npcSim = (region: string, kind = 'social', pt = [1, 1]) => ({ pt, role: 'r', home: region, persona: 'p', goal: 'g', routine: allDay(region, kind) });

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

test('the real world loads and Iona keeps her routine in Emeria', async () => {
  const world = loadWorld();
  assert.ok(world.npcs.some((n) => n.id === 'chr-iona' && n.abilities.includes('fly')));
  const state = newState(world, { seed: 7, mode: 'observer' });
  await advance(state, world, 24);
  assert.equal(formatClock(state.minutes), '2일차 06:00');
  const iona = state.actors['chr-iona'];
  assert.equal(iona.region, 'loc-emeria');
  assert.ok(texts(state).some((t) => t.includes('하늘 순찰')));
  assert.ok(iona.stats.energy > 0 && iona.stats.energy <= 100);
  // An angel lives by energy alone: no hunger, no pay.
  assert.deepEqual([iona.stats.hunger, iona.stats.coin], [20, 20]);
});

test('sky and sea regions cannot be reached without the means', async () => {
  const world = fixture();
  const state = character(world);
  assert.match((await act(state, world, { type: 'move', to: 'loc-sky' })).error!, /비행/);
  assert.match((await act(state, world, { type: 'move', to: 'loc-sea' })).error!, /바다/);
});

test('travel takes distance / 4 hours and the player sees the arrival', async () => {
  const world = fixture();
  const state = character(world);
  const start = state.minutes;
  const { error, entries } = await act(state, world, { type: 'move', to: 'loc-b' });
  assert.equal(error, undefined);
  assert.equal(state.minutes - start, 5 * 60);
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
const being = (id: string, sim: object): RawEntity => ({ id, kind: 'character', name: `${id}, 존재`, status: 'canon', sim: { gm: true, home: 'loc-sea', ...sim } });
const kalitas = being('chr-k', {
  home: 'loc-c',
  pt: [5, 5],
  mana: { B: 7 },
  activated: [
    {
      id: 'kin',
      name: '혈족으로 들이기',
      cost: '{B}{B}{B}',
      tap: true,
      effects: [{ type: 'destroy' }, { type: 'raise', creature: 'cre-v', faction: 'fac-g' }],
    },
  ],
});

test('a GM-driven being pays mana and taps to destroy someone, who rises as a token', async () => {
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
  assert.equal(token.region, 'loc-a');
  assert.match(state.tokens![token.id].role, /fac-g/);
  const bs = state.actors['chr-k'];
  assert.equal(formatClock(bs.boundUntil!), '2일차 00:00');
  assert.deepEqual(manaAvailable(state, world, bs, state.minutes), { B: 4 });
  assert.deepEqual(usableAbilities(state, world, state.minutes), []); // tapped
  // The token lives a day like any NPC.
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

test('GM-driven beings stay at home on the map, even at sea', async () => {
  const world = fixture([kalitas, lore('cre-v', 'creature'), lore('fac-g', 'faction'), being('chr-l', { pt: [8, 8] })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  await advance(state, world, 30);
  assert.equal(state.actors['chr-k'].kind, 'being');
  assert.equal(state.actors['chr-k'].region, 'loc-c');
  assert.equal(state.actors['chr-l'].region, 'loc-sea');
  assert.equal(state.actors['chr-k'].stats.energy, 80); // lives by no needs
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
  delete state.actors['chr-k'];
  state.beings = { 'chr-k': { id: 'chr-k', boundUntil: 1440, manaSpent: { day: 0, spent: { B: 3 } } } };
  syncWorld(state, world);
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

const beast = (routine: unknown[][], extra: object = {}): RawEntity => ({
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
    routine,
    ...extra,
  },
});
const beastDay = [
  ['00:00', '06:00', 'loc-a', 'sleep', '잠', '💤'],
  ['06:00', '10:00', 'loc-a', 'bond', '사냥터 차지', '🐾'],
  ['10:00', '12:00', 'loc-a', 'eat', '사냥', '🍖'],
  ['12:00', '24:00', 'loc-a', 'leisure', '어슬렁', '🌳'],
];

test('a beast bonds by routine, surges until midnight, hunts the land out and cannot claim it again', async () => {
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
  // 8 power against 1 toughness: 7 more runs on into the only other one there (1/3).
  assert.ok(texts(state).some((t) => t.includes('돌진이')));
  assert.ok(state.actors['chr-x'].dead);
});

test('a beast only growls when spoken to', async () => {
  const world = fixture([beast([['00:00', '24:00', 'loc-a', 'leisure', '어슬렁', '🌳']])]);
  const state = character(world, 'loc-a');
  await act(state, world, { type: 'talk', to: 'cre-b', say: '안녕' }, { reply: async () => ({ say: '말한다', attack: false }) });
  assert.ok(texts(state).some((t) => t.includes('으르렁')));
  assert.ok(!texts(state).some((t) => t.includes('말한다')));
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
    npc('chr-gap', { ...npcSim('loc-a'), routine: [['00:00', '12:00', 'loc-a', 'work', '일', '🔨']] }),
    npc('chr-nowhere', npcSim('loc-moon')),
    npc('chr-grounded', npcSim('loc-sky')),
    npc('chr-fasting', { ...npcSim('loc-a', 'eat'), needs: ['energy'] }),
    npc('chr-halfhour', { ...npcSim('loc-a'), routine: [['00:00', '00:30', 'loc-a', 'work', '일', '🔨'], ['00:30', '24:00', 'loc-a', 'sleep', '잠', '💤']] }),
  ]);
  const has = (id: string) => errors.some((e) => e.startsWith(`${id}:`));
  assert.ok(has('loc-bad'));
  assert.ok(has('chr-gap'));
  assert.ok(has('chr-nowhere'));
  assert.ok(has('chr-grounded'));
  assert.ok(has('chr-fasting'));
  assert.ok(has('chr-halfhour'));
});
