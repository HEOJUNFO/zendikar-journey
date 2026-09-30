// The whole of Zendikar at once (#/world): every region, everyone, every log line, even in
// character mode. Before a game starts it shows just the land.
import { useState } from 'react';
import type { State } from '../sim/state.ts';
import { areasOf, TERRAINS } from '../sim/world.ts';
import type { World } from '../sim/world.ts';
import { MapView } from './MapView.tsx';
import { LegendsList, LogView, ObserverControls, PeopleList, PlayerCard, RegionCard } from './panels.tsx';
import { landSwatch, visibleActors } from './view.ts';

type Props = {
  world: World;
  state: State | null;
  busy: boolean;
  error: string | null;
  onAdvance: (hours: number) => void;
};

export function WorldPage({ world, state, busy, error, onAdvance }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const regionId = selected ?? world.regions.find((r) => !TERRAINS[r.terrain].sea)?.id ?? world.regions[0]?.id;
  return (
    <main className="layout">
      <section className="pane map-pane">
        <MapView world={world} state={state} selected={regionId} onSelect={setSelected} all />
        {regionId && <RegionCard world={world} state={state} regionId={regionId} all />}
      </section>
      <section className="pane story-pane">
        {state ? (
          <>
            <LogView state={state} all />
            {error && <p className="error">{error}</p>}
            {busy && <p className="muted working">시간이 흐르는 중…</p>}
            {state.mode === 'observer' ? (
              <ObserverControls busy={busy} onAdvance={onAdvance} />
            ) : (
              <p className="muted">인물 모드에서는 인물이 행동해야 시간이 흐른다. 여정 화면에서 움직여 보자.</p>
            )}
          </>
        ) : (
          <p className="log-empty">아직 게임이 없다. 새 게임을 시작하면 인물과 사건이 여기서 흘러간다.</p>
        )}
      </section>
      <aside className="pane side-pane">
        <RegionList world={world} state={state} selected={regionId} onSelect={setSelected} />
        {state && <PlayerCard world={world} state={state} />}
        {state && <PeopleList world={world} state={state} all />}
        {state && <LegendsList world={world} state={state} all />}
      </aside>
    </main>
  );
}

// Every land at a glance: who is there and what is wrong with it.
function RegionList(props: { world: World; state: State | null; selected?: string; onSelect: (id: string) => void }) {
  const { world, state, selected, onSelect } = props;
  const actors = state ? visibleActors(state, true) : [];
  return (
    <section className="card">
      <h2>지역</h2>
      <ul className="region-list">
        {world.regions.filter((r) => !r.parent).flatMap((r) => [r, ...areasOf(world, r.id)]).map((r) => {
          const rs = state?.regions[r.id];
          const count = actors.filter((a) => a.region === r.id && !a.travel).length;
          return (
            <li key={r.id}>
              <button className={`ghost${selected === r.id ? ' on' : ''}`} onClick={() => onSelect(r.id)}>
                {r.parent && <span className="muted">└</span>}
                <span className="swatch" style={{ background: landSwatch(r) }} />
                {r.name}
                {rs?.destroyed && ' ✕'}
                {!!rs?.conditions.length && ' ⚠'}
                {count > 0 && <small className="muted"> · {count}명</small>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
