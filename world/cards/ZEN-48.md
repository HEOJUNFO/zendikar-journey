---
id: ZEN-48
order: 142
name_en: "Into the Roil"
name_ko: "뒤틀림 속으로"
set: ZEN
number: 48
mana_cost: "{1}{U}"
type_line: "Instant"
rarity: common
artist: "Kieran Yanner"
scryfall: https://scryfall.com/card/zen/48/into-the-roil
added: 2026-10-02
entities: [spl-into-the-roil, loc-silundi-coast, law-permanents]
---

## 카드 원문

**규칙 텍스트**

> Kicker {1}{U} (You may pay an additional {1}{U} as you cast this spell.)
> Return target nonland permanent to its owner's hand. If this spell was kicked, draw a card.

**플레이버 텍스트**

> "Roil tide! Roil tide! Tie yourselves down!"

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 순간마법 {1}{U}, 킥커 {1}{U}. 땅이 아닌 지속물 하나를 소유자의 손으로 되돌리고, 킥커면 카드 한 장을 뽑는다. [카드]
- 플레이버: "뒤틀림 물살이다! 뒤틀림 물살! 몸을 묶어라!" [카드] 뒤틀림(Roil)은 젠디카르의 땅과 물을 뒤집는 격변. [배경]
- 거대한 물기둥, 찢긴 돛의 뗏목, 허공으로 휩쓸려 올라가는 뱃사람과 매달린 둘. [그림]
- 지명 확인: 카드에 지명 없음. 뒤틀림은 곳이 아니라 현상(타짐에 뒤틀림 정령이 떠돎). [새 지역 후보] 없음.
- 배우는 곳: 실룬디 연안 (실룬디 바다를 마주한 해안, 그림의 바다). [결정] 2026-10-02
- 되돌릴 수 있는 것: 같은 칸의 땅 아닌 지속물 (남의 존재·플레이어·플레인즈워커, 자신·권속, 주인 있는 아이템, 누가 걸었든 오라). 땅은 아니다. [카드]/[가공]
- 남의 존재를 되돌림 = 채찍 함정처럼 내동댕이쳐져 1시간 기절 (몸에 붙은 것이 떨어지고 섬기던 이에게서 풀려나 다른 구역으로). [결정] 2026-10-02
- 자신·권속은 아슬아슬한 탈출과 같이 피신, 아이템은 카운터·장착이 흩어짐, 오라는 건 이가 다시 걸 수 있음, 토큰은 사라짐, 플레인즈워커는 기세가 처음대로. [가공]
- 카드 뽑기 = 비밀 하나를 앎 (README 대응 표). [가공]

## 반영 내역

- `spl-into-the-roil` (새 주문): 실룬디 연안에서 4시간, {1}{U}, 킥커 {1}{U}, 순간마법, `target: self`, `return_nonland` + `draw: 1 (if_kicked)`.
- `loc-silundi-coast`: 가르치는 주문 링크.
- 새 주문 효과 `return_nonland` (`sim/escape.ts` 의 `any`: 고를 것 `escape` 에 `any`), `draw` (시전자가 비밀 N, `if_kicked`).
