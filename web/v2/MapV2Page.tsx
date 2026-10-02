// Map v2 (#/v2, user decision 2026-10-03): the world map redesigned from scratch in world-v2/,
// beside the game's own map (v1, world/). Only lands, seas and places, no one on them yet: the
// level design is read here, with the fan map's pieces laid over it to compare.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { descendantsOf, LAND_TYPE_LABELS, region, TERRAINS } from '../../sim/world.ts';
import type { Region, World } from '../../sim/world.ts';
import { TILE, tilesOf } from '../../sim/tiles.ts';
import { labelSpot } from '../../sim/footprint.ts';
import type { Reference, V2Note, WorldV2View } from '../../sim/footprint.ts';
import { MapView } from '../MapView.tsx';
import { landSwatch } from '../view.ts';
import { getWorldV2, refUrl } from './api.ts';

const DANGER = ['', '평온', '거친 땅', '위험', '매우 위험', '죽음의 땅'];

// What a land is on this map: a continent, an island, a sea, or an area inside one.
function kindOf(r: Region) {
  if (r.parent) return '구역';
  if (TERRAINS[r.terrain].sea) return '바다';
  return r.size === 'continent' ? '대륙' : '섬';
}
const GROUPS = ['대륙', '섬', '바다'];
// The map opens with room above the lands for the top bar.
const V2_FIT = { x: 24, top: 40, bottom: 24 };

function tileCount(world: World, r: Region) {
  return tilesOf(world, r.id).length + descendantsOf(world, r.id).reduce((n, d) => n + tilesOf(world, d.id).length, 0);
}

// A land's name inside it, as large as the land (map units): a continent's across many tiles,
// a small island's or a strait's across a few.
function namePlaces(world: World) {
  const out = new Map<string, { x: number; y: number; size: number; sea?: boolean }>();
  for (const r of world.regions.filter((x) => !x.parent)) {
    const spot = labelSpot(world, r.id);
    if (!spot) continue;
    const [c, row] = spot.tile;
    // As large as the land, but no wider than its own ground on that row (a sea ringing a land
    // would write over it); a sea's letters are spaced wider.
    const per = TERRAINS[r.terrain].sea ? 1.25 : 1.05;
    const size = Math.min(44, Math.max(10, Math.sqrt(tileCount(world, r)) * 2.4), (spot.run * TILE * 0.9) / (r.name.length * per));
    out.set(r.id, { x: (c + 0.5) * TILE, y: (row + 0.5) * TILE + size * 0.35, size, sea: TERRAINS[r.terrain].sea });
  }
  return out;
}

function Danger({ level }: { level?: number }) {
  if (!level) return null;
  return (
    <span className={`v2-danger v2-danger-${level}`} title={`위험도 ${level}: ${DANGER[level]}`}>
      {'●'.repeat(level)}
      {'○'.repeat(5 - level)}
    </span>
  );
}

// The text under a place's frontmatter: headings, lists and paragraphs.
function Body({ text }: { text: string }) {
  return (
    <div className="v2-body">
      {text.split(/\n{2,}/).map((b, i) => {
        if (b.startsWith('## ')) return <h3 key={i}>{b.slice(3)}</h3>;
        const lines = b.split('\n');
        if (lines.every((l) => l.startsWith('- '))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}</ul>;
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

function PlaceCard({ world, id, note, onSelect }: { world: World; id: string; note?: V2Note; onSelect: (id: string) => void }) {
  const r = region(world, id);
  const t = TERRAINS[r.terrain];
  const type = r.landType ?? t.type;
  const parent = r.parent ? region(world, r.parent) : undefined;
  const areas = world.regions.filter((x) => x.parent === r.id);
  return (
    <div className="card v2-card">
      <h2>
        {r.name}
        <small>{r.nameEn}</small>
      </h2>
      <p className="muted">
        {kindOf(r)}
        {parent && <> · <button className="link" onClick={() => onSelect(parent.id)}>{parent.name}</button> 안</>}
        {' · '}
        {t.label}
        {!(t.sea && !r.parent) && (
          <>
            {' · '}
            <span className="swatch" style={{ background: landSwatch(r), display: 'inline-block' }} /> {type ? LAND_TYPE_LABELS[type] : '기본 종류 없음'}
          </>
        )}
        {' · '}
        {tileCount(world, r)}칸
      </p>
      {note?.design && (
        <p>
          {note.design.role && <b>{note.design.role}</b>} <Danger level={note.design.danger} />
          {note.design.danger ? <span className="muted"> {DANGER[note.design.danger]}</span> : null}
        </p>
      )}
      {note?.design?.note && <p className="v2-note">{note.design.note}</p>}
      <p>{r.summary}</p>
      {areas.length > 0 && (
        <p className="muted">
          안의 곳:{' '}
          {areas.map((a) => (
            <button key={a.id} className="link" onClick={() => onSelect(a.id)}>
              {a.name}
            </button>
          ))}
        </p>
      )}
      {note?.body && <Body text={note.body} />}
    </div>
  );
}

// The fan map's pieces where v2 put each land (world-v2/map/reference.yaml), ink over the
// tiles (white paper multiplies away).
function ReferenceLayer({ reference, opacity }: { reference: Reference; opacity: number }) {
  return (
    <g opacity={opacity} pointerEvents="none" style={{ mixBlendMode: 'multiply' }}>
      {Object.entries(reference.pieces).map(([id, p]) => (
        <g key={id} transform={`matrix(${p.matrix.join(' ')})`}>
          <clipPath id={`v2ref-${id}`}>
            <polygon points={p.clip.map((q) => q.join(',')).join(' ')} />
          </clipPath>
          <image href={refUrl(reference.image)} width={reference.size[0]} height={reference.size[1]} clipPath={`url(#v2ref-${id})`} preserveAspectRatio="none" />
        </g>
      ))}
    </g>
  );
}

export function MapV2Page({ nav }: { nav: ReactNode }) {
  const [view, setView] = useState<WorldV2View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [refOn, setRefOn] = useState(false);
  const [opacity, setOpacity] = useState(0.7);
  const [listOpen, setListOpen] = useState(true);
  const names = useMemo(() => (view ? namePlaces(view.world) : new Map()), [view]);
  // The panels start below the top bar, however many rows it wraps to.
  const bar = useRef<HTMLDivElement>(null);
  const [barBottom, setBarBottom] = useState(72);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarBottom(el.offsetTop + el.offsetHeight + 8));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view !== null]);
  const load = () =>
    getWorldV2().then(
      (v) => {
        setView(v);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  useEffect(() => {
    void load();
  }, []);

  if (!view) return <div className="loading">{error ?? '지도 v2 를 불러오는 중…'}</div>;
  const { world, notes, reference, errors } = view;
  const sel = selected && world.regions.some((r) => r.id === selected) ? selected : null;
  const sea = world.regions.filter((r) => TERRAINS[r.terrain].sea && !r.parent).reduce((n, r) => n + tilesOf(world, r.id).length, 0);
  const land = Object.keys(world.tileOwner ?? {}).length - sea;

  return (
    <div className={`fullmap v2${listOpen ? ' list-open' : ''}${sel ? ' card-open' : ''}`} style={{ '--v2-top': `${barBottom}px` } as CSSProperties}>
      <MapView world={world} state={null} selected={sel} onSelect={(id) => setSelected(id)} all shelves={false}
        labelFor={(r) => names.get(r.id) ?? null} fitPad={V2_FIT}
        overlay={reference?.available && refOn ? <ReferenceLayer reference={reference} opacity={opacity} /> : null} />
      <div className="fullmap-top" ref={bar}>
        <h1>젠디카르 지도 v2</h1>
        <span className="muted">
          땅 {land}칸 · 이름 있는 바다 {sea}칸
        </span>
        {reference &&
          (reference.available ? (
            <label className="v2-ref">
              <input type="checkbox" checked={refOn} onChange={(e) => setRefOn(e.target.checked)} /> 참고 지도
              <input type="range" min={0.15} max={1} step={0.05} value={opacity} disabled={!refOn} onChange={(e) => setOpacity(Number(e.target.value))} aria-label="참고 지도 진하기" />
            </label>
          ) : (
            <span className="muted" title={`map/${reference.image} 가 없음`}>참고 지도 없음</span>
          ))}
        <button className="ghost" onClick={() => void load()}>
          다시 읽기
        </button>
        <button className={`ghost${listOpen ? ' on' : ''}`} onClick={() => setListOpen(!listOpen)} aria-pressed={listOpen}>
          목록
        </button>
        {errors.length > 0 && (
          <button className="ghost v2-error-count" onClick={() => setListOpen(true)} title="목록 위에 오류가 있다">
            오류 {errors.length}
          </button>
        )}
        {nav}
        {error && <span className="error">다시 읽지 못함: {error}</span>}
      </div>
      <div className="v2-list" hidden={!listOpen}>
        {errors.length > 0 && (
          <div className="v2-errors">
            <b>world-v2 오류 {errors.length}</b>
            <ul>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {GROUPS.map((g) => {
          const rs = world.regions.filter((r) => !r.parent && kindOf(r) === g);
          if (!rs.length) return null;
          return (
            <section key={g}>
              <h3>
                {g} <small className="muted">{rs.length}</small>
              </h3>
              <ul className="region-list">
                {rs.map((r) => (
                  <li key={r.id}>
                    <button className={`ghost${sel === r.id ? ' on' : ''}`} onClick={() => setSelected(r.id)}>
                      <span className="swatch" style={{ background: landSwatch(r) }} />
                      <span className="v2-name">{r.name}</span>
                      <small className="muted">{tileCount(world, r)}칸</small>
                      <Danger level={notes[r.id]?.design?.danger} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {sel && (
        <div className="fullmap-region v2-region">
          <button className="ghost close" onClick={() => setSelected(null)} aria-label="닫기">
            ✕
          </button>
          <PlaceCard world={world} id={sel} note={notes[sel]} onSelect={setSelected} />
        </div>
      )}
    </div>
  );
}
