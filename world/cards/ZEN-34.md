---
id: ZEN-34
order: 44
name_en: "Shepherd of the Lost"
name_ko: "길 잃은 자의 목자"
set: ZEN
number: 34
mana_cost: "{4}{W}"
type_line: "Creature — Angel"
pt: "3/3"
rarity: uncommon
artist: "Kekai Kotaki"
scryfall: https://scryfall.com/card/zen/34/shepherd-of-the-lost
added: 2026-09-30
entities: [cre-shepherd-of-the-lost, loc-emeria, chr-iona, cre-halo-hunter]
---

## 카드 원문

**규칙 텍스트**

> Flying, first strike, vigilance

**플레이버 텍스트**

> "Should you fall in the wilds, lift your voice to the Sky Realm. The one who answers will be your salvation."
> —Emeria's Creed

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 천사다. 3/3, 비행·선제공격·경계. [카드]
- 큰 날개를 펴고 황무지 위를 낮게 난다. 둥근 고리가 달린 긴 목자의 지팡이를 들었고, 눈가를 빛이 가린다. [그림]
- 에메리아의 신조: 광야에서 쓰러진 이가 하늘에 부르짖으면 답하는 이가 구원이 된다. 이 천사가 그 답하는 이다. [카드] 플레이버
- 젠디카르의 천사들은 에메리아를 섬긴다. [배경]
- 전설이 아닌 생물이라 생물종으로 두고 한 개체가 산다. [가공]
- 에메리아에서 이오나와 함께 산다. [결정] 2026-09-30
- 쓰러진 이를 구하는 사명은 페르소나에만 쓴다. [결정] 2026-09-30
- 선제공격: 한쪽만 지니면 먼저 쳐서, 쓰러진 상대는 되받아치지 못한다. 둘 다면 동시. [결정] 2026-09-30

## 반영 내역

- `cre-shepherd-of-the-lost`: 에메리아의 천사, 3/3 백 5, 비행·선제공격·경계, `types: [angel]`, 먹지 않고 돈을 쓰지 않는다.
- 새 능력 `first_strike`(선제공격, `sim/combat.ts` 의 `clash`).
- 경계: 잠든 채 덮쳐지지 않는다 (`caughtAsleep`, [결정] 2026-09-30). 자는 이는 덮쳐진 첫 합에 반격하지 못한다는 규칙도 이때 생겼다.
