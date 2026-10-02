---
id: ZEN-43
order: 180
name_en: "Caller of Gales"
name_ko: "돌풍을 부르는 이"
set: ZEN
number: 43
mana_cost: "{U}"
type_line: "Creature — Merfolk Wizard"
pt: "1/1"
rarity: common
artist: "Alex Horley-Orlandelli"
scryfall: https://scryfall.com/card/zen/43/caller-of-gales
added: 2026-10-02
entities: [chr-caller-of-gales, loc-silundi-coast, cre-merfolk]
---

## 카드 원문

**규칙 텍스트**

> {1}{U}, {T}: Target creature gains flying until end of turn.

**플레이버 텍스트**

> "Some merfolk choose to rest their fins in the water. I believe wisdom exists not only where we were born but where we were told not to go."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 인어 마법사 {U}, 1/1. {1}{U}, {T}: 대상 생물이 턴 끝까지 비행을 얻는다. [카드]
- 플레이버: 어떤 인어는 물에 지느러미를 쉬게 하지만, 지혜는 가지 말라던 곳에도 있다. [카드]
- 물보라 치는 바위 끝에서 바람을 부르는 붉은 머리 인어. [그림]
- 지명 확인: 카드에 지명 없음, 인어의 땅은 세계에 있음. [새 지역 후보] 없음.
- 사는 곳: 실룬디 연안 북서쪽 바위 끝(`home_pos: [-0.3, -0.3]`), 하늘을 또 하나의 바다라 부르는 해안. [결정] 2026-10-02, 방위는 [가공]
- 말하는 인어, 먹지만 돈은 안 씀, 인어라 합창이 셈. [가공]
- 탭 능력 = 조종하는 이가 값을 치르고 1시간, 같은 칸의 하나(자신도)가 자정까지 비행, 그는 자정까지 묶임 (고귀한 잔영의 가호와 같은 틀). [가공]

## 반영 내역

- `chr-caller-of-gales` (새 인물): 실룬디 연안 북서쪽, 1/1, 마나 청 1, `types: [merfolk]`, `tap_grant: fly, {1}{U}`.
- `loc-silundi-coast`, `chr-seascape-aerialist`, `cre-merfolk`: 링크.
- 탭 힘 `gale` (`sim/tapper.ts`, `sim.tap_grant`, 플레이어 행동·NPC 계획 블록 `gale`).
