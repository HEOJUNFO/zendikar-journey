import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock } from './clock.ts';
import { loadWorld } from './load.ts';
import { act, advance } from './run.ts';
import type { Llm } from './run.ts';
import { newState, PLAYER_ID } from './state.ts';
import type { State } from './state.ts';
import { buildWorld } from './world.ts';
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
const npcSim = (region: string, kind = 'social') => ({ role: 'r', home: region, persona: 'p', goal: 'g', routine: allDay(region, kind) });

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
      { type: 'stat', energy: -40 },
      { type: 'destroy_lands', count: 2, hours: 48 },
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
      { type: 'bind', max: 8, until: 'next-morning' },
      { type: 'condition', label: '잠긴 해안', hours: 12, blocks_travel: true },
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

// loc-c -> loc-a (1h, 1st landfall) -> loc-b (5h, 2nd landfall at 12:00, the trap's land).
async function twoLandfalls(world: ReturnType<typeof fixture>) {
  const state = character(world, 'loc-c');
  await act(state, world, { type: 'move', to: 'loc-a' });
  await act(state, world, { type: 'move', to: 'loc-b' });
  return state;
}

test('the trap answers only when its land is the second landfall of the day', async () => {
  const world = fixture([trap]);
  const once = character(world, 'loc-a'); // the starting land is not a landfall
  await act(once, world, { type: 'move', to: 'loc-b' });
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
  await act(state, world, { type: 'wait', hours: 1 }); // omen
  const before = state.actors[PLAYER_ID].stats.energy;
  await act(state, world, { type: 'wait', hours: 1 }); // the trap
  assert.ok(texts(state).includes('함정이 터졌다.'));
  assert.ok(state.actors[PLAYER_ID].stats.energy <= before - 40 + 1);
  for (const id of ['loc-a', 'loc-b']) assert.ok(state.regions[id].conditions.some((c) => c.barren));
  assert.ok(!state.regions['loc-c'].conditions.length);
  assert.match((await act(state, world, { type: 'explore', hours: 1, pace: 'normal' })).error!, /황폐/);
});

test('the careful dodge an omened trap', async () => {
  const world = fixture([trap]);
  const state = await twoLandfalls(world);
  await act(state, world, { type: 'explore', hours: 2, pace: 'careful' }); // omen, stops
  await act(state, world, { type: 'wait', hours: 1 });
  assert.ok(texts(state).some((t) => t.includes('몸을 피했다')));
});

test('the tide binds those on the coast until the next morning and floods it', async () => {
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
  assert.ok(texts(state).some((t) => t.includes('풀려났다')));
  assert.equal(me.boundUntil, undefined);
  assert.equal(formatClock(state.minutes).startsWith('2일차'), true);
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
