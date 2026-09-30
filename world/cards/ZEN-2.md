---
id: ZEN-2
order: 25
name_en: "Arrow Volley Trap"
name_ko: "화살 세례 함정"
set: ZEN
number: 2
mana_cost: "{3}{W}{W}"
type_line: "Instant — Trap"
rarity: uncommon
artist: "Steve Argyle"
scryfall: https://scryfall.com/card/zen/2/arrow-volley-trap
added: 2026-09-30
entities: [evt-arrow-volley-trap, loc-ondu, law-ruin-traps]
---

## 카드 원문

**규칙 텍스트**

> If four or more creatures are attacking, you may pay {1}{W} rather than pay this spell's mana cost.
> Arrow Volley Trap deals 5 damage divided as you choose among any number of target attacking creatures.

**플레이버 텍스트**

> (없음)

## 해석

- 빛이 쏟아지는 제단 위 분홍빛 보석, 둘레에 화살에 꿰뚫린 시신들 [그림]. 백색 함정, {3}{W}{W} [카드].
- 폐허의 함정 사건. 온두의 풀 언덕에 숨은 옛 보석 제단 [결정].
- 대체 비용 조건 "생물 넷 이상이 공격 중" → 같은 시간에 온두에서 넷 이상이 덤빌 때 [결정].
- 피해 5를 나눠 → 한 시간 뒤 LLM이 함정으로서 덤빈 이들 사이에 나눈다 [결정].

## 반영 내역

- `evt-arrow-volley-trap` (새 사건): 온두, `trigger: attacked`, `attackers: 4`, 효과 `volley {amount: 5}`.
- `loc-ondu`: 풀 언덕의 보석 제단과 함정.
- `law-ruin-traps`: 일곱 번째 함정.
- 엔진: 새 발동 `attacked`(`Actor.attackedAt`: 공격자로 한 합을 친 시간), 효과 `volley`(한 시간 뒤 LLM `volley` 로 나눔, `volleyShares`).
