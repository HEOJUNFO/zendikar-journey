import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Action } from '../sim/actions.ts';
import { PACE_LABELS } from '../sim/actions.ts';
import { formatClock, formatTimeOfDay, gameDay, minuteOfDay } from '../sim/clock.ts';
import { isPerson, needsOf, npcDef, outOfTime, player, present, ptOf, together } from '../sim/state.ts';
import { hireBlocked, hirePrice } from '../sim/allies.ts';
import { askOptions, askText } from '../sim/asks.ts';
import { woundsOf } from '../sim/combat.ts';
import { COLOR_LABELS, formatMana, manaAvailable, manaCapacity, manaLabel } from '../sim/mana.ts';
import { loremastersOf, recallBlocked, recallCount } from '../sim/loremaster.ts';
import { biteBlocked, bitersOf } from '../sim/bite.ts';
import { shieldBlocked, wardensOf } from '../sim/vestige.ts';
import { bondBlocked, bondTargets, enteredToday, fetchTargets, landDropBlocked, fireTargets, firesOnBond, growBlocked, growLand, targetedBondEffect } from '../sim/abilities.ts';
import { BOND_HOURS } from '../sim/actions.ts';
import { CLAIM_HOURS, claimBlocked, itemsAt, itemsOf } from '../sim/items.ts';
import { EQUIP_HOURS, equipBlocked, equipmentOf, equipTargets } from '../sim/equipment.ts';
import { eonLand, eonsIn, spendBlocked, storeBlocked } from '../sim/eons.ts';
import { castBlocked, harmful, learnBlocked, spellsTaughtAt } from '../sim/spells.ts';
import { reactionSpell } from '../sim/counter.ts';
import { knownSecrets } from '../sim/knowledge.ts';
import { sealToday } from '../sim/seal.ts';
import { isWinner } from '../sim/win.ts';
import { lifeOf } from '../sim/life.ts';
import { handBlocked, topBlocked, topLand } from '../sim/oracle.ts';
import type { Actor, LogEntry, State } from '../sim/state.ts';
import { moveHours, ruinsUntil, travelBlocked } from '../sim/step.ts';
import { nearestTile, ownsTile, sameTile, tileCenter, tileLabel, tilesOf } from '../sim/tiles.ts';
import type { Tile } from '../sim/tiles.ts';
import { josa, shortName } from '../sim/text.ts';
import { PACES } from '../sim/types.ts';
import type { Pace } from '../sim/types.ts';
import { ABILITY_LABELS, areasOf, bondEffectText, canStay, hasPowers, LAND_TYPE_LABELS, placeName, region, TERRAINS, travelHours } from '../sim/world.ts';
import type { World } from '../sim/world.ts';
import type { NewGameInput } from './api.ts';
import { visibleActors, visibleLog } from './view.ts';

// --- log -------------------------------------------------------------------------------

const LOG_SHOWN = 400;

export function LogView({ state, all }: { state: State; all?: boolean }) {
  const entries = useMemo(() => visibleLog(state, all).slice(-LOG_SHOWN), [state, all]);
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

// Without onAct (the world page) it only describes the region; state null = no game yet.
export function RegionCard(props: {
  world: World;
  state: State | null;
  regionId: string;
  // The tile of it picked on the map, if any.
  tile?: Tile | null;
  busy?: boolean;
  onAct?: (a: Action) => void;
  all?: boolean;
}) {
  const { world, state, regionId, busy, onAct, all } = props;
  const tile = props.tile && ownsTile(world, regionId, props.tile) ? props.tile : undefined;
  const r = region(world, regionId);
  const t = TERRAINS[r.terrain];
  const conds = state?.regions[r.id]?.conditions ?? [];
  const destroyed = state?.regions[r.id]?.destroyed;
  const here = state ? visibleActors(state, all).filter((a) => a.region === r.id && !a.travel) : [];
  const parent = r.parent ? region(world, r.parent) : undefined;
  const areas = areasOf(world, r.id);
  const p = state && player(state);
  let travel: ReactNode = null;
  if (state && p && onAct && !t.sea) {
    if (p.region === r.id && !p.travel) {
      const why = bondBlocked(state, world, p, state.minutes);
      // A land whose bonding falls on someone (a life taken, flight given): you pick whom.
      const eff = targetedBondEffect(r);
      const targets = eff ? bondTargets(state, world, p, r.id, eff) : [];
      // A mountain that would wake a Valakut they hold: whom its fire falls on, if anyone.
      const fire = eff ? undefined : firesOnBond(state, world, { ...p, bonds: [...(p.bonds ?? []), r.id] }, r.id)[0];
      const burnable = fire ? fireTargets(state, world, p, fire) : [];
      const held = busy || !!p.forced || p.boundUntil !== undefined;
      const walk = tile && !sameTile(tile, p.tile) ? tile : undefined;
      travel = (
        <>
          <p className="muted">지금 여기 있다{p.tile ? ` (${tileLabel(world, r.id, p.tile)})` : ''}.</p>
          {walk && (
            <p>
              <button disabled={busy || !!p.forced || p.boundUntil !== undefined} onClick={() => onAct({ type: 'move', to: r.id, tile: walk })}>
                {tileLabel(world, r.id, walk)}(으)로 걸어가기 ({moveHours(world, p, r.id, walk)}시간)
              </button>
            </p>
          )}
          {why ? (
            <p className="muted">{why}</p>
          ) : burnable.length ? (
            <div className="row">
              <span className="muted">유대 맺기 ({BOND_HOURS}시간), {fire!.name}의 불길을 보낼 이:</span>
              {burnable.map((x) => (
                <button key={x.id} disabled={held} onClick={() => onAct({ type: 'bond', target: x.id })}>
                  {shortName(x.name)}
                </button>
              ))}
              <button disabled={held} onClick={() => onAct({ type: 'bond' })}>
                보내지 않음
              </button>
            </div>
          ) : targets.length ? (
            <div className="row">
              <span className="muted">
                유대 맺기 ({BOND_HOURS}시간),{' '}
                {eff!.type === 'lose_life' ? '생명을 앗길 이' : eff!.type === 'grant' ? `${ABILITY_LABELS[eff!.ability]}을 얻을 이` : '힘을 받을 이'}:
              </span>
              {targets.map((x) => (
                <button key={x.id} disabled={held} onClick={() => onAct({ type: 'bond', target: x.id })}>
                  {x.id === p.id ? '나' : shortName(x.name)}
                </button>
              ))}
            </div>
          ) : (
            <button disabled={held} onClick={() => onAct({ type: 'bond' })}>
              이 땅과 유대 맺기 ({BOND_HOURS}시간)
            </button>
          )}
          {spellsTaughtAt(world, r.id).map((s) => {
            const no = learnBlocked(world, p, s.id);
            return (
              <p key={s.id}>
                <button disabled={busy || !!no || !!p.forced || p.boundUntil !== undefined} title={no ?? s.summary} onClick={() => onAct({ type: 'learn', spell: s.id })}>
                  📖 {s.name} 배우기 ({s.learnHours}시간)
                </button>
              </p>
            );
          })}
          {itemsAt(state, world, r.id)
            .filter((x) => !state.items?.[x.id]?.owner)
            .map((x) => {
              const no = claimBlocked(state, world, p, x.id, state.minutes);
              return (
                <p key={x.id}>
                  <button disabled={busy || !!no || !!p.forced || p.boundUntil !== undefined} title={no ?? x.summary} onClick={() => onAct({ type: 'claim', item: x.id })}>
                    🏺 {x.name} 길들이기 ({x.costText}, {CLAIM_HOURS}시간)
                  </button>
                </p>
              );
            })}
        </>
      );
    }
    else if (!p.travel) {
      const why = travelBlocked(state, world, p, r.id);
      travel = why ? (
        <p className="muted">갈 수 없다: {why}</p>
      ) : (
        <button disabled={busy} onClick={() => onAct({ type: 'move', to: r.id, ...(tile ? { tile } : {}) })}>
          {tile ? `${tileLabel(world, r.id, tile)}(으)로` : '이곳으로'} 이동 ({moveHours(world, p, r.id, tile ?? nearestTile(world, r.id, p.tile && tileCenter(p.tile)))}시간)
        </button>
      );
    }
  }
  return (
    <section className="card">
      <h2>
        {r.name} <small>{t.label}{t.sea ? '' : ` · ${r.noMana ? '마나 없는' : r.color ? `${manaLabel(r.color)}색` : '무색'} 땅`}</small>
      </h2>
      {parent && <p className="muted">{parent.name} 안의 구역</p>}
      <p>{r.summary}</p>
      {(r.entersTapped || r.onBond.length > 0 || r.fetch || r.eon || r.growEntered) && (
        <p className="muted">
          {[
            r.entersTapped && '유대를 맺은 날은 마나를 내지 않음',
            ...r.onBond.map(bondEffectText),
            r.fetch && `내어 주면 ${r.fetch.types.map((x) => LAND_TYPE_LABELS[x]).join('·')} 땅 하나와 멀리서 유대 (생명 ${r.fetch.life})`,
            r.eon && `하루를 맡기면 (${r.eon.costText}) 내일을 잃고, 되찾으면 세상이 멈춘 하루를 얻음`,
            r.growEntered && `탭하면 오늘 새로 난 ${manaLabel(r.growEntered.color)}색 생물 모두에게 +1/+1`,
          ].filter(Boolean).join(' · ')}
        </p>
      )}
      {areas.length > 0 && (
        <p className="muted">
          안의 구역:{' '}
          {areas
            .map((x) => {
              const n = state ? visibleActors(state, all).filter((a) => a.region === x.id && !a.travel).length : 0;
              return n ? `${x.name} (${n}명)` : x.name;
            })
            .join(', ')}
          <small> · 지도에서 골라 들어간다</small>
        </p>
      )}
      {state?.regions[r.id]?.blaze && <p className="cond">🔥 불타는 땅 <small>(이어진 이는 00:00마다 생명 1을 잃는다)</small></p>}
      {destroyed && <p className="cond">✕ 부서진 땅 <small>({formatClock(destroyed.until ?? ruinsUntil(destroyed.at))}까지 쓸 수 없음)</small></p>}
      {conds.map((c) => (
        <p key={c.label + c.until} className="cond">
          ⚠ {c.label} <small>({formatClock(c.until)}까지{c.blocksTravel ? ', 오갈 수 없음' : ''}{c.tapped ? ', 쓸 수 없음' : ''})</small>
        </p>
      ))}
      {(state ? itemsAt(state, world, r.id) : world.items.filter((x) => x.at === r.id)).map((x) => {
        const held = state?.items?.[x.id];
        const owner = held?.owner && state?.actors[held.owner];
        return (
          <p key={x.id} className="muted" title={x.summary}>
            🏺 {x.name}{' '}
            <small>{owner ? `· ${shortName(owner.name)}의 것${held.counters ? `, 담긴 생명 ${held.counters}` : ''}` : '· 주인 없음'}</small>
          </p>
        );
      })}
      {here.length > 0 && (
        <div className="muted">
          이 땅에 있는 이:{' '}
          {here.map((a) => {
            const where = a.tile && tilesOf(world, r.id).length > 1 ? ` · ${tileLabel(world, r.id, a.tile)}` : '';
            const mine = p && a.id === p.id;
            const seek = p && onAct && !mine && !p.travel && !together(p, a);
            return (
              <span key={a.id} className="who">
                {mine ? `${shortName(a.name)}(나)` : shortName(a.name)}
                <small>{where}</small>
                {seek && (
                  <button className="ghost small" disabled={busy || !!p.forced || p.boundUntil !== undefined} onClick={() => onAct({ type: 'seek', to: a.id })}>
                    찾아가기
                  </button>
                )}{' '}
              </span>
            );
          })}
        </div>
      )}
      {travel}
    </section>
  );
}

// --- people ----------------------------------------------------------------------------

export function Bar({ label, value, max = 100, bad = false }: { label: string; value: number; max?: number; bad?: boolean }) {
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

export function fighting(a: Actor, t: number) {
  const [p, tough] = ptOf(a);
  const w = woundsOf(a, t);
  return `${p}/${tough}${w ? ` · 피해 ${w}` : ''}`;
}

export function status(world: World, a: Actor) {
  if (a.dead) return a.left ? a.dead.cause : `죽음 (${a.dead.cause})`;
  if (a.boundUntil !== undefined) return `묶임 (${formatClock(a.boundUntil)}까지)`;
  const task = a.forced ?? a.task;
  const at = (id: string, tile?: Tile) => (tile && tilesOf(world, id).length > 1 ? tileLabel(world, id, tile) : region(world, id).name);
  const where = a.travel ? `${at(a.region, a.tile)} → ${at(a.travel.to, a.travel.tile)}` : at(a.region, a.tile);
  return `${where} · ${task ? `${task.emoji} ${task.activity}` : '쉬는 중'}`;
}

export function PeopleList({ world, state, all }: { world: World; state: State; all?: boolean }) {
  const p = all ? undefined : player(state);
  const people = visibleActors(state, all).filter(isPerson);
  const dead = p ? [] : Object.values(state.actors).filter((a) => isPerson(a) && a.dead);
  return (
    <section className="card">
      <h2>{p ? '곁에 있는 이' : '인물'}</h2>
      {people.length === 0 && <p className="muted">{p ? '아무도 없다.' : '아직 인물이 없다.'}</p>}
      {people.map((a) => (
        <div key={a.id} className="person">
          <b>{shortName(a.name)}</b> <small className="muted">{fighting(a, state.minutes)}</small>
          {a.master && state.actors[a.master] && <small className="muted"> · {shortName(state.actors[a.master].name)}의 권속</small>}
          {sealToday(a, state.minutes) && <small className="muted"> · {COLOR_LABELS[sealToday(a, state.minutes)!]}색 봉인</small>}
          {isWinner(state, a.id) && <small className="muted"> · 🏆 세계의 승자</small>}
          <p className="muted">{status(world, a)}</p>
          {!p && (
            <>
              {needsOf(a).includes('energy') && <Bar label="기력" value={a.stats.energy} />}
              <p className="muted">생명 {lifeOf(a)}</p>
              {needsOf(a).includes('hunger') && <Bar label="배고픔" value={a.stats.hunger} bad />}
            </>
          )}
        </div>
      ))}
      {dead.map((a) => (
        <div key={a.id} className="person">
          <b>✝ {shortName(a.name)}</b>
          <p className="muted">{status(world, a)}</p>
        </div>
      ))}
    </section>
  );
}

export function PlayerCard({ world, state, busy, onAct }: { world: World; state: State; busy?: boolean; onAct?: (a: Action) => void }) {
  const p = player(state);
  if (!p) return null;
  return (
    <section className="card">
      <h2>
        {p.dead ? '✝ ' : ''}
        {p.name} <small>{fighting(p, state.minutes)}</small>
      </h2>
      {p.background && <p className="muted">{p.background}</p>}
      <p>{status(world, p)}</p>
      {isWinner(state, p.id) && <p>🏆 세계의 승자 ({formatClock(state.winners!.find((w) => w.id === p.id)!.at)})</p>}
      <Bar label="기력" value={p.stats.energy} />
      <div className="bar">
        <span>생명</span>
        <b>{lifeOf(p)}</b>
      </div>
      <Bar label="배고픔" value={p.stats.hunger} bad />
      <div className="bar">
        <span>돈</span>
        <b>{Math.round(p.stats.coin)}</b>
      </div>
      <p className="muted">
        마나: {formatMana(manaAvailable(state, world, p, state.minutes))} (하루 {formatMana(manaCapacity(state, world, p, state.minutes))})
      </p>
      <p className="muted">
        유대를 맺은 땅: {p.bonds?.length ? p.bonds.map((id) => region(world, id).name).join(', ') : '없음'}
      </p>
      {(() => {
        // The land on top of their library (Oracle of Mul Daya): bond from afar.
        const top = topLand(state, p, state.minutes);
        if (!top) return null;
        const why = topBlocked(state, world, p, top, state.minutes, (t) => landDropBlocked(state, world, p, t));
        return (
          <p className="muted">
            서고 맨 위: {placeName(world, region(world, top))}{' '}
            {why || !onAct ? <small>{why ? `(${why.replace(/\.$/, '')})` : ''}</small> : <button disabled={busy} onClick={() => onAct({ type: 'fetch', from: 'top', to: top })}>멀리서 이어지기</button>}
          </p>
        );
      })()}
      {(p.handLands ?? []).length ? (
        // Lands in their hand (Merfolk Wayfinder): bond from afar, as the land for the day.
        <p className="muted">
          손에 든 땅:{' '}
          {p.handLands!.map((id) => {
            const why = handBlocked(state, world, p, id, state.minutes, (t) => landDropBlocked(state, world, p, t));
            return (
              <span key={id}>
                {placeName(world, region(world, id))}{' '}
                {why || !onAct ? <small>{why ? `(${why.replace(/\.$/, '')}) ` : ''}</small> : <button disabled={busy} onClick={() => onAct({ type: 'fetch', from: 'hand', to: id })}>멀리서 이어지기</button>}{' '}
              </span>
            );
          })}
        </p>
      ) : null}
      <p className="muted">
        권속:{' '}
        {Object.values(state.actors)
          .filter((x) => !x.dead && x.master === p.id)
          .map((x) => shortName(x.name))
          .join(', ') || '없음'}
      </p>
      <p className="muted">
        아는 주문:{' '}
        {p.spells?.length ? world.spells.filter((s) => p.spells!.includes(s.id)).map((s) => `${s.name} ${s.costText}`).join(', ') : '없음'}
      </p>
      {knownSecrets(p, state.minutes).length > 0 && (
        <details className="muted">
          <summary>아는 비밀 {knownSecrets(p, state.minutes).length}가지</summary>
          <ul>
            {knownSecrets(p, state.minutes).map((k) => (
              <li key={k.id}>{k.text}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="muted">
        길들인 것:{' '}
        {itemsOf(state, world, p.id)
          .map((x) => {
            const bearer = state.items![x.id].bearer;
            return x.equip ? `${x.name} (${bearer ? `${bearer === p.id ? '내 몸' : shortName(state.actors[bearer]?.name ?? '')}에 매임` : '매지 않음'})` : `${x.name} (담긴 생명 ${state.items![x.id].counters})`;
          })
          .join(', ') || '없음'}
      </p>
      {onAct && equipmentOf(state, world, p).flatMap((x) =>
        equipTargets(state, p).map((to) => {
          const no = equipBlocked(state, world, p, x.id, to.id, state.minutes);
          return (
            <p key={`${x.id}-${to.id}`}>
              <button disabled={busy || !!no || !!p.forced || p.boundUntil !== undefined} title={no ?? x.summary} onClick={() => onAct({ type: 'equip', item: x.id, to: to.id })}>
                🪝 {x.name}을(를) {to.id === p.id ? '몸에' : `${shortName(to.name)}에게`} 매기 ({x.equip!.costText}, {EQUIP_HOURS}시간)
              </button>
            </p>
          );
        }),
      )}
    </section>
  );
}

// Characters with powers of their own: what they have left today (the observer sees it).
export function LegendsList({ world, state, all }: { world: World; state: State; all?: boolean }) {
  const legends = world.npcs.filter(hasPowers);
  if ((player(state) && !all) || !legends.length) return null;
  return (
    <section className="card">
      <h2>능력을 지닌 이들</h2>
      {legends.map((b) => {
        const bs = state.actors[b.id];
        if (!bs) return null;
        const tapped = bs.boundUntil !== undefined && bs.boundUntil > state.minutes;
        return (
          <div key={b.id} className="person">
            <b>{bs.dead ? '✝ ' : ''}{shortName(b.name)}</b> <small className="muted">{b.pt.join('/')} · {region(world, bs.region).name}</small>
            <p className="muted">
              마나 {formatMana(manaAvailable(state, world, bs, state.minutes))}
              {bs.loyalty !== undefined ? ` · 기세 ${bs.loyalty}` : ''}
              {tapped ? ` · 탭됨 (${formatClock(bs.boundUntil!)}까지)` : ''}
              {bs.left ? ' · 이 차원을 떠남' : ''}
            </p>
          </div>
        );
      })}
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
  busy: boolean;
  onAct: (a: Action) => void;
  onSay: (text: string) => void;
}) {
  const { world, state, busy, onAct, onSay } = props;
  const p = player(state)!;
  const known = world.spells.filter((s) => p.spells?.includes(s.id) && !reactionSpell(s));
  const [text, setText] = useState('');
  const [hours, setHours] = useState(2);
  const [pace, setPace] = useState<Pace>('careful');
  const [talkTo, setTalkTo] = useState('');
  const [line, setLine] = useState('');
  const people = present(state, p.region, p.tile).filter((a) => isPerson(a) && a.boundUntil === undefined);
  const keeper = eonLand(world, p);
  const grower = growLand(world, p);
  const stuck = p.travel || p.forced || p.boundUntil !== undefined;
  const target = people.find((a) => a.id === talkTo) ?? people[0];
  if (state.over) {
    return (
      <div className="controls controls-player">
        <p className="over">
          {p.name}의 인생은 {formatClock(state.over.at)}에 끝났다 ({state.over.cause}). 새 게임으로 다시 시작할 수 있다.
        </p>
      </div>
    );
  }

  // A pick they owe (an Ally's rally in their party, one asking them to serve, a blow to fly
  // from): nothing else until they answer.
  const ask = state.asks?.[0];
  if (ask) {
    return (
      <div className="controls controls-player">
        <p>{ask.effect.type === 'rally' ? '🔥' : ask.effect.type === 'evade' ? '🪽' : ask.effect.type === 'discard' ? '📜' : ask.effect.type === 'pilfer' ? '🗝️' : ask.effect.type === 'pour' ? '🩸' : ask.effect.type === 'sacrifice' ? '🗿' : ask.effect.type === 'crush' || ask.effect.type === 'demolish' ? '💥' : ask.effect.type === 'quell' || ask.effect.type === 'quelled' ? '🗻' : ask.effect.type === 'cast' || ask.effect.type === 'counter' ? '✨' : '🤝'} {askText(state, world, ask)}</p>
        <div className="row">
          {askOptions(state, world, ask).map((o) => (
            <button key={o.pick ?? '-'} disabled={busy} onClick={() => onAct({ type: 'choose', pick: o.pick })}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Seized (Roil Elemental, Sorin): dragged about as another's; they can only wait.
  const holder = p.seized && p.master ? state.actors[p.master] : undefined;
  if (holder && !holder.dead) {
    return (
      <div className="controls controls-player">
        <p>
          🌀 {shortName(holder.name)}에게 붙들려 끌려다닌다.{' '}
          {p.seizedUntil !== undefined ? `${formatClock(p.seizedUntil)}에 풀려난다.` : `${shortName(holder.name)}이(가) 사라져야 풀려난다.`}
        </p>
        <div className="row">
          {[1, 4, 8].map((h) => (
            <button key={h} disabled={busy} onClick={() => onAct({ type: 'wait', hours: h })}>
              {h}시간 기다리기
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Out of time (a day left in Magosi, or someone else's extra day): nothing to do but let it pass.
  if (outOfTime(state, p)) {
    return (
      <div className="controls controls-player">
        <p className="muted">⏳ 시간 밖에 있다. 오늘 하루는 당신의 것이 아니다.</p>
        <button disabled={busy} onClick={() => onAct({ type: 'wait', hours: 1 })}>
          시간 밖의 하루 흘려보내기
        </button>
      </div>
    );
  }

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
          disabled={busy}
          placeholder="무엇을 할까? (예: 조심스럽게 협곡 아래를 살핀다)"
          aria-label="행동 입력"
        />
        <button disabled={busy || !text.trim()}>하기</button>
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
      {world.regions
        .filter((r) => r.fetch && p.bonds?.includes(r.id))
        .map((r) => (
          <div key={r.id} className="row">
            <span className="muted">🧭 {josa(r.name, '을', '를')} 내어 주고 (생명 {r.fetch!.life}):</span>
            {fetchTargets(state, world, p, r.id).map((to) => (
              <button key={to.id} disabled={busy || !!stuck} onClick={() => onAct({ type: 'fetch', from: r.id, to: to.id })}>
                {placeName(world, to)}
              </button>
            ))}
            {fetchTargets(state, world, p, r.id).length === 0 && <span className="muted">찾을 땅이 없다</span>}
          </div>
        ))}
      {keeper && (
        <div className="row">
          <span className="muted">
            ⏳ {keeper.name} (맡겨 둔 날 {eonsIn(p, keeper.id)}):
          </span>
          <button
            disabled={busy || !!stuck || !!storeBlocked(state, world, p, keeper.id, state.minutes)}
            title={storeBlocked(state, world, p, keeper.id, state.minutes) ?? `${keeper.eon!.costText}. 내일 하루를 시간 밖에서 보낸다`}
            onClick={() => onAct({ type: 'store_day', land: keeper.id })}
          >
            하루 맡기기
          </button>
          <button
            disabled={busy || !!stuck || !!spendBlocked(state, world, p, keeper.id, state.minutes)}
            title={spendBlocked(state, world, p, keeper.id, state.minutes) ?? `${keeper.name}과의 유대가 끊기고, 내일은 나만 움직이는 하루`}
            onClick={() => onAct({ type: 'spend_day', land: keeper.id })}
          >
            하루 되찾기
          </button>
        </div>
      )}
      {people.some((a) => npcDef(state, world, a.id)?.hireable) && (
        <div className="row">
          <span className="muted">🪙 고용:</span>
          {people
            .filter((a) => npcDef(state, world, a.id)?.hireable)
            .map((a) => (
              <button
                key={a.id}
                disabled={busy || !!stuck || !!hireBlocked(state, world, p, a.id)}
                title={hireBlocked(state, world, p, a.id) ?? '값을 치르면 끝없이 당신을 따른다'}
                onClick={() => onAct({ type: 'hire', to: a.id })}
              >
                {shortName(a.name)} ({hirePrice(npcDef(state, world, a.id)!)}코인)
              </button>
            ))}
        </div>
      )}
      {grower && (
        <div className="row">
          <span className="muted">🌿 {grower.name}:</span>
          <button
            disabled={busy || !!stuck || !!growBlocked(state, world, p, grower.id, state.minutes)}
            title={
              growBlocked(state, world, p, grower.id, state.minutes) ??
              `오늘 새로 난 ${enteredToday(state, world, grower.growEntered!.color, state.minutes).map((x) => shortName(x.name)).join(', ')}에게 +1/+1`
            }
            onClick={() => onAct({ type: 'grow', land: grower.id })}
          >
            숲의 힘 불러내기
          </button>
        </div>
      )}
      {loremastersOf(state, world, p).length > 0 && (
        <div className="row">
          <span className="muted">📜 {shortName(loremastersOf(state, world, p)[0].name)}:</span>
          <button
            disabled={busy || !!stuck || !!recallBlocked(state, world, p, state.minutes)}
            title={recallBlocked(state, world, p, state.minutes) ?? `동료 ${recallCount(state, world, p)}만큼 숨은 것을 알게 된다`}
            onClick={() => onAct({ type: 'recall' })}
          >
            기억 빌리기
          </button>
        </div>
      )}
      {wardensOf(state, world, p).length > 0 && (
        <div className="row">
          <span className="muted">🕯️ {shortName(wardensOf(state, world, p)[0].name)}:</span>
          <button
            disabled={busy || !!stuck || !!shieldBlocked(state, world, p, p.id, state.minutes)}
            title={shieldBlocked(state, world, p, p.id, state.minutes) ?? '오늘 받을 다음 피해를 막는다 (영혼은 자정까지 묶임)'}
            onClick={() => onAct({ type: 'shield' })}
          >
            자신에게 가호
          </button>
        </div>
      )}
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
          <button
            type="button"
            className="danger"
            disabled={busy || !!stuck || !target}
            title={target ? `${shortName(target.name)} ${ptOf(target).join('/')} — 죽을 수 있다` : undefined}
            onClick={() => target && onAct({ type: 'attack', to: target.id })}
          >
            공격
          </button>
          {target && bitersOf(state, p, state.minutes).length > 0 && (
            <button
              type="button"
              className="danger"
              disabled={busy || !!stuck || !!biteBlocked(state, world, p, target.id, state.minutes)}
              title={biteBlocked(state, world, p, target.id, state.minutes) ?? `포식 충동: ${shortName(target.name)}와(과) 서로 공격력만큼 피해, 물어뜯은 이는 자정까지 묶임`}
              onClick={() => onAct({ type: 'bite', to: target.id })}
            >
              🦷 물어뜯기
            </button>
          )}
          {target && wardensOf(state, world, p).length > 0 && (
            <button
              type="button"
              disabled={busy || !!stuck || !!shieldBlocked(state, world, p, target.id, state.minutes)}
              title={shieldBlocked(state, world, p, target.id, state.minutes) ?? `${shortName(target.name)}이(가) 오늘 받을 다음 피해를 막는다`}
              onClick={() => onAct({ type: 'shield', to: target.id })}
            >
              🕯️ 가호
            </button>
          )}
          {target &&
            known.filter((s) => s.target !== 'self').map((s) => {
              const kick = !!s.kicker && !castBlocked(state, world, p, s.id, target.id, true, state.minutes);
              const why = castBlocked(state, world, p, s.id, target.id, false, state.minutes);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={harmful(s) ? 'danger' : ''}
                  disabled={busy || !!stuck || !!why}
                  title={why ?? `${shortName(target.name)}에게 ${s.name} ${s.costText}${kick ? ' (킥커 포함)' : ''}`}
                  onClick={() => onAct({ type: 'cast', spell: s.id, to: target.id, kick })}
                >
                  ✨ {s.name}
                </button>
              );
            })}
        </form>
      )}
      {known.some((s) => s.target === 'any_here' || s.target === 'self') && (
        <div className="row">
          {known
            .filter((s) => s.target === 'any_here' || s.target === 'self')
            .flatMap((s) => {
              const why = castBlocked(state, world, p, s.id, p.id, false, state.minutes);
              const label = s.target === 'self' ? s.name : `${s.name} (나에게)`;
              const plain = (
                <button key={s.id} disabled={busy || !!stuck || !!why} title={why ?? `${s.target === 'self' ? '' : '나에게 '}${s.name} ${s.costText}`} onClick={() => onAct({ type: 'cast', spell: s.id, to: p.id, kick: false })}>
                  ✨ {label}
                </button>
              );
              // A mana kicker is the player's choice: a second button.
              if (!s.kicker?.mana) return [plain];
              const whyKick = castBlocked(state, world, p, s.id, p.id, true, state.minutes);
              return [
                plain,
                <button key={`${s.id}-kick`} disabled={busy || !!stuck || !!whyKick} title={whyKick ?? `${s.name} ${s.costText} + 킥커 ${s.kicker.manaText}`} onClick={() => onAct({ type: 'cast', spell: s.id, to: p.id, kick: true })}>
                  ✨ {label} (킥커)
                </button>,
              ];
            })}
        </div>
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
                  {placeName(world, r)}
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
