import { ServerGame } from '../hooks/serverGame';
import { GameId } from '../../convex/aiTown/ids';
import { formatClock, formatTimeOfDay, minuteOfDay } from '../../convex/life/clock';
import { currentBlock } from '../../convex/life/types';
import { PLACES_BY_ID } from '../../data/places';

export function GameClock({ game }: { game: ServerGame }) {
  const clock = game.world.clock;
  if (!clock) return null;
  return (
    <div className="box mb-6">
      <h2 className="bg-brown-700 text-base sm:text-lg text-center">{formatClock(clock.minutes)}</h2>
    </div>
  );
}

// An NPC's role, stats and today's schedule (convex/life).
export function LifePanel({ game, playerId }: { game: ServerGame; playerId: GameId<'players'> }) {
  const agent = [...game.world.agents.values()].find((a) => a.playerId === playerId);
  const life = agent && game.agentDescriptions.get(agent.id)?.life;
  const clock = game.world.clock;
  if (!agent || !life) return null;
  const minute = clock ? minuteOfDay(clock.minutes) : undefined;
  const blocks = agent.schedule?.blocks ?? life.routine;
  const now = minute !== undefined ? currentBlock(blocks, minute) : undefined;

  return (
    <div className="desc my-6">
      <div className="leading-tight -m-4 bg-brown-700 text-base sm:text-sm p-2">
        <p className="mb-2">
          <b>{life.role}</b>
        </p>
        {agent.stats && (
          <p className="mb-2">
            기력 {Math.round(agent.stats.energy)} · 배고픔 {Math.round(agent.stats.hunger)} · 돈{' '}
            {Math.floor(agent.stats.coin)}
          </p>
        )}
        <p className="mb-1">
          오늘 일정 {agent.schedule?.source === 'llm' ? '(스스로 계획)' : '(평소 일과)'}
        </p>
        <ul>
          {blocks.map((b) => (
            <li key={b.start} className={b === now ? 'text-white font-bold' : 'opacity-70'}>
              {formatTimeOfDay(b.start)} {b.emoji} {b.activity} @ {PLACES_BY_ID.get(b.placeId)?.name ?? b.placeId}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
