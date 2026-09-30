// Places that move (a region's `sim.wanders`: Goma Fada, the city that walks through Akoum).
// Each walks `perDay` map units a day toward a stop of its route; there the LLM picks the next
// (sim/run.ts `wanderings`). Those in it go with it: they are "in" the place wherever it is.
// Everything that measures the map (travel, event range, the map view) reads a world with
// the places where they are now (`withPositions`).
import { STEP_MINUTES } from './clock.ts';
import { addLog } from './state.ts';
import type { State } from './state.ts';
import { josa } from './text.ts';
import type { Region, World } from './world.ts';

// The world with wandering places where they are now (the same world when none has moved).
export function withPositions(state: State, world: World): World {
  const w = state.wanderers;
  if (!w || !world.regions.some((r) => w[r.id])) return world;
  return { ...world, regions: world.regions.map((r) => (w[r.id] ? { ...r, x: w[r.id].x, y: w[r.id].y } : r)) };
}

function stateOf(state: State, r: Region) {
  return ((state.wanderers ??= {})[r.id] ??= { x: r.x, y: r.y });
}

// Each hour: those heading somewhere walk on; arriving, they wait for the next stop.
export function wanderHour(state: State, world: World, t: number) {
  for (const r of world.regions) {
    if (!r.wanders) continue;
    const w = stateOf(state, r);
    const stop = r.wanders.stops.find((s) => s.name === w.to);
    if (!stop) continue;
    const step = (r.wanders.perDay * STEP_MINUTES) / 1440;
    const d = Math.hypot(stop.x - w.x, stop.y - w.y);
    if (d > step) {
      [w.x, w.y] = [w.x + ((stop.x - w.x) / d) * step, w.y + ((stop.y - w.y) / d) * step];
      continue;
    }
    [w.x, w.y, w.at] = [stop.x, stop.y, stop.name];
    delete w.to;
    addLog(state, { kind: 'status', text: `${josa(r.name, '이', '가')} ${stop.name}에 닿았다.`, regions: [r.id], scope: 'world', t });
  }
}

// Wandering places with no stop ahead: the LLM picks their next.
export function wandersDue(state: State, world: World) {
  return world.regions.filter((r) => r.wanders && !state.wanderers?.[r.id]?.to);
}

export function setOff(state: State, world: World, r: Region, stopName: string, t: number) {
  const w = stateOf(state, r);
  if (!r.wanders?.stops.some((s) => s.name === stopName)) return;
  w.to = stopName;
  addLog(state, { kind: 'status', text: `${josa(r.name, '이', '가')} ${stopName} 쪽으로 움직이기 시작했다.`, regions: [r.id], scope: 'world', t });
}
