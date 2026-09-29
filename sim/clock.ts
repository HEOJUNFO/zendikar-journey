// Game time is kept in game minutes on the state (State.minutes). It only moves when the
// simulation steps (turn-based): one step = one game hour.

export const DAY_MINUTES = 24 * 60;
export const STEP_MINUTES = 60;
// A fresh world starts on day 0 at 06:00.
export const START_MINUTES = 6 * 60;

export function gameDay(minutes: number) {
  return Math.floor(minutes / DAY_MINUTES);
}

export function minuteOfDay(minutes: number) {
  return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

// 06:00 of the day after `minutes`.
export function nextMorning(minutes: number) {
  return (gameDay(minutes) + 1) * DAY_MINUTES + START_MINUTES;
}

export function formatTimeOfDay(minuteInDay: number) {
  const h = Math.floor(minuteInDay / 60);
  const m = Math.floor(minuteInDay % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatClock(minutes: number) {
  return `${gameDay(minutes) + 1}일차 ${formatTimeOfDay(minuteOfDay(minutes))}`;
}

// "06:30" -> 390. "24:00" is allowed as the end of a day.
export function parseTimeOfDay(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
