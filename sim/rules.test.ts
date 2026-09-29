import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEffect, KIND_EFFECTS } from './rules.ts';
import { formatClock, parseTimeOfDay, START_MINUTES, untapTime } from './clock.ts';
import { parsePlan } from './llm/planner.ts';

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
