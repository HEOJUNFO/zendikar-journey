import { useEffect, useState } from 'react';
import type { Action } from '../sim/actions.ts';
import { player } from '../sim/state.ts';
import { TERRAINS } from '../sim/world.ts';
import { AdminPage } from './AdminPage.tsx';
import { api } from './api.ts';
import type { GameView } from './api.ts';
import { FullMap } from './FullMap.tsx';
import { MapView } from './MapView.tsx';
import { BeingsList, CharacterControls, LogView, NewGame, ObserverControls, PeopleList, PlayerCard, RegionCard } from './panels.tsx';
import { clock } from './view.ts';
import { WorldPage } from './WorldPage.tsx';

// Pages: the journey (#/, start screen or play), the whole world (#/world), the
// full-screen map (#/map) and the operator's map (#/admin).
type Page = 'journey' | 'world' | 'map' | 'admin';
const PAGES: Record<string, Page> = { '#/world': 'world', '#/map': 'map', '#/admin': 'admin' };
const pageOf = (): Page => PAGES[location.hash] ?? 'journey';

function Nav({ page }: { page: Page }) {
  return (
    <nav className="nav">
      <a href="#/" className={page === 'journey' ? 'on' : ''}>여정</a>
      <a href="#/world" className={page === 'world' ? 'on' : ''}>세계 흐름</a>
      <a href="#/map" className={page === 'map' ? 'on' : ''}>전체 지도</a>
      <a href="#/admin" className={page === 'admin' ? 'on' : ''}>운영자</a>
    </nav>
  );
}

export function App() {
  const [page, setPage] = useState<Page>(pageOf);
  const [game, setGame] = useState<GameView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.get().then(setGame, (e: Error) => setError(e.message));
    const onHash = () => setPage(pageOf());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  async function run(p: () => Promise<GameView>) {
    setBusy(true);
    setError(null);
    try {
      const view = await p();
      setGame(view);
      if (view.error) setError(view.error);
      return view;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!game) return <div className="loading">{error ?? '젠디카르를 불러오는 중…'}</div>;
  const { world, state } = game;

  if (page === 'map') {
    return (
      <FullMap world={world} state={state} busy={busy} error={error} nav={<Nav page={page} />}
        onAdvance={(h) => run(() => api.advance(h))} />
    );
  }

  if (page === 'admin') {
    return (
      <div className="app">
        <header>
          <h1>운영자 지도</h1>
          <Nav page={page} />
          {state && <span className="clock">{clock(state)}</span>}
          {state && <span className="badge">{state.mode === 'observer' ? '지켜보기' : '인물 모드'}</span>}
          <button className="ghost" onClick={() => run(api.get)} disabled={busy}>
            새로고침
          </button>
        </header>
        <AdminPage world={world} state={state} busy={busy} error={error} onAdvance={(h) => run(() => api.advance(h))} />
      </div>
    );
  }

  if (page === 'world') {
    return (
      <div className="app">
        <header>
          <h1>젠디카르 세계</h1>
          <Nav page={page} />
          {state && <span className="clock">{clock(state)}</span>}
          {state && <span className="badge">{state.mode === 'observer' ? '지켜보기' : '인물 모드'}</span>}
        </header>
        <WorldPage world={world} state={state} busy={busy} error={error} onAdvance={(h) => run(() => api.advance(h))} />
      </div>
    );
  }

  if (!state || starting) {
    return (
      <div className="start">
        <h1>젠디카르 여정</h1>
        <Nav page={page} />
        <NewGame
          world={world}
          busy={busy}
          onCancel={state ? () => setStarting(false) : undefined}
          onStart={async (input) => {
            const view = await run(() => api.newGame(input));
            if (view?.state) {
              setStarting(false);
              setSelected(null);
            }
          }}
        />
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  const p = player(state);
  const regionId =
    selected ?? p?.region ?? world.regions.find((r) => !TERRAINS[r.terrain].sea)?.id ?? world.regions[0]?.id;
  const act = (a: Action) => run(() => api.act(a));

  return (
    <div className="app">
      <header>
        <h1>젠디카르 여정</h1>
        <Nav page={page} />
        <span className="clock">{clock(state)}</span>
        <span className="badge">{p ? `인물: ${p.name}` : '지켜보기'}</span>
        <button className="ghost" onClick={() => setStarting(true)} disabled={busy}>
          새 게임
        </button>
      </header>
      <main className="layout">
        <section className="pane map-pane">
          <MapView world={world} state={state} selected={regionId} onSelect={setSelected} />
          {regionId && <RegionCard world={world} state={state} regionId={regionId} busy={busy} onAct={act} />}
        </section>
        <section className="pane story-pane">
          <LogView state={state} />
          {error && <p className="error">{error}</p>}
          {busy && <p className="muted working">시간이 흐르는 중…</p>}
          {p ? (
            <CharacterControls world={world} state={state} busy={busy} onAct={act} onSay={(t) => run(() => api.say(t))} />
          ) : (
            <ObserverControls busy={busy} onAdvance={(h) => run(() => api.advance(h))} />
          )}
        </section>
        <aside className="pane side-pane">
          <PlayerCard world={world} state={state} />
          <PeopleList world={world} state={state} />
          <BeingsList world={world} state={state} />
        </aside>
      </main>
    </div>
  );
}
