---
id: ZEN-47
order: 188
name_en: "Hedron Crab"
name_ko: "헤드론 게"
set: ZEN
number: 47
mana_cost: "{U}"
type_line: "Creature — Crab"
pt: "0/2"
rarity: uncommon
artist: "Jesper Ejsing"
scryfall: https://scryfall.com/card/zen/47/hedron-crab
added: 2026-10-02
entities: [cre-hedron-crab, loc-silundi-coast]
---

## 카드 원문

**규칙 텍스트**

> Landfall — Whenever a land you control enters, target player mills three cards. (They put the top three cards of their library into their graveyard.)

**플레이버 텍스트**

> Hedrons perplex minds both great and small.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 게 {U}, 0/2. 상륙: 당신의 대지가 들어올 때마다 대상 플레이어가 서고 위 세 장을 무덤에. [카드]
- 플레이버: 헤드론은 크고 작은 정신을 모두 어지럽힌다. [카드]
- 헤드론 조각을 껴안은 게, 물이 쏟아지는 떠 있는 바위들과 바다. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 사는 곳: 실룬디 연안 남동쪽 갯바위 (`home_pos: [0.3, 0.2]`). [결정] 2026-10-02, 방위는 [가공]
- 말하지 않는 짐승 (길들일 수 있음). 상륙 = 조종하는 이의 유대, 게가 곁에 깨어 있을 때 (연꽃 코브라와 같음). 대상 플레이어 = 같은 칸의 하나(자신도), 반드시. 서고 = 아직 익힐 수 있는 주문 (가학의 성례와 같음). 밀 = 무작위 셋이 주문 무덤으로. [가공]

## 반영 내역

- `cre-hedron-crab` (새 생물, 한 마리): 실룬디 연안 남동쪽, 0/2, 마나 청 1, 짐승, `landfall_mill: 3`.
- `loc-silundi-coast`: 링크.
- 새 능력 `landfall_mill` (`sim/mill.ts`, 고를 것 `mill`).
