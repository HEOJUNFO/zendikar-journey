---
id: ZEN-84
order: 27
name_en: "Bog Tatters"
name_ko: "늪의 누더기"
set: ZEN
number: 84
mana_cost: "{4}{B}"
type_line: "Creature — Wraith"
pt: "4/2"
rarity: common
artist: "Daarken"
scryfall: https://scryfall.com/card/zen/84/bog-tatters
added: 2026-09-30
entities: [cre-bog-tatters, loc-piranha-marsh]
---

## 카드 원문

**규칙 텍스트**

> Swampwalk (This creature can't be blocked as long as defending player controls a Swamp.)

**플레이버 텍스트**

> A wraith is a tale of brutal slaying told anew whenever it finds a victim.

## 해석

- 어두운 늪의 앙상한 나무 사이, 연기처럼 풀려 흩날리는 초록빛 망령 [그림]. 흑색 망령, 4/2 [카드].
- 피라냐 습지를 떠돈다 [결정]. 스스로 희생자를 찾는 망령: LLM이 하루 계획의 `attack` 으로 희생자를 고른다 [결정] (플레이버: 희생자를 찾을 때마다).
- 늪걷기 → 늪과 유대를 맺은 이는 맞받아치지 못한다 [결정]. 날아 피할 수는 있다 [결정] 2026-10-01 (처음엔 피하기도 막았다).

## 반영 내역

- `cre-bog-tatters` (새 생물종, 하나): 4/2, 흑 5, `needs: [energy]` (처음엔 `[]`, 2026-09-30 모든 존재가 지치게), `beast`, `swampwalk`.
- `loc-piranha-marsh`: 떠도는 망령.
- 엔진: 능력 `swampwalk`(`combat.ts` 의 `landwalked`: 늪과 유대한 상대는 맞받아치지 못함, 날아 피하기는 됨).
