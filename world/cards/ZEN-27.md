---
id: ZEN-27
order: 112
name_en: "Narrow Escape"
name_ko: "아슬아슬한 탈출"
set: ZEN
number: 27
mana_cost: "{2}{W}"
type_line: "Instant"
rarity: common
artist: "Karl Kopinski"
scryfall: https://scryfall.com/card/zen/27/narrow-escape
added: 2026-10-01
entities: [spl-narrow-escape, loc-kazandu]
---

## 카드 원문

**규칙 텍스트**

> Return target permanent you control to its owner's hand. You gain 4 life.

**플레이버 텍스트**

> "A good explorer has to be as slippery as a gomazoa, as tough as a scute bug, and luckier than a ten-fingered trapfinder."
> —Arhana, Kazandu trapfinder

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 순간마법 {2}{W}. 당신이 조종하는 지속물 하나를 소유자의 손으로 되돌리고 생명 4를 얻는다. [카드]
- 플레이버: 탐험가는 고마조아만큼 미끄럽고 딱정벌레만큼 질기고 함정꾼보다 운이 좋아야 (카잔두 함정꾼 아르하나). [카드] 고마조아는 타짐에 산다.
- 어두운 밀림, 덮쳐 오는 가시 돋친 아가리에서 몸을 비틀어 빠져나가는 백발의 탐험가. [그림]
- 카잔두 = 원정대·함정꾼이 모이는 무라사의 무너진 밀림. [배경] 지명 확인: 카잔두·카잔두 피난처는 세계에 있음, [새 지역 후보] 없음.
- 배우는 곳: 카잔두. [결정] 2026-10-01
- 되돌릴 수 있는 것: 지속물 모두 (자신·같은 칸의 권속, 쥔 땅, 제 아이템, 같은 칸에 제가 건 오라). [결정] 2026-10-01
- 존재를 되돌림 = 피신: 몸에 붙은 것이 떨어지고 그날의 적이 풀리고 같은 지역의 다른 구역으로 (채찍 함정처럼, 기절 없이). [결정] 2026-10-01
- 제 손으로 돌아오는 것이라 권속은 시전자 곁에 남는다. 힘으로 붙든 이는 제 주인(자신)에게, 토큰은 사라진다. 땅은 유대를 거둠(다시 맺음), 아이템은 카운터·장착이 흩어짐, 오라는 다시 걸 수 있음. [가공]

## 반영 내역

- `spl-narrow-escape` (새 주문): 카잔두에서 4시간, {2}{W}, 순간마법, `target: self`, `return_own` + `gain_life: 4`.
- `loc-kazandu`: 가르치는 주문 링크.
- 새 주문 효과 `return_own` (`sim/escape.ts`, 고를 것 `escape`), `gain_life` (시전자). `bounce.ts` 의 `shed` 가 주인을 남길 수 있게(`keepMaster`), `landing` 을 내보냄.
