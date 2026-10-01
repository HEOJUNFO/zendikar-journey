---
id: ZEN-56
order: 109
name_en: "Merfolk Wayfinder"
name_ko: "인어 길잡이"
set: ZEN
number: 56
mana_cost: "{2}{U}"
type_line: "Creature — Merfolk Scout"
pt: "1/2"
rarity: uncommon
artist: "Christopher Moeller"
scryfall: https://scryfall.com/card/zen/56/merfolk-wayfinder
added: 2026-10-01
entities: [chr-merfolk-wayfinder, loc-tazeem]
---

## 카드 원문

**규칙 텍스트**

> Flying
> When this creature enters, reveal the top three cards of your library. Put all Island cards revealed this way into your hand and the rest on the bottom of your library in any order.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 인어 정찰병, 1/2. 비행. 들어올 때 서고 맨 위 셋을 공개해 섬 카드는 모두 손으로, 나머지는 서고 밑에. [카드]
- 창을 든 인어 여전사가 촉수 달린 하늘 가오리를 타고 새 떼 사이를 난다. [그림]
- 타짐의 인어 → 타짐 본토 북서쪽 해안 하늘. [배경] ([결정] 2026-10-01, 방위는 [가공]). [새 지역 후보] 없음.
- 말하는 인어 정찰병, 설득으로 권속. [가공]
- 서고 맨 위 = 세계의 땅이 무작위로 드러남 (멀 다야의 신탁자와 같은 대응). 섬을 손으로 = 그 섬이 조종하는 이의 "손에 든 땅"이 되어, 언제든 멀리서 그날의 땅으로 유대를 맺을 수 있다 (쓸 때까지 간직). [결정] 2026-10-01

## 반영 내역

- `chr-merfolk-wayfinder` (새 인물): 타짐 `home_pos: [-0.55, -0.5]`, 1/2, 마나 청 3, `fly`, `types: [merfolk]`, `enter_reveal: { count: 3, land_type: island }`.
- `loc-tazeem`: 사는 인어 링크.
- 새 개념 손에 든 땅 `Actor.handLands` (`sim/oracle.ts` 의 `enterReveal`, `handBlocked`, `bondFromHand`), 길 찾기 `from: "hand"` (플레이어 행동, NPC 계획의 `fetch` 블록, 웹 패널).
