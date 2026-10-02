---
id: ZEN-25
order: 151
name_en: "Luminarch Ascension"
name_ko: "빛의 사제장의 승천"
set: ZEN
number: 25
mana_cost: "{1}{W}"
type_line: "Enchantment"
rarity: rare
artist: "Michael Komarck"
scryfall: https://scryfall.com/card/zen/25/luminarch-ascension
added: 2026-10-02
entities: [itm-luminarch-ascension, cre-angel, loc-emeria, law-permanents]
---

## 카드 원문

**규칙 텍스트**

> At the beginning of each opponent's end step, if you didn't lose life this turn, you may put a quest counter on this enchantment. (Damage causes loss of life.)
> {1}{W}: Create a 4/4 white Angel creature token with flying. Activate only if this enchantment has four or more quest counters on it.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 부여마법 {1}{W}. 각 상대의 종료 단계에, 이번 턴 생명을 잃지 않았으면 탐색 카운터를 놓을 수 있다 (피해도 생명을 잃게 함). {1}{W}: 4/4 비행 백색 천사 토큰. 카운터가 넷 이상일 때만. [카드] 플레이버 없음.
- 빛 속에서 초록 고리를 두른 천사들이 두 팔을 벌린 이를 둘러쌈. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 서 있는 곳: 에메리아 북서쪽, 빛이 쏟아지는 부서진 제단(`pos: [-0.3, -0.4]`). [결정] 2026-10-02, 방위는 [가공]
- 종료 단계 = 매일 자정. 조건 = 그날 생명을 잃지도 피해를 입지도 않음 (이 세계의 싸움 피해는 상처라서, 카드의 "피해도 생명을 잃게 함"을 살림). [결정] 2026-10-02
- 천사를 부름 = 플레이어 행동·NPC 계획 블록 `ascend`, 언제든 어디서든 1시간, 마나가 있는 만큼 여러 번. 천사 토큰은 주인의 권속, 생물 유형 천사. [가공]
- 천사라는 생물종 `cre-angel` 을 새로 둠. [가공]

## 반영 내역

- `itm-luminarch-ascension` (새 아이템, 부여마법): 에메리아 북서쪽, {1}{W}, `quest_unhurt` + `quest_token`.
- `cre-angel` (새 생물종): 승천이 부르는 천사 토큰의 종.
- `loc-emeria`, `itm-archmage-ascension`, `cre-emeria-angel`, `law-permanents`: 링크.
- 새 아이템 효과 `quest_unhurt`, `quest_token` (`sim/luminarch.ts`, 플레이어 행동·NPC 계획 블록 `ascend`), `Actor.hurtDay` (`loseLife`·`dealDamage` 가 적음).
