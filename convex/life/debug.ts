import { internalQuery } from '../_generated/server';
import { formatClock, minuteOfDay } from './clock';
import { currentBlock } from './types';

// npx convex run life/debug:state — life engine snapshot of the default world.
export const state = internalQuery({
  args: {},
  handler: async (ctx) => {
    const status = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    const world = status && (await ctx.db.get(status.worldId));
    if (!world) return null;
    const names = new Map(
      (await ctx.db.query('playerDescriptions').collect()).map((d) => [d.playerId, d.name]),
    );
    const minute = world.clock && minuteOfDay(world.clock.minutes);
    return {
      clock: world.clock && formatClock(world.clock.minutes),
      agents: world.agents.map((a) => {
        const p = world.players.find((p) => p.id === a.playerId)!;
        const block = a.schedule && minute !== undefined && currentBlock(a.schedule.blocks, minute);
        return {
          name: names.get(a.playerId),
          schedule: a.schedule?.source,
          block: block ? `${block.placeId} ${block.kind} ${block.activity}` : null,
          activity: p.activity?.description ?? null,
          position: `${p.position.x.toFixed(1)},${p.position.y.toFixed(1)}`,
          moving: !!p.pathfinding,
          stats: a.stats && Object.fromEntries(Object.entries(a.stats).map(([k, v]) => [k, Math.round(v * 10) / 10])),
          operation: a.inProgressOperation?.name ?? null,
        };
      }),
    };
  },
});
