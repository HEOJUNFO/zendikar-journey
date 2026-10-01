---
id: ZEN-91
order: 139
name_en: "Grim Discovery"
name_ko: "음산한 발견"
set: ZEN
number: 91
mana_cost: "{1}{B}"
type_line: "Sorcery"
rarity: common
artist: "Christopher Moeller"
scryfall: https://scryfall.com/card/zen/91/grim-discovery
added: 2026-10-01
entities: [spl-grim-discovery, loc-guum-wilds]
---

## 카드 원문

**규칙 텍스트**

> Choose one or both —
> • Return target creature card from your graveyard to your hand.
> • Return target land card from your graveyard to your hand.

**플레이버 텍스트**

> Few among the living understand just how much of their world is shaped by the ruins of the dead.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 집중마법 {1}{B}. 하나 또는 둘 다: 무덤의 생물 카드를 손으로, 무덤의 대지 카드를 손으로. [카드]
- 플레이버: 세계가 죽은 자들의 폐허로 빚어졌음을 아는 이는 드물다. [카드]
- 종유석 동굴 속 묻힌 석조 유적과 횃불 든 탐험가들. [그림]
- 지명 없음, [새 지역 후보] 없음. 배우는 곳: 굼 밀림 (묻힌 유적). [결정] 2026-10-01
- 생물을 손으로 = 되살아나되 자유롭게(제 거처, 누구도 섬기지 않음). [결정] 2026-10-01
- 땅의 무덤 = 한때 유대를 맺었다가 지금은 쥐지 않은 땅, 손으로 = 손에 든 땅. [결정] 2026-10-01
- 하나 또는 둘 다 = 각각 고르거나 그만둘 수 있음.

## 반영 내역

- `spl-grim-discovery` (새 주문): 굼 밀림에서 4시간, {1}{B}, `target: self`, `grim_discovery`.
- `loc-guum-wilds`: 링크.
- 새 주문 효과 `grim_discovery` (`sim/discovery.ts`, 고를 것 `discovery`), 땅의 무덤을 위한 `Actor.everBonded` (`bondLand` 이 기록).
