import { npcDef } from '../sim/state.ts';
import type { Actor, State } from '../sim/state.ts';
import { shortName } from '../sim/text.ts';
import { hasPowers, MAP_HEIGHT, MAP_WIDTH, region, spellColors, TERRAINS, travelHours } from '../sim/world.ts';
import type { World } from '../sim/world.ts';
import { areaLabelAt, containerRadius, isTrap, nodeAt, trapStatus, visibleActors } from './view.ts';

type Props = {
  world: World;
  // null: no game yet, so only the land itself is drawn.
  state: State | null;
  selected: string | null;
  onSelect: (id: string) => void;
  // Show everyone, even in character mode (the world page).
  all?: boolean;
  // The admin map: people, traps and spells are drawn named and can be picked (`picked` = their id).
  picked?: string | null;
  onPickActor?: (id: string) => void;
  onPickTrap?: (id: string) => void;
  onPickSpell?: (id: string) => void;
};

const TRAP_GAP = 3.6;

// Keyboard access for a clickable map mark.
function pickable(onPick: () => void) {
  return {
    tabIndex: 0,
    onClick: onPick,
    onKeyDown: (e: { key: string }) => (e.key === 'Enter' || e.key === ' ') && onPick(),
  };
}

// Where an actor is drawn: at their region, or partway along the road.
function position(world: World, state: State, a: Actor) {
  const fromR = region(world, a.region);
  const from = nodeAt(world, fromR);
  if (!a.travel) return { ...from, travelling: false };
  const toR = region(world, a.travel.to);
  const to = nodeAt(world, toR);
  const total = travelHours(fromR, toR, a.abilities) * 60;
  const done = Math.min(1, Math.max(0, 1 - (a.travel.arrive - state.minutes) / total));
  return { x: from.x + (to.x - from.x) * done, y: from.y + (to.y - from.y) * done, travelling: true };
}

export function MapView({ world, state, selected, onSelect, all, picked, onPickActor, onPickTrap, onPickSpell }: Props) {
  const actors = state ? visibleActors(state, all) : [];
  const traps = onPickTrap ? world.events.filter(isTrap) : [];
  const spells = onPickSpell ? world.spells : [];
  // Spread actors standing in the same region around its node.
  const slots = new Map<string, number>();
  return (
    <svg className="map" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label="젠디카르 지도">
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="map-sea" />
      {actors
        .filter((a) => a.travel)
        .map((a) => {
          const from = nodeAt(world, region(world, a.region));
          const to = nodeAt(world, region(world, a.travel!.to));
          return <line key={`road-${a.id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="map-road" />;
        })}
      {[...world.regions].sort((a, b) => Number(!!a.parent) - Number(!!b.parent)).map((r) => {
        const t = TERRAINS[r.terrain];
        const conds = state?.regions[r.id]?.conditions ?? [];
        const destroyed = !!state?.regions[r.id]?.destroyed;
        const isSel = selected === r.id;
        if (r.parent) {
          const { x, y } = nodeAt(world, r);
          const parent = region(world, r.parent);
          const label = areaLabelAt(world, r);
          return (
            <g key={r.id} className="map-region map-area" onClick={() => onSelect(r.id)} tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.id)}>
              <title>{`${parent.name} › ${r.name} (${t.label})`}</title>
              <circle cx={x} cy={y} r={2.4} fill={t.color} className="map-node" />
              {isSel && <circle cx={x} cy={y} r={3.7} className="map-selected" />}
              {destroyed && <text x={x} y={y + 1} className="map-destroyed map-area-mark">✕</text>}
              {conds.length > 0 && <text x={x + 2.7} y={y - 2.1} className="map-alert map-area-mark">⚠</text>}
              <text x={label.x} y={label.y} style={{ textAnchor: label.anchor }} className="map-label map-area-label">{r.name}</text>
            </g>
          );
        }
        const R = containerRadius(world, r);
        if (R) {
          const own = nodeAt(world, r);
          return (
            <g key={r.id} className="map-region" onClick={() => onSelect(r.id)} tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.id)}>
              <title>{`${r.name} (${t.label})`}</title>
              <circle cx={r.x} cy={r.y} r={R} fill={t.color} className="map-container" />
              {isSel && <circle cx={r.x} cy={r.y} r={R + 1.2} className="map-selected" />}
              {destroyed && <text x={own.x} y={own.y + 1.4} className="map-destroyed">✕</text>}
              {conds.length > 0 && <text x={own.x + 3.6} y={own.y - 2.7} className="map-alert">⚠</text>}
              <text x={r.x} y={r.y - R - 1.5} className="map-label">{r.name}</text>
            </g>
          );
        }
        return (
          <g key={r.id} className="map-region" onClick={() => onSelect(r.id)} tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.id)}>
            <title>{`${r.name} (${t.label})`}</title>
            {t.sea ? (
              <>
                <circle cx={r.x} cy={r.y} r={10.5} fill={t.color} opacity={0.8} />
                <circle cx={r.x} cy={r.y} r={4.5} className="map-whirl" />
              </>
            ) : (
              <circle cx={r.x} cy={r.y} r={4.8} fill={t.color} className="map-node" />
            )}
            {isSel && <circle cx={r.x} cy={r.y} r={t.sea ? 12.3 : 6.9} className="map-selected" />}
            {destroyed && <text x={r.x} y={r.y + 1.6} className="map-destroyed">✕</text>}
            {conds.length > 0 && (
              <text x={r.x + 5.1} y={r.y - 3.9} className="map-alert">⚠</text>
            )}
            <text x={r.x} y={r.y + (t.sea ? 14.7 : 9.6)} className="map-label">{r.name}</text>
          </g>
        );
      })}
      {actors.map((a) => {
        const p = position(world, state!, a);
        const slot = p.travelling ? 0 : (slots.get(a.region) ?? 0);
        if (!p.travelling) slots.set(a.region, slot + 1);
        const angle = -Math.PI / 2 + slot * 0.9;
        const here = region(world, a.region);
        const ring = here.parent ? 3 : containerRadius(world, here) ? 3.9 : 4.8;
        const [x, y] = p.travelling ? [p.x, p.y] : [p.x + Math.cos(angle) * ring, p.y + Math.sin(angle) * ring];
        const legend = a.kind === 'npc' && hasPowers(npcDef(state!, world, a.id));
        const r = legend ? 2.2 : a.kind === 'npc' ? 1.5 : 2;
        return (
          <g key={a.id} className={`map-${legend ? 'legend' : a.kind}${onPickActor ? ' map-pick' : ''}`}
            {...(onPickActor ? pickable(() => onPickActor(a.id)) : {})}>
            <title>{shortName(a.name)}</title>
            {onPickActor && <circle cx={x} cy={y} r={r + 1.5} className="map-hit" />}
            <circle cx={x} cy={y} r={r} />
            {picked === a.id && <circle cx={x} cy={y} r={r + 1.3} className="map-picked" />}
            {onPickActor && <text x={x} y={y - r - 0.9} className="map-actor-label">{shortName(a.name)}</text>}
          </g>
        );
      })}
      {traps.map((ev, i) => {
        const r = region(world, ev.region);
        const node = nodeAt(world, r);
        const n = traps.slice(0, i).filter((x) => x.region === ev.region).length;
        // Below-left of a region's node; right below an area's (its name is to the right).
        const [x, y] = r.parent
          ? [node.x + TRAP_GAP * n, node.y + TRAP_GAP * 1.4]
          : [node.x - TRAP_GAP * (n + 1.4), node.y + TRAP_GAP * 1.2];
        const s = 2;
        return (
          <g key={ev.id} className={`map-trap map-trap-${trapStatus(state, ev).kind} map-pick`} {...pickable(() => onPickTrap!(ev.id))}>
            <title>{`함정: ${ev.name}`}</title>
            <circle cx={x} cy={y} r={s + 1.5} className="map-hit" />
            <path d={`M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`} />
            <text x={x} y={y + 0.8} className="map-trap-mark">!</text>
            {picked === ev.id && <circle cx={x} cy={y} r={s + 1.3} className="map-picked" />}
          </g>
        );
      })}
      {spells.map((sp, i) => {
        const r = region(world, sp.learnAt);
        const node = nodeAt(world, r);
        const n = spells.slice(0, i).filter((x) => x.learnAt === sp.learnAt).length;
        // Where it is learned: above-left of a region's node; below an area's, after its traps.
        const [x, y] = r.parent
          ? [node.x + TRAP_GAP * (traps.filter((ev) => ev.region === r.id).length + n), node.y + TRAP_GAP * 1.4]
          : [node.x - TRAP_GAP * (n + 1.4), node.y - TRAP_GAP * 1.2];
        const colors = spellColors(sp);
        const s = 1.8;
        return (
          <g key={sp.id} className={`map-spell map-spell-${colors.length === 1 ? colors[0] : colors.length ? 'multi' : 'C'} map-pick`}
            {...pickable(() => onPickSpell!(sp.id))}>
            <title>{`주문: ${sp.name} (${sp.costText})`}</title>
            <circle cx={x} cy={y} r={s + 1.5} className="map-hit" />
            <circle cx={x} cy={y} r={s} />
            <text x={x} y={y + 0.75} className="map-spell-mark">✦</text>
            {picked === sp.id && <circle cx={x} cy={y} r={s + 1.3} className="map-picked" />}
          </g>
        );
      })}
    </svg>
  );
}
