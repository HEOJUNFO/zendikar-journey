---
id: ZEN-23
order: 149
name_en: "Kor Skyfisher"
name_ko: "코르 하늘낚시꾼"
set: ZEN
number: 23
mana_cost: "{1}{W}"
type_line: "Creature — Kor Soldier"
pt: "2/3"
rarity: common
artist: "Dan Murayama Scott"
scryfall: https://scryfall.com/card/zen/23/kor-skyfisher
added: 2026-10-02
entities: [chr-kor-skyfisher, loc-arid-mesa]
---

## 카드 원문

**규칙 텍스트**

> Flying
> When this creature enters, return a permanent you control to its owner's hand.

**플레이버 텍스트**

> "Sometimes I snare the unexpected, but I know its purpose will be revealed in time."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 코르 병사 {1}{W}, 2/3 비행. 들어올 때 당신이 조종하는 지속물 하나를 소유자의 손으로 되돌린다. [카드]
- 플레이버: "때로는 뜻밖의 것을 낚아채지만, 그 쓰임새는 때가 되면 드러나지." [카드]
- 밧줄 걸린 절벽과 떠 있는 헤드론 사이를 뼈대 날개 활공체로 나는 흰 머리칼의 코르. [그림]
- 지명 확인: 카드에 지명 없음, 코르의 본거지는 세계에 있음. [새 지역 후보] 없음.
- 사는 곳: 메마른 메사 서쪽 절벽 사이(`home_pos: [-0.4, 0.2]`). [결정] 2026-10-02, 방위는 [가공]
- 말하는 코르 병사 (설득 가능, 먹고 돈을 씀), 코르라 무장의 달인이 센다. [가공]
- 들어올 때 되돌림 = 그날 첫 도착마다 조종하는 이가 제 것 하나를 반드시 거둠, 아슬아슬한 탈출과 같은 고르기 (자신·권속 피신, 땅 다시 맺음, 아이템 흩어짐, 오라 다시 걸기). [결정] 2026-10-02

## 반영 내역

- `chr-kor-skyfisher` (새 인물): 메마른 메사 서쪽, 2/3, 마나 백 2, `fly`, `types: [kor]`, `enter_return`.
- `loc-arid-mesa`, `chr-kor-sanctifiers`, `spl-narrow-escape`: 링크.
- 새 능력 `enter_return` (`sim/escape.ts` 의 `enterReturn`, 고를 것 `escape`).
