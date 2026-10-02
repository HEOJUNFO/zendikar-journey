---
id: ZEN-21
order: 148
name_en: "Kor Outfitter"
name_ko: "코르 채비사"
set: ZEN
number: 21
mana_cost: "{W}{W}"
type_line: "Creature — Kor Soldier"
pt: "2/2"
rarity: common
artist: "Kieran Yanner"
scryfall: https://scryfall.com/card/zen/21/kor-outfitter
added: 2026-10-02
entities: [chr-kor-outfitter, loc-makindi]
---

## 카드 원문

**규칙 텍스트**

> When this creature enters, you may attach target Equipment you control to target creature you control.

**플레이버 텍스트**

> "We take only what we need to survive. Believe me, you will need this."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 코르 병사 {W}{W}, 2/2. 들어올 때 당신이 조종하는 장비 하나를 당신이 조종하는 생물에게 붙일 수 있다. [카드]
- 플레이버: "우리는 살아남는 데 필요한 것만 가져간다. 믿어라, 너는 이게 필요할 거다." [카드]
- 붉은 깃털, 푸른 얼굴 물감, 미늘 갑옷의 코르가 구리빛 통을 건넴. [그림]
- 지명 확인: 카드에 지명 없음, 코르의 본거지(마킨디 협곡)는 세계에 있음. [새 지역 후보] 없음.
- 사는 곳: 마킨디 협곡 북동쪽, 코르의 갈고리가 놓인 바위 곁(`home_pos: [0.4, -0.2]`). [결정] 2026-10-02, 방위는 [가공]
- 말하는 코르 병사 (설득 가능, 먹고 돈을 씀), 코르라 무장의 달인이 센다. [가공]
- 들어올 때 = 그날 첫 도착. 조종하는 이(주인, 없으면 자신)가 같은 칸에 있으면 그가 지닌 장비 하나를 그 칸의 자신이나 권속에게 값 없이 곧바로 맨다 (안 할 수도). 장비는 주인이 지니므로 주인이 함께 있어야 한다. [가공]

## 반영 내역

- `chr-kor-outfitter` (새 인물): 마킨디 협곡 북동쪽, 2/2, 마나 백 2, `types: [kor]`, `enter_equip`.
- `loc-makindi`, `itm-grappling-hook`, `chr-armament-master`: 링크.
- 새 능력 `enter_equip` (`sim/outfitter.ts`, 고를 것 `outfit`). `equipItem`·`equipBlocked` 가 값 없이 매는 길(`free`)을 받는다.
