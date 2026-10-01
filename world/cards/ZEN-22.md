---
id: ZEN-22
order: 104
name_en: "Kor Sanctifiers"
name_ko: "코르 정화자들"
set: ZEN
number: 22
mana_cost: "{2}{W}"
type_line: "Creature — Kor Cleric"
pt: "2/3"
rarity: common
artist: "Dan Murayama Scott"
scryfall: https://scryfall.com/card/zen/22/kor-sanctifiers
added: 2026-10-01
entities: [chr-kor-sanctifiers, loc-arid-mesa]
---

## 카드 원문

**규칙 텍스트**

> Kicker {W} (You may pay an additional {W} as you cast this spell.)
> When this creature enters, if it was kicked, destroy target artifact or enchantment.

**플레이버 텍스트**

> "Why keep such trinkets? They only add weight to your travels."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 코르 성직자, 2/3. 킥커 {W}. 들어올 때 킥커했다면 마법물체나 부여마법 하나를 파괴. [카드]
- 플레이버: "그런 장신구를 왜 지니나? 여행길에 짐만 될 뿐인데." [카드]
- 마주 서서 금빛 수정을 정화하는 흰 머리 코르 성직자 둘. [그림]
- 소유를 짐으로 여기는 코르, 캄사의 사제들이 순례하는 메마른 메사. [배경] → 메사 북동쪽 바위 제단. [결정] 2026-10-01 (방위는 [가공]). [새 지역 후보] 없음.
- 말하는 코르 성직자 한 쌍 (한 인물), 설득으로 권속. [결정] 2026-10-01
- 킥커와 들어올 때 파괴 = 곰팡이 비틀보의 들어설 때 무너뜨림(`enter_shatter`)을 마법물체·부여마법으로 좁힘 (`relics`, 땅 빠짐). [가공] (기존 대응)

## 반영 내역

- `chr-kor-sanctifiers` (새 인물): 메마른 메사 `home_pos: [0.3, -0.3]`, 2/3, 마나 백 3, `enter_shatter: { kicker: '{W}', relics: true }`.
- `loc-arid-mesa`: 순례하는 코르 링크.
- `enter_shatter` 에 `relics` (마법물체·부여마법만).
