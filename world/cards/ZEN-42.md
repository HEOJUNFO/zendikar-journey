---
id: ZEN-42
order: 88
name_en: "Archmage Ascension"
name_ko: "대마법사의 승천"
set: ZEN
number: 42
mana_cost: "{2}{U}"
type_line: "Enchantment"
rarity: rare
artist: "Christopher Moeller"
scryfall: https://scryfall.com/card/zen/42/archmage-ascension
added: 2026-10-01
entities: [itm-archmage-ascension, loc-sea-gate]
---

## 카드 원문

**규칙 텍스트**

> At the beginning of each end step, if you drew two or more cards this turn, you may put a quest counter on this enchantment.
> As long as this enchantment has six or more quest counters on it, if you would draw a card, you may instead search your library for a card, put that card into your hand, then shuffle.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 부여마법. 종료 단계마다 그 턴에 둘 이상 뽑았으면 탐색 카운터를 놓을 수 있고, 여섯 이상이면 뽑기 대신 서고에서 카드를 찾아 손에 넣을 수 있다. [카드]
- 푸른 빛 속에서 떠오르는 여인과 기둥처럼 휘감는 빛의 룬. [그림]
- 승천 = 탐색 카운터를 쌓는 수행. 바다 관문 = 학자와 서고의 도시. [배경] → 바다 관문 북동쪽 서고에 서 있다. [결정] 2026-10-01 (방위는 [가공])
- 오라가 아닌 부여마법 = 한곳에 서 있는 아이템, 길들여 갖는다. [결정] 2026-09-30
- 종료 단계 = 자정, 뽑기 = 비밀을 알게 됨. 카운터는 늘 놓는다. [가공]
- 서고에서 찾기 = 비밀이 아닌 실제 그것을, 다만 무작위로: 주문은 익히고, 아이템은 그의 것, 생물은 곁으로 데려온다 (권속은 아니다). 함정·오늘의 일은 비밀로. [결정] 2026-10-01

## 반영 내역

- `itm-archmage-ascension` (새 아이템, 부여마법): 바다 관문 `pos: [0.3, -0.35]`, {2}{U}, 효과 `quest` (`draws: 2`, `counters: 6`).
- 새 규칙 `sim/ascension.ts`: `upkeepQuest`(00:00, `step.ts`), `ascended`, `obtain`. `drawKnowledge`(`sim/knowledge.ts`)가 승천한 주인에게는 비밀 대신 대상을 준다. 아이템을 갖는 길을 `takeItem`(`sim/items.ts`)으로 뽑아냄.
- `loc-sea-gate`: 서고의 승천 링크.
