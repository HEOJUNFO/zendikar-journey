---
id: ZEN-52
order: 71
name_en: "Living Tsunami"
name_ko: "살아 있는 해일"
set: ZEN
number: 52
mana_cost: "{2}{U}{U}"
type_line: "Creature — Elemental"
pt: "4/4"
rarity: uncommon
artist: "Matt Cavotta"
scryfall: https://scryfall.com/card/zen/52/living-tsunami
added: 2026-10-01
entities: [cre-living-tsunami, loc-silundi-coast]
---

## 카드 원문

**규칙 텍스트**

> Flying
> At the beginning of your upkeep, sacrifice this creature unless you return a land you control to its owner's hand.

**플레이버 텍스트**

> At low tide it slumbers. At high tide it devours.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 정령, 4/4, 비행. 유지 단계마다 내가 조종하는 땅 하나를 손으로 되돌리지 않으면 희생한다. [카드]
- 지명 확인: 지명 없음.
- 유지 단계 = 00:00. 땅을 손으로 = 그 땅과의 유대가 끊김 (다시 맺을 수 있다). 희생 = 해일이 무너져 죽음. 주인이 고른다. [가공]
- 주인 없는 해일은 대가가 없다 (바다 그 자체). 누군가를 섬길 때만 주인이 치른다. [결정] 2026-10-01
- 그래서 따를 이를 스스로 고르는 짐승(`tamable`)으로 둔다. [결정] 2026-10-01
- 성난 바다 위로 몸을 말아 올려 배를 삼키는 초록 물결. [그림]
- 실룬디 연안 (비행이라 깊은 바다가 아닌 물가). [가공] [결정] 2026-10-01
- 말하지 않는 짐승, 먹지 않고 지침. [가공]

## 반영 내역

- `cre-living-tsunami` (새 생물종, 하나): 실룬디 연안, 4/4, 청 4, `beast`, `tamable`, `fly`, `needs: [energy]`, `upkeep_return_land`.
- 새 능력 `sim.upkeep_return_land` (`sim/tide.ts` 의 `upkeepTide`, `answerTide`, 고를 것 `tide`: 플레이어는 `asks`, NPC는 LLM `pick`).
- `loc-silundi-coast`: 링크, 설명.
