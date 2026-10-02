---
id: ZEN-82
order: 177
name_en: "Bloodchief Ascension"
name_ko: "혈족장의 승천"
set: ZEN
number: 82
mana_cost: "{B}"
type_line: "Enchantment"
rarity: rare
artist: "Adi Granov"
scryfall: https://scryfall.com/card/zen/82/bloodchief-ascension
added: 2026-10-02
entities: [itm-bloodchief-ascension, loc-ghet-estate, law-life, law-permanents]
---

## 카드 원문

**규칙 텍스트**

> At the beginning of each end step, if an opponent lost 2 or more life this turn, you may put a quest counter on this enchantment. (Damage causes loss of life.)
> Whenever a card is put into an opponent's graveyard from anywhere, if this enchantment has three or more quest counters on it, you may have that player lose 2 life. If you do, you gain 2 life.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 부여마법 {B}. 각 종료 단계에, 상대가 이번 턴 생명을 2 이상 잃었으면 탐색 카운터를 놓을 수 있다 (피해도 생명을 잃게 함). 카운터 셋 이상이면, 상대의 무덤에 카드가 들 때마다 그가 생명 2를 잃게 하고 당신이 2를 얻을 수 있다. [카드] 플레이버 없음.
- 핏빛 소용돌이 속 날개 같은 어깨의 흡혈귀 혈족장. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 서 있는 곳: 게트 혈족의 영지 북서쪽 높은 대(`pos: [-0.3, -0.3]`). [결정] 2026-10-02, 방위는 [가공]
- 상대 = 주인과 같은 땅(구역 포함)의 다른 이. [결정] 2026-10-02
- 생명을 잃음 = 생명을 잃은 것과 받은 피해를 합쳐 2 이상 (루미나크의 승천과 같은 해석). 무덤에 카드가 듦 = 주문을 잊음, 섬기던 권속이 죽음. 둘 다 늘 함. [가공]

## 반영 내역

- `itm-bloodchief-ascension` (새 아이템, 부여마법): 게트 혈족의 영지 북서쪽, {B}, `bloodchief: 3, drain 2`.
- `loc-ghet-estate`, `law-life`, `itm-archmage-ascension`, `itm-blade-of-the-bloodchief`, `law-permanents`: 링크.
- 새 아이템 효과 `bloodchief` (`sim/bloodascension.ts`): `Actor.hurtToday`(`markHurt`), 무덤의 수를 매시간 살핌(`state.buriedSeen`).
