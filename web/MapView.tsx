import type { Actor, State } from '../sim/state.ts';
import { shortName } from '../sim/text.ts';
import { MAP_HEIGHT, MAP_WIDTH, region, TERRAINS, travelHours } from '../sim/world.ts';
import type { World } from '../sim/world.ts';
import { visibleActors } from './view.ts';

type Props = {
  world: World;
  state: State;
  selected: string | null;
  onSelect: (id: string) => void;
};

// Where an actor is drawn: at their region, or partway along the road.
function position(world: World, state: State, a: Actor) {
  const from = region(world, a.region);
  if (!a.travel) return { x: from.x, y: from.y, travelling: false };
  const to = region(world, a.travel.to);
  const total = travelHours(from, to) * 60;
  const done = Math.min(1, Math.max(0, 1 - (a.travel.arrive - state.minutes) / total));
  return { x: from.x + (to.x - from.x) * done, y: from.y + (to.y - from.y) * done, travelling: true };
}

export function MapView({ world, state, selected, onSelect }: Props) {
  const actors = visibleActors(state);
  // Spread actors standing in the same region around its node.
  const slots = new Map<string, number>();
  return (
    <svg className="map" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label="젠디카르 지도">
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="map-sea" />
      {actors
        .filter((a) => a.travel)
        .map((a) => {
          const from = region(world, a.region);
          const to = region(world, a.travel!.to);
          return <line key={`road-${a.id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="map-road" />;
        })}
      {world.regions.map((r) => {
        const t = TERRAINS[r.terrain];
        const conds = state.regions[r.id]?.conditions ?? [];
        const destroyed = !!state.regions[r.id]?.destroyed;
        const isSel = selected === r.id;
        return (
          <g key={r.id} className="map-region" onClick={() => onSelect(r.id)} tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.id)}>
            <title>{`${r.name} (${t.label})`}</title>
            {t.sea ? (
              <>
                <circle cx={r.x} cy={r.y} r={7} fill={t.color} opacity={0.8} />
                <circle cx={r.x} cy={r.y} r={3} className="map-whirl" />
              </>
            ) : (
              <circle cx={r.x} cy={r.y} r={3.2} fill={t.color} className="map-node" />
            )}
            {isSel && <circle cx={r.x} cy={r.y} r={t.sea ? 8.2 : 4.6} className="map-selected" />}
            {destroyed && <text x={r.x} y={r.y + 1.1} className="map-destroyed">✕</text>}
            {conds.length > 0 && (
              <text x={r.x + 3.4} y={r.y - 2.6} className="map-alert">⚠</text>
            )}
            <text x={r.x} y={r.y + (t.sea ? 9.8 : 6.4)} className="map-label">{r.name}</text>
          </g>
        );
      })}
      {actors.map((a) => {
        const p = position(world, state, a);
        const slot = p.travelling ? 0 : (slots.get(a.region) ?? 0);
        if (!p.travelling) slots.set(a.region, slot + 1);
        const angle = -Math.PI / 2 + slot * 0.9;
        const [x, y] = p.travelling ? [p.x, p.y] : [p.x + Math.cos(angle) * 3.2, p.y + Math.sin(angle) * 3.2];
        return (
          <g key={a.id} className={a.kind === 'player' ? 'map-player' : 'map-npc'}>
            <title>{shortName(a.name)}</title>
            <circle cx={x} cy={y} r={a.kind === 'player' ? 1.3 : 1} />
          </g>
        );
      })}
    </svg>
  );
}
