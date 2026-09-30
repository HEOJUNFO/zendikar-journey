---
id: ZEN-69
order: 46
name_en: "Sphinx of Lost Truths"
name_ko: "잃어버린 진실의 스핑크스"
set: ZEN
number: 69
mana_cost: "{3}{U}{U}"
type_line: "Creature — Sphinx"
pt: "3/5"
rarity: rare
artist: "Shelly Wan"
scryfall: https://scryfall.com/card/zen/69/sphinx-of-lost-truths
added: 2026-09-30
entities: [cre-sphinx-of-lost-truths, loc-sejiri, cre-sphinx]
---

## 카드 원문

**규칙 텍스트**

> Kicker {1}{U} (You may pay an additional {1}{U} as you cast this spell.)
> Flying
> When this creature enters, draw three cards. Then if it wasn't kicked, discard three cards.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 스핑크스다. 3/5, 비행. [카드]
- 사자의 몸에 붉은 깃털 날개, 깃털 장식을 단 긴 땋은 머리의 사람 얼굴. 눈 덮인 바위 봉우리 위, 뒤로 설산과 구름. [그림]
- 잊히고 잃어버린 진실을 되찾는 존재다. [카드] 이름. 스핑크스는 옛 지식을 품는다. [배경]
- 세지리에 산다 (그림의 설원). [결정] 2026-09-30
- 들어올 때 셋 뽑기 = 그날 첫 도착 때 조종하는 이가 비밀 셋을 앎. 킥커 {1}{U} = 도착할 때 제 마나로 치를 수 있으면 치름. 못 치르면 주문 셋을 잊음. [결정] 2026-09-30
- 말하는 존재다. 아는 비밀을 누구에게 나눌지는 LLM이 그로서 정한다. [가공]

## 반영 내역

- `cre-sphinx-of-lost-truths` (새 생물종, 한 마리): 세지리, 3/5, 청 5, `fly`, `enter_draw: { count: 3, discard: 3, kicker: "{1}{U}" }`.
- 새 효과 `enter_draw` (`sim/abilities.ts` 의 `enterDraw`, `onEnter` 에서).
- `loc-sejiri`, `cre-sphinx`: 링크.
