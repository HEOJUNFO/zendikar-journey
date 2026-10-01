---
id: ZEN-83
order: 130
name_en: "Bloodghast"
name_ko: "피의 망령"
set: ZEN
number: 83
mana_cost: "{B}{B}"
type_line: "Creature — Vampire Spirit"
pt: "2/1"
rarity: rare
artist: "Daarken"
scryfall: https://scryfall.com/card/zen/83/bloodghast
added: 2026-10-01
entities: [chr-bloodghast, loc-guul-draz, cre-vampire]
---

## 카드 원문

**규칙 텍스트**

> This creature can't block.
> This creature has haste as long as an opponent has 10 or less life.
> Landfall — Whenever a land you control enters, you may return this card from your graveyard to the battlefield.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 생물 — 흡혈귀 영혼, 2/1. 막을 수 없다. 상대의 생명이 10 이하인 동안 속공. 상륙: 무덤에서 전장으로 되돌릴 수 있다. [카드]
- 녹빛 늪 안개 속 붉은 핏자국을 휘날리는 해골 얼굴의 망령. [그림]
- 지명 없음, [새 지역 후보] 없음. 자리: 굴 드라즈 본토 서쪽 늪. [결정] 2026-10-01 (방위는 [가공])
- 말 없는 망령 (짐승, 먹지 않음, 모든 짐승처럼 길들임). [결정] 2026-10-01
- 흡혈귀 = `creature: cre-vampire` (생물종 요소면 제 이름이 생물 종류가 되므로 인물 요소로 둠). [가공]
- 막을 수 없다 = 하그라 악어와 같은 대응. 상대 = 그날의 적(그나 조종하는 이의), 매시간 따짐. [가공]
- 무덤 = 그가 든 생물 무덤의 임자, 상륙 = 그 임자가 유대를 맺을 때, 되돌림 = 그 곁에 그의 권속으로 (에메리아의 되살림과 같은 틀), "할 수 있다"는 늘. [가공]

## 반영 내역

- `chr-bloodghast` (새 인물): 굴 드라즈 `home_pos: [-0.4, 0.2]`, 2/1, 마나 흑 2, 짐승, `creature: cre-vampire`, `cant_block`, `haste_low_life: 10`, `landfall_return`.
- `loc-guul-draz`, `cre-vampire`: 링크.
- 새 규칙 `haste_low_life` (`sim/bloodghast.ts` 의 `bloodHasteHour`, 매시간), `landfall_return` (`landfallReturn`, `bondLand` 이 부름).
