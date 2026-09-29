// The running game: one save slot (saves/current.json), turns applied one at a time.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ActionSchema } from '../sim/actions.ts';
import { loadWorld } from '../sim/load.ts';
import { act, advance } from '../sim/run.ts';
import type { Llm, TurnResult } from '../sim/run.ts';
import { newState, syncWorld } from '../sim/state.ts';
import type { State } from '../sim/state.ts';
import { canStay } from '../sim/world.ts';
import type { World } from '../sim/world.ts';

const SAVE_DIR = fileURLToPath(new URL('../saves', import.meta.url));
const SAVE_FILE = join(SAVE_DIR, 'current.json');

export const NewGameSchema = z.object({
  mode: z.enum(['observer', 'character']),
  seed: z.number().int().optional(),
  player: z
    .object({
      name: z.string().trim().min(1).max(40),
      background: z.string().trim().max(500),
      region: z.string(),
    })
    .optional(),
});
export const AdvanceSchema = z.object({ hours: z.number().int().min(1).max(24 * 7) });
export const ActSchema = z.union([
  z.object({ action: ActionSchema }),
  z.object({ text: z.string().trim().min(1).max(500) }),
]);

export class Game {
  world: World;
  state: State | null;
  llm: Llm;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(llm: Llm) {
    this.llm = llm;
    this.world = loadWorld();
    this.state = existsSync(SAVE_FILE) ? (JSON.parse(readFileSync(SAVE_FILE, 'utf8')) as State) : null;
    if (this.state) syncWorld(this.state, this.world);
  }

  // Picks up cards added while the server runs. A world that doesn't load (a card half written,
  // or data ahead of the code until the server restarts) keeps the last good one.
  reloadWorld() {
    try {
      this.world = loadWorld();
    } catch (e) {
      console.warn(`세계를 다시 읽지 못해 이전 세계로 계속한다: ${(e as Error).message}`);
      return;
    }
    if (this.state) syncWorld(this.state, this.world);
  }

  // Runs mutations one at a time; the LLM makes turns slow enough to overlap.
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  newGame(input: z.infer<typeof NewGameSchema>) {
    return this.serial(async () => {
      this.reloadWorld();
      if (input.mode === 'character') {
        const r = this.world.regions.find((x) => x.id === input.player?.region);
        if (!input.player || !r || !canStay(r, [])) throw new UserError('시작할 수 없는 지역이다.');
      }
      this.state = newState(this.world, input);
      this.save();
    });
  }

  advance(hours: number) {
    return this.serial(async () => {
      const state = this.requireState();
      if (state.mode !== 'observer') throw new UserError('인물 모드에서는 행동으로 시간을 보낸다.');
      this.reloadWorld();
      const result = await advance(state, this.world, hours, this.llm);
      this.save();
      return result;
    });
  }

  act(input: z.infer<typeof ActSchema>) {
    return this.serial(async (): Promise<TurnResult> => {
      const state = this.requireState();
      this.reloadWorld();
      const result = await act(state, this.world, 'text' in input ? input.text : input.action, this.llm);
      this.save();
      return result;
    });
  }

  private requireState() {
    if (!this.state) throw new UserError('진행 중인 게임이 없다.');
    return this.state;
  }

  private save() {
    mkdirSync(SAVE_DIR, { recursive: true });
    const tmp = `${SAVE_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state));
    renameSync(tmp, SAVE_FILE);
  }
}

// A request the game refuses (shown to the player), as opposed to a bug.
export class UserError extends Error {}
