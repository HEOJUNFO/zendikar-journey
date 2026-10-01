---
id: ZEN-75
order: 126
name_en: "Umara Raptor"
name_ko: "우마라 맹금"
set: ZEN
number: 75
mana_cost: "{2}{U}"
type_line: "Creature — Bird Ally"
pt: "1/1"
rarity: common
artist: "Sam Wood"
scryfall: https://scryfall.com/card/zen/75/umara-raptor
added: 2026-10-01
entities: [cre-umara-raptor, loc-umara-gorge, law-allies]
---

## 카드 원문

**규칙 텍스트**

> Flying
> Whenever this creature or another Ally you control enters, you may put a +1/+1 counter on this creature.

**플레이버 텍스트**

> Messenger, weapon, friend.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 새 동료, 1/1, 비행. 이것이나 다른 동료가 들어올 때마다 이것에 +1/+1 카운터. [카드]
- 플레이버: 전령, 무기, 벗. [카드]
- 폭포 쏟아지는 떠 있는 바위 협곡, 가죽 장갑 낀 주먹에 내려앉는 흰 가슴의 매, 발목의 끈. [그림]
- 지명: 우마라(이름) 강 협곡은 세계에 있음, [새 지역 후보] 없음.
- 자리: 협곡 북쪽 마고시 폭포 곁. [가공]
- 길들인 매 = 말하지 않는 짐승 (모든 짐승처럼 길들임) + 30코인 고용. [결정] 2026-10-01
- 무리 발동 = 투크투크 졸개들의 `counter_self` 와 같은 대응.

## 반영 내역

- `cre-umara-raptor` (새 생물종, 한 마리가 산다): 우마라 강 협곡 `home_pos: [0.1, -0.6]`, 1/1, 마나 청 3, 짐승, `fly`, `ally`, `hireable`, `rally: counter_self`.
- `loc-umara-gorge`, `law-allies`: 링크.
