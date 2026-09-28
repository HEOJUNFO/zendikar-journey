// Game time is kept in game minutes on the world (World.clock) and advanced from
// engine time each tick, so it pauses while the world is stopped.

// 1 game day = 24 real minutes.
export const GAME_MINUTES_PER_REAL_SECOND = 1;
export const DAY_MINUTES = 24 * 60;
// A fresh world starts on day 0 at 06:00.
export const START_MINUTES = 6 * 60;
// Caps a single clock advance so an engine resume (which jumps engine time
// forward) doesn't fast-forward the day.
export const MAX_CLOCK_STEP_MS = 1000;

export function gameDay(minutes: number) {
  return Math.floor(minutes / DAY_MINUTES);
}

export function minuteOfDay(minutes: number) {
  return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

export function gameMinutesToMs(minutes: number) {
  return (minutes / GAME_MINUTES_PER_REAL_SECOND) * 1000;
}

export function formatTimeOfDay(minuteInDay: number) {
  const h = Math.floor(minuteInDay / 60);
  const m = Math.floor(minuteInDay % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatClock(minutes: number) {
  return `${gameDay(minutes) + 1}일차 ${formatTimeOfDay(minuteOfDay(minutes))}`;
}
