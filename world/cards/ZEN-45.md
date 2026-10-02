---
id: ZEN-45
order: 181
name_en: "Cosi's Trickster"
name_ko: "코시의 속임수"
set: ZEN
number: 45
mana_cost: "{U}"
type_line: "Creature — Merfolk Wizard"
pt: "1/1"
rarity: rare
artist: "Igor Kieryluk"
scryfall: https://scryfall.com/card/zen/45/cosis-trickster
added: 2026-10-02
entities: [chr-cosis-trickster, loc-sea-gate, cre-merfolk]
---

## 카드 원문

**규칙 텍스트**

> Whenever an opponent shuffles their library, you may put a +1/+1 counter on this creature.

**플레이버 텍스트**

> She watches the chaos created by the Roil, seeking strength in the patterns of anarchy.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 인어 마법사 {U}, 1/1. 상대가 서고를 섞을 때마다 +1/+1 카운터를 놓을 수 있다. [카드]
- 플레이버: 뒤틀림이 만드는 혼돈을 지켜보며 무질서의 무늬에서 힘을 찾는다. [카드]
- 떠 있는 바위 아래 소용돌이 물 위의 청록빛 인어. [그림]
- 코시 = 인어의 세 신 가운데 사기꾼의 신. [배경] 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 사는 곳: 바다 관문 북동쪽 얕은 물가(`home_pos: [0.4, -0.4]`). [결정] 2026-10-02, 방위는 [가공]
- 서고를 섞음 = 땅을 찾아 멀리서 이음 (페치, 써레질, 지도 제작자, 길잡이, 칼니 심장 원정). 상대 = 같은 땅(구역 포함)의 남 (그 자신과 섬기는 이 빼고). 늘 놓음. [결정] 2026-10-02 / [가공]

## 반영 내역

- `chr-cosis-trickster` (새 인물): 바다 관문 북동쪽, 1/1, 마나 청 1, `types: [merfolk]`, `shuffle_counter`.
- `loc-sea-gate`, `cre-merfolk`: 링크.
- 새 능력 `shuffle_counter` (`sim/trickster.ts`, `markSearched` 가 찾기를 모으고 매시간 처리).
