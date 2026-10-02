---
id: ZEN-30
order: 155
name_en: "Ondu Cleric"
name_ko: "온두 성직자"
set: ZEN
number: 30
mana_cost: "{1}{W}"
type_line: "Creature — Kor Cleric Ally"
pt: "1/1"
rarity: common
artist: "Jim Murray"
scryfall: https://scryfall.com/card/zen/30/ondu-cleric
added: 2026-10-02
entities: [chr-ondu-cleric, loc-kabira-crossroads, law-allies, law-life]
---

## 카드 원문

**규칙 텍스트**

> Whenever this creature or another Ally you control enters, you may gain life equal to the number of Allies you control.

**플레이버 텍스트**

> A cleric's true balm is the confidence he inspires in his compatriots.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 코르 성직자 동료 {1}{W}, 1/1. 이것이나 다른 동료가 들어올 때마다 당신이 조종하는 동료 수만큼 생명을 얻을 수 있다. [카드]
- 플레이버: "성직자의 참된 약은 그가 동료들에게 북돋는 믿음이다." [카드]
- 푸른 빛의 고리 속에서 동료에게 손을 뻗는 긴 검은 머리의 코르. [그림]
- 지명 확인: 이름의 온두는 세계에 있음. [새 지역 후보] 없음.
- 사는 곳: 온두의 카비라 교차로 북동쪽 치유소(`home_pos: [0.3, -0.3]`). [결정] 2026-10-02, 방위는 [가공]
- 말하는 코르, 열여덟 번째 동료. 설득하거나 20코인(마나 값 2 × 10)에 고용. 코르라 무장의 달인이 센다. [가공]
- 생명은 무리의 주인이 얻고 늘 얻음 ("may"). [가공]

## 반영 내역

- `chr-ondu-cleric` (새 인물): 카비라 교차로, 1/1, 마나 백 2, `types: [kor]`, `ally`, `hireable`, `rally: gain_life_allies`.
- `loc-kabira-crossroads`, `law-allies`, `law-life`, `chr-kabira-evangel`: 링크.
- 새 무리 발동 `gain_life_allies` (`sim/allies.ts`).
