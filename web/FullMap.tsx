// The map filling the whole screen (#/map), everything on it visible, with the selected
// region, the latest log lines and (for the observer) the time controls floating on top.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { formatTimeOfDay, minuteOfDay } from '../sim/clock.ts';
import type { State } from '../sim/state.ts';
import type { World } from '../sim/world.ts';
import { MapView } from './MapView.tsx';
import { ObserverControls, RegionCard } from './panels.tsx';
import { clock, visibleLog } from './view.ts';

const TICKER_SHOWN = 6;

type Props = {
  world: World;
  state: State | null;
  busy: boolean;
  error: string | null;
  nav: ReactNode;
  onAdvance: (hours: number) => void;
};

export function FullMap({ world, state, busy, error, nav, onAdvance }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [full, setFull] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFull = () =>
    void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  const recent = state ? visibleLog(state, true).filter((e) => e.kind !== 'narration').slice(-TICKER_SHOWN) : [];

  return (
    <div className="fullmap">
      <MapView world={world} state={state} selected={selected} onSelect={setSelected} all />
      <div className="fullmap-top">
        <h1>젠디카르</h1>
        {state && <span className="clock">{clock(state)}</span>}
        {nav}
        <button className="ghost" onClick={toggleFull}>
          {full ? '전체화면 끝내기' : '전체화면'}
        </button>
      </div>
      {selected && (
        <div className="fullmap-region">
          <button className="ghost close" onClick={() => setSelected(null)} aria-label="닫기">
            ✕
          </button>
          <RegionCard world={world} state={state} regionId={selected} all />
        </div>
      )}
      <div className="fullmap-feed">
        {recent.map((e) => (
          <div key={e.id} className={`log-line log-${e.kind}`}>
            <time>{formatTimeOfDay(minuteOfDay(e.t))}</time>
            <span>{e.text}</span>
          </div>
        ))}
        {error && <p className="error">{error}</p>}
        {busy && <p className="muted working">시간이 흐르는 중…</p>}
        {state?.mode === 'observer' && <ObserverControls busy={busy} onAdvance={onAdvance} />}
        {!state && <p className="muted">아직 게임이 없다. 땅만 보인다.</p>}
      </div>
    </div>
  );
}
