---
id: ZEN-33
order: 196
name_en: "Quest for the Holy Relic"
name_ko: "성물 탐색"
set: ZEN
number: 33
mana_cost: "{W}"
type_line: "Enchantment"
rarity: uncommon
artist: "Greg Staples"
scryfall: https://scryfall.com/card/zen/33/quest-for-the-holy-relic
added: 2026-10-02
entities: [itm-quest-for-the-holy-relic, loc-emeria]
---

## 카드 원문

**규칙 텍스트**

> Whenever you cast a creature spell, you may put a quest counter on this enchantment.
> Remove five quest counters from this enchantment and sacrifice it: Search your library for an Equipment card, put it onto the battlefield, attach it to a creature you control, then shuffle.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 부여마법 {W}. 생물 주문을 쓸 때마다 탐색 카운터를 놓을 수 있다. 다섯을 떼고 희생: 서고에서 장비를 찾아 전장에 놓고 당신의 생물에게 붙인다. [카드]
- 무덤 속 석관을 열어 금빛 갑옷의 주검을 드러내는 탐험가들. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 놓인 곳: 에메리아 동쪽 무덤 (`pos: [0.4, -0.2]`). [결정] 2026-10-02, 방위는 [가공]
- 생물 주문을 씀 = 주인에게 권속이 새로 듦 (토큰 빼고). 서고의 장비 = 세계의 주인 없는 장비. 붙임 = 값 없이 맴. 희생 = 원정 마치기. [가공]

## 반영 내역

- `itm-quest-for-the-holy-relic` (새 아이템, 부여마법): 에메리아 동쪽, {W}로 길들임, `cast_quest` + `expedition { counters: 5, relic: true }`.
- `loc-emeria`, `itm-luminarch-ascension`: 링크.
- 새 효과 `cast_quest`, 원정 보상 `relic` (`sim/relic.ts`, 고를 것 `relic`).
- 고침: `run.ts` 에서 코르 채비사의 고를 것(`outfit`, 후보가 "장비|맬 이")이 사람만 남기는 거르기에 걸려 NPC는 늘 건너뛰던 것.
