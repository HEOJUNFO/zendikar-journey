// Foresight (Sphinx of Jwar Isle, "you may look at the top card of your library any time"):
// the top of the library is what comes next. One who has it (`sim.foresight`) knows the rest of
// today's events and powers the morning LLM picked (state.gm): their plan is made after it
// (sim/run.ts `prepare`), and they know it as they talk.
import { gameDay, minuteOfDay } from './clock.ts';
import { npcDef } from './state.ts';
import type { State } from './state.ts';
import { shortName } from './text.ts';
import { region } from './world.ts';
import type { World } from './world.ts';

export function foresees(state: State, world: World, id: string) {
  return !!npcDef(state, world, id)?.foresight;
}

// What is still to come today, hour by hour (in Korean, for their prompts).
export function foresightText(state: State, world: World, t: number): string[] {
  if (state.gm.day !== gameDay(t)) return [];
  const hour = Math.floor(minuteOfDay(t) / 60);
  const at = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const fires = state.gm.fires
    .filter((f) => f.hour >= hour)
    .flatMap((f) => {
      const ev = world.events.find((e) => e.id === f.eventId);
      return ev ? [{ hour: f.hour, text: `${at(f.hour)} ${region(world, ev.region).name}에서 ${ev.name}: ${ev.summary}` }] : [];
    });
  const uses = (state.gm.uses ?? [])
    .filter((u) => u.hour >= hour)
    .flatMap((u) => {
      const [by, on] = [state.actors[u.being], u.target ? state.actors[u.target] : undefined];
      const ability = npcDef(state, world, u.being)?.activated?.find((x) => x.id === u.ability);
      return by && ability ? [{ hour: u.hour, text: `${at(u.hour)} ${shortName(by.name)}의 ${ability.name}${on ? ` → ${shortName(on.name)}` : ''}` }] : [];
    });
  return [...fires, ...uses].sort((a, b) => a.hour - b.hour).map((x) => x.text);
}
