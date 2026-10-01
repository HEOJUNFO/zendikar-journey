---
id: ZEN-94
order: 64
name_en: "Hagra Crocodile"
name_ko: "하그라 악어"
set: ZEN
number: 94
mana_cost: "{3}{B}"
type_line: "Creature — Crocodile"
pt: "3/1"
rarity: common
artist: "Daren Bader"
scryfall: https://scryfall.com/card/zen/94/hagra-crocodile
added: 2026-10-01
entities: [cre-hagra-crocodile, loc-hagra]
---

## 카드 원문

**규칙 텍스트**

> This creature can't block.
> Landfall — Whenever a land you control enters, this creature gets +2/+2 until end of turn.

**플레이버 텍스트**

> The creatures of Zendikar are opportunists, eating whatever is available to them. Like goblins. Or boats.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 악어, 3/1. 막을 수 없다. 상륙할 때마다 턴 끝까지 +2/+2. [카드]
- 막을 수 없다 = 주인을 지키지 못함: 주인에게 먼저 덤빈 이에게는 함께 맞서지 않고, 주인이 먼저 덤빈 싸움에만 낀다. 자기에게 덤빈 이에게 맞받아치는 것은 그대로. [결정] 2026-10-01
- 상륙 +2/+2 = 땅과 유대를 맺은 날 00:00까지 +2/+2 (발로스와 같은 `landfall`). [카드]
- 병든 초록빛 늪물에서 검은 악어가 아가리를 벌리고, 조각배의 고블린이 노를 쳐들어 맞선다. [그림]
- 하그라 늪에 산다 (이름). 굴 드라즈를 덮은 썩은 늪. [배경]
- 늪 동쪽 가장자리, 무너진 저수조 폐허의 물가. [가공] [결정] 2026-10-01
- 말하지 않는 짐승. 먹고(가리지 않음, 플레이버), 배고프면 곁의 가장 약한 이를 덮친다. [가공]

## 반영 내역

- `cre-hagra-crocodile` (새 생물종, 하나): 하그라 늪 `home_pos: [0.7, 0.2]`, 3/1, 흑 4, `beast`, `needs: [energy, hunger]`, `abilities: [cant_block]`, `landfall: { pt: [2, 2] }`.
- 새 능력 `cant_block` (막지 못함): 권속이 주인의 적에게 함께 덤빌 때, 주인에게 먼저 덤빈 이(`Actor.foes.struck`: 싸움이 붙을 때 아직 적이 아니던 공격자)는 빼고 (`combat.ts` 의 `hostileNpcs`).
- `loc-hagra`: 링크.
