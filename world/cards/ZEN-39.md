---
id: ZEN-39
order: 52
name_en: "World Queller"
name_ko: "세계를 잠재우는 자"
set: ZEN
number: 39
mana_cost: "{3}{W}{W}"
type_line: "Creature — Avatar"
pt: "4/4"
rarity: rare
artist: "James Paick"
scryfall: https://scryfall.com/card/zen/39/world-queller
added: 2026-09-30
entities: [cre-world-queller, loc-ondu, law-permanents]
---

## 카드 원문

**규칙 텍스트**

> At the beginning of your upkeep, you may choose a card type. If you do, each player sacrifices a permanent of their choice of that type.

**플레이버 텍스트**

> "Why fight the world when you know who will win?"
> —Nissa Revane

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 화신, 4/4. 유지 단계에 카드 유형을 고르면 각 플레이어가 그 유형의 지속물 하나를 희생. [카드]
- 바위와 흙, 부서진 나무가 엉긴 거대한 형체가 누런 황무지에서 몸을 일으킨다. [그림]
- 니사 레반: 누가 이길지 알면서 왜 세계와 싸우는가. [카드] 플레이버. 세계의 뜻을 입은 화신. [가공]
- 온두에 둔다. 말하지 않는 화신. 각 플레이어 = 그 자리의 모두. [결정] 2026-10-01
- 유형 넷(땅·생물·마법물체·부여마법)과 각 유형의 희생 방식. [가공]

## 반영 내역

- `cre-world-queller` (새 생물종, 한 개체): 온두, 4/4, 백 5, `beast`, `needs: [energy]`, `quell`.
- 새 능력 `quell` (`sim/quell.ts`): 00:00 유형 부름(`quell` 고를 것), 제 것 내놓기(`quelled` 고를 것). NPC는 LLM `pick`, 플레이어는 고를 것.
- `loc-ondu`, `law-permanents`: 링크.
