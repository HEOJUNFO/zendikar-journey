---
id: ZEN-77
order: 51
name_en: "Whiplash Trap"
name_ko: "채찍 함정"
set: ZEN
number: 77
mana_cost: "{3}{U}{U}"
type_line: "Instant — Trap"
rarity: common
artist: "Zoltan Boros & Gabor Szikszai"
scryfall: https://scryfall.com/card/zen/77/whiplash-trap
added: 2026-09-30
entities: [evt-whiplash-trap, loc-tazeem, law-ruin-traps]
---

## 카드 원문

**규칙 텍스트**

> If an opponent had two or more creatures enter the battlefield under their control this turn, you may pay {U} rather than pay this spell's mana cost.
> Return two target creatures to their owners' hands.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 순간마법 — 함정. 상대가 이번 턴 생물 둘 이상을 들였으면 {U}로. 생물 둘을 주인의 손으로. [카드]
- 꼬투리 달린 거대한 줄기가 채찍처럼 휘어 원정대원을 휘감고 하늘로 내동댕이친다. [그림]
- 타짐에 숨는다. [결정] 2026-10-01
- 조건 = 그날 권속이 둘 이상 새로 든 이가 들어섬. [가공] (들어옴 = 무리에 듦)
- 되돌림 = 카운터·오라·그날 힘·피해가 떨어지고 주인에게서 풀려나, 같은 지역의 다른 구역(또는 바깥 지역)으로 날아가 1시간 기절. 토큰은 사라짐. [결정] 2026-10-01 (거처로 날려 보내는 것은 과하다)

## 반영 내역

- `evt-whiplash-trap` (새 사건): 타짐, `trigger: enter`, `joined: 2`, `bounce: 2`.
- 새 조건 `joined` (`sim/bounce.ts` 의 `joinedToday`, `Actor.joinedAt`), 새 효과 `bounce` (`sim/bounce.ts`, LLM `chooseBounce`).
- `law-ruin-traps`, `loc-tazeem`: 링크와 설명.
