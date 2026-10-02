---
id: ZEN-93
order: 187
name_en: "Guul Draz Vampire"
name_ko: "굴 드라즈 흡혈귀"
set: ZEN
number: 93
mana_cost: "{B}"
type_line: "Creature — Vampire Rogue"
pt: "1/1"
rarity: common
artist: "Steve Argyle"
scryfall: https://scryfall.com/card/zen/93/guul-draz-vampire
added: 2026-10-02
entities: [chr-guul-draz-vampire, loc-guul-draz, cre-vampire]
---

## 카드 원문

**규칙 텍스트**

> As long as an opponent has 10 or less life, this creature gets +2/+1 and has intimidate. (It can't be blocked except by artifact creatures and/or creatures that share a color with it.)

**플레이버 텍스트**

> "A creature's bloodscent is a beacon that cannot be disguised."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 생물 — 흡혈귀 도적 {B}, 1/1. 상대가 생명 10 이하인 동안 +2/+1과 위협. [카드]
- 플레이버: 생물의 피 냄새는 숨길 수 없는 등불이다. [카드]
- 늪 밀림 나뭇가지 위에 몸을 낮추고 굽은 칼을 쥔 흡혈귀. [그림]
- 지명 확인: 굴 드라즈 (세계에 있음). [새 지역 후보] 없음.
- 사는 곳: 굴 드라즈 본토 북동쪽 (`home_pos: [0.3, -0.3]`). [결정] 2026-10-02, 방위는 [가공]
- 상대 = 그날의 적(그 자신과 조종하는 이의 것), 매시간 다시 셈 (블러드고스트와 같음). [결정] 2026-10-02

## 반영 내역

- `chr-guul-draz-vampire` (새 인물): 굴 드라즈 북동쪽, 1/1, 마나 흑 1, 흡혈귀, `low_life_boost`.
- `loc-guul-draz`, `cre-vampire`: 링크.
- 새 능력 `low_life_boost` (`sim/bloodghast.ts`, `Actor.bloodBoost`).
