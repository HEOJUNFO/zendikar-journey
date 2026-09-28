import { parsePlan } from './planner';
import { applyEffect, KIND_EFFECTS } from './rules';
import { World } from '../aiTown/world';
import { START_MINUTES, formatClock } from './clock';

const block = (start: number, end: number, placeId = 'plaza') => ({
  start,
  end,
  placeId,
  activity: '설교하기',
  emoji: '📖',
  kind: 'social',
});

describe('parsePlan', () => {
  const places = new Set(['plaza', 'lodging']);
  test('accepts a valid plan wrapped in prose and sorts it', () => {
    const content = `Sure!\n${JSON.stringify({ blocks: [block(600, 1440), block(0, 600, 'lodging')] })}`;
    const blocks = parsePlan(content, places)!;
    expect(blocks.map((b) => b.start)).toEqual([0, 600]);
  });
  test('rejects unknown places, overlaps, empty blocks and non-JSON', () => {
    expect(parsePlan(JSON.stringify({ blocks: [block(0, 600, 'moon')] }), places)).toBeNull();
    expect(parsePlan(JSON.stringify({ blocks: [block(0, 700), block(600, 1440)] }), places)).toBeNull();
    expect(parsePlan(JSON.stringify({ blocks: [block(600, 600)] }), places)).toBeNull();
    expect(parsePlan('no plan today', places)).toBeNull();
  });
});

describe('rules', () => {
  test('stats change per game hour and stay in range', () => {
    const stats = { energy: 95, hunger: 10, coin: 0 };
    applyEffect(stats, KIND_EFFECTS.sleep, 120);
    expect(stats.energy).toBe(100);
    expect(stats.hunger).toBe(14);
    applyEffect(stats, KIND_EFFECTS.eat, 60);
    expect(stats.hunger).toBe(0);
    expect(stats.coin).toBe(0);
  });
});

describe('World.advanceClock', () => {
  const world = () => new World({ nextId: 0, conversations: [], players: [], agents: [] });
  test('starts at 06:00 on day 1 and advances 1 game minute per real second', () => {
    const w = world();
    expect(w.advanceClock(1000)).toBe(0);
    expect(formatClock(w.clock!.minutes)).toBe('1일차 06:00');
    w.advanceClock(2000);
    expect(w.clock!.minutes).toBe(START_MINUTES + 1);
  });
  test('does not fast-forward across an engine resume gap', () => {
    const w = world();
    w.advanceClock(0);
    expect(w.advanceClock(10 * 60 * 1000)).toBe(1);
  });
});
