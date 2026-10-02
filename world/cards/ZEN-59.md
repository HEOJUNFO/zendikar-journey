---
id: ZEN-59
order: 193
name_en: "Quest for Ancient Secrets"
name_ko: "고대 비밀 탐색"
set: ZEN
number: 59
mana_cost: "{U}"
type_line: "Enchantment"
rarity: uncommon
artist: "Mike Bierek"
scryfall: https://scryfall.com/card/zen/59/quest-for-ancient-secrets
added: 2026-10-02
entities: [itm-quest-for-ancient-secrets, loc-sea-gate]
---

## 카드 원문

**규칙 텍스트**

> Whenever a card is put into your graveyard from anywhere, you may put a quest counter on this enchantment.
> Remove five quest counters from this enchantment and sacrifice it: Target player shuffles their graveyard into their library.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 부여마법 {U}. 무덤에 카드가 들 때마다 탐색 카운터를 놓을 수 있다. 다섯을 떼고 희생: 대상 플레이어가 무덤을 서고에 섞는다. [카드]
- 동굴 벼랑 끝의 탐험가와 금빛으로 빛나는 옛 문양 벽, 물안개. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 놓인 곳: 바다 관문 남서쪽 바다 동굴 벼랑 끝 (`pos: [-0.4, 0.4]`). [결정] 2026-10-02, 방위는 [가공]
- 무덤에 카드가 들 때 = 주인이 무덤에 무언가 보낼 때(`buried`), 매시간 셈, 늘 놓음. [가공]
- 무덤을 서고에 섞음 = 주문 무덤이 비고(아직 익히지 않은 것으로), 생물 무덤의 죽은 이들이 제 거처에서 되살아남(누구도 섬기지 않음). [결정] 2026-10-02
- 희생 = 주인이 언제든 어디서든 1시간, 사라짐. 대상 = 그 칸의 하나(자신도). [가공]

## 반영 내역

- `itm-quest-for-ancient-secrets` (새 아이템, 부여마법): 바다 관문 남서쪽, {U}로 길들임, `graveyard_quest: { counters: 5 }`.
- `loc-sea-gate`, `itm-ior-ruin-expedition`: 링크.
- 새 효과 `graveyard_quest` (`sim/secrets.ts`): 플레이어 행동·NPC 계획 블록 `secrets`, 고를 것 `secrets`. 음산한 발견의 되살림을 `riseAtHome` 으로 뺌.
