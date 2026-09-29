import { useEffect, useState } from 'react';
import type { Action } from '../sim/actions.ts';
import { player } from '../sim/state.ts';
import { TERRAINS } from '../sim/world.ts';
import { api } from './api.ts';
import type { GameView } from './api.ts';
import { MapView } from './MapView.tsx';
import { CharacterControls, LogView, NewGame, ObserverControls, PeopleList, PlayerCard, RegionCard } from './panels.tsx';
import { clock } from './view.ts';

export function App() {
  const [game, setGame] = useState<GameView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.get().then(setGame, (e: Error) => setError(e.message));
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
  const { world, state, llm } = game;

  if (!state || starting) {
    return (
      <div className="start">
        <h1>젠디카르 여정</h1>
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
        <span className="clock">{clock(state)}</span>
        <span className="badge">{p ? `인물: ${p.name}` : '지켜보기'}</span>
        <span className={`badge ${llm ? 'on' : ''}`} title={llm ? 'GM·서술·대화에 LLM을 쓴다' : '규칙만으로 돌아간다 (.env 의 CHAT_PROVIDER)'}>
          LLM {llm ? '켜짐' : '꺼짐'}
        </span>
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
            <CharacterControls world={world} state={state} llm={llm} busy={busy} onAct={act} onSay={(t) => run(() => api.say(t))} />
          ) : (
            <ObserverControls busy={busy} onAdvance={(h) => run(() => api.advance(h))} />
          )}
        </section>
        <aside className="pane side-pane">
          <PlayerCard world={world} state={state} />
          <PeopleList world={world} state={state} />
        </aside>
      </main>
    </div>
  );
}
