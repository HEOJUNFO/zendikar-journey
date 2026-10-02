---
id: ZEN-73
order: 168
name_en: "Trapfinder's Trick"
name_ko: "함정꾼의 요령"
set: ZEN
number: 73
mana_cost: "{1}{U}"
type_line: "Sorcery"
rarity: common
artist: "Philip Straub"
scryfall: https://scryfall.com/card/zen/73/trapfinders-trick
added: 2026-10-02
entities: [spl-trapfinders-trick, loc-kazandu, law-ruin-traps]
---

## 카드 원문

**규칙 텍스트**

> Target player reveals their hand and discards all Trap cards.

**플레이버 텍스트**

> "At some point, every trapfinder will lose a hunk of flesh. It's just a question of how much—and whether it'll grow back."
> —Arhana, Kazandu trapfinder

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 집중마법 {1}{U}. 대상 플레이어가 손패를 공개하고 함정 카드를 모두 버린다. [카드]
- 플레이버: 함정꾼이라면 언젠가 살점 한 덩이쯤 잃는다, 문제는 얼마나 잃느냐와 다시 자라느냐 — 카잔두의 함정꾼 아르하나. [카드]
- 돌 얼굴 함정 앞에서 빛으로 장치를 비추는 함정꾼. [그림]
- 지명 확인: 카잔두는 세계에 있음. [새 지역 후보] 없음.
- 배우는 곳: 카잔두. [결정] 2026-10-02
- 각색: 이 세계의 손패는 아는 주문, 함정은 땅에 숨은 사건이라 손에 든 함정 카드가 없다. 그래서 시전자가 선 땅과 그 안의 구역에 숨은 함정을 모두 알게 된다 (어느 칸, 무엇에 터지는지). [결정] 2026-10-02 (사용자 요청: 함정 위치를 아는 것으로 각색)

## 반영 내역

- `spl-trapfinders-trick` (새 주문): 카잔두에서 4시간, {1}{U}, 집중마법, `target: self`, `find_traps`.
- `loc-kazandu`, `law-ruin-traps`, `spl-narrow-escape`: 링크.
- 새 주문 효과 `find_traps` (`sim/knowledge.ts` 의 `findTraps`).
