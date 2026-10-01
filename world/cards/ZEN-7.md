---
id: ZEN-7
order: 133
name_en: "Cliff Threader"
name_ko: "절벽 타는 이"
set: ZEN
number: 7
mana_cost: "{1}{W}"
type_line: "Creature — Kor Scout"
pt: "2/1"
rarity: common
artist: "Paul Bonner"
scryfall: https://scryfall.com/card/zen/7/cliff-threader
added: 2026-10-01
entities: [chr-cliff-threader, loc-makindi, cre-kor-soldier, chr-armament-master]
---

## 카드 원문

**규칙 텍스트**

> Mountainwalk (This creature can't be blocked as long as defending player controls a Mountain.)

**플레이버 텍스트**

> "The crossing demands singular focus. Your life consists of these ropes, these hooks, and these rocky crags. Your past is miles below."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 코르 정찰병, 2/1. 산걷기. [카드]
- 플레이버: 건너기는 오롯한 집중을, 네 과거는 수 마일 아래에. [카드]
- 까마득한 절벽 위 밧줄에 매달려 갈고리를 거는 백발의 코르, 아래 초록 골짜기. [그림]
- 코르 = 밧줄로 절벽을 타는 유랑 부족. [배경] 지명 없음, [새 지역 후보] 없음.
- 자리: 마킨디 협곡 서쪽 절벽. [결정] 2026-10-01 (방위는 [가공])
- 말하는 코르, 설득으로 권속. `types: [kor]`.
- 산걷기 = 늪걷기·숲걷기·섬걷기와 같은 대응 (표에 산 한 줄).

## 반영 내역

- `chr-cliff-threader` (새 인물): 마킨디 `home_pos: [-0.6, 0.15]`, 2/1, 마나 백 2, `types: [kor]`, `mountainwalk`.
- `loc-makindi`, `cre-kor-soldier`, `chr-armament-master`: 링크.
- 능력 `mountainwalk` (`combat.ts` 의 `LANDWALK` 에 산).
