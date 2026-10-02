---
id: ZEN-35
order: 199
name_en: "Shieldmate's Blessing"
name_ko: "방패동료의 축복"
set: ZEN
number: 35
mana_cost: "{W}"
type_line: "Instant"
rarity: common
artist: "Mike Bierek"
scryfall: https://scryfall.com/card/zen/35/shieldmates-blessing
added: 2026-10-02
entities: [spl-shieldmates-blessing, loc-makindi, loc-emeria]
---

## 카드 원문

**규칙 텍스트**

> Prevent the next 3 damage that would be dealt to any target this turn.

**플레이버 텍스트**

> "Even land dwellers may call for Emeria's grace in times of need."
> —Emeria's Creed

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 순간마법 {W}. 이번 턴 대상(아무 대상)이 받을 다음 피해 3을 막는다. [카드]
- 플레이버: 땅에 사는 이들도 위급할 때 에메리아의 은총을 부를 수 있다 — 에메리아의 신조. [카드]
- 물가에서 날개 달린 짐승의 숨결을 막아 내는 빛의 장막. [그림]
- 지명 확인: 에메리아 (세계에 있음). [새 지역 후보] 없음.
- 배우는 곳: 마킨디 (이름의 방패동료). [결정] 2026-10-02, [가공]
- 아무 대상 = 같은 칸의 하나(자신도, 플레인즈워커도). 이번 턴 = 자정까지. 고귀한 잔영의 가호와 같은 것. [가공]

## 반영 내역

- `spl-shieldmates-blessing` (새 주문): 마킨디에서 4시간, {W}, 순간마법, `ward: 3`.
- `loc-makindi`, `chr-makindi-shieldmate`, `loc-emeria`: 링크.
- 새 효과 `ward` (`sim/spells.ts`, `Actor.shield`).
