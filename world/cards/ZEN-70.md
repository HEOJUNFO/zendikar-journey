---
id: ZEN-70
order: 163
name_en: "Spreading Seas"
name_ko: "번지는 바다"
set: ZEN
number: 70
mana_cost: "{1}{U}"
type_line: "Enchantment — Aura"
rarity: common
artist: "Jung Park"
scryfall: https://scryfall.com/card/zen/70/spreading-seas
added: 2026-10-02
entities: [spl-spreading-seas, loc-sea-gate, law-permanents]
---

## 카드 원문

**규칙 텍스트**

> Enchant land
> When this Aura enters, draw a card.
> Enchanted land is an Island.

**플레이버 텍스트**

> Most inhabitants of Zendikar have given up on the idea of an accurate map.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 부여마법 — 오라 {1}{U}. 땅에 붙는다. 들어올 때 카드 한 장. 붙은 땅은 섬이다. [카드]
- 플레이버: "젠디카르 주민 대부분은 정확한 지도라는 생각을 버렸다." [카드]
- 숲을 덮치는 거대한 파도. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 배우는 곳: 바다 관문. [결정] 2026-10-02
- 어느 땅: 걸고 난 뒤 같은 칸의 누군가(자신도) 쥐고 있는 땅 하나. [결정] 2026-10-02
- 섬이 됨 = 유대한 모두에게 청 마나만, 땅의 종류는 섬 (전장의 땅을 세는 효과), 제 힘을 잃음. 서고를 뒤지는 효과(페치·써레질)는 본래 종류로. 땅의 오라는 그 땅에 선 이가 부술 수 있고, 땅이 부서지면 사라짐. [가공]
- 카드 한 장 = 비밀 하나. [가공]

## 반영 내역

- `spl-spreading-seas` (새 주문): 바다 관문에서 4시간, {1}{U}, 땅 오라, `target: self`, `flood_land`.
- `loc-sea-gate`, `law-permanents`: 링크.
- 새 주문 효과 `flood_land` (`sim/flood.ts`, `RegionState.flooded`, 고를 것 `flood`). `landTypes(r, state)` 가 잠긴 땅을 섬으로, `manaCapacity` 가 청 마나로, 유대 효과·탭된 채 들어옴·페치·발라쿠트·탭 능력·에메리아의 되살림이 잠긴 땅에서 멈춤. 유물 분쇄가 그 자리의 땅 오라를 고를 수 있음.
