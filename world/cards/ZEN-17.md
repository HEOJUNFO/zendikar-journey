---
id: ZEN-17
order: 147
name_en: "Kor Aeronaut"
name_ko: "코르 비행사"
set: ZEN
number: 17
mana_cost: "{W}{W}"
type_line: "Creature — Kor Soldier"
pt: "2/2"
rarity: uncommon
artist: "Karl Kopinski"
scryfall: https://scryfall.com/card/zen/17/kor-aeronaut
added: 2026-10-02
entities: [chr-kor-aeronaut, loc-makindi]
---

## 카드 원문

**규칙 텍스트**

> Kicker {1}{W} (You may pay an additional {1}{W} as you cast this spell.)
> Flying
> When this creature enters, if it was kicked, target creature gains flying until end of turn.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 코르 병사 {W}{W}, 2/2. 킥커 {1}{W}. 비행. 들어올 때 킥커였으면 대상 생물이 이번 턴 비행을 얻는다. [카드] 플레이버 없음.
- 떠 있는 석조 폐허 사이를 갈고리 밧줄 하나로 날아 건너는 긴 머리의 코르 병사. [그림]
- 코르는 온두의 협곡과 메사에 살며 밧줄과 갈고리로 벼랑과 떠 있는 바위를 오간다. [배경] 지명 확인: 카드에 지명 없음, 코르의 본거지(마킨디 협곡·메마른 메사)는 세계에 있음. [새 지역 후보] 없음.
- 사는 곳: 마킨디 협곡 북서쪽 떠 있는 바위들 사이(`home_pos: [-0.3, -0.55]`, 바람타기 뱀장어의 바람길 곁). [결정] 2026-10-02, 방위는 [가공]
- 말하는 코르 병사 (설득 가능, 먹고 돈을 씀), 코르라 무장의 달인이 센다. [가공]
- 킥커 = 생물의 "들어올 때"처럼 그날 첫 도착 때 제 마나로 치를 수 있으면, 조종하는 이가 같은 칸의 하나(자신도)를 골라 자정까지 비행 (횃불 투척꾼과 같은 틀). [가공]

## 반영 내역

- `chr-kor-aeronaut` (새 인물): 마킨디 협곡 북서쪽, 2/2, 마나 백 2, `fly`, `types: [kor]`, `enter_grant: fly, {1}{W}`.
- `loc-makindi`, `chr-kor-hookmaster`, `cre-windrider-eel`: 링크.
- 새 능력 `enter_grant` (`sim/aeronaut.ts`, 고를 것 `lift`).
