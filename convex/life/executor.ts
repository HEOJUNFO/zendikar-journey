import type { Game } from '../aiTown/game';
import type { Agent } from '../aiTown/agent';
import type { Player } from '../aiTown/player';
import { Conversation } from '../aiTown/conversation';
import { movePlayer } from '../aiTown/movement';
import { distance } from '../util/geometry';
import { PLACES_BY_ID, Place } from '../../data/places';
import { gameDay, gameMinutesToMs, minuteOfDay } from './clock';
import { INITIAL_STATS, KIND_EFFECTS, TRAVEL_EFFECT, applyEffect } from './rules';
import { LifeKind, ScheduleBlock, currentBlock } from './types';

// Within this many tiles of its spot, an NPC counts as arrived. Spots can be taken
// by other players, in which case pathfinding stops at the closest reachable tile.
const ARRIVAL_DISTANCE = 2;
// NPC-NPC conversations only start while both are in one of these kinds of block
// at the same place, near each other, once per pair per game day.
const CHAT_KINDS: LifeKind[] = ['social', 'eat'];
const CHAT_DISTANCE = 4;
const CHAT_COOLDOWN_GAME_MINUTES = 120;

// Replaces AI Town's random wander/activity loop. Called from Agent.tick when the
// agent has no conversation and nothing to remember.
export function lifeTick(game: Game, now: number, agent: Agent, player: Player) {
  const clock = game.world.clock;
  const profile = game.agentDescriptions.get(agent.id)?.life;
  if (!clock || !profile) return;
  agent.stats ??= { ...INITIAL_STATS };

  const day = gameDay(clock.minutes);
  if (!agent.schedule || agent.schedule.day !== day) {
    // Start the day on the usual routine; an LLM plan replaces it when it arrives.
    agent.schedule = { day, source: 'routine', blocks: profile.routine };
    if (process.env.LIFE_LLM_PLANNING !== 'off') {
      const description = game.agentDescriptions.get(agent.id)!;
      const playerDescription = game.playerDescriptions.get(player.id);
      agent.startOperation(game, now, 'agentPlanDay', {
        worldId: game.worldId,
        agentId: agent.id,
        day,
        name: playerDescription?.name ?? player.id,
        identity: description.identity,
        plan: description.plan,
        profile,
        stats: agent.stats,
      });
      return;
    }
  }

  const minute = minuteOfDay(clock.minutes);
  const block = currentBlock(agent.schedule.blocks, minute);
  // Outside any block, go home and idle there.
  const place = PLACES_BY_ID.get(block?.placeId ?? profile.home) ?? PLACES_BY_ID.get(profile.home);
  if (!place) return;

  const spot = spotFor(place, agent.id);
  if (distance(player.position, spot) > ARRIVAL_DISTANCE) {
    if (!player.pathfinding) {
      movePlayer(game, now, player, spot);
    }
    applyEffect(agent.stats, TRAVEL_EFFECT, game.lifeDeltaMinutes);
    return;
  }
  if (!block) return;

  applyEffect(agent.stats, KIND_EFFECTS[block.kind], game.lifeDeltaMinutes);
  if (
    !player.activity ||
    player.activity.description !== block.activity ||
    player.activity.until <= now
  ) {
    player.activity = {
      description: block.activity,
      emoji: block.emoji,
      until: now + gameMinutesToMs(block.end - minute),
    };
  }
  maybeStartChat(game, now, agent, player, block, day);
}

// Stable per-agent spot so NPCs spread out instead of crowding one tile.
function spotFor(place: Place, agentId: string) {
  let hash = 0;
  for (const c of agentId) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return place.spots[Math.abs(hash) % place.spots.length];
}

function maybeStartChat(
  game: Game,
  now: number,
  agent: Agent,
  player: Player,
  block: ScheduleBlock,
  day: number,
) {
  if (process.env.LIFE_NPC_CHAT === 'off') return;
  if (!CHAT_KINDS.includes(block.kind)) return;
  if (agent.lastConversation && now < agent.lastConversation + gameMinutesToMs(CHAT_COOLDOWN_GAME_MINUTES)) {
    return;
  }
  const talkedToday = agent.talkedWith?.day === day ? agent.talkedWith.playerIds : [];
  const minute = minuteOfDay(game.world.clock!.minutes);

  for (const other of game.world.agents.values()) {
    if (other.id === agent.id || other.inProgressOperation) continue;
    const otherPlayer = game.world.players.get(other.playerId);
    if (!otherPlayer || talkedToday.includes(otherPlayer.id)) continue;
    if (game.world.playerConversation(otherPlayer)) continue;
    const otherBlock = other.schedule && currentBlock(other.schedule.blocks, minute);
    if (!otherBlock || otherBlock.placeId !== block.placeId || !CHAT_KINDS.includes(otherBlock.kind)) {
      continue;
    }
    if (distance(player.position, otherPlayer.position) > CHAT_DISTANCE) continue;

    const result = Conversation.start(game, now, player, otherPlayer);
    if (result && 'error' in result) continue;
    agent.lastInviteAttempt = now;
    agent.talkedWith = { day, playerIds: [...talkedToday, otherPlayer.id] };
    if (other.talkedWith?.day === day) other.talkedWith.playerIds.push(player.id);
    else other.talkedWith = { day, playerIds: [player.id] };
    return;
  }
}
