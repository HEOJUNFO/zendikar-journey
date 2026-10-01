---
id: ZEN-54
order: 105
name_en: "Lullmage Mentor"
name_ko: "잠재움술사 스승"
set: ZEN
number: 54
mana_cost: "{1}{U}{U}"
type_line: "Creature — Merfolk Wizard"
pt: "2/2"
rarity: rare
artist: "Jaime Jones"
scryfall: https://scryfall.com/card/zen/54/lullmage-mentor
added: 2026-10-01
entities: [chr-lullmage-mentor, cre-merfolk, loc-sea-gate, chr-merfolk-seastalkers, chr-sea-gate-loremaster, chr-seascape-aerialist]
---

## 카드 원문

**규칙 텍스트**

> Whenever a spell or ability you control counters a spell, you may create a 1/1 blue Merfolk creature token.
> Tap seven untapped Merfolk you control: Counter target spell.

**플레이버 텍스트**

> "Many voices are needed to quiet this land."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 인어 마법사, 2/2. 당신이 조종하는 주문이나 능력이 주문을 무효화할 때마다 1/1 청색 인어 토큰을 만들 수 있다. 탭되지 않은 인어 일곱을 탭: 주문 하나를 무효화한다. [카드]
- 플레이버: "이 땅을 잠재우려면 많은 목소리가 필요하다." [카드]
- 붉은 망토의 늙은 인어 마법사가 두루마리를 들고 걷고, 제자 하나가 따른다. [그림]
- 잠재움술사는 로일을 잠재우려는 타짐의 인어 마법사. [배경] → 바다 관문 북동쪽 돌 둑. [결정] 2026-10-01 (방위는 [가공]). [새 지역 후보] 없음.
- 말하는 인어 마법사, 설득으로 권속. [결정] 2026-10-01
- 인어라는 생물 유형(`merfolk`)을 새로 두고, 세계의 인어 셋(바다추적자, 전승술사, 비행술사)에도 붙인다. [가공]
- 무효화할 때마다 = 그를 조종하는 이가 무엇으로든 무효화에 성공할 때, 1/1 청색 인어가 그 이 곁에 나 권속 (늘). [가공]
- 인어 일곱 탭 = 조종하는 이가 같은 칸에 묶이지 않은 인어 일곱을 거느리면 취소처럼 반응해 무효화 (마나 없이), 일곱이 자정까지 묶임. [결정] 2026-10-01: 지금 넣음

## 반영 내역

- `chr-lullmage-mentor` (새 인물): 바다 관문 `home_pos: [0.4, -0.3]`, 2/2, 마나 청 3, `types: [merfolk]`, `counter_tokens`.
- `cre-merfolk` (새 생물종, 토큰): 1/1 청색 인어.
- `chr-merfolk-seastalkers`, `chr-sea-gate-loremaster`, `chr-seascape-aerialist`: `types: [merfolk]`.
- `loc-sea-gate`: 사는 스승 링크.
- 새 생물 유형 `merfolk`, 무효화 반응에 합창(`sim/counter.ts` 의 `chorus`, `answerOf`, `answerName`), 무효화 성공 때 `counterTokens`.
