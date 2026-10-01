---
id: ZEN-18
order: 69
name_en: "Kor Cartographer"
name_ko: "코르 지도 제작자"
set: ZEN
number: 18
mana_cost: "{3}{W}"
type_line: "Creature — Kor Scout"
pt: "2/2"
rarity: common
artist: "Ryan Pancoast"
scryfall: https://scryfall.com/card/zen/18/kor-cartographer
added: 2026-10-01
entities: [chr-kor-cartographer, loc-makindi]
---

## 카드 원문

**규칙 텍스트**

> When this creature enters, you may search your library for a Plains card, put it onto the battlefield tapped, then shuffle.

**플레이버 텍스트**

> Kor have no concept of exploration. They return to homelands forgotten.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 코르 정찰병, 2/2. 들어올 때 서고에서 평원 하나를 찾아 탭된 채 전장에 놓을 수 있다. [카드]
- 지명 확인: 카드에 지명 없음. 코르는 본거지 없는 유목 종족, 이미 있는 마킨디 협곡(옛 코르 제국의 수도)에 둔다. [배경] [결정] 2026-10-01
- 들어올 때 = 그날 처음 어느 땅에 들어설 때 (기존 규칙). [결정] 2026-09-30
- 평원을 찾아 전장에 = 조종하는 이가 아직 유대 없는 평원 하나와 멀리서 유대 (페치와 같음: 하루 한 땅에 들지 않음, 상륙, `searched`). 탭된 채 = 그날 그 평원의 마나 없음. "할 수 있다" = 조종하는 이가 고르거나 안 고름. [가공]
- 금빛 하늘 아래 갈라진 소금 평원을 걷는 흰 털 망토의 코르 여인, 창과 장비, 밧줄 뭉치. [그림]
- 말하는 인물, 먹고 지침. [가공]

## 반영 내역

- `chr-kor-cartographer` (새 인물): 마킨디 협곡, 2/2, 백 4, `enter_search: { types: [plains], tapped: true }`, `needs: [energy, hunger]`.
- 새 능력 `sim.enter_search` (`abilities.ts` 의 `enterSearch`, `searchTargets`, `applySearch`, 고를 것 `search`: 플레이어는 `asks`, NPC는 LLM `pick`).
- `loc-makindi`, `cre-kor-soldier`: 링크.
