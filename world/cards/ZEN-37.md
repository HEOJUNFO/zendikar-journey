---
id: ZEN-37
order: 203
name_en: "Sunspring Expedition"
name_ko: "햇샘 원정"
set: ZEN
number: 37
mana_cost: "{W}"
type_line: "Enchantment"
rarity: common
artist: "Chris J. Anderson"
scryfall: https://scryfall.com/card/zen/37/sunspring-expedition
added: 2026-10-02
entities: [itm-sunspring-expedition, loc-sejiri-refuge]
---

## 카드 원문

**규칙 텍스트**

> Landfall — Whenever a land you control enters, you may put a quest counter on this enchantment.
> Remove three quest counters from this enchantment and sacrifice it: You gain 8 life.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 부여마법 {W}. 상륙 — 탐색 카운터를 놓을 수 있다. 셋을 떼고 희생: 생명 8을 얻는다. [카드]
- 숲에 둘러싸인 유적, 날개 편 새 석상을 인 샘과 원정대 셋. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 놓인 곳: 세지리 피난처 북서쪽 옛 샘 (`pos: [-0.3, -0.3]`). [결정] 2026-10-02, 방위는 [가공]
- 이오르 폐허 원정과 같은 틀 (원정 마치기). [가공]

## 반영 내역

- `itm-sunspring-expedition` (새 아이템, 부여마법): 세지리 피난처 북서쪽, {W}로 길들임, `landfall_quest` + `expedition { counters: 3, life: 8 }`.
- `loc-sejiri-refuge`, `itm-ior-ruin-expedition`: 링크.
- 새 원정 보상 `life` (`sim/expedition.ts`).
