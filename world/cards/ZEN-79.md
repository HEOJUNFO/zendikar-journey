---
id: ZEN-79
order: 54
name_en: "Bala Ged Thief"
name_ko: "발라 게드의 도둑"
set: ZEN
number: 79
mana_cost: "{3}{B}"
type_line: "Creature — Human Rogue Ally"
pt: "2/2"
rarity: rare
artist: "Matt Cavotta"
scryfall: https://scryfall.com/card/zen/79/bala-ged-thief
added: 2026-10-01
entities: [chr-bala-ged-thief, loc-bala-ged, law-allies]
---

## 카드 원문

**규칙 텍스트**

> Whenever this creature or another Ally you control enters, target player reveals a number of cards from their hand equal to the number of Allies you control. You choose one of them. That player discards that card.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 인간 도적 동료, 2/2. [카드]
- 이것이나 다른 동료가 들어올 때마다, 대상 플레이어가 손에서 동료 수만큼 공개하고 당신이 하나를 골라 버리게 한다. [카드]
  = 무리에 들 때마다, 통제자가 같은 칸의 하나를 골라 그의 주문·비밀 가운데 무작위로 동료 수만큼을 보고, 하나를 골라 잊게 한다 (`reveal_discard`). [결정] 대응 표: 손패 = 주문 + 비밀, 버리기 = 잊음, 대상 플레이어 = 같은 칸의 하나
- 고른 것을 훔치지는 않는다 (카드대로 버리게만). [결정] 2026-10-01
- 한쪽 눈에 안대, 땋은 머리의 여자 도적이 어두운 곳의 섬뜩한 조각상에서 초록빛 유물을 들어낸다. [그림]
- 발라 게드 사람, 묻힌 유적과 도굴꾼. [카드] 이름, [배경]
- 발라 게드의 묻힌 유적(소환 함정) 바로 곁에 산다. [결정] 2026-10-01 (방위는 [가공])
- 고용 40코인 + 설득. [결정] 2026-10-01

## 반영 내역

- `chr-bala-ged-thief` (새 인물): 발라 게드 `home_pos: [-0.03, -0.15]`, 2/2, 흑 4, `ally`, `hireable`, `rally: reveal_discard`.
- 새 무리 발동 `reveal_discard` (`sim/allies.ts`), 손패 드러내기·잊기 (`sim/discard.ts` 의 `handOf`, `revealHand`, `forgetCard`), 고를 것 `pilfer` (NPC는 LLM `pick`, 플레이어는 "고를 것").
- `law-allies`, `loc-bala-ged`: 링크와 설명.
