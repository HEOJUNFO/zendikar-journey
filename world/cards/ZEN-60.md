---
id: ZEN-60
order: 117
name_en: "Reckless Scholar"
name_ko: "무모한 학자"
set: ZEN
number: 60
mana_cost: "{2}{U}"
type_line: "Creature — Human Wizard"
pt: "2/1"
rarity: common
artist: "Steve Prescott"
scryfall: https://scryfall.com/card/zen/60/reckless-scholar
added: 2026-10-01
entities: [chr-reckless-scholar, loc-sea-gate]
---

## 카드 원문

**규칙 텍스트**

> {T}: Target player draws a card, then discards a card.

**플레이버 텍스트**

> "Any good prospector must sift the gold from the sand."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 인간 마법사, 2/1. {T}: 대상 플레이어가 카드 한 장을 뽑고 한 장을 버린다. [카드]
- 플레이버: 좋은 탐사꾼은 모래에서 금을 걸러낼 줄 알아야. [카드]
- 떠 있는 헤드론·문양 석판 사이, 고글 쓰고 주머니 단 청색 옷의 탐험가가 돌벽을 짚고 들여다봄. [그림]
- 지명 없음, [새 지역 후보] 없음.
- 자리: 바다 관문 남서쪽 부둣가. [결정] 2026-10-01 (방위는 [가공])
- 말하는 인물, 설득으로 권속 (고용 안 됨). 먹고 돈을 씀. [결정] 2026-10-01
- 뽑기 = 비밀을 앎, 버리기 = 주문을 잊음(잃는 이가 고름), 대상 플레이어 = 같은 칸의 한 사람(자신도), 탭 = 자정까지 묶임 (기존 대응).
- 쓰는 법: 조종하는 이가 골라 쓴다 (고귀한 잔영의 가호와 같은 틀).

## 반영 내역

- `chr-reckless-scholar` (새 인물): 바다 관문 `home_pos: [-0.3, 0.2]`, 2/1, 마나 청 3, `tap_loot`.
- `loc-sea-gate`: 머무는 학자 링크.
- `sim/vestige.ts` 를 `sim/tapper.ts` 로 넓힘: 탭해서 같은 칸의 한 사람에게 거는 힘(`shield`, `loot`). 새 힘 `tap_loot`, 플레이어 행동·NPC 계획 블록 `loot`, 웹 "학자의 이야기" 단추.
