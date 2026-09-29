import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEffect, KIND_EFFECTS } from './rules.ts';
import { formatClock, parseTimeOfDay, START_MINUTES, untapTime } from './clock.ts';
import { parsePlan } from './llm/planner.ts';
import { parseManaCost, planPayment } from './mana.ts';

const block = (start: number, end: number, regionId = 'loc-a') => ({
  start,
  end,
  regionId,
  activity: '순찰',
  emoji: '🛡️',
  kind: 'work',
});

test('parsePlan accepts a valid plan wrapped in prose and sorts it', () => {
  const regions = new Set(['loc-a', 'loc-b']);
  const content = `Sure!\n${JSON.stringify({ blocks: [block(600, 1440), block(0, 600, 'loc-b')] })}`;
  const blocks = parsePlan(content, regions)!;
  assert.deepEqual(
    blocks.map((b) => b.start),
    [0, 600],
  );
});

test('parsePlan rejects unknown regions, overlaps, empty blocks and non-JSON', () => {
  const regions = new Set(['loc-a']);
  assert.equal(parsePlan(JSON.stringify({ blocks: [block(0, 600, 'loc-moon')] }), regions), null);
  assert.equal(parsePlan(JSON.stringify({ blocks: [block(0, 700), block(600, 1440)] }), regions), null);
  assert.equal(parsePlan(JSON.stringify({ blocks: [block(600, 600)] }), regions), null);
  assert.equal(parsePlan('no plan today', regions), null);
});

test('stats change per game hour and stay in range', () => {
  const stats = { energy: 95, hunger: 10, coin: 0 };
  applyEffect(stats, KIND_EFFECTS.sleep, 120);
  assert.equal(stats.energy, 100);
  assert.equal(stats.hunger, 14);
  applyEffect(stats, KIND_EFFECTS.eat, 60);
  assert.equal(stats.hunger, 0);
  assert.equal(stats.coin, 0);
});

test('clock', () => {
  assert.equal(formatClock(START_MINUTES), '1일차 06:00');
  assert.equal(formatClock(untapTime(START_MINUTES + 600)), '2일차 00:00');
  assert.equal(formatClock(untapTime(START_MINUTES + 600, true)), '3일차 00:00');
  assert.equal(parseTimeOfDay('24:00'), 1440);
});

test('mana costs parse and pay colored symbols first', () => {
  assert.deepEqual(parseManaCost('{5}{B}{B}'), { generic: 5, colored: { B: 2 } });
  assert.equal(parseManaCost('BB'), null);
  assert.equal(parseManaCost('{X}'), null);
  assert.deepEqual(planPayment({ B: 7 }, parseManaCost('{B}{B}{B}')!), { B: 3 });
  assert.deepEqual(planPayment({ U: 8 }, parseManaCost('{8}')!), { U: 8 });
  assert.deepEqual(planPayment({ C: 1, R: 2 }, parseManaCost('{1}{R}')!), { R: 1, C: 1 });
  assert.equal(planPayment({ R: 1 }, parseManaCost('{B}')!), null);
  assert.equal(planPayment({ U: 7 }, parseManaCost('{8}')!), null);
});
