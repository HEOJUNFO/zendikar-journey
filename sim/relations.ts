// What characters think of each other: one latest impression per person, from talks and
// fights. Prompts read it (planner, reply, converse), so it is their memory of others.
import { formatClock } from './clock.ts';
import type { Actor } from './state.ts';
import { shortName } from './text.ts';

// Oldest impressions go first beyond this.
const MAX_RELATIONS = 12;

export function remember(a: Actor, other: Actor, text: string, t: number) {
  if (a.kind === 'player' || a.id === other.id) return;
  const rel = { ...(a.relations ?? {}) };
  delete rel[other.id];
  rel[other.id] = { name: shortName(other.name), text, t };
  const ids = Object.keys(rel);
  for (const id of ids.slice(0, Math.max(0, ids.length - MAX_RELATIONS))) delete rel[id];
  a.relations = rel;
}

// "- 이오나 (2일차 14:00): 믿을 만하다" lines, latest last.
export function relationsText(a: Actor) {
  return Object.values(a.relations ?? {})
    .sort((x, y) => x.t - y.t)
    .map((r) => `- ${r.name} (${formatClock(r.t)}): ${r.text}`);
}

export function relationTo(a: Actor, otherId: string) {
  return a.relations?.[otherId]?.text;
}
