// The operator's map (#/admin): everyone, every trap and every spell on the map, whatever the
// mode. Click a person, a trap, a spell or a land to see all of its state.
import { useState } from 'react';
import { PACE_LABELS } from '../sim/actions.ts';
import { formatClock, formatTimeOfDay, gameDay, minuteOfDay } from '../sim/clock.ts';
import { foesOf } from '../sim/combat.ts';
import { COLOR_LABELS, creatureColors, formatMana, manaAvailable, manaCapacity } from '../sim/mana.ts';
import { needsOf, npcDef } from '../sim/state.ts';
import type { Actor, LogEntry, State } from '../sim/state.ts';
import { josa, shortName } from '../sim/text.ts';
import { currentBlock } from '../sim/types.ts';
import { ABILITY_LABELS, placeName, region, spellColors } from '../sim/world.ts';
import type { Effect, EventDef, SpellDef, SpellEffect, World } from '../sim/world.ts';
import { MapView } from './MapView.tsx';
import { Bar, fighting, ObserverControls, RegionCard, status } from './panels.tsx';
import { isTrap, trapStatus } from './view.ts';
import type { TrapStatus } from './view.ts';

type Pick = { kind: 'actor' | 'trap' | 'spell' | 'region'; id: string };

type Props = {
  world: World;
  state: State | null;
  busy: boolean;
  error: string | null;
  onAdvance: (hours: number) => void;
};

const KIND_LABELS: Record<Actor['kind'], string> = { npc: 'NPC', player: '플레이어' };
const RECENT_LOG = 10;

export function AdminPage({ world, state, busy, error, onAdvance }: Props) {
  const [pick, setPick] = useState<Pick | null>(null);
  const traps = world.events.filter(isTrap);
  const actors = state ? Object.values(state.actors) : [];
  const picked = pick && pick.kind !== 'region' ? pick.id : null;
  const regionId = pick?.kind === 'region' ? pick.id : null;

  return (
    <main className="admin-layout">
      <section className="pane admin-map-pane">
        <MapView world={world} state={state} selected={regionId} onSelect={(id) => setPick({ kind: 'region', id })} all
          picked={picked} onPickActor={(id) => setPick({ kind: 'actor', id })} onPickTrap={(id) => setPick({ kind: 'trap', id })}
          onPickSpell={(id) => setPick({ kind: 'spell', id })} />
        <p className="muted admin-legend">
          <span className="dot dot-npc" /> NPC <span className="dot dot-legend" /> 능력을 지닌 이 <span className="dot dot-player" /> 플레이어
          <span className="diamond diamond-armed" /> 함정 (대기) <span className="diamond diamond-omen" /> 전조 <span className="diamond diamond-cooldown" /> 재발동 대기
          <span className="spell-dot spell-multi" /> 주문 (배우는 곳, 마나 색)
        </p>
        {error && <p className="error">{error}</p>}
        {busy && <p className="muted working">시간이 흐르는 중…</p>}
        {state?.mode === 'observer' && <ObserverControls busy={busy} onAdvance={onAdvance} />}
        {!state && <p className="muted">아직 게임이 없다. 함정과 땅만 보인다.</p>}
      </section>
      <aside className="pane side-pane">
        {pick?.kind === 'actor' && state?.actors[pick.id] && (
          <ActorDetail world={world} state={state} a={state.actors[pick.id]} onRegion={(id) => setPick({ kind: 'region', id })} />
        )}
        {pick?.kind === 'trap' && traps.some((e) => e.id === pick.id) && (
          <TrapDetail world={world} state={state} ev={traps.find((e) => e.id === pick.id)!}
            onRegion={(id) => setPick({ kind: 'region', id })} onActor={(id) => setPick({ kind: 'actor', id })} />
        )}
        {pick?.kind === 'spell' && world.spells.some((s) => s.id === pick.id) && (
          <SpellDetail world={world} state={state} sp={world.spells.find((s) => s.id === pick.id)!}
            onRegion={(id) => setPick({ kind: 'region', id })} onActor={(id) => setPick({ kind: 'actor', id })} />
        )}
        {regionId && <RegionCard world={world} state={state} regionId={regionId} all />}
        {!pick && <p className="muted">지도에서 인물, 함정(◆), 주문(✦), 땅을 누르면 여기에 자세히 나온다.</p>}
        <section className="card">
          <h2>함정 <small>{traps.length}</small></h2>
          {traps.length === 0 && <p className="muted">아직 함정이 없다.</p>}
          <ul className="region-list">
            {traps.map((ev) => (
              <li key={ev.id}>
                <button className={`ghost${picked === ev.id ? ' on' : ''}`} onClick={() => setPick({ kind: 'trap', id: ev.id })}>
                  <span className={`diamond diamond-${trapStatus(state, ev).kind}`} />
                  {ev.name}
                  <small className="muted"> · {placeName(world, region(world, ev.region))} · {statusText(trapStatus(state, ev))}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>주문 <small>{world.spells.length}</small></h2>
          {world.spells.length === 0 && <p className="muted">아직 주문이 없다.</p>}
          <ul className="region-list">
            {world.spells.map((sp) => (
              <li key={sp.id}>
                <button className={`ghost${picked === sp.id ? ' on' : ''}`} onClick={() => setPick({ kind: 'spell', id: sp.id })}>
                  <span className={`spell-dot spell-${spellClass(sp)}`} />
                  {sp.name}
                  <small className="muted"> · {sp.costText} · {placeName(world, region(world, sp.learnAt))}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {state && (
          <section className="card">
            <h2>인물 <small>{actors.filter((a) => !a.dead).length}명 살아 있음</small></h2>
            <ul className="region-list">
              {actors.map((a) => (
                <li key={a.id}>
                  <button className={`ghost${picked === a.id ? ' on' : ''}`} onClick={() => setPick({ kind: 'actor', id: a.id })}>
                    <span className={`dot dot-${a.kind}`} />
                    {a.dead ? '✝ ' : ''}
                    {shortName(a.name)}
                    <small className="muted"> · {a.dead ? '죽음' : region(world, a.travel?.to ?? a.region).name}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </main>
  );
}

// --- a person ----------------------------------------------------------------------------

function ActorDetail({ world, state, a, onRegion }: { world: World; state: State; a: Actor; onRegion: (id: string) => void }) {
  const t = state.minutes;
  const def = a.kind === 'npc' ? npcDef(state, world, a.id) : undefined;
  const powers = def?.activated ?? [];
  const token = !!state.tokens?.[a.id];
  const foes = foesOf(a, t);
  const block = a.schedule?.day === gameDay(t) ? currentBlock(a.schedule.blocks, minuteOfDay(t)) : undefined;
  const uses = state.gm.day === gameDay(t) ? (state.gm.uses ?? []).filter((u) => u.being === a.id) : [];
  const landfalls = a.landfalls?.day === gameDay(t) ? a.landfalls.regions : [];
  const name = (id: string) => shortName(state.actors[id]?.name ?? id);

  return (
    <section className="card">
      <h2>
        {a.dead ? '✝ ' : ''}
        {a.name} <small>{KIND_LABELS[a.kind]}{token ? ' · 게임 중 생김' : ''}{a.master ? ` · ${name(a.master)}의 권속` : ''} · {fighting(a, t)}</small>
      </h2>
      <p className="muted admin-id">{a.id}</p>
      {def?.summary && <p>{def.summary}</p>}
      <p>{status(world, a)}</p>
      <button className="ghost admin-goto" onClick={() => onRegion(a.region)}>
        {placeName(world, region(world, a.region))} 보기
      </button>
      {a.travel && <p className="muted">{formatClock(a.travel.arrive)} 도착 예정</p>}
      {a.forced && <p className="cond">강제: {a.forced.emoji} {a.forced.activity}{a.forced.until ? ` (${formatClock(a.forced.until)}까지)` : ''}</p>}
      {foes.length > 0 && <p className="cond">적: {foes.map(name).join(', ')}</p>}

      {needsOf(a).includes('energy') && <Bar label="기력" value={a.stats.energy} />}
      {needsOf(a).includes('hunger') && <Bar label="배고픔" value={a.stats.hunger} bad />}
      {needsOf(a).includes('coin') && (
        <div className="bar">
          <span>돈</span>
          <span />
          <b>{Math.round(a.stats.coin)}</b>
        </div>
      )}
      <dl className="admin-facts">
        <dt>걸음</dt>
        <dd>{PACE_LABELS[a.pace]}</dd>
        <dt>능력</dt>
        <dd>{a.abilities.length ? a.abilities.map((x) => ABILITY_LABELS[x]).join(', ') : '없음'}</dd>
        {def && (
          <>
            <dt>색</dt>
            <dd>{creatureColors(def).map((c) => COLOR_LABELS[c]).join('') || '무색'}</dd>
          </>
        )}
        <dt>마나</dt>
        <dd>
          {formatMana(manaAvailable(state, world, a, t))} <small className="muted">/ 하루 {formatMana(manaCapacity(state, world, a, t))}</small>
        </dd>
        {a.loyalty !== undefined && (
          <>
            <dt>기세</dt>
            <dd>{a.loyalty}{a.loyaltyDay === gameDay(t) ? ' (오늘 씀)' : ''}</dd>
          </>
        )}
        {(a.spells?.length || a.graveyard?.length) ? (
          <>
            <dt>주문</dt>
            <dd>
              {(a.spells ?? []).map((id) => world.spells.find((s) => s.id === id)?.name ?? id).join(', ') || '없음'}
              {a.graveyard?.length ? <small className="muted"> · 잊은 것: {a.graveyard.map((id) => world.spells.find((s) => s.id === id)?.name ?? id).join(', ')}</small> : null}
            </dd>
          </>
        ) : null}
        <dt>유대</dt>
        <dd>{a.bonds?.length ? a.bonds.map((id) => region(world, id).name).join(', ') : '없음'}</dd>
        {Object.values(state.items ?? {}).some((x) => x.owner === a.id) && (
          <>
            <dt>길들인 것</dt>
            <dd>{Object.values(state.items ?? {}).filter((x) => x.owner === a.id).map((x) => `${x.name} (담긴 생명 ${x.counters})`).join(', ')}</dd>
          </>
        )}
        {landfalls.length > 0 && (
          <>
            <dt>오늘 상륙</dt>
            <dd>{landfalls.map((id) => region(world, id).name).join(' → ')}</dd>
          </>
        )}
        {def && (
          <>
            <dt>역할</dt>
            <dd>{def.role}</dd>
            <dt>거처</dt>
            <dd>{placeName(world, region(world, def.home))}</dd>
            <dt>성격</dt>
            <dd>{def.persona}</dd>
            <dt>목표</dt>
            <dd>{def.goal}</dd>
          </>
        )}
        {a.relations && Object.keys(a.relations).length > 0 && (
          <>
            <dt>아는 이</dt>
            <dd>
              {Object.values(a.relations)
                .sort((x, y) => y.t - x.t)
                .map((r) => (
                  <div key={r.name + r.t}>
                    <b>{r.name}</b>: {r.text} <small className="muted">({formatClock(r.t)})</small>
                  </div>
                ))}
            </dd>
          </>
        )}
        {a.background && (
          <>
            <dt>배경</dt>
            <dd>{a.background}</dd>
          </>
        )}
        {a.dead && (
          <>
            <dt>죽음</dt>
            <dd>{formatClock(a.dead.at)} · {a.dead.cause}</dd>
          </>
        )}
      </dl>

      {powers.length > 0 && (
        <>
          <h3 className="admin-sub">능력</h3>
          <ul className="admin-list">
            {powers.map((x) => (
              <li key={x.id}>
                {x.name} <small className="muted">{x.costText}{x.tap ? ', 탭' : ''}</small>
              </li>
            ))}
          </ul>
          {uses.length > 0 && (
            <p className="muted">
              오늘 쓸 능력 (아침 LLM): {uses.map((u) => `${String(u.hour).padStart(2, '0')}시 ${powers.find((x) => x.id === u.ability)?.name ?? u.ability}${u.target ? ` → ${name(u.target)}` : ''}`).join(', ')}
            </p>
          )}
        </>
      )}

      {a.schedule && a.schedule.day === gameDay(t) && (
        <>
          <h3 className="admin-sub">오늘 일정 <small className="muted">{a.schedule.source === 'llm' ? 'LLM' : '예전 저장의 평소 일과'}</small></h3>
          <ul className="admin-list">
            {a.schedule.blocks.map((b) => (
              <li key={b.start} className={b === block ? 'on' : ''}>
                <time>{formatTimeOfDay(b.start)}–{formatTimeOfDay(b.end)}</time> {b.emoji} {b.activity}{' '}
                <small className="muted">{region(world, b.regionId).name}</small>
              </li>
            ))}
          </ul>
        </>
      )}

      <RecentLog entries={state.log.filter((e) => e.actors.includes(a.id))} />
    </section>
  );
}

// --- a trap ------------------------------------------------------------------------------

function TrapDetail(props: { world: World; state: State | null; ev: EventDef; onRegion: (id: string) => void; onActor: (id: string) => void }) {
  const { world, state, ev, onRegion, onActor } = props;
  const s = trapStatus(state, ev);
  const last = state?.events[ev.id]?.lastFired;
  const pending = state?.pending.find((p) => p.eventId === ev.id);
  const here = state ? Object.values(state.actors).filter((a) => !a.dead && !a.travel && a.region === ev.region) : [];

  return (
    <section className="card">
      <h2>
        ◆ {ev.name} <small>함정</small>
      </h2>
      <p className="muted admin-id">{ev.id}</p>
      <p>{ev.summary}</p>
      <p className={s.kind === 'armed' ? '' : 'cond'}>상태: {statusText(s)}</p>
      <button className="ghost admin-goto" onClick={() => onRegion(ev.region)}>
        {placeName(world, region(world, ev.region))} 보기
      </button>
      <dl className="admin-facts">
        <dt>발동</dt>
        <dd>{triggerText(ev)}</dd>
        <dt>범위</dt>
        <dd>{ev.range ? `반경 ${ev.range}` : '그 땅만'} · 소식은 {ev.scope === 'world' ? '온 세상에' : '그 땅에만'}</dd>
        <dt>재발동</dt>
        <dd>{ev.cooldownHours ? `${ev.cooldownHours}시간 뒤` : '바로'}</dd>
        <dt>마지막</dt>
        <dd>{last !== undefined ? formatClock(last) : '발동한 적 없음'}</dd>
        {pending && (
          <>
            <dt>일으킨 이</dt>
            <dd>{pending.by.length ? pending.by.map((id) => shortName(state?.actors[id]?.name ?? id)).join(', ') : '(없음)'}</dd>
          </>
        )}
        {ev.cost && (
          <>
            <dt>비용</dt>
            <dd>{josa(shortName(state?.actors[ev.cost.by]?.name ?? ev.cost.by), '이', '가')} {ev.cost.text}를 치른다</dd>
          </>
        )}
        <dt>효과</dt>
        <dd>{ev.effects.map(effectText).join(' · ')}</dd>
        {ev.omen && (
          <>
            <dt>전조</dt>
            <dd>{ev.omen}</dd>
          </>
        )}
        <dt>서술</dt>
        <dd>{ev.text}</dd>
      </dl>
      {here.length > 0 && (
        <p className="muted">
          지금 그 땅에:{' '}
          {here.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              <button className="link" onClick={() => onActor(a.id)}>{shortName(a.name)}</button>
            </span>
          ))}
        </p>
      )}
      {state && <RecentLog entries={state.log.filter((e) => (e.kind === 'omen' && e.text === ev.omen) || (e.kind === 'event' && e.text === ev.text))} title="발동 기록" />}
    </section>
  );
}

// --- a spell -----------------------------------------------------------------------------

function SpellDetail(props: { world: World; state: State | null; sp: SpellDef; onRegion: (id: string) => void; onActor: (id: string) => void }) {
  const { world, state, sp, onRegion, onActor } = props;
  const actors = state ? Object.values(state.actors) : [];
  const knowers = actors.filter((a) => !a.dead && a.spells?.includes(sp.id));
  const forgot = actors.filter((a) => !a.dead && a.graveyard?.includes(sp.id));
  const bearers = actors.filter((a) => !a.dead && a.auras?.some((x) => x.spell === sp.id));
  const people = (list: typeof actors) =>
    list.map((a, i) => (
      <span key={a.id}>
        {i > 0 && ', '}
        <button className="link" onClick={() => onActor(a.id)}>{shortName(a.name)}</button>
      </span>
    ));

  return (
    <section className="card">
      <h2>
        ✦ {sp.name} <small>주문 · {spellColors(sp).map((c) => `${COLOR_LABELS[c]}`).join('')}{spellColors(sp).length ? '' : '무색'}</small>
      </h2>
      <p className="muted admin-id">{sp.id}</p>
      {sp.summary && <p>{sp.summary}</p>}
      <button className="ghost admin-goto" onClick={() => onRegion(sp.learnAt)}>
        {placeName(world, region(world, sp.learnAt))} 보기
      </button>
      <dl className="admin-facts">
        <dt>비용</dt>
        <dd>{sp.costText}</dd>
        <dt>속도</dt>
        <dd>{sp.speed === 'instant' ? '순간마법 (언제든)' : '집중마법 (할 일이 없을 때만)'}</dd>
        <dt>대상</dt>
        <dd>{sp.target === 'self' ? '없음 (시전자 자신의 것)' : sp.target === 'any_here' ? '같은 곳의 누구든 (자신도)' : '같은 곳의 다른 한 사람'}</dd>
        <dt>배우기</dt>
        <dd>{placeName(world, region(world, sp.learnAt))}에서 {sp.learnHours}시간</dd>
        {sp.kicker && (
          <>
            <dt>킥커</dt>
            <dd>{sp.kicker.tap ? `권속 ${world.lore.find((x) => x.id === sp.kicker!.tap)?.name ?? sp.kicker.tap} 하나를 탭` : `마나 ${sp.kicker.manaText} 더`}</dd>
          </>
        )}
        <dt>효과</dt>
        <dd>{sp.effects.map(spellEffectText).join(' · ')}</dd>
        {state && (
          <>
            <dt>아는 이</dt>
            <dd>{knowers.length ? people(knowers) : '없음'}</dd>
          </>
        )}
        {forgot.length > 0 && (
          <>
            <dt>무덤</dt>
            <dd>{people(forgot)}</dd>
          </>
        )}
        {bearers.length > 0 && (
          <>
            <dt>걸린 이</dt>
            <dd>{people(bearers)}</dd>
          </>
        )}
      </dl>
      {state && <RecentLog entries={state.log.filter((e) => e.text.includes(sp.name))} />}
    </section>
  );
}

function spellClass(sp: SpellDef) {
  const colors = spellColors(sp);
  return colors.length === 1 ? colors[0] : colors.length ? 'multi' : 'C';
}

function spellEffectText(e: SpellEffect) {
  switch (e.type) {
    case 'lose_half_life':
      return '대상이 생명의 절반(올림)을 잃음';
    case 'gain_life_lost':
      return `잃은 만큼 시전자가 생명을 얻음${e.if_kicked ? ' (킥커 시)' : ''}`;
    case 'aura':
      return `오라: ${e.base_pt ? `기본 ${e.base_pt.join('/')}` : `${signed(e.pt[0])}/${signed(e.pt[1])}`}${e.abilities.length ? `, ${e.abilities.join(', ')}` : ''}${e.double_life_on_hit ? ', 전투 피해를 주면 조종자의 생명 두 배' : ''}${e.no_untap ? ', 묶이면 00:00에 풀리지 않음' : ''}${e.regenerate ? `, 재생 ${e.regenerate}` : ''}`;
    case 'copy_if_kicked':
      return '킥커 시 같은 곳의 다른 하나에게 하나 더 (값 없이)';
    case 'destroy_land':
      return '대상이 가장 최근에 유대를 맺은 땅이 부서짐';
    case 'discard':
      return '대상이 지닌 주문 하나를 잊음 (본인이 고름)';
    case 'discard_per_land':
      return `시전자가 쥔 ${e.land}마다 대상이 주문 하나를 잊음`;
    case 'damage_per_land':
      return `시전자가 쥔 ${e.land}마다 대상에게 피해 1`;
    case 'gain_life_per_land':
      return `시전자가 쥔 ${e.land}마다 생명 ${e.amount}`;
    case 'destroy_relics':
      return `그 자리의 마법물체·부여마법 ${e.count}까지 파괴 (첫째는 반드시)`;
    case 'create_retainers':
      return `${e.pt.join('/')} 권속 ${e.count}${e.kicked_count ? ` (킥커 시 ${e.kicked_count})` : ''}${e.abilities?.length ? `, ${e.abilities.join(', ')}` : ''}${e.until_midnight ? ', 자정에 사라짐' : ''}${e.kicked_pump ? ` (킥커 시 +${e.kicked_pump.join('/+')})` : ''}`;
    case 'hunt_creatures':
      return `모르는 비밀 ${e.count}을 더듬어 생물의 자취만 앎`;
    case 'destroy_all':
      return '같은 칸의 모두를 파괴 (시전자도, 플레인즈워커 빼고)';
    case 'demolish':
      return '그 칸의 마법물체나 땅 하나를 골라 파괴';
    case 'exile_library':
      return `대상이 아직 익히지 않은 주문 ${e.count}${e.kicked_count ? ` (킥커 시 ${e.kicked_count})` : ''}까지 골라 추방 (영영 못 익힘)`;
    case 'pump_target':
      return `대상 생물 자정까지 +${e.pt.join('/+')}${e.abilities.length ? `, ${e.abilities.join(', ')}` : ''}`;
    case 'grim_discovery':
      return '무덤의 생물 하나를 되살리고(자유롭게) 무덤의 땅 하나를 손에 (하나 또는 둘 다)';
    case 'return_own':
      return '조종하는 것(자신·곁의 권속, 쥔 땅, 아이템, 건 오라) 하나를 되돌림';
    case 'return_nonland':
      return '같은 칸의 땅 아닌 것(존재, 아이템, 오라) 하나를 되돌림 (남의 존재는 내동댕이쳐져 1시간 기절)';
    case 'weaken_controlled':
      return `대상과 곁의 그 권속들 자정까지 ${e.pt.join('/')}${e.kicked_pt ? ` (킥커 시 ${e.kicked_pt.join('/')})` : ''}`;
    case 'damage_grounded':
      return `같은 칸의 날지 못하는 모두(시전자도)에게 피해 ${e.amount}`;
    case 'exile_until':
      return '대상 생물을 어디에도 없는 곳으로 (시전자가 지닌 이 부여마법이 사라지면 돌아옴)';
    case 'draw':
      return `${e.if_kicked ? '킥커 시 ' : ''}시전자가 비밀 ${e.count}을 앎`;
    case 'gain_life':
      return `시전자가 생명 ${e.amount}을 얻음`;
  }
}

function RecentLog({ entries, title = '최근 기록' }: { entries: LogEntry[]; title?: string }) {
  if (!entries.length) return null;
  return (
    <>
      <h3 className="admin-sub">{title}</h3>
      {entries.slice(-RECENT_LOG).map((e) => (
        <div key={e.id} className={`log-line log-${e.kind}`}>
          <time>{formatClock(e.t)}</time>
          <span>{e.text}</span>
        </div>
      ))}
    </>
  );
}

function statusText(s: TrapStatus) {
  if (s.kind === 'omen') return `전조 — ${formatClock(s.at)}에 터진다`;
  if (s.kind === 'cooldown') return `재발동 대기 (${formatClock(s.until)}까지)`;
  return '대기 중';
}

function triggerText(ev: EventDef) {
  // `enter` traps arrive with ZEN-105; compared as text so this works before and after.
  const trigger = ev.trigger as string;
  if (trigger === 'landfall') return `그 땅과 유대를 맺을 때, 그날 ${ev.landfalls ?? 1}번째 이상의 상륙이면`;
  if (trigger === 'enter') {
    const gained = (ev as EventDef & { gained_life?: boolean }).gained_life;
    return `누군가 그 땅에 들어오면${gained ? ' (그날 생명을 얻은 이만)' : ''}`;
  }
  return trigger;
}

function effectText(e: Effect) {
  switch (e.type) {
    case 'damage':
      return `그곳 모두에게 피해 ${e.amount}`;
    case 'stat':
      return [
        e.energy !== undefined && `기력 ${signed(e.energy)}`,
        e.hunger !== undefined && `배고픔 ${signed(e.hunger)}`,
        e.coin !== undefined && `돈 ${signed(e.coin)}`,
      ].filter(Boolean).join(', ');
    case 'tap':
      return `최대 ${e.max}개 탭 (${e.land_label})${e.skip_untap ? ', 다음 언탭 건너뜀' : ''}`;
    case 'condition':
      return `상태 "${e.label}" ${e.hours}시간${e.blocks_travel ? ', 통행 막힘' : ''}`;
    case 'destroy_lands':
      return `일으킨 이가 오늘 상륙한 땅 ${e.count}개 파괴`;
    default: {
      const other = e as { type: string; amount?: number };
      if (other.type === 'lose_life') return `일으킨 이가 생명 ${other.amount} 잃음`;
      return other.type;
    }
  }
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
