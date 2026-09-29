import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Action } from '../sim/actions.ts';
import { PACE_LABELS } from '../sim/actions.ts';
import { formatClock, formatTimeOfDay, gameDay, minuteOfDay } from '../sim/clock.ts';
import { player, present } from '../sim/state.ts';
import type { Actor, LogEntry, State } from '../sim/state.ts';
import { travelBlocked } from '../sim/step.ts';
import { shortName } from '../sim/text.ts';
import { PACES } from '../sim/types.ts';
import type { Pace } from '../sim/types.ts';
import { canStay, region, TERRAINS, travelHours } from '../sim/world.ts';
import type { World } from '../sim/world.ts';
import type { NewGameInput } from './api.ts';
import { visibleActors, visibleLog } from './view.ts';

// --- log -------------------------------------------------------------------------------

const LOG_SHOWN = 400;

export function LogView({ state }: { state: State }) {
  const entries = useMemo(() => visibleLog(state).slice(-LOG_SHOWN), [state]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [entries]);
  let lastDay = -1;
  return (
    <div className="log" aria-live="polite">
      {entries.length === 0 && <p className="log-empty">아직 아무 일도 일어나지 않았다.</p>}
      {entries.map((e) => {
        const day = gameDay(e.t);
        const header = day !== lastDay ? <h3 className="log-day">{day + 1}일차</h3> : null;
        lastDay = day;
        return (
          <div key={e.id}>
            {header}
            <LogLine e={e} />
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function LogLine({ e }: { e: LogEntry }) {
  if (e.kind === 'narration') return <p className="log-narration">{e.text}</p>;
  return (
    <div className={`log-line log-${e.kind}`}>
      <time>{formatTimeOfDay(minuteOfDay(e.t))}</time>
      <span>{e.text}</span>
    </div>
  );
}

// --- region card -----------------------------------------------------------------------

export function RegionCard(props: { world: World; state: State; regionId: string; busy: boolean; onAct: (a: Action) => void }) {
  const { world, state, regionId, busy, onAct } = props;
  const r = region(world, regionId);
  const t = TERRAINS[r.terrain];
  const conds = state.regions[r.id]?.conditions ?? [];
  const here = visibleActors(state).filter((a) => a.region === r.id && !a.travel);
  const p = player(state);
  let travel: ReactNode = null;
  if (p && !t.sea) {
    if (p.region === r.id && !p.travel) travel = <p className="muted">지금 여기 있다.</p>;
    else if (!p.travel) {
      const why = travelBlocked(state, world, p, r.id);
      travel = why ? (
        <p className="muted">갈 수 없다: {why}</p>
      ) : (
        <button disabled={busy} onClick={() => onAct({ type: 'move', to: r.id })}>
          이곳으로 이동 ({travelHours(region(world, p.region), r)}시간)
        </button>
      );
    }
  }
  return (
    <section className="card">
      <h2>
        {r.name} <small>{t.label}</small>
      </h2>
      <p>{r.summary}</p>
      {conds.map((c) => (
        <p key={c.label + c.until} className="cond">
          ⚠ {c.label} <small>({formatClock(c.until)}까지{c.blocksTravel ? ', 오갈 수 없음' : ''})</small>
        </p>
      ))}
      {here.length > 0 && (
        <p className="muted">
          여기 있는 이: {here.map((a) => (a.kind === 'player' ? `${shortName(a.name)}(나)` : shortName(a.name))).join(', ')}
        </p>
      )}
      {travel}
    </section>
  );
}

// --- people ----------------------------------------------------------------------------

function Bar({ label, value, max = 100, bad = false }: { label: string; value: number; max?: number; bad?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar">
      <span>{label}</span>
      <div className="bar-track">
        <div className={`bar-fill ${bad ? 'bar-bad' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <b>{Math.round(value)}</b>
    </div>
  );
}

function status(world: World, a: Actor) {
  if (a.boundUntil !== undefined) return `붙잡힘 (${formatClock(a.boundUntil)}까지)`;
  const task = a.forced ?? a.task;
  const where = a.travel ? `${region(world, a.region).name} → ${region(world, a.travel.to).name}` : region(world, a.region).name;
  return `${where} · ${task ? `${task.emoji} ${task.activity}` : '쉬는 중'}`;
}

export function PeopleList({ world, state }: { world: World; state: State }) {
  const p = player(state);
  const people = visibleActors(state).filter((a) => a.kind === 'npc');
  return (
    <section className="card">
      <h2>{p ? '곁에 있는 이' : '인물'}</h2>
      {people.length === 0 && <p className="muted">{p ? '아무도 없다.' : '아직 인물이 없다.'}</p>}
      {people.map((a) => (
        <div key={a.id} className="person">
          <b>{shortName(a.name)}</b>
          <p className="muted">{status(world, a)}</p>
          {!p && (
            <>
              <Bar label="기력" value={a.stats.energy} />
              <Bar label="배고픔" value={a.stats.hunger} bad />
            </>
          )}
        </div>
      ))}
    </section>
  );
}

export function PlayerCard({ world, state }: { world: World; state: State }) {
  const p = player(state);
  if (!p) return null;
  return (
    <section className="card">
      <h2>{p.name}</h2>
      {p.background && <p className="muted">{p.background}</p>}
      <p>{status(world, p)}</p>
      <Bar label="기력" value={p.stats.energy} />
      <Bar label="배고픔" value={p.stats.hunger} bad />
      <div className="bar">
        <span>돈</span>
        <b>{Math.round(p.stats.coin)}</b>
      </div>
    </section>
  );
}

// --- controls --------------------------------------------------------------------------

export function ObserverControls({ busy, onAdvance }: { busy: boolean; onAdvance: (h: number) => void }) {
  return (
    <div className="controls">
      <span className="muted">시간 보내기</span>
      {[
        [1, '1시간'],
        [6, '6시간'],
        [24, '하루'],
        [72, '사흘'],
      ].map(([h, label]) => (
        <button key={h} disabled={busy} onClick={() => onAdvance(h as number)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function CharacterControls(props: {
  world: World;
  state: State;
  llm: boolean;
  busy: boolean;
  onAct: (a: Action) => void;
  onSay: (text: string) => void;
}) {
  const { state, llm, busy, onAct, onSay } = props;
  const p = player(state)!;
  const [text, setText] = useState('');
  const [hours, setHours] = useState(2);
  const [pace, setPace] = useState<Pace>('careful');
  const [talkTo, setTalkTo] = useState('');
  const [line, setLine] = useState('');
  const people = present(state, p.region).filter((a) => a.kind === 'npc' && a.boundUntil === undefined);
  const stuck = p.travel || p.forced || p.boundUntil !== undefined;
  const target = people.find((a) => a.id === talkTo) ?? people[0];

  return (
    <div className="controls controls-player">
      <form
        className="say"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onSay(text.trim());
          setText('');
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy || !llm}
          placeholder={llm ? '무엇을 할까? (예: 조심스럽게 협곡 아래를 살핀다)' : '자유 입력은 LLM이 켜져 있어야 한다. 아래 버튼을 쓰자.'}
          aria-label="행동 입력"
        />
        <button disabled={busy || !llm || !text.trim()}>하기</button>
      </form>
      <div className="row">
        <label>
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="시간">
            {[1, 2, 4, 6, 8].map((h) => (
              <option key={h} value={h}>
                {h}시간
              </option>
            ))}
          </select>
        </label>
        <select value={pace} onChange={(e) => setPace(e.target.value as Pace)} aria-label="속도">
          {PACES.map((x) => (
            <option key={x} value={x}>
              {PACE_LABELS[x]}
            </option>
          ))}
        </select>
        <button disabled={busy || !!stuck} onClick={() => onAct({ type: 'explore', hours, pace })}>
          탐색
        </button>
        <button disabled={busy || !!stuck} onClick={() => onAct({ type: 'rest', hours })}>
          쉬기
        </button>
        <button disabled={busy || !!stuck} onClick={() => onAct({ type: 'eat' })}>
          먹기
        </button>
        <button disabled={busy || !!p.travel} onClick={() => onAct({ type: 'wait', hours })}>
          기다리기
        </button>
      </div>
      {people.length > 0 && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!line.trim() || !target) return;
            onAct({ type: 'talk', to: target.id, say: line.trim() });
            setLine('');
          }}
        >
          <select value={target?.id} onChange={(e) => setTalkTo(e.target.value)} aria-label="대화 상대">
            {people.map((a) => (
              <option key={a.id} value={a.id}>
                {shortName(a.name)}
              </option>
            ))}
          </select>
          <input value={line} onChange={(e) => setLine(e.target.value)} disabled={busy || !!stuck} placeholder="할 말" aria-label="할 말" />
          <button disabled={busy || !!stuck || !line.trim()}>말하기</button>
        </form>
      )}
      {stuck && <p className="muted">{p.travel ? '이동 중이다.' : '움직일 수 없다. 기다리는 수밖에 없다.'}</p>}
    </div>
  );
}

// --- new game --------------------------------------------------------------------------

export function NewGame(props: { world: World; busy: boolean; onStart: (i: NewGameInput) => void; onCancel?: () => void }) {
  const { world, busy, onStart, onCancel } = props;
  const starts = world.regions.filter((r) => canStay(r, []));
  const [mode, setMode] = useState<'observer' | 'character'>(starts.length ? 'character' : 'observer');
  const [name, setName] = useState('');
  const [background, setBackground] = useState('');
  const [start, setStart] = useState(starts[0]?.id ?? '');
  const ok = mode === 'observer' || (name.trim() && start);
  return (
    <form
      className="newgame card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        onStart(mode === 'observer' ? { mode } : { mode, player: { name: name.trim(), background: background.trim(), region: start } });
      }}
    >
      <h2>새 여정</h2>
      <p className="muted">
        지역 {world.regions.length}곳, 인물 {world.npcs.length}명, 사건 {world.events.length}가지. 새로 시작하면 지금 저장된 게임은 사라진다.
      </p>
      <fieldset className="modes">
        <label className={mode === 'character' ? 'on' : ''}>
          <input type="radio" name="mode" checked={mode === 'character'} disabled={!starts.length} onChange={() => setMode('character')} />
          <b>인물로 살기</b>
          <span>젠디카르의 한 사람이 되어 행동한다. 내가 보고 들은 것만 알 수 있다.</span>
        </label>
        <label className={mode === 'observer' ? 'on' : ''}>
          <input type="radio" name="mode" checked={mode === 'observer'} onChange={() => setMode('observer')} />
          <b>지켜보기</b>
          <span>세계 전체가 흘러가는 것을 본다.</span>
        </label>
      </fieldset>
      {mode === 'character' && (
        <>
          <label>
            이름
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
          </label>
          <label>
            어떤 사람인가
            <textarea value={background} onChange={(e) => setBackground(e.target.value)} maxLength={500} rows={3}
              placeholder="예: 폐허의 보물을 찾아 떠도는 젊은 탐험가" />
          </label>
          <label>
            시작할 곳
            <select value={start} onChange={(e) => setStart(e.target.value)}>
              {starts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <div className="row">
        <button type="submit" disabled={busy || !ok}>
          시작
        </button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            돌아가기
          </button>
        )}
      </div>
    </form>
  );
}
