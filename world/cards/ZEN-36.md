---
id: ZEN-36
order: 202
name_en: "Steppe Lynx"
name_ko: "초원 스라소니"
set: ZEN
number: 36
mana_cost: "{W}"
type_line: "Creature — Cat"
pt: "0/1"
rarity: common
artist: "Nic Klein"
scryfall: https://scryfall.com/card/zen/36/steppe-lynx
added: 2026-10-02
entities: [cre-steppe-lynx, loc-graypelt-refuge]
---

## 카드 원문

**규칙 텍스트**

> Landfall — Whenever a land you control enters, this creature gets +2/+2 until end of turn.

**플레이버 텍스트**

> Nothing quickens the predator's blood like the unfamiliar scents of new hunting grounds and the mewling cries of new prey.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 고양이 {W}, 0/1. 상륙: 당신의 대지가 들어올 때마다 이번 턴 +2/+2. [카드]
- 플레이버: 낯선 사냥터의 냄새와 새 먹잇감의 울음만큼 포식자의 피를 끓게 하는 것은 없다. [카드]
- 떠 있는 바위가 보이는 바람 부는 초원을 내달리는 스라소니. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 사는 곳: 그레이펠트 피난처 남동쪽 풀밭 (`home_pos: [0.4, 0.3]`). [결정] 2026-10-02, 방위는 [가공]
- 말하지 않는 짐승 (길들일 수 있음). 상륙 = 그가 유대를 맺을 때 (하그라 악어와 같은 기존 규칙). [가공]

## 반영 내역

- `cre-steppe-lynx` (새 생물, 한 마리): 그레이펠트 피난처 남동쪽, 0/1, 마나 백 1, 짐승, `landfall: { pt: [2, 2] }`.
- `loc-graypelt-refuge`, `cre-hagra-crocodile`: 링크.
- 새 규칙 없음.
