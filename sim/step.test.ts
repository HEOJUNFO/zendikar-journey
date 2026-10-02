import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, gameDay, parseTimeOfDay, untapTime } from './clock.ts';
import { loadWorld } from './load.ts';
import { act as runAct, advance as runAdvance } from './run.ts';
import type { Llm } from './run.ts';
import type { PlanDayInput } from './llm/planner.ts';
import type { Action } from './actions.ts';
import { startAction } from './actions.ts';
import type { World } from './world.ts';
import { addFoe, attackBlocked, caughtAsleep, clash, dealDamage, destroy, die, foesOf, hostileNpcs, intimidated, knockedOut, landwalked, unblockable, woundsOf } from './combat.ts';
import { landSealed, powersSealed, sealedBy, sealToday, setSeal } from './seal.ts';
import { castableSpells, castBlocked, castSpell, castTargets, learnBlocked, npcCastBlocked, readyCast, tappable } from './spells.ts';
import { anthemHour } from './monument.ts';
import { answerCounter, answerCounterCast, counterHolders, reactionSpell, summon } from './counter.ts';
import { applyExile, banishOptions } from './banish.ts';
import { engulfTargets } from './engulf.ts';
import { upkeepScorch } from './scorch.ts';
import { actorColors, COLORS, formatMana, manaAvailable, manaCapacity, parseManaCost, planPayment } from './mana.ts';
import { MAX_TALKS_PER_DAY, canPledge, usableAbilities, volleyShares, burnTargets } from './run.ts';
import { destroyLand, eligibleGmEvents, moveHours, startTravel, step, travelBlocked } from './step.ts';
import { gainLife, lifeOf } from './life.ts';
import { awayText, buriedToday, hasAbility, here, needsOf, newState, npcDef, outOfTime, PLAYER_ID, present, protectedFrom, ptOf, syncWorld, targetable, together } from './state.ts';
import { foresightText } from './foresight.ts';
import { withPositions } from './wander.ts';
import { nodeAt } from '../web/view.ts';
import { crushRelic, relicsHere } from './relics.ts';
import { recallBlocked, recallCount } from './loremaster.ts';
import { bite, biteBlocked } from './bite.ts';
import { pumpMax, pumpsDue } from './pump.ts';
import { bindTargets } from './bind.ts';
import { drawKnowledge, handSize, huntKnowledge, knownSecrets, secretsOf } from './knowledge.ts';
import { letGo, revealHand } from './discard.ts';
import { claimBlocked, claimItem, itemOwner, itemsAt, itemWhere } from './items.ts';
import { spendBlocked, storeBlocked } from './eons.ts';
import { applyEnterDestroy, applyLure, applySearch, bondBlocked, enterDestroy, onEnter, bondLand, bondTargets, callForth, fetchTargets, fireTargets, firesOnBond, growBlocked, spawnWild, summonLibrary, useAbility } from './abilities.ts';
import { DEPLETED_LABEL, DESTROYED_DAYS, TRAVEL_UNITS_PER_HOUR } from './rules.ts';
import { bindRetainer, controlledCreatures, controlsKind, courtBlocked, courtTargets, creatureOf, followBlocked, refusedToday, releaseRetainer, retainersOf, swayBlocked, upkeepPossessions } from './retainers.ts';
import { joinedToday } from './bounce.ts';
import { centroid, eventTile, fixedTile, nearestTile, ownsTile, sameTile, TILE, tileCenter, tilesOf, tileSteps, tooSmall } from './tiles.ts';
import { applyQuell, upkeepQuell } from './quell.ts';
import { upkeepWins } from './win.ts';
import { allyJoined, applyRally, hireMerc, hirePrice } from './allies.ts';
import { askOptions, askText } from './asks.ts';
import { applyEscape, escapeOptions } from './escape.ts';
import { applyTorch, enterDamage } from './torch.ts';
import { applyToll, enterSacrifice } from './toll.ts';
import { applyShortcut, enterNoBlock } from './shortcut.ts';
import { bloodHasteHour } from './bloodghast.ts';
import { bloodSeekHour } from './seeker.ts';
import { altarBlocked } from './altar.ts';
import { expeditionBlocked } from './expedition.ts';
import { applyHarrow } from './harrow.ts';
import type { HarrowEffect } from './harrow.ts';
import { applySacrament } from './sacrament.ts';
import { applyDiscovery } from './discovery.ts';
import type { SacramentEffect } from './sacrament.ts';
import { shielded, tapBlocked, useTap } from './tapper.ts';
import type { Actor, State } from './state.ts';
import { affectedRegions, buildWorld, descendantsOf, distance, landTypes, placeName, realmOf, region, travelHours, within } from './world.ts';
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

test('buildWorld rejects areas in nowhere or in a sea; an area may hold areas; a sea may be an area of a land (a bay)', () => {
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
  assert.ok(!has('loc-nested')); // an area in an area (user decision 2026-10-01)
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

test('every beast answers in deeds when spoken to, and may come to follow (user decision 2026-10-01)', async () => {
  const world = fixture([beast([['00:00', '24:00', 'loc-a', 'leisure', '어슬렁', '🌳']])]);
  const state = character(world, 'loc-a');
  state.actors['cre-b'].tile = state.actors[PLAYER_ID].tile;
  let asBeast: boolean | undefined;
  await act(state, world, { type: 'talk', to: 'cre-b', say: '안녕' }, { reply: async (x) => ((asBeast = x.beast), { say: '짐승이 코를 킁킁거리며 다가온다.', attack: false, follow: true }) });
  assert.equal(asBeast, true);
  assert.ok(texts(state).includes('짐승이 코를 킁킁거리며 다가온다.'));
  assert.equal(state.actors['cre-b'].master, PLAYER_ID);
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

test('the real baloth starts out in Turntimber, the apex predator there (as the lore has it)', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['cre-baloth']?.region, 'loc-turntimber-grove');
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

test('the real Chandra wanders the Teeth of Akoum, over the Eye of Ugin', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['chr-chandra']?.region, 'loc-teeth-of-akoum');
  assert.equal(region(world, 'loc-teeth-of-akoum').parent, 'loc-akoum');
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

test('the real Hellkite Charger flies over the Teeth of Akoum, with haste', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const h = state.actors['cre-hellkite'];
  assert.equal(h?.name, '헬카이트 돌격대');
  assert.equal(h.region, 'loc-teeth-of-akoum');
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

test('an angel\'s landfall: each land she bonds with, a 1/1 white flying bird is born at her side and serves her', async () => {
  const plan = [
    ['00:00', '06:00', 'loc-b', 'sleep', '잠', '💤'],
    ['06:00', '10:00', 'loc-b', 'bond', '땅과 이어짐', '🕊️'],
    ['10:00', '24:00', 'loc-b', 'leisure', '하늘을 돎', '☁️'],
  ];
  const world = fixture([lore('cre-bd', 'creature'), npc('chr-an', { ...npcSim('loc-b', 'social', [3, 3]), needs: ['energy'], abilities: ['fly'], landfall_token: { creature: 'cre-bd', pt: [1, 1], colors: ['W'], abilities: ['fly'] }, plan })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  await advance(state, world, 4);
  const [bird] = retainersOf(state, 'chr-an');
  assert.deepEqual(ptOf(bird), [1, 1]);
  assert.ok(hasAbility(bird, 'fly', state.minutes));
  assert.deepEqual(actorColors(state, world, bird), ['W']);
});

test('the real Emeria Angel lives in Emeria, flying, birds on landfall', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const a = state.actors['cre-emeria-angel'];
  assert.equal(a?.region, 'loc-emeria');
  assert.ok(hasAbility(a, 'fly', state.minutes));
  assert.deepEqual(npcDef(state, world, a.id)?.landfallToken, { creature: 'cre-bird', pt: [1, 1], colors: ['W'], abilities: ['fly'] });
  assert.deepEqual(npcDef(state, world, a.id)?.types, ['angel']);
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

test('a drew trap burns, once a day, each one here who drew three, for the spells they hold', async () => {
  const world = fixture([walker, bolt, spell('spl-2'), spell('spl-3'), runeflare, npc('chr-x', npcSim('loc-a', 'social', [1, 5])), npc('chr-y', npcSim('loc-b', 'social', [1, 5]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const x = state.actors['chr-x'];
  const w = state.actors['chr-w'];
  assert.equal(useAbility(state, world, 'chr-w', 'wheel', '', state.minutes), null);
  assert.deepEqual(x.drawn, { day: 0, count: 3, sprung: undefined });
  x.spells = ['spl-2', 'spl-3'];
  const held = w.spells?.length ?? 0;
  await advance(state, world, 1);
  assert.ok(texts(state).some((t) => t.includes('룬이 불길을 뿜었다')));
  assert.equal(woundsOf(x, state.minutes), 2); // the spells held, not the secrets known
  assert.equal(w.loyalty, 3 - held); // loyalty 5 − 2, then fire for its spells
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

test('the real Sorin Markov stays at Graypelt, on the edge of Turntimber in Ondu; Chandra has life too', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const so = state.actors['chr-sorin-markov'];
  assert.equal(so?.region, 'loc-graypelt-refuge');
  assert.equal(region(world, 'loc-graypelt-refuge').top, 'loc-ondu');
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
    // An area's own tiles, with those of the areas in it.
    if (r.parent) assert.equal(n + descendantsOf(world, r.id).reduce((m, x) => m + tilesOf(world, x.id).length, 0), r.tileCount ?? 10, r.id);
    assert.equal(owners.filter((o) => o === r.id).length, n, r.id); // one land to a tile
  }
  assert.deepEqual(tooSmall(world), []);
  assert.equal(tilesOf(world, 'loc-makindi').length, 60); // 70 with Teetering Peaks in it
  assert.equal(tilesOf(world, 'loc-oran-rief').length, 100);
  assert.equal(tilesOf(world, 'loc-silundi-sea').length, 120);
  // A continent: its open ground and its areas.
  const ondu = ['loc-ondu', ...descendantsOf(world, 'loc-ondu').map((x) => x.id)];
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

test('the real Summoning Trap lies in the Guum Wilds of Bala Ged and may draw any creature card there, the Shoal Serpent too', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-summoning-trap');
  assert.equal(ev?.region, 'loc-guum-wilds');
  assert.equal(ev?.refused, true);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const lib = summonLibrary(state, world, 'loc-guum-wilds');
  // Creature cards anywhere, the sea's too; not planeswalkers, not those already there.
  assert.ok(lib.includes('cre-shoal-serpent') && lib.includes('chr-iona') && lib.includes('cre-sphinx') && lib.includes('chr-rampaging-baloths'));
  assert.ok(!lib.includes('chr-sorin-markov') && !lib.includes('chr-chandra') && !lib.includes('cre-zendikar-farguide'));
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

test('a ravenous trap: an NPC who sent three or more to their graveyard today steps in, and it closes on nothing (exile without the player is one step lighter)', async () => {
  const maw: RawEntity = {
    id: 'evt-maw',
    kind: 'event',
    name: '탐식의 함정',
    status: 'canon',
    sim: { region: 'loc-b', pos: [-1, 0], trigger: 'enter', buried: 3, text: '아가리가 닫혔다.', effects: [{ type: 'exile_graveyard' }] },
  };
  const world = fixture([maw, mantle, bolt, npc('chr-x', npcSim('loc-b')), npc('chr-r', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [x, r] = [state.actors['chr-x'], state.actors['chr-r']];
  x.region = 'loc-a';
  x.spells = [mantle.id, bolt.id];
  letGo(state, world, x, mantle.id, state.minutes);
  letGo(state, world, x, bolt.id, state.minutes);
  r.master = x.id;
  die(state, r, state.minutes, '시험');
  assert.equal(buriedToday(x, state.minutes), 3);
  await advance(state, world, 3);
  assert.ok(texts(state).some((t) => t.includes('아무것도 삼키지 못했다')));
  assert.equal(x.graveyard?.length, 2);
  assert.deepEqual(x.fallen, ['chr-r']);
  assert.ok(state.actors['chr-r']?.dead);
  assert.equal(x.exiled, undefined);
});

test('a ravenous trap: the player who sent three or more to their graveyard today steps in and loses that graveyard for good', async () => {
  const maw: RawEntity = {
    id: 'evt-maw',
    kind: 'event',
    name: '탐식의 함정',
    status: 'canon',
    sim: { region: 'loc-b', pos: [-1, 0], trigger: 'enter', buried: 3, text: '아가리가 닫혔다.', effects: [{ type: 'exile_graveyard' }] },
  };
  const world = fixture([maw, mantle, bolt, npc('chr-y', npcSim('loc-a')), npc('chr-r', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const [p, y, r] = [state.actors[PLAYER_ID], state.actors['chr-y'], state.actors['chr-r']];
  p.spells = [mantle.id, bolt.id];
  letGo(state, world, p, mantle.id, state.minutes);
  letGo(state, world, p, bolt.id, state.minutes);
  r.master = p.id;
  y.relations = { 'chr-r': { name: 'r', text: '옛 벗', t: 0 } };
  die(state, r, state.minutes, '시험');
  assert.equal(buriedToday(p, state.minutes), 3);
  assert.deepEqual(p.fallen, ['chr-r']);
  await act(state, world, { type: 'move', to: 'loc-b', tile: eventTile(world, world.events.find((e) => e.id === 'evt-maw')!) }, { planDay: async () => [] });
  assert.deepEqual(p.graveyard, []);
  assert.deepEqual(p.fallen, []);
  // The dead in it are erased from the world: gone from the save and from every memory, for good.
  assert.equal(state.actors['chr-r'], undefined);
  assert.equal(y.relations?.['chr-r'], undefined);
  assert.deepEqual(state.erased, ['chr-r']);
  syncWorld(state, world);
  assert.equal(state.actors['chr-r'], undefined); // not made anew from their card
  assert.ok(texts(state).some((t) => t.includes('아가리 속으로 사라졌다')));
  assert.equal(buriedToday(p, state.minutes + 1440), 0); // a new day counts anew
  // Exiled, a spell is theirs never again: not learned anew (a graveyard's may be).
  assert.deepEqual(p.exiled?.sort(), [bolt.id, mantle.id].sort());
  p.region = 'loc-a';
  assert.match(learnBlocked(world, p, mantle.id)!, /추방되어/);
});

test('a ravenous trap on one who holds every spell of a color (Chandra): the exiled spell never comes back to their hand', () => {
  const world = fixture([bolt, walker]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const w = state.actors['chr-w'];
  assert.ok(w.spells?.includes(bolt.id)); // every red spell of the world
  letGo(state, world, w, bolt.id, state.minutes);
  syncWorld(state, world);
  assert.ok(!w.spells?.includes(bolt.id)); // in the graveyard: had it
  w.exiled = [...(w.graveyard ?? [])];
  w.graveyard = [];
  syncWorld(state, world);
  assert.ok(!w.spells?.includes(bolt.id)); // exiled: not back
});

test('graveyards: a retainer goes to their master\'s, one serving no one to their killer\'s side (the killer\'s master if they serve), a token to none, a trap\'s dead to none', () => {
  const world = fixture([npc('chr-x', npcSim('loc-a')), npc('chr-y', npcSim('loc-a')), npc('chr-r', npcSim('loc-a')), npc('chr-k', npcSim('loc-a')), npc('chr-z', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const t = state.minutes;
  const [p, x, y, r, k, z] = [PLAYER_ID, 'chr-x', 'chr-y', 'chr-r', 'chr-k', 'chr-z'].map((id) => state.actors[id]);
  // The player kills x, who serves no one: into the player's graveyard.
  dealDamage(state, world, x, 9, t, '시험', false, p);
  assert.deepEqual(p.fallen, ['chr-x']);
  // r serves the player and kills y: the player's too.
  r.master = PLAYER_ID;
  dealDamage(state, world, y, 9, t, '시험', false, r);
  assert.deepEqual(p.fallen, ['chr-x', 'chr-y']);
  // A token who serves k dies: no graveyard (it ceases to be).
  (state.tokens ??= {})['chr-z'] = {} as never;
  z.master = 'chr-k';
  dealDamage(state, world, z, 9, t, '시험', false, p);
  assert.equal(k.fallen, undefined);
  assert.deepEqual(p.fallen, ['chr-x', 'chr-y']);
  // k dies of a trap: no one's doing, no graveyard.
  dealDamage(state, world, k, 9, t, '함정');
  assert.ok(k.dead);
  assert.deepEqual(p.fallen, ['chr-x', 'chr-y']);
  assert.equal(buriedToday(p, t), 2);
});

test('the real Ravenous Trap lies in the Crypt of Agadeem, for those who buried three or more', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-ravenous-trap');
  assert.equal(ev?.region, 'loc-agadeem-crypt');
  assert.equal(ev?.buried, 3);
  assert.deepEqual(ev?.effects, [{ type: 'exile_graveyard' }]);
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

test('swampwalk: one bonded with a swamp can\'t strike back at it, but may fly from it', async () => {
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
  // A flyer bonded with a swamp can't strike back, but may still take to the air (user decision
  // 2026-10-01).
  x.region = 'loc-b';
  addFoe(w, 'chr-f', state.minutes);
  await advance(state, world, 2, { evade: async () => (asked++, true) });
  assert.equal(asked, 1);
  assert.equal(woundsOf(f, state.minutes), 0);
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

test('the real Zendikar Farguide walks the Guum Wilds of Bala Ged, forestwalking', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['cre-zendikar-farguide'];
  assert.equal(g?.region, 'loc-guum-wilds');
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

test('the real Pillarfield Ox grazes by the Goma Fada caravan: a stubborn 2/4 beast that never hunts', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const ox = state.actors['cre-pillarfield-ox'];
  assert.equal(ox?.region, 'loc-goma-fada');
  assert.deepEqual(ptOf(ox), [2, 4]);
  const def = npcDef(state, world, ox.id)!;
  assert.ok(def.beast);
  assert.ok(!def.needs.includes('hunger')); // it grazes: never hungry enough to fall on anyone
  assert.ok(!def.hireable);
  assert.deepEqual(actorColors(state, world, ox), ['W']);
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

test('Elemental Appeal: a 7/1 trampling, hasty elemental serves the caster until midnight; kicked, 14/1 for the day', async () => {
  const appeal: RawEntity = { id: 'spl-ea', kind: 'spell', name: '정령의 부름', status: 'canon', sim: { cost: '{R}', learn_at: 'loc-a', target: 'self', kicker: { mana: '{1}' }, effects: [{ type: 'create_retainers', creature: 'cre-e', count: 1, pt: [7, 1], colors: ['R'], abilities: ['trample', 'haste'], until_midnight: true, kicked_pump: [7, 0] }] } };
  const world = fixture([appeal, lore('cre-e', 'creature'), npc('chr-c', { ...npcSim('loc-a'), mana: { R: 4 } })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const c = state.actors['chr-c'];
  c.spells = ['spl-ea'];
  castSpell(state, world, c, 'spl-ea', c.id, true, state.minutes);
  const [e] = retainersOf(state, c.id);
  assert.deepEqual(ptOf(e), [14, 1]);
  assert.ok(hasAbility(e, 'trample', state.minutes) && hasAbility(e, 'haste', state.minutes));
  assert.ok(texts(state).some((l) => l.includes('자정에 사라진다')));
  castSpell(state, world, c, 'spl-ea', c.id, false, state.minutes);
  const unkicked = retainersOf(state, c.id).find((x) => x.id !== e.id)!;
  assert.deepEqual(ptOf(unkicked), [7, 1]);
  // Midnight: both gone.
  await advance(state, world, 19, { planDay: async () => [] });
  assert.ok(e.dead && e.left && unkicked.dead);
  assert.deepEqual(retainersOf(state, c.id), []);
  // "Exile it": erased from the world, not a body left behind.
  assert.equal(state.actors[e.id], undefined);
  assert.equal(state.tokens?.[e.id], undefined);
  assert.ok(texts(state).some((l) => l.includes('흩어져 사라졌다')));
});

test('the real Elemental Appeal is taught in Akoum', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-elemental-appeal')!;
  assert.equal(s.learnAt, 'loc-akoum');
  assert.equal(s.kicker?.manaText, '{5}');
});

test('Rite of Replication: a copy of their card, none of what befell them, serves the caster; kicked, five; no planeswalker', () => {
  const rite: RawEntity = { id: 'spl-r', kind: 'spell', name: '복제의 의식', status: 'canon', sim: { cost: '{U}', learn_at: 'loc-a', target: 'any_here', kicker: { mana: '{1}' }, effects: [{ type: 'copy_target', count: 1, kicked_count: 5 }] } };
  const world = fixture([rite, walker, npc('chr-c', { ...npcSim('loc-a'), mana: { U: 9 } }), npc('chr-o', { ...npcSim('loc-a', 'social', [2, 3]), abilities: ['fly'] })]);
  const state = character(world, 'loc-a');
  const [c, o, w, p] = [state.actors['chr-c'], state.actors['chr-o'], state.actors['chr-w'], state.actors[PLAYER_ID]];
  for (const x of [o, w, p]) x.tile = c.tile;
  c.spells = ['spl-r'];
  // What befell the original: counters, an aura, wounds, spells, bonds, memories.
  o.plusCounters = 2;
  o.auras = [{ spell: 'spl-x', name: '오라', by: c.id, pt: [3, 3], doubleLifeOnHit: false, added: ['trample'] }];
  o.abilities = [...o.abilities, 'trample'];
  o.wounds = { day: 0, amount: 1 };
  o.spells = ['spl-r'];
  o.bonds = ['loc-a'];
  o.relations = { [p.id]: { name: '나', text: '오랜 벗', t: 0 } };
  // A planeswalker is no creature.
  assert.match(castBlocked(state, world, c, 'spl-r', w.id, false, state.minutes) ?? '', /플레인즈워커/);
  assert.ok(!castTargets(state, c, world.spells.find((x) => x.id === 'spl-r')!).some((x) => x.id === w.id));
  assert.equal(castBlocked(state, world, c, 'spl-r', o.id, false, state.minutes), null);
  castSpell(state, world, c, 'spl-r', o.id, false, state.minutes);
  const [copy] = retainersOf(state, c.id);
  assert.equal(copy.name, o.name);
  assert.deepEqual(ptOf(copy), [2, 3]);
  assert.ok(hasAbility(copy, 'fly', state.minutes) && !hasAbility(copy, 'trample', state.minutes));
  assert.equal(copy.wounds, undefined);
  assert.equal(copy.spells, undefined);
  assert.equal(copy.bonds, undefined);
  assert.equal(copy.relations?.[p.id], undefined);
  const def = npcDef(state, world, copy.id)!;
  assert.equal(def.copyOf, o.id);
  assert.match(def.persona, /분신/);
  assert.ok(!def.beast);
  assert.ok(texts(state).some((l) => l.includes('분신 하나를 빚었다')));
  // Kicked: five more.
  castSpell(state, world, c, 'spl-r', o.id, true, state.minutes);
  assert.equal(retainersOf(state, c.id).length, 6);
  // The player too: their body by nature.
  castSpell(state, world, c, 'spl-r', p.id, false, state.minutes);
  const me = retainersOf(state, c.id).find((x) => npcDef(state, world, x.id)?.copyOf === p.id)!;
  assert.equal(me.name, '나');
  assert.equal(me.kind, 'npc');
  assert.deepEqual(ptOf(me), [1, 1]);
  // A copy of a fleeting token stays: "exile it at end of turn" is no part of the copy.
  state.tokens![copy.id].vanishAt = state.minutes + 60;
  castSpell(state, world, c, 'spl-r', copy.id, false, state.minutes);
  const twice = retainersOf(state, c.id).find((x) => npcDef(state, world, x.id)?.copyOf === copy.id)!;
  assert.equal(state.tokens![twice.id].vanishAt, undefined);
  // A token: no graveyard.
  destroy(state, world, twice, state.minutes, '시험', o);
  assert.ok(!(c.fallen ?? []).includes(twice.id) && !(o.fallen ?? []).includes(twice.id));
});

test('the real Rite of Replication is taught in Sea Gate: a copy, five kicked for {5}', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-rite-of-replication')!;
  assert.equal(s.learnAt, 'loc-sea-gate');
  assert.equal(s.target, 'any_here');
  assert.equal(s.kicker?.manaText, '{5}');
  assert.deepEqual(s.effects[0], { type: 'copy_target', count: 1, kicked_count: 5 });
});

const bane: RawEntity = { id: 'spl-sb', kind: 'spell', name: '소환자의 파멸', status: 'canon', sim: { cost: '{U}', speed: 'instant', learn_at: 'loc-a', effects: [{ type: 'counter_creature' }, { type: 'create_retainers', creature: 'cre-il', count: 1, pt: [2, 2], colors: ['U'] }] } };
const baneWorld = () =>
  fixture([bane, lore('cre-il', 'creature'), npc('chr-m', npcSim('loc-a')), npc('chr-h', { ...npcSim('loc-a'), mana: { R: 2 }, ally: true, hireable: true }), npc('chr-b', { ...npcSim('loc-a'), mana: { U: 2 } })]);

test('Summoner\'s Bane: one joining another waits an hour on the holder there; answered, it comes to nothing and an Illusion serves the holder', async () => {
  const world = baneWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [m, h, b] = [state.actors['chr-m'], state.actors['chr-h'], state.actors['chr-b']];
  for (const x of [h, b]) x.tile = m.tile;
  b.spells = ['spl-sb'];
  // Only ever cast in answer: no plain casting.
  assert.match(castBlocked(state, world, b, 'spl-sb', h.id, false, state.minutes) ?? '', /막으려고만/);
  assert.match(npcCastBlocked(state, world, b, 'spl-sb', state.minutes) ?? '', /막으려고만/);
  assert.equal(counterHolders(state, world, h, m, state.minutes)[0]?.id, b.id);
  m.stats.coin = 100;
  hireMerc(state, world, m, h.id, state.minutes);
  // Paid, but not theirs yet: the holder is asked.
  assert.equal(h.master, undefined);
  assert.equal(m.stats.coin, 100 - hirePrice(npcDef(state, world, h.id)!));
  assert.equal(state.choices?.[0]?.effect.type, 'counter');
  assert.equal(state.choices?.[0]?.by, b.id);
  const asked: string[] = [];
  await advance(state, world, 1, { planDay: async () => [], pick: async ({ what, options }) => (asked.push(what), options[0].id) });
  assert.match(asked[0], /무산/);
  assert.equal(h.master, undefined);
  assert.equal(m.refused, gameDay(state.minutes));
  assert.equal(m.stats.coin < 100, true); // the coin stays paid
  const [il] = retainersOf(state, b.id);
  assert.deepEqual(ptOf(il), [2, 2]);
  assert.ok(texts(state).some((l) => l.includes('부름이 무산되었다')));
});

test('Summoner\'s Bane left alone, or no one able to pay: the joining goes through', () => {
  const world = baneWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [m, h, b] = [state.actors['chr-m'], state.actors['chr-h'], state.actors['chr-b']];
  for (const x of [h, b]) x.tile = m.tile;
  b.spells = ['spl-sb'];
  summon(state, world, h, m, state.minutes, '설득');
  const c = state.choices!.find((x) => x.effect.type === 'counter')!;
  answerCounter(state, world, b, c.effect as never, false, state.minutes);
  assert.equal(h.master, m.id);
  assert.deepEqual(retainersOf(state, b.id).filter((x) => x.id !== h.id), []);
  // The holder far off: done at once.
  const s2 = newState(world, { seed: 1, mode: 'observer' });
  const [m2, h2, b2] = [s2.actors['chr-m'], s2.actors['chr-h'], s2.actors['chr-b']];
  h2.tile = m2.tile;
  b2.spells = ['spl-sb'];
  b2.tile = tilesOf(world, 'loc-a').find((t) => !sameTile(t, m2.tile))!;
  summon(s2, world, h2, m2, s2.minutes, '설득');
  assert.equal(h2.master, m2.id);
});

test('the real Summoner\'s Bane is taught on Jwar Isle and leaves a 2/2 blue Illusion', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-summoners-bane')!;
  assert.equal(s.learnAt, 'loc-jwar-isle');
  assert.equal(s.costText, '{2}{U}{U}');
  assert.ok(reactionSpell(s));
  assert.deepEqual(s.effects[1], { type: 'create_retainers', creature: 'cre-illusion', count: 1, pt: [2, 2], colors: ['U'] });
});

test('Windborne Charge: two of the caster\'s own (themselves too) get +2/+2 and flying until midnight; it needs two', async () => {
  const charge: RawEntity = { id: 'spl-wc', kind: 'spell', name: '바람 실은 돌격', status: 'canon', sim: { cost: '{W}', learn_at: 'loc-a', target: 'any_here', effects: [{ type: 'pump_own', count: 2, pt: [2, 2], abilities: ['fly'] }] } };
  const world = fixture([charge, npc('chr-c', { ...npcSim('loc-a'), mana: { W: 4 } }), npc('chr-r', npcSim('loc-a')), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, r, x] = [state.actors['chr-c'], state.actors['chr-r'], state.actors['chr-x']];
  for (const a of [r, x]) a.tile = c.tile;
  c.spells = ['spl-wc'];
  // Alone, no retainer: not two of their own.
  assert.match(castBlocked(state, world, c, 'spl-wc', c.id, false, state.minutes) ?? '', /둘이 있어야/);
  bindRetainer(state, world, r, c, state.minutes, '설득');
  // Not someone else's.
  assert.match(castBlocked(state, world, c, 'spl-wc', x.id, false, state.minutes) ?? '', /자신이나 자신의 권속/);
  assert.deepEqual(castTargets(state, c, world.spells.find((s) => s.id === 'spl-wc')!).map((a) => a.id).sort(), [c.id, r.id].sort());
  assert.equal(castBlocked(state, world, c, 'spl-wc', c.id, false, state.minutes), null);
  castSpell(state, world, c, 'spl-wc', c.id, false, state.minutes);
  assert.deepEqual(ptOf(c), [3, 3]);
  assert.ok(hasAbility(c, 'fly', state.minutes));
  // The second: theirs to name after the hour, and one must be named.
  const owed = state.choices!.find((x) => x.effect.type === 'cast')!;
  assert.deepEqual(owed.candidates, [r.id]);
  assert.equal(owed.optional, false);
  await advance(state, world, 1, { planDay: async () => [], choose: async () => null });
  assert.deepEqual(ptOf(r), [3, 3]);
  assert.ok(hasAbility(r, 'fly', state.minutes));
  assert.ok(texts(state).some((l) => l.includes('둘째 대상')));
  // Midnight: gone.
  await advance(state, world, 24, { planDay: async () => [] });
  assert.deepEqual(ptOf(r), [1, 1]);
  assert.ok(!hasAbility(r, 'fly', state.minutes));
});

test('Windborne Charge, the player: the second is a pick they owe, with no "none"', async () => {
  const charge: RawEntity = { id: 'spl-wc', kind: 'spell', name: '바람 실은 돌격', status: 'canon', sim: { cost: '{0}', learn_at: 'loc-a', target: 'any_here', effects: [{ type: 'pump_own', count: 2, pt: [2, 2], abilities: ['fly'] }] } };
  const world = fixture([charge, npc('chr-r', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const [p, r] = [state.actors[PLAYER_ID], state.actors['chr-r']];
  r.tile = p.tile;
  p.spells = ['spl-wc'];
  bindRetainer(state, world, r, p, state.minutes, '설득');
  castSpell(state, world, p, 'spl-wc', p.id, false, state.minutes);
  await advance(state, world, 1, { planDay: async () => [] });
  const ask = state.asks?.[0];
  assert.equal(ask?.effect.type, 'cast');
  assert.deepEqual(askOptions(state, world, ask!).map((o) => o.pick), [r.id]);
  await act(state, world, { type: 'choose', pick: r.id }, { planDay: async () => [] });
  assert.deepEqual(ptOf(r), [3, 3]);
});

test('the real Windborne Charge is taught in Emeria', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-windborne-charge')!;
  assert.equal(s.learnAt, 'loc-emeria');
  assert.deepEqual(s.effects[0], { type: 'pump_own', count: 2, pt: [2, 2], abilities: ['fly'] });
});

test('Bold Defense: the caster and their retainers on their tile +1/+1 until midnight; kicked, +2/+2 and first strike', async () => {
  const bold: RawEntity = { id: 'spl-bd', kind: 'spell', name: '대담한 방어', status: 'canon', sim: { cost: '{W}', speed: 'instant', learn_at: 'loc-a', target: 'self', kicker: { mana: '{1}' }, effects: [{ type: 'pump_controlled', pt: [1, 1], kicked: { pt: [2, 2], abilities: ['first_strike'] } }] } };
  const world = fixture([bold, npc('chr-c', { ...npcSim('loc-a'), mana: { W: 4 } }), npc('chr-r', npcSim('loc-a')), npc('chr-f', npcSim('loc-a')), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, r, f, x] = [state.actors['chr-c'], state.actors['chr-r'], state.actors['chr-f'], state.actors['chr-x']];
  r.tile = x.tile = c.tile;
  f.tile = tilesOf(world, 'loc-a').find((t) => !sameTile(t, c.tile))!;
  r.master = f.master = c.id;
  c.spells = ['spl-bd'];
  castSpell(state, world, c, 'spl-bd', c.id, false, state.minutes);
  assert.deepEqual([ptOf(c), ptOf(r), ptOf(f), ptOf(x)], [[2, 2], [2, 2], [1, 1], [1, 1]]); // far off, or not theirs: nothing
  castSpell(state, world, c, 'spl-bd', c.id, true, state.minutes);
  assert.deepEqual(ptOf(r), [4, 4]);
  assert.ok(hasAbility(r, 'first_strike', state.minutes) && hasAbility(c, 'first_strike', state.minutes));
  await advance(state, world, 19, { planDay: async () => [] });
  assert.deepEqual(ptOf(r), [1, 1]);
  assert.ok(!hasAbility(r, 'first_strike', state.minutes));
});

test('the real Bold Defense is taught at Kabira Crossroads', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-bold-defense')!;
  assert.equal(s.learnAt, 'loc-kabira-crossroads');
  assert.equal(s.kicker?.manaText, '{3}{W}');
});

test('Cancel: a spell cast where one holds it waits an hour; answered, it scatters (mana spent, still known); left alone, it takes hold', async () => {
  const cancel: RawEntity = { id: 'spl-cn', kind: 'spell', name: '취소', status: 'canon', sim: { cost: '{U}', speed: 'instant', learn_at: 'loc-a', effects: [{ type: 'counter_spell' }] } };
  const drain: RawEntity = { id: 'spl-dr', kind: 'spell', name: '흡수', status: 'canon', sim: { cost: '{B}', learn_at: 'loc-a', effects: [{ type: 'lose_half_life' }] } };
  const world = fixture([cancel, drain, npc('chr-c', { ...npcSim('loc-a'), mana: { B: 2 } }), npc('chr-h', { ...npcSim('loc-a'), mana: { U: 2 } }), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, h, x] = [state.actors['chr-c'], state.actors['chr-h'], state.actors['chr-x']];
  h.tile = x.tile = c.tile;
  c.spells = ['spl-dr'];
  h.spells = ['spl-cn'];
  assert.match(castBlocked(state, world, h, 'spl-cn', c.id, false, state.minutes) ?? '', /막으려고만/);
  assert.equal(castSpell(state, world, c, 'spl-dr', x.id, false, state.minutes), 'held');
  assert.equal(lifeOf(x), 20); // not yet
  const asked: string[] = [];
  await advance(state, world, 1, { planDay: async () => [], pick: async ({ what, options }) => (asked.push(what), options[0].id) });
  assert.match(asked[0], /무효화/);
  assert.equal(lifeOf(x), 20);
  assert.ok(c.spells.includes('spl-dr'));
  assert.ok(texts(state).some((l) => l.includes('허공에서 흩어졌다')));
  // Left alone: it takes hold an hour on.
  const s2 = newState(world, { seed: 1, mode: 'observer' });
  const [c2, h2, x2] = [s2.actors['chr-c'], s2.actors['chr-h'], s2.actors['chr-x']];
  h2.tile = x2.tile = c2.tile;
  c2.spells = ['spl-dr'];
  h2.spells = ['spl-cn'];
  castSpell(s2, world, c2, 'spl-dr', x2.id, false, s2.minutes);
  await advance(s2, world, 1, { planDay: async () => [], pick: async () => null });
  assert.equal(lifeOf(x2), 10);
  // A joining (a creature spell) too, with no Illusion left.
  const s3 = newState(world, { seed: 1, mode: 'observer' });
  const [c3, h3, x3] = [s3.actors['chr-c'], s3.actors['chr-h'], s3.actors['chr-x']];
  h3.tile = x3.tile = c3.tile;
  h3.spells = ['spl-cn'];
  summon(s3, world, x3, c3, s3.minutes, '설득');
  const owed = s3.choices!.find((y) => y.effect.type === 'counter')!;
  answerCounter(s3, world, h3, owed.effect as never, true, s3.minutes);
  assert.equal(x3.master, undefined);
  assert.deepEqual(retainersOf(s3, h3.id), []);
});

const merfolkLore: RawEntity = { id: 'cre-mf', kind: 'creature', name: '인어', status: 'canon' };
const mentorSim = (extra: object = {}) => ({ ...npcSim('loc-a', 'work', [2, 2]), mana: { U: 3 }, types: ['merfolk'], counter_tokens: { creature: 'cre-mf', pt: [1, 1], colors: ['U'] }, ...extra });

test('Lullmage Mentor: whenever whoever controls it counters a spell, a 1/1 blue merfolk is born at their side, theirs', async () => {
  const cancel: RawEntity = { id: 'spl-cn', kind: 'spell', name: '취소', status: 'canon', sim: { cost: '{U}', speed: 'instant', learn_at: 'loc-a', effects: [{ type: 'counter_spell' }] } };
  const drain: RawEntity = { id: 'spl-dr', kind: 'spell', name: '흡수', status: 'canon', sim: { cost: '{B}', learn_at: 'loc-a', effects: [{ type: 'lose_half_life' }] } };
  const world = fixture([merfolkLore, cancel, drain, npc('chr-c', { ...npcSim('loc-a'), mana: { B: 2 } }), npc('chr-l', mentorSim({ mana: { U: 3 } })), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, l, x] = [state.actors['chr-c'], state.actors['chr-l'], state.actors['chr-x']];
  l.tile = x.tile = c.tile;
  c.spells = ['spl-dr'];
  l.spells = ['spl-cn'];
  assert.equal(castSpell(state, world, c, 'spl-dr', x.id, false, state.minutes), 'held');
  await advance(state, world, 1, { planDay: async () => [], pick: async ({ options }) => options[0].id });
  const born = retainersOf(state, l.id);
  assert.equal(born.length, 1);
  assert.deepEqual(ptOf(born[0]), [1, 1]);
  assert.ok(npcDef(state, world, born[0].id)?.types?.includes('merfolk'));
});

test('Lullmage Mentor: seven unbound merfolk its controller holds there may answer a spell with no mana; the seven are bound till midnight', async () => {
  const drain: RawEntity = { id: 'spl-dr', kind: 'spell', name: '흡수', status: 'canon', sim: { cost: '{B}', learn_at: 'loc-a', effects: [{ type: 'lose_half_life' }] } };
  const world = fixture([merfolkLore, drain, npc('chr-c', { ...npcSim('loc-a'), mana: { B: 2 } }), npc('chr-l', mentorSim()), npc('chr-x', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const [p, c, l, x] = [state.actors[PLAYER_ID], state.actors['chr-c'], state.actors['chr-l'], state.actors['chr-x']];
  l.master = p.id;
  l.tile = x.tile = c.tile = p.tile;
  c.spells = ['spl-dr'];
  const fins = spawnWild(state, world, 'cre-mf', [1, 1], 5, 'loc-a', ['U'], p.tile);
  for (const f of fins) (f.master = p.id), (state.tokens![f.id].types = ['merfolk']);
  // Six (the mentor and five): not enough.
  assert.equal(castSpell(state, world, c, 'spl-dr', x.id, false, state.minutes), true);
  assert.equal(lifeOf(x), 10);
  const [f6] = spawnWild(state, world, 'cre-mf', [1, 1], 1, 'loc-a', ['U'], p.tile);
  f6.master = p.id;
  state.tokens![f6.id].types = ['merfolk'];
  c.used = {};
  assert.equal(castSpell(state, world, c, 'spl-dr', x.id, false, state.minutes), 'held');
  await act(state, world, { type: 'wait', hours: 1 });
  const ask = state.asks?.find((y) => y.effect.type === 'counter_cast');
  assert.ok(ask);
  assert.match(askText(state, world, ask!), /잠재움의 합창/);
  await act(state, world, { type: 'choose', pick: c.id });
  assert.equal(lifeOf(x), 10); // not halved again
  const merfolk = [l, ...fins, f6];
  assert.ok(merfolk.every((y) => y.boundUntil === 1440));
  assert.equal(retainersOf(state, p.id).length, 8); // a new one for the counter
});

test('the real Lullmage Mentor teaches in Sea Gate; the world\'s merfolk are the mentor, the seastalkers, the wayfinder, the loremaster and the aerialist', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const l = state.actors['chr-lullmage-mentor'];
  assert.equal(l?.region, 'loc-sea-gate');
  assert.deepEqual(npcDef(state, world, l.id)?.counterTokens, { creature: 'cre-merfolk', pt: [1, 1], colors: ['U'] });
  const merfolk = world.npcs.filter((x) => x.types?.includes('merfolk')).map((x) => x.id).sort();
  assert.deepEqual(merfolk, ['chr-lullmage-mentor', 'chr-merfolk-seastalkers', 'chr-merfolk-wayfinder', 'chr-sea-gate-loremaster', 'chr-seascape-aerialist']);
});

test('Cancel held by the player: a pick to answer, or let be', async () => {
  const cancel: RawEntity = { id: 'spl-cn', kind: 'spell', name: '취소', status: 'canon', sim: { cost: '{0}', speed: 'instant', learn_at: 'loc-a', effects: [{ type: 'counter_spell' }] } };
  const drain: RawEntity = { id: 'spl-dr', kind: 'spell', name: '흡수', status: 'canon', sim: { cost: '{0}', learn_at: 'loc-a', effects: [{ type: 'lose_half_life' }] } };
  const world = fixture([cancel, drain, npc('chr-c', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const [p, c] = [state.actors[PLAYER_ID], state.actors['chr-c']];
  c.tile = p.tile;
  c.spells = ['spl-dr'];
  p.spells = ['spl-cn'];
  castSpell(state, world, c, 'spl-dr', p.id, false, state.minutes);
  await advance(state, world, 1, { planDay: async () => [] });
  const ask = state.asks?.[0];
  assert.equal(ask?.effect.type, 'counter_cast');
  assert.deepEqual(askOptions(state, world, ask!).map((o) => o.pick), [c.id, null]);
  await act(state, world, { type: 'choose', pick: c.id }, { planDay: async () => [] });
  assert.equal(lifeOf(p), 20);
});

test('the real Cancel is taught in Tazeem', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-cancel')!;
  assert.equal(s.learnAt, 'loc-tazeem');
  assert.ok(reactionSpell(s));
});

test('a spell cast is used: held still, but not cast again for as many hours as its mana value (a free cast too)', () => {
  const drain: RawEntity = { id: 'spl-dr', kind: 'spell', name: '흡수', status: 'canon', sim: { cost: '{1}{B}{B}', learn_at: 'loc-a', effects: [{ type: 'lose_half_life' }] } };
  const cancel: RawEntity = { id: 'spl-cn', kind: 'spell', name: '취소', status: 'canon', sim: { cost: '{U}', speed: 'instant', learn_at: 'loc-a', effects: [{ type: 'counter_spell' }] } };
  const world = fixture([drain, cancel, npc('chr-c', { ...npcSim('loc-a'), mana: { B: 9 } }), npc('chr-x', npcSim('loc-a')), npc('chr-h', { ...npcSim('loc-a'), mana: { U: 9 } })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, x, h] = [state.actors['chr-c'], state.actors['chr-x'], state.actors['chr-h']];
  x.tile = c.tile;
  c.spells = ['spl-dr'];
  const t = state.minutes;
  castSpell(state, world, c, 'spl-dr', x.id, false, t);
  assert.ok(c.spells.includes('spl-dr')); // still held
  assert.match(castBlocked(state, world, c, 'spl-dr', x.id, false, t + 60) ?? '', /다시 쓸 수 없다/);
  assert.match(npcCastBlocked(state, world, c, 'spl-dr', t + 120) ?? '', /다시 쓸 수 없다/);
  assert.ok(!castableSpells(state, world, c, t + 120).some((s) => s.id === 'spl-dr'));
  assert.equal(castBlocked(state, world, c, 'spl-dr', x.id, false, t + 180), null); // mana value 3: three hours
  // A free cast: used all the same (user decision 2026-10-01).
  const s2 = newState(world, { seed: 1, mode: 'observer' });
  const c2 = s2.actors['chr-c'];
  c2.spells = ['spl-dr'];
  castSpell(s2, world, c2, 'spl-dr', s2.actors['chr-x'].id, false, s2.minutes, true);
  assert.equal(c2.used?.['spl-dr'], s2.minutes + 180);
  // Countered (held by a Cancel there): its mana was paid, so used all the same; the Cancel too.
  const s3 = newState(world, { seed: 1, mode: 'observer' });
  const [c3, x3, h3] = [s3.actors['chr-c'], s3.actors['chr-x'], s3.actors['chr-h']];
  x3.tile = h3.tile = c3.tile;
  c3.spells = ['spl-dr'];
  h3.spells = ['spl-cn'];
  assert.equal(castSpell(s3, world, c3, 'spl-dr', x3.id, false, s3.minutes), 'held');
  assert.ok(c3.used?.['spl-dr']);
  const owed = s3.choices!.find((y) => y.effect.type === 'counter_cast')!;
  answerCounterCast(s3, world, h3, owed.effect as never, true, s3.minutes);
  assert.ok(h3.used?.['spl-cn']);
  // Used (mana value 1: an hour), a Cancel can't answer again until it is ready.
  assert.equal(castSpell(s3, world, c3, 'spl-dr', x3.id, false, s3.minutes + 30), true);
  void h;
});

test('the real Conqueror\'s Pledge is taught in Ondu: six Kor Soldiers, twelve kicked for {6}', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-conquerors-pledge')!;
  assert.equal(s.learnAt, 'loc-ondu');
  assert.equal(s.target, 'self');
  assert.equal(s.kicker?.manaText, '{6}');
  assert.deepEqual(s.effects[0], { type: 'create_retainers', creature: 'cre-kor-soldier', count: 6, kicked_count: 12, pt: [1, 1], colors: ['W'], types: ['kor'] });
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
  (await import('./combat.ts')).dealDamage(state, world, r1, 5, state.minutes, '시험');
  assert.equal(r1.dead, undefined);
  // Midnight: the owner gives one.
  const asked: string[][] = [];
  state.minutes = 1440 - 60;
  await advance(state, world, 2, { pick: async ({ npc, options }) => (asked.push([npc.id, ...options.map((o) => o.id).sort()]), 'chr-r2') });
  // Themselves, those who serve them, or the monument itself (user decision 2026-10-01).
  assert.deepEqual(asked, [['chr-o', 'chr-o', 'chr-r1', 'chr-r2', 'itm-mon']]);
  assert.ok(r2.dead);
  assert.ok(texts(state).some((t) => t.includes('기념비에 바쳐졌다')));
  // Released from it (the owner lost it), the blessing leaves them.
  state.items['itm-mon'].owner = undefined;
  await advance(state, world, 1);
  assert.equal(hasAbility(r1, 'fly', state.minutes), false);
  assert.deepEqual(ptOf(o), [2, 2]);
});

test('an Eldrazi Monument whose owner has nothing to give crumbles away; the player picks from theirs, themselves too', async () => {
  const world = fixture([monument, walker, npc('chr-r', npcSim('loc-a'))]);
  // A planeswalker is no creature: with no retainer, nothing to give.
  const s0 = newState(world, { seed: 1, mode: 'observer' });
  s0.items = { 'itm-mon': { name: '기념비', owner: 'chr-w', counters: 0 } };
  s0.minutes = 1440 - 60;
  await advance(s0, world, 2, { planDay: async () => [] });
  assert.equal(s0.items['itm-mon'].gone, true);
  assert.match(claimBlocked(s0, world, s0.actors['chr-w'], 'itm-mon', s0.minutes)!, /그런 것은 없다/);
  // The player alone: they are a creature they control (user decision 2026-10-01), so they give themselves.
  const state = character(world, 'loc-a');
  state.items = { 'itm-mon': { name: '기념비', owner: PLAYER_ID, counters: 0 } };
  state.minutes = 1440 - 60;
  await act(state, world, { type: 'wait', hours: 2 });
  assert.deepEqual(state.asks?.[0]?.candidates, [PLAYER_ID]);
  // Or let the monument go instead (user decision 2026-10-01).
  assert.ok(askOptions(state, world, state.asks![0]).some((o) => o.pick === 'itm-mon'));
  const keep = structuredClone(state);
  await act(state, world, { type: 'choose', pick: 'itm-mon' });
  assert.ok(!state.actors[PLAYER_ID].dead);
  assert.equal(state.items['itm-mon'].gone, true);
  await act(keep, world, { type: 'choose', pick: PLAYER_ID });
  assert.ok(keep.actors[PLAYER_ID].dead && keep.over);
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

test('intimidate: one who shares none of its colors can\'t strike back at it, but may fly from it', async () => {
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
  // A flyer with no black can't strike back, but may take to the air from it (user decision
  // 2026-10-01).
  x.region = 'loc-b';
  addFoe(d, 'chr-f', state.minutes);
  await advance(state, world, 2, { evade: async () => (asked++, true) });
  assert.equal(asked, 1);
  assert.equal(woundsOf(f, state.minutes), 0);
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

test('the real Bladetusk Boar hunts the snowy canyons of the Teeth of Akoum, intimidating', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const b = state.actors['cre-bladetusk-boar'];
  assert.equal(b?.region, 'loc-teeth-of-akoum');
  assert.ok(hasAbility(b, 'intimidate', state.minutes));
  assert.deepEqual(actorColors(state, world, b), ['R']);
  assert.ok(npcDef(state, world, b.id)?.beast);
});

test('a shade pours mana into itself before each hour of a fight, as much as the LLM will; +1/+1 each until midnight', async () => {
  const shade = { ...npcSim('loc-a', 'work', [2, 2]), mana: { B: 4 }, needs: ['energy'], beast: true, abilities: ['haste'], pump: { cost: '{B}', pt: [1, 1] } };
  const world = fixture([npc('chr-s', shade), npc('chr-x', npcSim('loc-a', 'work', [3, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [sh, x] = [state.actors['chr-s'], state.actors['chr-x']];
  const t0 = state.minutes;
  assert.equal(pumpMax(state, world, sh, t0), 4);
  assert.deepEqual(pumpsDue(state, world, t0), []); // no fight, no pour
  addFoe(sh, 'chr-x', t0);
  const asked: string[][] = [];
  await advance(state, world, 1, { pick: async ({ options }) => (asked.push(options.map((o) => o.id)), '3') });
  assert.deepEqual(asked[0], ['0', '1', '2', '3', '4']);
  assert.deepEqual(ptOf(sh), [5, 5]);
  assert.equal(woundsOf(x, state.minutes), 5); // pumped before the blow
  assert.ok(texts(state).some((l) => l.includes('부풀었다 (자정까지 +3/+3)')));
  assert.equal(pumpMax(state, world, sh, state.minutes), 1);
  // Midnight: the pump is gone.
  await advance(state, world, 24, { pick: async () => '0' });
  assert.deepEqual(ptOf(sh), [2, 2]);
});

test('the player who controls a shade picks how much to pour', async () => {
  const shade = { ...npcSim('loc-a', 'work', [2, 2]), mana: { B: 4 }, needs: ['energy'], beast: true, pump: { cost: '{B}', pt: [1, 1] } };
  const world = fixture([npc('chr-s', shade), npc('chr-x', npcSim('loc-a', 'work', [3, 9]))]);
  const state = character(world, 'loc-a');
  const sh = state.actors['chr-s'];
  bindRetainer(state, world, sh, state.actors[PLAYER_ID], state.minutes, '설득');
  addFoe(sh, 'chr-x', state.minutes);
  await act(state, world, { type: 'wait', hours: 2 });
  const ask = state.asks?.[0];
  assert.equal(ask?.effect.type, 'pour');
  assert.ok(askText(state, world, ask!).includes('얼마나 부을까'));
  await act(state, world, { type: 'choose', pick: '2' });
  assert.equal(sh.pumps?.reduce((n, p) => n + p.pt[0], 0), 2);
});

test('the real Crypt Ripper haunts the Crypt of Agadeem, hasty, pumping on black', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const r = state.actors['cre-crypt-ripper'];
  assert.equal(r?.region, 'loc-agadeem-crypt');
  assert.ok(hasAbility(r, 'haste', state.minutes));
  assert.equal(npcDef(state, world, r.id)?.pump?.costText, '{B}');
  assert.equal(pumpMax(state, world, r, state.minutes), 4);
});

test('double strike: a first-strike blow, then a regular one if both stand', () => {
  const world = fixture([npc('chr-d', { ...npcSim('loc-a', 'work', [2, 4]), abilities: ['double_strike'] }), npc('chr-x', npcSim('loc-a', 'work', [3, 3])), npc('chr-y', npcSim('loc-a', 'work', [2, 2]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [d, x, y] = [state.actors['chr-d'], state.actors['chr-x'], state.actors['chr-y']];
  clash(state, world, d, x, state.minutes);
  // 2 first (3/3 stands), then 2 more as x strikes back 3.
  assert.ok(knockedOut(x));
  assert.equal(woundsOf(d, state.minutes), 3);
  assert.ok(texts(state).some((l) => l.includes('두 번 내리쳤다')));
  // One the first blow fells never strikes back.
  clash(state, world, d, y, state.minutes);
  assert.ok(knockedOut(y));
  assert.equal(woundsOf(d, state.minutes), 3);
});

test('deathtouch: any damage from it fells (a knockout between NPCs, death with the player); not its spells; the indestructible stand; tramples on past 1', () => {
  const world = fixture([
    npc('chr-s', { ...npcSim('loc-a', 'work', [1, 3]), abilities: ['deathtouch'] }),
    npc('chr-x', npcSim('loc-a', 'work', [2, 5])),
    npc('chr-i', { ...npcSim('loc-a', 'work', [0, 5]), abilities: ['indestructible'] }),
    npc('chr-y', npcSim('loc-a', 'work', [1, 9])),
  ]);
  const state = character(world, 'loc-a');
  const [sc, x, i, y, p] = [state.actors['chr-s'], state.actors['chr-x'], state.actors['chr-i'], state.actors['chr-y'], state.actors[PLAYER_ID]];
  const t = state.minutes;
  clash(state, world, sc, x, t);
  assert.ok(knockedOut(x) && !x.dead);
  assert.equal(woundsOf(sc, t), 2);
  assert.ok(texts(state).some((l) => l.includes('죽음의 손길')));
  clash(state, world, sc, i, t);
  assert.ok(!knockedOut(i) && !i.dead);
  // Damage by a spell or land of theirs is not the creature's own.
  dealDamage(state, world, y, 1, t, '주문', false, sc);
  assert.equal(woundsOf(y, t), 1);
  assert.ok(!knockedOut(y));
  // With the player: death.
  dealDamage(state, world, p, 1, t, '침', false, sc, sc);
  assert.ok(p.dead);
});

test('deathtouch with trample: 1 is lethal for the one struck, the rest goes on', () => {
  const world = fixture([
    npc('chr-s', { ...npcSim('loc-a', 'work', [3, 9]), abilities: ['deathtouch', 'trample'] }),
    npc('chr-x', npcSim('loc-a', 'work', [0, 5])),
    npc('chr-z', npcSim('loc-a', 'work', [0, 9])),
  ]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [sc, x, z] = [state.actors['chr-s'], state.actors['chr-x'], state.actors['chr-z']];
  x.tile = sc.tile;
  z.tile = sc.tile;
  clash(state, world, sc, x, state.minutes);
  assert.ok(knockedOut(x));
  assert.ok(knockedOut(z));
  assert.ok(texts(state).some((l) => l.includes('돌진이')));
});

const hook: RawEntity = { id: 'itm-h', kind: 'item', name: '갈고리', status: 'canon', sim: { cost: '{1}', at: 'loc-a', equip: { cost: '{1}', abilities: ['double_strike'], lure: true } } };

test('equipment: tamed, it goes where its owner goes; equipped, its bearer double strikes and a flyer it falls on cannot fly off; dropped where its owner falls', async () => {
  const world = fixture([hook, npc('chr-f', { ...npcSim('loc-b', 'work', [1, 9]), abilities: ['fly'] })]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.bonds = ['loc-a', 'loc-b'];
  await act(state, world, { type: 'claim', item: 'itm-h' });
  assert.equal(itemOwner(state, 'itm-h'), p.id);
  assert.deepEqual(itemsAt(state, world, 'loc-a'), []); // carried, not standing
  await act(state, world, { type: 'equip', item: 'itm-h', to: p.id });
  assert.ok(hasAbility(p, 'double_strike', state.minutes));
  await act(state, world, { type: 'move', to: 'loc-b' });
  assert.equal(itemWhere(state, world, world.items[0])?.region, 'loc-b');
  // The flyer it falls on is dragged down: no asking to fly off.
  const f = state.actors['chr-f'];
  let asked = 0;
  await act(state, world, { type: 'attack', to: 'chr-f' }, { evade: async () => (asked++, true) });
  assert.equal(asked, 0);
  assert.ok(woundsOf(f, state.minutes) >= 2);
  assert.ok(texts(state).some((l) => l.includes('갈고리에 걸려')));
  // The owner falls: it lies there, no one's, unequipped.
  die(state, p, state.minutes, '시험');
  assert.equal(itemOwner(state, 'itm-h'), undefined);
  assert.equal(p.abilities.includes('double_strike'), false);
  assert.deepEqual(itemsAt(state, world, 'loc-b').map((x) => x.id), ['itm-h']);
  assert.match(claimBlocked(state, world, f, 'itm-h', state.minutes) ?? '', /^$|마나/);
});

test('an NPC puts its equipment on a retainer by an equip block; it comes off when the retainer leaves its service', async () => {
  const plan = [
    ['00:00', '06:00', 'loc-a', 'sleep', '잠', '💤'],
    ['06:00', '07:00', 'loc-a', 'equip', '갈고리 매기', '🪝', undefined, undefined, 'chr-r'],
    ['07:00', '24:00', 'loc-a', 'work', '일', '🔨'],
  ];
  const world = fixture([hook, npc('chr-m', { ...npcSim('loc-a'), mana: { W: 2 }, plan }), npc('chr-r', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [m, r] = [state.actors['chr-m'], state.actors['chr-r']];
  state.items = { 'itm-h': { name: '갈고리', owner: m.id, counters: 0, carried: true } };
  bindRetainer(state, world, r, m, state.minutes, '설득');
  await advance(state, world, 1);
  assert.equal(state.items['itm-h'].bearer, r.id);
  assert.ok(hasAbility(r, 'double_strike', state.minutes));
  releaseRetainer(state, r, '시험');
  await advance(state, world, 1);
  assert.equal(state.items['itm-h'].bearer, undefined);
  assert.equal(hasAbility(r, 'double_strike', state.minutes), false);
});

test('the real Grappling Hook lies in the Makindi Trenches', () => {
  const world = loadWorld();
  const x = world.items.find((i) => i.id === 'itm-grappling-hook')!;
  assert.equal(x.at, 'loc-makindi');
  assert.deepEqual(x.equip?.abilities, ['double_strike']);
  assert.ok(x.equip?.lure);
});

test('a specter: a foe beside it with no spell makes it +3/+3; one it wounds lets a spell go', () => {
  const specter = { ...npcSim('loc-a', 'work', [2, 2]), needs: ['energy'], beast: true, abilities: ['fly'], empty_hand_pump: [3, 3], discard_on_hit: true };
  const world = fixture([npc('chr-s', specter), npc('chr-x', npcSim('loc-a', 'work', [1, 20])), npc('chr-y', npcSim('loc-a', 'work', [1, 20]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [sp, x, y] = [state.actors['chr-s'], state.actors['chr-x'], state.actors['chr-y']];
  x.spells = ['spl-a'];
  clash(state, world, sp, x, state.minutes);
  assert.equal(woundsOf(x, state.minutes), 2); // x held a spell: 2/2
  assert.deepEqual(x.spells, []); // one spell: let go at once
  // Now x holds none: 5/5.
  clash(state, world, sp, x, state.minutes);
  assert.equal(woundsOf(x, state.minutes), 7);
  assert.deepEqual(ptOf(sp), [5, 5]);
  // y, no spell from the start: 5/5 against them too.
  clash(state, world, sp, y, state.minutes);
  assert.equal(woundsOf(y, state.minutes), 5);
});

test('the real Guul Draz Specter flies over Guul Draz', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const s = state.actors['cre-guul-draz-specter'];
  assert.equal(s?.region, 'loc-guul-draz');
  assert.ok(hasAbility(s, 'fly', state.minutes));
  assert.deepEqual(npcDef(state, world, s.id)?.emptyHandPump, [3, 3]);
  assert.ok(npcDef(state, world, s.id)?.discardOnHit);
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
  assert.equal(npcDef(state, world, h.id)?.enterDestroy?.kind, 'angel');
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

test('the real Tuktuk Grunts roam the Teeth of Akoum, hasty goblin Allies for 50 coin', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.equal(state.actors['chr-tuktuk-grunts']?.region, 'loc-teeth-of-akoum');
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

test('a thief rifles a hand: the controller sees as many spells as their Allies, and picks one let go of', async () => {
  const thief = { ...npcSim('loc-a', 'work', [2, 2]), mana: { B: 4 }, ally: true, hireable: true, rally: [{ type: 'reveal_discard' }] };
  const other = { ...npcSim('loc-a', 'work', [3, 3]), mana: { R: 5 }, ally: true, hireable: true };
  const world = fixture([npc('chr-t', thief), npc('chr-o', other), npc('chr-x', npcSim('loc-a', 'work', [1, 1]))]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  const x = state.actors['chr-x'];
  x.spells = ['spl-a', 'spl-b', 'spl-c'];
  x.knowledge = [{ id: 'trap:z', text: '숨은 함정' }];
  p.stats.coin = 100;
  await act(state, world, { type: 'hire', to: 'chr-t' });
  assert.equal(state.asks?.[0]?.effect.type, 'rally');
  assert.ok(askText(state, world, state.asks![0]).includes('1가지'));
  await act(state, world, { type: 'choose', pick: 'chr-x' });
  // One Ally: one spell shown; secrets are not discarded (user decision 2026-10-01).
  const ask = state.asks![0];
  assert.equal(ask.effect.type, 'pilfer');
  assert.equal(ask.candidates.length, 1);
  assert.ok(texts(state).some((t) => t.includes('품을 뒤져 주문 1가지를 드러냈다')));
  const shown = ask.candidates[0];
  await act(state, world, { type: 'choose', pick: shown });
  assert.equal(x.spells.length, 2);
  assert.ok(!x.spells.includes(shown));
  assert.deepEqual(x.graveyard, [shown]);
  assert.equal(x.knowledge?.length, 1);
  assert.ok(foesOf(x, state.minutes).includes('chr-t'));
  // Two Allies: two shown.
  await act(state, world, { type: 'hire', to: 'chr-o' });
  await act(state, world, { type: 'choose', pick: 'chr-x' });
  assert.equal(state.asks![0].candidates.length, 2);
  // No spells: nothing to show.
  await act(state, world, { type: 'choose', pick: state.asks![0].candidates[0] });
  x.spells = [];
  revealHand(state, world, p, state.actors['chr-t'], x, 2, state.minutes);
  assert.ok(texts(state).some((t) => t.includes('드러낼 주문이 없었다')));
});

test('an NPC thief\'s master picks the hand to rifle and the card, by the LLM', async () => {
  const thief = { ...npcSim('loc-a', 'work', [2, 2]), mana: { B: 4 }, ally: true, hireable: true, rally: [{ type: 'reveal_discard' }] };
  const world = fixture([npc('chr-t', thief), npc('chr-m', npcSim('loc-a', 'work', [3, 3])), npc('chr-x', npcSim('loc-a', 'work', [1, 1]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [t, m, x] = [state.actors['chr-t'], state.actors['chr-m'], state.actors['chr-x']];
  x.spells = ['spl-a'];
  bindRetainer(state, world, t, m, state.minutes, '고용');
  let picked = '';
  await advance(state, world, 2, { choose: async ({ candidates }) => candidates.find((c) => c.id === 'chr-x')?.id ?? null, pick: async ({ options }) => (picked = options[0].id) });
  assert.equal(picked, 'spl-a');
  assert.deepEqual(x.spells, []);
  assert.deepEqual(x.graveyard, ['spl-a']);
});

test('the real Bala Ged Thief lurks by the buried ruins in the Guum Wilds, an Ally for 40 coin', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const t = state.actors['chr-bala-ged-thief'];
  assert.equal(t?.region, 'loc-guum-wilds');
  const def = world.npcs.find((x) => x.id === 'chr-bala-ged-thief')!;
  assert.equal(hirePrice(def), 40);
  assert.deepEqual(def.rally, [{ type: 'reveal_discard' }]);
  const ruins = eventTile(world, world.events.find((e) => e.id === 'evt-summoning-trap')!)!;
  assert.equal(tileSteps(t.tile!, ruins), 1);
});

test('Day of Judgment: everyone on the caster\'s tile dies, the caster too; a planeswalker and one elsewhere live', () => {
  const doj: RawEntity = { id: 'spl-d', kind: 'spell', name: '심판의 날', status: 'canon', sim: { cost: '{2}{W}{W}', learn_at: 'loc-a', target: 'self', effects: [{ type: 'destroy_all' }] } };
  const world = fixture([doj, walker, npc('chr-c', { ...npcSim('loc-a'), mana: { W: 4 } }), npc('chr-x', npcSim('loc-a')), npc('chr-far', npcSim('loc-b'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, x, w, far] = ['chr-c', 'chr-x', 'chr-w', 'chr-far'].map((id) => state.actors[id]);
  c.spells = ['spl-d'];
  readyCast(state, world, c, 'spl-d', state.minutes);
  assert.ok(c.dead && x.dead);
  assert.ok(!w.dead && !far.dead);
  assert.ok(texts(state).some((l) => l.includes('눈부신 빛')));
});

test('the real Day of Judgment is taught in Emeria', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-day-of-judgment')!;
  assert.equal(s.learnAt, 'loc-emeria');
  assert.deepEqual(s.effects, [{ type: 'destroy_all' }]);
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

test('the real Territorial Baloth lurks in Turntimber: a 4/4 baloth, +2/+2 on landfall', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const b = state.actors['chr-territorial-baloth'];
  assert.equal(b.region, 'loc-turntimber-grove');
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

test('the real Ob Nixilis, the Fallen walks the Guum Wilds of Bala Ged (by the Khalni Heart), a flightless Demon', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const o = state.actors['chr-ob-nixilis'];
  assert.equal(o.region, 'loc-guum-wilds');
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

const demolishSpell: RawEntity = { id: 'spl-dm', kind: 'spell', name: '철거', status: 'canon', sim: { cost: '{1}', learn_at: 'loc-a', target: 'self', effects: [{ type: 'demolish' }] } };

test('demolish: an NPC picks an artifact here, the land here, or a land someone here holds; an aura is no pick', async () => {
  const world = fixture([demolishSpell, bigAura, vessel, npc('chr-c', { ...npcSim('loc-a'), mana: { R: 1 } }), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, x] = [state.actors['chr-c'], state.actors['chr-x']];
  castSpell(state, world, x, 'spl-g', 'chr-x', false, state.minutes);
  x.bonds = ['loc-b'];
  c.spells = ['spl-dm'];
  readyCast(state, world, c, 'spl-dm', state.minutes);
  let seen: string[] = [];
  await advance(state, world, 1, { pick: async ({ options }) => ((seen = options.map((o) => o.id)), 'land:loc-b') });
  assert.deepEqual(seen, ['item:itm-v', 'land:loc-a', 'land:loc-b']);
  assert.ok(state.regions['loc-b'].destroyed);
  assert.equal(state.regions['loc-a']?.destroyed, undefined);
  assert.equal(x.auras?.length, 1);
});

test('demolish by the player: one must go; the artifact standing here', async () => {
  const world = fixture([demolishSpell, vessel]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.spells = ['spl-dm'];
  p.bonds = ['loc-a'];
  await act(state, world, { type: 'cast', spell: 'spl-dm', to: p.id, kick: false });
  await act(state, world, { type: 'wait', hours: 1 });
  const ask = state.asks![0];
  assert.equal(ask.effect.type, 'demolish');
  assert.equal(askOptions(state, world, ask).some((o) => o.pick === null), false);
  await act(state, world, { type: 'choose', pick: 'item:itm-v' });
  assert.ok(state.items?.['itm-v']?.gone);
  assert.equal(state.regions['loc-a']?.destroyed, undefined);
});

const harrowSpell: RawEntity = { id: 'spl-hw', kind: 'spell', name: '써레질', status: 'canon', sim: { cost: '{1}', learn_at: 'loc-a', target: 'self', effects: [{ type: 'harrow', count: 2 }] } };

test('harrow by the player: a land given up (it must), then up to two basic lands bonded from afar, their mana today, not their land for the day', async () => {
  const named: RawEntity = { ...loc('loc-n', 50, 30, 'volcanic'), sim: { nonbasic: true } };
  const world = fixture([harrowSpell, named]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.spells = ['spl-hw'];
  assert.match(castBlocked(state, world, p, 'spl-hw', p.id, false, state.minutes) ?? '', /내어 주어야/);
  p.bonds = ['loc-a'];
  await act(state, world, { type: 'cast', spell: 'spl-hw', to: p.id, kick: false });
  await act(state, world, { type: 'wait', hours: 1 });
  let ask = state.asks![0];
  assert.equal(ask.effect.type, 'harrow');
  assert.deepEqual(ask.candidates, ['loc-a']);
  assert.equal(askOptions(state, world, ask).some((o) => o.pick === null), false);
  await act(state, world, { type: 'choose', pick: 'loc-a' });
  assert.deepEqual(p.bonds, []);
  ask = state.asks![0];
  assert.ok(ask.candidates.includes('loc-b') && ask.candidates.includes('loc-c'));
  assert.ok(!ask.candidates.includes('loc-n')); // a named land is no basic land
  await act(state, world, { type: 'choose', pick: 'loc-b' });
  await act(state, world, { type: 'choose', pick: 'loc-c' });
  assert.deepEqual(p.bonds, ['loc-b', 'loc-c']);
  assert.equal(p.searched, gameDay(state.minutes));
  assert.equal(bondBlocked(state, world, p, state.minutes), null); // still a land of the day to bond
  assert.equal(state.asks?.some((c) => c.effect.type === 'harrow'), false);
});

test('harrow by an NPC: the LLM gives up a land and seeks out basic lands, and may stop after one', async () => {
  const world = fixture([harrowSpell, npc('chr-c', { ...npcSim('loc-a'), mana: { G: 1 } })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const c = state.actors['chr-c'];
  c.bonds = ['loc-c'];
  c.spells = ['spl-hw'];
  readyCast(state, world, c, 'spl-hw', state.minutes);
  let n = 0;
  await advance(state, world, 1, { pick: async ({ options }) => (n++ === 0 ? 'loc-c' : n === 2 ? 'loc-b' : null) });
  assert.deepEqual(c.bonds, ['loc-b']);
});

test('the real Harrow is taught in Tazeem', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-harrow')!;
  assert.equal(s.learnAt, 'loc-tazeem');
  assert.deepEqual(s.effects, [{ type: 'harrow', count: 2 }]);
});

const hideousEnd: RawEntity = { id: 'spl-he', kind: 'spell', name: '흉측한 최후', status: 'canon', sim: { cost: '{1}', learn_at: 'loc-a', effects: [{ type: 'destroy_target', not_color: 'B', lose_life: 2 }] } };

test('hideous end: one there not black is destroyed (between NPCs too) and whoever controls them loses 2 life; the black, planeswalkers and the indestructible are spared', () => {
  const world = fixture([
    hideousEnd,
    npc('chr-c', { ...npcSim('loc-a', 'work'), mana: { B: 3 } }),
    npc('chr-x', { ...npcSim('loc-a', 'work', [3, 3]), mana: { G: 2 } }),
    npc('chr-m', { ...npcSim('loc-a', 'work'), mana: { W: 1 } }),
    npc('chr-v', { ...npcSim('loc-a', 'work'), mana: { B: 2 } }),
    npc('chr-i', { ...npcSim('loc-a', 'work'), mana: { G: 1 }, abilities: ['indestructible'] }),
  ]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, x, m, v, i] = ['chr-c', 'chr-x', 'chr-m', 'chr-v', 'chr-i'].map((id) => state.actors[id]);
  for (const a of [x, m, v, i]) a.tile = c.tile;
  c.spells = ['spl-he'];
  x.master = m.id;
  assert.match(castBlocked(state, world, c, 'spl-he', v.id, false, state.minutes) ?? '', /흑색이라/);
  assert.deepEqual(castTargets(state, c, world.spells[0], world).map((a) => a.id).sort(), ['chr-i', 'chr-m', 'chr-x']);
  assert.equal(castSpell(state, world, c, 'spl-he', x.id, false, state.minutes), true);
  assert.ok(x.dead);
  assert.equal(lifeOf(m), 18); // its master
  c.used = {};
  castSpell(state, world, c, 'spl-he', i.id, false, state.minutes);
  assert.ok(!i.dead);
  assert.equal(lifeOf(i), 18); // stands, but loses the life
  assert.ok(foesOf(i, state.minutes).includes('chr-c'));
});

test('the real Hideous End is taught in the Guum Wilds', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-hideous-end')!;
  assert.equal(s.learnAt, 'loc-guum-wilds');
  assert.deepEqual(s.effects, [{ type: 'destroy_target', not_color: 'B', lose_life: 2 }]);
});

const magmaRift: RawEntity = { id: 'spl-mr', kind: 'spell', name: '용암 균열', status: 'canon', sim: { cost: '{1}', speed: 'sorcery', learn_at: 'loc-a', effects: [{ type: 'sacrifice_land' }, { type: 'damage', amount: 5 }] } };

test('magma rift by the player: a land must be given up, and 5 damage to one there (no planeswalker); none held, it can\'t be cast', async () => {
  const world = fixture([magmaRift, npc('chr-x', npcSim('loc-a', 'work', [0, 6])), being('chr-pw', { home: 'loc-a', abilities: [], pt: [0, 2], loyalty: 3 })]);
  const state = character(world, 'loc-a');
  const [p, x, pw] = [state.actors[PLAYER_ID], state.actors['chr-x'], state.actors['chr-pw']];
  x.tile = pw.tile = p.tile;
  p.spells = ['spl-mr'];
  assert.match(castBlocked(state, world, p, 'spl-mr', x.id, false, state.minutes) ?? '', /내어 주어야/);
  p.bonds = ['loc-a', 'loc-b'];
  assert.match(castBlocked(state, world, p, 'spl-mr', pw.id, false, state.minutes) ?? '', /생물이 아니다/);
  await act(state, world, { type: 'cast', spell: 'spl-mr', to: x.id, kick: false });
  assert.ok(woundsOf(x, state.minutes) >= 5); // (and it may have fought back since)
  if (!state.asks?.length) await act(state, world, { type: 'wait', hours: 1 });
  const ask = state.asks![0];
  assert.equal(ask.effect.type, 'harrow');
  assert.equal(askOptions(state, world, ask).some((o) => o.pick === null), false);
  await act(state, world, { type: 'choose', pick: 'loc-b' });
  assert.deepEqual(p.bonds, ['loc-a']);
  assert.equal(state.asks?.length ?? 0, 0);
});

test('the real Magma Rift is taught in the Teeth of Akoum', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-magma-rift')!;
  assert.equal(s.learnAt, 'loc-teeth-of-akoum');
  assert.deepEqual(s.effects, [{ type: 'sacrifice_land' }, { type: 'damage', amount: 5 }]);
});

const mutiny: RawEntity = { id: 'spl-mm', kind: 'spell', name: '반란의 낙인', status: 'canon', sim: { cost: '{1}', speed: 'sorcery', learn_at: 'loc-a', effects: [{ type: 'threaten', counters: 1, abilities: ['haste'] }] } };

test('mark of mutiny: the target serves the caster till midnight, with a +1/+1 counter for good, unbound and hasty; then back to whom it served', () => {
  const world = fixture([mutiny, npc('chr-c', { ...npcSim('loc-a'), mana: { R: 2 } }), npc('chr-x', npcSim('loc-a', 'work', [2, 2])), npc('chr-m', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, x, m] = ['chr-c', 'chr-x', 'chr-m'].map((id) => state.actors[id]);
  x.tile = m.tile = c.tile;
  x.master = m.id;
  x.boundUntil = 1440;
  c.spells = ['spl-mm'];
  assert.equal(castSpell(state, world, c, 'spl-mm', x.id, false, state.minutes), true);
  assert.equal(x.master, c.id);
  assert.equal(x.boundUntil, undefined);
  assert.deepEqual(ptOf(x), [3, 3]);
  assert.ok(hasAbility(x, 'haste', state.minutes));
  upkeepPossessions(state, 1440);
  assert.equal(x.master, m.id);
  assert.equal(x.seized, undefined);
  assert.deepEqual(ptOf(x), [3, 3]); // the counter stays
});

test('the real Mark of Mutiny is taught in Akoum', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-mark-of-mutiny')!;
  assert.equal(s.learnAt, 'loc-akoum');
  assert.deepEqual(s.effects, [{ type: 'threaten', counters: 1, abilities: ['haste'] }]);
});

test('the real Demolish is taught in Oran-Rief', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-demolish')!;
  assert.equal(s.learnAt, 'loc-oran-rief');
  assert.deepEqual(s.effects, [{ type: 'demolish' }]);
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

const urge: RawEntity = { id: 'spl-u', kind: 'spell', name: '포식 충동', status: 'canon', sim: { cost: '{0}', learn_at: 'loc-a', learn_hours: 1, target: 'any_here', effects: [{ type: 'aura', abilities: ['bite'] }] } };

test('Predatory Urge: its bearer bites one on their tile, each dealing the other their power; the biter is tapped till midnight, the bitten turns foe', async () => {
  const world = fixture([urge, npc('chr-x', npcSim('loc-a', 'work', [2, 5]))]);
  const state = character(world, 'loc-a');
  const [p, x] = [state.actors[PLAYER_ID], state.actors['chr-x']];
  put(world, p, 'loc-a');
  put(world, x, 'loc-a');
  assert.match(biteBlocked(state, world, p, x.id, state.minutes)!, /포식 충동/);
  await act(state, world, { type: 'learn', spell: 'spl-u' });
  await act(state, world, { type: 'cast', spell: 'spl-u', to: PLAYER_ID, kick: false });
  assert.ok(p.abilities.includes('bite'));
  put(world, x, 'loc-a'); // back on the player's tile
  p.pt = [3, 4];
  const [mine, theirs] = [ptOf(p)[0], ptOf(x)[0]];
  assert.ok(startActionOk(state, world, { type: 'bite', to: x.id }));
  bite(state, world, p, x.id, state.minutes); // what the hour's end does
  assert.equal(woundsOf(x, state.minutes), mine);
  assert.equal(woundsOf(p, state.minutes), theirs);
  assert.ok(p.boundUntil !== undefined); // tapped: bound until midnight
  assert.ok(foesOf(x, state.minutes).includes(PLAYER_ID)); // the bitten turns on the biter
  assert.match(biteBlocked(state, world, p, x.id, state.minutes)!, /지금 쓸 수 없다/);
  assert.ok(texts(state).some((t) => t.includes('포식 충동에 사로잡혀') && t.includes('자정까지 묶인다')));
});

test('Predatory Urge: an NPC bites by a plan block, between NPCs it only knocks out; a master has their retainer bite; no planeswalker can be bitten', async () => {
  const biter = { ...npcSim('loc-a', 'work', [4, 4]), plan: [['00:00', '24:00', 'loc-a', 'bite', '물어뜯기', '🦷', null, null, 'chr-y']] };
  const world = fixture([npc('chr-b', biter), npc('chr-y', npcSim('loc-a', 'work', [1, 1])), walker]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [b, y, w] = [state.actors['chr-b'], state.actors['chr-y'], state.actors['chr-w']];
  b.abilities = [...b.abilities, 'bite'];
  await advance(state, world, 3);
  assert.equal(y.dead, undefined); // knocked out, not killed
  assert.ok(texts(state).some((t) => t.includes('쓰러져 기절했다')));
  assert.equal(woundsOf(b, state.minutes), 1);
  assert.ok(b.boundUntil !== undefined);
  // No planeswalker: not a creature.
  b.boundUntil = undefined;
  put(world, w, b.region);
  w.tile = b.tile;
  assert.match(biteBlocked(state, world, b, w.id, state.minutes)!, /플레인즈워커/);
  // A master has the one who serves them bite: the retainer is tapped, not the master.
  const s2 = character(world, 'loc-a');
  const [p, r, y2] = [s2.actors[PLAYER_ID], s2.actors['chr-b'], s2.actors['chr-y']];
  r.master = PLAYER_ID;
  r.abilities = [...r.abilities, 'bite'];
  for (const x of [p, r, y2]) put(world, x, 'loc-a');
  assert.equal(biteBlocked(s2, world, p, y2.id, s2.minutes), null);
  await act(s2, world, { type: 'bite', to: y2.id });
  assert.ok(r.boundUntil !== undefined);
  assert.equal(p.boundUntil, undefined);
  assert.equal(y2.dead, undefined); // two NPCs: a knockout, though one serves the player
  assert.ok(knockedOut(y2));
});

test('the real Predatory Urge is taught in Turntimber: a green aura that gives a bite', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-predatory-urge')!;
  assert.equal(s.learnAt, 'loc-turntimber-grove');
  assert.equal(s.costText, '{3}{G}');
  assert.equal(s.effects.length, 1);
  assert.equal(s.effects[0].type, 'aura');
  assert.deepEqual(s.effects[0].type === 'aura' && s.effects[0].abilities, ['bite']);
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
  // A creature card's whereabouts too, today only (Beast Hunt, 2026-10-01).
  assert.deepEqual(all.sort(), ['creature:chr-x:0', 'item:itm-v', 'spell:spl-bolt', 'trap:evt-rune']);
  assert.match(secretsOf(state, world, state.minutes).find((s) => s.id === 'trap:evt-rune')!.text, /비밀을 3가지 이상 알게 된 이가/);
  const got = drawKnowledge(state, world, x, 5, state.minutes, '시험');
  assert.equal(got.length, 3); // no more than there is (not their own whereabouts)
  assert.equal(handSize(x), 0); // secrets are no hand
  assert.deepEqual(drawKnowledge(state, world, x, 1, state.minutes, '시험'), []);
  assert.ok(texts(state).some((t) => t.includes('더 알아낼 것이 없었다')));
  // A secret of the day passes with it.
  x.knowledge!.push({ id: 'today:0:0', text: '오늘 무엇', day: 0 });
  assert.equal(knownSecrets(x, state.minutes + 1440).some((k) => k.id === 'today:0:0'), false);
});

test('Beast Hunt: three unknown secrets turn up; the caster keeps only creatures\' whereabouts, and it is no draw', () => {
  const hunt: RawEntity = { id: 'spl-h', kind: 'spell', name: '짐승 사냥', status: 'canon', sim: { cost: '{1}', learn_at: 'loc-a', target: 'self', effects: [{ type: 'hunt_creatures', count: 3 }] } };
  const world = fixture([runeflare, bolt, vessel, hunt, npc('chr-x', npcSim('loc-a')), npc('chr-b', { ...npcSim('loc-b'), beast: true, needs: ['energy', 'hunger'] })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const x = state.actors['chr-x'];
  const t = state.minutes;
  // Unknown to them: three of the world's secrets (rune, vessel, the two spells' places) and the beast; not themselves.
  const kept = huntKnowledge(state, world, x, 9, t, '짐승 사냥');
  assert.deepEqual(kept.map((k) => k.id), ['creature:chr-b:0']);
  assert.match(kept[0].text, /말을 하지 않는 짐승, 먹는다/);
  assert.deepEqual(knownSecrets(x, t).map((k) => k.id), ['creature:chr-b:0']);
  assert.equal(x.drawn, undefined); // not a draw
  assert.ok(texts(state).some((l) => l.includes('생물의 자취 1가지를 알게 되었다') && l.includes('흘려보냈다')));
  // Whereabouts pass with the day.
  assert.deepEqual(knownSecrets(x, t + 1440), []);
});

test('the real Beast Hunt is taught in Ondu', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-beast-hunt')!;
  assert.equal(s.learnAt, 'loc-ondu');
  assert.deepEqual(s.effects, [{ type: 'hunt_creatures', count: 3 }]);
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

test('Valakut stands in the Crown of Talib on Beyeen, an island of Ondu: its fire reaches Ondu, its areas and its islands, not Akoum', () => {
  const world = loadWorld();
  assert.equal(region(world, 'loc-valakut').parent, 'loc-crown-of-talib');
  assert.equal(region(world, 'loc-crown-of-talib').parent, 'loc-beyeen');
  assert.equal(region(world, 'loc-beyeen').of, 'loc-ondu');
  assert.deepEqual(landTypes(region(world, 'loc-beyeen')), ['mountain']);
  assert.equal(region(world, 'loc-teetering-peaks').parent, 'loc-makindi');
  const realm = realmOf(world, 'loc-valakut');
  for (const id of ['loc-ondu', 'loc-makindi', 'loc-teetering-peaks', 'loc-graypelt-refuge', 'loc-beyeen', 'loc-crown-of-talib', 'loc-valakut', 'loc-jwar-isle', 'loc-agadeem', 'loc-agadeem-crypt']) assert.ok(realm.includes(id), id);
  assert.equal(realm.includes('loc-akoum'), false);
});

test('the world as the lore lays it out: areas in areas, and the continents where the lore\'s compass puts them', () => {
  const world = loadWorld();
  // Areas in areas (each in the place the lore puts it in).
  for (const [id, parent] of [
    ['loc-ghet-estate', 'loc-malakir'],
    ['loc-piranha-marsh', 'loc-hagra'],
    ['loc-teetering-peaks', 'loc-makindi'],
    ['loc-graypelt-refuge', 'loc-turntimber-grove'],
    ['loc-riverroot', 'loc-guum-wilds'],
    ['loc-bojuka-bay', 'loc-guum-wilds'],
    ['loc-magosi', 'loc-umara-gorge'],
    ['loc-kazandu-refuge', 'loc-kazandu'],
    ['loc-valakut', 'loc-crown-of-talib'],
    ['loc-shatterskull-pass', 'loc-teeth-of-akoum'],
  ]) assert.equal(region(world, id).parent, parent, id);
  assert.equal(region(world, 'loc-teeth-of-akoum').parent, 'loc-akoum');
  // The Guum Wilds covers most of Bala Ged; Oran-Rief most of Tazeem.
  const all = (id: string) => [id, ...descendantsOf(world, id).map((x) => x.id)].reduce((n, x) => n + tilesOf(world, x).length, 0);
  assert.ok(all('loc-guum-wilds') > all('loc-bala-ged') / 2);
  assert.ok(all('loc-oran-rief') >= all('loc-tazeem') / 2);
  // Ondu southwest of Akoum, Sejiri north of it, Bala Ged east of it; Guul Draz south of Bala
  // Ged, and Tazeem west of Guul Draz across narrow waters.
  const at = (id: string) => region(world, id);
  assert.ok(at('loc-ondu').x < at('loc-akoum').x && at('loc-ondu').y > at('loc-akoum').y);
  assert.ok(at('loc-sejiri').y < at('loc-akoum').y);
  assert.ok(at('loc-bala-ged').x > at('loc-akoum').x);
  assert.ok(at('loc-guul-draz').y > at('loc-bala-ged').y);
  assert.ok(at('loc-tazeem').x < at('loc-guul-draz').x);
  const coast = (a: string, b: string) => {
    const ts = (id: string) => [id, ...descendantsOf(world, id).map((x) => x.id)].flatMap((x) => tilesOf(world, x));
    return Math.min(...ts(a).flatMap((x) => ts(b).map((y) => tileSteps(x, y))));
  };
  assert.ok(coast('loc-tazeem', 'loc-guul-draz') <= 6); // narrow waters
  assert.ok(coast('loc-bala-ged', 'loc-guul-draz') <= 1); // the marsh between
  assert.ok(coast('loc-ondu', 'loc-akoum') <= 10); // a small sea
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

test('can\'t block: a retainer won\'t stand by its master against one who fell on them, only join the fights its master starts', () => {
  const croc = { ...npcSim('loc-a', 'work', [3, 1]), needs: ['energy'], abilities: ['cant_block'] };
  const world = fixture([npc('chr-c', croc), npc('chr-g', npcSim('loc-a', 'work', [1, 1])), npc('chr-m', npcSim('loc-a', 'work', [1, 20])), npc('chr-y', npcSim('loc-a', 'work', [1, 20])), npc('chr-z', npcSim('loc-a', 'work', [1, 20]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, g, m, y, z] = ['chr-c', 'chr-g', 'chr-m', 'chr-y', 'chr-z'].map((id) => state.actors[id]);
  for (const a of [c, g, y, z]) a.tile = m.tile;
  c.master = 'chr-m';
  g.master = 'chr-m'; // a retainer that can block, beside it
  let t = state.minutes;
  // y falls on the master: the one who can block stands by them, the crocodile doesn't.
  clash(state, world, y, m, t);
  assert.deepEqual(m.foes?.struck, ['chr-y']);
  hostileNpcs(state, world, t + 60);
  const struckBy = (id: string, foe: string) => state.log.some((e) => e.kind === 'combat' && e.actors[0] === id && e.actors[1] === foe);
  assert.ok(struckBy('chr-g', 'chr-y'));
  assert.ok(!struckBy('chr-c', 'chr-y'));
  // The master falls on z: the crocodile joins in.
  t += 120;
  addFoe(m, 'chr-z', t);
  clash(state, world, m, z, t);
  assert.ok(!m.foes?.struck?.includes('chr-z'));
  hostileNpcs(state, world, t + 60);
  assert.ok(struckBy('chr-c', 'chr-z'));
  assert.ok(!struckBy('chr-c', 'chr-y'));
});

test('the real Hagra Crocodile lurks in the Hagra swamp', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const c = state.actors['cre-hagra-crocodile'];
  assert.equal(c?.region, 'loc-hagra');
  assert.ok(hasAbility(c, 'cant_block', state.minutes));
  assert.deepEqual(npcDef(state, world, c.id)?.landfall?.pt, [2, 2]);
  assert.ok(npcDef(state, world, c.id)?.beast);
});

test('a kicked enter-destroy: with the kicker in its own mana, it may pick anyone there (no planeswalker) and pays as it strikes', () => {
  const mosq = (mana: number) => ({ ...npcSim('loc-a', 'work', [2, 2]), needs: ['energy'], beast: true, abilities: ['fly'], mana: { B: mana }, enter_destroy: { kicker: '{2}{B}' } });
  const world = fixture([npc('chr-m', mosq(4)), npc('chr-poor', mosq(2)), npc('chr-x', npcSim('loc-a', 'work', [1, 20]))]);
  const state = character(world, 'loc-a');
  const [m, poor, x, p] = ['chr-m', 'chr-poor', 'chr-x', PLAYER_ID].map((id) => state.actors[id]);
  for (const a of [poor, x, p]) a.tile = m.tile;
  const t = state.minutes;
  state.choices = [];
  enterDestroy(state, world, m, t);
  const c = state.choices[0];
  assert.deepEqual(c.effect, { type: 'destroy', kind: undefined, kicker: '{2}{B}' });
  assert.ok(c.candidates.includes('chr-x') && c.candidates.includes(PLAYER_ID) && c.candidates.includes('chr-poor'));
  // It strikes: the kicker is paid, the one picked dies.
  applyEnterDestroy(state, world, m, x, t);
  assert.ok(x.dead);
  assert.ok(!planPayment(manaAvailable(state, world, m, t), parseManaCost('{2}{B}')!));
  assert.ok(texts(state).some((l) => l.includes('힘({2}{B})을 더 들여')));
  // One that can't pay the kicker picks no one.
  state.choices = [];
  enterDestroy(state, world, poor, t);
  assert.equal(state.choices.length, 0);
});

test('the real Heartstabber Mosquito flies over the Piranha Marsh', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const m = state.actors['cre-heartstabber-mosquito'];
  assert.equal(m?.region, 'loc-piranha-marsh');
  assert.ok(hasAbility(m, 'fly', state.minutes));
  assert.equal(npcDef(state, world, m.id)?.enterDestroy?.kickerText, '{2}{B}');
  assert.equal(npcDef(state, world, m.id)?.enterDestroy?.kind, undefined);
});

const infernoTrap: RawEntity = {
  id: 'evt-inf',
  kind: 'event',
  name: '지옥불 함정',
  status: 'canon',
  sim: { region: 'loc-a', trigger: 'hurt', creatures: 2, text: '불길이 뿜어 나왔다.', effects: [{ type: 'burn', amount: 4, color: 'R' }] },
};

test('an inferno trap: one hurt by two or more today there, the trap burns one who hurt them (once a day for them)', async () => {
  const world = fixture([infernoTrap, npc('chr-t', npcSim('loc-a', 'work', [0, 30])), npc('chr-a1', npcSim('loc-a', 'work', [1, 9])), npc('chr-a2', npcSim('loc-a', 'work', [2, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [v, a1, a2] = ['chr-t', 'chr-a1', 'chr-a2'].map((id) => state.actors[id]);
  for (const a of [a1, a2]) a.tile = v.tile;
  // One alone: nothing.
  addFoe(a1, 'chr-t', state.minutes);
  const asked: string[][] = [];
  const aim: Llm['aim'] = async ({ targets, beset }) => (asked.push([...beset.map((a) => a.id), ...targets.map((a) => a.id).sort()]), 'chr-a2');
  await advance(state, world, 1, { aim });
  assert.deepEqual(asked, []);
  assert.deepEqual(v.hurtBy?.ids, ['chr-a1']);
  // A second joins in: the trap wakes and burns the one it picks.
  addFoe(a2, 'chr-t', state.minutes);
  await advance(state, world, 1, { aim });
  assert.deepEqual(asked, [['chr-t', 'chr-a1', 'chr-a2']]);
  assert.equal(woundsOf(a2, state.minutes), 4);
  assert.equal(woundsOf(a1, state.minutes), 0);
  assert.ok(texts(state).some((l) => l.includes('지옥불 함정: 불길이')));
  // Set off once a day for them.
  await advance(state, world, 1, { aim });
  assert.equal(asked.length, 1);
});

test('an inferno trap with no usable pick burns the strongest; protection from red shields', () => {
  const world = fixture([npc('chr-t', npcSim('loc-a', 'work', [0, 30])), npc('chr-a1', npcSim('loc-a', 'work', [1, 9])), npc('chr-a2', npcSim('loc-a', 'work', [2, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [v, a1, a2] = ['chr-t', 'chr-a1', 'chr-a2'].map((id) => state.actors[id]);
  for (const a of [a1, a2]) a.tile = v.tile;
  clash(state, world, a1, v, state.minutes);
  clash(state, world, a2, v, state.minutes);
  assert.deepEqual(burnTargets(state, [v], 'R', state.minutes).map((a) => a.id).sort(), ['chr-a1', 'chr-a2']);
  a2.protection = ['R'];
  assert.deepEqual(burnTargets(state, [v], 'R', state.minutes).map((a) => a.id), ['chr-a1']);
});

test('the real Inferno Trap lies in Akoum', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-inferno-trap');
  assert.equal(ev?.region, 'loc-akoum');
  assert.equal(ev?.trigger, 'hurt');
  assert.equal(ev?.creatures, 2);
});

test('a bard\'s song: each Ally joining keeps every Ally of the party awake to danger (vigilance) until midnight', async () => {
  const bard = { ...npcSim('loc-a', 'work', [1, 4]), mana: { G: 4 }, ally: true, hireable: true, rally: [{ type: 'grant_allies', ability: 'vigilance' }] };
  const ogre = { ...npcSim('loc-a', 'work', [3, 2]), mana: { B: 5 }, ally: true, hireable: true };
  const world = fixture([npc('chr-b', bard), npc('chr-o', ogre), npc('chr-y', npcSim('loc-a', 'work', [2, 2]))]);
  const state = character(world, 'loc-a');
  const [p, b, o, y] = [state.actors[PLAYER_ID], state.actors['chr-b'], state.actors['chr-o'], state.actors['chr-y']];
  p.stats.coin = 200;
  await act(state, world, { type: 'hire', to: 'chr-b' });
  await act(state, world, { type: 'hire', to: 'chr-o' });
  assert.ok(hasAbility(b, 'vigilance', state.minutes));
  assert.ok(hasAbility(o, 'vigilance', state.minutes));
  assert.equal(hasAbility(p, 'vigilance', state.minutes), false);
  // Asleep, the ogre is not caught unawares.
  o.task = { kind: 'sleep', activity: '잠', emoji: '😴', until: state.minutes + 360 } as typeof o.task;
  assert.equal(caughtAsleep(y, o, state.minutes), false);
});

test('the real Joraga Bard lives in the Tangled Vale, a basic forest in the south of Bala Ged', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const b = state.actors['chr-joraga-bard'];
  assert.equal(b?.region, 'loc-tangled-vale');
  assert.equal(region(world, 'loc-tangled-vale').parent, 'loc-bala-ged');
  assert.deepEqual(landTypes(region(world, 'loc-tangled-vale')), ['forest']);
  const def = world.npcs.find((x) => x.id === 'chr-joraga-bard')!;
  assert.deepEqual(def.rally, [{ type: 'grant_allies', ability: 'vigilance' }]);
  assert.equal(hirePrice(def), 40);
});

const gem: RawEntity = {
  id: 'itm-gem',
  kind: 'item',
  name: '보석',
  status: 'canon',
  sim: { cost: '{0}', at: 'loc-a', effects: [{ type: 'return_lands', count: 2 }, { type: 'mana', amount: 2 }] },
};

test('a Khalni Gem: tamed, the player gives back two bonds of their pick, one at a time; it gives two mana of any color a day', async () => {
  const world = fixture([gem]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.tile = itemWhere(state, world, world.items[0])!.tile;
  p.bonds = ['loc-a', 'loc-b', 'loc-c'];
  await act(state, world, { type: 'claim', item: 'itm-gem' });
  assert.equal(itemOwner(state, 'itm-gem'), PLAYER_ID);
  assert.deepEqual(state.asks?.[0]?.effect, { type: 'return_lands', item: 'itm-gem', left: 2 });
  await act(state, world, { type: 'choose', pick: 'loc-b' });
  assert.deepEqual(state.asks?.[0]?.candidates, ['loc-a', 'loc-c']);
  await act(state, world, { type: 'choose', pick: 'loc-c' });
  assert.deepEqual(p.bonds, ['loc-a']);
  assert.equal(state.asks?.length ?? 0, 0);
  assert.ok(texts(state).some((l) => l.includes('유대를 보석에 내어 주었다')));
  // Two of any color, red twice over.
  const cap = manaCapacity(state, world, p, state.minutes);
  assert.equal(cap['W/U/B/R/G'], 2);
  assert.ok(planPayment(manaAvailable(state, world, p, state.minutes), parseManaCost('{R}{R}')!));
});

test('a Khalni Gem tamed by an NPC: two bonds or fewer all go at once; more, the LLM picks', async () => {
  const world = fixture([gem, npc('chr-n', npcSim('loc-a', 'work')), npc('chr-m', npcSim('loc-a', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [n, m] = [state.actors['chr-n'], state.actors['chr-m']];
  const tile = itemWhere(state, world, world.items[0])!.tile;
  n.tile = m.tile = tile;
  n.bonds = ['loc-a', 'loc-b'];
  claimItem(state, world, n, 'itm-gem', state.minutes);
  assert.deepEqual(n.bonds, []);
  // Another with three: the LLM gives back the forest, then one more.
  state.items = {};
  m.bonds = ['loc-a', 'loc-b', 'loc-c'];
  claimItem(state, world, m, 'itm-gem', state.minutes);
  const picks: string[][] = [];
  await advance(state, world, 1, { pick: async ({ options }) => (picks.push(options.map((o) => o.id)), options.some((o) => o.id === 'loc-b') ? 'loc-b' : 'loc-a') });
  assert.deepEqual(picks, [['loc-a', 'loc-b', 'loc-c'], ['loc-a', 'loc-c']]);
  assert.deepEqual(m.bonds, ['loc-c']);
});

test('the real Khalni Gem lies at the heart of Ora Ondar, a basic forest in the north of Akoum', () => {
  const world = loadWorld();
  const x = world.items.find((i) => i.id === 'itm-khalni-gem')!;
  assert.equal(x.at, 'loc-ora-ondar');
  assert.equal(region(world, 'loc-ora-ondar').parent, 'loc-akoum');
  assert.deepEqual(landTypes(region(world, 'loc-ora-ondar')), ['forest']);
  assert.deepEqual(x.effects, [{ type: 'return_lands', count: 2 }, { type: 'mana', amount: 2 }]);
});

test('a Kor Cartographer arriving: its controller may bond from afar with a plains they lack, tapped today (an NPC by the LLM, the player by a pick)', async () => {
  const cart = { ...npcSim('loc-b', 'work', [2, 2]), mana: { W: 4 }, enter_search: { types: ['plains'], tapped: true } };
  const world = fixture([npc('chr-k', cart)]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const k = state.actors['chr-k'];
  onEnter(state, world, k, state.minutes);
  assert.deepEqual(state.choices?.[0]?.effect, { type: 'search', source: 'chr-k' });
  assert.deepEqual(state.choices?.[0]?.candidates, ['loc-a']);
  const offered: string[][] = [];
  await advance(state, world, 1, { pick: async ({ options }) => (offered.push(options.map((o) => o.id)), 'loc-a') });
  assert.deepEqual(offered, [['loc-a']]);
  assert.ok(k.bonds?.includes('loc-a'));
  assert.equal(k.searched, gameDay(state.minutes));
  assert.equal(manaCapacity(state, world, k, state.minutes).W, 4); // the plains gives nothing today
  assert.ok(texts(state).some((l) => l.includes('잊힌 길을 더듬어')));
  // Its master is the player: theirs to pick, or not.
  const s2 = character(world, 'loc-b');
  const p = s2.actors[PLAYER_ID];
  s2.actors['chr-k'].master = PLAYER_ID;
  onEnter(s2, world, s2.actors['chr-k'], s2.minutes);
  assert.equal(s2.asks?.[0]?.effect.type, 'search');
  await act(s2, world, { type: 'choose', pick: 'loc-a' });
  assert.ok(p.bonds?.includes('loc-a'));
  assert.equal(s2.actors['chr-k'].bonds?.includes('loc-a') ?? false, false);
});

test('the real Kor Cartographer walks the Makindi Trenches', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const k = state.actors['chr-kor-cartographer'];
  assert.equal(k?.region, 'loc-makindi');
  assert.deepEqual(npcDef(state, world, k.id)?.enterSearch, { types: ['plains'], tapped: true });
});

test('a lethargy trap: three or more striking in the same hour there, each attacker gets -3/-0 until midnight (power not below 0)', async () => {
  const lethargy: RawEntity = { id: 'evt-leth', kind: 'event', name: '무기력 함정', status: 'canon', sim: { region: 'loc-a', trigger: 'attacked', attackers: 3, text: '안개가 피어올랐다.', effects: [{ type: 'pump_attackers', pt: [-3, 0] }] } };
  const band = ['chr-a1', 'chr-a2', 'chr-a3'];
  const world = fixture([lethargy, npc('chr-t', npcSim('loc-a', 'work', [0, 30])), npc('chr-a1', npcSim('loc-a', 'work', [5, 9])), npc('chr-a2', npcSim('loc-a', 'work', [2, 9])), npc('chr-a3', npcSim('loc-a', 'work', [1, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  for (const id of band) addFoe(state.actors[id], 'chr-t', state.minutes);
  await advance(state, world, 1);
  assert.deepEqual(ptOf(state.actors['chr-a1']), [2, 9]);
  assert.deepEqual(ptOf(state.actors['chr-a2']), [0, 9]);
  assert.deepEqual(ptOf(state.actors['chr-a3']), [0, 9]);
  assert.deepEqual(ptOf(state.actors['chr-t']), [0, 30]);
  // Next hour, the sapped strike for no more than they have.
  const before = woundsOf(state.actors['chr-t'], state.minutes);
  await advance(state, world, 1);
  assert.equal(woundsOf(state.actors['chr-t'], state.minutes) - before, 2);
  // Midnight: back to themselves.
  const midnight = (Math.floor(state.minutes / 1440) + 1) * 1440;
  for (const id of band) state.actors[id].foes = undefined;
  await advance(state, world, Math.ceil((midnight - state.minutes) / 60) + 1);
  assert.deepEqual(ptOf(state.actors['chr-a1']), [5, 9]);
});

test('the real Lethargy Trap lies on the Soaring Seacliff', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-lethargy-trap');
  assert.equal(ev?.region, 'loc-soaring-seacliff');
  assert.equal(ev?.attackers, 3);
});

test('a living tsunami: at midnight its master gives back a land to keep it, or it collapses; a free one pays nothing', async () => {
  const tsunami = { ...npcSim('loc-a', 'work', [4, 4]), needs: ['energy'], beast: true, abilities: ['fly'], upkeep_return_land: true };
  const world = fixture([npc('chr-w', tsunami), npc('chr-m', npcSim('loc-a', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [w, m] = [state.actors['chr-w'], state.actors['chr-m']];
  // Free: nothing at midnight.
  state.minutes = 1440 - 60;
  await advance(state, world, 2);
  assert.equal(w.dead, undefined);
  // Serving m with two lands: m gives back the forest.
  w.master = 'chr-m';
  m.bonds = ['loc-a', 'loc-b'];
  state.minutes = 2 * 1440 - 60;
  const offered: string[][] = [];
  await advance(state, world, 2, { pick: async ({ options }) => (offered.push(options.map((o) => o.id)), 'loc-b') });
  assert.deepEqual(offered, [['loc-a', 'loc-b']]);
  assert.deepEqual(m.bonds, ['loc-a']);
  assert.equal(w.dead, undefined);
  // Next midnight m gives none: it collapses.
  state.minutes = 3 * 1440 - 60;
  await advance(state, world, 2, { pick: async () => null });
  assert.ok(w.dead);
  assert.ok(texts(state).some((l) => l.includes('썰물처럼 무너져')));
});

test('a living tsunami serving the player: theirs to give a land or let it go', async () => {
  const tsunami = { ...npcSim('loc-a', 'work', [4, 4]), needs: ['energy'], beast: true, abilities: ['fly'], upkeep_return_land: true };
  const world = fixture([npc('chr-w', tsunami)]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  state.actors['chr-w'].master = PLAYER_ID;
  p.bonds = ['loc-a'];
  state.minutes = 1440 - 60;
  await act(state, world, { type: 'wait', hours: 2 });
  assert.equal(state.asks?.[0]?.effect.type, 'tide');
  await act(state, world, { type: 'choose', pick: 'loc-a' });
  assert.deepEqual(p.bonds, []);
  assert.equal(state.actors['chr-w'].dead, undefined);
  // No land left next midnight: it goes.
  state.minutes = 2 * 1440 - 60;
  await act(state, world, { type: 'wait', hours: 2 });
  assert.ok(state.actors['chr-w'].dead);
});

test('the real Living Tsunami rises off the Silundi Coast', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const w = state.actors['cre-living-tsunami'];
  assert.equal(w?.region, 'loc-silundi-coast');
  assert.ok(hasAbility(w, 'fly', state.minutes));
  const def = npcDef(state, world, w.id)!;
  assert.ok(def.upkeepReturnLand && def.beast);
});

test('seastalkers in a fight: before the hour its controller may pay {2}{U} to bind a foe there who can\'t fly, until midnight', async () => {
  const stalkers = { ...npcSim('loc-a', 'work', [2, 3]), mana: { U: 4 }, tap_foe: { cost: '{2}{U}', no_fly: true } };
  const flyer = { ...npcSim('loc-a', 'work', [1, 9]), abilities: ['fly'] };
  const world = fixture([npc('chr-s', stalkers), npc('chr-x', npcSim('loc-a', 'work', [1, 9])), npc('chr-f', flyer)]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [s, x, f] = ['chr-s', 'chr-x', 'chr-f'].map((id) => state.actors[id]);
  for (const a of [x, f]) a.tile = s.tile;
  addFoe(s, 'chr-x', state.minutes);
  addFoe(s, 'chr-f', state.minutes);
  assert.deepEqual(bindTargets(state, world, s, state.minutes).map((a) => a.id), ['chr-x']); // not the flyer
  const offered: string[][] = [];
  await advance(state, world, 1, { pick: async ({ options }) => (offered.push(options.map((o) => o.id)), options.some((o) => o.id === 'chr-x') ? 'chr-x' : null) });
  assert.ok(offered.some((o) => o.includes('chr-x')));
  assert.equal(x.boundUntil, 1440);
  assert.ok(texts(state).some((l) => l.includes('물살로 휘감아 묶었다')));
  assert.equal(manaAvailable(state, world, s, state.minutes).U, 1);
  // Bound: no more to bind there (and it can't pay twice anyway).
  assert.deepEqual(bindTargets(state, world, s, state.minutes), []);
});

test('seastalkers serving the player: theirs to pick whom to bind, or none', async () => {
  const stalkers = { ...npcSim('loc-a', 'work', [2, 3]), mana: { U: 4 }, tap_foe: { cost: '{2}{U}', no_fly: true } };
  const world = fixture([npc('chr-s', stalkers), npc('chr-x', npcSim('loc-a', 'work', [1, 9]))]);
  const state = character(world, 'loc-a');
  const [p, s, x] = [state.actors[PLAYER_ID], state.actors['chr-s'], state.actors['chr-x']];
  s.master = PLAYER_ID;
  s.tile = x.tile = p.tile;
  addFoe(p, 'chr-x', state.minutes);
  await act(state, world, { type: 'wait', hours: 1 });
  const ask = state.asks?.find((c) => c.effect.type === 'bind');
  assert.ok(ask);
  assert.deepEqual(ask!.candidates, ['chr-x']);
  await act(state, world, { type: 'choose', pick: 'chr-x' });
  assert.ok(x.boundUntil !== undefined);
});

const gomazoa = (extra: object = {}) => ({ ...npcSim('loc-b', 'work', [0, 3]), needs: ['energy', 'hunger'], beast: true, abilities: ['defender', 'fly'], engulf: true, ...extra });

test('a gomazoa with no master: one who falls on it is wrapped up and dragged with it to where it lives, stripped, bound in its tentacles; it feeds and is tapped till midnight', async () => {
  const world = fixture([npc('chr-g', gomazoa())]);
  const state = character(world, 'loc-a');
  const [p, g] = [state.actors[PLAYER_ID], state.actors['chr-g']];
  put(world, g, 'loc-a');
  g.tile = p.tile;
  g.stats.hunger = 80;
  p.plusCounters = 2;
  p.abilities = [...p.abilities, 'trample'];
  p.auras = [{ spell: 'spl-q', name: '축복', by: 'chr-x', pt: [1, 1], doubleLifeOnHit: false, added: ['trample'] }];
  addFoe(g, PLAYER_ID, state.minutes); // the player fell on it
  addFoe(p, 'chr-g', state.minutes);
  await act(state, world, { type: 'wait', hours: 1 });
  assert.equal(p.region, 'loc-b');
  assert.equal(g.region, 'loc-b');
  assert.deepEqual(p.tile, g.tile);
  // Bound in the tentacles: the player's turn waits it out.
  assert.ok(texts(state).some((l) => l.includes('촉수에 묶여 4시간')));
  assert.ok(state.minutes >= 6 * 60 + 4 * 60);
  assert.equal(p.plusCounters, undefined);
  assert.equal(p.auras, undefined);
  assert.ok(!p.abilities.includes('trample'));
  assert.equal(g.boundUntil, 1440);
  assert.ok(g.stats.hunger < 80 - 30); // fed (it has grown a little hungry again since)
  assert.ok(!foesOf(p, state.minutes).includes('chr-g'));
  assert.ok(texts(state).some((l) => l.includes('촉수로')));
  // Tapped: no more catching today.
  assert.deepEqual(engulfTargets(state, world, g, state.minutes), []);
});

test('a gomazoa serving someone: its master decides whether to drag off one who fell on them (the gomazoa leaves them); the player\'s is a pick; a token is eaten', async () => {
  const world = fixture([npc('chr-g', gomazoa()), npc('chr-m', npcSim('loc-a', 'work', [2, 2])), npc('chr-x', npcSim('loc-a', 'work', [3, 3])), npc('chr-y', npcSim('loc-a', 'work', [1, 1]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [g, m, x, y] = ['chr-g', 'chr-m', 'chr-x', 'chr-y'].map((id) => state.actors[id]);
  put(world, g, 'loc-a');
  g.master = m.id;
  g.tile = x.tile = y.tile = m.tile;
  addFoe(m, x.id, state.minutes);
  m.foes!.struck = [x.id]; // x fell on the master: the gomazoa blocks x
  addFoe(m, y.id, state.minutes); // the master fell on y: not blocking
  assert.deepEqual(engulfTargets(state, world, g, state.minutes).map((a) => a.id), ['chr-x']);
  await advance(state, world, 1, { pick: async ({ options }) => (options.some((o) => o.id === 'chr-x') ? 'chr-x' : null) });
  assert.equal(x.region, 'loc-b');
  assert.equal(g.region, 'loc-b');
  assert.equal(g.master, undefined);
  // A token caught is eaten.
  const world2 = fixture([npc('chr-g', gomazoa())]);
  const s2 = character(world2, 'loc-a');
  const [p, g2] = [s2.actors[PLAYER_ID], s2.actors['chr-g']];
  put(world2, g2, 'loc-a');
  g2.master = PLAYER_ID;
  g2.tile = p.tile;
  const tok = { ...p, id: 'tok-1', kind: 'npc' as const, name: '정령', master: undefined };
  s2.actors[tok.id] = tok;
  (s2.tokens ??= {})[tok.id] = { ...world2.npcs[0], id: tok.id, engulf: false };
  addFoe(p, tok.id, s2.minutes);
  p.foes!.struck = [tok.id];
  await act(s2, world2, { type: 'wait', hours: 1 });
  const ask = s2.asks?.find((c) => c.effect.type === 'engulf');
  assert.deepEqual(ask?.candidates, ['tok-1']);
  await act(s2, world2, { type: 'choose', pick: 'tok-1' });
  assert.ok(s2.actors['tok-1'].dead && s2.actors['tok-1'].left);
  assert.equal(g2.region, 'loc-b');
});

test('the real Gomazoa drifts over Tazeem: a 0/3 flying defender that drags off those it blocks', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['cre-gomazoa'];
  assert.equal(g?.region, 'loc-tazeem');
  const def = npcDef(state, world, g.id)!;
  assert.ok(def.beast && def.engulf && hasAbility(g, 'defender', state.minutes) && hasAbility(g, 'fly', state.minutes));
  assert.deepEqual(ptOf(g), [0, 3]);
});

test('Grazing Gladehart: each time it bonds with a land, its controller gains 2 life (itself, with no master)', () => {
  const world = fixture([npc('chr-h', { ...npcSim('loc-a', 'work', [2, 2]), needs: ['energy'], beast: true, landfall_life: 2 }), npc('chr-m', npcSim('loc-a', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [h, m] = [state.actors['chr-h'], state.actors['chr-m']];
  bondLand(state, world, h, state.minutes, 'loc-a');
  assert.equal(lifeOf(h), 22);
  h.master = m.id;
  bondLand(state, world, h, state.minutes, 'loc-b');
  assert.equal(lifeOf(m), 22);
  assert.equal(lifeOf(h), 22);
  assert.equal(m.lifeGained, gameDay(state.minutes));
});

test('the real Grazing Gladehart grazes in Oran-Rief: a gentle beast, 2 life to its controller on landfall', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const h = state.actors['cre-grazing-gladehart'];
  assert.equal(h?.region, 'loc-oran-rief');
  const def = npcDef(state, world, h.id)!;
  assert.ok(def.beast && !def.needs.includes('hunger'));
  assert.equal(def.landfallLife, 2);
});

test('Greenweaver Druid: {G}{G} a day for whoever controls it, standing with them, awake, powers unsealed', () => {
  const world = fixture([npc('chr-d', { ...npcSim('loc-a', 'work', [1, 1]), mana: { G: 3 }, types: ['elf'], tap_mana: { G: 2 } })]);
  const state = character(world, 'loc-a');
  const [p, d] = [state.actors[PLAYER_ID], state.actors['chr-d']];
  const t = state.minutes;
  assert.equal(manaCapacity(state, world, d, t).G, 5); // its own, with no master
  d.master = p.id;
  d.tile = p.tile;
  assert.equal(manaCapacity(state, world, p, t).G, 2);
  assert.equal(manaCapacity(state, world, d, t).G, 3);
  d.tile = [p.tile![0] + 1, p.tile![1]];
  assert.equal(manaCapacity(state, world, p, t).G ?? 0, 0); // not with them
  d.tile = p.tile;
  d.forced = { kind: 'sleep', activity: '기절', emoji: '😵', until: t + 60 };
  assert.equal(manaCapacity(state, world, p, t).G ?? 0, 0); // knocked out
  d.forced = undefined;
  d.sealedOut = gameDay(t);
  assert.equal(manaCapacity(state, world, p, t).G ?? 0, 0); // sealed
});

test('the real Greenweaver Druid lives in Riverroot with the Mul Daya: an elf who weaves {G}{G}', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const d = state.actors['chr-greenweaver-druid'];
  assert.equal(d?.region, 'loc-riverroot');
  const def = npcDef(state, world, d.id)!;
  assert.ok(!def.beast && def.types?.includes('elf'));
  assert.deepEqual(def.tapMana, { G: 2 });
  assert.equal(manaCapacity(state, world, d, state.minutes).G, 5);
});

test('Hellfire Mongrel: at 00:00, 2 damage to each on its tile but its side holding two spells or fewer (a knockout between NPCs)', () => {
  const hound = { ...npcSim('loc-a', 'work', [2, 2]), needs: ['energy', 'hunger'], beast: true, mana: { R: 3 }, upkeep_burn: { damage: 2, max_hand: 2 } };
  const world = fixture([npc('chr-h', hound), npc('chr-m', npcSim('loc-a', 'work', [1, 1])), npc('chr-x', npcSim('loc-a', 'work', [1, 2])), npc('chr-y', npcSim('loc-a', 'work', [1, 5])), npc('chr-z', npcSim('loc-a', 'work', [1, 5]))]);
  const state = character(world, 'loc-a');
  const [p, h, m, x, y, z] = [PLAYER_ID, 'chr-h', 'chr-m', 'chr-x', 'chr-y', 'chr-z'].map((id) => state.actors[id]);
  for (const a of [m, x, y, z]) a.tile = p.tile;
  h.tile = p.tile;
  h.master = m.id;
  y.spells = ['a', 'b', 'c'];
  z.master = m.id; // the master's side
  upkeepScorch(state, world, 1440);
  assert.ok(knockedOut(x) && !x.dead);
  assert.equal(woundsOf(y, 1440), 0);
  assert.equal(woundsOf(z, 1440), 0);
  assert.equal(woundsOf(m, 1440), 0);
  assert.ok(woundsOf(p, 1440) === 2 || p.dead);
  assert.ok(foesOf(x, 1440).includes('chr-h') || knockedOut(x));
  assert.ok(texts(state).some((l) => l.includes('불길을 토했다')));
});

test('the real Hellfire Mongrel roams Akoum: a hungry beast that may follow someone, burning the empty-handed at midnight', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const h = state.actors['cre-hellfire-mongrel'];
  assert.equal(h?.region, 'loc-akoum');
  const def = npcDef(state, world, h.id)!;
  assert.ok(def.beast && def.needs.includes('hunger'));
  assert.deepEqual(def.upkeepBurn, { damage: 2, maxHand: 2 });
});

const evangel = () => npc('chr-e', { ...npcSim('loc-a', 'work', [2, 3]), mana: { W: 3 }, ally: true, hireable: true, rally: [{ type: 'ward_allies' }] });

test('Kabira Evangel: an Ally joining, the controller may name a color; the party\'s Allies are protected from it until midnight', async () => {
  const world = fixture([evangel(), npc('chr-m', npcSim('loc-a', 'work')), npc('chr-o', { ...npcSim('loc-a', 'work'), ally: true })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [e, m, o] = ['chr-e', 'chr-m', 'chr-o'].map((id) => state.actors[id]);
  e.master = m.id;
  o.master = m.id;
  allyJoined(state, world, o, m, state.minutes);
  assert.deepEqual(state.choices?.find((c) => c.effect.type === 'ward')?.candidates, ['W', 'U', 'B', 'R', 'G']);
  await advance(state, world, 1, { pick: async ({ options }) => (options.some((x) => x.id === 'R') ? 'R' : null) });
  for (const a of [e, o]) assert.equal(protectedFrom(a, ['R'], state.minutes), 'R');
  assert.equal(protectedFrom(m, ['R'], state.minutes), undefined); // not an Ally
  assert.equal(protectedFrom(e, ['R'], 1440), undefined); // gone at midnight
});

test('Kabira Evangel serving the player: the color is theirs to name, or none', async () => {
  const world = fixture([evangel()]);
  const state = character(world, 'loc-a');
  const [p, e] = [state.actors[PLAYER_ID], state.actors['chr-e']];
  e.master = p.id;
  e.tile = p.tile;
  allyJoined(state, world, e, p, state.minutes);
  await act(state, world, { type: 'wait', hours: 1 });
  const ask = state.asks?.find((c) => c.effect.type === 'ward');
  assert.ok(ask);
  assert.ok(askOptions(state, world, ask!).some((o) => o.pick === null));
  await act(state, world, { type: 'choose', pick: 'B' });
  assert.equal(protectedFrom(e, ['B'], state.minutes), 'B');
});

test('the real Kabira Evangel preaches at Kabira Crossroads: an Ally for 30 coin', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const e = state.actors['chr-kabira-evangel'];
  assert.equal(e?.region, 'loc-kabira-crossroads');
  const def = world.npcs.find((x) => x.id === 'chr-kabira-evangel')!;
  assert.deepEqual(def.rally, [{ type: 'ward_allies' }]);
  assert.equal(hirePrice(def), 30);
});

test('Kor Hookmaster arriving: its controller must bind one there not of its side, past the next midnight until the one after', async () => {
  const world = fixture([npc('chr-k', { ...npcSim('loc-a', 'work', [2, 2]), mana: { W: 3 }, enter_tap: true }), npc('chr-m', npcSim('loc-a', 'work')), npc('chr-x', npcSim('loc-a', 'work')), npc('chr-r', npcSim('loc-a', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [k, m, x, r] = ['chr-k', 'chr-m', 'chr-x', 'chr-r'].map((id) => state.actors[id]);
  for (const a of [m, x, r]) a.tile = k.tile;
  k.master = m.id;
  r.master = m.id;
  onEnter(state, world, k, state.minutes);
  const c = state.choices!.find((y) => y.effect.type === 'hook')!;
  assert.equal(c.by, 'chr-m');
  assert.deepEqual(c.candidates, ['chr-x']); // not its side
  assert.ok(!c.optional);
  await advance(state, world, 1, { choose: async () => null }); // no answer: one all the same
  assert.equal(x.boundUntil, 2 * 1440);
  assert.ok(foesOf(x, state.minutes).includes('chr-k'));
});

test('Kor Hookmaster serving the player: whom to bind is theirs to pick', async () => {
  const world = fixture([npc('chr-k', { ...npcSim('loc-a', 'work', [2, 2]), mana: { W: 3 }, enter_tap: true }), npc('chr-x', npcSim('loc-a', 'work'))]);
  const state = character(world, 'loc-a');
  const [p, k, x] = [state.actors[PLAYER_ID], state.actors['chr-k'], state.actors['chr-x']];
  k.master = p.id;
  k.tile = x.tile = p.tile;
  onEnter(state, world, k, state.minutes);
  await act(state, world, { type: 'wait', hours: 1 });
  const ask = state.asks?.find((c) => c.effect.type === 'hook');
  assert.deepEqual(ask?.candidates, ['chr-x']);
  await act(state, world, { type: 'choose', pick: 'chr-x' });
  assert.equal(x.boundUntil, 2 * 1440);
});

test('the real Kor Hookmaster lives in Makindi: a speaking kor soldier who binds one on arriving', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const k = state.actors['chr-kor-hookmaster'];
  assert.equal(k?.region, 'loc-makindi');
  const def = npcDef(state, world, k.id)!;
  assert.ok(def.enterTap && !def.beast);
});

test('a defender blocks: it stands against one who fell on its master first, but never joins the fights its master starts', () => {
  const world = fixture([npc('chr-d', { ...npcSim('loc-a', 'work', [1, 5]), abilities: ['defender'] }), npc('chr-m', npcSim('loc-a', 'work', [0, 9])), npc('chr-x', npcSim('loc-a', 'work', [0, 9])), npc('chr-y', npcSim('loc-a', 'work', [0, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [d, m, x, y] = ['chr-d', 'chr-m', 'chr-x', 'chr-y'].map((id) => state.actors[id]);
  for (const a of [m, x, y]) a.tile = d.tile;
  d.master = m.id;
  clash(state, world, x, m, state.minutes); // x fell on the master
  state.minutes += 60;
  hostileNpcs(state, world, state.minutes);
  assert.ok(woundsOf(x, state.minutes) >= 1); // the defender struck x (the master has no power)
  assert.ok(foesOf(x, state.minutes).includes('chr-d'));
  // The master starts a fight: the defender stays out.
  const s2 = newState(world, { seed: 1, mode: 'observer' });
  const [d2, m2, y2] = ['chr-d', 'chr-m', 'chr-y'].map((id) => s2.actors[id]);
  m2.tile = y2.tile = d2.tile;
  d2.master = m2.id;
  clash(s2, world, m2, y2, s2.minutes);
  s2.minutes += 60;
  hostileNpcs(s2, world, s2.minutes);
  assert.ok(!foesOf(y2, s2.minutes).includes('chr-d'));
});

test('the real Makindi Shieldmate guards in Makindi: a defender Ally for 30 coin, steadier with each Ally', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const sm = state.actors['chr-makindi-shieldmate'];
  assert.equal(sm?.region, 'loc-makindi');
  const def = world.npcs.find((x) => x.id === 'chr-makindi-shieldmate')!;
  assert.ok(hasAbility(sm, 'defender', state.minutes) && def.ally);
  assert.deepEqual(def.rally, [{ type: 'counter_self' }]);
  assert.equal(hirePrice(def), 30);
  assert.deepEqual(ptOf(sm), [0, 3]);
});

test('Merfolk Wayfinder arriving: lands of the world come up for its controller; islands they don\'t hold go into their hand, to bond with from afar as their land for a day', async () => {
  const isles = [loc('loc-i1', 40, 20, 'beach'), loc('loc-i2', 44, 24, 'beach')];
  const world = fixture([...isles, npc('chr-w', { ...npcSim('loc-a', 'work', [1, 2]), mana: { U: 3 }, abilities: ['fly'], types: ['merfolk'], enter_reveal: { count: 40, land_type: 'island' } })]);
  const state = character(world, 'loc-a');
  const [p, w] = [state.actors[PLAYER_ID], state.actors['chr-w']];
  w.master = p.id;
  w.tile = p.tile;
  p.bonds = ['loc-i1'];
  onEnter(state, world, w, state.minutes);
  assert.ok(p.handLands?.length);
  assert.ok(p.handLands!.every((id) => landTypes(region(world, id)).includes('island')));
  assert.ok(!p.handLands!.includes('loc-i1')); // held already
  assert.ok(p.handLands!.includes('loc-i2'));
  await act(state, world, { type: 'fetch', from: 'hand', to: 'loc-i2' });
  assert.ok(p.bonds.includes('loc-i2'));
  assert.ok(!p.handLands!.includes('loc-i2'));
  // It was their land for the day.
  assert.ok(bondBlocked(state, world, p, state.minutes));
});

test('the real Merfolk Wayfinder scouts the skies of Tazeem: a flying merfolk who shows the way to islands', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const w = state.actors['chr-merfolk-wayfinder'];
  assert.equal(w?.region, 'loc-tazeem');
  const def = npcDef(state, world, w.id)!;
  assert.ok(hasAbility(w, 'fly', state.minutes) && def.types?.includes('merfolk'));
  assert.deepEqual(def.enterReveal, { count: 3, type: 'island' });
});

test('the real Merfolk Seastalkers lurk in Bojuka Bay, a basic island on the edge of the Guum Wilds in Bala Ged: islandwalk', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const s = state.actors['chr-merfolk-seastalkers'];
  assert.equal(s?.region, 'loc-bojuka-bay');
  assert.equal(region(world, 'loc-bojuka-bay').parent, 'loc-guum-wilds');
  assert.equal(region(world, 'loc-bojuka-bay').top, 'loc-bala-ged');
  assert.deepEqual(landTypes(region(world, 'loc-bojuka-bay')), ['island']);
  assert.ok(hasAbility(s, 'islandwalk', state.minutes));
  assert.equal(npcDef(state, world, s.id)?.tapFoe?.costText, '{2}{U}');
  const d = state.actors[Object.keys(state.actors).find((id) => id !== s.id && !npcDef(state, world, id)?.loyalty)!];
  d.bonds = ['loc-sea-gate'];
  assert.equal(landwalked(world, s, d, state.minutes), 'island');
});

test('a mindbreak trap: one casting their third spell of the day there sees it break, and forgets it; free casts don\'t count', () => {
  const mind: RawEntity = { id: 'evt-mind', kind: 'event', name: '정신파괴 함정', status: 'canon', sim: { region: 'loc-a', trigger: 'cast', spells: 3, text: '주문이 부서졌다.', effects: [{ type: 'counter_spell' }] } };
  const heal: RawEntity = { id: 'spl-h', kind: 'spell', name: '치유', status: 'canon', sim: { cost: '{0}', learn_at: 'loc-a', target: 'self', effects: [{ type: 'aura', pt: [1, 1] }] } };
  const world = fixture([mind, heal, npc('chr-c', npcSim('loc-a', 'work')), npc('chr-far', npcSim('loc-b', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, far] = [state.actors['chr-c'], state.actors['chr-far']];
  c.spells = ['spl-h'];
  far.spells = ['spl-h'];
  const t = state.minutes;
  castSpell(state, world, c, 'spl-h', c.id, false, t);
  castSpell(state, world, c, 'spl-h', c.id, false, t, true); // free: not counted
  castSpell(state, world, c, 'spl-h', c.id, false, t);
  assert.equal(c.auras?.length, 3);
  castSpell(state, world, c, 'spl-h', c.id, false, t); // the third counted: broken
  assert.equal(c.auras?.length, 3);
  assert.deepEqual(c.spells, []);
  // An NPC's goes to their graveyard: forgotten, to be learned again (exile without the player is
  // one step lighter, user decision 2026-10-01).
  assert.ok(texts(state).some((l) => l.includes('그 주문을 잊었다')));
  assert.deepEqual(c.graveyard, ['spl-h']);
  assert.equal(c.exiled, undefined);
  assert.equal(learnBlocked(world, c, 'spl-h'), null);
  // Elsewhere, no trap.
  for (let i = 0; i < 3; i++) castSpell(state, world, far, 'spl-h', far.id, false, t);
  assert.equal(far.auras?.length, 3);
  assert.deepEqual(far.spells, ['spl-h']);
});

test('a mindbreak trap on the player: the broken spell is exiled, theirs never again', () => {
  const mind: RawEntity = { id: 'evt-mind', kind: 'event', name: '정신파괴 함정', status: 'canon', sim: { region: 'loc-a', trigger: 'cast', spells: 1, text: '주문이 부서졌다.', effects: [{ type: 'counter_spell' }] } };
  const heal: RawEntity = { id: 'spl-h', kind: 'spell', name: '치유', status: 'canon', sim: { cost: '{0}', learn_at: 'loc-a', target: 'self', effects: [{ type: 'aura', pt: [1, 1] }] } };
  const world = fixture([mind, heal]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  p.spells = ['spl-h'];
  castSpell(state, world, p, 'spl-h', p.id, false, state.minutes);
  assert.ok(texts(state).some((l) => l.includes('허공에서 부서져 사라졌다')));
  assert.deepEqual(p.exiled, ['spl-h']);
  assert.match(learnBlocked(world, p, 'spl-h')!, /추방되어/);
});

test('the real Mindbreak Trap lies in Tazeem', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-mindbreak-trap');
  assert.equal(ev?.region, 'loc-tazeem');
  assert.equal(ev?.trigger, 'cast');
  assert.equal(ev?.spells, 3);
});

test('a mold shambler arriving: with {1}{G} in its own mana it may break a noncreature permanent on its tile (item, aura, land), paying as it strikes', async () => {
  const shambler = { ...npcSim('loc-a', 'work', [3, 3]), needs: ['energy'], beast: true, mana: { G: 4 }, enter_shatter: { kicker: '{1}{G}' } };
  const relic: RawEntity = { id: 'itm-r', kind: 'item', name: '유물', status: 'canon', sim: { cost: '{0}', at: 'loc-a', effects: [{ type: 'mana', amount: 1 }] } };
  const world = fixture([relic, npc('chr-s', shambler), npc('chr-x', npcSim('loc-a', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [s, x] = [state.actors['chr-s'], state.actors['chr-x']];
  s.tile = x.tile = itemWhere(state, world, world.items[0])!.tile;
  x.bonds = ['loc-b'];
  x.auras = [{ spell: 'spl-q', name: '축복', by: 'chr-x', pt: [1, 1], doubleLifeOnHit: false }];
  onEnter(state, world, s, state.minutes);
  const c = state.choices!.find((y) => y.effect.type === 'shatter')!;
  assert.deepEqual([...c.candidates].sort(), ['aura:chr-x:0:spl-q', 'item:itm-r', 'land:loc-a', 'land:loc-b']);
  await advance(state, world, 1, { pick: async ({ options }) => (options.some((o) => o.id === 'land:loc-b') ? 'land:loc-b' : null) });
  assert.ok(state.regions['loc-b']?.destroyed);
  assert.equal(manaAvailable(state, world, s, state.minutes).G, 2);
  // Once a day: today's arrival is spent.
  assert.equal(s.enteredDay, gameDay(state.minutes));
});

test('Goblin Ruinblaster arriving: kicked from its own mana ({R}), it may break a nonbasic land on its tile, and nothing else', async () => {
  const blaster = { ...npcSim('loc-a', 'work', [2, 1]), mana: { R: 4 }, abilities: ['haste'], enter_shatter: { kicker: '{R}', nonbasic: true } };
  const relic: RawEntity = { id: 'itm-r', kind: 'item', name: '유물', status: 'canon', sim: { cost: '{0}', at: 'loc-a', effects: [{ type: 'mana', amount: 1 }] } };
  const named: RawEntity = { ...loc('loc-n', 50, 30, 'volcanic'), sim: { nonbasic: true } };
  const world = fixture([relic, named, npc('chr-g', blaster), npc('chr-x', npcSim('loc-a', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [g, x] = [state.actors['chr-g'], state.actors['chr-x']];
  g.tile = x.tile = itemWhere(state, world, world.items[0])!.tile;
  x.bonds = ['loc-b', 'loc-n'];
  onEnter(state, world, g, state.minutes);
  const c = state.choices!.find((y) => y.effect.type === 'shatter')!;
  assert.deepEqual(c.candidates, ['land:loc-n']);
  await advance(state, world, 1, { pick: async ({ options }) => options[0]?.id ?? null });
  assert.ok(state.regions['loc-n']?.destroyed);
  assert.ok(!state.regions['loc-b']?.destroyed);
  assert.equal(manaAvailable(state, world, g, state.minutes).R, 3);
  assert.ok(texts(state).some((l) => l.includes('폭탄')));
});

test('the real Goblin Ruinblaster runs the Teeth of Akoum: a speaking goblin shaman, hasty, kicker {R} for a nonbasic land', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['chr-goblin-ruinblaster'];
  assert.equal(g?.region, 'loc-teeth-of-akoum');
  const def = npcDef(state, world, g.id)!;
  assert.ok(!def.beast && hasAbility(g, 'haste', state.minutes));
  assert.deepEqual(def.enterShatter, { kicker: { generic: 0, colored: { R: 1 } }, kickerText: '{R}', nonbasic: true });
  assert.deepEqual(ptOf(g), [2, 1]);
});

test('Kor Sanctifiers arriving: kicked from their own mana ({W}), they may destroy an artifact or enchantment on their tile, never a land', async () => {
  const sanct = { ...npcSim('loc-a', 'work', [2, 3]), mana: { W: 4 }, enter_shatter: { kicker: '{W}', relics: true } };
  const relic: RawEntity = { id: 'itm-r', kind: 'item', name: '유물', status: 'canon', sim: { cost: '{0}', at: 'loc-a', effects: [{ type: 'mana', amount: 1 }] } };
  const world = fixture([relic, npc('chr-s', sanct), npc('chr-x', npcSim('loc-a', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [sn, x] = [state.actors['chr-s'], state.actors['chr-x']];
  sn.tile = x.tile = itemWhere(state, world, world.items[0])!.tile;
  x.bonds = ['loc-b'];
  x.auras = [{ spell: 'spl-q', name: '축복', by: 'chr-x', pt: [1, 1], doubleLifeOnHit: false }];
  onEnter(state, world, sn, state.minutes);
  const c = state.choices!.find((y) => y.effect.type === 'shatter')!;
  assert.deepEqual([...c.candidates].sort(), ['aura:chr-x:0:spl-q', 'item:itm-r']);
  await advance(state, world, 1, { pick: async ({ options }) => (options.some((o) => o.id === 'item:itm-r') ? 'item:itm-r' : null) });
  assert.ok(state.items?.['itm-r']?.gone);
  assert.equal(manaAvailable(state, world, sn, state.minutes).W, 3);
});

test('the real Kor Sanctifiers walk the Arid Mesa: kicker {W} for an artifact or enchantment', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const sn = state.actors['chr-kor-sanctifiers'];
  assert.equal(sn?.region, 'loc-arid-mesa');
  assert.deepEqual(npcDef(state, world, sn.id)?.enterShatter, { kicker: { generic: 0, colored: { W: 1 } }, kickerText: '{W}', relics: true });
});

test('the real Mold Shambler roams by Kazandu Refuge', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const s = state.actors['cre-mold-shambler'];
  assert.equal(s?.region, 'loc-kazandu-refuge');
  assert.equal(npcDef(state, world, s.id)?.enterShatter?.kickerText, '{1}{G}');
});

test('the real Nimana Sell-Sword seeks work in the Free City of Nimana, a basic swamp on the coast of Guul Draz: an Ally for 40 coin', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const s = state.actors['chr-nimana-sell-sword'];
  assert.equal(s?.region, 'loc-nimana');
  assert.equal(region(world, 'loc-nimana').parent, 'loc-guul-draz');
  assert.deepEqual(landTypes(region(world, 'loc-nimana')), ['swamp']);
  const def = world.npcs.find((x) => x.id === 'chr-nimana-sell-sword')!;
  assert.deepEqual(def.rally, [{ type: 'counter_self' }]);
  assert.equal(hirePrice(def), 40);
});

test('Nissa Revane: +1 calls an elf warrior to her side, +1 gains 2 life per elf serving her, −7 draws every free elf in the world to her', () => {
  const chosen: RawEntity = { id: 'cre-ch', kind: 'creature', name: '선택받은 자', status: 'canon' };
  const nissa = being('chr-n', {
    home: 'loc-a',
    abilities: [],
    pt: [0, 2],
    loyalty: 7,
    activated: [
      { id: 'call', name: '부르기', loyalty: 1, target: false, effects: [{ type: 'create_token', creature: 'cre-ch', pt: [2, 3], colors: ['G'], types: ['elf'] }] },
      { id: 'kin', name: '엘프의 피', loyalty: 1, target: false, effects: [{ type: 'gain_life_per', kind: 'elf', amount: 2 }] },
      { id: 'gather', name: '집결', loyalty: -7, target: false, effects: [{ type: 'call_kind', kind: 'elf' }] },
    ],
  });
  const elf = (region: string) => ({ ...npcSim(region, 'work'), types: ['elf'] });
  const world = fixture([chosen, nissa, npc('chr-e1', elf('loc-b')), npc('chr-e2', elf('loc-c')), npc('chr-h', npcSim('loc-b', 'work')), npc('chr-m', npcSim('loc-b', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const n = state.actors['chr-n'];
  let t = state.minutes;
  assert.equal(useAbility(state, world, 'chr-n', 'call', '', t), null);
  const born = Object.values(state.actors).find((x) => x.master === 'chr-n')!;
  assert.deepEqual(ptOf(born), [2, 3]);
  assert.deepEqual(npcDef(state, world, born.id)?.types, ['elf']);
  // Next day: 2 life for the one elf serving her.
  t += 1440;
  const before = n.life ?? 20;
  assert.equal(useAbility(state, world, 'chr-n', 'kin', '', t), null);
  assert.equal((n.life ?? 20) - before, 2);
  // e2 serves someone already: not called. e1 comes from afar; the human stays.
  state.actors['chr-e2'].master = 'chr-m';
  t += 1440;
  assert.equal(useAbility(state, world, 'chr-n', 'gather', '', t), null);
  assert.equal(state.actors['chr-e1'].master, 'chr-n');
  assert.equal(state.actors['chr-e1'].region, n.region);
  assert.equal(state.actors['chr-e2'].master, 'chr-m');
  assert.equal(state.actors['chr-h'].master, undefined);
});

test('the real Nissa Revane bides in the Tangled Vale; the world\'s elves are the ranger, the bard, the oracle and the druid', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const n = state.actors['chr-nissa-revane'];
  assert.equal(n?.region, 'loc-tangled-vale');
  assert.equal(n.loyalty, 2);
  assert.deepEqual(npcDef(state, world, n.id)?.activated?.map((x) => x.loyalty), [1, 1, -7]);
  const elves = world.npcs.filter((x) => x.types?.includes('elf')).map((x) => x.id).sort();
  assert.deepEqual(elves, ['chr-frontier-guide', 'chr-greenweaver-druid', 'chr-joraga-bard', 'chr-oracle-of-mul-daya', 'chr-tajuru-archer', 'chr-turntimber-ranger']);
});

test('a blaze counter: the target\'s latest unburning land catches fire; all bonded with it lose 1 life each midnight, even after the fireheart dies, until the land is destroyed', async () => {
  const heart = being('chr-f', { home: 'loc-a', abilities: [], pt: [4, 4], mana: { R: 4 }, activated: [{ id: 'blaze', name: '불씨 심기', cost: '{1}{R}{R}', effects: [{ type: 'blaze_land' }] }] });
  const world = fixture([heart, npc('chr-x', npcSim('loc-a', 'work')), npc('chr-y', npcSim('loc-a', 'work'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [f, x, y] = ['chr-f', 'chr-x', 'chr-y'].map((id) => state.actors[id]);
  x.bonds = ['loc-a', 'loc-b'];
  y.bonds = ['loc-b'];
  assert.equal(useAbility(state, world, 'chr-f', 'blaze', 'chr-x', state.minutes), null);
  assert.ok(state.regions['loc-b'].blaze);
  assert.equal(state.regions['loc-a'].blaze, undefined);
  // The fireheart dies; the land burns on.
  (await import('./combat.ts')).die(state, f, state.minutes, '시험');
  state.minutes = 1440 - 60;
  await advance(state, world, 2);
  assert.equal(lifeOf(x), 19);
  assert.equal(lifeOf(y), 19);
  // Destroyed, it stops.
  destroyLand(state, world, 'loc-b', [], state.minutes, '시험');
  assert.equal(state.regions['loc-b'].blaze, undefined);
});

test('the real Obsidian Fireheart burns in Valakut', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const f = state.actors['cre-obsidian-fireheart'];
  assert.equal(f?.region, 'loc-valakut');
  assert.deepEqual(npcDef(state, world, f.id)?.activated?.[0]?.effects, [{ type: 'blaze_land' }]);
});

test('an area in an area: it takes its tiles from the area it lies in; events, travel and names reach through', () => {
  const area = (id: string, parent: string, tiles: number, pos?: [number, number]): RawEntity => ({ id, kind: 'location', name: id, status: 'canon', map: { in: parent, terrain: 'forest', tiles, ...(pos ? { pos } : {}) } });
  const { world, errors } = buildWorld([{ ...loc('loc-a', 10, 10, 'forest'), map: { x: 600, y: 600, terrain: 'forest', size: 'continent', tiles: 120 } } as RawEntity, area('loc-wild', 'loc-a', 50, [0, -0.4]), area('loc-root', 'loc-wild', 10, [0, 0]), area('loc-vale', 'loc-a', 10, [0, 0.8])]);
  assert.deepEqual(errors, []);
  const tiles = (id: string) => world.tiles![id];
  assert.equal(tiles('loc-root').length, 10);
  assert.equal(tiles('loc-wild').length, 40); // 50, less its own area
  assert.ok(tiles('loc-root').every((t) => world.tileOwner![`${t[0]},${t[1]}`] === 'loc-root'));
  assert.equal(region(world, 'loc-root').top, 'loc-a');
  assert.equal(placeName(world, region(world, 'loc-root')), 'loc-a › loc-wild › loc-root');
  assert.ok(within(world, 'loc-root', 'loc-a') && within(world, 'loc-root', 'loc-wild') && !within(world, 'loc-vale', 'loc-wild'));
  assert.deepEqual(descendantsOf(world, 'loc-a').map((r) => r.id).sort(), ['loc-root', 'loc-vale', 'loc-wild']);
  // Within one land at the top: an hour apart, as any two areas.
  assert.equal(travelHours(region(world, 'loc-root'), region(world, 'loc-vale'), []), 1);
  assert.deepEqual(tooSmall(world), []);
});

test('an oracle of Mul Daya: its controller bonds with one more land a day; at midnight a land of the world comes up on top, to bond with from afar unless already theirs', async () => {
  const oracle = { ...npcSim('loc-a', 'work', [2, 2]), mana: { G: 4 }, types: ['elf'], extra_lands: 1, reveal_top: true };
  const world = fixture([npc('chr-o', oracle)]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  state.actors['chr-o'].master = PLAYER_ID;
  // Two lands today: loc-a here, then loc-b.
  await act(state, world, { type: 'bond' });
  assert.ok(p.bonds?.includes('loc-a'));
  await act(state, world, { type: 'move', to: 'loc-b' });
  assert.equal((await act(state, world, { type: 'bond' })).error, undefined);
  assert.ok(p.bonds?.includes('loc-b'));
  // A third is too many.
  await act(state, world, { type: 'move', to: 'loc-c' });
  assert.match(bondBlocked(state, world, p, state.minutes) ?? '', /이미 2 땅/);
  // Midnight: a land comes up on top. One not yet theirs: bond from afar.
  state.minutes = (Math.floor(state.minutes / 1440) + 1) * 1440 - 60;
  await act(state, world, { type: 'wait', hours: 2 });
  const top = p.topLand?.land;
  assert.ok(top);
  assert.ok(texts(state).some((l) => l.includes('다음에 맺을 땅은')));
  p.topLand = { day: gameDay(state.minutes), land: 'loc-c' };
  const r = await act(state, world, { type: 'fetch', from: 'top', to: 'loc-c' });
  assert.equal(r.error, undefined);
  assert.ok(p.bonds?.includes('loc-c'));
  // One already theirs comes up: no use.
  p.topLand = { day: gameDay(state.minutes), land: 'loc-a' };
  assert.match((await act(state, world, { type: 'fetch', from: 'top', to: 'loc-a' })).error ?? '', /이미/);
});

test('the real Shatterskull Giant lives in Shatterskull Pass, over the Teeth of Akoum: a speaking 4/3 who eats', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['cre-shatterskull-giant'];
  assert.equal(g?.region, 'loc-shatterskull-pass');
  assert.equal(placeName(world, region(world, 'loc-shatterskull-pass')), '아쿰 › 아쿰의 이빨 › 섀터스컬 고개');
  assert.deepEqual(landTypes(region(world, 'loc-shatterskull-pass')), ['mountain']);
  assert.equal(tilesOf(world, 'loc-shatterskull-pass').length, 10);
  assert.deepEqual(ptOf(g), [4, 3]);
  const def = npcDef(state, world, g.id)!;
  assert.ok(!def.beast);
  assert.deepEqual(def.needs, ['energy', 'hunger']);
});

test('Timbermaw Larva: the first time a day it falls on someone, +1/+1 per Forest its controller holds until midnight', async () => {
  const world = fixture([npc('chr-l', { ...npcSim('loc-a', 'social', [2, 2]), attack_pump: { land: 'forest', pt: [1, 1] } }), npc('chr-x', npcSim('loc-a', 'social', [0, 9])), npc('chr-y', npcSim('loc-a', 'social', [0, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [l, x, y] = [state.actors['chr-l'], state.actors['chr-x'], state.actors['chr-y']];
  for (const a of [x, y]) a.tile = l.tile;
  // Wild, with no forest: nothing.
  clash(state, world, l, x, state.minutes);
  assert.deepEqual(ptOf(l), [2, 2]);
  // Its own forests count (once a day: the next day).
  const s2 = newState(world, { seed: 1, mode: 'observer' });
  const [l2, x2, y2] = [s2.actors['chr-l'], s2.actors['chr-x'], s2.actors['chr-y']];
  for (const a of [x2, y2]) a.tile = l2.tile;
  l2.bonds = ['loc-b'];
  clash(s2, world, l2, x2, s2.minutes);
  assert.deepEqual(ptOf(l2), [3, 3]);
  assert.ok(texts(s2).some((t) => t.includes('부풀었다')));
  clash(s2, world, l2, y2, s2.minutes + 60);
  assert.deepEqual(ptOf(l2), [3, 3]); // once a day
  // Struck back at (the defender) it doesn't swell; serving someone, its master's forests count.
  const s3 = newState(world, { seed: 1, mode: 'observer' });
  const [l3, x3] = [s3.actors['chr-l'], s3.actors['chr-x']];
  x3.tile = l3.tile;
  clash(s3, world, x3, l3, s3.minutes);
  assert.deepEqual(ptOf(l3), [2, 2]);
  const m = s3.actors['chr-y'];
  m.tile = l3.tile;
  m.bonds = ['loc-b'];
  l3.master = m.id;
  l3.bonds = [];
  clash(s3, world, l3, x3, s3.minutes + 60);
  assert.deepEqual(ptOf(l3), [3, 3]);
  // Midnight: gone.
  await advance(s3, world, 24, { planDay: async () => [] });
  assert.equal(ptOf(l3)[0] <= 2, true);
});

test('the real Timbermaw Larva lurks in Oran-Rief: a hungry beast that swells per Forest', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const l = state.actors['cre-timbermaw-larva'];
  assert.equal(l?.region, 'loc-oran-rief');
  const def = npcDef(state, world, l.id)!;
  assert.ok(def.beast);
  assert.deepEqual(def.attackPump, { land: 'forest', pt: [1, 1] });
  assert.deepEqual(ptOf(l), [2, 2]);
});

test('the real Windrider Eel swims the winds of Makindi: a flying, hungry beast, +2/+2 on landfall', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const e = state.actors['cre-windrider-eel'];
  assert.equal(e?.region, 'loc-makindi');
  const def = npcDef(state, world, e.id)!;
  assert.ok(def.beast && hasAbility(e, 'fly', state.minutes));
  assert.deepEqual(def.landfall, { pt: [2, 2], trample: false });
  assert.deepEqual(ptOf(e), [2, 2]);
});

test('the real Giant Scorpion crawls the roots of Guul Draz: a hungry beast with deathtouch', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const sc = state.actors['cre-giant-scorpion'];
  assert.equal(sc?.region, 'loc-guul-draz');
  assert.ok(npcDef(state, world, sc.id)!.beast && hasAbility(sc, 'deathtouch', state.minutes));
  assert.deepEqual(ptOf(sc), [1, 3]);
});

test('Archmage Ascension: a quest counter at midnight for two secrets a day; with six, what would be known is had for real', async () => {
  const asc: RawEntity = { id: 'itm-aa', kind: 'item', name: '대마법사의 승천', status: 'canon', sim: { card_type: 'enchantment', cost: '{0}', at: 'loc-a', effects: [{ type: 'quest', draws: 2, counters: 6 }] } };
  const relic: RawEntity = { id: 'itm-r', kind: 'item', name: '유물', status: 'canon', sim: { cost: '{9}', at: 'loc-b', effects: [{ type: 'mana', amount: 1 }] } };
  const sp: RawEntity = { id: 'spl-z', kind: 'spell', name: '먼 주문', status: 'canon', sim: { cost: '{1}', learn_at: 'loc-b', effects: [{ type: 'discard' }] } };
  const world = fixture([asc, relic, sp, npc('chr-o', npcSim('loc-a')), npc('chr-c', npcSim('loc-b')), npc('chr-s', npcSim('loc-b')), lore('cre-x', 'creature')]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [o, c, sv] = [state.actors['chr-o'], state.actors['chr-c'], state.actors['chr-s']];
  claimItem(state, world, o, 'itm-aa', state.minutes);
  assert.equal(state.items?.['itm-aa']?.owner, o.id);
  // Came to know two secrets today: a counter at midnight.
  drawKnowledge(state, world, o, 2, state.minutes, '시험');
  await advance(state, world, 19, { planDay: async () => [] });
  assert.equal(state.items!['itm-aa'].counters, 1);
  // One the next day: none.
  drawKnowledge(state, world, o, 1, state.minutes, '시험');
  await advance(state, world, 24, { planDay: async () => [] });
  assert.equal(state.items!['itm-aa'].counters, 1);
  // Six: everything there is to know, had for real where there is something to have.
  state.items!['itm-aa'].counters = 6;
  o.knowledge = [];
  sv.master = c.id; // serving someone: not to be had
  const before = o.drawn?.day === gameDay(state.minutes) ? o.drawn.count : 0;
  const got = drawKnowledge(state, world, o, 99, state.minutes, '시험');
  assert.ok(o.spells?.includes('spl-z'));
  assert.equal(state.items!['itm-r'].owner, o.id);
  // Brought to their side, not theirs (user decision 2026-10-01).
  assert.equal(c.master, undefined);
  assert.equal(c.region, o.region);
  assert.ok(sameTile(c.tile, o.tile));
  assert.equal(sv.master, c.id);
  // What stays a secret: none of those had; only they count as drawn.
  assert.ok(!got.some((x) => x.id === 'spell:spl-z' || x.id === 'item:itm-r' || x.id.startsWith('creature:chr-c:')));
  assert.ok(got.some((x) => x.id.startsWith('creature:chr-s:')));
  assert.equal(o.drawn!.count, before + got.length);
  assert.ok(texts(state).some((l) => l.includes('곧바로 익혔다')));
});

test('the real Archmage Ascension stands in Sea Gate', () => {
  const world = loadWorld();
  const x = world.items.find((i) => i.id === 'itm-archmage-ascension')!;
  assert.equal(x.at, 'loc-sea-gate');
  assert.equal(x.cardType, 'enchantment');
  assert.deepEqual(x.effects, [{ type: 'quest', draws: 2, counters: 6 }]);
});

test('Beastmaster Ascension: a counter for each creature its owner controls (themselves too) first falling on someone a day; with seven, all of them +5/+5', () => {
  const asc: RawEntity = { id: 'itm-ba', kind: 'item', name: '야수조련사의 승천', status: 'canon', sim: { card_type: 'enchantment', cost: '{0}', at: 'loc-a', effects: [{ type: 'attack_quest' }, { type: 'anthem', pt: [5, 5], counters: 7 }] } };
  const world = fixture([asc, npc('chr-r', npcSim('loc-a')), npc('chr-x', npcSim('loc-a', 'social', [0, 9])), npc('chr-y', npcSim('loc-a', 'social', [0, 9]))]);
  const state = character(world, 'loc-a');
  const [p, r, x, y] = [state.actors[PLAYER_ID], state.actors['chr-r'], state.actors['chr-x'], state.actors['chr-y']];
  for (const a of [r, x, y]) a.tile = p.tile;
  r.master = p.id;
  claimItem(state, world, p, 'itm-ba', state.minutes);
  clash(state, world, p, x, state.minutes); // the player is a creature they control
  assert.equal(state.items!['itm-ba'].counters, 1);
  clash(state, world, r, y, state.minutes);
  assert.equal(state.items!['itm-ba'].counters, 2);
  clash(state, world, p, y, state.minutes + 60); // once a day each
  clash(state, world, x, p, state.minutes + 60); // struck at: no attack of theirs
  assert.equal(state.items!['itm-ba'].counters, 2);
  // Six: nothing yet; seven: they and theirs +5/+5, hour by hour.
  state.items!['itm-ba'].counters = 6;
  anthemHour(state, world);
  assert.equal(ptOf(r)[0], 1);
  state.items!['itm-ba'].counters = 7;
  anthemHour(state, world);
  assert.deepEqual(ptOf(r), [6, 6]);
  assert.equal(ptOf(p)[0], 6);
  assert.equal(ptOf(x)[0], 0);
});

test('the real Beastmaster Ascension stands in the Guum Wilds', () => {
  const world = loadWorld();
  const x = world.items.find((i) => i.id === 'itm-beastmaster-ascension')!;
  assert.equal(x.at, 'loc-guum-wilds');
  assert.deepEqual(x.effects, [{ type: 'attack_quest' }, { type: 'anthem', pt: [5, 5], abilities: [], counters: 7 }]);
});

test('"creatures you control" is everywhere themselves and their retainers: a kicker may tap the caster', () => {
  const tribute: RawEntity = { id: 'spl-t', kind: 'spell', name: '공물', status: 'canon', sim: { cost: '{0}', learn_at: 'loc-a', kicker: { tap: 'cre-v' }, effects: [{ type: 'discard' }] } };
  const world = fixture([tribute, lore('cre-v', 'creature'), npc('chr-k', { ...npcSim('loc-a'), creature: 'cre-v' }), walker]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const k = state.actors['chr-k'];
  assert.deepEqual(tappable(state, world, k, 'cre-v').map((a) => a.id), [k.id]);
  assert.deepEqual(controlledCreatures(state, world, state.actors['chr-w']), []); // a planeswalker is none
});

test('Devout Lightcaster: arriving, one black permanent on its tile is exiled: a being erased, or a bond with a black land broken for good', async () => {
  const lc = npc('chr-lc', { ...npcSim('loc-a'), pt: [2, 2], mana: { W: 3 }, protection: ['B'], enter_exile: { color: 'B' } });
  const world = fixture([lc, loc('loc-sw', 70, 10, 'swamp'), npc('chr-v', { ...npcSim('loc-a'), mana: { B: 2 } }), npc('chr-w2', { ...npcSim('loc-a'), mana: { W: 1 } })]);
  const state = character(world, 'loc-a');
  const [l, v, w, p] = [state.actors['chr-lc'], state.actors['chr-v'], state.actors['chr-w2'], state.actors[PLAYER_ID]];
  for (const x of [v, w, p]) x.tile = l.tile;
  p.bonds = ['loc-sw'];
  // What it may take: the black vampire, the player (black by their swamp), and that bond; not the white one.
  const ids = banishOptions(state, world, l, 'B', state.minutes).map((o) => o.id).sort();
  assert.deepEqual(ids, ['being:chr-v', `being:${PLAYER_ID}`, `land:${PLAYER_ID}:loc-sw`].sort());
  // Its arrival: a pick for it (itself, serving no one) after the hour; it must take one.
  onEnter(state, world, l, state.minutes);
  assert.equal(state.choices?.at(-1)?.effect.type, 'exile');
  await act(state, world, { type: 'wait', hours: 1 }, { planDay: async () => [], pick: async () => `land:${PLAYER_ID}:loc-sw` });
  assert.deepEqual(p.bonds, []);
  assert.deepEqual(p.exiledLands, ['loc-sw']);
  p.region = 'loc-sw';
  assert.match(bondBlocked(state, world, p, state.minutes) ?? '', /다시는/);
  // A being, between NPCs: a death, not erased (user decision 2026-10-01).
  p.region = 'loc-a';
  assert.ok(applyExile(state, world, l, 'being:chr-v', state.minutes));
  assert.ok(state.actors['chr-v']?.dead);
  assert.ok(!state.erased?.includes('chr-v'));
  // Under the player: gone from the world.
  const s2 = character(world, 'loc-a');
  const [l2, v2, p2] = [s2.actors['chr-lc'], s2.actors['chr-v'], s2.actors[PLAYER_ID]];
  v2.tile = p2.tile = l2.tile;
  l2.master = p2.id;
  assert.ok(applyExile(s2, world, l2, 'being:chr-v', s2.minutes));
  assert.equal(s2.actors['chr-v'], undefined);
  assert.ok(s2.erased?.includes('chr-v'));
});

test('the real Devout Lightcaster walks the Arid Mesa', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const l = state.actors['chr-devout-lightcaster'];
  assert.equal(l?.region, 'loc-arid-mesa');
  const def = npcDef(state, world, l.id)!;
  assert.deepEqual(def.enterExile, { color: 'B' });
  assert.deepEqual(def.protection, ['B']);
});

test('Electropotence: one coming to serve its owner may, for {2}{R}, strike one there for its power; between NPCs a knockout', async () => {
  const ep: RawEntity = { id: 'itm-ep', kind: 'item', name: '전기의 힘', status: 'canon', sim: { card_type: 'enchantment', cost: '{0}', at: 'loc-a', effects: [{ type: 'enter_strike', cost: '{R}' }] } };
  const world = fixture([ep, npc('chr-o', { ...npcSim('loc-a'), mana: { R: 2 } }), npc('chr-r', { ...npcSim('loc-a', 'social', [3, 3]) }), npc('chr-old', npcSim('loc-a')), npc('chr-x', npcSim('loc-a', 'social', [1, 2]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [o, r, old, x] = [state.actors['chr-o'], state.actors['chr-r'], state.actors['chr-old'], state.actors['chr-x']];
  for (const a of [r, old, x]) a.tile = o.tile;
  bindRetainer(state, world, old, o, state.minutes, '설득'); // before: nothing
  state.minutes += 60;
  claimItem(state, world, o, 'itm-ep', state.minutes);
  bindRetainer(state, world, r, o, state.minutes, '설득');
  const asked: string[][] = [];
  await advance(state, world, 2, { planDay: async () => [], choose: async ({ candidates }) => (asked.push(candidates.map((c) => c.id).sort()), 'chr-x') });
  assert.equal(asked.length, 1); // only the one who came after
  assert.ok(asked[0].includes('chr-x') && !asked[0].includes('chr-r'));
  assert.ok(texts(state).some((l) => l.includes('붉은 번개')));
  assert.ok(!x.dead); // a knockout between NPCs
  assert.ok(texts(state).some((l) => l.includes('쓰러졌다') || l.includes('기절')));
});

test('the real Electropotence stands on the Crown of Talib', () => {
  const world = loadWorld();
  const x = world.items.find((i) => i.id === 'itm-electropotence')!;
  assert.equal(x.at, 'loc-crown-of-talib');
  assert.deepEqual(x.effects, [{ type: 'enter_strike', cost: '{2}{R}' }]);
});

test('the real Oracle of Mul Daya lives in Riverroot, in the Guum Wilds of Bala Ged', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const o = state.actors['chr-oracle-of-mul-daya'];
  assert.equal(o?.region, 'loc-riverroot');
  assert.equal(region(world, 'loc-riverroot').parent, 'loc-guum-wilds');
  assert.equal(region(world, 'loc-guum-wilds').parent, 'loc-bala-ged');
  assert.equal(placeName(world, region(world, 'loc-riverroot')), '발라 게드 › 굼 밀림 › 리버루트');
  assert.deepEqual(landTypes(region(world, 'loc-riverroot')), ['forest']);
  const def = npcDef(state, world, o.id)!;
  assert.equal(def.extraLands, 1);
  assert.ok(def.revealTop);
});

const vampireKind = (): RawEntity => ({ id: 'cre-v', kind: 'creature', name: '흡혈귀', status: 'canon' }) as RawEntity;
const mindlessNull = (): RawEntity => planned({
  id: 'cre-n',
  kind: 'creature',
  name: '공허자',
  status: 'canon',
  sim: { name: '공허자', pt: [2, 2], role: 'r', home: 'loc-a', persona: 'p', goal: 'g', needs: ['energy', 'hunger'], beast: true, follows_only: 'cre-v', cant_block_unless: 'cre-v' },
});

test('Mindless Null: a beast that follows only a vampire or one who keeps one; no one else may court it or talk it round', async () => {
  const world = fixture([vampireKind(), mindlessNull(), npc('chr-v', { ...npcSim('loc-a'), creature: 'cre-v' }), npc('chr-m', npcSim('loc-a')), npc('chr-o', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [n, v, m, o] = ['cre-n', 'chr-v', 'chr-m', 'chr-o'].map((id) => state.actors[id]);
  for (const a of [v, m, o]) a.tile = n.tile;
  assert.equal(creatureOf(state, world, v.id), 'cre-v');
  // A vampire may court it; one with none may not.
  assert.ok(courtTargets(state, world, v).some((x) => x.id === 'cre-n'));
  assert.ok(!courtTargets(state, world, o).some((x) => x.id === 'cre-n'));
  assert.ok(courtBlocked(state, world, o, 'cre-n')?.includes('흡혈귀 곁이 아니면 따르지 않는다'));
  // One who keeps a vampire may.
  v.master = 'chr-m';
  assert.ok(controlsKind(state, world, m, 'cre-v'));
  assert.equal(followBlocked(state, world, n, m), null);
  assert.ok(courtTargets(state, world, m).some((x) => x.id === 'cre-n'));
  assert.ok(!canPledge(state, world, n, o) && canPledge(state, world, n, m));
});

test('Mindless Null: the player with no vampire talks to it; it would follow, but turns away', async () => {
  const world = fixture([vampireKind(), mindlessNull()]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  state.actors['cre-n'].tile = p.tile;
  await act(state, world, { type: 'talk', to: 'cre-n', say: '따라와' }, { reply: async () => ({ say: '공허자가 사슬을 끌며 다가온다.', attack: false, follow: true }) });
  assert.equal(state.actors['cre-n'].master, undefined);
  assert.ok(texts(state).some((t) => t.includes('흡혈귀 곁이 아니면 따르지 않는다')));
  assert.ok(refusedToday(p, state.minutes));
});

test('Mindless Null: it can\'t block unless its master\'s creatures hold a vampire; then it stands by its master', () => {
  const world = fixture([vampireKind(), mindlessNull(), npc('chr-v', { ...npcSim('loc-a', 'work', [1, 20]), creature: 'cre-v' }), npc('chr-m', npcSim('loc-a', 'work', [1, 20])), npc('chr-y', npcSim('loc-a', 'work', [1, 20])), npc('chr-z', npcSim('loc-a', 'work', [1, 20]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [n, v, m, y, z] = ['cre-n', 'chr-v', 'chr-m', 'chr-y', 'chr-z'].map((id) => state.actors[id]);
  for (const a of [n, y, z]) a.tile = m.tile;
  n.master = 'chr-m';
  n.stats.hunger = 0;
  const struckBy = (id: string, foe: string) => state.log.some((e) => e.kind === 'combat' && e.actors[0] === id && e.actors[1] === foe);
  let t = state.minutes;
  // No vampire: y falls on the master and the null stays out of it.
  clash(state, world, y, m, t);
  hostileNpcs(state, world, t + 60);
  assert.ok(!struckBy('cre-n', 'chr-y'));
  // A vampire serves the master too (anywhere: "you control"): now it blocks.
  v.master = 'chr-m';
  y.region = 'loc-b';
  t += 120;
  clash(state, world, z, m, t);
  hostileNpcs(state, world, t + 60);
  assert.ok(struckBy('cre-n', 'chr-z'));
});

test('the real Mindless Null drags its chains in the Ghet estate, following only a vampire; Kalitas counts as one', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const n = state.actors['cre-mindless-null'];
  assert.equal(n?.region, 'loc-ghet-estate');
  const def = npcDef(state, world, n.id)!;
  assert.ok(def.beast && def.needs.includes('hunger'));
  assert.equal(def.followsOnly, 'cre-vampire');
  assert.equal(def.cantBlockUnless, 'cre-vampire');
  const k = state.actors['chr-kalitas'];
  assert.equal(creatureOf(state, world, k.id), 'cre-vampire');
  assert.ok(controlsKind(state, world, k, 'cre-vampire'));
  assert.equal(followBlocked(state, world, n, k), null);
});

test('Molten Ravager: {R} poured is +1/+0; at 0/4 it hits only with fire poured in', async () => {
  const ravager = { ...npcSim('loc-a', 'work', [0, 4]), mana: { R: 3 }, needs: ['energy'], beast: true, pump: { cost: '{R}', pt: [1, 0] } };
  const world = fixture([npc('chr-r', ravager), npc('chr-x', npcSim('loc-a', 'work', [0, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [r, x] = [state.actors['chr-r'], state.actors['chr-x']];
  x.tile = r.tile;
  addFoe(r, 'chr-x', state.minutes);
  await advance(state, world, 1, { pick: async () => '2' });
  assert.deepEqual(ptOf(r), [2, 4]);
  assert.equal(woundsOf(x, state.minutes), 2);
  assert.ok(texts(state).some((l) => l.includes('부풀었다 (자정까지 +2/+0)')));
});

test('follows_only a character: a beast only that one, or one who keeps them, may court or talk round', () => {
  const beast = { ...npcSim('loc-a', 'work', [0, 4]), needs: ['energy'], beast: true, follows_only: 'chr-l' };
  const world = fixture([npc('chr-r', beast), npc('chr-l', npcSim('loc-a')), npc('chr-m', npcSim('loc-a')), npc('chr-o', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [r, l, m, o] = ['chr-r', 'chr-l', 'chr-m', 'chr-o'].map((id) => state.actors[id]);
  for (const a of [l, m, o]) a.tile = r.tile;
  assert.ok(courtTargets(state, world, l).some((x) => x.id === 'chr-r'));
  assert.ok(!courtTargets(state, world, m).some((x) => x.id === 'chr-r'));
  assert.ok(followBlocked(state, world, r, o)?.includes('chr-l 곁이 아니면'));
  l.master = 'chr-m';
  assert.ok(courtTargets(state, world, m).some((x) => x.id === 'chr-r'));
  assert.ok(!courtTargets(state, world, o).some((x) => x.id === 'chr-r'));
});

test('the real Molten Ravager rages on the Teeth of Akoum; only the Lullmage Mentor, or one who keeps her, may calm it', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const r = state.actors['cre-molten-ravager'];
  assert.equal(r?.region, 'loc-teeth-of-akoum');
  const def = npcDef(state, world, r.id)!;
  assert.ok(def.beast && !def.needs.includes('hunger'));
  assert.deepEqual(def.pump?.pt, [1, 0]);
  assert.deepEqual(ptOf(r), [0, 4]);
  const l = state.actors['chr-lullmage-mentor'];
  assert.equal(followBlocked(state, world, r, l), null);
  assert.ok(followBlocked(state, world, r, state.actors['chr-kalitas'])?.includes('잠재움술사 스승 곁이 아니면'));
});

const escapeSpell: RawEntity = { id: 'spl-ne', kind: 'spell', name: '아슬아슬한 탈출', status: 'canon', sim: { cost: '{1}', speed: 'instant', learn_at: 'loc-a', target: 'self', effects: [{ type: 'return_own' }, { type: 'gain_life', amount: 4 }] } };
const besideA: RawEntity = { id: 'loc-az', kind: 'location', name: '곁의 들', status: 'canon', map: { in: 'loc-a', terrain: 'grassland', tiles: 1 } };

test('Narrow Escape by the player in a fight: they gain 4 life, pick themselves, and slip away to another area, stripped, no one\'s foe', async () => {
  const world = fixture([escapeSpell, besideA, npc('chr-x', npcSim('loc-a', 'work', [1, 20]))]);
  const state = character(world, 'loc-a');
  const [p, x] = [state.actors[PLAYER_ID], state.actors['chr-x']];
  x.tile = p.tile;
  p.spells = ['spl-ne'];
  p.bonds = ['loc-b'];
  p.plusCounters = 2;
  addFoe(x, p.id, state.minutes);
  await act(state, world, { type: 'cast', spell: 'spl-ne', to: p.id, kick: false });
  assert.equal(p.life, 24);
  if (state.asks?.[0]?.effect.type !== 'escape') await act(state, world, { type: 'wait', hours: 1 });
  const ask = state.asks![0];
  assert.equal(ask.effect.type, 'escape');
  assert.deepEqual(askOptions(state, world, ask).map((o) => o.pick), [`being:${PLAYER_ID}`, 'land:loc-b']);
  await act(state, world, { type: 'choose', pick: `being:${PLAYER_ID}` });
  assert.equal(p.region, 'loc-az');
  assert.equal(p.plusCounters, undefined);
  assert.ok(!x.foes?.ids.includes(p.id));
  assert.deepEqual(p.bonds, ['loc-b']);
});

test('Narrow Escape: a retainer stays its master\'s, one seized goes free, a token is gone; a land is let go; an aura comes off, to be cast again', () => {
  const world = fixture([escapeSpell, bigAura, besideA, lore('cre-w', 'creature'), npc('chr-c', npcSim('loc-a')), npc('chr-m', npcSim('loc-a')), npc('chr-s', npcSim('loc-a')), npc('chr-y', npcSim('loc-a')), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, m, s, y, x] = ['chr-c', 'chr-m', 'chr-s', 'chr-y', 'chr-x'].map((id) => state.actors[id]);
  for (const a of [m, s, y, x]) a.tile = c.tile;
  const t = state.minutes;
  bindRetainer(state, world, m, c, t, '설득');
  m.plusCounters = 2;
  addFoe(m, 'chr-y', t);
  addFoe(y, 'chr-m', t);
  s.master = c.id;
  s.seized = true;
  const [wolf] = spawnWild(state, world, 'cre-w', [2, 2], 1, 'loc-a', ['G'], c.tile);
  wolf.master = c.id;
  c.bonds = ['loc-b'];
  castSpell(state, world, c, 'spl-g', 'chr-x', false, t);
  assert.ok(c.used?.['spl-g'] !== undefined);
  const ids = escapeOptions(state, world, c).map((o) => o.id);
  for (const id of ['being:chr-c', 'being:chr-m', 'being:chr-s', `being:${wolf.id}`, 'land:loc-b', 'aura:chr-x:0']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('being:chr-y'));
  applyEscape(state, world, c, 'being:chr-m', '탈출', t);
  assert.equal(m.master, 'chr-c');
  assert.equal(m.plusCounters, undefined);
  assert.equal(m.region, 'loc-az');
  assert.ok(!y.foes?.ids.includes('chr-m'));
  applyEscape(state, world, c, 'being:chr-s', '탈출', t);
  assert.equal(s.master, undefined);
  applyEscape(state, world, c, `being:${wolf.id}`, '탈출', t);
  assert.ok(wolf.dead);
  applyEscape(state, world, c, 'land:loc-b', '탈출', t);
  assert.deepEqual(c.bonds, []);
  applyEscape(state, world, c, 'aura:chr-x:0', '탈출', t);
  assert.equal(x.auras, undefined);
  assert.ok(!hasAbility(x, 'trample', t));
  assert.equal(c.used?.['spl-g'], undefined);
});

test('the real Narrow Escape is taught in Kazandu: an instant, one of your own back, 4 life', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-narrow-escape')!;
  assert.equal(s.learnAt, 'loc-kazandu');
  assert.equal(s.speed, 'instant');
  assert.deepEqual(s.effects.map((e) => e.type), ['return_own', 'gain_life']);
});

const roilSpell: RawEntity = { id: 'spl-roil', kind: 'spell', name: '뒤틀림 속으로', status: 'canon', sim: { cost: '{1}', speed: 'instant', learn_at: 'loc-a', target: 'self', kicker: { mana: '{1}' }, effects: [{ type: 'return_nonland' }, { type: 'draw', count: 1, if_kicked: true }] } };

test('Into the Roil: anyone\'s nonland thing there; another\'s being is flung (stripped, freed, stunned), an aura comes off for its caster to cast again; kicked, a secret', () => {
  const world = fixture([roilSpell, bigAura, besideA, npc('chr-c', { ...npcSim('loc-a'), mana: { U: 4 } }), npc('chr-m', npcSim('loc-a')), npc('chr-y', npcSim('loc-a')), npc('chr-x', npcSim('loc-a')), npc('chr-z', { ...npcSim('loc-a'), abilities: ['shroud'] })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, m, y, x, z] = ['chr-c', 'chr-m', 'chr-y', 'chr-x', 'chr-z'].map((id) => state.actors[id]);
  for (const a of [m, y, x, z]) a.tile = c.tile;
  const t = state.minutes;
  bindRetainer(state, world, y, m, t, '설득');
  y.plusCounters = 2;
  addFoe(y, 'chr-x', t);
  addFoe(x, 'chr-y', t);
  c.spells = ['spl-roil'];
  c.bonds = ['loc-b'];
  m.spells = ['spl-g'];
  castSpell(state, world, m, 'spl-g', 'chr-x', false, t);
  assert.ok(castSpell(state, world, c, 'spl-roil', c.id, true, t));
  assert.ok(state.log.some((e) => e.text.startsWith('뒤틀림 속으로:') && e.actors?.includes('chr-c')));
  const owed = state.choices!.find((ch) => ch.effect.type === 'escape')!;
  assert.deepEqual(owed.effect, { type: 'escape', spell: '뒤틀림 속으로', any: true });
  const ids = escapeOptions(state, world, c, true).map((o) => o.id);
  for (const id of ['being:chr-c', 'being:chr-m', 'being:chr-y', 'being:chr-x', 'aura:chr-x:0']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('being:chr-z'));
  assert.ok(!ids.some((id) => id.startsWith('land:')));
  applyEscape(state, world, c, 'being:chr-y', '뒤틀림 속으로', t, true);
  assert.equal(y.master, undefined);
  assert.equal(y.plusCounters, undefined);
  assert.equal(y.region, 'loc-az');
  assert.equal(y.forced?.kind, 'sleep');
  assert.ok(!x.foes?.ids.includes('chr-y'));
  assert.ok(y.relations?.['chr-c']);
  assert.ok(m.used?.['spl-g'] !== undefined);
  applyEscape(state, world, c, 'aura:chr-x:0', '뒤틀림 속으로', t, true);
  assert.equal(x.auras, undefined);
  assert.equal(m.used?.['spl-g'], undefined);
  // Unkicked: no secret.
  const before = state.log.length;
  delete c.used;
  castSpell(state, world, c, 'spl-roil', c.id, false, t);
  assert.ok(!state.log.slice(before).some((e) => e.text.startsWith('뒤틀림 속으로:')));
});

test('Into the Roil by the player: the pick is theirs, no land among them; the NPC picked is flung away', async () => {
  const world = fixture([roilSpell, besideA, npc('chr-x', npcSim('loc-a', 'work', [1, 20]))]);
  const state = character(world, 'loc-a');
  const [p, x] = [state.actors[PLAYER_ID], state.actors['chr-x']];
  x.tile = p.tile;
  p.spells = ['spl-roil'];
  p.bonds = ['loc-b'];
  await act(state, world, { type: 'cast', spell: 'spl-roil', to: p.id, kick: false });
  if (state.asks?.[0]?.effect.type !== 'escape') await act(state, world, { type: 'wait', hours: 1 });
  const ask = state.asks![0];
  assert.equal(ask.effect.type, 'escape');
  assert.deepEqual(askOptions(state, world, ask).map((o) => o.pick).sort(), ['being:chr-x', `being:${PLAYER_ID}`]);
  await act(state, world, { type: 'choose', pick: 'being:chr-x' });
  assert.equal(x.region, 'loc-az');
});

test('the real Into the Roil is taught on the Silundi Coast: an instant, kicker {1}{U}, a nonland thing back and a secret if kicked', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-into-the-roil')!;
  assert.equal(s.learnAt, 'loc-silundi-coast');
  assert.equal(s.speed, 'instant');
  assert.ok(s.kicker?.mana);
  assert.deepEqual(s.effects.map((e) => e.type), ['return_nonland', 'draw']);
});

const vestige = (plan?: unknown[][]) => npc('chr-v', { ...npcSim('loc-a', 'work', [1, 2]), mana: { W: 3 }, needs: ['energy'], abilities: ['fly'], tap_shield: 1, ...(plan ? { plan } : {}) });

test('Noble Vestige: the player taps the spirit they keep to ward themselves; the next 1 damage today is prevented, and the ward is gone at midnight', async () => {
  const world = fixture([vestige()]);
  const state = character(world, 'loc-a');
  const [p, v] = [state.actors[PLAYER_ID], state.actors['chr-v']];
  v.tile = p.tile;
  assert.ok(tapBlocked(state, world, p, 'shield', undefined, state.minutes)?.includes('영혼이 없다'));
  v.master = p.id;
  await act(state, world, { type: 'shield' });
  assert.ok(v.boundUntil !== undefined);
  assert.deepEqual(p.shield?.amount, 1);
  assert.ok(tapBlocked(state, world, p, 'shield', undefined, state.minutes)?.includes('지금 쓸 수 없다'));
  dealDamage(state, world, p, 3, state.minutes, '시험');
  assert.equal(woundsOf(p, state.minutes), 2);
  assert.equal(p.shield, undefined);
  assert.ok(texts(state).some((l) => l.includes('가호가') && l.includes('피해 1를 막았다')));
  // One unspent wears off with the day.
  p.shield = { day: gameDay(state.minutes), amount: 1 };
  assert.equal(shielded(state, p, 2, state.minutes + 24 * 60), 2);
});

test('Noble Vestige: an NPC plans a shield block for someone; the spirit (on its own, serving no one) wards them and is tapped', async () => {
  const plan = [
    ['00:00', '06:00', 'loc-a', 'sleep', '잠', '😴'],
    ['06:00', '07:00', 'loc-a', 'shield', '가호', '🕯️', undefined, undefined, 'chr-x'],
    ['07:00', '24:00', 'loc-a', 'work', '일', '🔨'],
  ];
  const world = fixture([vestige(plan), npc('chr-x', npcSim('loc-a', 'work', [1, 5]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [v, x] = [state.actors['chr-v'], state.actors['chr-x']];
  x.tile = v.tile;
  let offered: PlanDayInput | undefined;
  await advance(state, world, 1, { planDay: async (input) => (input.id === 'chr-v' && (offered = input), planDay!(input)) });
  assert.deepEqual(offered?.shield, { who: 'they themselves', amount: 1 });
  assert.ok(offered?.people?.find((y) => y.id === 'chr-x')?.shield);
  assert.equal(x.shield?.amount, 1);
  assert.ok(v.boundUntil !== undefined);
});

test('the real Noble Vestige lingers in Emeria: a flying spirit of hope who may be talked round, warding one beside it', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const v = state.actors['chr-noble-vestige'];
  assert.equal(v?.region, 'loc-emeria');
  const def = npcDef(state, world, v.id)!;
  assert.equal(def.tapShield, 1);
  assert.ok(hasAbility(v, 'fly', state.minutes) && !def.beast && !def.needs.includes('hunger'));
  assert.equal(swayBlocked(state, world, v), null);
});

test('reach: a flyer set on by one with reach can\'t take to the air; the blow lands, and no one asks', async () => {
  const flyer = { ...npcSim('loc-a', 'work', [2, 7]), abilities: ['fly'] };
  const world = fixture([npc('chr-r', { ...npcSim('loc-a', 'work', [3, 3]), abilities: ['reach'] }), npc('chr-f', flyer)]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  state.actors['chr-f'].tile = state.actors['chr-r'].tile;
  addFoe(state.actors['chr-r'], 'chr-f', state.minutes);
  const asked: string[] = [];
  await advance(state, world, 2, { evade: async ({ npc }) => (asked.push(npc.id), true) });
  assert.deepEqual(asked, []);
  assert.ok(woundsOf(state.actors['chr-f'], state.minutes) > 0);
  // The player with reach: the flyer is not asked either.
  const w2 = fixture([npc('chr-f', flyer)]);
  const s2 = character(w2, 'loc-a');
  s2.actors[PLAYER_ID].abilities = ['reach'];
  s2.actors['chr-f'].tile = s2.actors[PLAYER_ID].tile;
  let evadeAsked = false;
  await act(s2, w2, { type: 'attack', to: 'chr-f' }, { evade: async () => ((evadeAsked = true), true) });
  assert.equal(evadeAsked, false);
  assert.ok(!texts(s2).some((t) => t.includes('날아올라 공격을 피했다')));
});

test('a kicked enter-destroy on flyers (Oran-Rief Recluse): only one who can fly is to be picked', () => {
  const recluse = { ...npcSim('loc-a', 'work', [1, 3]), mana: { G: 6 }, needs: ['energy'], beast: true, abilities: ['reach'], enter_destroy: { kicker: '{2}{G}', flying: true } };
  const world = fixture([npc('chr-r', recluse), npc('chr-f', { ...npcSim('loc-a'), abilities: ['fly'] }), npc('chr-g', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [r, f, g] = ['chr-r', 'chr-f', 'chr-g'].map((id) => state.actors[id]);
  for (const a of [f, g]) a.tile = r.tile;
  enterDestroy(state, world, r, state.minutes);
  const c = state.choices!.find((x) => x.effect.type === 'destroy')!;
  assert.deepEqual(c.candidates, ['chr-f']);
  assert.equal((c.effect as { flying?: boolean }).flying, true);
});

test('every beast may be courted by an NPC, with no mark of its own (user decision 2026-10-01)', () => {
  const world = fixture([beast([['00:00', '24:00', 'loc-a', 'leisure', '어슬렁', '🌳']]), npc('chr-m', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  assert.ok(courtTargets(state, world, state.actors['chr-m']).some((x) => x.id === 'cre-b'));
  assert.equal(swayBlocked(state, world, state.actors['cre-b']), null);
});

test('the real Oran-Rief Recluse lurks in the canopy of Oran-Rief: reach, and a kicked strike at flyers', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const r = state.actors['cre-oran-rief-recluse'];
  assert.equal(r?.region, 'loc-oran-rief');
  assert.ok(hasAbility(r, 'reach', state.minutes));
  const def = npcDef(state, world, r.id)!;
  assert.deepEqual(ptOf(r), [1, 3]);
  assert.ok(def.beast && def.needs.includes('hunger'));
  assert.equal(def.enterDestroy?.flying, true);
  assert.equal(def.enterDestroy?.kickerText, '{2}{G}');
});

const graspSpell: RawEntity = { id: 'spl-pg', kind: 'spell', name: '마비시키는 손아귀', status: 'canon', sim: { cost: '{0}', learn_at: 'loc-a', target: 'other_here', effects: [{ type: 'aura', no_untap: true }] } };

test('Paralyzing Grasp: nothing at once; once bound, the one it is on stays bound at midnight, until it is gone', async () => {
  const world = fixture([graspSpell, npc('chr-c', npcSim('loc-a')), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, x] = [state.actors['chr-c'], state.actors['chr-x']];
  x.tile = c.tile;
  castSpell(state, world, c, 'spl-pg', 'chr-x', false, state.minutes);
  assert.equal(x.auras?.[0]?.noUntap, true);
  assert.equal(x.boundUntil, undefined);
  assert.ok(foesOf(x, state.minutes).includes('chr-c')); // a harmful spell
  // Bound (tapped) today: at midnight it holds on.
  x.boundUntil = untapTime(state.minutes);
  await advance(state, world, 19); // 06:00 → 01:00 of day 2
  assert.equal(x.boundUntil, untapTime(state.minutes));
  assert.ok(texts(state).some((l) => l.includes('마비시키는 손아귀에 붙들려 풀려나지 못한다')));
  // The aura gone, the next midnight lets them go.
  delete x.auras;
  await advance(state, world, 24);
  assert.equal(x.boundUntil, undefined);
});

test('the real Paralyzing Grasp is taught at Sea Gate: an aura that keeps one bound from untapping', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-paralyzing-grasp')!;
  assert.equal(s.learnAt, 'loc-sea-gate');
  assert.deepEqual(s.effects.map((e) => e.type === 'aura' && e.no_untap), [true]);
});

const pitfall: RawEntity = { id: 'evt-pit', kind: 'event', name: '구덩이 함정', status: 'canon', sim: { region: 'loc-b', pos: [0, 0], trigger: 'attacked', attackers: 1, exactly: true, on_tile: true, text: '발밑이 꺼졌다.', effects: [{ type: 'destroy_attackers', no_fly: true }] } };

test('Pitfall Trap: exactly one who falls on someone on its tile, and can\'t fly, is destroyed; not two at once, not elsewhere, not a flyer', () => {
  const world = fixture([pitfall, npc('chr-x', npcSim('loc-b', 'work', [3, 3])), npc('chr-y', npcSim('loc-b', 'work', [1, 20])), npc('chr-z', npcSim('loc-b', 'work', [3, 3])), npc('chr-f', { ...npcSim('loc-b', 'work', [3, 3]), abilities: ['fly'] })]);
  const pit = eventTile(world, world.events.find((e) => e.id === 'evt-pit')!)!;
  const away = tilesOf(world, 'loc-b').find((t) => !sameTile(t, pit))!;
  const setup = () => {
    const state = newState(world, { seed: 1, mode: 'observer' });
    for (const a of Object.values(state.actors)) Object.assign(a, { region: 'loc-b', tile: pit });
    return state;
  };
  // One alone: destroyed.
  let state = setup();
  let [x, y, z, f] = ['chr-x', 'chr-y', 'chr-z', 'chr-f'].map((id) => state.actors[id]);
  let t = state.minutes;
  clash(state, world, x, y, t);
  step(state, world);
  assert.ok(x.dead);
  assert.ok(texts(state).some((l) => l.includes('발밑이 꺼졌다')));
  // Two at once: nothing.
  state = setup();
  [x, y, z, f] = ['chr-x', 'chr-y', 'chr-z', 'chr-f'].map((id) => state.actors[id]);
  t = state.minutes;
  clash(state, world, x, y, t);
  clash(state, world, z, y, t);
  step(state, world);
  assert.ok(!x.dead && !z.dead);
  // Another tile: nothing.
  state = setup();
  [x, y] = ['chr-x', 'chr-y'].map((id) => state.actors[id]);
  for (const a of [x, y]) a.tile = away;
  clash(state, world, x, y, state.minutes);
  step(state, world);
  assert.ok(!x.dead);
  // A flyer floats over it.
  state = setup();
  [f, y] = ['chr-f', 'chr-y'].map((id) => state.actors[id]);
  clash(state, world, f, y, state.minutes);
  step(state, world);
  assert.ok(!f.dead);
  assert.ok(texts(state).some((l) => l.includes('구덩이 위로 떠올랐다')));
});

test('the real Pitfall Trap lies on one tile of the Guum Wilds: one attacker alone, without flying', () => {
  const world = loadWorld();
  const ev = world.events.find((e) => e.id === 'evt-pitfall-trap')!;
  assert.equal(ev.region, 'loc-guum-wilds');
  assert.equal(ev.trigger, 'attacked');
  assert.ok(ev.exactly && ev.on_tile && ev.attackers === 1);
  assert.ok(eventTile(world, ev));
});

const scholar = (plan?: unknown[][]) => npc('chr-s', { ...npcSim('loc-a', 'work', [2, 1]), mana: { U: 3 }, tap_loot: true, ...(plan ? { plan } : {}) });

test('Reckless Scholar: the player has the scholar they keep tell them what it heard: a secret known, then a spell let go', async () => {
  const world = fixture([scholar(), demolishSpell, escapeSpell]);
  const state = character(world, 'loc-a');
  const [p, s] = [state.actors[PLAYER_ID], state.actors['chr-s']];
  s.tile = p.tile;
  s.master = p.id;
  p.spells = ['spl-dm', 'spl-ne'];
  const known = p.knowledge?.length ?? 0;
  await act(state, world, { type: 'loot' });
  assert.ok(s.boundUntil !== undefined);
  assert.equal(p.knowledge?.length, known + 1);
  const ask = state.asks?.find((x) => x.effect.type === 'discard');
  assert.ok(ask, 'a spell to let go');
  await act(state, world, { type: 'choose', pick: 'spl-dm' });
  assert.deepEqual(p.spells, ['spl-ne']);
  assert.ok(tapBlocked(state, world, p, 'loot', undefined, state.minutes)?.includes('지금 쓸 수 없다'));
});

test('Reckless Scholar: on its own, it plans a loot block on someone; they learn a secret and forget their only spell', async () => {
  const plan = [
    ['00:00', '06:00', 'loc-a', 'sleep', '잠', '😴'],
    ['06:00', '07:00', 'loc-a', 'loot', '이야기', '🧭', undefined, undefined, 'chr-x'],
    ['07:00', '24:00', 'loc-a', 'work', '일', '🔨'],
  ];
  const world = fixture([scholar(plan), demolishSpell, npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [s, x] = [state.actors['chr-s'], state.actors['chr-x']];
  x.tile = s.tile;
  x.spells = ['spl-dm'];
  let offered: PlanDayInput | undefined;
  await advance(state, world, 1, { planDay: async (input) => (input.id === 'chr-s' && (offered = input), planDay!(input)) });
  assert.deepEqual(offered?.loot, { who: 'they themselves', amount: 1 });
  assert.ok(offered?.people?.find((y) => y.id === 'chr-x')?.loot);
  assert.equal(x.knowledge?.length, 1);
  assert.deepEqual(x.spells, []);
  assert.ok(s.boundUntil !== undefined);
});

test('the real Reckless Scholar haunts the docks of Sea Gate: talked round, tells one a secret for a spell', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const s = state.actors['chr-reckless-scholar'];
  assert.equal(s?.region, 'loc-sea-gate');
  const def = npcDef(state, world, s.id)!;
  assert.ok(def.tapLoot && !def.beast && !def.hireable);
  assert.deepEqual(ptOf(s), [2, 1]);
  assert.equal(swayBlocked(state, world, s), null);
});

test('Ruinous Minotaur: each exchange it deals damage in, whoever controls it gives up a land, their pick; one holding none gives nothing', () => {
  const mino = { ...npcSim('loc-a', 'work', [5, 2]), needs: ['energy', 'hunger'], beast: true, hit_sacrifice_land: true };
  const world = fixture([npc('chr-r', mino), npc('chr-m', npcSim('loc-a')), npc('chr-y', npcSim('loc-a', 'work', [0, 20]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [r, m, y] = ['chr-r', 'chr-m', 'chr-y'].map((id) => state.actors[id]);
  for (const a of [m, y]) a.tile = r.tile;
  // On its own, holding no land: nothing to give.
  clash(state, world, r, y, state.minutes);
  assert.equal(state.choices?.filter((c) => c.effect.type === 'harrow').length ?? 0, 0);
  // Its master holds two: one must go.
  r.master = 'chr-m';
  m.bonds = ['loc-a', 'loc-b'];
  const t = state.minutes + 60;
  clash(state, world, r, y, t);
  const c = state.choices!.find((x) => x.effect.type === 'harrow')!;
  assert.equal(c.by, 'chr-m');
  assert.deepEqual(c.candidates, ['loc-a', 'loc-b']);
  applyHarrow(state, world, m, c.effect as HarrowEffect, 'loc-b', t);
  assert.deepEqual(m.bonds, ['loc-a']);
  const line = texts(state).find((l) => l.includes('의 파멸:'))!;
  assert.ok(line.includes('유대를 내어 주었다') && !line.includes('갈아엎어진다'));
});

test('the real Ruinous Minotaur rages in the hedron wastes of Akoum: a 5/2 beast that costs its master lands', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const r = state.actors['cre-ruinous-minotaur'];
  assert.equal(r?.region, 'loc-akoum');
  assert.deepEqual(ptOf(r), [5, 2]);
  const def = npcDef(state, world, r.id)!;
  assert.ok(def.beast && def.hitSacrificeLand && def.needs.includes('hunger'));
});

const sacrament: RawEntity = { id: 'spl-sac', kind: 'spell', name: '가학의 성례', status: 'canon', sim: { cost: '{1}', learn_at: 'loc-a', target: 'other_here', kicker: { mana: '{1}' }, effects: [{ type: 'exile_library', count: 3, kicked_count: 15 }] } };

test('Sadistic Sacrament by the player: they pick spells the target could still learn, one at a time, and may stop; those are lost for good', async () => {
  const world = fixture([sacrament, demolishSpell, escapeSpell, graspSpell, npc('chr-x', npcSim('loc-a', 'social', [0, 5]))]);
  const state = character(world, 'loc-a');
  const [p, x] = [state.actors[PLAYER_ID], state.actors['chr-x']];
  x.tile = p.tile;
  p.pt = [0, 20]; // the one cast on turns on them
  x.spells = ['spl-dm'];
  p.spells = ['spl-sac'];
  p.bonds = ['loc-a'];
  await act(state, world, { type: 'cast', spell: 'spl-sac', to: 'chr-x', kick: false });
  if (state.asks?.[0]?.effect.type !== 'sacrament') await act(state, world, { type: 'wait', hours: 1 });
  const ask = state.asks![0];
  assert.equal(ask.effect.type, 'sacrament');
  assert.equal((ask.effect as SacramentEffect).left, 3);
  const picks = askOptions(state, world, ask).map((o) => o.pick);
  assert.ok(!picks.includes('spl-dm') && picks.includes('spl-ne') && picks.includes(null));
  await act(state, world, { type: 'choose', pick: 'spl-ne' });
  await act(state, world, { type: 'choose', pick: 'spl-pg' });
  assert.equal((state.asks![0].effect as SacramentEffect).left, 1);
  await act(state, world, { type: 'choose', pick: null });
  assert.deepEqual(x.exiled, ['spl-ne', 'spl-pg']);
  assert.ok(learnBlocked(world, x, 'spl-ne')?.includes('추방'));
  assert.ok(foesOf(x, state.minutes).includes(p.id));
});

test('Sadistic Sacrament between NPCs: a step lighter, what is cut goes to the graveyard (to be learned again); kicked, up to fifteen', () => {
  const world = fixture([sacrament, demolishSpell, escapeSpell, npc('chr-c', { ...npcSim('loc-a'), mana: { B: 9 } }), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, x] = [state.actors['chr-c'], state.actors['chr-x']];
  x.tile = c.tile;
  castSpell(state, world, c, 'spl-sac', 'chr-x', true, state.minutes);
  const ch = state.choices!.find((y) => y.effect.type === 'sacrament')!;
  assert.equal((ch.effect as SacramentEffect).left, 15);
  const next = applySacrament(state, world, c, ch.effect as SacramentEffect, 'spl-dm', state.minutes);
  assert.deepEqual(x.graveyard, ['spl-dm']);
  assert.equal(x.exiled, undefined);
  assert.ok(next && !next.candidates.includes('spl-dm'));
});

test('the real Sadistic Sacrament is taught in Malakir: three spells cut from one\'s future, fifteen kicked', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-sadistic-sacrament')!;
  assert.equal(s.learnAt, 'loc-malakir');
  const e = s.effects[0];
  assert.ok(e.type === 'exile_library' && e.count === 3 && e.kicked_count === 15);
});

const silhouette: RawEntity = { id: 'spl-sil', kind: 'spell', name: '야성의 그림자', status: 'canon', sim: { cost: '{0}', learn_at: 'loc-a', target: 'any_here', effects: [{ type: 'aura', pt: [2, 2], regenerate: '{1}{G}' }] } };

test('Savage Silhouette: +2/+2; about to die, the bearer pays {1}{G} by itself and is healed, bound and out of the fight; with no mana left, it dies', () => {
  const world = fixture([silhouette, npc('chr-x', { ...npcSim('loc-a', 'work', [1, 1]), mana: { G: 2 } }), npc('chr-y', npcSim('loc-a', 'work', [5, 5]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [x, y] = [state.actors['chr-x'], state.actors['chr-y']];
  y.tile = x.tile;
  castSpell(state, world, x, 'spl-sil', 'chr-x', false, state.minutes);
  assert.deepEqual(ptOf(x), [3, 3]);
  addFoe(y, 'chr-x', state.minutes);
  addFoe(x, 'chr-y', state.minutes);
  dealDamage(state, world, x, 9, state.minutes, '시험');
  assert.ok(!x.dead);
  assert.equal(woundsOf(x, state.minutes), 0);
  assert.ok(x.boundUntil !== undefined);
  assert.ok(!foesOf(y, state.minutes).includes('chr-x'));
  assert.ok(texts(state).some((l) => l.includes('야성의 그림자의 힘으로 되살아났다')));
  // Spent: the next blow is the end.
  dealDamage(state, world, x, 9, state.minutes, '시험');
  assert.ok(x.dead);
});

test('Savage Silhouette: a destroy is regenerated too, its master paying for a retainer', () => {
  const world = fixture([silhouette, npc('chr-x', npcSim('loc-a')), npc('chr-m', { ...npcSim('loc-a'), mana: { G: 2 } })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [x, m] = [state.actors['chr-x'], state.actors['chr-m']];
  x.tile = m.tile;
  x.master = 'chr-m';
  castSpell(state, world, m, 'spl-sil', 'chr-x', false, state.minutes);
  assert.equal(destroy(state, world, x, state.minutes, '시험'), false);
  assert.ok(!x.dead);
  assert.ok(texts(state).some((l) => l.includes('chr-m이(가) 치름')));
});

test('the real Savage Silhouette is taught in the Tangled Vale: +2/+2 and regeneration for {1}{G}', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-savage-silhouette')!;
  assert.equal(s.learnAt, 'loc-tangled-vale');
  const e = s.effects[0];
  assert.ok(e.type === 'aura' && e.regenerate === '{1}{G}' && e.pt[0] === 2 && e.pt[1] === 2);
});

const slaughterCry: RawEntity = { id: 'spl-cry', kind: 'spell', name: '살육의 함성', status: 'canon', sim: { cost: '{0}', speed: 'instant', learn_at: 'loc-a', target: 'any_here', effects: [{ type: 'pump_target', pt: [3, 0], abilities: ['first_strike'] }] } };

test('Slaughter Cry: one creature there gets +3/+0 and first strike until midnight; no planeswalker', async () => {
  const world = fixture([slaughterCry, npc('chr-c', npcSim('loc-a', 'work', [1, 2])), npc('chr-pw', { ...npcSim('loc-a'), loyalty: 3 })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, pw] = [state.actors['chr-c'], state.actors['chr-pw']];
  pw.tile = c.tile;
  c.spells = ['spl-cry'];
  assert.ok(castBlocked(state, world, c, 'spl-cry', 'chr-pw', false, state.minutes)?.includes('플레인즈워커'));
  castSpell(state, world, c, 'spl-cry', 'chr-c', false, state.minutes);
  assert.deepEqual(ptOf(c), [4, 2]);
  assert.ok(hasAbility(c, 'first_strike', state.minutes));
  await advance(state, world, 24);
  assert.deepEqual(ptOf(c), [1, 2]);
  assert.ok(!hasAbility(c, 'first_strike', state.minutes));
});

test('the real Slaughter Cry is taught in the Tangled Vale: +3/+0 and first strike', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-slaughter-cry')!;
  assert.equal(s.learnAt, 'loc-tangled-vale');
  assert.equal(s.speed, 'instant');
  const e = s.effects[0];
  assert.ok(e.type === 'pump_target' && e.pt[0] === 3 && e.abilities.includes('first_strike'));
});

test('the real Stonework Puma walks the Makindi trails: a colorless artifact Ally, tamed or bought for 30 coin, unafraid of intimidation', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const p = state.actors['cre-stonework-puma'];
  assert.equal(p?.region, 'loc-makindi');
  const def = npcDef(state, world, p.id)!;
  assert.ok(def.beast && def.ally && def.hireable && def.types?.includes('artifact'));
  assert.equal(hirePrice(def), 30);
  assert.deepEqual(actorColors(state, world, p), []);
  assert.equal(manaCapacity(state, world, p).C, 3);
  const boar = state.actors['cre-bladetusk-boar'];
  assert.equal(intimidated(state, world, boar, p, state.minutes), false);
  assert.equal(swayBlocked(state, world, p), null);
});

test('Tajuru Archer: an Ally joining, the controller may shoot one there who can fly, for as many as the party\'s Allies; not one on the ground', () => {
  const archer = { ...npcSim('loc-a', 'work', [1, 2]), mana: { G: 3 }, ally: true, hireable: true, types: ['elf'], rally: [{ type: 'damage_fliers' }] };
  const world = fixture([npc('chr-ar', archer), npc('chr-m', npcSim('loc-a')), npc('chr-f', { ...npcSim('loc-a', 'work', [1, 9]), abilities: ['fly'] }), npc('chr-g', npcSim('loc-a', 'work', [1, 9]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [ar, m, f, g] = ['chr-ar', 'chr-m', 'chr-f', 'chr-g'].map((id) => state.actors[id]);
  for (const a of [ar, f, g]) a.tile = m.tile;
  bindRetainer(state, world, ar, m, state.minutes, '고용');
  const c = state.choices!.find((x) => x.effect.type === 'rally')!;
  assert.deepEqual(c.candidates, ['chr-f']);
  applyRally(state, world, 'chr-ar', 'chr-f', state.minutes);
  assert.equal(woundsOf(f, state.minutes), 1); // one Ally in the party
  assert.ok(texts(state).some((l) => l.includes('화살을 날렸다')));
  applyRally(state, world, 'chr-ar', 'chr-g', state.minutes);
  assert.equal(woundsOf(g, state.minutes), 0);
});

test('the real Tajuru Archer lives in the Oran-Rief treetop village: an elf Ally for 30 coin, shooting fliers', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const a = state.actors['chr-tajuru-archer'];
  assert.equal(a?.region, 'loc-oran-rief');
  const def = npcDef(state, world, a.id)!;
  assert.ok(def.ally && def.hireable && def.types?.includes('elf'));
  assert.equal(hirePrice(def), 30);
  assert.deepEqual(def.rally, [{ type: 'damage_fliers' }]);
});

test('Torch Slinger: arriving with {1}{R} to spare, its controller may have it throw a torch at one there for 2 (a knockout between NPCs); short of mana, nothing', () => {
  const slinger = (mana: number) => ({ ...npcSim('loc-a', 'work', [2, 2]), mana: { R: mana }, enter_damage: { amount: 2, kicker: '{1}{R}' } });
  const world = fixture([npc('chr-t', slinger(5)), npc('chr-poor', slinger(1)), npc('chr-x', npcSim('loc-a', 'work', [1, 2])), npc('chr-pw', { ...npcSim('loc-a'), loyalty: 3 })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [ts, poor, x, pw] = ['chr-t', 'chr-poor', 'chr-x', 'chr-pw'].map((id) => state.actors[id]);
  for (const a of [poor, x, pw]) a.tile = ts.tile;
  enterDamage(state, world, poor, state.minutes);
  assert.equal(state.choices?.length ?? 0, 0);
  enterDamage(state, world, ts, state.minutes);
  const c = state.choices!.find((y) => y.effect.type === 'torch')!;
  assert.equal(c.by, 'chr-t');
  assert.ok(c.optional && c.candidates.includes('chr-x') && !c.candidates.includes('chr-pw'));
  applyTorch(state, world, ts, x, state.minutes);
  assert.ok(!x.dead && knockedOut(x));
  assert.ok(texts(state).some((l) => l.includes('타오르는 횃불을 chr-x에게 내던졌다')));
  assert.equal(manaAvailable(state, world, ts, state.minutes).R, 3);
});

test('the real Torch Slinger roams the dark woods of Ora Ondar: a talking goblin with a kicked torch', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const s = state.actors['chr-torch-slinger'];
  assert.equal(s?.region, 'loc-ora-ondar');
  const def = npcDef(state, world, s.id)!;
  assert.equal(def.enterDamage?.amount, 2);
  assert.equal(def.enterDamage?.kickerText, '{1}{R}');
  assert.equal(swayBlocked(state, world, s), null);
});

test('Turntimber Basilisk: bonding, its controller may catch one there in its gaze: foes today, and no flying away', () => {
  const lisk = { ...npcSim('loc-a', 'work', [2, 1]), needs: ['energy', 'hunger'], beast: true, abilities: ['deathtouch'], landfall_lure: true };
  const world = fixture([npc('chr-b', lisk), npc('chr-f', { ...npcSim('loc-a', 'work', [3, 3]), abilities: ['fly'] }), npc('chr-pw', { ...npcSim('loc-a'), loyalty: 3 })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [b, f, pw] = ['chr-b', 'chr-f', 'chr-pw'].map((id) => state.actors[id]);
  for (const a of [f, pw]) a.tile = b.tile;
  bondLand(state, world, b, state.minutes, 'loc-a');
  const c = state.choices!.find((x) => x.effect.type === 'lure')!;
  assert.equal(c.by, 'chr-b');
  assert.deepEqual(c.candidates, ['chr-f']);
  applyLure(state, world, b, f, state.minutes);
  assert.ok(foesOf(b, state.minutes).includes('chr-f') && foesOf(f, state.minutes).includes('chr-b'));
  assert.ok(f.evasions?.some((e) => e.from === 'chr-b' && !e.evade));
  assert.ok(texts(state).some((l) => l.includes('번득이는 눈에 사로잡혔다')));
});

test('the real Turntimber Basilisk lurks deep in the Turntimber Grove: deathtouch, and a luring gaze on landfall', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const b = state.actors['cre-turntimber-basilisk'];
  assert.equal(b?.region, 'loc-turntimber-grove');
  assert.ok(hasAbility(b, 'deathtouch', state.minutes));
  const def = npcDef(state, world, b.id)!;
  assert.ok(def.beast && def.landfallLure && def.needs.includes('hunger'));
});

test('the real Umara Raptor nests by the falls of the Umara gorge: a flying bird Ally, tamed or bought for 30, growing as Allies join', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const r = state.actors['cre-umara-raptor'];
  assert.equal(r?.region, 'loc-umara-gorge');
  const def = npcDef(state, world, r.id)!;
  assert.ok(def.beast && def.ally && def.hireable && hasAbility(r, 'fly', state.minutes));
  assert.equal(hirePrice(def), 30);
  assert.deepEqual(def.rally, [{ type: 'counter_self' }]);
  // Joining someone's party (one with no Allies of their own), it grows.
  const m = state.actors['chr-reckless-scholar'];
  bindRetainer(state, world, r, m, state.minutes, '고용');
  assert.equal(r.plusCounters, 1);
});

test('the real Vampire Nighthawk perches on the towers of Malakir: flying, deathtouch, lifelink, a vampire the Mindless Null may follow', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const v = state.actors['chr-vampire-nighthawk'];
  assert.equal(v?.region, 'loc-malakir');
  for (const ab of ['fly', 'deathtouch', 'lifelink'] as const) assert.ok(hasAbility(v, ab, state.minutes), ab);
  assert.equal(creatureOf(state, world, v.id), 'cre-vampire');
  assert.equal(followBlocked(state, world, state.actors['cre-mindless-null'], v), null);
  assert.equal(swayBlocked(state, world, v), null);
});

test('can\'t be blocked: no one strikes back at it, nor stands against it for its master; a flyer may still fly off', () => {
  const fig = { ...npcSim('loc-a', 'work', [1, 1]), abilities: ['unblockable'] };
  const world = fixture([npc('chr-u', fig), npc('chr-m', npcSim('loc-a', 'work', [1, 20])), npc('chr-g', npcSim('loc-a', 'work', [3, 3])), npc('chr-f', { ...npcSim('loc-a'), abilities: ['fly'] })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [u, m, g, f] = ['chr-u', 'chr-m', 'chr-g', 'chr-f'].map((id) => state.actors[id]);
  for (const a of [m, g, f]) a.tile = u.tile;
  assert.ok(unblockable(state, world, u, m, state.minutes)?.includes('막을 수 없는'));
  assert.equal(unblockable(state, world, u, f, state.minutes, true), null);
  g.master = 'chr-m';
  const t = state.minutes;
  clash(state, world, u, m, t);
  hostileNpcs(state, world, t + 60);
  assert.ok(!state.log.some((e) => e.kind === 'combat' && e.actors[0] === 'chr-g' && e.actors[1] === 'chr-u'));
});

test('Aether Figment: arriving with {3} to spare it pays and swells +2/+2 until midnight; short of it, nothing', () => {
  const fig = (mana: number) => ({ ...npcSim('loc-a', 'work', [1, 1]), mana: { U: mana }, needs: ['energy'], beast: true, abilities: ['unblockable'], enter_pump: { pt: [2, 2], kicker: '{3}' } });
  const world = fixture([npc('chr-u', fig(5)), npc('chr-p', fig(2))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [u, p] = [state.actors['chr-u'], state.actors['chr-p']];
  onEnter(state, world, u, state.minutes);
  onEnter(state, world, p, state.minutes);
  assert.deepEqual(ptOf(u), [3, 3]);
  assert.deepEqual(ptOf(p), [1, 1]);
  assert.equal(manaAvailable(state, world, u, state.minutes).U, 2);
});

test('the real Aether Figment drifts on Jwar Isle: unblockable, swelling when kicked', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const f = state.actors['cre-aether-figment'];
  assert.equal(f?.region, 'loc-jwar-isle');
  assert.ok(hasAbility(f, 'unblockable', state.minutes));
  assert.deepEqual(npcDef(state, world, f.id)?.enterPump?.pt, [2, 2]);
});

test('Armament Master: each Equipment on it gives the other Kor its controller has +2/+2; not itself, not one who is no Kor', () => {
  const master = { ...npcSim('loc-a', 'work', [2, 2]), types: ['kor'], equip_anthem: { kind: 'kor', pt: [2, 2] } };
  const world = fixture([hook, npc('chr-am', master), npc('chr-m', npcSim('loc-a')), npc('chr-k', { ...npcSim('loc-a', 'work', [1, 1]), types: ['kor'] }), npc('chr-n', npcSim('loc-a', 'work', [1, 1]))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [am, k, n] = ['chr-am', 'chr-k', 'chr-n'].map((id) => state.actors[id]);
  for (const x of [am, k, n]) x.master = 'chr-m';
  anthemHour(state, world);
  assert.deepEqual(ptOf(k), [1, 1]); // nothing borne yet
  state.items = { 'itm-h': { name: '갈고리', owner: 'chr-m', counters: 0, carried: true, bearer: 'chr-am' } };
  anthemHour(state, world);
  assert.deepEqual(ptOf(k), [3, 3]);
  assert.deepEqual(ptOf(n), [1, 1]);
  assert.deepEqual(ptOf(am), [2, 2]);
  // Taken off: gone at the next hour.
  delete state.items['itm-h'].bearer;
  anthemHour(state, world);
  assert.deepEqual(ptOf(k), [1, 1]);
});

test('the real Armament Master keeps the Kor camp in Makindi; the world\'s Kor are Kor now, the Pledge\'s soldiers too', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const a = state.actors['chr-armament-master'];
  assert.equal(a?.region, 'loc-makindi');
  assert.deepEqual(npcDef(state, world, a.id)?.equipAnthem, { kind: 'kor', pt: [2, 2] });
  for (const id of ['chr-devout-lightcaster', 'chr-kor-cartographer', 'chr-kor-hookmaster', 'chr-makindi-shieldmate', 'chr-kor-sanctifiers', 'chr-armament-master'])
    assert.ok(npcDef(state, world, id)?.types?.includes('kor'), id);
  const pledge = world.spells.find((s) => s.id === 'spl-conquerors-pledge')!.effects[0];
  assert.ok(pledge.type === 'create_retainers' && pledge.types?.includes('kor'));
});

const bloodghast = () => npc('chr-bg', { ...npcSim('loc-a', 'work', [2, 1]), mana: { B: 2 }, needs: ['energy'], beast: true, creature: 'cre-v', abilities: ['cant_block'], haste_low_life: 10, landfall_return: true });

test('Bloodghast: dead in its master\'s graveyard, it rises at their side when they bond with a land', () => {
  const world = fixture([vampireKind(), bloodghast(), npc('chr-m', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [bg, m] = [state.actors['chr-bg'], state.actors['chr-m']];
  bg.master = 'chr-m';
  die(state, bg, state.minutes, '시험');
  assert.ok(bg.dead);
  assert.deepEqual(m.fallen, ['chr-bg']);
  m.region = 'loc-b';
  bondLand(state, world, m, state.minutes, 'loc-b');
  assert.ok(!bg.dead);
  assert.equal(bg.master, 'chr-m');
  assert.equal(bg.region, 'loc-b');
  assert.deepEqual(m.fallen, []);
  assert.ok(texts(state).some((l) => l.includes('무덤에서') && l.includes('되살아나')));
});

test('Bloodghast: haste while a foe of today has 10 life or less; gone when none does', () => {
  const world = fixture([vampireKind(), bloodghast(), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [bg, x] = [state.actors['chr-bg'], state.actors['chr-x']];
  addFoe(bg, 'chr-x', state.minutes);
  bloodHasteHour(state, world, state.minutes);
  assert.ok(!hasAbility(bg, 'haste', state.minutes));
  x.life = 10;
  bloodHasteHour(state, world, state.minutes);
  assert.ok(hasAbility(bg, 'haste', state.minutes));
  x.life = 15;
  bloodHasteHour(state, world, state.minutes);
  assert.ok(!hasAbility(bg, 'haste', state.minutes));
});

test('the real Bloodghast drifts in the Guul Draz mists: a vampire that can\'t block, swift on the scent, back from the grave on landfall', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const b = state.actors['chr-bloodghast'];
  assert.equal(b?.region, 'loc-guul-draz');
  const def = npcDef(state, world, b.id)!;
  assert.ok(def.beast && def.landfallReturn && def.hasteLowLife === 10);
  assert.ok(hasAbility(b, 'cant_block', state.minutes));
  assert.equal(creatureOf(state, world, b.id), 'cre-vampire');
});

test('Blood Seeker: one on its tile not of its side who gains a retainer loses 1 life; its own side, or one elsewhere, loses none', () => {
  const seeker = { ...npcSim('loc-a', 'work', [1, 1]), drain_on_join: 1 };
  const world = fixture([npc('chr-s', seeker), npc('chr-m', npcSim('loc-a')), npc('chr-x', npcSim('loc-a')), npc('chr-o', npcSim('loc-a')), npc('chr-y', npcSim('loc-a')), npc('chr-z', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [s, m, x, o, y, z] = ['chr-s', 'chr-m', 'chr-x', 'chr-o', 'chr-y', 'chr-z'].map((id) => state.actors[id]);
  for (const a of [m, x, o, y]) a.tile = s.tile;
  z.region = 'loc-b';
  const t = state.minutes;
  bloodSeekHour(state, world, t); // start counting
  bindRetainer(state, world, x, m, t, '설득'); // a stranger gains one: drained
  bindRetainer(state, world, y, s, t, '설득'); // its own side: nothing
  bindRetainer(state, world, o, z, t, '설득'); // elsewhere: nothing
  bloodSeekHour(state, world, t + 60);
  assert.equal(lifeOf(m), 19);
  assert.equal(lifeOf(s), 20);
  assert.equal(lifeOf(z), 20);
  // Counted once.
  bloodSeekHour(state, world, t + 120);
  assert.equal(lifeOf(m), 19);
});

test('the real Blood Seeker haunts the alleys of Malakir: a vampire who takes a drop of blood for each creature a stranger gains', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const b = state.actors['chr-blood-seeker'];
  assert.equal(b?.region, 'loc-malakir');
  assert.equal(npcDef(state, world, b.id)?.drainOnJoin, 1);
  assert.equal(creatureOf(state, world, b.id), 'cre-vampire');
});

const altarItem: RawEntity = { id: 'itm-alt', kind: 'item', name: '제단', status: 'canon', sim: { cost: '{0}', at: 'loc-a', pos: [0, 0], effects: [{ type: 'sacrifice_draw', cost: '{1}', draws: 1 }] } };

test('Carnage Altar by the player: before it, they pay and offer one who serves them; that one dies into their graveyard, and they learn a secret', async () => {
  const world = fixture([altarItem, demolishSpell, npc('chr-x', npcSim('loc-a'))]);
  const state = character(world, 'loc-a');
  const [p, x] = [state.actors[PLAYER_ID], state.actors['chr-x']];
  p.bonds = ['loc-a'];
  state.items = { 'itm-alt': { name: '제단', owner: p.id, counters: 0 } };
  x.master = p.id;
  const spot = itemWhere(state, world, world.items.find((i) => i.id === 'itm-alt')!)!.tile!;
  p.tile = tilesOf(world, 'loc-a').find((t) => !sameTile(t, spot)) ?? spot;
  x.tile = p.tile;
  if (!sameTile(p.tile, spot)) assert.ok(altarBlocked(state, world, p, 'chr-x', state.minutes)?.includes('앞에 있어야'));
  p.tile = spot;
  x.tile = spot;
  assert.ok(altarBlocked(state, world, p, p.id, state.minutes)?.includes('자신은 바치지 않는다'));
  const known = p.knowledge?.length ?? 0;
  await act(state, world, { type: 'altar', to: 'chr-x' });
  assert.ok(x.dead);
  assert.ok(p.fallen?.includes('chr-x'));
  assert.equal(p.knowledge?.length, known + 1);
});

test('Carnage Altar by an NPC: an altar block, walking to it, offering a retainer', async () => {
  const plan = [
    ['00:00', '06:00', 'loc-a', 'sleep', '잠', '😴'],
    ['06:00', '08:00', 'loc-a', 'altar', '제물', '🩸', undefined, undefined, 'chr-x'],
    ['08:00', '24:00', 'loc-a', 'work', '일', '🔨'],
  ];
  const world = fixture([altarItem, demolishSpell, npc('chr-m', { ...npcSim('loc-a'), mana: { B: 3 }, plan }), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [m, x] = [state.actors['chr-m'], state.actors['chr-x']];
  state.items = { 'itm-alt': { name: '제단', owner: m.id, counters: 0 } };
  x.master = m.id;
  let offered: PlanDayInput | undefined;
  await advance(state, world, 2, { planDay: async (input) => (input.id === 'chr-m' && (offered = input), planDay!(input)) });
  assert.equal(offered?.altar?.at, 'loc-a');
  assert.deepEqual(offered?.altar?.who.map((w) => w.id), ['chr-x']);
  assert.ok(x.dead);
  assert.equal(m.knowledge?.length, 1);
});

test('the real Carnage Altar stands in the ruins of the Teeth of Akoum', () => {
  const world = loadWorld();
  const x = world.items.find((i) => i.id === 'itm-carnage-altar')!;
  assert.equal(x.at, 'loc-teeth-of-akoum');
  assert.deepEqual(x.effects, [{ type: 'sacrifice_draw', cost: '{3}', draws: 1 }]);
});

const expeditionItem: RawEntity = { id: 'itm-exp', kind: 'item', name: '원정', status: 'canon', sim: { card_type: 'enchantment', cost: '{0}', at: 'loc-a', effects: [{ type: 'landfall_quest' }, { type: 'expedition', counters: 3, draws: 2 }] } };

test('Ior Ruin Expedition: each landfall of its owner puts a quest counter on it; with three, the player ends it anywhere: it is gone and they learn two secrets', async () => {
  const world = fixture([expeditionItem, altarItem, demolishSpell]);
  const state = character(world, 'loc-a');
  const p = state.actors[PLAYER_ID];
  state.items = { 'itm-exp': { name: '원정', owner: p.id, counters: 0 } };
  assert.ok(expeditionBlocked(state, world, p)?.includes('0/3'));
  for (const land of ['loc-a', 'loc-b']) bondLand(state, world, p, state.minutes, land);
  assert.equal(state.items['itm-exp'].counters, 2);
  assert.ok((await act(state, world, { type: 'expedition' })).error?.includes('2/3'));
  state.items['itm-exp'].counters = 3;
  assert.equal(expeditionBlocked(state, world, p), null);
  const known = p.knowledge?.length ?? 0;
  await act(state, world, { type: 'expedition' });
  assert.ok(state.items['itm-exp'].gone);
  assert.equal(state.items['itm-exp'].owner, undefined);
  assert.equal(p.knowledge?.length, known + 2);
  assert.ok(expeditionBlocked(state, world, p)?.includes('마칠 원정이 없다'));
});

test('Ior Ruin Expedition by an NPC: offered in their plan once it has three counters, an expedition block ends it', async () => {
  const plan = [
    ['00:00', '06:00', 'loc-a', 'sleep', '잠', '😴'],
    ['06:00', '07:00', 'loc-a', 'expedition', '원정을 마침', '🗺️'],
    ['07:00', '24:00', 'loc-a', 'work', '일', '🔨'],
  ];
  const world = fixture([expeditionItem, altarItem, demolishSpell, npc('chr-m', { ...npcSim('loc-a'), plan })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const m = state.actors['chr-m'];
  state.items = { 'itm-exp': { name: '원정', owner: m.id, counters: 3 } };
  let offered: PlanDayInput | undefined;
  await advance(state, world, 2, { planDay: async (input) => (input.id === 'chr-m' && (offered = input), planDay!(input)) });
  assert.deepEqual(offered?.expedition, { name: '원정', draws: 2 });
  assert.ok(state.items['itm-exp'].gone);
  assert.equal(m.knowledge?.length, 2);
});

test('the real Ior Ruin Expedition stands by Glasspool, a lake of Akoum and a basic island', () => {
  const world = loadWorld();
  const x = world.items.find((i) => i.id === 'itm-ior-ruin-expedition')!;
  assert.equal(x.at, 'loc-glasspool');
  assert.deepEqual(x.effects, [{ type: 'landfall_quest' }, { type: 'expedition', counters: 3, draws: 2 }]);
  const g = world.regions.find((r) => r.id === 'loc-glasspool')!;
  assert.equal(g.parent, 'loc-akoum');
  assert.deepEqual(landTypes(g), ['island']);
});

const journeySpell: RawEntity = { id: 'spl-jtn', kind: 'spell', name: '무로의 여정', status: 'canon', sim: { cost: '{0}', speed: 'sorcery', learn_at: 'loc-a', target: 'other_here', effects: [{ type: 'exile_until' }] } };

test('Journey to Nowhere: the one it falls on is gone from the world (stripped, freed, out of time) until the caster\'s enchantment is destroyed; then back on their tile', () => {
  const world = fixture([journeySpell, npc('chr-c', npcSim('loc-a')), npc('chr-m', npcSim('loc-a')), npc('chr-y', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, m, y] = ['chr-c', 'chr-m', 'chr-y'].map((id) => state.actors[id]);
  for (const a of [m, y]) a.tile = c.tile;
  const t = state.minutes;
  bindRetainer(state, world, y, m, t, '설득');
  y.plusCounters = 2;
  c.spells = ['spl-jtn'];
  const tile = y.tile;
  assert.ok(castSpell(state, world, c, 'spl-jtn', 'chr-y', false, t));
  assert.deepEqual(y.nowhere, { by: 'chr-c', spell: 'spl-jtn' });
  assert.equal(y.master, undefined);
  assert.equal(y.plusCounters, undefined);
  assert.ok(outOfTime(state, y));
  assert.ok(!present(state, 'loc-a', tile).includes(y));
  step(state, world);
  assert.ok(y.nowhere);
  const relic = relicsHere(state, world, c.region, c.tile).find((r) => r.id.startsWith('aura:chr-c'))!;
  assert.ok(relic.label.includes('무로의 여정'));
  assert.ok(crushRelic(state, world, relic.id, m, state.minutes));
  step(state, world);
  assert.equal(y.nowhere, undefined);
  assert.deepEqual(y.tile, tile);
  assert.ok(!outOfTime(state, y));
});

test('Journey to Nowhere: its caster dying brings the one taken back; a token taken is gone for good; a planeswalker can\'t be taken', () => {
  const world = fixture([journeySpell, lore('cre-w', 'creature'), npc('chr-c', npcSim('loc-a')), npc('chr-y', npcSim('loc-a')), npc('chr-pw', { ...npcSim('loc-a'), loyalty: 3 })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, y, pw] = ['chr-c', 'chr-y', 'chr-pw'].map((id) => state.actors[id]);
  for (const a of [y, pw]) a.tile = c.tile;
  c.spells = ['spl-jtn'];
  assert.ok(castBlocked(state, world, c, 'spl-jtn', 'chr-pw', false, state.minutes)?.includes('플레인즈워커'));
  castSpell(state, world, c, 'spl-jtn', 'chr-y', false, state.minutes);
  assert.ok(y.nowhere);
  die(state, c, state.minutes, '시험');
  step(state, world);
  assert.equal(y.nowhere, undefined);
  const world2 = fixture([journeySpell, lore('cre-w', 'creature'), npc('chr-c', npcSim('loc-a'))]);
  const state2 = newState(world2, { seed: 1, mode: 'observer' });
  const c2 = state2.actors['chr-c'];
  c2.spells = ['spl-jtn'];
  const [wolf] = spawnWild(state2, world2, 'cre-w', [2, 2], 1, 'loc-a', ['G'], c2.tile);
  castSpell(state2, world2, c2, 'spl-jtn', wolf.id, false, state2.minutes);
  assert.ok(wolf.dead);
  assert.equal(wolf.nowhere, undefined);
});

test('Journey to Nowhere on the player: they can only wait, out of the world, while the hours pass', async () => {
  const world = fixture([journeySpell, npc('chr-c', npcSim('loc-a', 'work', [1, 20]))]);
  const state = character(world, 'loc-a');
  const [p, c] = [state.actors[PLAYER_ID], state.actors['chr-c']];
  c.tile = p.tile;
  c.spells = ['spl-jtn'];
  castSpell(state, world, c, 'spl-jtn', p.id, false, state.minutes);
  assert.ok(p.nowhere);
  const r = await act(state, world, { type: 'wait', hours: 1 });
  assert.ok(r.entries.some((e) => e.text.includes('어디에도 없는 곳')));
  assert.ok(p.nowhere);
});

test('the real Journey to Nowhere is taught in Emeria: a white enchantment, a sorcery', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-journey-to-nowhere')!;
  assert.equal(s.learnAt, 'loc-emeria');
  assert.equal(s.speed, 'sorcery');
  assert.deepEqual(s.effects.map((e) => e.type), ['exile_until']);
});

test('mountainwalk: one bonded with a mountain can\'t strike back at it; one with none can', () => {
  const world = fixture([npc('chr-c', { ...npcSim('loc-a', 'work', [2, 1]), abilities: ['mountainwalk'] }), npc('chr-x', npcSim('loc-a')), npc('chr-y', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, x, y] = ['chr-c', 'chr-x', 'chr-y'].map((id) => state.actors[id]);
  x.bonds = ['loc-c']; // rocky: a mountain
  y.bonds = ['loc-b'];
  assert.equal(landwalked(world, c, x, state.minutes), 'mountain');
  assert.equal(landwalked(world, c, y, state.minutes), null);
});

test('the real Cliff Threader crosses the Makindi cliffs: a Kor scout with mountainwalk', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const c = state.actors['chr-cliff-threader'];
  assert.equal(c?.region, 'loc-makindi');
  assert.ok(hasAbility(c, 'mountainwalk', state.minutes));
  assert.ok(npcDef(state, world, c.id)?.types?.includes('kor'));
  assert.equal(swayBlocked(state, world, c), null);
});

const feast: RawEntity = { id: 'spl-feast', kind: 'spell', name: '피의 향연', status: 'canon', sim: { cost: '{0}', requires: { kind: 'cre-v', count: 2 }, learn_at: 'loc-a', target: 'other_here', effects: [{ type: 'destroy_target' }, { type: 'gain_life', amount: 4 }] } };

test('Feast of Blood: only with two vampires of one\'s own (themselves counting); then the target dies and the caster gains 4', () => {
  const world = fixture([vampireKind(), feast, npc('chr-c', { ...npcSim('loc-a'), creature: 'cre-v' }), npc('chr-v', { ...npcSim('loc-a'), creature: 'cre-v' }), npc('chr-x', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, v, x] = ['chr-c', 'chr-v', 'chr-x'].map((id) => state.actors[id]);
  for (const a of [v, x]) a.tile = c.tile;
  c.spells = ['spl-feast'];
  assert.ok(castBlocked(state, world, c, 'spl-feast', 'chr-x', false, state.minutes)?.includes('2 이상 거느려야'));
  assert.ok(npcCastBlocked(state, world, c, 'spl-feast', state.minutes)?.includes('지금 1'));
  v.master = 'chr-c';
  assert.equal(castBlocked(state, world, c, 'spl-feast', 'chr-x', false, state.minutes), null);
  castSpell(state, world, c, 'spl-feast', 'chr-x', false, state.minutes);
  assert.ok(x.dead);
  assert.equal(lifeOf(c), 24);
});

test('the real Feast of Blood is taught in Malakir: two vampires needed', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-feast-of-blood')!;
  assert.equal(s.learnAt, 'loc-malakir');
  assert.deepEqual(s.requires, { kind: 'cre-vampire', count: 2 });
});

test('Frontier Guide: its controller pays {3}{G} and taps it; they may bond from afar with a basic land, tapped (no mana today)', () => {
  const guide = { ...npcSim('loc-a', 'work', [1, 1]), types: ['elf'], tap_search: { cost: '{3}{G}', types: ['plains', 'island', 'swamp', 'mountain', 'forest'] } };
  const world = fixture([npc('chr-g', guide), npc('chr-m', { ...npcSim('loc-a'), mana: { G: 5 } }), npc('chr-p', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [g, m] = ['chr-g', 'chr-m'].map((id) => state.actors[id]);
  g.master = 'chr-m';
  assert.ok(tapBlocked(state, world, m, 'scout', 'chr-g', state.minutes)?.includes('조종하는 이에게만'));
  assert.equal(tapBlocked(state, world, m, 'scout', undefined, state.minutes), null);
  useTap(state, world, m, 'scout', undefined, state.minutes);
  assert.ok(g.boundUntil !== undefined);
  assert.equal(manaAvailable(state, world, m, state.minutes).G, 1);
  const c = state.choices!.find((x) => x.effect.type === 'search')!;
  assert.ok(c.by === 'chr-m' && c.candidates.includes('loc-b'));
  applySearch(state, world, m, 'loc-b', 'chr-g', state.minutes);
  assert.ok(m.bonds?.includes('loc-b'));
  assert.ok(m.landsTapped?.ids.includes('loc-b'));
  // One with no mana to spare can't.
  const w2 = fixture([npc('chr-g', guide), npc('chr-p', npcSim('loc-a'))]);
  const s2 = newState(w2, { seed: 1, mode: 'observer' });
  s2.actors['chr-g'].master = 'chr-p';
  assert.ok(tapBlocked(s2, w2, s2.actors['chr-p'], 'scout', undefined, s2.minutes)?.includes('마나가 모자라다'));
});

test('the real Frontier Guide roams the Kazandu treetops: a Tajuru elf who finds the way to a basic land', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['chr-frontier-guide'];
  assert.equal(g?.region, 'loc-kazandu');
  const def = npcDef(state, world, g.id)!;
  assert.equal(def.tapSearch?.costText, '{3}{G}');
  assert.ok(def.types?.includes('elf'));
});

test('Gatekeeper of Malakir: arriving with {B} to spare, its controller may make one there pay the toll: a creature of theirs (themselves too) dies', () => {
  const gate = { ...npcSim('loc-a', 'work', [2, 2]), mana: { B: 3 }, enter_sacrifice: { kicker: '{B}' } };
  const world = fixture([npc('chr-g', gate), npc('chr-x', npcSim('loc-a')), npc('chr-r', npcSim('loc-a')), npc('chr-y', npcSim('loc-a'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [g, x, r, y] = ['chr-g', 'chr-x', 'chr-r', 'chr-y'].map((id) => state.actors[id]);
  for (const a of [x, r, y]) a.tile = g.tile;
  r.master = 'chr-x';
  enterSacrifice(state, world, g, state.minutes);
  const c = state.choices!.find((z) => z.effect.type === 'toll')!;
  assert.ok(c.optional && c.candidates.includes('chr-x') && c.candidates.includes('chr-y'));
  // One with a retainer picks which (after the hour); one alone gives themselves.
  applyToll(state, world, g, x, state.minutes);
  const q = state.choices!.find((z) => z.effect.type === 'quelled')!;
  assert.equal(q.by, 'chr-x');
  assert.deepEqual(q.candidates.sort(), ['creature:chr-r', 'creature:chr-x']);
  assert.equal(manaAvailable(state, world, g, state.minutes).B, 2);
  applyToll(state, world, g, y, state.minutes);
  assert.ok(y.dead);
});

test('the real Gatekeeper of Malakir guards the east gate of Malakir: a vampire taking a toll of blood', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['chr-gatekeeper-of-malakir'];
  assert.equal(g?.region, 'loc-malakir');
  assert.equal(npcDef(state, world, g.id)?.enterSacrifice?.kickerText, '{B}');
  assert.equal(creatureOf(state, world, g.id), 'cre-vampire');
});

test('Goblin Shortcutter: arriving, its controller picks one there (one must be) who can\'t block until midnight', async () => {
  const world = fixture([npc('chr-gs', { ...npcSim('loc-a', 'work', [2, 1]), enter_no_block: true }), npc('chr-x', npcSim('loc-a')), npc('chr-pw', { ...npcSim('loc-a'), loyalty: 3 })]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [gs, x, pw] = ['chr-gs', 'chr-x', 'chr-pw'].map((id) => state.actors[id]);
  for (const a of [x, pw]) a.tile = gs.tile;
  enterNoBlock(state, world, gs, state.minutes);
  const c = state.choices!.find((y) => y.effect.type === 'shortcut')!;
  assert.ok(!c.optional && c.candidates.includes('chr-x') && !c.candidates.includes('chr-pw'));
  applyShortcut(state, world, gs, x, state.minutes);
  assert.ok(hasAbility(x, 'cant_block', state.minutes));
  await advance(state, world, 24, { choose: async ({ candidates }) => candidates[0]?.id ?? null });
  assert.ok(!hasAbility(x, 'cant_block', state.minutes));
});

test('the real Goblin Shortcutter runs the passes of Murasa', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['chr-goblin-shortcutter'];
  assert.equal(g?.region, 'loc-murasa');
  const def = npcDef(state, world, g.id)!;
  assert.ok(def.enterNoBlock && !def.hireable);
});

test('the real Goblin War Paint is taught on the Teeth of Akoum: +2/+2 and haste, an aura', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-goblin-war-paint')!;
  assert.equal(s.learnAt, 'loc-teeth-of-akoum');
  const state = newState(world, { seed: 1, mode: 'observer' });
  const g = state.actors['chr-tuktuk-grunts'];
  g.spells = ['spl-goblin-war-paint'];
  const before = ptOf(g);
  castSpell(state, world, g, 'spl-goblin-war-paint', g.id, false, state.minutes);
  assert.deepEqual(ptOf(g), [before[0] + 2, before[1] + 2]);
  assert.ok(hasAbility(g, 'haste', state.minutes));
});

const grimSpell: RawEntity = { id: 'spl-grim', kind: 'spell', name: '음산한 발견', status: 'canon', sim: { cost: '{0}', learn_at: 'loc-a', target: 'self', effects: [{ type: 'grim_discovery' }] } };

test('Grim Discovery: one of their dead rises at home, free; a land they held once comes back to their hand', () => {
  const world = fixture([grimSpell, npc('chr-c', npcSim('loc-a')), npc('chr-r', npcSim('loc-b'))]);
  const state = newState(world, { seed: 1, mode: 'observer' });
  const [c, r] = [state.actors['chr-c'], state.actors['chr-r']];
  c.spells = ['spl-grim'];
  assert.ok(castBlocked(state, world, c, 'spl-grim', 'chr-c', false, state.minutes)?.includes('무덤에'));
  r.master = 'chr-c';
  r.region = 'loc-a';
  die(state, r, state.minutes, '시험');
  bondLand(state, world, c, state.minutes, 'loc-b');
  c.bonds = [];
  castSpell(state, world, c, 'spl-grim', 'chr-c', false, state.minutes);
  const picks = state.choices!.filter((x) => x.effect.type === 'discovery');
  assert.deepEqual(picks.map((x) => (x.effect as { kind: string }).kind).sort(), ['creature', 'land']);
  applyDiscovery(state, world, c, 'creature', 'chr-r', '음산한 발견', state.minutes);
  assert.ok(!r.dead);
  assert.equal(r.master, undefined);
  assert.equal(r.region, 'loc-b'); // home
  applyDiscovery(state, world, c, 'land', 'loc-b', '음산한 발견', state.minutes);
  assert.deepEqual(c.handLands, ['loc-b']);
});

test('the real Grim Discovery is taught in the Guum Wilds', () => {
  const world = loadWorld();
  const s = world.spells.find((x) => x.id === 'spl-grim-discovery')!;
  assert.equal(s.learnAt, 'loc-guum-wilds');
  assert.deepEqual(s.effects.map((e) => e.type), ['grim_discovery']);
});

test('the real Hedron Scrabbler crawls the hedron fields of Akoum: a colorless artifact construct, +1/+1 on landfall', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const h = state.actors['cre-hedron-scrabbler'];
  assert.equal(h?.region, 'loc-akoum');
  const def = npcDef(state, world, h.id)!;
  assert.ok(def.beast && def.types?.includes('artifact') && !def.needs.includes('hunger'));
  assert.deepEqual(actorColors(state, world, h), []);
  bondLand(state, world, h, state.minutes, 'loc-akoum');
  assert.deepEqual(ptOf(h), [2, 2]);
});

test('the real Kazandu Blademaster hires out in the Kazandu Refuge for 20 coin: first strike, vigilance, a +1/+1 counter as it joins and as each Ally joins after', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const b = state.actors['chr-kazandu-blademaster'];
  assert.equal(b?.region, 'loc-kazandu-refuge');
  const def = npcDef(state, world, b.id)!;
  assert.ok(def.ally && def.hireable);
  assert.equal(hirePrice(def), 20);
  assert.ok(hasAbility(b, 'first_strike', state.minutes) && hasAbility(b, 'vigilance', state.minutes));
  const m = state.actors['chr-reckless-scholar'];
  bindRetainer(state, world, b, m, state.minutes, '고용');
  assert.equal(b.plusCounters, 1);
  bindRetainer(state, world, state.actors['chr-highland-berserker'], m, state.minutes, '고용');
  assert.equal(b.plusCounters, 2);
  assert.deepEqual(ptOf(b), [3, 3]);
});

test('the real Highland Berserker hires out on the Teeth of Akoum for 20 coin; joining a party, its Allies strike first today', () => {
  const world = loadWorld();
  const state = newState(world, { seed: 1, mode: 'observer' });
  const b = state.actors['chr-highland-berserker'];
  assert.equal(b?.region, 'loc-teeth-of-akoum');
  const def = npcDef(state, world, b.id)!;
  assert.ok(def.ally && def.hireable);
  assert.equal(hirePrice(def), 20);
  bindRetainer(state, world, b, state.actors['chr-reckless-scholar'], state.minutes, '고용');
  assert.ok(hasAbility(b, 'first_strike', state.minutes));
});
