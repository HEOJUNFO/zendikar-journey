---
id: ZEN-89
order: 136
name_en: "Gatekeeper of Malakir"
name_ko: "말라키르의 문지기"
set: ZEN
number: 89
mana_cost: "{B}{B}"
type_line: "Creature — Vampire Warrior"
pt: "2/2"
rarity: uncommon
artist: "Karl Kopinski"
scryfall: https://scryfall.com/card/zen/89/gatekeeper-of-malakir
added: 2026-10-01
entities: [chr-gatekeeper-of-malakir, loc-malakir, cre-vampire]
---

## 카드 원문

**규칙 텍스트**

> Kicker {B} (You may pay an additional {B} as you cast this spell.)
> When this creature enters, if it was kicked, target player sacrifices a creature of their choice.

**플레이버 텍스트**

> "You may enter the city—once the toll is paid."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 생물 — 흡혈귀 전사, 2/2. 킥커 {B}. 들어올 때 킥커했다면 대상 플레이어가 자신이 고른 생물 하나를 희생. [카드]
- 플레이버: 도시에 들어와도 좋다, 통행세를 치르고 나면. [카드]
- 녹빛 늪 안개 앞 가시 돋친 사슬 갑옷의 흡혈귀 전사. [그림]
- 지명: 말라키르(이름)는 세계에 있음, [새 지역 후보] 없음. 자리: 말라키르 동쪽 성문. (방위는 [가공])
- 말하는 흡혈귀, 설득으로 권속. `creature: cre-vampire`. 마나 흑 3 (킥커를 제 힘으로 치를 수 있게). [가공]
- 킥커 들어올 때 = 매일 첫 도착, 제 마나로 (기존 대응). 대상 플레이어 = 같은 칸의 남, 조종하는 이가 고르고 안 고를 수도. 희생할 생물 = 그가 조종하는 생물(자신도). [결정] 2026-10-01

## 반영 내역

- `chr-gatekeeper-of-malakir` (새 인물): 말라키르 `home_pos: [0.6, 0.1]`, 2/2, 마나 흑 3, `creature: cre-vampire`, `enter_sacrifice: { kicker: "{B}" }`.
- `loc-malakir`, `cre-vampire`: 링크.
- 새 규칙 `enter_sacrifice` (`sim/toll.ts`, 고를 것 `toll`, 내놓기는 `sim/quell.ts` 의 `quelled`).
