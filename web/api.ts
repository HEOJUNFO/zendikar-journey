import type { Action } from '../sim/actions.ts';
import type { Mode, State } from '../sim/state.ts';
import type { World } from '../sim/world.ts';

export type GameView = { world: World; state: State | null; llm: boolean; error?: string };

export type NewGameInput = {
  mode: Mode;
  player?: { name: string; background: string; region: string };
};

async function call(path: string, body?: unknown): Promise<GameView> {
  const res = await fetch(path, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as GameView;
}

export const api = {
  get: () => call('/api/game'),
  newGame: (input: NewGameInput) => call('/api/new', input),
  advance: (hours: number) => call('/api/advance', { hours }),
  act: (action: Action) => call('/api/act', { action }),
  say: (text: string) => call('/api/act', { text }),
};
