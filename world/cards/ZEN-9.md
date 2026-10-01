---
id: ZEN-9
order: 58
name_en: "Day of Judgment"
name_ko: "심판의 날"
set: ZEN
number: 9
mana_cost: "{2}{W}{W}"
type_line: "Sorcery"
rarity: rare
artist: "Vincent Proce"
scryfall: https://scryfall.com/card/zen/9/day-of-judgment
added: 2026-10-01
entities: [spl-day-of-judgment, loc-emeria, chr-sorin-markov]
---

## 카드 원문

**규칙 텍스트**

> Destroy all creatures.

**플레이버 텍스트**

> "I have seen planes leveled and all life rendered to dust. It brought no pleasure, even to a heart as dark as mine."
> —Sorin Markov

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 집중마법. 모든 생물을 파괴한다. [카드]
  = 시전자와 같은 칸의 모두(시전자도, 권속·짐승·플레이어도)가 죽는다. 플레인즈워커는 남고 파괴불가는 견딘다 (`destroy_all`). [결정] 2026-10-01 (시전자 포함), 그 자리 = 같은 칸 [결정] 대응 표
- 눈부신 흰 빛이 터져 사람들이 검게 타 재로 흩어진다. [그림]
- 소린 마르코프: 차원들이 무너지고 모든 생명이 먼지가 되는 것을 보았다, 기쁨은 없었다. [카드] 플레이버
- 에메리아에서 배운다 (4시간). [결정] 2026-10-01 (천사들의 하늘 폐허, [가공])

## 반영 내역

- `spl-day-of-judgment` (새 주문): 에메리아, {2}{W}{W}, `target: self`, `destroy_all`.
- 새 효과 `destroy_all` (`sim/spells.ts` 의 `judgment`).
- `loc-emeria`, `chr-sorin-markov`: 링크.
