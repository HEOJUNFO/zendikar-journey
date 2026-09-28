import { ObjectType, v } from 'convex/values';
import { Conversation, serializedConversation } from './conversation';
import { Player, serializedPlayer } from './player';
import { Agent, serializedAgent } from './agent';
import { GameId, parseGameId, playerId } from './ids';
import { parseMap } from '../util/object';
import {
  GAME_MINUTES_PER_REAL_SECOND,
  MAX_CLOCK_STEP_MS,
  START_MINUTES,
} from '../life/clock';

// Game clock for the life engine: game minutes elapsed, and the engine time it was last advanced at.
const gameClock = v.object({ minutes: v.number(), lastTs: v.number() });

export const historicalLocations = v.array(
  v.object({
    playerId,
    location: v.bytes(),
  }),
);

export const serializedWorld = {
  nextId: v.number(),
  conversations: v.array(v.object(serializedConversation)),
  players: v.array(v.object(serializedPlayer)),
  agents: v.array(v.object(serializedAgent)),
  historicalLocations: v.optional(historicalLocations),
  clock: v.optional(gameClock),
};
export type SerializedWorld = ObjectType<typeof serializedWorld>;

export class World {
  nextId: number;
  conversations: Map<GameId<'conversations'>, Conversation>;
  players: Map<GameId<'players'>, Player>;
  agents: Map<GameId<'agents'>, Agent>;
  historicalLocations?: Map<GameId<'players'>, ArrayBuffer>;
  clock?: { minutes: number; lastTs: number };

  constructor(serialized: SerializedWorld) {
    const { nextId, historicalLocations, clock } = serialized;

    this.nextId = nextId;
    this.clock = clock;
    this.conversations = parseMap(serialized.conversations, Conversation, (c) => c.id);
    this.players = parseMap(serialized.players, Player, (p) => p.id);
    this.agents = parseMap(serialized.agents, Agent, (a) => a.id);

    if (historicalLocations) {
      this.historicalLocations = new Map();
      for (const { playerId, location } of historicalLocations) {
        this.historicalLocations.set(parseGameId('players', playerId), location);
      }
    }
  }

  // Advances the game clock to engine time `now` and returns the game minutes that passed.
  advanceClock(now: number): number {
    if (!this.clock) {
      this.clock = { minutes: START_MINUTES, lastTs: now };
      return 0;
    }
    const elapsedMs = Math.min(Math.max(now - this.clock.lastTs, 0), MAX_CLOCK_STEP_MS);
    const minutes = (elapsedMs / 1000) * GAME_MINUTES_PER_REAL_SECOND;
    this.clock = { minutes: this.clock.minutes + minutes, lastTs: now };
    return minutes;
  }

  playerConversation(player: Player): Conversation | undefined {
    return [...this.conversations.values()].find((c) => c.participants.has(player.id));
  }

  serialize(): SerializedWorld {
    return {
      nextId: this.nextId,
      conversations: [...this.conversations.values()].map((c) => c.serialize()),
      players: [...this.players.values()].map((p) => p.serialize()),
      agents: [...this.agents.values()].map((a) => a.serialize()),
      historicalLocations:
        this.historicalLocations &&
        [...this.historicalLocations.entries()].map(([playerId, location]) => ({
          playerId,
          location,
        })),
      clock: this.clock,
    };
  }
}
