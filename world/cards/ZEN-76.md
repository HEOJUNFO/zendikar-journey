---
id: ZEN-76
order: 172
name_en: "Welkin Tern"
name_ko: "천공 제비갈매기"
set: ZEN
number: 76
mana_cost: "{1}{U}"
type_line: "Creature — Bird"
pt: "2/1"
rarity: common
artist: "Austin Hsu"
scryfall: https://scryfall.com/card/zen/76/welkin-tern
added: 2026-10-02
entities: [cre-welkin-tern, loc-tazeem]
---

## 카드 원문

**규칙 텍스트**

> Flying (This creature can't be blocked except by creatures with flying or reach.)
> This creature can block only creatures with flying.

**플레이버 텍스트**

> "The sky hedrons are covered with tern nests. It's as though the birds have given up on the land altogether."
> —Ilori, merfolk falconer

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 새 {1}{U}, 2/1. 비행. 비행하는 생물만 막을 수 있다. [카드]
- 플레이버: "하늘 헤드론마다 제비갈매기 둥지가 덮여 있다. 새들이 땅을 아예 포기한 것 같다." — 인어 매사냥꾼 일로리. [카드]
- 구름 위를 나는 흰 제비갈매기. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 사는 곳: 타짐 본토 북쪽 떠 있는 헤드론(`home_pos: [0, -0.8]`), 인어의 대륙, 고마조아의 하늘. [결정] 2026-10-02, 방위는 [가공]
- 말 없는 짐승, 배고프면 덮침, 길들일 수 있음. [가공]
- 막기 제약 = 날지 못하는 이가 덤비면 맞받아치지 못함(날아 피할 수는 있음), 주인을 날지 못하는 이에게서 지키지 못함. [가공]

## 반영 내역

- `cre-welkin-tern` (새 생물): 타짐 북쪽, 2/1, 마나 청 2, 짐승, `fly`, `block_only_fliers`.
- `loc-tazeem`, `cre-bird`, `cre-gomazoa`: 링크.
- 새 능력 `block_only_fliers` (`sim/combat.ts` 의 `unblockable`, 권속의 지킴).
