---
id: ZEN-24
order: 37
name_en: "Landbind Ritual"
name_ko: "대지 결속 의식"
set: ZEN
number: 24
mana_cost: "{3}{W}{W}"
type_line: "Sorcery"
rarity: uncommon
artist: "Steve Prescott"
scryfall: https://scryfall.com/card/zen/24/landbind-ritual
added: 2026-09-30
entities: [spl-landbind-ritual, loc-arid-mesa, law-life]
---

## 카드 원문

**규칙 텍스트**

> You gain 2 life for each Plains you control.

**플레이버 텍스트**

> "Honor this place, for our children's children will stand here and speak these same words again."
> —Ayli, Kamsa cleric

## 해석

- 코르 여인들이 바람 부는 초록 풀 언덕에 줄지어 서서 흙과 풀이 붙은 땅 덩이를 안거나 하늘로 들어 올린다. 먼 하늘에 떠 있는 바위 [그림]. 백색 집중마법 [카드].
- 캄사의 사제 아일리의 말: 아이들의 아이들이 여기 서서 같은 말을 하리라 [카드 플레이버] (아일리는 엘드라지 기념비 플레이버에도 나온다). 떠도는 코르가 돌아올 성지를 기리는 의식 [배경][가공].
- 온두에서 배운다 [결정]. 대상 없이 시전자의 것, 유대를 맺은 평원(부서진 것 빼고)마다 생명 2 [카드][결정].

## 반영 내역

- `spl-landbind-ritual` (새 주문): 온두, {3}{W}{W}, `target: self`, `gain_life_per_land` (평원, 2).
- `loc-ondu`, `law-life`: 연결.
- 엔진: 주문 효과 `gain_life_per_land` (`spells.ts` 의 `landsOfType`).
