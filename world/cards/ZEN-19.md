---
id: ZEN-19
order: 189
name_en: "Kor Duelist"
name_ko: "코르 결투가"
set: ZEN
number: 19
mana_cost: "{W}"
type_line: "Creature — Kor Soldier"
pt: "1/1"
rarity: uncommon
artist: "Izzy"
scryfall: https://scryfall.com/card/zen/19/kor-duelist
added: 2026-10-02
entities: [chr-kor-duelist, loc-sejiri-refuge]
---

## 카드 원문

**규칙 텍스트**

> As long as this creature is equipped, it has double strike. (It deals both first-strike and regular combat damage.)

**플레이버 텍스트**

> "Swords cannot reach far enough. Chains cannot strike hard enough. An eternal dilemma, but a simple one."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 코르 병사 {W}, 1/1. 장비를 매고 있는 동안 이중 타격. [카드]
- 플레이버: 칼은 멀리 닿지 못하고 사슬은 세게 치지 못한다 — 영원하지만 단순한 딜레마. [카드]
- 붉은 하늘 아래 낫 같은 칼과 사슬을 휘두르는 코르 전사. [그림]
- 코르는 밧줄·갈고리·사슬을 다루는 유목민. [배경] 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 사는 곳: 세지리 피난처 남동쪽 수련터 (`home_pos: [0.3, 0.3]`). [결정] 2026-10-02, 방위는 [가공]
- 장비를 매고 있는 동안 = 어떤 장비든 그가 맨 이(`bearer`)인 동안, 매시간 셈 (무장의 달인과 같은 때). [가공]

## 반영 내역

- `chr-kor-duelist` (새 인물): 세지리 피난처 남동쪽, 1/1, 마나 백 1, `types: [kor]`, `equipped_grant: [double_strike]`.
- `loc-sejiri-refuge`, `chr-armament-master`: 링크.
- 새 능력 `equipped_grant` (`sim/monument.ts` 의 `anthemHour`).
