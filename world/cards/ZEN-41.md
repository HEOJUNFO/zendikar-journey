---
id: ZEN-41
order: 24
name_en: "Archive Trap"
name_ko: "기록보관소 함정"
set: ZEN
number: 41
mana_cost: "{3}{U}{U}"
type_line: "Instant — Trap"
rarity: rare
artist: "Jason Felix"
scryfall: https://scryfall.com/card/zen/41/archive-trap
added: 2026-09-30
entities: [evt-archive-trap, loc-jwar-isle, law-ruin-traps]
---

## 카드 원문

**규칙 텍스트**

> If an opponent searched their library this turn, you may pay {0} rather than pay this spell's mana cost.
> Target opponent mills thirteen cards.

**플레이버 텍스트**

> (없음)

## 해석

- 책이 빽빽한 거대한 서가 사이, 무너지는 천장에서 바위가 쏟아지고 한 사람이 팔을 들어 막는다 [그림]. 청색 함정, {3}{U}{U} [카드].
- 폐허의 함정 사건. 즈와르 섬 안쪽에 묻힌 옛 기록보관소 [결정], 스핑크스가 지키는 기록 [가공].
- 대체 비용 조건 "상대가 이번 턴에 서고를 뒤졌다" → 그날 페치로 땅을 찾아온 이가 들어선다 (페치 = 서고에서 대지를 찾음).
- 밀 13장 → 아는 이들에 대한 기억(인상) 13개를 잃는다 [결정]. 12명까지만 기억하니 사실상 모두. 플레이어는 인상을 기록하지 않으니, 대신 플레이어를 아는 이 13명까지가 플레이어를 잊는다 [결정].

## 반영 내역

- `evt-archive-trap` (새 사건): 즈와르 섬, `trigger: enter`, `searched: true`, 효과 `forget {count: 13}`.
- `loc-jwar-isle`: 묻힌 기록보관소와 함정.
- `law-ruin-traps`: 여섯 번째 함정.
- 엔진: 서고를 뒤진 날(`Actor.searched`, 페치할 때), 효과 `forget`(`relations.ts` 의 `forget`: 무작위 N개 인상을 지움).
