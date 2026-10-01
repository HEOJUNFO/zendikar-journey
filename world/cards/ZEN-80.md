---
id: ZEN-80
order: 131
name_en: "Blood Seeker"
name_ko: "피를 찾는 자"
set: ZEN
number: 80
mana_cost: "{1}{B}"
type_line: "Creature — Vampire Shaman"
pt: "1/1"
rarity: common
artist: "Greg Staples"
scryfall: https://scryfall.com/card/zen/80/blood-seeker
added: 2026-10-01
entities: [chr-blood-seeker, loc-malakir, cre-vampire]
---

## 카드 원문

**규칙 텍스트**

> Whenever a creature an opponent controls enters, you may have that player lose 1 life.

**플레이버 텍스트**

> A drop now is all he needs to find you later.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 생물 — 흡혈귀 주술사, 1/1. 상대가 조종하는 생물이 들어올 때마다 그 플레이어가 생명 1을 잃게 할 수 있다. [카드]
- 플레이버: 지금 한 방울이면, 나중에 너를 찾아낼 수 있다. [카드]
- 어둠 속, 칼날의 피를 손가락으로 훑으며 웃는 얼굴에 붉은 칠을 한 흡혈귀. [그림]
- 지명 없음, [새 지역 후보] 없음. 자리: 말라키르 북서쪽 골목. [결정] 2026-10-01 (방위는 [가공])
- 말하는 흡혈귀, 설득으로 권속 (다른 흡혈귀들처럼 먹지 않음). `creature: cre-vampire`.
- 상대 = 같은 칸의 남(그의 편이 아닌 이), 생물이 들어옴 = 새 권속이 듦(고용·설득·인정·되살림·태어난 토큰), "할 수 있다"는 늘. [가공]

## 반영 내역

- `chr-blood-seeker` (새 인물): 말라키르 `home_pos: [-0.3, -0.3]`, 1/1, 마나 흑 2, `creature: cre-vampire`, `drain_on_join: 1`.
- `loc-malakir`, `cre-vampire`: 링크.
- 새 규칙 `drain_on_join` (`sim/seeker.ts`, 매시간 끝 `step.ts`).
