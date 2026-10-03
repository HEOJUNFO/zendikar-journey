import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { npcDef } from '../sim/state.ts';
import type { Actor, State } from '../sim/state.ts';
import { shortName } from '../sim/text.ts';
import { hasPowers, MAP_HEIGHT, MAP_WIDTH, placeName, region, spellColors, TERRAINS } from '../sim/world.ts';
import type { Region, World } from '../sim/world.ts';
import { moveHours } from '../sim/step.ts';
import { eventTile, nearestTile, sameTile, TILE, tileCenter, tileKey } from '../sim/tiles.ts';
import type { Tile } from '../sim/tiles.ts';
import { areaLabelAt, fitView, halfCircle, isTrap, landColors, nodeAt, PLAIN_NODE, regionLabelAt, shelves, tileRects, trapStatus, visibleActors } from './view.ts';
import type { FitPad, MapBox } from './view.ts';

type Props = {
  world: World;
  // null: no game yet, so only the land itself is drawn.
  state: State | null;
  selected: string | null;
  // A land picked, and the tile of it clicked (none from the keyboard).
  onSelect: (id: string, tile?: Tile) => void;
  // The tile picked (drawn marked).
  selectedTile?: Tile | null;
  // Show everyone, even in character mode (the world page).
  all?: boolean;
  // The admin map: people, traps and spells are drawn named and can be picked (`picked` = their id).
  picked?: string | null;
  onPickActor?: (id: string) => void;
  onPickTrap?: (id: string) => void;
  onPickSpell?: (id: string) => void;
  // Drawn over the tiles, under the names (map v2: the reference map laid over it).
  overlay?: ReactNode;
  // The shallow water joining a continent and its islands (off on map v2: its shapes are painted).
  shelves?: boolean;
  // Where and how large a land's name is written, when the page says (map v2: inside each land,
  // as large as the land); otherwise above it (web/view.ts).
  // `dot`: a place, marked by a dot at its tile; `faint`: a land whose areas carry the names.
  labelFor?: (r: Region) => { x: number; y: number; size: number; sea?: boolean; dot?: { x: number; y: number }; faint?: boolean } | null;
  // Room left around the lands when the map opens fitted to them (map v2: more on top for its bar).
  fitPad?: FitPad;
};

const TRAP_GAP = 3.6;

// A tile in its land's mana colors: split corner to corner for a two-color land.
function LandTile({ x, y, colors, className }: { x: number; y: number; colors: string[]; className: string }) {
  if (colors.length < 2) return <rect x={x} y={y} width={TILE} height={TILE} fill={colors[0]} className={className} />;
  return (
    <g>
      <rect x={x} y={y} width={TILE} height={TILE} fill={colors[0]} className={className} />
      <path d={`M${x + TILE} ${y}L${x + TILE} ${y + TILE}L${x} ${y + TILE}Z`} fill={colors[1]} className={`${className} map-half`} />
    </g>
  );
}

function LandCircle({ x, y, r, colors, className }: { x: number; y: number; r: number; colors: string[]; className: string }) {
  if (colors.length < 2) return <circle cx={x} cy={y} r={r} fill={colors[0]} className={className} />;
  return (
    <g>
      <path d={halfCircle(x, y, r, 0)} fill={colors[0]} className={`${className} map-half`} />
      <path d={halfCircle(x, y, r, 1)} fill={colors[1]} className={`${className} map-half`} />
      <circle cx={x} cy={y} r={r} fill="none" className={className} />
    </g>
  );
}

// Zoom: the narrowest view (most zoomed in), each button step, and how far a drag must go
// before it pans instead of clicking.
const MIN_VIEW_W = 120;
const ZOOM_STEP = 1.4;
const DRAG_PX = 4;

// `box` scaled by `factor` around the map point (px, py), kept on the map.
function zoomed(box: MapBox, factor: number, px = box.x + box.w / 2, py = box.y + box.h / 2): MapBox {
  const w = Math.min(MAP_WIDTH, Math.max(MIN_VIEW_W, box.w * factor));
  const k = w / box.w;
  return kept({ x: px - (px - box.x) * k, y: py - (py - box.y) * k, w, h: box.h * k });
}

// The box moved back so it doesn't leave the map.
function kept(box: MapBox): MapBox {
  const clamp = (v: number, size: number, max: number) => Math.min(Math.max(v, 0), Math.max(0, max - size));
  return { ...box, x: clamp(box.x, box.w, MAP_WIDTH), y: clamp(box.y, box.h, MAP_HEIGHT) };
}

// Zooming (wheel, buttons) and panning (drag) the map. Until the viewer moves it, the view
// follows the lands (`fitView`), so new lands come into sight on their own.
function useMapView(world: World, fitPad?: FitPad) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [moved, setMoved] = useState<MapBox | null>(null);
  const box = moved ?? fitView(world, fitPad);
  const boxRef = useRef(box);
  boxRef.current = box;
  const drag = useRef<{ id: number; cx: number; cy: number; start: MapBox; panning: boolean } | null>(null);
  const dragged = useRef(false);

  // The map point under a screen point.
  const toMap = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const m = svg.getScreenCTM()!.inverse();
    return new DOMPoint(clientX, clientY).matrixTransform(m);
  };

  // React listens to wheel passively, so the page would scroll too; listen directly instead.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toMap(e.clientX, e.clientY);
      setMoved(zoomed(boxRef.current, Math.exp(e.deltaY * 0.0015), p.x, p.y));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragged.current = false;
    drag.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, start: box, panning: false };
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.panning) {
      if (Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < DRAG_PX) return;
      d.panning = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const scale = e.currentTarget.getScreenCTM()!.a; // px per map unit
    setMoved(kept({ ...d.start, x: d.start.x - (e.clientX - d.cx) / scale, y: d.start.y - (e.clientY - d.cy) / scale }));
  };
  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    dragged.current = drag.current.panning;
    drag.current = null;
  };
  // A drag ends in a click on whatever is under the pointer; that click isn't a pick.
  const onClickCapture = (e: { stopPropagation: () => void }) => {
    if (dragged.current) e.stopPropagation();
    dragged.current = false;
  };

  return {
    box,
    svgProps: { ref: svgRef, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture },
    zoomIn: () => setMoved(zoomed(box, 1 / ZOOM_STEP)),
    zoomOut: () => setMoved(zoomed(box, ZOOM_STEP)),
    fit: moved ? () => setMoved(null) : null,
  };
}

// Keyboard access for a clickable map mark.
function pickable(onPick: () => void) {
  return {
    tabIndex: 0,
    onClick: onPick,
    onKeyDown: (e: { key: string }) => (e.key === 'Enter' || e.key === ' ') && onPick(),
  };
}

// Where someone stands: the middle of their tile (a wandering place: where it is).
function spot(world: World, regionId: string, tile: Tile | undefined) {
  const r = region(world, regionId);
  return r.wanders || !tile ? nodeAt(world, r) : tileCenter(tile);
}

// Where an actor is drawn: on their tile, or partway along the way.
function position(world: World, state: State, a: Actor) {
  const from = spot(world, a.region, a.tile);
  if (!a.travel) return { ...from, travelling: false };
  const tile = a.travel.tile ?? nearestTile(world, a.travel.to, a.tile && tileCenter(a.tile));
  const to = spot(world, a.travel.to, tile);
  const total = moveHours(world, a, a.travel.to, tile) * 60;
  const done = Math.min(1, Math.max(0, 1 - (a.travel.arrive - state.minutes) / total));
  return { x: from.x + (to.x - from.x) * done, y: from.y + (to.y - from.y) * done, travelling: true, from, to };
}

export function MapView({ world, state, selected, selectedTile, onSelect, all, picked, onPickActor, onPickTrap, onPickSpell, overlay, shelves: withShelves = true, labelFor, fitPad }: Props) {
  const actors = state ? visibleActors(state, all) : [];
  const traps = onPickTrap ? world.events.filter(isTrap) : [];
  const spells = onPickSpell ? world.spells : [];
  // Spread actors standing on the same tile around its middle.
  const slots = new Map<string, number>();
  const { box, svgProps, zoomIn, zoomOut, fit } = useMapView(world, fitPad);
  return (
    <div className="map-wrap">
      <svg className="map" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} role="img" aria-label="젠디카르 지도" {...svgProps}>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="map-sea" />
        {withShelves && shelves(world).map((sh) => (
          <g key={`shelf-${sh.id}`} className="map-shelf">
            {sh.bands.map((b, i) => <line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} strokeWidth={b.width} />)}
            {sh.circles.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={c.r} />)}
          </g>
        ))}
        {actors
          .filter((a) => a.travel)
          .map((a) => {
            const p = position(world, state!, a);
            return p.travelling && <line key={`road-${a.id}`} x1={p.from!.x} y1={p.from!.y} x2={p.to!.x} y2={p.to!.y} className="map-road" />;
          })}
        {tileRects(world).map(({ region: r, tile, x, y }) => {
          const t = TERRAINS[r.terrain];
          const top = !r.parent;
          return (
            <g key={`tile-${tileKey(tile)}`} className={`map-region${top ? '' : ' map-area'}`} onClick={() => onSelect(r.id, tile)}>
              <title>{`${placeName(world, r)} (${t.label}) (${tile.join(',')})`}</title>
              {t.sea && !r.parent ? (
                <rect x={x} y={y} width={TILE} height={TILE} fill={t.color} opacity={0.85} className="map-tile map-tile-sea" />
              ) : (
                <LandTile x={x} y={y} colors={landColors(r)} className={`map-tile${top ? '' : ' map-tile-area'}`} />
              )}
              {selected === r.id && <rect x={x + 0.6} y={y + 0.6} width={TILE - 1.2} height={TILE - 1.2} className="map-selected" />}
              {selectedTile && sameTile(selectedTile, tile) && <rect x={x + 2} y={y + 2} width={TILE - 4} height={TILE - 4} className="map-selected map-selected-tile" />}
            </g>
          );
        })}
        {overlay}
        {world.regions.map((r) => {
          const t = TERRAINS[r.terrain];
          const conds = state?.regions[r.id]?.conditions ?? [];
          const destroyed = !!state?.regions[r.id]?.destroyed;
          const own = nodeAt(world, r);
          // A wandering place: a round mark where it walks.
          if (r.wanders) {
            return (
              <g key={r.id} className="map-region" onClick={() => onSelect(r.id)} tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.id)}>
                <title>{`${r.name} (${t.label})`}</title>
                <LandCircle x={r.x} y={r.y} r={PLAIN_NODE} colors={landColors(r)} className="map-node" />
                {selected === r.id && <circle cx={r.x} cy={r.y} r={PLAIN_NODE + 2.1} className="map-selected" />}
                {destroyed && <text x={r.x} y={r.y + 1.6} className="map-destroyed">✕</text>}
                {conds.length > 0 && <text x={r.x + PLAIN_NODE + 0.3} y={r.y - PLAIN_NODE + 0.9} className="map-alert">⚠</text>}
                <text x={r.x} y={r.y + PLAIN_NODE + 4.8} className="map-label">{r.name}</text>
              </g>
            );
          }
          const label = r.parent ? areaLabelAt(world, r) : regionLabelAt(world, r);
          const big = labelFor?.(r);
          return (
            <g key={r.id} className={`map-region-name${r.parent ? ' map-area' : ''}`} onClick={() => onSelect(r.id)} tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.id)}>
              {destroyed && <text x={own.x} y={own.y + 1.4} className="map-destroyed">✕</text>}
              {conds.length > 0 && <text x={own.x + 5} y={own.y - 4} className="map-alert">⚠</text>}
              {big?.dot && <circle cx={big.dot.x} cy={big.dot.y} r={3} className="map-place-dot" />}
              {big ? (
                <text x={big.x} y={big.y} style={{ fontSize: big.size }} className={`map-label map-label-big${big.sea ? ' map-label-sea' : ''}${big.faint ? ' map-label-faint' : ''}${big.dot ? ' map-label-place' : ''}`}>{r.name}</text>
              ) : (
                <text x={label.x} y={label.y} style={{ textAnchor: label.anchor }} className={r.parent ? 'map-label map-area-label' : 'map-label'}>{r.name}</text>
              )}
            </g>
          );
        })}
        {actors.map((a) => {
          const p = position(world, state!, a);
          const key = `${a.region}|${a.tile ? tileKey(a.tile) : ''}`;
          const slot = p.travelling ? 0 : (slots.get(key) ?? 0);
          if (!p.travelling) slots.set(key, slot + 1);
          const angle = -Math.PI / 2 + slot * 0.9;
          const ring = TILE * 0.3;
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
          // One that springs underfoot: on its tile; others in their land's middle.
          const tile = ev.trigger === 'enter' ? eventTile(world, ev) : undefined;
          const node = tile ? tileCenter(tile) : nodeAt(world, region(world, ev.region));
          const n = traps.slice(0, i).filter((x) => x.region === ev.region).length;
          const [x, y] = [node.x - TILE * 0.3 + TRAP_GAP * n, node.y + TILE * 0.3];
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
          const node = nodeAt(world, region(world, sp.learnAt));
          const n = spells.slice(0, i).filter((x) => x.learnAt === sp.learnAt).length;
          // Where it is learned: in its land's middle, up to the left.
          const [x, y] = [node.x - TILE * 0.3 + TRAP_GAP * n, node.y - TILE * 0.3];
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
      <div className="map-zoom">
        <button type="button" onClick={zoomIn} aria-label="확대" title="확대 (휠)">+</button>
        <button type="button" onClick={zoomOut} aria-label="축소" title="축소 (휠)">−</button>
        <button type="button" onClick={fit ?? undefined} disabled={!fit} aria-label="땅에 맞추기" title="땅에 맞추기">⤢</button>
      </div>
    </div>
  );
}
