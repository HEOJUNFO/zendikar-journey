---
id: ZEN-95
order: 34
name_en: "Hagra Diabolist"
name_ko: "하그라 악마술사"
set: ZEN
number: 95
mana_cost: "{4}{B}"
type_line: "Creature — Ogre Shaman Ally"
pt: "3/2"
rarity: uncommon
artist: "Karl Kopinski"
scryfall: https://scryfall.com/card/zen/95/hagra-diabolist
added: 2026-09-30
entities: [chr-hagra-diabolist, loc-hagra, loc-guul-draz, law-allies]
---

## 카드 원문

**규칙 텍스트**

> Whenever this creature or another Ally you control enters, you may have target player lose life equal to the number of Allies you control.

**플레이버 텍스트**

> "When exploring the darkest regions, wickedness can be the best accomplice of all."

## 해석

- 두건 달린 검은 망토, 해골 허리띠의 오우거가 분홍빛 마법 불꽃을 들고 황혼의 황야에 서 있다 [그림]. 흑색 오우거 주술사 동료, 3/2 [카드].
- 하그라 = 굴 드라즈 대부분을 덮은 썩은 늪, 무너진 옛 저수조, 폐허의 잔인한 오우거 부족 [배경] (웹 검색으로 확인). 굴 드라즈 안에 하그라 늪 구역을 더한다 [결정] (사용자 요청). 땅이 아니다.
- 용병 동료: 50코인에 고용, 설득도 된다 [결정].
- 무리 발동: 그 자리의 하나가 무리의 동료 수만큼 생명을 잃는다 (통제자가 고름, 안 고를 수도).

## 반영 내역

- `loc-hagra` (새 구역, 굴 드라즈 안): 늪, 마나 없음, `not_land`.
- `chr-hagra-diabolist` (새 인물): 3/2, 흑 5, `ally`, `hireable`, `rally: lose_life_allies`.
- `loc-guul-draz`, `law-allies`: 연결.
- 엔진: 무리 발동 `lose_life_allies` (`allies.ts`).
