---
id: ZEN-20
order: 103
name_en: "Kor Hookmaster"
name_ko: "코르 갈고리술사"
set: ZEN
number: 20
mana_cost: "{2}{W}"
type_line: "Creature — Kor Soldier"
pt: "2/2"
rarity: common
artist: "Wayne Reynolds"
scryfall: https://scryfall.com/card/zen/20/kor-hookmaster
added: 2026-10-01
entities: [chr-kor-hookmaster, loc-makindi]
---

## 카드 원문

**규칙 텍스트**

> When this creature enters, tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.

**플레이버 텍스트**

> "For us, a rope represents the ties that bind the kor. For you, it's more literal."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 코르 병사, 2/2. 들어올 때 상대가 조종하는 생물 하나를 탭한다; 그 생물은 다음 언탭단에 언탭하지 않는다. [카드]
- 플레이버: 코르에게 밧줄은 유대, 너에겐 말 그대로. [카드]
- 갈고리 사슬을 휘두르며 몸을 날리는 흰 머리 코르 여전사. [그림]
- 코르의 온두, 마킨디 협곡 남동쪽 절벽 길목. [배경] ([결정] 2026-10-01, 방위는 [가공]). [새 지역 후보] 없음.
- 말하는 코르 병사, 설득으로 권속 (고용 안 됨). [결정] 2026-10-01
- 들어올 때 = 그날 첫 도착 (기존). 상대가 조종하는 생물 = 같은 칸의 그 편이 아닌 이 (플레인즈워커 빼고), 조종하는 이가 반드시 고름. 탭 + 다음 언탭 거름 = 다음 날 00:00을 넘겨 그다음 00:00까지 묶임. [가공] (기존 대응)

## 반영 내역

- `chr-kor-hookmaster` (새 인물): 마킨디 `home_pos: [0.35, 0.25]`, 2/2, 마나 백 3, `enter_tap: true`.
- `loc-makindi`: 사는 코르 링크.
- 새 들어설 때 능력 `enter_tap` (`sim/hook.ts`, 고를 것 `hook`).
