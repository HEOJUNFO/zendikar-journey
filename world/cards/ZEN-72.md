---
id: ZEN-72
order: 166
name_en: "Tempest Owl"
name_ko: "폭풍 올빼미"
set: ZEN
number: 72
mana_cost: "{1}{U}"
type_line: "Creature — Bird"
pt: "1/2"
rarity: common
artist: "Dan Murayama Scott"
scryfall: https://scryfall.com/card/zen/72/tempest-owl
added: 2026-10-02
entities: [cre-tempest-owl, loc-umara-gorge]
---

## 카드 원문

**규칙 텍스트**

> Kicker {4}{U} (You may pay an additional {4}{U} as you cast this spell.)
> Flying
> When this creature enters, if it was kicked, tap up to three target permanents.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 새 {1}{U}, 1/2. 킥커 {4}{U}. 비행. 들어올 때 킥커였으면 지속물 셋까지 탭. [카드] 플레이버 없음.
- 폭포와 물안개 사이 바위 봉우리를 나는 보랏빛 올빼미. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 사는 곳: 우마라 강 협곡 북서쪽 마고시 폭포 곁 봉우리(`home_pos: [-1, -1]`). [결정] 2026-10-02, 방위는 [가공]
- 말 없는 짐승, 배고프면 덮침, 길들일 수 있음. [가공]
- 킥커는 주인이 치름 (주인 없으면 제 마나). [결정] 2026-10-02
- 탭 = 그 칸의 존재는 자정까지 묶임, 누군가 쥔 땅은 그가 오늘 그 땅의 마나를 못 씀. 셋까지 하나씩, 안 고를 수도. [가공]

## 반영 내역

- `cre-tempest-owl` (새 생물): 우마라 강 협곡 북서쪽, 1/2, 마나 청 2, 짐승, `fly`, `enter_tap_many: 3, {4}{U}`.
- `loc-umara-gorge`, `cre-bird`: 링크.
- 새 능력 `enter_tap_many` (`sim/owl.ts`, 고를 것 `gust`).
